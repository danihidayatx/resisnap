import { createIcons, Printer, Usb, FileUp, RotateCw, FileText, Download } from 'lucide';
import { PdfRenderer } from './pdf-renderer';
import { CropManager } from './cropper';
import { ImageProcessor } from './image-proc';
import { EscPosBuilder } from './escpos';
import { UsbPrinter } from './usb-printer';
import { jsPDF } from 'jspdf';
import JsBarcode from 'jsbarcode';

// Initialize Lucide icons
createIcons({
  icons: { Printer, Usb, FileUp, RotateCw, FileText, Download }
});

// App State
const state = {
  pdfRenderer: new PdfRenderer(),
  cropManager: new CropManager(),
  usbPrinter: new UsbPrinter(),
  currentPage: 1,
  rotation: 0,
  brightness: 0,
  contrast: 0,
  grayscale: true,
  textThreshold: 175,   // applied to text/non-barcode areas
  barcodeThreshold: 200, // applied to detected barcode zones
  barcodeErode: 1,       // erosion iterations in barcode zone (fixed)
  originalCanvases: [], // Original rendered canvases from PDF
  adjustedCanvases: [], // Canvases after brightness/contrast
  isCropping: false,
  barcodeValue: '',
  replaceBarcode: true,
  detectedBarcodes: [],
  printerWidthPx: 384, // 58mm=384, 80mm=576, 100mm=720 (at 203dpi)
};

// UI Elements
const els = {
  fileUpload: document.getElementById('file-upload'),
  canvasWrapper: document.getElementById('canvas-wrapper'),
  thumbnailStrip: document.getElementById('thumbnail-strip'),
  pageCount: document.getElementById('page-count'),
  rotateBtn: document.getElementById('rotate-btn'),
  brightnessSlider: document.getElementById('brightness'),
  contrastSlider: document.getElementById('contrast'),
  brightnessVal: document.getElementById('brightness-val'),
  contrastVal: document.getElementById('contrast-val'),
  grayscaleToggle: document.getElementById('grayscale-toggle'),
  thresholdSlider: document.getElementById('threshold'),
  thresholdVal: document.getElementById('threshold-val'),
  barcodeThresholdSlider: document.getElementById('barcode-threshold'),
  barcodeThresholdVal: document.getElementById('barcode-threshold-val'),
  barcodeErodeSlider: document.getElementById('barcode-erode'),
  barcodeErodeVal: document.getElementById('barcode-erode-val'),
  barcodeStatus: document.getElementById('barcode-status'),
  replaceBarcodeToggle: document.getElementById('replace-barcode-toggle'),
  barcodeValueInput: document.getElementById('barcode-value-input'),
  barcodePreviewCanvas: document.getElementById('barcode-preview-canvas'),
  connectBtn: document.getElementById('connect-printer'),
  printCurrentBtn: document.getElementById('print-current'),
  printAllBtn: document.getElementById('print-all'),
  downloadBtn: document.getElementById('download-pdf'),
  printerStatusDot: document.getElementById('printer-status-dot'),
  printerStatusText: document.getElementById('printer-status-text'),
  browserWarning: document.getElementById('browser-warning'),
};

// Check Browser Support
if (!navigator.usb) {
  els.browserWarning.hidden = false;
  els.connectBtn.disabled = true;
}

// --- Event Handlers ---

els.fileUpload.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const numPages = await state.pdfRenderer.loadPdf(file);
    els.pageCount.textContent = numPages;
    state.currentPage = 1;
    state.rotation = 0;
    state.barcodeValue = '';
    els.barcodeValueInput.value = '';
    updateBarcodePreview();
    state.detectedBarcodes = [];
    
    await loadAllPages();
    renderThumbnails();
    displayCurrentPage();
    
    // Run early barcode detection on the first page
    await detectBarcodeFromCurrentPage();
    
    els.printCurrentBtn.disabled = false;
    els.printAllBtn.disabled = false;
    els.downloadBtn.disabled = false;
  } catch (err) {
    console.error('Error loading PDF:', err);
    alert('Failed to load PDF. Please try another file.');
  }
});

els.rotateBtn.addEventListener('click', () => {
  state.rotation = (state.rotation + 90) % 360;
  displayCurrentPage();
});

els.brightnessSlider.addEventListener('input', (e) => {
  state.brightness = parseInt(e.target.value);
  els.brightnessVal.textContent = state.brightness;
  updateAdjustments();
});

els.contrastSlider.addEventListener('input', (e) => {
  state.contrast = parseInt(e.target.value);
  els.contrastVal.textContent = state.contrast;
  updateAdjustments();
});

els.grayscaleToggle.addEventListener('change', (e) => {
  state.grayscale = e.target.checked;
  updateAdjustments();
});

els.thresholdSlider.addEventListener('input', (e) => {
  state.textThreshold = parseInt(e.target.value);
  els.thresholdVal.textContent = state.textThreshold;
});

els.barcodeThresholdSlider.addEventListener('input', (e) => {
  state.barcodeThreshold = parseInt(e.target.value);
  els.barcodeThresholdVal.textContent = state.barcodeThreshold;
});

els.barcodeErodeSlider.addEventListener('input', (e) => {
  state.barcodeErode = parseInt(e.target.value);
  els.barcodeErodeVal.textContent = state.barcodeErode;
});

els.replaceBarcodeToggle.addEventListener('change', (e) => {
  state.replaceBarcode = e.target.checked;
  document.getElementById('barcode-edit-ui').style.opacity = state.replaceBarcode ? '1' : '0.5';
  document.getElementById('barcode-edit-ui').style.pointerEvents = state.replaceBarcode ? 'all' : 'none';
});

// Paper width selector
const paperWidthMap = { '58': 384, '80': 576, '100': 720 };
document.querySelectorAll('input[name="paper-width"]').forEach(radio => {
  radio.addEventListener('change', (e) => {
    state.printerWidthPx = paperWidthMap[e.target.value] || 384;
    console.log(`Paper width set to ${e.target.value}mm (${state.printerWidthPx}px)`);
  });
});

els.barcodeValueInput.addEventListener('input', (e) => {
  state.barcodeValue = e.target.value;
  updateBarcodePreview();
});

function updateBarcodePreview() {
  if (!state.barcodeValue) {
    const ctx = els.barcodePreviewCanvas.getContext('2d');
    ctx.clearRect(0, 0, els.barcodePreviewCanvas.width, els.barcodePreviewCanvas.height);
    return;
  }
  
  try {
    JsBarcode(els.barcodePreviewCanvas, state.barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      margin: 10,
      width: 2,
      height: 40
    });
  } catch (e) {
    console.warn("Barcode preview failed:", e);
  }
}

els.connectBtn.addEventListener('click', async () => {
  try {
    const name = await state.usbPrinter.connect();
    els.printerStatusDot.classList.add('connected');
    els.printerStatusText.textContent = `Connected: ${name}`;
    els.connectBtn.textContent = 'Change Printer';
  } catch (err) {
    console.error('Printer Connection Failed:', err);
    alert('Could not connect to printer. Make sure it is connected and you have selected it in the dialog.');
  }
});

els.printCurrentBtn.addEventListener('click', () => printPages([state.currentPage]));
els.printAllBtn.addEventListener('click', () => {
  const pages = Array.from({ length: state.pdfRenderer.numPages }, (_, i) => i + 1);
  printPages(pages);
});

els.downloadBtn.addEventListener('click', downloadCroppedPdf);

// --- Core Functions ---

async function loadAllPages() {
  state.originalCanvases = [];
  for (let i = 1; i <= state.pdfRenderer.numPages; i++) {
    const canvas = await state.pdfRenderer.renderPage(i, 3); // High resolution for cropping
    state.originalCanvases.push(canvas);
  }
}

async function detectBarcodeFromCurrentPage() {
  const original = state.originalCanvases[state.currentPage - 1];
  if (!original) return;

  if (els.barcodeStatus) {
    els.barcodeStatus.hidden = false;
    els.barcodeStatus.textContent = '⏳ Detecting barcodes…';
    els.barcodeStatus.className = 'barcode-status detecting';
  }

  try {
    const barcodeRects = await ImageProcessor.detectBarcodeRects(original);
    state.detectedBarcodes = barcodeRects;

    if (barcodeRects.length > 0) {
      // Use the first detected barcode value
      const detectedValue = barcodeRects[0].value;
      if (detectedValue) {
        state.barcodeValue = detectedValue;
        els.barcodeValueInput.value = detectedValue;
        updateBarcodePreview();
      }

      if (els.barcodeStatus) {
        els.barcodeStatus.textContent = `✅ ${barcodeRects.length} barcode(s) detected`;
        els.barcodeStatus.className = 'barcode-status found';
      }
    } else {
      if (els.barcodeStatus) {
        els.barcodeStatus.textContent = '⚠️ No barcode detected — enter value manually';
        els.barcodeStatus.className = 'barcode-status fallback';
      }
    }
  } catch (e) {
    console.warn('Early barcode detection failed:', e);
    if (els.barcodeStatus) {
      els.barcodeStatus.textContent = '⚠️ Detection failed — enter value manually';
      els.barcodeStatus.className = 'barcode-status fallback';
    }
  }
}

async function renderThumbnails() {
  els.thumbnailStrip.innerHTML = '';
  for (let i = 0; i < state.originalCanvases.length; i++) {
    const div = document.createElement('div');
    div.className = `thumbnail-item ${i + 1 === state.currentPage ? 'active' : ''}`;
    div.dataset.page = i + 1;
    
    const img = document.createElement('img');
    img.src = state.originalCanvases[i].toDataURL('image/jpeg', 0.5);
    
    div.appendChild(img);
    div.onclick = () => {
      state.currentPage = i + 1;
      document.querySelectorAll('.thumbnail-item').forEach(el => el.classList.remove('active'));
      div.classList.add('active');
      displayCurrentPage();
    };
    els.thumbnailStrip.appendChild(div);
  }
}

function displayCurrentPage() {
  const original = state.originalCanvases[state.currentPage - 1];
  if (!original) return;

  // Rotate original for display
  const rotated = rotateCanvas(original, state.rotation);
  
  // Apply adjustments
  const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
  
  els.canvasWrapper.innerHTML = '';
  els.canvasWrapper.appendChild(adjusted);
  
  // Initialize or update cropper
  state.cropManager.init(adjusted);
}

function updateAdjustments() {
  // To avoid lag, we only update the display if cropper is active
  // but for simplicity here we re-render current page
  displayCurrentPage();
}

function rotateCanvas(canvas, degrees) {
  if (degrees === 0) return canvas;
  
  const W = canvas.width;
  const H = canvas.height;
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  if (degrees === 90 || degrees === 270) {
    out.width = H;
    out.height = W;
  } else {
    out.width = W;
    out.height = H;
  }
  
  // Fill with white to prevent transparency artifacts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  
  // Use setTransform with INTEGER-ONLY values for pixel-perfect rotation.
  // The old translate(w/2, h/2) + rotate() approach caused fractional pixel
  // positioning when dimensions were odd, triggering bilinear interpolation
  // that blurred barcode bars and made them thicker.
  if (degrees === 90) {
    // 90° CW: src(x,y) → dst(H-1-y, x)
    ctx.setTransform(0, 1, -1, 0, H, 0);
  } else if (degrees === 180) {
    // 180°: src(x,y) → dst(W-1-x, H-1-y)
    ctx.setTransform(-1, 0, 0, -1, W, H);
  } else if (degrees === 270) {
    // 270° CW: src(x,y) → dst(y, W-1-x)
    ctx.setTransform(0, -1, 1, 0, 0, W);
  }
  
  ctx.drawImage(canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
  
  return out;
}

async function printPages(pageNumbers) {
  if (!state.usbPrinter.isConnected) {
    alert('Please connect a printer first.');
    return;
  }

  const cropData = state.cropManager.getCropData();
  if (!cropData) {
    alert('Please draw a crop selection first.');
    return;
  }

  // Update barcode status indicator
  if (els.barcodeStatus) {
    els.barcodeStatus.hidden = false;
    els.barcodeStatus.textContent = '⏳ Detecting barcodes…';
    els.barcodeStatus.className = 'barcode-status detecting';
  }

  try {
    const builder = new EscPosBuilder().init()
      .setLineSpacing(0); // No gaps between raster lines — critical for barcode readability

    for (const pageNum of pageNumbers) {
      const original = state.originalCanvases[pageNum - 1];
      const rotated = rotateCanvas(original, state.rotation);

      // Apply brightness/contrast/grayscale adjustments for PRINTING
      const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
      const cropped = await state.cropManager.getCroppedCanvas(adjusted, cropData);

      // Multi-step resize to printer width — preserves barcode detail
      const resized = ImageProcessor.resizeStepDown(cropped, state.printerWidthPx);

      // For DETECTION, use a clean crop without user's brightness/contrast adjustments
      // High contrast/brightness often destroys barcode gaps, causing ZXing to fail.
      const unadjustedCropped = await state.cropManager.getCroppedCanvas(rotated, cropData);
      
      // Detect barcode zones using ZXing on the high-res UNADJUSTED cropped canvas
      const barcodeRectsRaw = await ImageProcessor.detectBarcodeRects(unadjustedCropped);

      // Scale detected rects to the resized canvas (384px width)
      const scaleFactor = resized.width / unadjustedCropped.width;
      const barcodeRects = barcodeRectsRaw.map(r => ({
        x: Math.round(r.x * scaleFactor),
        y: Math.round(r.y * scaleFactor),
        w: Math.round(r.w * scaleFactor),
        h: Math.round(r.h * scaleFactor),
        value: r.value
      }));

      // Update state with detected value if not already manually edited
      if (barcodeRects.length > 0 && !state.barcodeValue) {
        state.barcodeValue = barcodeRects[0].value;
        els.barcodeValueInput.value = state.barcodeValue;
        updateBarcodePreview();
      }

      if (els.barcodeStatus) {
        if (barcodeRects.length > 0) {
          els.barcodeStatus.textContent = `✅ ${barcodeRects.length} barcode(s) detected`;
          els.barcodeStatus.className = 'barcode-status found';
        } else {
          els.barcodeStatus.textContent = '⚠️ No barcode detected — using heuristic zone';
          els.barcodeStatus.className = 'barcode-status fallback';
        }
      }
      // Barcode Replacement Logic — prepend digital barcode, keep original intact
      if (state.replaceBarcode && state.barcodeValue) {
        const pw = state.printerWidthPx;
        const bcCanvas = document.createElement('canvas');
        bcCanvas.width = pw;
        bcCanvas.height = 120;
        const bcCtx = bcCanvas.getContext('2d');
        bcCtx.fillStyle = '#ffffff';
        bcCtx.fillRect(0, 0, pw, 120);
        
        try {
          JsBarcode(bcCanvas, state.barcodeValue, {
            format: "CODE128",
            displayValue: true,
            fontSize: 20,
            margin: 10,
            width: 2,
            height: 70
          });
          
          const bcMono = ImageProcessor.toMonochrome(bcCanvas, 128);
          builder.rasterImage(bcMono.data, bcMono.width, bcMono.height)
                 .feed(1);
        } catch (e) {
          console.warn("Replacement barcode generation failed:", e);
        }
      }

      // Region-aware threshold: high threshold + erosion on barcode zones,
      // normal threshold on text zones
      const mono = ImageProcessor.toMonochromeRegionAware(
        resized,
        state.textThreshold,
        barcodeRects,
        state.barcodeThreshold,
        state.barcodeErode
      );

      builder.rasterImage(mono.data, mono.width, mono.height)
             .feed(3);
    }

    builder.cut();
    await state.usbPrinter.print(builder.getBuffer());
  } catch (err) {
    console.error('Print failed:', err);
    if (els.barcodeStatus) {
      els.barcodeStatus.textContent = '❌ Print failed';
      els.barcodeStatus.className = 'barcode-status error';
    }
    alert('Printing failed. Check console for details.');
  }
}

async function downloadCroppedPdf() {
  const cropData = state.cropManager.getCropData();
  if (!cropData) return alert('Select crop first');

  const pdf = new jsPDF();
  
  for (let i = 0; i < state.originalCanvases.length; i++) {
    const rotated = rotateCanvas(state.originalCanvases[i], state.rotation);
    const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
    const cropped = await state.cropManager.getCroppedCanvas(adjusted, cropData);
    
    const imgData = cropped.toDataURL('image/jpeg', 0.95);
    
    // Add page if not first
    if (i > 0) pdf.addPage();
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (cropped.height * pdfWidth) / cropped.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  }
  
  pdf.save('resisnap-cropped.pdf');
}

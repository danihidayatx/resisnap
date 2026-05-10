import { createIcons, Printer, Usb, FileUp, RotateCw, FileText, Download } from 'lucide';
import { PdfRenderer } from './pdf-renderer';
import { CropManager } from './cropper';
import { ImageProcessor } from './image-proc';
import { EscPosBuilder } from './escpos';
import { UsbPrinter } from './usb-printer';
import { jsPDF } from 'jspdf';

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
  originalCanvases: [], // Original rendered canvases from PDF
  adjustedCanvases: [], // Canvases after brightness/contrast
  isCropping: false,
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
    
    await loadAllPages();
    renderThumbnails();
    displayCurrentPage();
    
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
  
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  
  if (degrees === 90 || degrees === 270) {
    out.width = canvas.height;
    out.height = canvas.width;
  } else {
    out.width = canvas.width;
    out.height = canvas.height;
  }
  
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  
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

  try {
    const builder = new EscPosBuilder().init();

    for (const pageNum of pageNumbers) {
      const original = state.originalCanvases[pageNum - 1];
      const rotated = rotateCanvas(original, state.rotation);
      
      // We need to apply crop to the adjusted canvas
      const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
      const cropped = await state.cropManager.getCroppedCanvas(adjusted, cropData);
      
      // Resize to 384px (58mm printer)
      const resized = ImageProcessor.resizeToFit(cropped, 384);
      
      // Threshold
      const mono = ImageProcessor.toMonochrome(resized, 128);
      
      builder.rasterImage(mono.data, mono.width, mono.height)
             .feed(3);
    }
    
    builder.cut();
    await state.usbPrinter.print(builder.getBuffer());
  } catch (err) {
    console.error('Print failed:', err);
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

/**
 * @file Main entry point for the ResiSnap application.
 * Multi-marketplace thermal printer tool for Tokopedia, Shopee, and others.
 */

import { createIcons, Printer, Usb, FileUp, RotateCw, FileText, Download, CheckCircle, Settings2, ChevronUp, ChevronDown, HelpCircle, Info, X } from 'lucide';
import { PdfRenderer } from './pdf-renderer';
import { CropManager } from './cropper';
import { ImageProcessor } from './image-proc';
import { UsbPrinter } from './usb-printer';
import { Toast } from './toast';
import JsBarcode from 'jsbarcode';

// New modules
import { BarcodeDetectorUtil } from './barcode-detector';
import { rotateCanvas } from './canvas-utils';
import { loadAllPages, downloadCroppedPdf } from './pdf-handler';
import { printPages } from './print-handler';

const lucideIcons = { Printer, Usb, FileUp, RotateCw, FileText, Download, CheckCircle, Settings2, ChevronUp, ChevronDown, HelpCircle, Info, X };

// Initialize Lucide icons
createIcons({
  icons: lucideIcons
});

/**
 * @typedef {Object} AppState
 * @property {PdfRenderer} pdfRenderer
 * @property {CropManager} cropManager
 * @property {UsbPrinter} usbPrinter
 * @property {number} currentPage
 * @property {number} rotation
 * @property {number} brightness
 * @property {number} contrast
 * @property {boolean} grayscale
 * @property {number} textThreshold
 * @property {number} barcodeThreshold
 * @property {number} barcodeErode
 * @property {HTMLCanvasElement[]} originalCanvases
 * @property {HTMLCanvasElement[]} adjustedCanvases
 * @property {boolean} isCropping
 * @property {string} barcodeValue
 * @property {boolean} replaceBarcode
 * @property {Object[]} detectedBarcodes
 * @property {number} printerWidthPx
 * @property {boolean} eraseOriginalBarcode
 * @property {boolean} showAdvanced
 */

/**
 * @typedef {Object} AppElements
 * @property {HTMLInputElement} fileUpload
 * @property {HTMLElement} dropZone
 * @property {HTMLElement} canvasWrapper
 * @property {HTMLElement} thumbnailStrip
 * @property {HTMLElement} pageCount
 * @property {HTMLButtonElement} rotateBtn
 * @property {HTMLInputElement} brightnessSlider
 * @property {HTMLInputElement} contrastSlider
 * @property {HTMLElement} brightnessVal
 * @property {HTMLElement} contrastVal
 * @property {HTMLInputElement} grayscaleToggle
 * @property {HTMLInputElement} thresholdSlider
 * @property {HTMLElement} thresholdVal
 * @property {HTMLInputElement} barcodeThresholdSlider
 * @property {HTMLElement} barcodeThresholdVal
 * @property {HTMLInputElement} barcodeErodeSlider
 * @property {HTMLElement} barcodeErodeVal
 * @property {HTMLInputElement} replaceBarcodeToggle
 * @property {HTMLInputElement} eraseOriginalToggle
 * @property {HTMLInputElement} barcodeValueInput
 * @property {HTMLCanvasElement} barcodePreviewCanvas
 * @property {HTMLElement} liveBarcodePreview
 * @property {HTMLCanvasElement} liveBarcodeCanvas
 * @property {HTMLElement} liveBarcodeText
 * @property {HTMLButtonElement} settingsToggle
 * @property {HTMLElement} advancedControls
 * @property {HTMLElement} settingsChevron
 * @property {HTMLButtonElement} connectBtn
 * @property {HTMLButtonElement} printCurrentBtn
 * @property {HTMLButtonElement} printAllBtn
 * @property {HTMLButtonElement} downloadBtn
 * @property {HTMLElement} printerStatusDot
 * @property {HTMLElement} printerStatusText
 * @property {HTMLElement} browserWarning
 */

/** @type {AppState} */
const state = {
  pdfRenderer: new PdfRenderer(),
  cropManager: new CropManager(),
  usbPrinter: new UsbPrinter(),
  currentPage: 1,
  rotation: 0,
  brightness: 0,
  contrast: 0,
  grayscale: true,
  textThreshold: 175,
  barcodeThreshold: 200,
  barcodeErode: 1,
  originalCanvases: [],
  adjustedCanvases: [],
  isCropping: false,
  barcodeValue: '',
  replaceBarcode: true,
  detectedBarcodes: [],
  printerWidthPx: 384,
  eraseOriginalBarcode: false,
  showAdvanced: false,
};

/** @type {AppElements} */
const els = {
  fileUpload: document.getElementById('file-upload'),
  dropZone: document.getElementById('drop-zone'),
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

  replaceBarcodeToggle: document.getElementById('replace-barcode-toggle'),
  eraseOriginalToggle: document.getElementById('erase-original-toggle'),
  barcodeValueInput: document.getElementById('barcode-value-input'),
  barcodePreviewCanvas: document.getElementById('barcode-preview-canvas'),
  liveBarcodePreview: document.getElementById('live-barcode-preview'),
  liveBarcodeCanvas: document.getElementById('live-barcode-canvas'),
  liveBarcodeText: document.getElementById('live-barcode-text'),
  settingsToggle: document.getElementById('settings-toggle'),
  advancedControls: document.getElementById('advanced-controls'),
  settingsChevron: document.getElementById('settings-chevron'),
  connectBtn: document.getElementById('connect-printer'),
  printCurrentBtn: document.getElementById('print-current'),
  printAllBtn: document.getElementById('print-all'),
  downloadBtn: document.getElementById('download-pdf'),
  printerStatusDot: document.getElementById('printer-status-dot'),
  printerStatusText: document.getElementById('printer-status-text'),
  browserWarning: document.getElementById('browser-warning'),

  // Modal Elements
  modalOverlay: document.getElementById('modal-overlay'),
  modalTitle: document.getElementById('modal-title'),
  modalBody: document.getElementById('modal-body'),
  modalClose: document.getElementById('modal-close'),
  howToBtn: document.getElementById('how-to-btn'),
  privacyLink: document.getElementById('privacy-link'),
  termsLink: document.getElementById('terms-link'),
};

// Check Browser Support
if (!navigator.usb) {
  els.browserWarning.hidden = false;
  els.connectBtn.disabled = true;
}

// --- Modal Logic ---

/**
 * Opens a modal with the specified title and content from a template.
 * @param {string} title 
 * @param {string} templateId 
 */
function openModal(title, templateId) {
  if (!els.modalOverlay || !els.modalTitle || !els.modalBody) return;
  
  els.modalTitle.textContent = title;
  const template = document.getElementById(templateId);
  if (template) {
    els.modalBody.innerHTML = '';
    els.modalBody.appendChild(template.content.cloneNode(true));
  }
  
  els.modalOverlay.hidden = false;
  createIcons({ icons: lucideIcons });
}

if (els.modalClose) {
  els.modalClose.onclick = () => {
    els.modalOverlay.hidden = true;
  };
}

if (els.modalOverlay) {
  els.modalOverlay.onclick = (e) => {
    if (e.target === els.modalOverlay) {
      els.modalOverlay.hidden = true;
    }
  };
}

if (els.howToBtn) {
  els.howToBtn.onclick = (e) => {
    e.preventDefault();
    openModal('Cara Penggunaan', 'how-to-template');
  };
}

if (els.privacyLink) {
  els.privacyLink.onclick = (e) => {
    e.preventDefault();
    openModal('Kebijakan Privasi', 'privacy-template');
  };
}

if (els.termsLink) {
  els.termsLink.onclick = (e) => {
    e.preventDefault();
    openModal('Syarat & Ketentuan', 'terms-template');
  };
}

// --- Event Handlers ---

/**
 * Handles a PDF file for processing.
 * @param {File} file 
 */
async function handleFile(file) {
  if (!file || file.type !== 'application/pdf') {
    if (file && file.type !== 'application/pdf') {
      Toast.error('Silakan unggah file PDF.', 'File Tidak Valid');
    }
    return;
  }

  try {
    const numPages = await state.pdfRenderer.loadPdf(file);
    els.pageCount.textContent = numPages;
    state.currentPage = 1;
    state.rotation = 0;
    state.barcodeValue = '';
    els.barcodeValueInput.value = '';
    updateBarcodePreview();
    state.detectedBarcodes = [];
    
    await loadAllPages(state);
    renderThumbnails();
    
    await detectBarcodeFromCurrentPage();
    displayCurrentPage();
    
    els.printCurrentBtn.disabled = false;
    els.printAllBtn.disabled = false;
    els.downloadBtn.disabled = false;
  } catch (err) {
    console.error('Error loading PDF:', err);
    Toast.error('Gagal memuat PDF. Silakan coba file lain.', 'Error PDF');
  }
}

els.fileUpload.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

if (els.dropZone) {
  els.dropZone.addEventListener('click', () => {
    els.fileUpload.click();
  });
}

// Global Drag and Drop
let dragCounter = 0;

window.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  if (els.dropZone) els.dropZone.classList.add('drag-over');
});

window.addEventListener('dragover', (e) => {
  e.preventDefault();
});

window.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    if (els.dropZone) els.dropZone.classList.remove('drag-over');
  }
});

window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  if (els.dropZone) els.dropZone.classList.remove('drag-over');
  
  const file = e.dataTransfer.files[0];
  handleFile(file);
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
  updateBarcodePreview();
});

els.eraseOriginalToggle.addEventListener('change', (e) => {
  state.eraseOriginalBarcode = e.target.checked;
});

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

els.settingsToggle.addEventListener('click', () => {
  state.showAdvanced = !state.showAdvanced;
  els.advancedControls.hidden = !state.showAdvanced;
  els.settingsChevron.setAttribute('data-lucide', state.showAdvanced ? 'chevron-down' : 'chevron-up');
  createIcons({ icons: lucideIcons });
});

/**
 * Updates the barcode preview UI based on the current state.
 */
function updateBarcodePreview() {
  const hasValue = !!state.barcodeValue;
  els.liveBarcodePreview.hidden = !hasValue;
  if (!hasValue) return;
  
  els.liveBarcodeText.textContent = state.barcodeValue;
  try {
    JsBarcode(els.liveBarcodeCanvas, state.barcodeValue, {
      format: "CODE128",
      displayValue: true,
      fontSize: 14,
      margin: 5,
      width: 1.5,
      height: 40,
      background: "#ffffff"
    });
  } catch (e) {
    console.warn("Barcode preview failed:", e);
  }
}

els.connectBtn.addEventListener('click', async () => {
  try {
    const name = await state.usbPrinter.connect();
    els.printerStatusDot.classList.add('connected');
    els.printerStatusText.textContent = `Terhubung: ${name}`;
    els.connectBtn.textContent = 'Ganti Printer';
  } catch (err) {
    console.error('Printer Connection Failed:', err);
    Toast.error('Tidak dapat terhubung ke printer. Pastikan printer menyala dan Anda telah memilihnya di dialog.', 'Error Koneksi');
  }
});

els.printCurrentBtn.addEventListener('click', () => {
  printPages(state, [state.currentPage], (value) => {
    state.barcodeValue = value;
    els.barcodeValueInput.value = value;
    updateBarcodePreview();
  });
});

els.printAllBtn.addEventListener('click', () => {
  const pages = Array.from({ length: state.pdfRenderer.numPages }, (_, i) => i + 1);
  printPages(state, pages, (value) => {
    state.barcodeValue = value;
    els.barcodeValueInput.value = value;
    updateBarcodePreview();
  });
});

els.downloadBtn.addEventListener('click', () => downloadCroppedPdf(state));

// --- Core Functions ---

/**
 * Detects barcodes from the current page and updates the state.
 * @returns {Promise<void>}
 */
async function detectBarcodeFromCurrentPage() {
  const original = state.originalCanvases[state.currentPage - 1];
  if (!original) return;

  try {
    const barcodeRects = await BarcodeDetectorUtil.detectBarcodeRects(original);
    state.detectedBarcodes = barcodeRects;

    if (barcodeRects.length > 0) {
      const detectedValue = barcodeRects[0].value;
      if (detectedValue) {
        state.barcodeValue = detectedValue;
        els.barcodeValueInput.value = detectedValue;
        updateBarcodePreview();
      }
    }
  } catch (e) {
    console.warn('Early barcode detection failed:', e);
  }
}

/**
 * Renders page thumbnails in the thumbnail strip.
 * @returns {Promise<void>}
 */
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

/**
 * Displays the current page in the main canvas area with adjustments and cropper.
 */
function displayCurrentPage() {
  const original = state.originalCanvases[state.currentPage - 1];
  if (!original) return;

  const rotated = rotateCanvas(original, state.rotation);
  const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
  
  els.canvasWrapper.innerHTML = '';
  const tightWrapper = document.createElement('div');
  tightWrapper.className = 'tight-cropper-wrapper';
  
  adjusted.style.display = 'block';
  adjusted.style.maxWidth = '100%';
  adjusted.style.maxHeight = '100%';
  adjusted.style.width = 'auto';
  adjusted.style.height = 'auto';
  
  tightWrapper.appendChild(adjusted);
  els.canvasWrapper.appendChild(tightWrapper);
  
  state.cropManager.init(adjusted);
}

/**
 * Re-renders the current page to reflect slider adjustments.
 */
function updateAdjustments() {
  displayCurrentPage();
}

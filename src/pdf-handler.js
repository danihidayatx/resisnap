import { jsPDF } from 'jspdf';
import { getAutoCropRect, rotateCanvas } from './canvas-utils';
import { ImageProcessor } from './image-proc';
import { Toast } from './toast';

/**
 * Loads all pages from the PDF renderer and auto-crops white margins.
 * @param {Object} state - Application state.
 * @returns {Promise<void>}
 */
export async function loadAllPages(state) {
  state.originalCanvases = [];
  for (let i = 1; i <= state.pdfRenderer.numPages; i++) {
    const rawCanvas = await state.pdfRenderer.renderPage(i, 3);
    
    const autoCropRect = getAutoCropRect(rawCanvas);
    const croppedCanvas = document.createElement('canvas');
    croppedCanvas.width = autoCropRect.width;
    croppedCanvas.height = autoCropRect.height;
    const ctx = croppedCanvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
    ctx.drawImage(
      rawCanvas, 
      autoCropRect.x, autoCropRect.y, autoCropRect.width, autoCropRect.height, 
      0, 0, autoCropRect.width, autoCropRect.height
    );
    
    state.originalCanvases.push(croppedCanvas);
  }
}

/**
 * Generates and downloads a PDF containing all cropped and adjusted pages.
 * @param {Object} state - Application state.
 * @returns {Promise<void>}
 */
export async function downloadCroppedPdf(state) {
  const cropData = state.cropManager.getCropData();
  if (!cropData) return Toast.warn('Select crop first', 'Missing Selection');

  const pdf = new jsPDF();
  
  for (let i = 0; i < state.originalCanvases.length; i++) {
    const rotated = rotateCanvas(state.originalCanvases[i], state.rotation);
    const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
    const cropped = await state.cropManager.getCroppedCanvas(adjusted, cropData);
    
    const imgData = cropped.toDataURL('image/jpeg', 0.95);
    
    if (i > 0) pdf.addPage();
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (cropped.height * pdfWidth) / cropped.width;
    
    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
  }
  
  pdf.save('resisnap-cropped.pdf');
}

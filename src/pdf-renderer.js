import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export class PdfRenderer {
  constructor() {
    this.pdf = null;
    this.numPages = 0;
  }

  async loadPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    this.numPages = this.pdf.numPages;
    return this.numPages;
  }

  async renderPage(pageNumber, scale = 2, rotation = 0) {
    if (!this.pdf) return null;
    
    const page = await this.pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale, rotation });
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    // Fill with white to avoid transparent background issues during image processing
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    return canvas;
  }

  async getThumbnails(scale = 0.2) {
    const thumbnails = [];
    for (let i = 1; i <= this.numPages; i++) {
      const canvas = await this.renderPage(i, scale);
      thumbnails.push(canvas.toDataURL());
    }
    return thumbnails;
  }
}

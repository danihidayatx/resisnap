import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

/**
 * Handles PDF loading and rendering using pdfjs-dist.
 */
export class PdfRenderer {
  constructor() {
    /** @type {import('pdfjs-dist').PDFDocumentProxy|null} */
    this.pdf = null;
    /** @type {number} */
    this.numPages = 0;
  }

  /**
   * Loads a PDF file and returns the number of pages.
   * @param {File} file - The PDF file to load.
   * @returns {Promise<number>} The number of pages in the PDF.
   */
  async loadPdf(file) {
    const arrayBuffer = await file.arrayBuffer();
    this.pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    this.numPages = this.pdf.numPages;
    return this.numPages;
  }

  /**
   * Renders a specific page of the loaded PDF to a canvas.
   * @param {number} pageNumber - The 1-based page number to render.
   * @param {number} [scale=2] - The scale factor for rendering.
   * @param {number} [rotation=0] - The rotation angle in degrees.
   * @returns {Promise<HTMLCanvasElement|null>} The canvas containing the rendered page.
   */
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

  /**
   * Generates thumbnails for all pages in the PDF.
   * @param {number} [scale=0.2] - The scale factor for thumbnails.
   * @returns {Promise<string[]>} Array of data URLs representing the thumbnails.
   */
  async getThumbnails(scale = 0.2) {
    const thumbnails = [];
    for (let i = 1; i <= this.numPages; i++) {
      const canvas = await this.renderPage(i, scale);
      thumbnails.push(canvas.toDataURL());
    }
    return thumbnails;
  }
}

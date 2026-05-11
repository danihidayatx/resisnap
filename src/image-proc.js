/**
 * Utility class for image processing, filtering, and monochrome conversion.
 */
export class ImageProcessor {
  /**
   * Applies brightness, contrast, and optional grayscale filters to a canvas.
   * @param {HTMLCanvasElement} canvas - The source canvas.
   * @param {number} brightness - Brightness adjustment (-100 to 100).
   * @param {number} contrast - Contrast adjustment (-100 to 100).
   * @param {boolean} [grayscale=false] - Whether to convert to grayscale.
   * @returns {HTMLCanvasElement} A new canvas with adjustments applied.
   */
  static applyAdjustments(canvas, brightness, contrast, grayscale = false) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    const b = brightness / 100;
    const c = contrast / 100;
    const factor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));

    for (let i = 0; i < data.length; i += 4) {
      if (grayscale) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = gray;
      }

      for (let j = 0; j < 3; j++) {
        let val = data[i + j];
        val = val + b * 255;
        val = factor * (val - 128) + 128;
        data[i + j] = Math.max(0, Math.min(255, val));
      }
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = canvas.width;
    outCanvas.height = canvas.height;
    outCanvas.getContext('2d').putImageData(imageData, 0, 0);
    return outCanvas;
  }

  /**
   * Monochrome conversion with region-aware processing.
   * Applies different thresholds to text zones and detected barcode zones.
   * @param {HTMLCanvasElement} canvas - The source canvas.
   * @param {number} [textThreshold=175] - Threshold for non-barcode areas.
   * @param {Array<{x: number, y: number, w: number, h: number}>} [barcodeRects=[]] - Areas to process as barcodes.
   * @param {number} [barcodeThreshold=200] - Threshold for barcode zones.
   * @param {number} [barcodeErode=1] - Erosion iterations for barcode zones.
   * @returns {{data: Uint8Array, width: number, height: number}} Monochrome data.
   */
  static toMonochromeRegionAware(
    canvas,
    textThreshold = 175,
    barcodeRects = [],
    barcodeThreshold = 200,
    barcodeErode = 1
  ) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Build luminance array
    const lum = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      lum[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }

    // Build barcode mask
    const inBarcode = new Uint8Array(width * height);
    for (const rect of barcodeRects) {
      const x0 = Math.max(0, rect.x);
      const y0 = Math.max(0, rect.y);
      const x1 = Math.min(width, rect.x + rect.w);
      const y1 = Math.min(height, rect.y + rect.h);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          inBarcode[y * width + x] = 1;
        }
      }
    }

    // Pass 1: threshold whole image
    const monoData = new Uint8Array(width * height);
    for (let i = 0; i < lum.length; i++) {
      const thresh = inBarcode[i] ? barcodeThreshold : textThreshold;
      monoData[i] = lum[i] < thresh ? 1 : 0;
    }

    // Pass 2: erode
    if (barcodeErode > 0) {
      const erodeGlobal = (barcodeRects.length === 0);
      for (let iter = 0; iter < barcodeErode; iter++) {
        const next = new Uint8Array(monoData);
        
        if (erodeGlobal) {
          // Global erosion fallback (user forced erosion despite no detection)
          for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
              const idx = y * width + x;
              if (
                monoData[idx] === 1 &&
                monoData[idx - width] === 1 &&
                monoData[idx + width] === 1
              ) {
                next[idx] = 1;
              } else {
                next[idx] = 0;
              }
            }
          }
        } else {
          // Zone-specific 4-way erosion
          for (const rect of barcodeRects) {
            const rx0 = Math.max(1, rect.x);
            const ry0 = Math.max(1, rect.y);
            const rx1 = Math.min(width - 1, rect.x + rect.w);
            const ry1 = Math.min(height - 1, rect.y + rect.h);
            for (let y = ry0; y < ry1; y++) {
              for (let x = rx0; x < rx1; x++) {
                const idx = y * width + x;
                if (
                  monoData[idx] === 1 &&
                  monoData[idx - 1] === 1 &&
                  monoData[idx + 1] === 1 &&
                  monoData[idx - width] === 1 &&
                  monoData[idx + width] === 1
                ) {
                  next[idx] = 1;
                } else {
                  next[idx] = 0;
                }
              }
            }
          }
        }
        monoData.set(next);
      }
    }

    return { data: monoData, width, height };
  }

  /**
   * Simple global thresholding conversion.
   * @param {HTMLCanvasElement} canvas - The source canvas.
   * @param {number} [threshold=175] - The threshold value.
   * @returns {{data: Uint8Array, width: number, height: number}} Monochrome data.
   */
  static toMonochrome(canvas, threshold = 175) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;
    const monoData = new Uint8Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      monoData[i / 4] = lum < threshold ? 1 : 0;
    }
    return { data: monoData, width, height };
  }
}

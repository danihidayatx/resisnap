import {
  MultiFormatReader,
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
  HTMLCanvasElementLuminanceSource,
  NotFoundException,
  DecodeHintType,
  BarcodeFormat,
} from '@zxing/library';

export class ImageProcessor {
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
   * Detect barcode bounding rectangles on the canvas using ZXing.
   * Works on a grayscale canvas before thresholding.
   * 
   * Returns array of { x, y, w, h } in canvas pixel coords.
   * If nothing is detected, returns empty array (fallback heuristic applies).
   * 
   * @param {HTMLCanvasElement} canvas
   * @returns {Promise<Array<{x,y,w,h}>>}
   */
  static async detectBarcodeRects(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    
    // 1. Try native BarcodeDetector API first (much faster and more robust on Chrome/Android/macOS)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new BarcodeDetector({
          formats: ['code_128', 'code_39', 'ean_13', 'ean_8', 'itf', 'qr_code']
        });
        const barcodes = await detector.detect(canvas);
        if (barcodes.length > 0) {
          return barcodes.map(bc => ({
            x: Math.max(0, Math.round(bc.boundingBox.x) - 10), // add slight padding
            y: Math.max(0, Math.round(bc.boundingBox.y) - 10),
            w: Math.round(bc.boundingBox.width) + 20,
            h: Math.round(bc.boundingBox.height) + 20,
            value: bc.rawValue,
            format: bc.format
          }));
        }
      } catch (e) {
        console.warn('Native BarcodeDetector failed or no formats supported:', e);
      }
    }

    let detectionCanvas = canvas;
    let scale = 1;

    const rects = [];
    const seen = new Set();

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
    // Explicitly listing common formats can sometimes help
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.ITF,
      BarcodeFormat.QR_CODE
    ]);

    const reader = new MultiFormatReader();
    reader.setHints(hints);

    const rotate90CW = (src) => {
      const dst = document.createElement('canvas');
      dst.width = src.height;
      dst.height = src.width;
      const ctx = dst.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dst.width, dst.height);
      ctx.setTransform(0, 1, -1, 0, src.height, 0);
      ctx.drawImage(src, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      return dst;
    };

    const tryDecode = (c) => {
      try {
        const src = new HTMLCanvasElementLuminanceSource(c);
        const bitmap = new BinaryBitmap(new HybridBinarizer(src));
        return reader.decode(bitmap);
      } catch (e) {
        try {
          const src = new HTMLCanvasElementLuminanceSource(c);
          const bitmap = new BinaryBitmap(new GlobalHistogramBinarizer(src));
          return reader.decode(bitmap);
        } catch (e2) {
          if (!(e instanceof NotFoundException) && !(e2 instanceof NotFoundException)) {
            console.warn('ZXing:', e, e2);
          }
          return null;
        }
      }
    };

    let rotated = detectionCanvas;
    // Track original dimensions of detectionCanvas
    const W0 = detectionCanvas.width;
    const H0 = detectionCanvas.height;

    for (let rot = 0; rot < 4; rot++) {
      const rw = rotated.width;
      const rh = rotated.height;

      // Scan full image and slightly overlapping strips to ensure coverage
      const strips = [
        { c: rotated, yOff: 0 },
        { c: (() => { 
            const s = document.createElement('canvas'); 
            s.width = rw; s.height = Math.floor(rh * 0.6); 
            const ctx = s.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s.width, s.height);
            ctx.drawImage(rotated, 0, 0); 
            return s; 
          })(), yOff: 0 },
        { c: (() => { 
            const yS = Math.floor(rh * 0.4); 
            const s = document.createElement('canvas'); 
            s.width = rw; s.height = rh - yS; 
            const ctx = s.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, s.width, s.height);
            ctx.drawImage(rotated, 0, yS, rw, rh - yS, 0, 0, rw, rh - yS); 
            return s; 
          })(), yOff: Math.floor(rh * 0.4) },
      ];

      for (const { c: strip, yOff } of strips) {
        const result = tryDecode(strip);
        if (!result) continue;

        const pts = result.getResultPoints();
        if (!pts || pts.length < 2) continue;

        const rxs = pts.map(p => p.getX());
        const rys = pts.map(p => p.getY());

        const rcx = (Math.min(...rxs) + Math.max(...rxs)) / 2;
        const rcy = yOff + (Math.min(...rys) + Math.max(...rys)) / 2;
        
        // Barcode width/height estimate
        const bW = Math.max(...rxs) - Math.min(...rxs);
        const bH = Math.max(...rys) - Math.min(...rys);
        
        // Add padding for the region-aware processing
        const rw2 = bW + 10;
        const rh2 = Math.max(40, bH + 40); 

        let origCx, origCy, origW, origH;
        if (rot === 0) {
          origCx = rcx; origCy = rcy; origW = rw2; origH = rh2;
        } else if (rot === 1) {
          // Rotated 90CW: (x,y) -> (H-y, x) => Inverse: x=y', y=H-x'
          origCx = rcy; origCy = rw - rcx; // rw is H0
          origW = rh2; origH = rw2;
        } else if (rot === 2) {
          // Rotated 180: (x,y) -> (W-x, H-y) => Inverse: x=W-x', y=H-y'
          origCx = rw - rcx; origCy = rh - rcy; 
          origW = rw2; origH = rh2;
        } else {
          // Rotated 270CW (90CCW): (x,y) -> (y, W-x) => Inverse: x=W-y', y=x'
          origCx = rh - rcy; origCy = rcx; // rh is W0
          origW = rh2; origH = rw2;
        }

        const key = Math.round(origCy / 15) * 1000 + Math.round(origCx / 15);
        if (seen.has(key)) continue;
        seen.add(key);

        rects.push({
          x: Math.round((origCx - origW / 2) / scale),
          y: Math.round((origCy - origH / 2) / scale),
          w: Math.round(origW / scale),
          h: Math.round(origH / scale),
          value: result.getText(),
          format: result.getBarcodeFormat().toString()
        });
      }

      rotated = rotate90CW(rotated);
    }

    return rects;
  }

  /**
   * Monochrome conversion with region-aware processing.
   * 
   * - textThreshold  : applied to the entire image first
   * - barcodeRects   : areas to re-process with barcode-specific settings
   * - barcodeThreshold + barcodeErode : applied only within barcode zones
   * 
   * If barcodeRects is empty, falls back to heuristic:
   *   top 40% of image is treated as barcode zone.
   * 
   * @param {HTMLCanvasElement} canvas
   * @param {number} textThreshold   - default 175
   * @param {Array}  barcodeRects    - [{x,y,w,h}] from detectBarcodeRects
   * @param {number} barcodeThreshold - default 200
   * @param {number} barcodeErode    - erosion iterations in barcode zone, default 1
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
          // We only erode vertically (checking top/bottom pixels) to thin
          // horizontal bleeding without destroying thin vertical text strokes!
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
                // Erode horizontally and vertically (standard 4-way)
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
   * Simple global threshold (kept as fallback / for non-barcode pages).
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

  /**
   * Multi-step downscale: halves dimensions iteratively to preserve
   * barcode line detail better than a single large-ratio resize.
   */
  static resizeStepDown(canvas, maxWidth = 384) {
    if (canvas.width <= maxWidth) return canvas;

    let current = canvas;
    while (current.width > maxWidth * 2) {
      const halfW = Math.floor(current.width / 2);
      const halfH = Math.floor(current.height / 2);
      const stepCanvas = document.createElement('canvas');
      stepCanvas.width = halfW;
      stepCanvas.height = halfH;
      const ctx = stepCanvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(current, 0, 0, halfW, halfH);
      current = stepCanvas;
    }

    const finalW = maxWidth;
    const finalH = Math.floor(current.height * (maxWidth / current.width));
    const outCanvas = document.createElement('canvas');
    outCanvas.width = finalW;
    outCanvas.height = finalH;
    const ctx = outCanvas.getContext('2d');
    // Disable smoothing for final step to preserve sharp barcode edges
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(current, 0, 0, finalW, finalH);
    return outCanvas;
  }
}

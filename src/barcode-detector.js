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

/**
 * Utility class for barcode detection using native API and ZXing fallback.
 */
export class BarcodeDetectorUtil {
  /**
   * Detect barcode bounding rectangles on the canvas using native API or ZXing fallback.
   * @param {HTMLCanvasElement} canvas - The source canvas.
   * @returns {Promise<Array<{x: number, y: number, w: number, h: number, value: string, format: string}>>} Array of detected barcodes.
   */
  static async detectBarcodeRects(canvas) {
    const width = canvas.width;
    const height = canvas.height;
    
    // 1. Try native BarcodeDetector API first (much faster and more robust on Chrome/Android/macOS)
    if ('BarcodeDetector' in window) {
      try {
        const detector = new window.BarcodeDetector({
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
    const rects = [];
    const seen = new Set();

    const hints = new Map();
    hints.set(DecodeHintType.TRY_HARDER, true);
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
        
        const bW = Math.max(...rxs) - Math.min(...rxs);
        const bH = Math.max(...rys) - Math.min(...rys);
        
        const rw2 = bW + 10;
        const rh2 = Math.max(40, bH + 40); 

        let origCx, origCy, origW, origH;
        if (rot === 0) {
          origCx = rcx; origCy = rcy; origW = rw2; origH = rh2;
        } else if (rot === 1) {
          origCx = rcy; origCy = rw - rcx;
          origW = rh2; origH = rw2;
        } else if (rot === 2) {
          origCx = rw - rcx; origCy = rh - rcy; 
          origW = rw2; origH = rh2;
        } else {
          origCx = rh - rcy; origCy = rcx;
          origW = rh2; origH = rw2;
        }

        const key = Math.round(origCy / 15) * 1000 + Math.round(origCx / 15);
        if (seen.has(key)) continue;
        seen.add(key);

        rects.push({
          x: Math.round(origCx - origW / 2),
          y: Math.round(origCy - origH / 2),
          w: Math.round(origW),
          h: Math.round(origH),
          value: result.getText(),
          format: result.getBarcodeFormat().toString()
        });
      }

      rotated = rotate90CW(rotated);
    }

    return rects;
  }
}

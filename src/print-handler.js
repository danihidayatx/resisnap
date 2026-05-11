import JsBarcode from 'jsbarcode';
import { EscPosBuilder } from './escpos';
import { ImageProcessor } from './image-proc';
import { BarcodeDetectorUtil } from './barcode-detector';
import { rotateCanvas, resizeStepDown } from './canvas-utils';
import { Toast } from './toast';

/**
 * Processes and prints specified pages to the thermal printer.
 * @param {Object} state - Application state.
 * @param {number[]} pageNumbers - Array of 1-based page numbers.
 * @param {Function} onBarcodeDetected - Callback when a barcode is detected.
 * @returns {Promise<void>}
 */
export async function printPages(state, pageNumbers, onBarcodeDetected) {
  if (!state.activePrinter || !state.activePrinter.isConnected) {
    Toast.warn('Please connect a printer first.', 'Printer Offline', 0);
    return;
  }

  const cropData = state.cropManager.getCropData();
  if (!cropData) {
    Toast.warn('Please draw a crop selection first.', 'Missing Selection', 0);
    return;
  }

  try {
    const builder = new EscPosBuilder().init()
      .setLineSpacing(0);

    for (const pageNum of pageNumbers) {
      const original = state.originalCanvases[pageNum - 1];
      const rotated = rotateCanvas(original, state.rotation);

      const adjusted = ImageProcessor.applyAdjustments(rotated, state.brightness, state.contrast, state.grayscale);
      const cropped = await state.cropManager.getCroppedCanvas(adjusted, cropData);

      const resized = resizeStepDown(cropped, state.printerWidthPx);

      const unadjustedCropped = await state.cropManager.getCroppedCanvas(rotated, cropData);
      
      const barcodeRectsRaw = await BarcodeDetectorUtil.detectBarcodeRects(unadjustedCropped);

      const scaleFactor = resized.width / unadjustedCropped.width;
      const barcodeRects = barcodeRectsRaw.map(r => ({
        x: Math.round(r.x * scaleFactor),
        y: Math.round(r.y * scaleFactor),
        w: Math.round(r.w * scaleFactor),
        h: Math.round(r.h * scaleFactor),
        value: r.value
      }));

      if (barcodeRects.length > 0 && !state.barcodeValue) {
        onBarcodeDetected(barcodeRects[0].value);
      }

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

      if (state.eraseOriginalBarcode && barcodeRects.length > 0) {
        const resizedCtx = resized.getContext('2d');
        resizedCtx.fillStyle = '#ffffff';
        for (const rect of barcodeRects) {
          resizedCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
        }
      }

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
    await state.activePrinter.print(builder.getBuffer());
  } catch (err) {
    console.error('Print failed:', err);
    Toast.error('Printing failed. Check console for details.', 'Print Error');
  }
}

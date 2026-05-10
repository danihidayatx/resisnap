export class ImageProcessor {
  static applyAdjustments(canvas, brightness, contrast, grayscale = false) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Normalize brightness/contrast to -1 to 1 range
    const b = brightness / 100;
    const c = contrast / 100;
    const factor = (259 * (c * 255 + 255)) / (255 * (259 - c * 255));

    for (let i = 0; i < data.length; i += 4) {
      if (grayscale) {
        // Luminance formula: 0.299R + 0.587G + 0.114B
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = data[i + 1] = data[i + 2] = gray;
      }

      // RGB
      for (let j = 0; j < 3; j++) {
        let val = data[i + j];
        // Apply brightness
        val = val + b * 255;
        // Apply contrast
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

  static toMonochrome(canvas, threshold = 128) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    const monoData = new Uint8Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      monoData[i / 4] = avg < threshold ? 1 : 0; // 1 for black (ink), 0 for white
    }

    return { data: monoData, width, height };
  }

  static resizeToFit(canvas, maxWidth = 384) {
    const scale = maxWidth / canvas.width;
    const newWidth = maxWidth;
    const newHeight = Math.floor(canvas.height * scale);

    const outCanvas = document.createElement('canvas');
    outCanvas.width = newWidth;
    outCanvas.height = newHeight;
    const ctx = outCanvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, newWidth, newHeight);
    
    return outCanvas;
  }
}

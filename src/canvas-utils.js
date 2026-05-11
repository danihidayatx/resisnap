/**
 * Utility functions for HTML5 Canvas geometric manipulations and auto-cropping.
 */

/**
 * Rotates a canvas by specified degrees using pixel-perfect integer transforms.
 * @param {HTMLCanvasElement} canvas - Source canvas.
 * @param {number} degrees - Rotation in degrees (90, 180, 270).
 * @returns {HTMLCanvasElement} Rotated canvas.
 */
export function rotateCanvas(canvas, degrees) {
  if (degrees === 0) return canvas;
  
  const W = canvas.width;
  const H = canvas.height;
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  
  if (degrees === 90 || degrees === 270) {
    out.width = H;
    out.height = W;
  } else {
    out.width = W;
    out.height = H;
  }
  
  // Fill with white to prevent transparency artifacts
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out.width, out.height);
  
  // Use setTransform with INTEGER-ONLY values for pixel-perfect rotation.
  if (degrees === 90) {
    ctx.setTransform(0, 1, -1, 0, H, 0);
  } else if (degrees === 180) {
    ctx.setTransform(-1, 0, 0, -1, W, H);
  } else if (degrees === 270) {
    ctx.setTransform(0, -1, 1, 0, 0, W);
  }
  
  ctx.drawImage(canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset
  
  return out;
}

/**
 * Multi-step downscale: halves dimensions iteratively to preserve detail.
 * @param {HTMLCanvasElement} canvas - The source canvas.
 * @param {number} [maxWidth=384] - The target maximum width.
 * @returns {HTMLCanvasElement} The resized canvas.
 */
export function resizeStepDown(canvas, maxWidth = 384) {
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
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(current, 0, 0, finalW, finalH);
  return outCanvas;
}

/**
 * Find the bounding box of non-white pixels to auto-crop blank margins.
 * @param {HTMLCanvasElement} canvas - The source canvas.
 * @param {number} [threshold=230] - Luminance value below which a pixel is considered non-white.
 * @returns {{x: number, y: number, width: number, height: number}} The bounding box rect.
 */
export function getAutoCropRect(canvas, threshold = 230) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width, minY = height, maxX = 0, maxY = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      if (a > 10 && lum < threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (minX > maxX || minY > maxY) {
    return { x: 0, y: 0, width, height };
  }

  const padding = 30;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(width, maxX + padding);
  maxY = Math.min(height, maxY + padding);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

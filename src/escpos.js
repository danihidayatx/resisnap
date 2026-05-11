/**
 * Helper class to build ESC/POS command buffers for thermal printers.
 */
export class EscPosBuilder {
  constructor() {
    /** @type {number[]} */
    this.buffer = [];
  }

  /**
   * Initializes the printer (ESC @).
   * @returns {EscPosBuilder}
   */
  init() {
    this.buffer.push(0x1B, 0x40); // ESC @ (Initialize)
    return this;
  }

  /**
   * Sets the line spacing (ESC 3 n).
   * @param {number} [n=30] - Line spacing in dots.
   * @returns {EscPosBuilder}
   */
  setLineSpacing(n = 30) {
    this.buffer.push(0x1B, 0x33, n); // ESC 3 n
    return this;
  }

  /**
   * Feeds n lines (LF).
   * @param {number} [n=3] - Number of lines to feed.
   * @returns {EscPosBuilder}
   */
  feed(n = 3) {
    for (let i = 0; i < n; i++) {
      this.buffer.push(0x0A); // LF
    }
    return this;
  }

  /**
   * Performs a partial cut (GS V 66 0).
   * @returns {EscPosBuilder}
   */
  cut() {
    this.buffer.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0 (Partial cut)
    return this;
  }

  /**
   * Adds a raster bit image to the buffer (GS v 0).
   * GS v 0 m xL xH yL yH d1...dk
   * @param {Uint8Array} monoData - Monochrome pixel data (1 for black, 0 for white).
   * @param {number} width - Image width in pixels.
   * @param {number} height - Image height in pixels.
   * @returns {EscPosBuilder}
   */
  rasterImage(monoData, width, height) {
    const xBytes = Math.ceil(width / 8);
    const xL = xBytes & 0xFF;
    const xH = (xBytes >> 8) & 0xFF;
    const yL = height & 0xFF;
    const yH = (height >> 8) & 0xFF;

    this.buffer.push(0x1D, 0x76, 0x30, 0x00); // GS v 0 0
    this.buffer.push(xL, xH, yL, yH);

    // Convert bit array to bytes
    for (let y = 0; y < height; y++) {
      for (let xByte = 0; xByte < xBytes; xByte++) {
        let byte = 0;
        for (let bit = 0; bit < 8; bit++) {
          const x = xByte * 8 + bit;
          if (x < width) {
            const val = monoData[y * width + x];
            if (val === 1) { // 1 is black
              byte |= (1 << (7 - bit));
            }
          }
        }
        this.buffer.push(byte);
      }
    }
    return this;
  }

  /**
   * Returns the final command buffer as a Uint8Array.
   * @returns {Uint8Array}
   */
  getBuffer() {
    return new Uint8Array(this.buffer);
  }

  /**
   * Clears the current buffer.
   * @returns {EscPosBuilder}
   */
  clear() {
    this.buffer = [];
    return this;
  }
}

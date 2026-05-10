export class EscPosBuilder {
  constructor() {
    this.buffer = [];
  }

  init() {
    this.buffer.push(0x1B, 0x40); // ESC @ (Initialize)
    return this;
  }

  setLineSpacing(n = 30) {
    this.buffer.push(0x1B, 0x33, n); // ESC 3 n
    return this;
  }

  feed(n = 3) {
    for (let i = 0; i < n; i++) {
      this.buffer.push(0x0A); // LF
    }
    return this;
  }

  cut() {
    this.buffer.push(0x1D, 0x56, 0x42, 0x00); // GS V 66 0 (Partial cut)
    return this;
  }

  /**
   * GS v 0 m xL xH yL yH d1...dk
   * Raster Bit Image
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

  getBuffer() {
    return new Uint8Array(this.buffer);
  }

  clear() {
    this.buffer = [];
    return this;
  }
}

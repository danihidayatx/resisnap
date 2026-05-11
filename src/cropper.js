import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

export class CropManager {
  constructor(elementId, options = {}) {
    this.elementId = elementId;
    this.cropper = null;
    this.cropData = null;
    this.options = {
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 0.8,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      ...options
    };
  }

  init(imageElement) {
    if (this.cropper) {
      this.cropper.destroy();
    }
    this.cropper = new Cropper(imageElement, {
      ...this.options,
      ready: () => {
        if (this.cropData) {
          this.cropper.setData(this.cropData);
        }
      },
      crop: (event) => {
        this.cropData = event.detail;
      }
    });
  }

  setCropData(data) {
    this.cropData = data;
    if (this.cropper) {
      this.cropper.setData(data);
    }
  }

  getCropData() {
    return this.cropData || (this.cropper ? this.cropper.getData() : null);
  }

  destroy() {
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  }

  async getCroppedCanvas(canvas, cropData, rotation = 0) {
    // Manually crop a canvas based on cropData
    // cropData: { x, y, width, height, rotate, scaleX, scaleY }
    const { x, y, width, height } = cropData;
    
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = width;
    outputCanvas.height = height;
    const ctx = outputCanvas.getContext('2d');
    
    // Fill with white to prevent transparency artifacts
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    ctx.drawImage(
      canvas,
      x, y, width, height,
      0, 0, width, height
    );
    
    return outputCanvas;
  }
}

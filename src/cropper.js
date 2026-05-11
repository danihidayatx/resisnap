import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';

/**
 * Manages the Cropper.js instance for image cropping.
 */
export class CropManager {
  /**
   * @param {string} elementId - The ID of the element to attach the cropper to (legacy, not strictly used in current init).
   * @param {Object} [options={}] - Custom Cropper.js options.
   */
  constructor(elementId, options = {}) {
    this.elementId = elementId;
    /** @type {Cropper|null} */
    this.cropper = null;
    /** @type {Object|null} */
    this.cropData = null;
    /** @type {Object} */
    this.options = {
      viewMode: 1,
      dragMode: 'crop',
      autoCropArea: 1,
      restore: false,
      guides: true,
      center: true,
      highlight: false,
      background: false,
      cropBoxMovable: true,
      cropBoxResizable: true,
      toggleDragModeOnDblclick: false,
      zoomable: false,
      ...options
    };
  }

  /**
   * Initializes the cropper on a given image element.
   * @param {HTMLImageElement|HTMLCanvasElement} imageElement - The element to crop.
   */
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

  /**
   * Manually sets the crop data.
   * @param {Object} data - Cropper.js data object {x, y, width, height, ...}.
   */
  setCropData(data) {
    this.cropData = data;
    if (this.cropper) {
      this.cropper.setData(data);
    }
  }

  /**
   * Returns the current crop data.
   * @returns {Object|null}
   */
  getCropData() {
    return this.cropData || (this.cropper ? this.cropper.getData() : null);
  }

  /**
   * Destroys the cropper instance.
   */
  destroy() {
    if (this.cropper) {
      this.cropper.destroy();
      this.cropper = null;
    }
  }

  /**
   * Manually crops a canvas based on provided crop data.
   * @param {HTMLCanvasElement} canvas - The source canvas.
   * @param {Object} cropData - { x, y, width, height }
   * @param {number} [rotation=0] - Legacy param, not used.
   * @returns {Promise<HTMLCanvasElement>} The cropped canvas.
   */
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

import { createIcons, CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide';

/**
 * Manages display of toast notifications.
 */
class ToastManager {
  constructor() {
    /** @type {HTMLDivElement} */
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
    
    /** @type {Object} */
    this.icons = { CheckCircle, AlertCircle, AlertTriangle, Info, X };
  }

  /**
   * Displays a toast notification.
   * @param {string} type - Toast type ('success', 'error', 'warning', 'info').
   * @param {string} message - Message to display.
   * @param {string} [title=''] - Optional title.
   * @param {number} [duration=5000] - Duration in ms (0 for persistent).
   * @returns {HTMLDivElement} The toast element.
   */
  show(type, message, title = '', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const iconName = type === 'error' ? 'alert-circle' : 
                   type === 'warning' ? 'alert-triangle' :
                   type === 'success' ? 'check-circle' : 'info';

    toast.innerHTML = `
      <div class="toast-icon">
        <i data-lucide="${iconName}"></i>
      </div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" aria-label="Close notification">
        <i data-lucide="x"></i>
      </button>
    `;

    this.container.appendChild(toast);
    
    // Initialize icons for this specific toast
    createIcons({
      icons: this.icons,
      attrs: { 'stroke-width': 2.5, size: 20 },
      nameAttr: 'data-lucide',
      root: toast
    });

    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.onclick = () => this.remove(toast);

    if (duration > 0) {
      setTimeout(() => this.remove(toast), duration);
    }

    return toast;
  }

  /**
   * Removes a toast notification with animation.
   * @param {HTMLDivElement} toast - The toast element to remove.
   */
  remove(toast) {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode === this.container) {
        this.container.removeChild(toast);
      }
    }, 300);
  }

  /**
   * Displays a success toast.
   * @param {string} message 
   * @param {string} [title='Success'] 
   * @param {number} [duration=3000] 
   * @returns {HTMLDivElement}
   */
  success(message, title = 'Success', duration = 3000) {
    return this.show('success', message, title, duration);
  }

  /**
   * Displays an error toast.
   * @param {string} message 
   * @param {string} [title='Error'] 
   * @param {number} [duration=0] 
   * @returns {HTMLDivElement}
   */
  error(message, title = 'Error', duration = 0) { // Default errors to persistent
    return this.show('error', message, title, duration);
  }

  /**
   * Displays a warning toast.
   * @param {string} message 
   * @param {string} [title='Warning'] 
   * @param {number} [duration=6000] 
   * @returns {HTMLDivElement}
   */
  warn(message, title = 'Warning', duration = 6000) {
    return this.show('warning', message, title, duration);
  }

  /**
   * Displays an info toast.
   * @param {string} message 
   * @param {string} [title='Info'] 
   * @param {number} [duration=5000] 
   * @returns {HTMLDivElement}
   */
  info(message, title = 'Info', duration = 5000) {
    return this.show('info', message, title, duration);
  }
}

/** @type {ToastManager} */
export const Toast = new ToastManager();

import { createIcons, CheckCircle, AlertCircle, AlertTriangle, Info, X } from 'lucide';

class ToastManager {
  constructor() {
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
    
    this.icons = { CheckCircle, AlertCircle, AlertTriangle, Info, X };
  }

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

  remove(toast) {
    if (toast.classList.contains('removing')) return;
    toast.classList.add('removing');
    setTimeout(() => {
      if (toast.parentNode === this.container) {
        this.container.removeChild(toast);
      }
    }, 300);
  }

  success(message, title = 'Success', duration = 3000) {
    return this.show('success', message, title, duration);
  }

  error(message, title = 'Error', duration = 0) { // Default errors to persistent
    return this.show('error', message, title, duration);
  }

  warn(message, title = 'Warning', duration = 6000) {
    return this.show('warning', message, title, duration);
  }

  info(message, title = 'Info', duration = 5000) {
    return this.show('info', message, title, duration);
  }
}

export const Toast = new ToastManager();

/**
 * Manages WebUSB communication with a thermal printer.
 */
export class UsbPrinter {
  constructor() {
    /** @type {USBDevice|null} */
    this.device = null;
    /** @type {number|null} */
    this.endpointNumber = null;
  }

  /**
   * Requests a USB device and establishes a connection.
   * @returns {Promise<string>} The product name of the connected printer.
   * @throws {Error} If no bulk out endpoint is found or connection fails.
   */
  async connect() {
    try {
      this.device = await navigator.usb.requestDevice({
        filters: [{ classCode: 0x07 }] // Printer class
      });

      await this.device.open();
      await this.device.selectConfiguration(1);
      await this.device.claimInterface(0);

      // Find bulk out endpoint
      const interface0 = this.device.configuration.interfaces[0];
      const alternate0 = interface0.alternates[0];
      const outEndpoint = alternate0.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');

      if (!outEndpoint) {
        throw new Error('No bulk out endpoint found');
      }

      this.endpointNumber = outEndpoint.endpointNumber;
      return this.device.productName || 'USB Printer';
    } catch (error) {
      console.error('USB Connect Error:', error);
      throw error;
    }
  }

  /**
   * Transfers data to the printer.
   * @param {Uint8Array} data - The ESC/POS command buffer to send.
   * @throws {Error} If the printer is not connected.
   */
  async print(data) {
    if (!this.device) {
      throw new Error('Printer not connected');
    }

    // Split data into chunks if needed (WebUSB has limits)
    const chunkSize = 16384;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.device.transferOut(this.endpointNumber, chunk);
    }
  }

  /**
   * Closes the USB connection.
   */
  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }

  /**
   * Returns true if a printer is currently connected.
   * @type {boolean}
   */
  get isConnected() {
    return !!this.device;
  }
}

export class UsbPrinter {
  constructor() {
    this.device = null;
    this.endpointNumber = null;
  }

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

  async disconnect() {
    if (this.device) {
      await this.device.close();
      this.device = null;
    }
  }

  get isConnected() {
    return !!this.device;
  }
}

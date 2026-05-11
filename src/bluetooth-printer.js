/**
 * Manages Web Bluetooth communication with a thermal printer.
 */
export class BluetoothPrinter {
  constructor() {
    /** @type {BluetoothDevice|null} */
    this.device = null;
    /** @type {BluetoothRemoteGATTCharacteristic|null} */
    this.characteristic = null;
    /** @type {string[]} Common printer service UUIDs */
    this.serviceUuids = ['0000ff00-0000-1000-8000-00805f9b34fb'];
    /** @type {string[]} Common write characteristic UUIDs */
    this.characteristicUuids = ['0000ff02-0000-1000-8000-00805f9b34fb'];
  }

  /**
   * Requests a Bluetooth device and establishes a connection.
   * @returns {Promise<string>} The name of the connected printer.
   * @throws {Error} If connection fails or no characteristic is found.
   */
  async connect() {
    try {
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: this.serviceUuids },
          { namePrefix: 'Printer' },
          { namePrefix: 'MPT' },
          { namePrefix: 'MTP' },
          { namePrefix: 'POS' }
        ],
        optionalServices: this.serviceUuids
      });

      const server = await this.device.gatt.connect();
      
      // Try to find a valid service and characteristic
      let service;
      for (const uuid of this.serviceUuids) {
        try {
          service = await server.getPrimaryService(uuid);
          if (service) break;
        } catch (e) {
          continue;
        }
      }

      if (!service) {
        throw new Error('No compatible printer service found');
      }

      for (const uuid of this.characteristicUuids) {
        try {
          this.characteristic = await service.getCharacteristic(uuid);
          if (this.characteristic) break;
        } catch (e) {
          continue;
        }
      }

      if (!this.characteristic) {
        throw new Error('No write characteristic found');
      }

      return this.device.name || 'Bluetooth Printer';
    } catch (error) {
      console.error('Bluetooth Connect Error:', error);
      throw error;
    }
  }

  /**
   * Transfers data to the printer.
   * @param {Uint8Array} data - The ESC/POS command buffer to send.
   * @throws {Error} If the printer is not connected.
   */
  async print(data) {
    if (!this.characteristic) {
      throw new Error('Printer not connected');
    }

    // BLE MTU is usually small. Split data into chunks.
    // 20 bytes is a safe chunk size for most BLE devices.
    const chunkSize = 20;
    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.slice(i, i + chunkSize);
      await this.characteristic.writeValue(chunk);
    }
  }

  /**
   * Closes the Bluetooth connection.
   */
  async disconnect() {
    if (this.device && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.device = null;
    this.characteristic = null;
  }

  /**
   * Returns true if a printer is currently connected.
   * @type {boolean}
   */
  get isConnected() {
    return !!this.characteristic;
  }
}

# ResiSnap

ResiSnap is a client-side web application designed to streamline the cropping, image processing, and direct printing of marketplace shipping labels (Shopee, Tokopedia, etc.) to thermal printers via the WebUSB API.

This project was developed to address common issues encountered when printing shipping labels on thermal printers, such as unreadable barcodes, faded prints, and incompatible paper sizes.

## Key Features

- **Direct WebUSB Printing**: Communicates directly with thermal printers through the WebUSB interface using ESC/POS commands. This eliminates the need for additional printer drivers and supports Windows, macOS, Linux, and Android Chrome.
- **Client-Side PDF Processing**: Reads and renders PDF shipping labels directly within the browser using `pdfjs-dist`. No files are uploaded to external servers, ensuring data privacy and security.
- **Auto-Crop & Manual Cropping**: Provides precise label cropping capabilities with a responsive interface powered by `cropperjs`.
- **Thermal Image Processing**: Optimizes output for thermal printers through grayscale conversion, brightness and contrast adjustments, thresholding, and dithering techniques.
- **Intelligent Barcode Detection & Regeneration**: Utilizes `@zxing/library` to detect barcode locations on the label and `jsbarcode` to regenerate them with maximum contrast. This ensures 100% scannability, even on low-resolution 58mm thermal printers.
- **Multi-Format Printer Support**: Fully compatible with standard thermal printer paper widths: 58mm, 80mm, and 100mm/110mm.
- **Mobile-Friendly User Interface**: Features a responsive design optimized for both mobile and desktop devices, including drag-and-drop functionality for seamless file uploads.
- **Persistent USB Connection (Android)**: Implements robust WebUSB connection handling to maintain printer pairing on Android devices.

## Technology Stack

ResiSnap is built using a lightweight and modern Vanilla JavaScript architecture:
- **Build Tool**: [Vite](https://vitejs.dev/)
- **PDF Rendering**: [PDF.js (pdfjs-dist)](https://mozilla.github.io/pdf.js/)
- **Image Cropping**: [Cropper.js](https://fengyuanchen.github.io/cropperjs/)
- **Barcode Detection**: [@zxing/library](https://github.com/zxing-js/library)
- **Barcode Generation**: [JsBarcode](https://lindell.me/JsBarcode/)
- **Icons**: [Lucide](https://lucide.dev/)

## Installation & Development

This project utilizes Vite, making local setup straightforward.

### Prerequisites
- Node.js (version 18 or higher recommended)
- npm, pnpm, or yarn

### Steps
1. **Clone the repository:**
   ```bash
   git clone https://github.com/danihidayatx/resisnap.git
   cd resisnap
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000` (or another port specified by Vite).

4. **Build for production:**
   ```bash
   npm run build
   ```
   The production build will be generated in the `dist/` directory, ready to be deployed to static hosting services.

## Deployment

### Cloudflare Pages (Recommended)
The easiest way to deploy ResiSnap is via Cloudflare Pages:
1. Connect your GitHub repository to Cloudflare.
2. Set the **Build command** to `npm run build`.
3. Set the **Build output directory** to `dist`.

Alternatively, use the Wrangler CLI:
```bash
npm run build
npx wrangler pages deploy dist --project-name resisnap
```

### Cloudflare Workers
To deploy using the Cloudflare Workers Assets feature:
```bash
npm run build
npx wrangler deploy
```
*Note: This requires the `wrangler.toml` file included in the repository.*


## Usage Guide

1. Open the ResiSnap application in a Chromium-based browser (Google Chrome, Microsoft Edge, Opera, or Chrome for Android) as the WebUSB API is required.
2. Click or drag-and-drop a marketplace PDF shipping label (Shopee/Tokopedia) into the designated area.
3. Use the cropping tool to select the label area you wish to print.
4. Adjust the image settings (dithering, sharpness, threshold) if necessary to achieve the optimal print result.
5. Click the Print button. Upon the first use, the browser will prompt you to grant connection permissions to your USB Thermal Printer.
6. Select your printer from the device list, and the label will be printed immediately.

## Contributing

This project is open-source, and community contributions are highly encouraged.

To contribute:
1. Fork this repository.
2. Create a new feature branch (`git checkout -b feature/your-feature-name`).
3. Commit your changes (`git commit -m 'Add some feature'`).
4. Push to the branch (`git push origin feature/your-feature-name`).
5. Open a Pull Request.

Please report any bugs or issues through the Issues tab in this repository.

## License

[MIT License](LICENSE) - Free to use, modify, and distribute for both personal and commercial purposes.

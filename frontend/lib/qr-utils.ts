import QRCode from "qrcode";

export async function downloadQrAsPng(qrContent: string, filename: string) {
  try {
    const dataUrl = await QRCode.toDataURL(qrContent, {
      errorCorrectionLevel: "M",
      margin: 1,
      scale: 8,
      width: 1024
    });
    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = filename;
    link.click();
  } catch (err) {
    console.error("Failed to download PNG:", err);
    throw err;
  }
}

export async function downloadQrAsSvg(qrContent: string, filename: string) {
  try {
    // Cast to any to bypass potential type definition mismatch
    const svgString = await (QRCode as any).toString(qrContent, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 1024
    });
    const blob = new Blob([svgString], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("Failed to download SVG:", err);
    throw err;
  }
}

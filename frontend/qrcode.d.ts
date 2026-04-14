declare module "qrcode" {
  export type QRCodeToDataURLOptions = {
    errorCorrectionLevel?: "L" | "M" | "Q" | "H";
    margin?: number;
    scale?: number;
    width?: number;
  };

  const QRCode: {
    toDataURL(
      text: string,
      options?: QRCodeToDataURLOptions
    ): Promise<string>;
  };

  export default QRCode;
}

import { Html5QrcodeScanner } from "html5-qrcode";
import { useEffect } from "react";

type Props = {
  onScan: (data: string) => void;
};

function QRScanner({ onScan }: Props) {
  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 10, qrbox: 250 },
      false
    );

    scanner.render(
      (decodedText) => {
        onScan(decodedText);
        scanner.clear();
      },
      (error) => {
        console.warn(error);
      }
    );

    return () => {
      scanner.clear().catch(() => {});
    };
  }, []);

  return <div id="reader"></div>;
}

export default QRScanner;
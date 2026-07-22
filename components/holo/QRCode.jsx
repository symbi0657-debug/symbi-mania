"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * A real QR code.
 *
 * The previous implementation built a grid from an FNV hash of the value and
 * drew finder squares around it. It *looked* like a QR code and scanned as
 * nothing at all — no format info, no timing pattern, no error correction, no
 * encoded data. Any pass that fell back to this component (i.e. any ticket
 * whose stored `qrDataUrl` was missing) showed the buyer an unscannable image.
 */
export function QRCodeCanvas({ value, size = 100 }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(String(value), {
      width: size * 2, // 2x so it stays crisp on retina screens
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0014", light: "#ffffff" },
    })
      .then((url) => !cancelled && setDataUrl(url))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (failed) {
    // Better a legible code the gate can type in than a decorative fake.
    return (
      <div
        style={{ width: size, height: size }}
        className="grid place-items-center rounded bg-white p-1 text-center text-[9px] font-bold leading-tight text-black"
      >
        {value}
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="animate-pulse rounded bg-white/20"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt="Pass QR code"
      width={size}
      height={size}
      style={{ width: size, height: size }}
    />
  );
}

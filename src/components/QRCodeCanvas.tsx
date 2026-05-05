import React, { useEffect, useRef } from 'react';
import { QrCode, Ecc } from '../utils/qrcodegen';

interface ImageSettings {
  src: string;
  height: number;
  width: number;
  excavate: boolean;
  x?: number;
  y?: number;
}

interface Props {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  includeMargin?: boolean;
  bgColor?: string;
  fgColor?: string;
  imageSettings?: ImageSettings;
  className?: string;
  style?: React.CSSProperties;
}

export const QRCodeCanvas = ({
  value,
  size = 128,
  level = 'L',
  bgColor = '#FFFFFF',
  fgColor = '#000000',
  imageSettings,
  className,
  style,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Map level string to Ecc object
    const eclMap: Record<string, Ecc> = {
      L: Ecc.LOW,
      M: Ecc.MEDIUM,
      Q: Ecc.QUARTILE,
      H: Ecc.HIGH,
    };
    const ecl = eclMap[level] || Ecc.LOW;

    // Generate QR Code
    try {
      const qr = QrCode.encodeText(value, ecl);
      const scale = size / qr.size;

      // Draw background
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      // Draw modules
      ctx.fillStyle = fgColor;
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (qr.getModule(x, y)) {
            ctx.fillRect(Math.round(x * scale), Math.round(y * scale), Math.ceil(scale), Math.ceil(scale));
          }
        }
      }

      // Handle Image Overlay
      if (imageSettings) {
        const img = new Image();
        img.onload = () => {
          const imgSize = {
            w: imageSettings.width,
            h: imageSettings.height,
          };
          const dx = imageSettings.x ?? (size - imgSize.w) / 2;
          const dy = imageSettings.y ?? (size - imgSize.h) / 2;

          if (imageSettings.excavate) {
            ctx.fillStyle = bgColor;
            ctx.fillRect(dx, dy, imgSize.w, imgSize.h);
          }

          ctx.drawImage(img, dx, dy, imgSize.w, imgSize.h);
        };
        img.src = imageSettings.src;
      }
    } catch (e) {
      console.error('QR Generation failed:', e);
    }
  }, [value, size, level, bgColor, fgColor, imageSettings]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={className}
      style={{ ...style, width: size, height: size }}
    />
  );
};

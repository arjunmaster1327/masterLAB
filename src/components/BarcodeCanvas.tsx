import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';

interface BarcodeCanvasProps {
  value: string;
  height?: number;
  width?: number;
  className?: string;
}

export const BarcodeCanvas: React.FC<BarcodeCanvasProps> = ({
  value,
  height = 42,
  width = 1.6,
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          height,
          width,
          displayValue: true,
          fontSize: 11,
          margin: 4,
          background: '#ffffff',
          lineColor: '#0f172a',
        });
      } catch {
        // Ignore invalid chars gracefully
      }
    }
  }, [value, height, width]);

  return <svg ref={svgRef} className={className} aria-label={`Barcode ${value}`} />;
};

export function printSpecimenSticker(
  accessionNo: string,
  patientName: string,
  sampleType: string,
  tubeColor?: string
): void {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, accessionNo, {
      format: 'CODE128',
      width: 2,
      height: 44,
      displayValue: true,
      fontSize: 12,
      margin: 4,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch {
    return;
  }
  const dataUrl = canvas.toDataURL('image/png');
  const win = window.open('', '_blank', 'width=420,height=280');
  if (!win) return;
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>Specimen Label - ${accessionNo}</title>
        <style>
          body { font-family: system-ui, sans-serif; margin: 12px; color: #0f172a; }
          .label { border: 1px solid #cbd5e1; padding: 10px 14px; border-radius: 6px; max-width: 320px; }
          .name { font-weight: 700; font-size: 14px; margin-bottom: 2px; }
          .meta { font-size: 11px; color: #475569; margin-bottom: 6px; }
          img { max-width: 100%; height: auto; display: block; }
        </style>
      </head>
      <body onload="window.print()">
        <div class="label">
          <div class="name">${patientName}</div>
          <div class="meta">${sampleType}${tubeColor ? ` · ${tubeColor}` : ''}</div>
          <img src="${dataUrl}" alt="${accessionNo}" />
        </div>
      </body>
    </html>
  `);
  win.document.close();
}

export const PrintStickerButton: React.FC<{
  accessionNo: string;
  patientName: string;
  sampleType: string;
  tubeColor?: string;
}> = ({ accessionNo, patientName, sampleType, tubeColor }) => (
  <button
    type="button"
    onClick={() => printSpecimenSticker(accessionNo, patientName, sampleType, tubeColor)}
    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
    title="Print Barcode Sticker"
  >
    <Printer className="h-3.5 w-3.5 text-sky-700" />
    Print Label
  </button>
);

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, Keyboard, RefreshCw, X } from 'lucide-react';
import { requestNativeCameraPermission } from '../utils/nativeBridge';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onDetected,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  const stopScanner = useCallback(() => {
    if (scannerRef.current) {
      const current = scannerRef.current;
      scannerRef.current = null;
      current
        .stop()
        .then(() => current.clear())
        .catch(() => {});
    }
    setCameraActive(false);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const regionId = 'mcl-barcode-reader';

    const startScanner = async () => {
      try {
        setCameraError(null);
        const granted = await requestNativeCameraPermission();
        if (!granted) {
          if (!cancelled) {
            setCameraActive(false);
            setCameraError(
              'Camera permission denied. Allow Camera permission in Android App Settings or enter barcode manually below.'
            );
          }
          return;
        }
        if (cancelled) return;

        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 260, height: 120 } },
          (decodedText) => {
            if (!cancelled) {
              onDetected(decodedText.trim());
              onClose();
            }
          },
          () => {
            // Frame scan miss is normal
          }
        );
        if (!cancelled) setCameraActive(true);
      } catch (err) {
        if (!cancelled) {
          setCameraActive(false);
          setCameraError(
            err instanceof Error
              ? err.message
              : 'Camera unavailable or permission denied. Use manual/USB barcode input below.'
          );
        }
      }
    };

    const timer = setTimeout(() => {
      startScanner();
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      stopScanner();
    };
  }, [isOpen, onDetected, onClose, retryToken, stopScanner]);

  if (!isOpen) return null;

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    onDetected(manualCode.trim());
    setManualCode('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Camera className="h-5 w-5 text-sky-700" />
            <h3 className="text-base font-semibold text-slate-900">Scan Sample Barcode</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close scanner"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-950 overflow-hidden min-h-[200px] flex items-center justify-center relative">
            <div id="mcl-barcode-reader" className="w-full" />
            {!cameraActive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center text-slate-300 text-xs gap-2">
                {cameraError ? (
                  <>
                    <p className="font-medium text-amber-300">Camera Scanner Unavailable</p>
                    <p className="text-slate-400">{cameraError}</p>
                    <button
                      type="button"
                      onClick={() => {
                        stopScanner();
                        setRetryToken((n) => n + 1);
                      }}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry Camera
                    </button>
                  </>
                ) : (
                  <p>Initializing camera feed...</p>
                )}
              </div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <Keyboard className="h-3.5 w-3.5 text-slate-500" />
              USB Scanner / Manual Accession Barcode
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="e.g. ACC-261115-001"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:border-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-600/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-sky-700 px-4 py-2 text-sm font-medium text-white hover:bg-sky-800 transition-colors whitespace-nowrap"
              >
                Lookup
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

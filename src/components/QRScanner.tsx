import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  onScan: (text: string) => void;
}

export const QRScanner = ({ open, onClose, onScan }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const id = 'qr-scanner-region';

    (async () => {
      try {
        const scanner = new Html5Qrcode(id);
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decoded) => {
            if (cancelled) return;
            onScan(decoded);
          },
          () => { /* ignore per-frame errors */ }
        );
      } catch (err: any) {
        setError(err?.message ?? 'Unable to access camera.');
      }
    })();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      if (s) {
        s.stop()
          .catch(() => { /* noop */ })
          .finally(() => { try { s.clear(); } catch { /* noop */ } });
        scannerRef.current = null;
      }
    };
  }, [open, onScan]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Scan Punch-In QR Code</DialogTitle>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <div id="qr-scanner-region" ref={containerRef} className="w-full rounded overflow-hidden" />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default QRScanner;
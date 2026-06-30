import { useEffect, useRef, useState } from 'react';
import { pdfjs } from '@/lib/pdfWorker';

interface PdfPageCanvasProps {
  fileUrl: string | Uint8Array;
  pageNumber: number;
  scale?: number;
  onRendered?: (info: { width: number; height: number; numPages: number }) => void;
}

/**
 * Renders one PDF page to a canvas. Children should be absolutely positioned over it.
 */
export const PdfPageCanvas = ({ fileUrl, pageNumber, scale = 1.4, onRendered }: PdfPageCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: any;
    (async () => {
      try {
        loadingTask = pdfjs.getDocument(typeof fileUrl === 'string' ? fileUrl : { data: fileUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        setSize({ width: viewport.width, height: viewport.height });
        onRendered?.({ width: viewport.width, height: viewport.height, numPages: pdf.numPages });
      } catch (e) {
        console.error('PDF render error', e);
      }
    })();
    return () => {
      cancelled = true;
      try { loadingTask?.destroy?.(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl, pageNumber, scale]);

  return (
    <div className="relative inline-block" style={size ? { width: size.width, height: size.height } : undefined}>
      <canvas ref={canvasRef} className="block shadow-sm" />
    </div>
  );
};
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer, RefreshCw, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  jobSiteId: string;
  jobSiteName: string;
  token: string;
  onTokenChange?: (newToken: string) => void;
}

export const QRCodeDisplay = ({ jobSiteId, jobSiteName, token, onTokenChange }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [currentToken, setCurrentToken] = useState(token);
  const { toast } = useToast();

  const punchUrl = `${window.location.origin}/punch/${currentToken}`;

  useEffect(() => {
    setCurrentToken(token);
  }, [token]);

  useEffect(() => {
    if (open && canvasRef.current && currentToken) {
      QRCode.toCanvas(canvasRef.current, punchUrl, { width: 320, margin: 2 }, (err) => {
        if (err) console.error(err);
      });
    }
  }, [open, currentToken, punchUrl]);

  const handlePrint = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <html><head><title>Punch-In QR - ${jobSiteName}</title>
      <style>
        body { font-family: sans-serif; text-align: center; padding: 40px; }
        h1 { font-size: 28px; margin-bottom: 4px; }
        h2 { font-weight: normal; color: #555; margin-top: 0; }
        img { max-width: 400px; margin: 24px 0; }
        p { font-size: 14px; color: #555; max-width: 400px; margin: 8px auto; }
      </style></head><body>
        <h1>${jobSiteName}</h1>
        <h2>Employee Punch-In / Punch-Out</h2>
        <img src="${dataUrl}" alt="QR code" />
        <p>Open the Crew Compass app and scan this code to clock in or out.</p>
        <p><strong>This code is unique to ${jobSiteName}.</strong> It will not work at any other location.</p>
      </body></html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  const handleRegenerate = async () => {
    if (!confirm('Regenerate this QR code? Old printed codes will stop working.')) return;
    setRegenerating(true);
    const { data, error } = await supabase.rpc('regenerate_job_site_qr_token', { _job_site_id: jobSiteId });
    setRegenerating(false);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    const newToken = data as unknown as string;
    setCurrentToken(newToken);
    onTokenChange?.(newToken);
    toast({ title: 'QR code regenerated', description: 'Old codes are no longer valid.' });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); setOpen(true); }}>
        <QrCode className="h-4 w-4 mr-1" /> QR
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Punch-In QR Code</DialogTitle>
            <DialogDescription>
              Post this at {jobSiteName}. Workers scan it in the app to clock in or out. It only works at this location.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <canvas ref={canvasRef} />
            <div className="flex gap-2 w-full">
              <Button className="flex-1" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button variant="outline" onClick={handleRegenerate} disabled={regenerating}>
                <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? 'animate-spin' : ''}`} />
                Regenerate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QRCodeDisplay;
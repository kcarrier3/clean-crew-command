import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PenLine, Type, Trash2 } from 'lucide-react';

interface SignaturePadProps {
  onSignature: (signatureData: string, type: 'drawn' | 'typed') => void;
  existingSignature?: string;
  existingTyped?: string;
}

export const SignaturePad = ({ onSignature, existingSignature, existingTyped }: SignaturePadProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [typedName, setTypedName] = useState(existingTyped || '');
  const [activeTab, setActiveTab] = useState<'draw' | 'type'>('draw');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (existingSignature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0);
        img.src = existingSignature;
        setHasDrawn(true);
      }
    }
  }, [existingSignature]);

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    lastPos.current = getPos(e, canvas);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
    setHasDrawn(true);
  };

  const stopDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (canvasRef.current && hasDrawn) {
      onSignature(canvasRef.current.toDataURL('image/png'), 'drawn');
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
    onSignature('', 'drawn');
  };

  const handleTypedChange = (val: string) => {
    setTypedName(val);
    if (val.trim()) {
      onSignature(val.trim(), 'typed');
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">Signature</Label>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'draw' | 'type')}>
        <TabsList className="grid w-full grid-cols-2 h-8">
          <TabsTrigger value="draw" className="text-xs flex items-center gap-1.5">
            <PenLine className="h-3 w-3" />
            Draw
          </TabsTrigger>
          <TabsTrigger value="type" className="text-xs flex items-center gap-1.5">
            <Type className="h-3 w-3" />
            Type
          </TabsTrigger>
        </TabsList>

        <TabsContent value="draw" className="mt-2">
          <div className="relative border-2 border-dashed border-gray-300 rounded-md bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={150}
              className="w-full h-32 cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-sm text-gray-400">Sign here</p>
              </div>
            )}
            <div className="absolute bottom-0 left-0 right-0 border-t border-gray-300 mx-4" />
          </div>
          {hasDrawn && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1 text-xs text-muted-foreground"
              onClick={clearCanvas}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </TabsContent>

        <TabsContent value="type" className="mt-2">
          <div className="space-y-2">
            <Input
              value={typedName}
              onChange={e => handleTypedChange(e.target.value)}
              placeholder="Type your full legal name"
              className="font-serif text-lg"
            />
            {typedName && (
              <p className="font-serif text-xl text-gray-700 border-b border-gray-400 pb-1 px-1">
                {typedName}
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

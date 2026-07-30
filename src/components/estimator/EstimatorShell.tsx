import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  title: string;
  subtitle?: string;
  backTo?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function EstimatorShell({ title, subtitle, backTo = '/', actions, children }: Props) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-3 py-3 md:px-6 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(backTo)}
            aria-label="Go back"
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-base md:text-xl font-semibold truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-3 py-4 md:px-6 md:py-6 pb-28">{children}</main>
    </div>
  );
}

export default EstimatorShell;
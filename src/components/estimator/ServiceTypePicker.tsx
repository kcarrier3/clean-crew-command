import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Building2, HardHat, Waves, Sparkles, Layers } from 'lucide-react';
import { SERVICE_TYPES, type ServiceType } from './serviceTypes';

const ICONS: Record<ServiceType, React.ElementType> = {
  janitorial: Building2,
  construction_cleaning: HardHat,
  carpet_cleaning: Waves,
  floor_scrubbing: Sparkles,
  vct_strip_wax: Layers,
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (service: ServiceType) => void;
  subtitle?: string;
  disabled?: boolean;
}

export function ServiceTypePicker({ open, onOpenChange, onSelect, subtitle, disabled }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Choose a service type</DialogTitle>
          <DialogDescription>
            {subtitle || 'Each service is bid with its own estimating engine.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {SERVICE_TYPES.map(s => {
            const Icon = ICONS[s.value];
            return (
              <button
                key={s.value}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(s.value)}
                className="flex items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors hover:bg-muted/60 disabled:opacity-60"
              >
                <span className="mt-0.5 rounded-md bg-muted p-2">
                  <Icon className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{s.label}</span>
                  <span className="block text-xs text-muted-foreground">{s.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ServiceTypePicker;
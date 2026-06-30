import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Calendar, DollarSign } from 'lucide-react';
import {
  DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import type { CrmDeal, CrmStage } from './types';

interface Props {
  stages: CrmStage[];
  deals: CrmDeal[];
  onChanged: () => void;
  onDealClick: (deal: CrmDeal) => void;
  onNewDeal: () => void;
}

function DealCard({ deal, onClick }: { deal: CrmDeal; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1 } : undefined;
  const daysInStage = differenceInDays(new Date(), new Date(deal.updated_at));
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-grab active:cursor-grabbing hover:shadow-md transition"
    >
      <CardContent className="p-3 space-y-1.5">
        <p className="font-medium text-sm leading-tight">{deal.name}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {deal.value ? <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{Number(deal.value).toLocaleString()}</span> : null}
          {deal.expected_close_date && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(deal.expected_close_date), 'MMM d')}</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">{daysInStage}d in stage</p>
      </CardContent>
    </Card>
  );
}

function StageColumn({ stage, deals, onDealClick }: { stage: CrmStage; deals: CrmDeal[]; onDealClick: (d: CrmDeal) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const total = deals.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-muted/30 min-w-[260px] max-w-[280px] flex-1 transition ${isOver ? 'ring-2 ring-primary/50' : ''}`}
    >
      <div className="p-3 border-b flex items-center justify-between" style={{ borderTopColor: stage.color, borderTopWidth: 3 }}>
        <div>
          <p className="font-semibold text-sm">{stage.name}</p>
          <p className="text-xs text-muted-foreground">{deals.length} · ${total.toLocaleString()}</p>
        </div>
      </div>
      <div className="p-2 space-y-2 flex-1 min-h-[100px] overflow-y-auto max-h-[70vh]">
        {deals.map(d => <DealCard key={d.id} deal={d} onClick={() => onDealClick(d)} />)}
      </div>
    </div>
  );
}

export function PipelineBoard({ stages, deals, onChanged, onDealClick, onNewDeal }: Props) {
  const { toast } = useToast();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const byStage = useMemo(() => {
    const map = new Map<string, CrmDeal[]>();
    stages.forEach(s => map.set(s.id, []));
    deals.forEach(d => {
      if (!map.has(d.stage_id)) map.set(d.stage_id, []);
      map.get(d.stage_id)!.push(d);
    });
    return map;
  }, [stages, deals]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const dealId = e.active.id as string;
    const newStageId = e.over?.id as string | undefined;
    if (!newStageId) return;
    const deal = deals.find(d => d.id === dealId);
    if (!deal || deal.stage_id === newStageId) return;
    const stage = stages.find(s => s.id === newStageId);
    const patch: any = { stage_id: newStageId };
    if (stage?.is_won) patch.won_at = new Date().toISOString();
    if (stage?.is_lost) patch.lost_at = new Date().toISOString();
    const { error } = await (supabase as any).from('crm_deals').update(patch).eq('id', dealId);
    if (error) {
      toast({ title: 'Failed to move deal', description: error.message, variant: 'destructive' });
    } else {
      onChanged();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={onNewDeal}><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
      </div>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {stages.map(stage => (
            <StageColumn
              key={stage.id}
              stage={stage}
              deals={byStage.get(stage.id) || []}
              onDealClick={onDealClick}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LeadDialog } from '@/components/crm/LeadDialog';
import type { CrmLead, CrmStage } from '@/components/crm/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the opportunity the estimate should be attached to. */
  onSelect: (lead: CrmLead) => void;
}

/**
 * Every estimate must belong to a CRM opportunity. This picker lists active
 * opportunities and reuses the existing CRM opportunity creation flow so we
 * never duplicate account/contact records.
 */
export function OpportunityPicker({ open, onOpenChange, onSelect }: Props) {
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: leadData }, { data: stageData }] = await Promise.all([
      (supabase as any).from('crm_leads').select('*').order('updated_at', { ascending: false }).limit(200),
      (supabase as any).from('crm_pipeline_stages').select('*').order('sort_order'),
    ]);
    setLeads(leadData || []);
    setStages(stageData || []);
    setLoading(false);
  };

  useEffect(() => { if (open) load(); }, [open]);

  const active = useMemo(() => {
    const lostStages = new Set(stages.filter(s => s.is_lost).map(s => s.id));
    const q = search.trim().toLowerCase();
    return leads
      .filter(l => !(l.stage_id && lostStages.has(l.stage_id)))
      .filter(l => !q || `${l.company_name} ${l.contact_name ?? ''}`.toLowerCase().includes(q))
      .slice(0, 50);
  }, [leads, stages, search]);

  return (
    <>
      <Dialog open={open && !creating} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select an opportunity</DialogTitle>
            <DialogDescription>
              Every estimate is attached to a CRM opportunity so pricing stays with the deal.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search opportunities…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-[45vh] overflow-y-auto -mx-1 px-1 space-y-1">
            {loading ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
            ) : active.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No active opportunities found.</p>
            ) : (
              active.map(l => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => { onSelect(l); onOpenChange(false); }}
                  className="w-full text-left rounded-md border border-border px-3 py-2 hover:bg-muted/60 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="font-medium truncate">{l.company_name}</span>
                  </div>
                  {l.contact_name && (
                    <span className="text-xs text-muted-foreground pl-6">{l.contact_name}</span>
                  )}
                </button>
              ))
            )}
          </div>

          <Button variant="outline" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1" /> New opportunity
          </Button>
        </DialogContent>
      </Dialog>

      {creating && (
        <LeadDialog
          open
          onOpenChange={o => { if (!o) setCreating(false); }}
          onSaved={async () => {
            setCreating(false);
            const { data } = await (supabase as any)
              .from('crm_leads')
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1);
            if (data?.[0]) { onSelect(data[0]); onOpenChange(false); }
            else load();
          }}
        />
      )}
    </>
  );
}

export default OpportunityPicker;

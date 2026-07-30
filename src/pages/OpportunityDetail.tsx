import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LeadDialog } from '@/components/crm/LeadDialog';
import type { CrmLead } from '@/components/crm/types';
import { SEO } from '@/components/SEO';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('crm_leads').select('*').eq('id', id).maybeSingle();
    setLead(data || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={lead ? `${lead.company_name} | Opportunity` : 'Opportunity'}
        description="View and manage opportunity details, notes, files, and activity."
      />
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Opportunities
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !lead ? (
          <p className="text-sm text-muted-foreground">Opportunity not found.</p>
        ) : (
          <LeadDialog asPage lead={lead} onSaved={load} />
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { LinkedEstimates } from '@/components/estimator/LinkedEstimates';
import type { CrmLead } from '@/components/crm/types';
import { SEO } from '@/components/SEO';

export default function OpportunityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [lead, setLead] = useState<CrmLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('crm_leads').select('*').eq('id', id).maybeSingle();
    setLead(data || null);
    setLoading(false);
    if (data?.company_id) {
      setAccountId(data.company_id);
      const { data: co } = await (supabase as any)
        .from('crm_companies')
        .select('name')
        .eq('id', data.company_id)
        .maybeSingle();
      setAccountName(co?.name || data.company_name || null);
    } else if (data?.company_name) {
      const { data: co } = await (supabase as any)
        .from('crm_companies')
        .select('id, name')
        .ilike('name', data.company_name)
        .maybeSingle();
      setAccountId(co?.id || null);
      setAccountName(co?.name || data.company_name);
    } else {
      setAccountId(null);
      setAccountName(null);
    }
  };

  useEffect(() => { load(); }, [id]);

  // Browser back stays natural; a deep-linked/refreshed page falls back to the CRM.
  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={lead ? `${lead.company_name} | Opportunity` : 'Opportunity'}
        description="View and manage opportunity details, notes, files, and activity."
        path={`/crm/opportunities/${id ?? ''}`}
      />
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Opportunities
        </Button>
        {accountName && (
          <div className="text-sm text-muted-foreground">
            Account:{' '}
            {accountId ? (
              <button
                type="button"
                onClick={() => navigate(`/crm/accounts/${accountId}`)}
                className="font-medium text-primary hover:underline"
              >
                {accountName}
              </button>
            ) : (
              <span className="font-medium text-foreground">{accountName}</span>
            )}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !lead ? (
          <p className="text-sm text-muted-foreground">Opportunity not found.</p>
        ) : (
          <>
            <LinkedEstimates
                leadId={lead.id}
                companyName={accountName || lead.company_name}
                companyId={lead.company_id}
                contactId={lead.primary_contact_id}
            />
            <LeadDialog asPage lead={lead} onSaved={load} />
          </>
        )}
      </div>
    </div>
  );
}

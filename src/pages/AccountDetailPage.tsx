import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { CompanyDetailDialog } from '@/components/crm/CompanyDetailDialog';
import type { CrmCompany } from '@/components/crm/types';
import { SEO } from '@/components/SEO';

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CrmCompany | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('crm_companies').select('*').eq('id', id).maybeSingle();
    setCompany(data || null);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={company ? `${company.name} | Account` : 'Account'}
        description="View account details, contacts, and related opportunities."
        path={`/crm/accounts/${id ?? ''}`}
      />
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !company ? (
          <p className="text-sm text-muted-foreground">Account not found.</p>
        ) : (
          <CompanyDetailDialog
            company={company}
            open
            onOpenChange={(open) => { if (!open) goBack(); }}
            onChanged={load}
          />
        )}
      </div>
    </div>
  );
}

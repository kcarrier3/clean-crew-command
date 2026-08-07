import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Phone, Star, Plus, ChevronRight, ChevronDown, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { RelatedNotesFiles } from '@/components/crm/RelatedNotesFiles';
import { LeadDialog } from '@/components/crm/LeadDialog';
import { LEAD_STATUS_LABELS, type CrmCompany, type CrmContact, type CrmLead } from '@/components/crm/types';
import { SEO } from '@/components/SEO';

const STATUS_COLORS: Record<CrmLead['status'], string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  unqualified: 'bg-gray-200 text-gray-700',
  converted: 'bg-purple-100 text-purple-800',
};

function HeaderField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-[130px]">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <div className="text-sm text-foreground">{children || <span className="text-muted-foreground">—</span>}</div>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="border-b border-border py-2.5 flex items-start justify-between gap-3 group">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="text-sm break-words">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
      <Pencil className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0 mt-4" />
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 bg-muted px-3 py-2 text-sm font-medium rounded-sm"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="grid md:grid-cols-2 gap-x-8 px-1 pt-2">{children}</div>}
    </div>
  );
}

export default function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [company, setCompany] = useState<CrmCompany | null>(null);
  const [ownerName, setOwnerName] = useState<string>('');
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('crm_companies').select('*').eq('id', id).maybeSingle();
    setCompany(data || null);
    if (data) {
      const [{ data: cs }, { data: byId }, { data: byName }] = await Promise.all([
        (supabase as any).from('crm_contacts').select('*').eq('company_id', data.id).order('is_primary', { ascending: false }).order('last_name'),
        (supabase as any).from('crm_leads').select('*').eq('company_id', data.id).order('created_at', { ascending: false }),
        (supabase as any).from('crm_leads').select('*').is('company_id', null).ilike('company_name', String(data.name).replace(/[%_]/g, '')).order('created_at', { ascending: false }),
      ]);
      setContacts(cs || []);
      const seen = new Set<string>();
      setLeads([...(byId || []), ...(byName || [])].filter((l: any) => (seen.has(l.id) ? false : (seen.add(l.id), true))));
      if (data.owner_id) {
        const { data: p } = await (supabase as any).from('profiles').select('first_name,last_name').eq('id', data.owner_id).maybeSingle();
        setOwnerName(p ? [p.first_name, p.last_name].filter(Boolean).join(' ') : '');
      } else setOwnerName('');
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const billing = [company?.address, [company?.city, company?.state].filter(Boolean).join(', '), company?.zip].filter(Boolean);

  return (
    <div className="min-h-screen bg-muted/40">
      <SEO
        title={company ? `${company.name} | Account` : 'Account'}
        description="View account details, contacts, and related opportunities."
        path={`/crm/accounts/${id ?? ''}`}
      />
      <div className="max-w-6xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !company ? (
          <p className="text-sm text-muted-foreground">Account not found.</p>
        ) : (
          <>
            {/* Salesforce-style highlights panel */}
            <div className="bg-card rounded-md border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-muted/60 border-b">
                <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground leading-none">Account</p>
                  <h1 className="text-xl font-semibold leading-tight">{company.name}</h1>
                </div>
              </div>
              <div className="flex flex-wrap gap-x-10 gap-y-3 px-4 py-3">
                <HeaderField label="Type">Customer</HeaderField>
                <HeaderField label="Phone">
                  {company.phone && <a className="text-primary hover:underline" href={`tel:${company.phone}`}>{company.phone}</a>}
                </HeaderField>
                <HeaderField label="Website">
                  {company.website && (
                    <a className="text-primary hover:underline" href={company.website.startsWith('http') ? company.website : `https://${company.website}`} target="_blank" rel="noreferrer">
                      {company.website}
                    </a>
                  )}
                </HeaderField>
                <HeaderField label="Account Owner">{ownerName}</HeaderField>
                <HeaderField label="Industry">{company.industry}</HeaderField>
                <HeaderField label="Billing Address">
                  {billing.length > 0 && billing.map((l, i) => <div key={i}>{l}</div>)}
                </HeaderField>
              </div>
            </div>

            <div className="bg-card rounded-md border p-4">
              <Tabs defaultValue="details">
                <TabsList className="bg-transparent border-b rounded-none w-full justify-start p-0 h-auto gap-6">
                  {[
                    ['details', 'Details'],
                    ['contacts', `Contacts (${contacts.length})`],
                    ['opportunities', `Opportunities (${leads.length})`],
                    ['notes', 'Notes & Files'],
                  ].map(([v, label]) => (
                    <TabsTrigger
                      key={v}
                      value={v}
                      className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:shadow-none data-[state=active]:bg-transparent px-0 pb-2"
                    >
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>

                <TabsContent value="details" className="pt-4">
                  <div className="grid md:grid-cols-2 gap-x-8">
                    <DetailField label="Account Owner" value={ownerName} />
                    <DetailField label="Phone" value={company.phone} />
                    <DetailField label="Account Name" value={company.name} />
                    <DetailField label="Industry" value={company.industry} />
                    <DetailField label="Website" value={company.website} />
                    <DetailField label="Type" value="Customer" />
                  </div>
                  <Section title="Address Information">
                    <DetailField label="Street" value={company.address} />
                    <DetailField label="City" value={company.city} />
                    <DetailField label="State" value={company.state} />
                    <DetailField label="Zip" value={company.zip} />
                  </Section>
                  <Section title="Additional Information">
                    <DetailField label="Notes" value={company.notes} />
                  </Section>
                  <Section title="System Information" defaultOpen>
                    <DetailField label="Created" value={new Date(company.created_at).toLocaleString()} />
                    <DetailField label="Last Modified" value={new Date(company.updated_at).toLocaleString()} />
                  </Section>
                </TabsContent>

                <TabsContent value="contacts" className="pt-4">
                  {contacts.length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No contacts linked to this account yet.</CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {contacts.map(c => (
                        <Card key={c.id}>
                          <CardContent className="p-3">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{c.first_name} {c.last_name}</p>
                              {c.is_primary && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-500" />}
                              {c.title && <span className="text-xs text-muted-foreground">— {c.title}</span>}
                            </div>
                            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                              {c.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>}
                              {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="opportunities" className="pt-4">
                  <div className="flex justify-end mb-2">
                    <Button size="sm" onClick={() => setLeadDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1.5" /> New Opportunity
                    </Button>
                  </div>
                  {leads.length === 0 ? (
                    <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No opportunities for this account yet.</CardContent></Card>
                  ) : (
                    <div className="space-y-2">
                      {leads.map(lead => (
                        <Card key={lead.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => navigate(`/crm/opportunities/${lead.id}`)}>
                          <CardContent className="p-3 flex flex-wrap items-center gap-3 justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">{lead.name || `${lead.company_name} opportunity`}</p>
                                <Badge className={STATUS_COLORS[lead.status] + ' text-xs'}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                                {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
                              </div>
                              {lead.contact_name && <p className="text-xs text-muted-foreground">{lead.contact_name}</p>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="notes" className="pt-4">
                  <RelatedNotesFiles parentType="account" parentId={company.id} />
                </TabsContent>
              </Tabs>
            </div>

            <LeadDialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen} lead={null} onSaved={load} />
          </>
        )}
      </div>
    </div>
  );
}

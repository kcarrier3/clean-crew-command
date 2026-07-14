import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Star, Plus, ArrowRight, Pencil, Globe, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { LeadDialog } from './LeadDialog';
import { LEAD_STATUS_LABELS, type CrmCompany, type CrmContact, type CrmLead, type CrmStage } from './types';

const STATUS_COLORS: Record<CrmLead['status'], string> = {
  new: 'bg-blue-100 text-blue-800',
  contacted: 'bg-yellow-100 text-yellow-800',
  qualified: 'bg-green-100 text-green-800',
  unqualified: 'bg-gray-200 text-gray-700',
  converted: 'bg-purple-100 text-purple-800',
};

interface Props {
  company: CrmCompany | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

export function CompanyDetailDialog({ company, open, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadEditing, setLeadEditing] = useState<CrmLead | null>(null);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);

  const load = async () => {
    if (!company) return;
    setLoading(true);
    const [{ data: cs }, { data: ls }, { data: st }] = await Promise.all([
      (supabase as any).from('crm_contacts').select('*').eq('company_id', company.id).order('is_primary', { ascending: false }).order('last_name'),
      (supabase as any).from('crm_leads')
        .select('*')
        .or(`company_id.eq.${company.id},company_name.ilike.${company.name.replace(/[%_]/g, '')}`)
        .order('created_at', { ascending: false }),
      (supabase as any).from('crm_pipeline_stages').select('*').eq('active', true).order('sort_order'),
    ]);
    setContacts(cs || []);
    setLeads(ls || []);
    setStages(st || []);
    setLoading(false);
  };

  useEffect(() => { if (open && company) load(); }, [open, company?.id]);

  const newOpportunity = () => {
    setLeadEditing(null);
    setLeadDialogOpen(true);
  };

  const convertToDeal = async (lead: CrmLead) => {
    const firstStage = stages.find(s => !s.is_won && !s.is_lost) || stages[0];
    if (!firstStage) { toast({ title: 'No pipeline stages configured', variant: 'destructive' }); return; }
    const { error } = await (supabase as any).from('crm_deals').insert({
      name: `${lead.company_name} opportunity`,
      lead_id: lead.id,
      stage_id: firstStage.id,
      company_id: company?.id || null,
      owner_id: user?.id,
      created_by: user?.id,
    });
    if (error) { toast({ title: 'Failed to create deal', description: error.message, variant: 'destructive' }); return; }
    await (supabase as any).from('crm_leads').update({ status: 'converted' }).eq('id', lead.id);
    toast({ title: 'Deal created from opportunity' });
    load(); onChanged?.();
  };

  if (!company) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-xl">{company.name}</DialogTitle>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              {company.industry && <span>{company.industry}</span>}
              {company.website && <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{company.website}</span>}
              {company.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{company.phone}</span>}
              {(company.city || company.state) && (
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{[company.city, company.state].filter(Boolean).join(', ')}</span>
              )}
            </div>
          </DialogHeader>

          <Tabs defaultValue="contacts" className="flex-1 overflow-hidden flex flex-col">
            <TabsList>
              <TabsTrigger value="contacts">Contacts ({contacts.length})</TabsTrigger>
              <TabsTrigger value="opportunities">Opportunities ({leads.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="contacts" className="mt-3 overflow-y-auto flex-1">
              {loading ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Loading…</p>
              ) : contacts.length === 0 ? (
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

            <TabsContent value="opportunities" className="mt-3 overflow-y-auto flex-1">
              <div className="flex justify-end mb-2">
                <Button size="sm" onClick={newOpportunity}>
                  <Plus className="h-4 w-4 mr-1.5" /> New Opportunity
                </Button>
              </div>
              {loading ? (
                <p className="text-muted-foreground text-sm py-6 text-center">Loading…</p>
              ) : leads.length === 0 ? (
                <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">No opportunities for this account yet.</CardContent></Card>
              ) : (
                <div className="space-y-2">
                  {leads.map(lead => (
                    <Card key={lead.id}>
                      <CardContent className="p-3 flex flex-wrap items-center gap-3 justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{lead.company_name}</p>
                            <Badge className={STATUS_COLORS[lead.status] + ' text-xs'}>{LEAD_STATUS_LABELS[lead.status]}</Badge>
                            {lead.source && <Badge variant="outline" className="text-xs">{lead.source}</Badge>}
                          </div>
                          {lead.contact_name && <p className="text-xs text-muted-foreground">{lead.contact_name}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setLeadEditing(lead); setLeadDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {lead.status !== 'converted' && (
                            <Button size="sm" variant="outline" onClick={() => convertToDeal(lead)}>
                              Convert <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <LeadDialog
        open={leadDialogOpen}
        onOpenChange={setLeadDialogOpen}
        lead={leadEditing}
        onSaved={() => { load(); onChanged?.(); }}
      />
    </>
  );
}
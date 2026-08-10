import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, Star, Building2, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RelatedNotesFiles } from '@/components/crm/RelatedNotesFiles';
import type { CrmContact, CrmLead } from '@/components/crm/types';
import { SEO } from '@/components/SEO';

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contact, setContact] = useState<CrmContact | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from('crm_contacts').select('*').eq('id', id).maybeSingle();
    setContact(data || null);
    setLoading(false);
    if (data?.company_id) {
      const [{ data: co }, { data: ls }] = await Promise.all([
        (supabase as any).from('crm_companies').select('name').eq('id', data.company_id).maybeSingle(),
        (supabase as any).from('crm_leads').select('*').eq('company_id', data.company_id).order('updated_at', { ascending: false }),
      ]);
      setAccountName(co?.name || null);
      setLeads(ls || []);
    } else {
      setAccountName(null); setLeads([]);
    }
  };
  useEffect(() => { load(); }, [id]);

  const openEdit = () => {
    if (!contact) return;
    setForm({
      first_name: contact.first_name, last_name: contact.last_name || '', title: contact.title || '',
      email: contact.email || '', phone: contact.phone || '', notes: contact.notes || '',
    });
    setEditOpen(true);
  };

  const save = async () => {
    if (!contact) return;
    if (!form.first_name?.trim()) { toast({ title: 'First name required', variant: 'destructive' }); return; }
    setSaving(true);
    const { error } = await (supabase as any).from('crm_contacts').update({
      first_name: form.first_name.trim(),
      last_name: form.last_name || null,
      title: form.title || null,
      email: form.email || null,
      phone: form.phone || null,
      notes: form.notes || null,
    }).eq('id', contact.id);
    setSaving(false);
    if (error) { toast({ title: 'Save failed', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Contact updated' });
    setEditOpen(false); load();
  };

  const goBack = () => { if (window.history.length > 1) navigate(-1); else navigate('/'); };
  const fullName = contact ? `${contact.first_name} ${contact.last_name || ''}`.trim() : '';

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={fullName ? `${fullName} | Contact` : 'Contact'}
        description="View and manage contact details, notes, files, and related opportunities."
        path={`/crm/contacts/${id ?? ''}`}
      />
      <div className="max-w-5xl mx-auto p-4 space-y-4">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back
        </Button>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !contact ? (
          <p className="text-sm text-muted-foreground">Contact not found.</p>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="min-w-0">
                  <CardTitle className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-xl font-semibold">{fullName}</h1>
                    {contact.is_primary && <Badge variant="secondary" className="text-xs"><Star className="h-3 w-3 mr-1" />Primary</Badge>}
                  </CardTitle>
                  {contact.title && <p className="text-sm text-muted-foreground mt-1">{contact.title}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-4 w-4 mr-1.5" /> Edit</Button>
              </CardHeader>
              <CardContent className="grid gap-2 sm:grid-cols-2 text-sm">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-primary hover:underline break-all">
                    <Mail className="h-4 w-4 shrink-0" />{contact.email}
                  </a>
                )}
                {contact.phone && (
                  <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-primary hover:underline">
                    <Phone className="h-4 w-4 shrink-0" />{contact.phone}
                  </a>
                )}
                {contact.company_id && accountName && (
                  <button
                    type="button"
                    onClick={() => navigate(`/crm/accounts/${contact.company_id}`)}
                    className="flex items-center gap-2 text-primary hover:underline text-left"
                  >
                    <Building2 className="h-4 w-4 shrink-0" />{accountName}
                  </button>
                )}
                {contact.notes && <p className="sm:col-span-2 text-muted-foreground whitespace-pre-wrap">{contact.notes}</p>}
              </CardContent>
            </Card>

            {leads.length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Opportunities at {accountName}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {leads.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => navigate(`/crm/opportunities/${l.id}`)}
                      className="w-full text-left rounded-md border p-2 hover:bg-accent/50 transition-colors"
                    >
                      <p className="text-sm font-medium">{l.name || l.company_name}</p>
                      {l.amount ? <p className="text-xs text-muted-foreground">${Number(l.amount).toLocaleString()}</p> : null}
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="pt-4">
                <RelatedNotesFiles parentType="contact" parentId={contact.id} />
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name *</Label><Input value={form.first_name || ''} onChange={e => setForm({ ...form, first_name: e.target.value })} /></div>
              <div><Label>Last Name</Label><Input value={form.last_name || ''} onChange={e => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div><Label>Title</Label><Input value={form.title || ''} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Email</Label><Input type="email" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea rows={3} value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
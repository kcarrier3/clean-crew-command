import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Plus, Edit2, Trash2, Phone, Mail, User, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';

interface AccountContact {
  id: string;
  job_site_id: string;
  first_name: string;
  last_name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
  notes: string | null;
}

interface AccountContactsProps {
  jobSiteId: string;
}

const emptyForm = {
  first_name: '',
  last_name: '',
  title: '',
  phone: '',
  email: '',
  is_primary: false,
  notes: '',
};

export const AccountContacts = ({ jobSiteId }: AccountContactsProps) => {
  const [contacts, setContacts] = useState<AccountContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<AccountContact | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const { isManager } = useAuth();

  useEffect(() => {
    fetchContacts();
  }, [jobSiteId]);

  const fetchContacts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('account_contacts')
      .select('*')
      .eq('job_site_id', jobSiteId)
      .order('is_primary', { ascending: false })
      .order('last_name');

    if (!error) setContacts(data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setEditingContact(null);
    setForm({ ...emptyForm, is_primary: contacts.length === 0 });
    setDialogOpen(true);
  };

  const openEdit = (contact: AccountContact) => {
    setEditingContact(contact);
    setForm({
      first_name: contact.first_name,
      last_name: contact.last_name,
      title: contact.title || '',
      phone: contact.phone || '',
      email: contact.email || '',
      is_primary: contact.is_primary,
      notes: contact.notes || '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      toast({ title: 'Error', description: 'First and last name are required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        job_site_id: jobSiteId,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        title: form.title.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        is_primary: form.is_primary,
        notes: form.notes.trim() || null,
      };

      if (editingContact) {
        const { error } = await supabase
          .from('account_contacts')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', editingContact.id);
        if (error) throw error;
        toast({ title: 'Contact updated' });
      } else {
        const { error } = await supabase.from('account_contacts').insert(payload);
        if (error) throw error;
        toast({ title: 'Contact added' });
      }

      setDialogOpen(false);
      fetchContacts();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save contact', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (contact: AccountContact) => {
    const { error } = await supabase.from('account_contacts').delete().eq('id', contact.id);
    if (error) {
      toast({ title: 'Error', description: 'Failed to delete contact', variant: 'destructive' });
    } else {
      toast({ title: 'Contact removed' });
      fetchContacts();
    }
  };

  const setPrimary = async (contact: AccountContact) => {
    const { error } = await supabase
      .from('account_contacts')
      .update({ is_primary: true, updated_at: new Date().toISOString() })
      .eq('id', contact.id);
    if (!error) fetchContacts();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Contacts</h4>
        {isManager() && (
          <Button variant="outline" size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Add Contact
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading contacts...</p>
      ) : contacts.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No contacts added yet.</p>
      ) : (
        <div className="space-y-2">
          {contacts.map(contact => (
            <Card key={contact.id} className="border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">
                        {contact.first_name} {contact.last_name}
                      </span>
                      {contact.is_primary && (
                        <Badge className="bg-orange-100 text-orange-800 text-xs flex items-center gap-1">
                          <Star className="h-2.5 w-2.5" />
                          Primary
                        </Badge>
                      )}
                      {contact.title && (
                        <span className="text-xs text-muted-foreground">{contact.title}</span>
                      )}
                    </div>
                    <div className="flex gap-3 flex-wrap">
                      {contact.phone && (
                        <a
                          href={`tel:${contact.phone}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Phone className="h-3 w-3" />
                          {contact.phone}
                        </a>
                      )}
                      {contact.email && (
                        <a
                          href={`mailto:${contact.email}`}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                        >
                          <Mail className="h-3 w-3" />
                          {contact.email}
                        </a>
                      )}
                    </div>
                    {contact.notes && (
                      <p className="text-xs text-muted-foreground italic">{contact.notes}</p>
                    )}
                  </div>

                  {isManager() && (
                    <div className="flex gap-1 flex-shrink-0">
                      {!contact.is_primary && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          title="Set as primary"
                          onClick={() => setPrimary(contact)}
                        >
                          <Star className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(contact)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove Contact</AlertDialogTitle>
                            <AlertDialogDescription>
                              Remove {contact.first_name} {contact.last_name} from this account?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(contact)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>First Name *</Label>
                <Input
                  value={form.first_name}
                  onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                  placeholder="First name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Last Name *</Label>
                <Input
                  value={form.last_name}
                  onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                  placeholder="Last name"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Title / Role</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Facilities Manager, Billing Contact"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="Phone number"
                  type="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="Email address"
                  type="email"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes about this contact..."
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_primary}
                onCheckedChange={v => setForm(f => ({ ...f, is_primary: v }))}
              />
              <Label>Primary contact for this account</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : editingContact ? 'Save Changes' : 'Add Contact'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

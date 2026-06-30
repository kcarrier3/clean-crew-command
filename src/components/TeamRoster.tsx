import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, UserPlus, Mail, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { JOB_TITLES, getJobTitleColor } from '@/lib/jobTitles';

interface RosterMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  employee_id: string | null;
  active: boolean | null;
}

type Filter = 'active' | 'inactive';

const TeamRoster = () => {
  const { canManageEmployees } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
  });

  const fetchMembers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles_directory')
      .select('id, first_name, last_name, email, phone, job_title, employee_id, active')
      .order('last_name', { ascending: true });
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setMembers([]);
    } else {
      setMembers((data ?? []) as RosterMember[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members
      .filter((m) => (filter === 'active' ? m.active !== false : m.active === false))
      .filter((m) => {
        if (!q) return true;
        const name = `${m.first_name ?? ''} ${m.last_name ?? ''}`.toLowerCase();
        return (
          name.includes(q) ||
          (m.email ?? '').toLowerCase().includes(q) ||
          (m.job_title ?? '').toLowerCase().includes(q) ||
          (m.employee_id ?? '').toLowerCase().includes(q)
        );
      });
  }, [members, filter, search]);

  const resetForm = () =>
    setForm({ first_name: '', last_name: '', email: '', phone: '', job_title: '' });

  const handleInvite = async () => {
    if (!form.first_name || !form.last_name || !form.email || !form.job_title) {
      toast({
        title: 'Missing info',
        description: 'First name, last name, email, and job title are required.',
        variant: 'destructive',
      });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: form.email,
          firstName: form.first_name,
          lastName: form.last_name,
          phone: form.phone,
          jobTitle: form.job_title,
          payType: 'hourly',
        },
      });
      if (error) throw error;
      toast({ title: 'Invitation sent', description: `${form.first_name} ${form.last_name} was invited.` });
      setAddOpen(false);
      resetForm();
      fetchMembers();
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to send invite.', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Team</h2>
          <p className="text-sm text-muted-foreground">
            {filter === 'active' ? 'Active roster' : 'Inactive employees'} · {filtered.length}{' '}
            {filtered.length === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup
            type="single"
            value={filter}
            onValueChange={(v) => v && setFilter(v as Filter)}
            variant="outline"
            size="sm"
          >
            <ToggleGroupItem value="active">Active</ToggleGroupItem>
            <ToggleGroupItem value="inactive">Inactive</ToggleGroupItem>
          </ToggleGroup>
          {canManageEmployees() && (
            <Button onClick={() => setAddOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Add Team Member
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading team...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No {filter} team members found.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {m.first_name} {m.last_name}
                    </div>
                    {m.job_title && (
                      <Badge variant="secondary" className={`mt-1 ${getJobTitleColor(m.job_title)}`}>
                        {m.job_title}
                      </Badge>
                    )}
                  </div>
                  {m.active === false && <Badge variant="outline">Inactive</Badge>}
                </div>
                {m.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="truncate">{m.email}</span>
                  </div>
                )}
                {m.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" />
                    <span>{m.phone}</span>
                  </div>
                )}
                {m.employee_id && (
                  <div className="text-xs text-muted-foreground">ID: {m.employee_id}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" /> Add Team Member
            </DialogTitle>
            <DialogDescription>
              Send an invitation email so they can finish setting up their account.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="tr-first">First name *</Label>
                <Input id="tr-first" value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="tr-last">Last name *</Label>
                <Input id="tr-last" value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="tr-email">Email *</Label>
              <Input id="tr-email" type="email" value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tr-phone">Phone</Label>
              <Input id="tr-phone" value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tr-job">Job title *</Label>
              <Select value={form.job_title} onValueChange={(v) => setForm({ ...form, job_title: v })}>
                <SelectTrigger id="tr-job"><SelectValue placeholder="Select a job title" /></SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Invite'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamRoster;
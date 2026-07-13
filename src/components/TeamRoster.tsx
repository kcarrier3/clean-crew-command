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
import { Plus, Search, UserPlus, Mail, Phone, Shield, Trash2, Send, KeyRound, Link2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { JOB_TITLES, getJobTitleColor, JOB_TITLE_PERMISSIONS, type JobTitle } from '@/lib/jobTitles';

const ALL_PERMISSIONS: { key: string; label: string; category: string }[] = [
  { key: 'view_schedules', label: 'View Schedules', category: 'Scheduling' },
  { key: 'edit_schedules', label: 'Edit Schedules', category: 'Scheduling' },
  { key: 'view_time_tracking', label: 'View Time Tracking', category: 'Time' },
  { key: 'edit_time_tracking', label: 'Edit Time Tracking', category: 'Time' },
  { key: 'view_work_orders', label: 'View Work Orders', category: 'Work Orders' },
  { key: 'create_work_orders', label: 'Create Work Orders', category: 'Work Orders' },
  { key: 'edit_work_orders', label: 'Edit Work Orders', category: 'Work Orders' },
  { key: 'view_quality_control', label: 'View Quality Control', category: 'Quality Control' },
  { key: 'edit_quality_control', label: 'Edit Quality Control', category: 'Quality Control' },
  { key: 'view_worker_status', label: 'View Worker Status', category: 'Team' },
  { key: 'manage_employees', label: 'Manage Employees', category: 'Team' },
  { key: 'view_notifications', label: 'View Notifications', category: 'System' },
  { key: 'admin_settings', label: 'Admin Settings', category: 'System' },
];

const jobTitleToAccessLevel = (jt: string): 'admin' | 'manager' | 'employee' => {
  if (jt === 'Owner' || jt === 'Administrator') return 'admin';
  if (['Janitorial Manager', 'Project Crew Lead', 'Supervisor'].includes(jt)) return 'manager';
  return 'employee';
};

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

interface JobSiteOption {
  id: string;
  name: string;
}

type Filter = 'active' | 'inactive';

const TeamRoster = () => {
  const { canManageEmployees, isManager, isCrmUser, hasRole } = useAuth();
  const canManage = canManageEmployees() || isManager() || isCrmUser() || hasRole('admin');
  const { toast } = useToast();
  const [members, setMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('active');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editMember, setEditMember] = useState<RosterMember | null>(null);
  const [editForm, setEditForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    job_title: '', employee_id: '', active: true,
    address_line1: '', address_line2: '', city: '', state: '', postal_code: '',
    emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
    pay_type: 'hourly', hourly_rate: '', salary_amount: '',
    attendance_incentive_enrolled: false,
    attendance_bonus_amount: '', time_bonus_amount: '',
  });
  const [editAccessLevel, setEditAccessLevel] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [initialAccessLevel, setInitialAccessLevel] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [editLoading, setEditLoading] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RosterMember | null>(null);
  const [resending, setResending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [sendingLink, setSendingLink] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    job_title: '',
  });
  const [addAccessLevel, setAddAccessLevel] = useState<'admin' | 'manager' | 'employee'>('employee');
  const [addPermissions, setAddPermissions] = useState<string[]>([]);
  const [addCustomizedPerms, setAddCustomizedPerms] = useState(false);
  const [jobSiteOptions, setJobSiteOptions] = useState<JobSiteOption[]>([]);
  const [addAccountIds, setAddAccountIds] = useState<string[]>([]);

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

  useEffect(() => {
    supabase
      .from('job_sites')
      .select('id, name')
      .eq('active', true)
      .order('name', { ascending: true })
      .then(({ data }) => setJobSiteOptions((data ?? []) as JobSiteOption[]));
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

  const resetForm = () => {
    setForm({ first_name: '', last_name: '', email: '', phone: '', job_title: '' });
    setAddAccessLevel('employee');
    setAddPermissions([]);
    setAddCustomizedPerms(false);
    setAddAccountIds([]);
  };

  const applyJobTitleDefaults = (jt: string) => {
    setForm((f) => ({ ...f, job_title: jt }));
    setAddAccessLevel(jobTitleToAccessLevel(jt));
    if (!addCustomizedPerms) {
      const defaults = (JOB_TITLE_PERMISSIONS as Record<string, string[]>)[jt] ?? [];
      setAddPermissions(defaults);
    }
  };

  const togglePermission = (key: string) => {
    setAddCustomizedPerms(true);
    setAddPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

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
      const { data, error } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: form.email,
          firstName: form.first_name,
          lastName: form.last_name,
          phone: form.phone,
          jobTitle: form.job_title,
          payType: 'hourly',
        },
      });
      if (error) {
        // Try to extract the actual error message from the response body
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);

      // Apply custom access level + permissions (override edge function defaults)
      const userId = data?.userId;
      if (userId) {
        // Reset roles
        await supabase.from('user_roles').delete().eq('user_id', userId);
        const rolesToInsert: { user_id: string; role: 'admin' | 'manager' | 'employee' }[] = [
          { user_id: userId, role: 'employee' },
        ];
        if (addAccessLevel === 'manager') rolesToInsert.push({ user_id: userId, role: 'manager' });
        if (addAccessLevel === 'admin') {
          rolesToInsert.push({ user_id: userId, role: 'manager' });
          rolesToInsert.push({ user_id: userId, role: 'admin' });
        }
        await supabase.from('user_roles').upsert(rolesToInsert, { onConflict: 'user_id,role' });

        // Reset permissions to the selected set
        await supabase.from('user_permissions').delete().eq('user_id', userId);
        if (addPermissions.length > 0) {
          await supabase.from('user_permissions').insert(
            addPermissions.map((p) => ({ user_id: userId, permission: p as any }))
          );
        }

        // Save account assignments (informational — does not affect access)
        if (addAccountIds.length > 0) {
          await supabase.from('employee_accounts').insert(
            addAccountIds.map((jobSiteId) => ({
              employee_id: userId,
              job_site_id: jobSiteId,
              assigned_by: user?.id ?? null,
            }))
          );
        }
      }

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

  const openEdit = (m: RosterMember) => {
    if (!canManage) return;
    setEditMember(m);
    setEditLoading(true);
    Promise.all([
      supabase.from('profiles').select('*').eq('id', m.id).maybeSingle(),
      supabase.from('user_roles').select('role').eq('user_id', m.id),
    ]).then(([profileRes, rolesRes]) => {
      setEditLoading(false);
      const { data, error } = profileRes;
      if (error || !data) {
          toast({ title: 'Error', description: error?.message ?? 'Could not load profile', variant: 'destructive' });
          return;
        }
        const p: any = data;
        setEditForm({
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
          job_title: p.job_title ?? '',
          employee_id: p.employee_id ?? '',
          active: p.active !== false,
          address_line1: p.address_line1 ?? '',
          address_line2: p.address_line2 ?? '',
          city: p.city ?? '',
          state: p.state ?? '',
          postal_code: p.postal_code ?? '',
          emergency_contact_name: p.emergency_contact_name ?? '',
          emergency_contact_phone: p.emergency_contact_phone ?? '',
          emergency_contact_relationship: p.emergency_contact_relationship ?? '',
          pay_type: p.pay_type ?? 'hourly',
          hourly_rate: p.hourly_rate != null ? String(p.hourly_rate) : '',
          salary_amount: p.salary_amount != null ? String(p.salary_amount) : '',
          attendance_incentive_enrolled: !!p.attendance_incentive_enrolled,
          attendance_bonus_amount: p.attendance_bonus_amount != null ? String(p.attendance_bonus_amount) : '',
          time_bonus_amount: p.time_bonus_amount != null ? String(p.time_bonus_amount) : '',
        });
      const roleRows = (rolesRes.data ?? []) as { role: 'admin' | 'manager' | 'employee' }[];
      const highest: 'admin' | 'manager' | 'employee' =
        roleRows.some(r => r.role === 'admin') ? 'admin'
        : roleRows.some(r => r.role === 'manager') ? 'manager'
        : 'employee';
      setEditAccessLevel(highest);
      setInitialAccessLevel(highest);
    });
  };

  const handleSaveEdit = async () => {
    if (!editMember) return;
    setSavingEdit(true);
    const num = (v: string) => (v.trim() === '' ? null : Number(v));
    const { error } = await supabase
      .from('profiles')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        phone: editForm.phone || null,
        email: editForm.email || null,
        job_title: editForm.job_title || null,
        employee_id: editForm.employee_id || null,
        active: editForm.active,
        address_line1: editForm.address_line1 || null,
        address_line2: editForm.address_line2 || null,
        city: editForm.city || null,
        state: editForm.state || null,
        postal_code: editForm.postal_code || null,
        emergency_contact_name: editForm.emergency_contact_name || null,
        emergency_contact_phone: editForm.emergency_contact_phone || null,
        emergency_contact_relationship: editForm.emergency_contact_relationship || null,
        pay_type: editForm.pay_type,
        hourly_rate: num(editForm.hourly_rate),
        salary_amount: num(editForm.salary_amount),
        attendance_incentive_enrolled: editForm.attendance_incentive_enrolled,
        attendance_bonus_amount: num(editForm.attendance_bonus_amount),
        time_bonus_amount: num(editForm.time_bonus_amount),
      })
      .eq('id', editMember.id);
    if (error) {
      setSavingEdit(false);
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      return;
    }
    // Persist access level if it changed
    if (editAccessLevel !== initialAccessLevel) {
      if (editMember.job_title === 'Owner' && editAccessLevel !== 'admin') {
        setSavingEdit(false);
        toast({ title: 'Blocked', description: 'The Owner account must remain an Admin.', variant: 'destructive' });
        return;
      }
      const { error: delErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', editMember.id);
      if (delErr) {
        setSavingEdit(false);
        toast({ title: 'Error', description: `Could not update access level: ${delErr.message}`, variant: 'destructive' });
        return;
      }
      const { error: insErr } = await supabase
        .from('user_roles')
        .insert({ user_id: editMember.id, role: editAccessLevel });
      if (insErr) {
        setSavingEdit(false);
        toast({ title: 'Error', description: `Could not set new access level: ${insErr.message}`, variant: 'destructive' });
        return;
      }
    }
    setSavingEdit(false);
    toast({ title: 'Saved', description: 'Team member updated.' });
    setEditMember(null);
    fetchMembers();
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { error } = await supabase.from('profiles').delete().eq('id', confirmDelete.id);
    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Deleted', description: 'Team member removed.' });
      fetchMembers();
    }
    setConfirmDelete(null);
  };

  const handleResendInvite = async () => {
    if (!editMember) return;
    setResending(true);
    try {
      const { data, error } = await supabase.functions.invoke('invite-employee', {
        body: {
          email: editForm.email,
          firstName: editForm.first_name,
          lastName: editForm.last_name,
          phone: editForm.phone,
          jobTitle: editForm.job_title,
          payType: editForm.pay_type,
          resend: true,
        },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Invitation resent', description: `A new invite email was sent to ${editForm.email}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to resend invite.', variant: 'destructive' });
    } finally {
      setResending(false);
    }
  };

  const handleSetPassword = async () => {
    if (!editMember) return;
    if (newPassword.length < 8) {
      toast({ title: 'Password too short', description: 'Must be at least 8 characters.', variant: 'destructive' });
      return;
    }
    setSettingPassword(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: editMember.id, mode: 'set', newPassword },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Password updated', description: 'Share the new password with the worker securely.' });
      setNewPassword('');
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to set password.', variant: 'destructive' });
    } finally {
      setSettingPassword(false);
    }
  };

  const handleSendResetLink = async () => {
    if (!editMember) return;
    setSendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-reset-password', {
        body: { userId: editMember.id, mode: 'link' },
      });
      if (error) {
        let detail = error.message;
        try {
          const body = await (error as any).context?.json?.();
          if (body?.error) detail = body.error;
        } catch { /* ignore */ }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      toast({ title: 'Reset link sent', description: `A password reset email was sent to ${editForm.email}.` });
    } catch (err: any) {
      toast({ title: 'Error', description: err?.message ?? 'Failed to send reset link.', variant: 'destructive' });
    } finally {
      setSendingLink(false);
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
          {canManage && (
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
            <Card
              key={m.id}
              className={canManage ? 'cursor-pointer hover:border-primary/50 transition-colors' : ''}
              onClick={() => openEdit(m)}
            >
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
                  <div className="flex items-center gap-1">
                    {m.job_title === 'Owner' && (
                      <Badge variant="default" className="gap-1"><Shield className="h-3 w-3" /> Owner</Badge>
                    )}
                    {m.active === false && <Badge variant="outline">Inactive</Badge>}
                  </div>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <Select value={form.job_title} onValueChange={applyJobTitleDefaults}>
                <SelectTrigger id="tr-job"><SelectValue placeholder="Select a job title" /></SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="tr-access">Access level *</Label>
              <Select
                value={addAccessLevel}
                onValueChange={(v) => setAddAccessLevel(v as 'admin' | 'manager' | 'employee')}
              >
                <SelectTrigger id="tr-access"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — full access to everything</SelectItem>
                  <SelectItem value="manager">Manager — team and operations access</SelectItem>
                  <SelectItem value="employee">Employee — standard worker access</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Defaults from job title. Change to grant more or less system-wide access.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Visible tabs & permissions</Label>
                {form.job_title && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAddCustomizedPerms(false);
                      setAddPermissions(
                        (JOB_TITLE_PERMISSIONS as Record<string, string[]>)[form.job_title] ?? []
                      );
                    }}
                  >
                    Reset to job title defaults
                  </Button>
                )}
              </div>
              <div className="border rounded-md p-3 space-y-3 max-h-60 overflow-y-auto">
                {Array.from(new Set(ALL_PERMISSIONS.map((p) => p.category))).map((cat) => (
                  <div key={cat}>
                    <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                      {cat}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {ALL_PERMISSIONS.filter((p) => p.category === cat).map((p) => (
                        <label
                          key={p.key}
                          className="flex items-center gap-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={addPermissions.includes(p.key)}
                            onCheckedChange={() => togglePermission(p.key)}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
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

      <Dialog open={!!editMember} onOpenChange={(o) => !o && setEditMember(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
            <DialogDescription>
              {editMember?.job_title === 'Owner'
                ? 'Owner accounts are protected and cannot be deactivated or deleted.'
                : 'Update profile details, activate/deactivate, or remove this team member.'}
            </DialogDescription>
          </DialogHeader>
          {editLoading ? (
            <p className="text-sm text-muted-foreground py-6">Loading profile…</p>
          ) : (
          <div className="grid gap-6">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Name & Contact</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-first">First name</Label>
                <Input id="ed-first" value={editForm.first_name}
                  onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ed-last">Last name</Label>
                <Input id="ed-last" value={editForm.last_name}
                  onChange={(e) => setEditForm({ ...editForm, last_name: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ed-email">Email</Label>
                <Input id="ed-email" type="email" value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ed-phone">Phone</Label>
                <Input id="ed-phone" value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
              </div>
            </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Address</h3>
              <div>
                <Label htmlFor="ed-addr1">Street address</Label>
                <Input id="ed-addr1" value={editForm.address_line1}
                  onChange={(e) => setEditForm({ ...editForm, address_line1: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="ed-addr2">Apt / Suite</Label>
                <Input id="ed-addr2" value={editForm.address_line2}
                  onChange={(e) => setEditForm({ ...editForm, address_line2: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Label htmlFor="ed-city">City</Label>
                  <Input id="ed-city" value={editForm.city}
                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ed-state">State</Label>
                  <Input id="ed-state" value={editForm.state}
                    onChange={(e) => setEditForm({ ...editForm, state: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ed-zip">Zip</Label>
                  <Input id="ed-zip" value={editForm.postal_code}
                    onChange={(e) => setEditForm({ ...editForm, postal_code: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Emergency Contact</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ed-ec-name">Name</Label>
                  <Input id="ed-ec-name" value={editForm.emergency_contact_name}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_name: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="ed-ec-rel">Relationship</Label>
                  <Input id="ed-ec-rel" value={editForm.emergency_contact_relationship}
                    onChange={(e) => setEditForm({ ...editForm, emergency_contact_relationship: e.target.value })} />
                </div>
              </div>
              <div>
                <Label htmlFor="ed-ec-phone">Phone</Label>
                <Input id="ed-ec-phone" value={editForm.emergency_contact_phone}
                  onChange={(e) => setEditForm({ ...editForm, emergency_contact_phone: e.target.value })} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Role</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ed-emp">Employee ID</Label>
                  <Input id="ed-emp" value={editForm.employee_id}
                    onChange={(e) => setEditForm({ ...editForm, employee_id: e.target.value })} />
                </div>
                <div>
              <Label htmlFor="ed-job">Job title</Label>
              <Select
                value={editForm.job_title}
                onValueChange={(v) => setEditForm({ ...editForm, job_title: v })}
                disabled={editMember?.job_title === 'Owner'}
              >
                <SelectTrigger id="ed-job"><SelectValue placeholder="Select a job title" /></SelectTrigger>
                <SelectContent>
                  {JOB_TITLES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="ed-access">Access level</Label>
                <Select
                  value={editAccessLevel}
                  onValueChange={(v) => setEditAccessLevel(v as 'admin' | 'manager' | 'employee')}
                  disabled={editMember?.job_title === 'Owner' || !hasRole('admin')}
                >
                  <SelectTrigger id="ed-access"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin — full access to everything</SelectItem>
                    <SelectItem value="manager">Manager — team and operations access</SelectItem>
                    <SelectItem value="employee">Employee — standard worker access</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Overrides the default permissions tied to the job title. Only admins can change this.
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Pay & Incentives</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="ed-paytype">Pay type</Label>
                  <Select value={editForm.pay_type} onValueChange={(v) => setEditForm({ ...editForm, pay_type: v })}>
                    <SelectTrigger id="ed-paytype"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="salary">Salary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editForm.pay_type === 'hourly' ? (
                  <div>
                    <Label htmlFor="ed-rate">Hourly rate ($)</Label>
                    <Input id="ed-rate" type="number" step="0.01" min="0" value={editForm.hourly_rate}
                      onChange={(e) => setEditForm({ ...editForm, hourly_rate: e.target.value })} />
                  </div>
                ) : (
                  <div>
                    <Label htmlFor="ed-sal">Salary ($/yr)</Label>
                    <Input id="ed-sal" type="number" step="0.01" min="0" value={editForm.salary_amount}
                      onChange={(e) => setEditForm({ ...editForm, salary_amount: e.target.value })} />
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Receiving attendance incentive</div>
                  <div className="text-xs text-muted-foreground">
                    Auto-tabulated on the first full paycheck of each month based on the attendance rules.
                  </div>
                </div>
                <Switch
                  checked={editForm.attendance_incentive_enrolled}
                  onCheckedChange={(c) => setEditForm({ ...editForm, attendance_incentive_enrolled: c })}
                />
              </div>
              {editForm.attendance_incentive_enrolled && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="ed-att">Attendance bonus ($)</Label>
                    <Input id="ed-att" type="number" step="0.01" min="0" value={editForm.attendance_bonus_amount}
                      onChange={(e) => setEditForm({ ...editForm, attendance_bonus_amount: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="ed-time">Time bonus ($) — construction only</Label>
                    <Input id="ed-time" type="number" step="0.01" min="0" value={editForm.time_bonus_amount}
                      onChange={(e) => setEditForm({ ...editForm, time_bonus_amount: e.target.value })} />
                  </div>
                </div>
              )}
            </section>

            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">Inactive employees are hidden from the active roster.</div>
              </div>
              <Switch
                checked={editForm.active}
                onCheckedChange={(c) => setEditForm({ ...editForm, active: c })}
                disabled={editMember?.job_title === 'Owner'}
              />
            </div>

            <section className="space-y-3 rounded-md border p-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2">
                <KeyRound className="h-4 w-4" /> Password
              </h3>
              <p className="text-xs text-muted-foreground">
                Set a new password directly, or email the worker a reset link.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="text"
                  placeholder="New password (min 8 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
                <Button
                  variant="secondary"
                  onClick={handleSetPassword}
                  disabled={settingPassword || !newPassword}
                >
                  {settingPassword ? 'Setting...' : 'Set password'}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={handleSendResetLink}
                disabled={sendingLink || !editForm.email}
                className="w-full sm:w-auto"
              >
                <Link2 className="h-4 w-4 mr-1" />
                {sendingLink ? 'Sending...' : 'Send password reset link'}
              </Button>
            </section>
          </div>
          )}
          <DialogFooter className="flex sm:justify-between gap-2">
            <Button
              variant="destructive"
              onClick={() => editMember && setConfirmDelete(editMember)}
              disabled={editMember?.job_title === 'Owner' || savingEdit}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleResendInvite}
                disabled={resending || savingEdit || editLoading || !editForm.email}
                title="Send a new invitation email"
              >
                <Send className="h-4 w-4 mr-1" /> {resending ? 'Sending...' : 'Resend invite'}
              </Button>
              <Button variant="outline" onClick={() => setEditMember(null)} disabled={savingEdit}>Cancel</Button>
              <Button onClick={handleSaveEdit} disabled={savingEdit || editLoading}>
                {savingEdit ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete team member?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes {confirmDelete?.first_name} {confirmDelete?.last_name} from the roster. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamRoster;
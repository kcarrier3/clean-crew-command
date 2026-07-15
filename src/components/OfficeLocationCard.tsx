import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Building2, Edit2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface OfficeSite {
  id: string;
  name: string;
  address: string | null;
}

/**
 * Manages the single internal "office" location used by fixed-expense staff
 * (floaters, supply, night manager, office manager, etc.) for punch-in.
 * Owner/Admin only.
 */
export default function OfficeLocationCard() {
  const { toast } = useToast();
  const [office, setOffice] = useState<OfficeSite | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Office');
  const [address, setAddress] = useState('');

  const fetchOffice = async () => {
    const { data, error } = await supabase
      .from('job_sites')
      .select('id, name, address')
      .eq('is_office', true)
      .maybeSingle();
    if (!error) setOffice(data ?? null);
  };

  useEffect(() => {
    fetchOffice();
  }, []);

  const openDialog = () => {
    setName(office?.name || 'Office');
    setAddress(office?.address || '');
    setOpen(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast({ title: 'Name required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      if (office) {
        const { error } = await supabase
          .from('job_sites')
          .update({ name: name.trim(), address: address.trim() || null })
          .eq('id', office.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('job_sites').insert({
          name: name.trim(),
          address: address.trim() || null,
          client_name: 'Internal',
          is_office: true,
          active: true,
          is_recurring_monthly: false,
        });
        if (error) throw error;
      }
      toast({ title: 'Saved', description: 'Office location updated' });
      setOpen(false);
      fetchOffice();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2 className="h-4 w-4" />
          Office Location (Internal)
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="text-sm">
          {office ? (
            <>
              <div className="font-medium">{office.name}</div>
              <div className="text-muted-foreground">
                {office.address || 'No address set'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                Used by floaters, supply staff, night manager, and office staff for punch-in. Not a customer account.
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">
              No office location set. Fixed-expense staff need this to punch in without a customer account.
            </div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" onClick={openDialog}>
              {office ? (
                <>
                  <Edit2 className="h-4 w-4 mr-1" /> Edit
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" /> Set office
                </>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{office ? 'Edit office location' : 'Set office location'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label htmlFor="office-name">Name</Label>
                <Input id="office-name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="office-address">Address</Label>
                <Input
                  id="office-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, ST"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancel
              </Button>
              <Button onClick={save} disabled={loading}>
                {loading ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
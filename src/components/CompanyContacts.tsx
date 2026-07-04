import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Mail, Phone, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CompanyContact {
  id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  display_order: number;
}

export default function CompanyContacts() {
  const { toast } = useToast();
  const [items, setItems] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('company_contacts')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true });
    if (error) {
      toast({ title: 'Failed to load contacts', description: error.message, variant: 'destructive' });
    } else {
      setItems(data || []);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Contacts</h2>
        <p className="text-sm text-muted-foreground">Quick access directory of your managers and points of contact.</p>
      </div>

      {loading ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Loading…</CardContent></Card>
      ) : items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">
          No contacts have been added yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {items.map(c => (
            <Card key={c.id}>
              <CardContent className="p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <p className="font-medium truncate">{c.name}</p>
                  </div>
                  {c.title && <p className="text-xs text-muted-foreground mt-0.5 ml-6">{c.title}</p>}
                  <div className="mt-2 ml-6 space-y-1">
                    {c.phone && (
                      <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-sm text-primary hover:underline">
                        <Phone className="h-3.5 w-3.5" />{c.phone}
                      </a>
                    )}
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-sm text-primary hover:underline break-all">
                        <Mail className="h-3.5 w-3.5 shrink-0" />{c.email}
                      </a>
                    )}
                    {c.notes && <p className="text-xs text-muted-foreground mt-1">{c.notes}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
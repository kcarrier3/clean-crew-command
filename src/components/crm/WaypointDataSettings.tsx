import { useState } from 'react';
import { FileArchive, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { SalesforceImportDialog } from './SalesforceImportDialog';

export default function WaypointDataSettings() {
  const { toast } = useToast();
  const [importOpen, setImportOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetting, setResetting] = useState(false);

  const resetCrm = async () => {
    setResetting(true);
    const tables = [
      'crm_quote_signatures',
      'crm_quote_items',
      'crm_quotes',
      'crm_invoice_items',
      'crm_invoices',
      'crm_meetings',
      'crm_tasks',
      'crm_activities',
      'crm_email_logs',
      'crm_lead_submission_log',
      'crm_deals',
      'crm_leads',
      'crm_contacts',
      'crm_companies',
    ];
    const errors: string[] = [];
    for (const t of tables) {
      const { error } = await (supabase as any).from(t).delete().not('id', 'is', null);
      if (error) errors.push(`${t}: ${error.message}`);
    }
    setResetting(false);
    setResetOpen(false);
    setResetConfirm('');
    if (errors.length) {
      toast({ title: 'Reset finished with errors', description: errors.join(' | '), variant: 'destructive' });
    } else {
      toast({ title: 'Waypoint reset', description: 'All Waypoint records were removed.' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Waypoint data</CardTitle>
        <CardDescription>Import CRM records or clear all Waypoint data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <FileArchive className="h-4 w-4 mr-2" /> Import from Salesforce
        </Button>
        <div>
          <Button
            variant="outline"
            className="text-destructive hover:text-destructive"
            onClick={() => setResetOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" /> Reset Waypoint
          </Button>
        </div>

        <SalesforceImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={() => {}} />

        <AlertDialog open={resetOpen} onOpenChange={(o) => { if (!resetting) { setResetOpen(o); if (!o) setResetConfirm(''); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">Reset Waypoint data?</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    This permanently deletes <strong>all</strong> accounts, contacts, opportunities, deals, quotes,
                    invoices, meetings, tasks, activities, and email logs. Pipeline stages and services are kept.
                  </p>
                  <p>This cannot be undone. Type <strong>RESET</strong> below to confirm.</p>
                  <Input value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="Type RESET" autoFocus />
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={resetting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={resetConfirm !== 'RESET' || resetting}
                onClick={(e) => { e.preventDefault(); resetCrm(); }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {resetting ? 'Resetting…' : 'Reset everything'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import {
  CheckCircle2, Clock, AlertCircle, Users, FileText, Eye, XCircle, Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface EmployeeOnboardingStatus {
  id: string;
  first_name: string;
  last_name: string;
  job_title: string | null;
  completed: number;
  required: number;
  total: number;
}

interface SubmissionDetail {
  id: string;
  status: string;
  form_data: any;
  signature_data: string | null;
  signature_typed: string | null;
  submitted_at: string | null;
  rejection_reason: string | null;
  onboarding_documents: {
    title: string;
    document_type: string;
    is_required: boolean;
  };
}

export const OnboardingManager = () => {
  const [employees, setEmployees] = useState<EmployeeOnboardingStatus[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeOnboardingStatus | null>(null);
  const [employeeSubmissions, setEmployeeSubmissions] = useState<SubmissionDetail[]>([]);
  const [viewingSubmission, setViewingSubmission] = useState<SubmissionDetail | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchOverview();
  }, []);

  const fetchOverview = async () => {
    setLoading(true);
    const [profilesResult, docsResult, subsResult] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, job_title').order('last_name'),
      supabase.from('onboarding_documents').select('id, is_required').eq('active', true),
      supabase.from('employee_document_submissions').select('employee_id, document_id, status'),
    ]);

    const docs = docsResult.data || [];
    const subs = subsResult.data || [];
    const profiles = profilesResult.data || [];
    const requiredCount = docs.filter((d: any) => d.is_required).length;
    const totalCount = docs.length;

    const employeeStatuses: EmployeeOnboardingStatus[] = profiles.map((p: any) => {
      const empSubs = subs.filter((s: any) => s.employee_id === p.id && s.status === 'completed');
      const empRequiredSubs = empSubs.filter((s: any) => {
        const doc = docs.find((d: any) => d.id === s.document_id);
        return doc?.is_required;
      });
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        job_title: p.job_title,
        completed: empSubs.length,
        required: requiredCount,
        total: totalCount,
        completedRequired: empRequiredSubs.length,
      } as any;
    });

    setEmployees(employeeStatuses);
    setDocuments(docs);
    setLoading(false);
  };

  const fetchEmployeeSubmissions = async (employeeId: string) => {
    const { data } = await supabase
      .from('employee_document_submissions')
      .select(`
        id, status, form_data, signature_data, signature_typed,
        submitted_at, rejection_reason,
        onboarding_documents(title, document_type, is_required)
      `)
      .eq('employee_id', employeeId)
      .order('submitted_at', { ascending: false });
    setEmployeeSubmissions((data || []) as unknown as SubmissionDetail[]);
  };

  const openEmployee = async (emp: EmployeeOnboardingStatus) => {
    setSelectedEmployee(emp);
    await fetchEmployeeSubmissions(emp.id);
  };

  const handleReject = async (submissionId: string) => {
    if (!rejectReason.trim()) {
      toast({ title: 'Reason required', description: 'Please provide a rejection reason.', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('employee_document_submissions')
      .update({ status: 'rejected', rejection_reason: rejectReason, updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to reject document', variant: 'destructive' });
    } else {
      toast({ title: 'Document rejected', description: 'Employee will be notified to resubmit.' });
      setViewingSubmission(null);
      setRejectReason('');
      if (selectedEmployee) fetchEmployeeSubmissions(selectedEmployee.id);
      fetchOverview();
    }
  };

  const handleApprove = async (submissionId: string) => {
    const { error } = await supabase
      .from('employee_document_submissions')
      .update({ status: 'completed', rejection_reason: null, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq('id', submissionId);

    if (!error) {
      toast({ title: 'Document approved' });
      setViewingSubmission(null);
      if (selectedEmployee) fetchEmployeeSubmissions(selectedEmployee.id);
      fetchOverview();
    }
  };

  const filteredEmployees = employees.filter(e =>
    `${e.first_name} ${e.last_name}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCompletionColor = (emp: any) => {
    if (emp.completedRequired === emp.required) return 'text-green-600';
    if (emp.completedRequired > 0) return 'text-yellow-600';
    return 'text-red-500';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Employee detail view
  if (selectedEmployee) {
    const allDocs = documents;
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedEmployee(null)}>
            ← Back
          </Button>
          <div>
            <h3 className="font-bold">{selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
            {selectedEmployee.job_title && (
              <p className="text-xs text-muted-foreground">{selectedEmployee.job_title}</p>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {employeeSubmissions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No documents submitted yet.</p>
              </CardContent>
            </Card>
          ) : (
            employeeSubmissions.map(sub => (
              <Card key={sub.id} className="cursor-pointer hover:shadow-sm" onClick={() => setViewingSubmission(sub)}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {sub.status === 'completed'
                      ? <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                      : sub.status === 'rejected'
                      ? <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      : <Clock className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                    }
                    <div className="flex-1">
                      <p className="text-sm font-medium">{sub.onboarding_documents?.title}</p>
                      {sub.submitted_at && (
                        <p className="text-xs text-muted-foreground">
                          Submitted {format(new Date(sub.submitted_at), 'MMM d, yyyy h:mm a')}
                        </p>
                      )}
                      {sub.rejection_reason && (
                        <p className="text-xs text-red-600">Rejected: {sub.rejection_reason}</p>
                      )}
                    </div>
                    <Badge
                      className={sub.status === 'completed' ? 'bg-green-100 text-green-800 text-xs' : sub.status === 'rejected' ? 'bg-red-100 text-red-800 text-xs' : 'bg-yellow-100 text-yellow-800 text-xs'}
                    >
                      {sub.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Submission Detail Dialog */}
        <Dialog open={!!viewingSubmission} onOpenChange={(open) => !open && setViewingSubmission(null)}>
          <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{viewingSubmission?.onboarding_documents?.title}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {viewingSubmission?.signature_data && (
                <div>
                  <Label className="text-xs text-muted-foreground">Signature</Label>
                  <img
                    src={viewingSubmission.signature_data}
                    alt="Employee signature"
                    className="border rounded-md bg-white max-h-24 mt-1"
                  />
                </div>
              )}
              {viewingSubmission?.signature_typed && (
                <div>
                  <Label className="text-xs text-muted-foreground">Typed Signature</Label>
                  <p className="font-serif text-lg border-b border-gray-400 pb-1 mt-1">
                    {viewingSubmission.signature_typed}
                  </p>
                </div>
              )}
              {viewingSubmission?.form_data && (
                <div>
                  <Label className="text-xs text-muted-foreground">Form Data</Label>
                  <div className="bg-gray-50 rounded-md p-3 text-xs space-y-1 mt-1 max-h-48 overflow-y-auto">
                    {Object.entries(viewingSubmission.form_data).map(([key, val]) => (
                      val && (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium capitalize text-gray-600 min-w-0 flex-shrink-0">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="text-gray-800 break-all">
                            {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : String(val)}
                          </span>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}
              {viewingSubmission?.status === 'completed' && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Rejection Reason (if rejecting)</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Explain why this document needs to be resubmitted..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
            <DialogFooter className="pt-2 border-t gap-2">
              <Button variant="outline" onClick={() => setViewingSubmission(null)}>Close</Button>
              {viewingSubmission?.status === 'completed' && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleReject(viewingSubmission.id)}
                  disabled={!rejectReason.trim()}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1.5" />
                  Reject
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Overview
  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Onboarding Status</h3>
          <p className="text-sm text-muted-foreground">
            {employees.filter((e: any) => e.completedRequired === e.required).length} of {employees.length} employees fully onboarded
          </p>
        </div>
      </div>

      <Input
        placeholder="Search employees..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="max-w-xs"
      />

      <div className="space-y-2">
        {filteredEmployees.map((emp: any) => {
          const pct = emp.required > 0 ? Math.round((emp.completedRequired / emp.required) * 100) : 0;
          return (
            <Card
              key={emp.id}
              className="cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => openEmployee(emp)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{emp.first_name} {emp.last_name}</p>
                      <span className={`text-xs font-bold ${getCompletionColor(emp)}`}>
                        {emp.completedRequired}/{emp.required} required
                      </span>
                    </div>
                    {emp.job_title && (
                      <p className="text-xs text-muted-foreground">{emp.job_title}</p>
                    )}
                    <Progress value={pct} className="h-1 mt-1.5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

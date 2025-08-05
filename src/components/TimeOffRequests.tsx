import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar, Clock, Plus, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

interface TimeOffRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  status: 'pending' | 'approved' | 'declined';
  requested_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  manager_notes: string | null;
  employees: Employee;
  reviewer?: Employee;
}

interface TimeOffRequestsProps {
  isManager?: boolean;
  currentEmployeeId?: string;
}

const TimeOffRequests = ({ isManager = false, currentEmployeeId }: TimeOffRequestsProps) => {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    employee_id: currentEmployeeId || '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchRequests();
    if (isManager) {
      fetchEmployees();
    }
  }, [isManager, currentEmployeeId]);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('time_off_requests')
        .select(`
          *,
          employees!time_off_requests_employee_id_fkey (
            id,
            employee_id,
            first_name,
            last_name,
            job_title
          )
        `)
        .order('requested_at', { ascending: false });

      // If not manager, only show current employee's requests
      if (!isManager && currentEmployeeId) {
        query = query.eq('employee_id', currentEmployeeId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setRequests((data as any) || []);
    } catch (error) {
      console.error('Error fetching time off requests:', error);
      toast({
        title: "Error",
        description: "Failed to load time off requests",
        variant: "destructive",
      });
    }
  };

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('active', true)
        .order('first_name');

      if (error) throw error;
      setEmployees(data || []);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off request submitted successfully",
      });

      setIsDialogOpen(false);
      setFormData({
        employee_id: currentEmployeeId || '',
        start_date: '',
        end_date: '',
        reason: ''
      });
      
      fetchRequests();
    } catch (error) {
      console.error('Error submitting request:', error);
      toast({
        title: "Error",
        description: "Failed to submit time off request",
        variant: "destructive",
      });
    }
  };

  const handleStatusUpdate = async (requestId: string, status: 'approved' | 'declined', managerNotes?: string) => {
    try {
      const { error } = await supabase
        .from('time_off_requests')
        .update({
          status,
          reviewed_at: new Date().toISOString(),
          reviewed_by: currentEmployeeId,
          manager_notes: managerNotes || null
        })
        .eq('id', requestId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Request ${status} successfully`,
      });

      fetchRequests();
    } catch (error) {
      console.error('Error updating request:', error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'declined':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
    switch (status) {
      case 'approved':
        return 'default';
      case 'declined':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Time Off Requests
          </CardTitle>
          {(!isManager || (isManager && currentEmployeeId)) && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Request Time Off
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Submit Time Off Request</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {isManager && (
                    <div>
                      <Label htmlFor="employee_id">Employee</Label>
                      <select
                        id="employee_id"
                        value={formData.employee_id}
                        onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                        className="w-full p-2 border rounded-md"
                        required
                      >
                        <option value="">Select Employee</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.id}>
                            {emp.first_name} {emp.last_name} ({emp.employee_id})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      required
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="reason">Reason (Optional)</Label>
                    <Textarea
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                      placeholder="Enter reason for time off..."
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Submit Request</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {requests.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No time off requests found</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">
                      {request.employees.first_name} {request.employees.last_name}
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      {request.employees.employee_id} • {request.employees.job_title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusIcon(request.status)}
                    <Badge variant={getStatusVariant(request.status)}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <Label className="text-sm font-medium">Start Date</Label>
                    <p className="text-sm">{new Date(request.start_date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">End Date</Label>
                    <p className="text-sm">{new Date(request.end_date).toLocaleDateString()}</p>
                  </div>
                </div>
                
                {request.reason && (
                  <div className="mb-3">
                    <Label className="text-sm font-medium">Reason</Label>
                    <p className="text-sm text-muted-foreground">{request.reason}</p>
                  </div>
                )}
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                  <Clock className="h-3 w-3" />
                  Requested {new Date(request.requested_at).toLocaleString()}
                </div>
                
                {request.manager_notes && (
                  <div className="mb-3">
                    <Label className="text-sm font-medium">Manager Notes</Label>
                    <p className="text-sm text-muted-foreground">{request.manager_notes}</p>
                  </div>
                )}
                
                {isManager && request.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => handleStatusUpdate(request.id, 'approved')}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleStatusUpdate(request.id, 'declined')}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Decline
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TimeOffRequests;
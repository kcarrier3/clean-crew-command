import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Clock, Calendar, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import TimeClock from './TimeClock';
import BudgetReports from './BudgetReports';
import AccountCostReport from './AccountCostReport';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
  active: boolean;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  job_site_id: string;
  clock_in: string;
  clock_out: string | null;
  employees: {
    first_name: string;
    last_name: string;
    employee_id: string;
  };
  job_sites: {
    name: string;
  };
}

const ManagerDashboard = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [todayEntries, setTodayEntries] = useState<TimeEntry[]>([]);
  const { profile, isManager, hasRole } = useAuth();
  const canViewAccountCost =
    hasRole('admin') ||
    profile?.job_title === 'Owner' ||
    profile?.job_title === 'Administrator';
  const { toast } = useToast();

  useEffect(() => {
    if (isManager()) {
      fetchEmployees();
      fetchActiveEntries();
      fetchTodayEntries();
    }
  }, []);

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
      toast({
        title: "Error",
        description: "Failed to load employees",
        variant: "destructive"
      });
    }
  };

  const fetchActiveEntries = async () => {
    try {
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees:employee_id(first_name, last_name, employee_id),
          job_sites:job_site_id(name)
        `)
        .is('clock_out', null)
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setActiveEntries(data || []);
    } catch (error) {
      console.error('Error fetching active entries:', error);
    }
  };

  const fetchTodayEntries = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees:employee_id(first_name, last_name, employee_id),
          job_sites:job_site_id(name)
        `)
        .gte('clock_in', startOfDay)
        .lt('clock_in', endOfDay)
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setTodayEntries(data || []);
    } catch (error) {
      console.error('Error fetching today entries:', error);
    }
  };

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = end.getTime() - start.getTime();
    return (diff / (1000 * 60 * 60)).toFixed(2);
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  if (!isManager()) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground text-center">Access denied. Manager privileges required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">
          Manager Dashboard
        </h2>
        <p className="text-muted-foreground">
          Welcome, {profile?.first_name} {profile?.last_name} • Manage your team's time and schedules
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{employees.length}</p>
                <p className="text-sm text-muted-foreground">Active Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{activeEntries.length}</p>
                <p className="text-sm text-muted-foreground">Currently Clocked In</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{todayEntries.length}</p>
                <p className="text-sm text-muted-foreground">Today's Entries</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="timeclock" className="w-full">
        <TabsList className={`grid w-full ${canViewAccountCost ? 'grid-cols-5' : 'grid-cols-4'}`}>
          <TabsTrigger value="timeclock">Time Clock</TabsTrigger>
          <TabsTrigger value="active">Active Sessions</TabsTrigger>
          <TabsTrigger value="reports">Today's Report</TabsTrigger>
          <TabsTrigger value="budget">Budget Reports</TabsTrigger>
          {canViewAccountCost && <TabsTrigger value="account-cost">Account Cost</TabsTrigger>}
        </TabsList>

        <TabsContent value="timeclock">
          <div className="space-y-6">
            {/* Employee Selection */}
            <Card>
              <CardHeader>
                <CardTitle>Select Employee for Time Clock</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={selectedEmployee?.id || ''} onValueChange={(value) => {
                  const employee = employees.find(emp => emp.id === value);
                  setSelectedEmployee(employee || null);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an employee to manage their time" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        {employee.first_name} {employee.last_name} ({employee.employee_id}) - {employee.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Time Clock Component */}
            <TimeClock 
              forManager={true} 
              selectedEmployeeId={selectedEmployee?.id}
            />
          </div>
        </TabsContent>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Active Time Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {activeEntries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No one is currently clocked in</p>
              ) : (
                <div className="space-y-4">
                  {activeEntries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">
                            {entry.employees.first_name} {entry.employees.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Employee ID: {entry.employees.employee_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Location: {entry.job_sites.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Started: {formatTime(entry.clock_in)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono">
                            {calculateHours(entry.clock_in, null)} hrs
                          </p>
                          <p className="text-sm text-muted-foreground">Active</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Today's Time Report
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todayEntries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No time entries for today</p>
              ) : (
                <div className="space-y-4">
                  {todayEntries.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">
                            {entry.employees.first_name} {entry.employees.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Employee ID: {entry.employees.employee_id}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Location: {entry.job_sites.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {formatTime(entry.clock_in)} - {entry.clock_out ? formatTime(entry.clock_out) : 'Active'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-mono">
                            {calculateHours(entry.clock_in, entry.clock_out)} hrs
                          </p>
                          <p className={`text-sm ${entry.clock_out ? 'text-muted-foreground' : 'text-green-600'}`}>
                            {entry.clock_out ? 'Completed' : 'Active'}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <BudgetReports />
        </TabsContent>

        {canViewAccountCost && (
          <TabsContent value="account-cost">
            <AccountCostReport />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ManagerDashboard;
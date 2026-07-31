import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import TimeClock from './TimeClock';
import BudgetReports from './BudgetReports';
import AccountCostReport from './AccountCostReport';
import ShiftRoster from './ShiftRoster';
import PayPeriodHoursReport from './PayPeriodHoursReport';


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
  const [weekEntries, setWeekEntries] = useState<TimeEntry[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
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
    }
  }, []);

  // Pay period: Sunday -> Saturday
  const getPayPeriod = (offset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { start, end };
  };

  const { start: periodStart, end: periodEnd } = getPayPeriod(weekOffset);

  useEffect(() => {
    if (isManager()) fetchWeekEntries();
  }, [weekOffset]);

  const fetchWeekEntries = async () => {
    try {
      const { start, end } = getPayPeriod(weekOffset);
      const { data, error } = await supabase
        .from('time_entries')
        .select(`
          *,
          employees:employee_id(first_name, last_name, employee_id),
          job_sites:job_site_id(name)
        `)
        .gte('clock_in', start.toISOString())
        .lt('clock_in', end.toISOString())
        .order('clock_in', { ascending: false });

      if (error) throw error;
      setWeekEntries(data || []);
    } catch (error) {
      console.error('Error fetching week entries:', error);
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

  const calculateHours = (clockIn: string, clockOut: string | null) => {
    const start = new Date(clockIn);
    const end = clockOut ? new Date(clockOut) : new Date();
    const diff = end.getTime() - start.getTime();
    return (diff / (1000 * 60 * 60)).toFixed(2);
  };

  const formatDate = (d: Date) => d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const weeklySummary = () => {
    const map = new Map<string, { name: string; employeeId: string; hours: number; shifts: number }>();
    weekEntries.forEach((entry) => {
      const key = entry.employee_id;
      const existing = map.get(key) || {
        name: `${entry.employees?.first_name ?? ''} ${entry.employees?.last_name ?? ''}`.trim(),
        employeeId: entry.employees?.employee_id ?? '',
        hours: 0,
        shifts: 0,
      };
      existing.hours += parseFloat(calculateHours(entry.clock_in, entry.clock_out));
      existing.shifts += 1;
      map.set(key, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  };

  const summary = weeklySummary();
  const totalHours = summary.reduce((sum, s) => sum + s.hours, 0);

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
      {/* Main Content Tabs */}
      <Tabs defaultValue="timeclock" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6 h-auto gap-1">
          <TabsTrigger value="timeclock" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Time Clock</TabsTrigger>
          <TabsTrigger value="active" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Shift Roster</TabsTrigger>
          <TabsTrigger value="reports" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Weekly Report</TabsTrigger>
          <TabsTrigger value="budget" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Budget Reports</TabsTrigger>
          <TabsTrigger value="pay-period" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Pay Period Hours</TabsTrigger>
          {canViewAccountCost && <TabsTrigger value="account-cost" className="text-xs md:text-sm whitespace-normal md:whitespace-nowrap">Account Cost</TabsTrigger>}
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
          <div className="space-y-6">
            <ShiftRoster />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-green-600" />
                  Currently Clocked In ({activeEntries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeEntries.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">No one is currently clocked in.</p>
                ) : (
                  <div className="space-y-2">
                    {activeEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between border rounded-lg p-3 gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">
                            {entry.employees?.first_name} {entry.employees?.last_name}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {entry.job_sites?.name}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-mono">{calculateHours(entry.clock_in, null)} hrs</p>
                          <p className="text-xs text-muted-foreground">since {formatTime(entry.clock_in)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Weekly Report • {formatDate(periodStart)} – {formatDate(new Date(periodEnd.getTime() - 86400000))}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)} disabled={weekOffset === 0}>
                    This Period
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setWeekOffset((o) => o + 1)} disabled={weekOffset >= 0}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {weekEntries.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No time entries for this pay period</p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    {summary.map((s) => (
                      <div key={s.employeeId + s.name} className="flex items-center justify-between border rounded-lg p-4">
                        <div>
                          <h3 className="font-semibold">{s.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {s.employeeId} • {s.shifts} shift{s.shifts === 1 ? '' : 's'}
                          </p>
                        </div>
                        <p className="text-lg font-mono">{s.hours.toFixed(2)} hrs</p>
                      </div>
                    ))}
                    <div className="flex items-center justify-between px-4 pt-2 font-semibold">
                      <span>Total</span>
                      <span className="font-mono">{totalHours.toFixed(2)} hrs</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-semibold text-sm text-muted-foreground">All entries</h4>
                    {weekEntries.map((entry) => (
                      <div key={entry.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-semibold">
                              {entry.employees?.first_name} {entry.employees?.last_name}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(entry.clock_in).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Location: {entry.job_sites?.name}
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
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="budget">
          <BudgetReports />
        </TabsContent>

        <TabsContent value="pay-period">
          <PayPeriodHoursReport />
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
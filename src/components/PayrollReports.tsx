import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar, DollarSign, Clock, Download, FileText, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PayrollEntry {
  employee_id: string;
  employee_name: string;
  job_title: string;
  pay_type: 'hourly' | 'salary';
  hourly_rate: number | null;
  salary_amount: number | null;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  total_pay: number;
  pay_period_start: string;
  pay_period_end: string;
  attendance_bonus: number;
  time_bonus: number;
  attendance_bonus_eligible: boolean;
  time_bonus_eligible: boolean;
  total_with_bonus: number;
}

const PayrollReports = () => {
  const { toast } = useToast();
  const [payrollData, setPayrollData] = useState<PayrollEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPayPeriod, setSelectedPayPeriod] = useState<string>('');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Calculate pay period options (last 8 weeks)
  const getPayPeriods = () => {
    const periods = [];
    const today = new Date();
    
    for (let i = 0; i < 8; i++) {
      // Find the most recent Saturday
      const currentDate = new Date(today);
      currentDate.setDate(today.getDate() - (today.getDay() + 1) % 7 - (i * 7));
      
      // Pay period ends on Saturday
      const endDate = new Date(currentDate);
      // Pay period starts on Sunday (6 days before)
      const startDate = new Date(currentDate);
      startDate.setDate(currentDate.getDate() - 6);
      
      periods.push({
        value: `${startDate.toISOString().split('T')[0]}_${endDate.toISOString().split('T')[0]}`,
        label: `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
    }
    
    return periods;
  };

  useEffect(() => {
    // Set current pay period as default
    const periods = getPayPeriods();
    if (periods.length > 0) {
      setSelectedPayPeriod(periods[0].value);
    }
  }, []);

  const calculatePayroll = async (startDate: string, endDate: string) => {
    setLoading(true);
    try {
      // Fetch all profiles with pay and bonus information
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, job_title, hourly_rate, salary_amount, pay_type, attendance_bonus_amount, time_bonus_amount');

      if (profilesError) throw profilesError;

      // Fetch time entries for the selected period
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('*')
        .gte('clock_in', `${startDate}T00:00:00`)
        .lte('clock_in', `${endDate}T23:59:59`)
        .not('clock_out', 'is', null);

      if (timeEntriesError) throw timeEntriesError;

      // Determine if this is the first full pay period of a new month
      // Pay week is Sun-Sat. First full paycheck of a new month = first pay period
      // that starts on or after the 1st of the month
      const periodStart = new Date(startDate);
      const periodEnd = new Date(endDate);
      const isFirstFullPaycheckOfMonth = periodStart.getDate() <= 7 && periodStart.getMonth() !== new Date(periodStart.getTime() - 7 * 86400000).getMonth();

      // If it's the first full paycheck, we need the previous month's data for bonus eligibility
      let prevMonthStart = '';
      let prevMonthEnd = '';
      let prevMonthSchedules: any[] = [];
      let prevMonthTimeEntries: any[] = [];
      let prevMonthLateNotifications: any[] = [];

      if (isFirstFullPaycheckOfMonth) {
        const prevMonth = new Date(periodStart);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        prevMonthStart = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-01`;
        const lastDay = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
        prevMonthEnd = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

        // Fetch previous month's schedules
        const { data: schedData } = await supabase
          .from('employee_schedules')
          .select('*')
          .eq('active', true)
          .lte('start_date', prevMonthEnd)
          .or(`end_date.is.null,end_date.gte.${prevMonthStart}`);
        prevMonthSchedules = schedData || [];

        // Fetch previous month's time entries
        const { data: teData } = await supabase
          .from('time_entries')
          .select('*')
          .gte('clock_in', `${prevMonthStart}T00:00:00`)
          .lte('clock_in', `${prevMonthEnd}T23:59:59`);
        prevMonthTimeEntries = teData || [];

        // Fetch previous month's late notifications
        const { data: lnData } = await supabase
          .from('late_notifications')
          .select('*')
          .gte('created_at', `${prevMonthStart}T00:00:00`)
          .lte('created_at', `${prevMonthEnd}T23:59:59`);
        prevMonthLateNotifications = lnData || [];
      }

      // Calculate payroll for each employee
      const payrollEntries: PayrollEntry[] = [];

      for (const profile of profiles || []) {
        const employeeTimeEntries = timeEntries?.filter(entry => entry.employee_id === profile.id) || [];
        
        let totalMinutes = 0;
        
        employeeTimeEntries.forEach(entry => {
          if (entry.clock_out) {
            const clockIn = new Date(entry.clock_in);
            const clockOut = new Date(entry.clock_out);
            const minutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
            totalMinutes += minutes - (entry.break_minutes || 0);
          }
        });

        const totalHours = totalMinutes / 60;
        const regularHours = Math.min(totalHours, 40);
        const overtimeHours = Math.max(totalHours - 40, 0);

        let totalPay = 0;
        
        if (profile.pay_type === 'hourly' && profile.hourly_rate) {
          totalPay = (regularHours * profile.hourly_rate) + (overtimeHours * profile.hourly_rate * 1.5);
        } else if (profile.pay_type === 'salary' && profile.salary_amount) {
          totalPay = profile.salary_amount / 52;
        }

        // Bonus calculation
        let attendanceBonus = 0;
        let timeBonus = 0;
        let attendanceBonusEligible = false;
        let timeBonusEligible = false;

        if (isFirstFullPaycheckOfMonth && (profile.attendance_bonus_amount || profile.time_bonus_amount)) {
          // Check attendance eligibility: no missed scheduled days
          const empSchedules = prevMonthSchedules.filter(s => s.employee_id === profile.id);
          
          if (empSchedules.length > 0 && profile.attendance_bonus_amount) {
            // Count scheduled days in the previous month
            let scheduledDays = 0;
            let workedDays = 0;
            const empTimeEntries = prevMonthTimeEntries.filter(te => te.employee_id === profile.id);
            
            // Walk each day of previous month
            const monthStart = new Date(prevMonthStart);
            const monthEnd = new Date(prevMonthEnd);
            for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
              const dayOfWeek = d.getDay();
              const dateStr = d.toISOString().split('T')[0];
              
              // Check if this day was scheduled
              const isScheduled = empSchedules.some(s => {
                const schedStart = new Date(s.start_date);
                const schedEnd = s.end_date ? new Date(s.end_date) : null;
                return s.days_of_week.includes(dayOfWeek) &&
                  schedStart <= d &&
                  (!schedEnd || schedEnd >= d);
              });

              if (isScheduled) {
                scheduledDays++;
                // Check if they clocked in on this day
                const hasEntry = empTimeEntries.some(te => {
                  const clockInDate = new Date(te.clock_in).toISOString().split('T')[0];
                  return clockInDate === dateStr;
                });
                if (hasEntry) workedDays++;
              }
            }

            attendanceBonusEligible = scheduledDays > 0 && workedDays >= scheduledDays;
            if (attendanceBonusEligible) {
              attendanceBonus = profile.attendance_bonus_amount;
            }
          }

          // Check time/punctuality eligibility (construction only): not late >5 min
          if (profile.time_bonus_amount && 
              (profile.job_title === 'Project Worker' || profile.job_title === 'Project Crew Lead')) {
            // Check late notifications for this employee in previous month
            const empLateNotifs = prevMonthLateNotifications.filter(
              ln => ln.employee_id === profile.id && ln.minutes_late > 5
            );

            // Also check time entries vs schedules for lateness >5 min
            const empTimeEntries = prevMonthTimeEntries.filter(te => te.employee_id === profile.id);
            let wasLate = empLateNotifs.length > 0;

            if (!wasLate) {
              // Double-check by comparing clock-in times to schedules
              for (const te of empTimeEntries) {
                const clockIn = new Date(te.clock_in);
                const dayOfWeek = clockIn.getDay();
                const matchingSchedule = empSchedules.find(s => {
                  const schedStart = new Date(s.start_date);
                  const schedEnd = s.end_date ? new Date(s.end_date) : null;
                  return s.days_of_week.includes(dayOfWeek) &&
                    schedStart <= clockIn &&
                    (!schedEnd || schedEnd >= clockIn) &&
                    s.start_time;
                });

                if (matchingSchedule?.start_time) {
                  const [h, m] = matchingSchedule.start_time.split(':').map(Number);
                  const scheduledStart = new Date(clockIn);
                  scheduledStart.setHours(h, m, 0, 0);
                  const minsLate = (clockIn.getTime() - scheduledStart.getTime()) / (1000 * 60);
                  if (minsLate > 5) {
                    wasLate = true;
                    break;
                  }
                }
              }
            }

            timeBonusEligible = !wasLate && empTimeEntries.length > 0;
            if (timeBonusEligible) {
              timeBonus = profile.time_bonus_amount;
            }
          }
        }

        payrollEntries.push({
          employee_id: profile.id,
          employee_name: `${profile.first_name} ${profile.last_name}`,
          job_title: profile.job_title || 'N/A',
          pay_type: (profile.pay_type as 'hourly' | 'salary') || 'hourly',
          hourly_rate: profile.hourly_rate,
          salary_amount: profile.salary_amount,
          total_hours: Number(totalHours.toFixed(2)),
          regular_hours: Number(regularHours.toFixed(2)),
          overtime_hours: Number(overtimeHours.toFixed(2)),
          total_pay: Number(totalPay.toFixed(2)),
          pay_period_start: startDate,
          pay_period_end: endDate,
          attendance_bonus: attendanceBonus,
          time_bonus: timeBonus,
          attendance_bonus_eligible: attendanceBonusEligible,
          time_bonus_eligible: timeBonusEligible,
          total_with_bonus: Number((totalPay + attendanceBonus + timeBonus).toFixed(2)),
        });
      }

      // Filter out employees with no hours worked
      const filteredEntries = payrollEntries.filter(entry => entry.total_hours > 0);
      setPayrollData(filteredEntries);

      if (filteredEntries.length === 0) {
        toast({
          title: "No Data",
          description: "No time entries found for the selected period.",
        });
      }

    } catch (error) {
      console.error('Error calculating payroll:', error);
      toast({
        title: "Error",
        description: "Failed to calculate payroll data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateReport = () => {
    if (selectedPayPeriod) {
      const [startDate, endDate] = selectedPayPeriod.split('_');
      calculatePayroll(startDate, endDate);
    } else if (customStartDate && customEndDate) {
      calculatePayroll(customStartDate, customEndDate);
    } else {
      toast({
        title: "Error",
        description: "Please select a pay period or enter custom dates.",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    if (payrollData.length === 0) {
      toast({
        title: "Error",
        description: "No payroll data to export.",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      'Employee Name',
      'Job Title',
      'Pay Type',
      'Hourly Rate',
      'Salary Amount',
      'Total Hours',
      'Regular Hours',
      'Overtime Hours',
      'Total Pay',
      'Attendance Bonus',
      'Time Bonus',
      'Total With Bonus',
      'Pay Period Start',
      'Pay Period End'
    ];

    const csvContent = [
      headers.join(','),
      ...payrollData.map(entry => [
        `"${entry.employee_name}"`,
        `"${entry.job_title}"`,
        entry.pay_type,
        entry.hourly_rate || '',
        entry.salary_amount || '',
        entry.total_hours,
        entry.regular_hours,
        entry.overtime_hours,
        entry.total_pay,
        entry.attendance_bonus,
        entry.time_bonus,
        entry.total_with_bonus,
        entry.pay_period_start,
        entry.pay_period_end
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-report-${payrollData[0]?.pay_period_start}-${payrollData[0]?.pay_period_end}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Success",
      description: "Payroll report exported successfully.",
    });
  };

  const totalPayroll = payrollData.reduce((sum, entry) => sum + entry.total_with_bonus, 0);
  const totalBonuses = payrollData.reduce((sum, entry) => sum + entry.attendance_bonus + entry.time_bonus, 0);
  const totalHours = payrollData.reduce((sum, entry) => sum + entry.total_hours, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="h-6 w-6" />
        <h1 className="text-3xl font-bold">Payroll Reports</h1>
      </div>

      {/* Report Generation Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Generate Payroll Report
          </CardTitle>
          <CardDescription>
            Select a pay period to generate payroll reports. Pay periods run Sunday to Saturday.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="pay-period">Pay Period</Label>
              <Select value={selectedPayPeriod} onValueChange={setSelectedPayPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select pay period" />
                </SelectTrigger>
                <SelectContent>
                  {getPayPeriods().map(period => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="custom-start">Custom Start Date</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  if (e.target.value) setSelectedPayPeriod('');
                }}
              />
            </div>

            <div>
              <Label htmlFor="custom-end">Custom End Date</Label>
              <Input
                type="date"
                value={customEndDate}
                onChange={(e) => {
                  setCustomEndDate(e.target.value);
                  if (e.target.value) setSelectedPayPeriod('');
                }}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerateReport} disabled={loading}>
              {loading ? 'Generating...' : 'Generate Report'}
            </Button>
            {payrollData.length > 0 && (
              <Button variant="outline" onClick={exportToCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payroll Summary */}
      {payrollData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">${totalPayroll.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Payroll (incl. bonuses)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {totalBonuses > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-8 w-8 text-accent-foreground" />
                  <div>
                    <p className="text-2xl font-bold">${totalBonuses.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total Bonuses</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{totalHours.toFixed(1)}</p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{payrollData.length}</p>
                  <p className="text-sm text-muted-foreground">Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Payroll Table */}
      {payrollData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payroll Details</CardTitle>
            <CardDescription>
              Detailed breakdown of hours and pay for each employee
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Job Title</TableHead>
                  <TableHead>Pay Type</TableHead>
                  <TableHead>Rate/Salary</TableHead>
                  <TableHead>Regular Hrs</TableHead>
                  <TableHead>OT Hrs</TableHead>
                  <TableHead>Total Hrs</TableHead>
                  <TableHead className="text-right">Base Pay</TableHead>
                  <TableHead className="text-right">Attend. Bonus</TableHead>
                  <TableHead className="text-right">Time Bonus</TableHead>
                  <TableHead className="text-right">Total Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.map((entry) => (
                  <TableRow key={entry.employee_id}>
                    <TableCell className="font-medium">{entry.employee_name}</TableCell>
                    <TableCell>{entry.job_title}</TableCell>
                    <TableCell>
                      <Badge variant={entry.pay_type === 'hourly' ? 'default' : 'secondary'}>
                        {entry.pay_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.pay_type === 'hourly' 
                        ? `$${entry.hourly_rate?.toFixed(2)}/hr`
                        : `$${entry.salary_amount?.toLocaleString()}/yr`
                      }
                    </TableCell>
                    <TableCell>{entry.regular_hours.toFixed(1)}</TableCell>
                    <TableCell>{entry.overtime_hours.toFixed(1)}</TableCell>
                    <TableCell>{entry.total_hours.toFixed(1)}</TableCell>
                    <TableCell className="text-right">${entry.total_pay.toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      {entry.attendance_bonus > 0 ? (
                        <span className="font-semibold text-primary">${entry.attendance_bonus.toFixed(2)}</span>
                      ) : entry.attendance_bonus_eligible === false && entry.attendance_bonus === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {entry.time_bonus > 0 ? (
                        <span className="font-semibold text-primary">${entry.time_bonus.toFixed(2)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${entry.total_with_bonus.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PayrollReports;
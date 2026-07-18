import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarDays, Download, AlertTriangle, Clock, UserX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subDays, addDays, isAfter, isBefore, parseISO } from 'date-fns';

interface AttendanceRecord {
  employee_id: string;
  employee_name: string;
  attendance_tracking_type: string;
  missed_punches: number;
  late_punches: number;
  total_points: number;
  scheduled_days: number;
  worked_days: number;
  attendance_rate: number;
}

interface MissedPunch {
  date: string;
  employee_name: string;
  scheduled_start: string;
  punch_type: 'missed' | 'late';
  minutes_late?: number;
}

const AttendanceReports = () => {
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [missedPunches, setMissedPunches] = useState<MissedPunch[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportPeriod, setReportPeriod] = useState<'month' | 'quarter'>('month');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [selectedQuarter, setSelectedQuarter] = useState(`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const { toast } = useToast();

  useEffect(() => {
    generateReport();
  }, [reportPeriod, selectedMonth, selectedQuarter]);

  const getDateRange = () => {
    if (reportPeriod === 'month') {
      const date = new Date(selectedMonth + '-01');
      return {
        start: startOfMonth(date),
        end: endOfMonth(date)
      };
    } else {
      const [year, quarter] = selectedQuarter.split('-Q');
      const quarterNum = parseInt(quarter);
      const date = new Date(parseInt(year), (quarterNum - 1) * 3, 1);
      return {
        start: startOfQuarter(date),
        end: endOfQuarter(date)
      };
    }
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();
      
      // Fetch employees with their attendance tracking preferences
      const { data: employees, error: employeesError } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, attendance_tracking_type')
        .eq('active', true);

      if (employeesError) throw employeesError;

      // Fetch schedules for the period
      const { data: schedules, error: schedulesError } = await supabase
        .from('employee_schedules')
        .select(`
          employee_id,
          start_time,
          days_of_week,
          start_date,
          end_date
        `)
        .eq('active', true);

      if (schedulesError) throw schedulesError;

      // Fetch time entries for the period
      const { data: timeEntries, error: timeEntriesError } = await supabase
        .from('time_entries')
        .select('employee_id, clock_in, clock_out')
        .gte('clock_in', start.toISOString())
        .lte('clock_in', end.toISOString());

      if (timeEntriesError) throw timeEntriesError;

      // Fetch excused shifts in the period so we don't count them as scheduled
      const { data: excusedRows } = await (supabase as any)
        .from('excused_shifts')
        .select('employee_id, excused_date')
        .gte('excused_date', format(start, 'yyyy-MM-dd'))
        .lte('excused_date', format(end, 'yyyy-MM-dd'));
      const excusedSet = new Set<string>(
        (excusedRows || []).map((r: any) => `${r.employee_id}|${r.excused_date}`)
      );

      const attendanceRecords: AttendanceRecord[] = [];
      const missedPunchDetails: MissedPunch[] = [];

      for (const employee of employees || []) {
        const employeeSchedules = schedules?.filter(s => s.employee_id === employee.id) || [];
        const employeeTimeEntries = timeEntries?.filter(t => t.employee_id === employee.id) || [];
        
        let scheduledDays = 0;
        let workedDays = 0;
        let missedPunches = 0;
        let latePunches = 0;

        // Calculate scheduled days in the period
        for (const schedule of employeeSchedules) {
          const scheduleStart = new Date(schedule.start_date);
          const scheduleEnd = schedule.end_date ? new Date(schedule.end_date) : end;
          
          let currentDate = new Date(Math.max(start.getTime(), scheduleStart.getTime()));
          const endDate = new Date(Math.min(end.getTime(), scheduleEnd.getTime()));
          
          while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay() === 0 ? 7 : currentDate.getDay(); // Convert Sunday from 0 to 7
            
            if (schedule.days_of_week.includes(dayOfWeek)) {
              const dateKey = format(currentDate, 'yyyy-MM-dd');
              if (excusedSet.has(`${employee.id}|${dateKey}`)) {
                // Excused ("day off on us") — skip attendance accounting entirely
                currentDate = addDays(currentDate, 1);
                continue;
              }
              scheduledDays++;
              
              // Check if employee clocked in for this day
              const dayStart = new Date(currentDate);
              dayStart.setHours(0, 0, 0, 0);
              const dayEnd = new Date(currentDate);
              dayEnd.setHours(23, 59, 59, 999);
              
              const dayTimeEntry = employeeTimeEntries.find(entry => {
                const clockIn = new Date(entry.clock_in);
                return clockIn >= dayStart && clockIn <= dayEnd;
              });
              
              if (dayTimeEntry) {
                workedDays++;
                
                // Check if late (only for employees tracking punctuality)
                if (employee.attendance_tracking_type === 'attendance_and_punctuality') {
                  const clockIn = new Date(dayTimeEntry.clock_in);
                  const [scheduleHour, scheduleMinute] = schedule.start_time.split(':').map(Number);
                  const scheduledStart = new Date(currentDate);
                  scheduledStart.setHours(scheduleHour, scheduleMinute, 0, 0);
                  
                  const lateness = clockIn.getTime() - scheduledStart.getTime();
                  if (lateness > 5 * 60 * 1000) { // More than 5 minutes late
                    latePunches++;
                    missedPunchDetails.push({
                      date: format(currentDate, 'yyyy-MM-dd'),
                      employee_name: `${employee.first_name} ${employee.last_name}`,
                      scheduled_start: schedule.start_time,
                      punch_type: 'late',
                      minutes_late: Math.round(lateness / (60 * 1000))
                    });
                  }
                }
              } else {
                // Missed punch
                missedPunches++;
                missedPunchDetails.push({
                  date: format(currentDate, 'yyyy-MM-dd'),
                  employee_name: `${employee.first_name} ${employee.last_name}`,
                  scheduled_start: schedule.start_time,
                  punch_type: 'missed'
                });
              }
            }
            
            currentDate = addDays(currentDate, 1);
          }
        }

        // Calculate points (missed punch = 1 point, late punch = 0.5 points for punctuality tracking)
        const totalPoints = missedPunches + (employee.attendance_tracking_type === 'attendance_and_punctuality' ? latePunches * 0.5 : 0);
        const attendanceRate = scheduledDays > 0 ? (workedDays / scheduledDays) * 100 : 0;

        attendanceRecords.push({
          employee_id: employee.id,
          employee_name: `${employee.first_name} ${employee.last_name}`,
          attendance_tracking_type: employee.attendance_tracking_type || 'attendance_only',
          missed_punches: missedPunches,
          late_punches: latePunches,
          total_points: totalPoints,
          scheduled_days: scheduledDays,
          worked_days: workedDays,
          attendance_rate: Math.round(attendanceRate * 100) / 100
        });
      }

      setAttendanceData(attendanceRecords);
      setMissedPunches(missedPunchDetails);
    } catch (error) {
      console.error('Error generating attendance report:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate attendance report',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Employee Name',
      'Tracking Type',
      'Scheduled Days',
      'Worked Days',
      'Missed Punches',
      'Late Punches',
      'Total Points',
      'Attendance Rate %'
    ];

    const csvData = attendanceData.map(record => [
      record.employee_name,
      record.attendance_tracking_type === 'attendance_and_punctuality' ? 'Attendance & Punctuality' : 'Attendance Only',
      record.scheduled_days,
      record.worked_days,
      record.missed_punches,
      record.late_punches,
      record.total_points,
      record.attendance_rate
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-report-${reportPeriod}-${reportPeriod === 'month' ? selectedMonth : selectedQuarter}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getTrackingBadge = (type: string) => {
    return type === 'attendance_and_punctuality' ? (
      <Badge variant="default" className="text-xs">
        <Clock className="h-3 w-3 mr-1" />
        Attendance & Punctuality
      </Badge>
    ) : (
      <Badge variant="secondary" className="text-xs">
        <UserX className="h-3 w-3 mr-1" />
        Attendance Only
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Attendance Reports</h2>
          <p className="text-muted-foreground">Track employee attendance and punctuality for bonus calculations</p>
        </div>
        <Button onClick={exportToCSV} disabled={loading || attendanceData.length === 0}>
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Report Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Report Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="reportPeriod">Report Period</Label>
              <Select value={reportPeriod} onValueChange={(value: 'month' | 'quarter') => setReportPeriod(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Monthly</SelectItem>
                  <SelectItem value="quarter">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportPeriod === 'month' ? (
              <div>
                <Label htmlFor="month">Select Month</Label>
                <Input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                />
              </div>
            ) : (
              <div>
                <Label htmlFor="quarter">Select Quarter</Label>
                <Select value={selectedQuarter} onValueChange={setSelectedQuarter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(q => (
                      <SelectItem key={`${new Date().getFullYear()}-Q${q}`} value={`${new Date().getFullYear()}-Q${q}`}>
                        Q{q} {new Date().getFullYear()}
                      </SelectItem>
                    ))}
                    {[1, 2, 3, 4].map(q => (
                      <SelectItem key={`${new Date().getFullYear() - 1}-Q${q}`} value={`${new Date().getFullYear() - 1}-Q${q}`}>
                        Q{q} {new Date().getFullYear() - 1}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end">
              <Button onClick={generateReport} disabled={loading} className="w-full">
                <CalendarDays className="h-4 w-4 mr-2" />
                {loading ? 'Generating...' : 'Generate Report'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {attendanceData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <UserX className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceData.reduce((sum, record) => sum + record.missed_punches, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Missed Punches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-orange-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {attendanceData.reduce((sum, record) => sum + record.late_punches, 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Late Punches</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(attendanceData.reduce((sum, record) => sum + record.total_points, 0) * 10) / 10}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Points</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {Math.round(attendanceData.reduce((sum, record) => sum + record.attendance_rate, 0) / attendanceData.length * 100) / 100}%
                  </p>
                  <p className="text-sm text-muted-foreground">Average Attendance</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendance Report Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Attendance Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Generating report...</div>
          ) : attendanceData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No attendance data found for the selected period
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Tracking Type</TableHead>
                  <TableHead className="text-center">Scheduled</TableHead>
                  <TableHead className="text-center">Worked</TableHead>
                  <TableHead className="text-center">Missed</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Points</TableHead>
                  <TableHead className="text-center">Attendance %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendanceData.map((record) => (
                  <TableRow key={record.employee_id}>
                    <TableCell className="font-medium">{record.employee_name}</TableCell>
                    <TableCell>{getTrackingBadge(record.attendance_tracking_type)}</TableCell>
                    <TableCell className="text-center">{record.scheduled_days}</TableCell>
                    <TableCell className="text-center">{record.worked_days}</TableCell>
                    <TableCell className="text-center">
                      {record.missed_punches > 0 ? (
                        <Badge variant="destructive">{record.missed_punches}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.late_punches > 0 ? (
                        <Badge variant="outline" className="text-orange-600">
                          {record.late_punches}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={record.total_points > 0 ? "secondary" : "outline"}>
                        {record.total_points}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={record.attendance_rate >= 95 ? "default" : record.attendance_rate >= 85 ? "secondary" : "destructive"}>
                        {record.attendance_rate}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Missed Punches Detail */}
      {missedPunches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Missed & Late Punch Details</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Scheduled Start</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {missedPunches.map((punch, index) => (
                  <TableRow key={index}>
                    <TableCell>{format(new Date(punch.date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{punch.employee_name}</TableCell>
                    <TableCell>{format(new Date(`2000-01-01T${punch.scheduled_start}`), 'h:mm a')}</TableCell>
                    <TableCell>
                      <Badge variant={punch.punch_type === 'missed' ? 'destructive' : 'outline'}>
                        {punch.punch_type === 'missed' ? 'Missed' : 'Late'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {punch.punch_type === 'late' && punch.minutes_late 
                        ? `${punch.minutes_late} minutes late`
                        : 'No clock-in recorded'
                      }
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

export default AttendanceReports;
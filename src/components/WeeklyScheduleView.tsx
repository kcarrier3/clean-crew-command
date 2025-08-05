import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Edit2, Trash2, Users, FileText } from 'lucide-react';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  job_title: string;
}

interface JobSite {
  id: string;
  name: string;
  address: string;
  client_name: string;
}

interface Schedule {
  id: string;
  employee_id: string;
  job_site_id: string;
  start_time: string;
  end_time: string;
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  notes: string | null;
  active: boolean;
  employees: Employee;
  job_sites: JobSite;
}

interface WeeklyScheduleViewProps {
  schedules: Schedule[];
  sortBy: 'alphabetical' | 'job_title';
  onEdit: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
}

const WeeklyScheduleView = ({ schedules, sortBy, onEdit, onDelete }: WeeklyScheduleViewProps) => {
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const fullDayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  // Get unique employees and sort them
  const employees = Array.from(
    new Map(schedules.map(s => [s.employee_id, s.employees])).values()
  ).sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.first_name.localeCompare(b.first_name);
    } else {
      const titleCompare = a.job_title.localeCompare(b.job_title);
      if (titleCompare !== 0) return titleCompare;
      return a.first_name.localeCompare(b.first_name);
    }
  });

  // Create a map of employee schedules by day
  const getEmployeeScheduleForDay = (employeeId: string, dayNumber: number) => {
    return schedules.filter(schedule => 
      schedule.employee_id === employeeId && 
      schedule.days_of_week.includes(dayNumber)
    );
  };

  // Group employees by job title when sorting by job title
  const groupedEmployees = sortBy === 'job_title' 
    ? employees.reduce((groups, employee) => {
        const title = employee.job_title;
        if (!groups[title]) groups[title] = [];
        groups[title].push(employee);
        return groups;
      }, {} as Record<string, Employee[]>)
    : { 'All Employees': employees };

  const getDayColor = (daySchedules: Schedule[]) => {
    if (daySchedules.length === 0) return 'bg-gray-50';
    if (daySchedules.length === 1) return 'bg-blue-50';
    return 'bg-yellow-50'; // Multiple schedules
  };

  const getDayBorderColor = (daySchedules: Schedule[]) => {
    if (daySchedules.length === 0) return 'border-gray-200';
    if (daySchedules.length === 1) return 'border-blue-200';
    return 'border-yellow-300';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Weekly Schedule View
        </CardTitle>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No schedules created yet</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEmployees).map(([groupTitle, groupEmployees]) => (
              <div key={groupTitle}>
                {sortBy === 'job_title' && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2 flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      {groupTitle} ({groupEmployees.length})
                    </h3>
                  </div>
                )}
                
                {/* Weekly Calendar Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[800px]">
                    {/* Header with days */}
                    <div className="grid grid-cols-8 gap-1 mb-2">
                      <div className="p-2 font-semibold text-sm">Employee</div>
                      {dayNames.map((day, index) => (
                        <div key={day} className="p-2 font-semibold text-sm text-center bg-gray-100 rounded">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Employee rows */}
                    {groupEmployees.map((employee) => (
                      <div key={employee.id} className="grid grid-cols-8 gap-1 mb-1">
                        {/* Employee info column */}
                        <div className="p-2 border rounded bg-white">
                          <div className="font-medium text-sm">
                            {employee.first_name} {employee.last_name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {employee.employee_id}
                          </div>
                          {sortBy === 'alphabetical' && (
                            <Badge variant="outline" className="text-xs mt-1">
                              {employee.job_title}
                            </Badge>
                          )}
                        </div>
                        
                        {/* Day columns */}
                        {[1, 2, 3, 4, 5, 6, 7].map((dayNumber) => {
                          const daySchedules = getEmployeeScheduleForDay(employee.id, dayNumber);
                          return (
                            <div 
                              key={dayNumber} 
                              className={`p-1 border rounded min-h-[60px] ${getDayColor(daySchedules)} ${getDayBorderColor(daySchedules)}`}
                            >
                              {daySchedules.map((schedule) => (
                                <div key={schedule.id} className="mb-1">
                                  <div className="text-xs font-medium">
                                    {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                  </div>
                                   <div className="text-xs text-muted-foreground truncate">
                                     {schedule.job_sites.name}
                                   </div>
                                   {schedule.notes && (
                                     <div className="text-xs text-blue-600 truncate mt-1" title={schedule.notes}>
                                       <FileText className="h-3 w-3 inline mr-1" />
                                       Notes
                                     </div>
                                   )}
                                  <div className="flex gap-1 mt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() => onEdit(schedule)}
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-5 w-5 p-0"
                                      onClick={() => onDelete(schedule.id)}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Legend */}
                <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-gray-50 border border-gray-200 rounded"></div>
                    <span>No Schedule</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-50 border border-blue-200 rounded"></div>
                    <span>Single Schedule</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                    <span>Multiple Schedules</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default WeeklyScheduleView;
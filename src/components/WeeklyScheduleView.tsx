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

  // Color mapping for different job titles
  const getJobTitleColors = (jobTitle: string) => {
    const colorMap: Record<string, { bg: string; border: string; text: string }> = {
      'Manager': { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-800' },
      'Supervisor': { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-800' },
      'Project Worker': { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800' },
      'Janitorial Staff': { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-800' },
      'Maintenance': { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800' },
      'Security': { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-800' },
    };
    
    return colorMap[jobTitle] || { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-800' };
  };

  // Get day cell colors based on job titles of scheduled employees
  const getDayColors = (daySchedules: Schedule[]) => {
    if (daySchedules.length === 0) return { bg: 'bg-gray-50', border: 'border-gray-200' };
    
    // If single schedule, use job title color
    if (daySchedules.length === 1) {
      const colors = getJobTitleColors(daySchedules[0].employees.job_title);
      return { bg: colors.bg, border: colors.border };
    }
    
    // Multiple schedules - use a mixed color (yellow warning)
    return { bg: 'bg-yellow-50', border: 'border-yellow-300' };
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
                           const dayColors = getDayColors(daySchedules);
                           return (
                             <div 
                               key={dayNumber} 
                               className={`p-1 border rounded min-h-[60px] ${dayColors.bg} ${dayColors.border}`}
                             >
                               {daySchedules.map((schedule) => {
                                 const jobColors = getJobTitleColors(schedule.employees.job_title);
                                 return (
                                   <div key={schedule.id} className="mb-1">
                                     <div className={`text-xs font-medium ${jobColors.text}`}>
                                       {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                                     </div>
                                     <div className="text-xs text-muted-foreground truncate">
                                       {schedule.job_sites.name}
                                     </div>
                                     <div className={`text-xs font-medium ${jobColors.text}`}>
                                       {schedule.employees.job_title}
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
                                  );
                                })}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Job Title Color Legend */}
                <div className="mt-4">
                  <h4 className="text-sm font-medium mb-2">Job Title Color Coding:</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {Object.entries({
                      'Manager': getJobTitleColors('Manager'),
                      'Supervisor': getJobTitleColors('Supervisor'),
                      'Project Worker': getJobTitleColors('Project Worker'),
                      'Janitorial Staff': getJobTitleColors('Janitorial Staff'),
                      'Maintenance': getJobTitleColors('Maintenance'),
                      'Security': getJobTitleColors('Security')
                    }).map(([title, colors]) => (
                      <div key={title} className="flex items-center gap-2">
                        <div className={`w-4 h-4 ${colors.bg} border ${colors.border} rounded`}></div>
                        <span className={colors.text}>{title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 bg-yellow-50 border border-yellow-300 rounded"></div>
                      <span>Multiple Job Titles Scheduled</span>
                    </div>
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
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Edit2, Trash2, FileText } from 'lucide-react';

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

interface ScheduleListViewProps {
  schedules: Schedule[];
  sortBy: 'alphabetical' | 'job_title';
  onEdit: (schedule: Schedule) => void;
  onDelete: (scheduleId: string) => void;
}

const ScheduleListView = ({ schedules, sortBy, onEdit, onDelete }: ScheduleListViewProps) => {
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const formatDaysOfWeek = (days: number[]) => {
    return days.map(day => dayNames[day - 1]).join(', ');
  };

  const formatTime = (time: string) => {
    return new Date(`2000-01-01T${time}`).toLocaleTimeString([], { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const sortedSchedules = [...schedules].sort((a, b) => {
    if (sortBy === 'alphabetical') {
      return a.employees.first_name.localeCompare(b.employees.first_name);
    } else {
      // Sort by job title first, then alphabetically within each group
      const titleCompare = a.employees.job_title.localeCompare(b.employees.job_title);
      if (titleCompare !== 0) return titleCompare;
      return a.employees.first_name.localeCompare(b.employees.first_name);
    }
  });

  // Group schedules by job title when sorting by job title
  const groupedSchedules = sortBy === 'job_title' 
    ? sortedSchedules.reduce((groups, schedule) => {
        const title = schedule.employees.job_title;
        if (!groups[title]) groups[title] = [];
        groups[title].push(schedule);
        return groups;
      }, {} as Record<string, Schedule[]>)
    : { 'All Employees': sortedSchedules };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Current Schedules
        </CardTitle>
      </CardHeader>
      <CardContent>
        {schedules.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No schedules created yet</p>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSchedules).map(([groupTitle, groupSchedules]) => (
              <div key={groupTitle}>
                {sortBy === 'job_title' && (
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-muted-foreground border-b pb-2">
                      {groupTitle} ({groupSchedules.length})
                    </h3>
                  </div>
                )}
                
                <div className="space-y-3">
                  {groupSchedules.map((schedule) => (
                    <div key={schedule.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="font-semibold">
                            {schedule.employees.first_name} {schedule.employees.last_name}
                          </h3>
                          <Badge variant="outline">
                            {schedule.employees.employee_id}
                          </Badge>
                          {sortBy === 'alphabetical' && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
                              {schedule.employees.job_title}
                            </Badge>
                          )}
                          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                            {schedule.job_sites.name}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            <span>
                              {formatTime(schedule.start_time)} - {formatTime(schedule.end_time)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDaysOfWeek(schedule.days_of_week)}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4" />
                            <span>{schedule.job_sites.client_name}</span>
                          </div>
                        </div>
                        
                        {schedule.notes && (
                          <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-4 w-4 text-blue-600" />
                              <span className="font-medium text-blue-800">Shift Notes:</span>
                            </div>
                            <p className="text-blue-700">{schedule.notes}</p>
                          </div>
                        )}
                        
                        <div className="mt-2 text-xs text-muted-foreground">
                          {schedule.start_date} {schedule.end_date && `to ${schedule.end_date}`}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(schedule)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onDelete(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ScheduleListView;
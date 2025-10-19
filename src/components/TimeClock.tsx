import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, PlayCircle, StopCircle, MapPin, Timer, Lock, Shield, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useJobSiteAccess } from '@/hooks/useJobSiteAccess';

interface Employee {
  id: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  require_geofencing: boolean;
  geofence_lat: number | null;
  geofence_lng: number | null;
  geofence_radius_meters: number;
}

interface JobSite {
  id: string;
  name: string;
  address: string;
  client_name: string;
  special_instructions?: string | null;
  access_instructions?: string | null;
  safety_requirements?: string | null;
}

interface Schedule {
  id: string;
  employee_id: string;
  job_site_id: string;
  start_time: string;
  end_time: string;
  job_sites: JobSite;
}

interface TimeEntry {
  id: string;
  employee_id: string;
  job_site_id: string;
  clock_in: string;
  clock_out: string | null;
  employees: Employee;
  job_sites: JobSite;
}

interface TimeClockProps {
  forManager?: boolean;
  selectedEmployeeId?: string;
}

const TimeClock = ({ forManager = false, selectedEmployeeId }: TimeClockProps) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [jobSites, setJobSites] = useState<JobSite[]>([]);
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedJobSite, setSelectedJobSite] = useState<string>('');
  const [scheduledJobSite, setScheduledJobSite] = useState<Schedule | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const { toast } = useToast();
  const { profile, isManager } = useAuth();
  const { canAccessSensitiveInfo } = useJobSiteAccess(selectedJobSite || null);

  const selectedSite = jobSites.find(s => s.id === selectedJobSite);

  useEffect(() => {
    if (forManager) {
      fetchEmployees();
    }
    fetchJobSites();
    fetchActiveEntries();
    
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, [forManager]);

  // Set the employee for worker dashboard or manager's selected employee
  useEffect(() => {
    if (!forManager && profile) {
      setSelectedEmployee(profile.id);
    } else if (forManager && selectedEmployeeId) {
      setSelectedEmployee(selectedEmployeeId);
    }
  }, [forManager, profile, selectedEmployeeId]);

  // Auto-select account when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeSchedule(selectedEmployee);
    } else {
      setScheduledJobSite(null);
      setSelectedJobSite('');
    }
  }, [selectedEmployee]);

  const fetchEmployees = async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*')
      .eq('active', true)
      .order('first_name');
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch employees', variant: 'destructive' });
    } else {
      setEmployees(data || []);
    }
  };

  const fetchJobSites = async () => {
    const { data, error } = await supabase
      .from('job_sites')
      .select('*')
      .eq('active', true)
      .order('name');
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch accounts', variant: 'destructive' });
    } else {
      setJobSites(data || []);
    }
  };

  const fetchActiveEntries = async () => {
    let query = supabase
      .from('time_entries')
      .select(`
        *,
        employees:employee_id(id, employee_id, first_name, last_name, require_geofencing, geofence_lat, geofence_lng, geofence_radius_meters),
        job_sites:job_site_id(id, name, address, client_name)
      `)
      .is('clock_out', null)
      .order('clock_in', { ascending: false });

    // If not a manager, only show current user's entries
    if (!forManager && profile) {
      query = query.eq('employee_id', profile.id);
    }
    
    const { data, error } = await query;
    
    if (error) {
      toast({ title: 'Error', description: 'Failed to fetch active entries', variant: 'destructive' });
    } else {
      setActiveEntries(data || []);
    }
  };

  const fetchEmployeeSchedule = async (employeeId: string) => {
    const currentDay = new Date().getDay(); // 0=Sunday, 1=Monday, etc.
    const adjustedDay = currentDay === 0 ? 7 : currentDay; // Convert to 1=Monday, 7=Sunday
    
    const { data, error } = await supabase
      .from('employee_schedules')
      .select(`
        *,
        job_sites:job_site_id(id, name, address, client_name)
      `)
      .eq('employee_id', employeeId)
      .eq('active', true)
      .contains('days_of_week', [adjustedDay])
      .lte('start_date', new Date().toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
      .single();

    if (error) {
      console.log('No schedule found for employee');
      setScheduledJobSite(null);
      setSelectedJobSite('');
    } else if (data) {
      setScheduledJobSite(data);
      setSelectedJobSite(data.job_site_id);
    }
  };

  // Geolocation functions
  const getCurrentLocation = (): Promise<{lat: number, lng: number}> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          let message = 'Unable to get location';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission denied';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out';
              break;
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000 // 5 minutes
        }
      );
    });
  };

  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  const validateGeofencing = (employee: Employee, location: {lat: number, lng: number}): boolean => {
    if (!employee.require_geofencing || !employee.geofence_lat || !employee.geofence_lng) {
      return true; // No geofencing required
    }

    const distance = calculateDistance(
      location.lat, 
      location.lng, 
      employee.geofence_lat, 
      employee.geofence_lng
    );

    return distance <= employee.geofence_radius_meters;
  };

  const clockIn = async () => {
    if (!selectedEmployee || !selectedJobSite) {
      toast({ title: 'Error', description: 'Please select an employee and account', variant: 'destructive' });
      return;
    }

    // Check if employee is already clocked in
    const existingEntry = activeEntries.find(entry => entry.employee_id === selectedEmployee);
    if (existingEntry) {
      toast({ title: 'Error', description: 'Employee is already clocked in', variant: 'destructive' });
      return;
    }

    // Get selected employee details for geofencing
    const employee = forManager 
      ? employees.find(emp => emp.id === selectedEmployee)
      : profile ? {
          id: profile.id,
          first_name: profile.first_name,
          last_name: profile.last_name,
          employee_id: profile.employee_id || '',
          require_geofencing: profile.require_geofencing,
          geofence_lat: profile.geofence_lat,
          geofence_lng: profile.geofence_lng,
          geofence_radius_meters: profile.geofence_radius_meters
        } : null;
        
    if (!employee) {
      toast({ title: 'Error', description: 'Employee data not found', variant: 'destructive' });
      return;
    }

    setIsGettingLocation(true);
    setLocationError(null);

    try {
      // Get current location
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      // Validate geofencing if required
      if (!validateGeofencing(employee, location)) {
        toast({ 
          title: 'Location Error', 
          description: `You must be within ${employee.geofence_radius_meters}m of the assigned location to clock in`, 
          variant: 'destructive' 
        });
        setIsGettingLocation(false);
        return;
      }

      // Clock in with location
      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: selectedEmployee,
          job_site_id: selectedJobSite,
          clock_in: new Date().toISOString(),
          location_lat: location.lat,
          location_lng: location.lng
        })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'Failed to clock in', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Clocked in successfully!' });
        
        // Check if employee is late and notify managers
        supabase.functions.invoke('check-late-workers', {
          body: {
            timeEntryId: data.id,
            employeeId: selectedEmployee
          }
        }).catch(err => {
          console.error('Error checking late status:', err);
          // Don't show error to user - late check is background process
        });
        
        if (!forManager) {
          setSelectedEmployee('');
          setSelectedJobSite('');
        }
        fetchActiveEntries();
      }
    } catch (error: any) {
      setLocationError(error.message);
      toast({ 
        title: 'Location Required', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsGettingLocation(false);
    }
  };

  const clockOut = async (entryId: string) => {
    try {
      // Get current location for clock out
      const location = await getCurrentLocation();
      
      const { error } = await supabase
        .from('time_entries')
        .update({ 
          clock_out: new Date().toISOString(),
          location_lat: location.lat,
          location_lng: location.lng
        })
        .eq('id', entryId);

      if (error) {
        toast({ title: 'Error', description: 'Failed to clock out', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Clocked out successfully!' });
        fetchActiveEntries();
      }
    } catch (error) {
      // Clock out without location if location fails
      const { error: clockOutError } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', entryId);

      if (clockOutError) {
        toast({ title: 'Error', description: 'Failed to clock out', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Clocked out successfully (location unavailable)' });
        fetchActiveEntries();
      }
    }
  };

  const formatDuration = (clockIn: string) => {
    const start = new Date(clockIn);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const currentEmployee = forManager && selectedEmployee 
    ? employees.find(emp => emp.id === selectedEmployee) 
    : (profile && { 
        id: profile.id, 
        first_name: profile.first_name, 
        last_name: profile.last_name,
        employee_id: profile.employee_id || '',
        require_geofencing: false,
        geofence_lat: null,
        geofence_lng: null,
        geofence_radius_meters: 100
      });

  return (
    <div className="space-y-6">
      {/* Current Time Display */}
      <Card>
        <CardContent className="p-4">
          <div className="text-center">
            <div className="text-3xl font-mono font-bold text-primary">
              {currentTime.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit',
                second: '2-digit',
                hour12: true 
              })}
            </div>
            <div className="text-sm text-muted-foreground">
              {currentTime.toLocaleDateString([], { 
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {forManager ? 'Employee Time Clock' : 'Time Clock'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Selection (only for managers) */}
            {forManager && (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} ({employee.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Account Selection */}
            <div className="space-y-2">
              <Select value={selectedJobSite} onValueChange={setSelectedJobSite}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Account" />
                </SelectTrigger>
                <SelectContent>
                  {jobSites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name} - {site.client_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {scheduledJobSite && (
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">
                    Scheduled: {scheduledJobSite.job_sites.name}
                  </Badge>
                  <span className="text-xs">
                    {scheduledJobSite.start_time} - {scheduledJobSite.end_time}
                  </span>
                </div>
              )}
            </div>

            {/* Clock In Button and Status */}
            <div className="space-y-2">
              <Button 
                onClick={clockIn} 
                className="w-full"
                disabled={!selectedEmployee || !selectedJobSite || isGettingLocation}
              >
                {isGettingLocation ? (
                  <>
                    <MapPin className="h-4 w-4 mr-2 animate-pulse" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Clock In
                  </>
                )}
              </Button>
              
              {/* Location status indicators */}
              {currentEmployee?.require_geofencing && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location required
                </div>
              )}
              
              {locationError && (
                <div className="text-xs text-destructive">
                  {locationError}
                </div>
              )}
              
              {currentLocation && (
                <div className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location detected
                </div>
              )}
            </div>
          </div>

          {/* Job Site Details with Access Instructions */}
          {selectedSite && (
            <div className="mt-4 space-y-3 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-semibold text-sm">Account Information</h4>
              {selectedSite.address && (
                <p className="text-sm">
                  <strong>Address:</strong> {selectedSite.address}
                </p>
              )}
              {selectedSite.special_instructions && (
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1 mb-1">
                    <FileText className="h-3 w-3" />
                    Special Instructions
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedSite.special_instructions}
                  </p>
                </div>
              )}
              {selectedSite.access_instructions && canAccessSensitiveInfo && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded">
                  <p className="text-sm font-semibold flex items-center gap-1 mb-1 text-amber-900 dark:text-amber-100">
                    <Lock className="h-3 w-3" />
                    Access Instructions
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                    {selectedSite.access_instructions}
                  </p>
                </div>
              )}
              {selectedSite.safety_requirements && (
                <div>
                  <p className="text-sm font-semibold flex items-center gap-1 mb-1">
                    <Shield className="h-3 w-3" />
                    Safety Requirements
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedSite.safety_requirements}
                  </p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Time Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" />
            {forManager ? 'Currently Clocked In' : 'My Active Session'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {activeEntries.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              {forManager ? 'No one is currently clocked in' : 'You are not clocked in'}
            </p>
          ) : (
            <div className="space-y-4">
              {activeEntries.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">
                        {entry.employees.first_name} {entry.employees.last_name}
                      </h3>
                      <Badge variant="secondary">{entry.employees.employee_id}</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {entry.job_sites.name}
                      </div>
                      <div>
                        Started: {new Date(entry.clock_in).toLocaleTimeString()}
                      </div>
                      <div className="font-mono text-lg text-foreground">
                        {formatDuration(entry.clock_in)}
                      </div>
                    </div>
                  </div>
                  <Button 
                    onClick={() => clockOut(entry.id)}
                    variant="destructive"
                    size="sm"
                  >
                    <StopCircle className="h-4 w-4 mr-2" />
                    Clock Out
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeClock;
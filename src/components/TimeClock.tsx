import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Clock, PlayCircle, StopCircle, MapPin, Timer, Lock, Shield, FileText, AlertTriangle, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useJobSiteAccess } from '@/hooks/useJobSiteAccess';
import { useNavigate } from 'react-router-dom';
import QRScanner from './QRScanner';

// Job titles allowed to punch in at the internal office without a scheduled shift.
const OFFICE_ELIGIBLE_TITLES = [
  'Owner',
  'Administrator',
  'Janitorial Manager',
  'Floaters',
  'Supply Management',
  'Night Manager',
  'Office Manager',
];

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
  is_office?: boolean;
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
  manager_override: boolean;
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
  const [officeSite, setOfficeSite] = useState<JobSite | null>(null);
  const [activeEntries, setActiveEntries] = useState<TimeEntry[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<string>('');
  const [selectedJobSite, setSelectedJobSite] = useState<string>('');
  const [scheduledJobSite, setScheduledJobSite] = useState<Schedule | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [companyGeofencingEnabled, setCompanyGeofencingEnabled] = useState(true);
  const [earlyClockinMinutes, setEarlyClockinMinutes] = useState<number>(15);
  const { toast } = useToast();
  const { profile, isManager } = useAuth();
  const { canAccessSensitiveInfo } = useJobSiteAccess(selectedJobSite || null);
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);

  const isJanitorialWorker =
    !forManager && profile?.job_title === 'Janitorial Staff' && !isManager();

  const isOfficeEligible =
    !!profile?.job_title && OFFICE_ELIGIBLE_TITLES.includes(profile.job_title);

  // Whether the current worker view is already clocked in.
  const isClockedInAsSelf =
    !!profile && activeEntries.some((e) => e.employee_id === profile.id);

  const punchInAtOffice = async () => {
    if (!officeSite) return;
    setSelectedJobSite(officeSite.id);
    await clockIn(officeSite.id);
  };

  const handleScan = (text: string) => {
    setScannerOpen(false);
    try {
      const url = new URL(text);
      const parts = url.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('punch');
      const token = idx >= 0 ? parts[idx + 1] : parts[parts.length - 1];
      if (!token) throw new Error('Invalid code');
      navigate(`/punch/${token}`);
    } catch {
      // If not a URL, treat the whole payload as the token
      const cleaned = text.trim();
      if (cleaned) navigate(`/punch/${cleaned}`);
      else toast({ title: 'Invalid QR', description: 'Could not read code.', variant: 'destructive' });
    }
  };

  const selectedSite = jobSites.find(s => s.id === selectedJobSite);

  useEffect(() => {
    if (forManager) {
      fetchEmployees();
    }
    fetchJobSites();
    fetchActiveEntries();
    fetchCompanyGeofencingSetting();
    
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

  // Auto-select job site when employee is selected
  useEffect(() => {
    if (selectedEmployee) {
      fetchEmployeeSchedule(selectedEmployee);
    } else {
      setScheduledJobSite(null);
      setSelectedJobSite('');
    }
  }, [selectedEmployee]);

  const fetchCompanyGeofencingSetting = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('key,value')
      .in('key', ['geofencing_enabled', 'early_clockin_minutes']);
    if (data) {
      for (const row of data) {
        if (row.key === 'geofencing_enabled') {
          setCompanyGeofencingEnabled(row.value === 'true');
        } else if (row.key === 'early_clockin_minutes') {
          const n = parseInt(row.value, 10);
          if (!Number.isNaN(n)) setEarlyClockinMinutes(n);
        }
      }
    }
  };

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
      const all = data || [];
      setOfficeSite(all.find((s: any) => s.is_office) || null);
      setJobSites(all.filter((s: any) => !s.is_office));
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
    const currentDay = new Date().getDay();
    const adjustedDay = currentDay === 0 ? 7 : currentDay;
    
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
              message = 'Location permission denied. Please enable location access in your device settings.';
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
    const R = 6371e3;
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  /**
   * Determine whether geofencing should be enforced for this clock-in.
   * Rules:
   *  1. If company-wide geofencing is OFF → skip geofencing
   *  2. If this is a manager override → skip geofencing
   *  3. If the employee's individual require_geofencing is false → skip
   *  4. If the employee has no geofence coordinates set → skip
   *  5. Otherwise → enforce
   */
  const shouldEnforceGeofencing = (employee: Employee, isManagerOverride: boolean): boolean => {
    if (!companyGeofencingEnabled) return false;
    if (isManagerOverride) return false;
    if (!employee.require_geofencing) return false;
    if (!employee.geofence_lat || !employee.geofence_lng) return false;
    return true;
  };

  const validateGeofencing = (employee: Employee, location: {lat: number, lng: number}): boolean => {
    if (!employee.geofence_lat || !employee.geofence_lng) return true;
    const radius = employee.geofence_radius_meters || 100;
    const distance = calculateDistance(
      location.lat, location.lng,
      employee.geofence_lat, employee.geofence_lng
    );
    return distance <= radius;
  };

  const clockIn = async (jobSiteIdOverride?: string) => {
    const jobSiteId = jobSiteIdOverride || selectedJobSite;
    if (!selectedEmployee || !jobSiteId) {
      toast({ title: 'Error', description: 'Please select an employee and account', variant: 'destructive' });
      return;
    }

    const existingEntry = activeEntries.find(entry => entry.employee_id === selectedEmployee);
    if (existingEntry) {
      toast({ title: 'Already Clocked In', description: 'This employee is already clocked in', variant: 'destructive' });
      return;
    }

    // Build employee object for geofencing check
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
          geofence_radius_meters: profile.geofence_radius_meters || 100
        } : null;
        
    if (!employee) {
      toast({ title: 'Error', description: 'Employee data not found', variant: 'destructive' });
      return;
    }

    // Manager overrides bypass geofencing
    const isManagerOverride = forManager && isManager();

    // Enforce early clock-in limit against today's scheduled start (skip for manager override).
    if (!isManagerOverride && scheduledJobSite && scheduledJobSite.job_site_id === jobSiteId) {
      const [h, m] = scheduledJobSite.start_time.split(':').map(Number);
      const shiftStart = new Date();
      shiftStart.setHours(h || 0, m || 0, 0, 0);
      const earliestAllowed = new Date(shiftStart.getTime() - earlyClockinMinutes * 60 * 1000);
      if (new Date() < earliestAllowed) {
        const mins = Math.ceil((earliestAllowed.getTime() - Date.now()) / 60000);
        toast({
          title: 'Too Early to Clock In',
          description: `Your shift starts at ${scheduledJobSite.start_time}. You can clock in up to ${earlyClockinMinutes} minutes early (in ${mins} min).`,
          variant: 'destructive',
        });
        return;
      }
    }

    const enforceGeo = shouldEnforceGeofencing(employee, isManagerOverride);

    setIsGettingLocation(true);
    setLocationError(null);

    try {
      let location: {lat: number, lng: number} | null = null;

      if (enforceGeo) {
        // Must get location and validate
        location = await getCurrentLocation();
        setCurrentLocation(location);

        if (!validateGeofencing(employee, location)) {
          const radius = employee.geofence_radius_meters || 100;
          toast({ 
            title: 'Outside Geofence', 
            description: `You must be within ${radius}m of your assigned location to clock in.`, 
            variant: 'destructive' 
          });
          setIsGettingLocation(false);
          return;
        }
      } else {
        // Try to get location silently for logging, but don't block on failure
        try {
          location = await getCurrentLocation();
          setCurrentLocation(location);
        } catch {
          // Location optional when geofencing not enforced
        }
      }

      const { data, error } = await supabase
        .from('time_entries')
        .insert({
          employee_id: selectedEmployee,
          job_site_id: jobSiteId,
          clock_in: new Date().toISOString(),
          location_lat: location?.lat ?? null,
          location_lng: location?.lng ?? null,
          manager_override: isManagerOverride,
          override_by: isManagerOverride ? profile?.id : null,
        })
        .select()
        .single();

      if (error) {
        toast({ title: 'Error', description: 'Failed to clock in', variant: 'destructive' });
      } else {
        const empName = forManager
          ? `${employees.find(e => e.id === selectedEmployee)?.first_name || 'Employee'} clocked in`
          : 'Clocked in successfully!';
        toast({ title: 'Success', description: empName + (isManagerOverride ? ' (manager override)' : '') });
        
        // Check if employee is late and notify department managers
        supabase.functions.invoke('check-late-workers', {
          body: { timeEntryId: data.id, employeeId: selectedEmployee }
        }).catch(err => console.error('Error checking late status:', err));
        
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
    const entry = activeEntries.find(e => e.id === entryId);
    const isManagerOverride = forManager && isManager();

    try {
      let location: {lat: number, lng: number} | null = null;
      try {
        location = await getCurrentLocation();
      } catch {
        // Location optional for clock out
      }
      
      const { error } = await supabase
        .from('time_entries')
        .update({ 
          clock_out: new Date().toISOString(),
          location_lat: location?.lat ?? null,
          location_lng: location?.lng ?? null,
          ...(isManagerOverride && !entry?.manager_override ? {
            manager_override: true,
            override_by: profile?.id
          } : {})
        })
        .eq('id', entryId);

      if (error) {
        toast({ title: 'Error', description: 'Failed to clock out', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Clocked out successfully!' });
        fetchActiveEntries();
      }
    } catch (error) {
      const { error: clockOutError } = await supabase
        .from('time_entries')
        .update({ clock_out: new Date().toISOString() })
        .eq('id', entryId);

      if (clockOutError) {
        toast({ title: 'Error', description: 'Failed to clock out', variant: 'destructive' });
      } else {
        toast({ title: 'Success', description: 'Clocked out (location unavailable)' });
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
        require_geofencing: profile.require_geofencing,
        geofence_lat: profile.geofence_lat,
        geofence_lng: profile.geofence_lng,
        geofence_radius_meters: profile.geofence_radius_meters || 100
      });

  const isManagerOverride = forManager && isManager();
  const willEnforceGeo = currentEmployee 
    ? shouldEnforceGeofencing(currentEmployee, isManagerOverride)
    : false;

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

      {/* Company geofencing disabled notice */}
      {!companyGeofencingEnabled && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Company-wide geofencing is currently <strong>disabled</strong>. Employees can clock in from any location.
        </div>
      )}

      {/* Manager override notice */}
      {isManagerOverride && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-200">
          <Shield className="h-4 w-4 flex-shrink-0" />
          <strong>Manager Override:</strong> Geofencing is bypassed. This action will be logged.
        </div>
      )}

      {/* Clock In/Out Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {forManager ? 'Employee Time Clock' : 'Time Clock'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Office punch-in shortcut for fixed-expense staff (worker view only) */}
          {!forManager && isOfficeEligible && officeSite && !isClockedInAsSelf && (
            <div className="mb-4 p-4 border rounded-lg bg-muted/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-sm text-muted-foreground">Fixed-expense staff</div>
                <div className="font-semibold flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Punch in at {officeSite.name}
                </div>
                {officeSite.address && (
                  <div className="text-xs text-muted-foreground">{officeSite.address}</div>
                )}
              </div>
              <Button
                onClick={punchInAtOffice}
                disabled={isGettingLocation}
                size="lg"
                className="min-w-[160px]"
              >
                {isGettingLocation ? (
                  <>
                    <MapPin className="h-4 w-4 mr-2 animate-pulse" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-5 w-5 mr-2" />
                    Clock In at Office
                  </>
                )}
              </Button>
            </div>
          )}

          {isJanitorialWorker && !activeEntries.some(e => e.employee_id === selectedEmployee) ? (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Punch-in method</p>
                <p className="text-lg font-semibold">Scan account QR code</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Scan the QR code posted at your assigned account to clock in or out. The code only works at that location.
                </p>
              </div>
              <Button
                onClick={() => setScannerOpen(true)}
                size="lg"
                className="w-full max-w-xs h-16 text-lg"
              >
                <QrCode className="h-6 w-6 mr-2" />
                Scan to Clock In
              </Button>
            </div>
          ) : !forManager && scheduledJobSite && !activeEntries.some(e => e.employee_id === selectedEmployee) ? (
            /* Simplified single-button UI for employees with a scheduled shift today */
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="text-center space-y-1">
                <p className="text-sm text-muted-foreground">Today's shift</p>
                <p className="text-lg font-semibold">{scheduledJobSite.job_sites?.name}</p>
                <p className="text-sm text-muted-foreground">
                  {scheduledJobSite.start_time} – {scheduledJobSite.end_time}
                </p>
              </div>
              <Button
                onClick={() => clockIn()}
                disabled={isGettingLocation}
                size="lg"
                className="w-full max-w-xs h-16 text-lg"
              >
                {isGettingLocation ? (
                  <>
                    <MapPin className="h-5 w-5 mr-2 animate-pulse" />
                    Getting Location...
                  </>
                ) : (
                  <>
                    <PlayCircle className="h-6 w-6 mr-2" />
                    Clock In
                  </>
                )}
              </Button>
              {willEnforceGeo && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location required
                </div>
              )}
              {locationError && (
                <div className="text-xs text-destructive text-center">{locationError}</div>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Employee Selection (only for managers) */}
            {forManager && (
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent className="bg-background">
                  {employees.map((employee) => (
                    <SelectItem key={employee.id} value={employee.id}>
                      {employee.first_name} {employee.last_name} ({employee.employee_id})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Job Site Selection */}
            <Select value={selectedJobSite} onValueChange={setSelectedJobSite}>
              <SelectTrigger className={forManager ? '' : 'md:col-span-2'}>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent className="bg-background">
                {jobSites.map((site) => (
                  <SelectItem key={site.id} value={site.id}>
                    {site.name} {site.client_name ? `(${site.client_name})` : ''}
                  </SelectItem>
                ))}
                {officeSite && (
                  <SelectItem key={officeSite.id} value={officeSite.id}>
                    🏢 {officeSite.name} (Internal)
                  </SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Clock In Button */}
            <div className="flex flex-col gap-2">
              <Button
                onClick={() => clockIn()}
                disabled={!selectedEmployee || !selectedJobSite || isGettingLocation}
                className="w-full"
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
              {willEnforceGeo && (
                <div className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  Location required for this employee
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
                  Location verified
                </div>
              )}
            </div>
          </div>
          )}

          {/* Scheduled job site info */}
          {scheduledJobSite && forManager && (
            <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Scheduled today at {scheduledJobSite.job_sites?.name} · {scheduledJobSite.start_time} – {scheduledJobSite.end_time}
            </div>
          )}

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
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h3 className="font-semibold">
                        {entry.employees.first_name} {entry.employees.last_name}
                      </h3>
                      <Badge variant="secondary">{entry.employees.employee_id}</Badge>
                      {entry.manager_override && (
                        <Badge variant="outline" className="text-blue-600 border-blue-300 text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Override
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
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
                  {isJanitorialWorker && entry.employee_id === profile?.id ? (
                    <Button
                      onClick={() => setScannerOpen(true)}
                      variant="destructive"
                      size="sm"
                    >
                      <QrCode className="h-4 w-4 mr-2" />
                      Scan to Clock Out
                    </Button>
                  ) : (
                    <Button
                      onClick={() => clockOut(entry.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <StopCircle className="h-4 w-4 mr-2" />
                      Clock Out
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <QRScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} />
    </div>
  );
};

export default TimeClock;

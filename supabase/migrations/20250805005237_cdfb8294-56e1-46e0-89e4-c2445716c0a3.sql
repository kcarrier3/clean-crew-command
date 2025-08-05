-- Add geofencing settings to employees table
ALTER TABLE public.employees 
ADD COLUMN require_geofencing boolean NOT NULL DEFAULT false,
ADD COLUMN geofence_lat numeric,
ADD COLUMN geofence_lng numeric,
ADD COLUMN geofence_radius_meters integer DEFAULT 100;

-- Create table for hourly location updates
CREATE TABLE public.location_updates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  time_entry_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  recorded_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on location_updates
ALTER TABLE public.location_updates ENABLE ROW LEVEL SECURITY;

-- Create policies for location_updates
CREATE POLICY "Allow all access to location_updates" 
ON public.location_updates 
FOR ALL 
USING (true);

-- Add comments for clarity
COMMENT ON COLUMN public.employees.require_geofencing IS 'Whether this employee must be within geofence to clock in/out';
COMMENT ON COLUMN public.employees.geofence_lat IS 'Latitude of geofence center';
COMMENT ON COLUMN public.employees.geofence_lng IS 'Longitude of geofence center';
COMMENT ON COLUMN public.employees.geofence_radius_meters IS 'Geofence radius in meters';
COMMENT ON TABLE public.location_updates IS 'Hourly location updates while employee is clocked in';
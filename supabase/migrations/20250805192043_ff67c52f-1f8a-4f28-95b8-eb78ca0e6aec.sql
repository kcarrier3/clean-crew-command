-- Create employee record for Kennedy Carrier to enable time tracking
INSERT INTO employees (
  id,
  user_id,
  employee_id, 
  first_name, 
  last_name,
  email,
  job_title,
  hire_date,
  hourly_rate,
  active,
  require_geofencing,
  geofence_lat,
  geofence_lng,
  geofence_radius_meters,
  created_at,
  updated_at
) 
SELECT 
  p.id,
  p.id as user_id,
  COALESCE(p.employee_id, 'EMP001') as employee_id,
  p.first_name,
  p.last_name, 
  p.email,
  COALESCE(p.job_title, 'Employee') as job_title,
  p.hire_date,
  p.hourly_rate,
  p.active,
  p.require_geofencing,
  p.geofence_lat,
  p.geofence_lng,
  p.geofence_radius_meters,
  p.created_at,
  p.updated_at
FROM profiles p 
WHERE p.id = '69908444-d233-4ad5-8b3c-68a28871c6a3'
AND NOT EXISTS (
  SELECT 1 FROM employees e WHERE e.id = p.id
);
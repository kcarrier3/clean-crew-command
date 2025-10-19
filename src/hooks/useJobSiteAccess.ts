import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export const useJobSiteAccess = (jobSiteId: string | null) => {
  const [canAccessSensitiveInfo, setCanAccessSensitiveInfo] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user, isManager, profile } = useAuth();

  useEffect(() => {
    const checkAccess = async () => {
      if (!user || !jobSiteId) {
        setCanAccessSensitiveInfo(false);
        setLoading(false);
        return;
      }

      // Managers and admins can always access
      if (isManager()) {
        setCanAccessSensitiveInfo(true);
        setLoading(false);
        return;
      }

      // Check if user is a floater
      if (profile?.job_title === 'Floaters') {
        setCanAccessSensitiveInfo(true);
        setLoading(false);
        return;
      }

      // Check if user has an active schedule at this job site
      const { data, error } = await supabase
        .from('employee_schedules')
        .select('id')
        .eq('employee_id', user.id)
        .eq('job_site_id', jobSiteId)
        .eq('active', true)
        .lte('start_date', new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`)
        .limit(1);

      if (error) {
        console.error('Error checking job site access:', error);
        setCanAccessSensitiveInfo(false);
      } else {
        setCanAccessSensitiveInfo(data && data.length > 0);
      }

      setLoading(false);
    };

    checkAccess();
  }, [user, jobSiteId, isManager, profile]);

  return { canAccessSensitiveInfo, loading };
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { timeEntryId, employeeId } = await req.json();

    console.log('Checking late status for employee:', employeeId, 'time entry:', timeEntryId);

    // Get the time entry and employee schedule
    const { data: timeEntry, error: timeEntryError } = await supabase
      .from('time_entries')
      .select('*, employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, job_title, email)')
      .eq('id', timeEntryId)
      .single();

    if (timeEntryError) {
      console.error('Error fetching time entry:', timeEntryError);
      throw timeEntryError;
    }

    if (!timeEntry) {
      return new Response(
        JSON.stringify({ error: 'Time entry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get employee's schedule for today
    const clockInTime = new Date(timeEntry.clock_in);
    const dayOfWeek = clockInTime.getDay(); // 0 = Sunday, 1 = Monday, etc.

    const { data: schedules } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('active', true)
      .lte('start_date', clockInTime.toISOString().split('T')[0])
      .or(`end_date.is.null,end_date.gte.${clockInTime.toISOString().split('T')[0]}`)
      .contains('days_of_week', [dayOfWeek]);

    if (!schedules || schedules.length === 0) {
      console.log('No schedule found for employee on this day');
      return new Response(
        JSON.stringify({ message: 'No schedule found for this day' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if employee is late (more than 15 minutes after scheduled start time)
    const schedule = schedules[0];
    if (!schedule.start_time) {
      console.log('No start time defined in schedule');
      return new Response(
        JSON.stringify({ message: 'No start time in schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse scheduled start time
    const [schedHours, schedMinutes] = schedule.start_time.split(':').map(Number);
    const scheduledStart = new Date(clockInTime);
    scheduledStart.setHours(schedHours, schedMinutes, 0, 0);

    // Calculate minutes late
    const minutesLate = Math.floor((clockInTime.getTime() - scheduledStart.getTime()) / (1000 * 60));

    console.log('Scheduled start:', scheduledStart.toISOString());
    console.log('Actual clock in:', clockInTime.toISOString());
    console.log('Minutes late:', minutesLate);

    if (minutesLate > 15) {
      // Employee is late - check if we already notified about this time entry
      const { data: existingNotification } = await supabase
        .from('late_notifications')
        .select('id')
        .eq('time_entry_id', timeEntryId)
        .single();

      if (existingNotification) {
        console.log('Already notified about this late clock-in');
        return new Response(
          JSON.stringify({ message: 'Already notified' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get the appropriate managers for this employee
      const { data: managers, error: managersError } = await supabase
        .rpc('get_employee_managers', { _employee_id: employeeId });

      if (managersError) {
        console.error('Error getting managers:', managersError);
        throw managersError;
      }

      console.log('Found managers:', managers);

      // Record the late notification
      const { error: notificationError } = await supabase
        .from('late_notifications')
        .insert({
          employee_id: employeeId,
          time_entry_id: timeEntryId,
          minutes_late: minutesLate
        });

      if (notificationError) {
        console.error('Error recording notification:', notificationError);
        throw notificationError;
      }

      // Create in-app notifications for managers
      const employee = timeEntry.employee as any;
      const managerIds = managers.map((m: any) => m.manager_id);
      
      const notificationPromises = managers.map((manager: any) =>
        supabase.from('messages').insert({
          conversation_id: '00000000-0000-0000-0000-000000000000', // System message
          sender_id: employeeId,
          content: `${employee.first_name} ${employee.last_name} clocked in ${minutesLate} minutes late at ${clockInTime.toLocaleTimeString()}.`,
          message_type: 'system_alert'
        })
      );

      await Promise.all(notificationPromises);

      // Send push notifications to managers
      console.log('Sending push notifications to managers...');
      try {
        const { error: pushError } = await supabase.functions.invoke('send-push-notification', {
          body: {
            userIds: managerIds,
            title: '⏰ Late Clock-In Alert',
            body: `${employee.first_name} ${employee.last_name} clocked in ${minutesLate} minutes late`,
            data: {
              type: 'late_notification',
              employeeId: employeeId,
              timeEntryId: timeEntryId,
              minutesLate: minutesLate
            }
          }
        });

        if (pushError) {
          console.error('Error sending push notification:', pushError);
        } else {
          console.log('Push notifications sent successfully');
        }
      } catch (pushError) {
        console.error('Error invoking push notification function:', pushError);
      }

      console.log('Late notification sent to managers');

      return new Response(
        JSON.stringify({
          message: 'Late notification sent',
          minutesLate,
          managersNotified: managers.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ message: 'Employee clocked in on time', minutesLate }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in check-late-workers function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

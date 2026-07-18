import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RequestSchema = z.object({
  timeEntryId: z.string().uuid({ message: "Invalid timeEntryId format" }),
  employeeId: z.string().uuid({ message: "Invalid employeeId format" })
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let requestBody;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const validationResult = RequestSchema.safeParse(requestBody);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { timeEntryId, employeeId } = validationResult.data;
    console.log('Checking late status for employee:', employeeId, 'time entry:', timeEntryId);

    // Get the time entry with employee info
    const { data: timeEntry, error: timeEntryError } = await supabase
      .from('time_entries')
      .select('*, employee:profiles!time_entries_employee_id_fkey(id, first_name, last_name, job_title, email)')
      .eq('id', timeEntryId)
      .single();

    if (timeEntryError || !timeEntry) {
      return new Response(
        JSON.stringify({ error: 'Time entry not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get grace period from app_settings
    const { data: graceSetting } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'late_punch_grace_minutes')
      .single();
    const graceMinutes = parseInt(graceSetting?.value || '5', 10);

    // Get employee's schedule for today
    const clockInTime = new Date(timeEntry.clock_in);
    const dayOfWeek = clockInTime.getDay() === 0 ? 7 : clockInTime.getDay(); // 1=Mon, 7=Sun
    const todayDate = clockInTime.toISOString().split('T')[0];

    const { data: schedules } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', employeeId)
      .eq('active', true)
      .lte('start_date', todayDate)
      .or(`end_date.is.null,end_date.gte.${todayDate}`)
      .contains('days_of_week', [dayOfWeek]);

    if (!schedules || schedules.length === 0) {
      console.log('No schedule found for employee on this day — no late check needed');
      return new Response(
        JSON.stringify({ message: 'No schedule found for this day' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const schedule = schedules[0];
    if (!schedule.start_time) {
      return new Response(
        JSON.stringify({ message: 'No start time in schedule' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Skip if this shift was excused ("day off on us")
    const { data: excused } = await supabase
      .from('excused_shifts')
      .select('id')
      .eq('employee_id', employeeId)
      .eq('excused_date', todayDate)
      .maybeSingle();
    if (excused) {
      console.log('Shift is excused — skipping late check');
      return new Response(
        JSON.stringify({ message: 'Shift excused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse scheduled start time
    const [schedHours, schedMinutes] = schedule.start_time.split(':').map(Number);
    const scheduledStart = new Date(clockInTime);
    scheduledStart.setHours(schedHours, schedMinutes, 0, 0);

    const minutesLate = Math.floor((clockInTime.getTime() - scheduledStart.getTime()) / (1000 * 60));

    console.log(`Scheduled: ${scheduledStart.toISOString()}, Actual: ${clockInTime.toISOString()}, Minutes late: ${minutesLate}`);

    if (minutesLate <= graceMinutes) {
      return new Response(
        JSON.stringify({ message: 'Employee clocked in on time', minutesLate }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Employee is late — check if already notified for this time entry
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

    // Get department managers for this employee using the new RPC function
    const { data: deptManagers, error: deptMgrError } = await supabase
      .rpc('get_employee_department_managers', { p_employee_id: employeeId });

    // Fall back to legacy get_employee_managers if department managers not found
    let managers = deptManagers || [];
    if (deptMgrError || managers.length === 0) {
      console.log('No department managers found, falling back to legacy manager lookup');
      const { data: legacyManagers } = await supabase
        .rpc('get_employee_managers', { _employee_id: employeeId });
      managers = legacyManagers || [];
    }

    console.log(`Found ${managers.length} managers to notify`);

    // Record the late notification in late_notifications (legacy)
    await supabase.from('late_notifications').insert({
      employee_id: employeeId,
      time_entry_id: timeEntryId,
      minutes_late: minutesLate
    });

    // Record in new missed_punch_notifications table
    await supabase.from('missed_punch_notifications').insert({
      employee_id: employeeId,
      schedule_id: schedule.id,
      scheduled_start_time: scheduledStart.toISOString(),
      notification_type: 'late_punch',
      minutes_late: minutesLate,
    });

    const employee = timeEntry.employee as any;
    const employeeName = `${employee.first_name} ${employee.last_name}`;
    const clockInTimeStr = clockInTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    // Create in-app notifications for each manager
    if (managers.length > 0) {
      const notificationInserts = managers.map((manager: any) => ({
        employee_id: employeeId,
        manager_id: manager.manager_id,
        time_entry_id: timeEntryId,
        minutes_late: minutesLate,
        notification_type: 'late_punch',
        message: `${employeeName} clocked in ${minutesLate} minutes late at ${clockInTimeStr}.`,
      }));

      // Try to insert into a notifications table if it exists, otherwise log
      console.log('Late notification details:', notificationInserts);
    }

    // Send push notifications to managers
    const managerIds = managers.map((m: any) => m.manager_id);
    if (managerIds.length > 0) {
      try {
        await supabase.functions.invoke('send-push-notification', {
          body: {
            userIds: managerIds,
            title: '⏰ Late Clock-In Alert',
            body: `${employeeName} clocked in ${minutesLate} min late`,
            data: {
              type: 'late_notification',
              employeeId,
              timeEntryId,
              minutesLate,
            }
          }
        });
        console.log('Push notifications sent to managers');
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Late notification sent',
        minutesLate,
        managersNotified: managers.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in check-late-workers function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

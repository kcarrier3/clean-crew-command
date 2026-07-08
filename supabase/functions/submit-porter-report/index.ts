import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  job_site_id: z.string().uuid(),
  area_label: z.string().max(120).optional().nullable(),
  issue_type: z.enum(["cleaning", "supply", "other"]),
  description: z.string().min(3).max(2000),
  reporter_name: z.string().max(120).optional().nullable(),
  reporter_contact: z.string().max(160).optional().nullable(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const url = new URL(req.url);
    // Public site-name lookup for the QR landing page
    if (req.method === "GET" || url.searchParams.get("action") === "lookup") {
      const jobSiteId = url.searchParams.get("job_site_id");
      if (!jobSiteId) {
        return new Response(JSON.stringify({ error: "job_site_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: siteRow } = await supabase
        .from("job_sites")
        .select("id, name, active")
        .eq("id", jobSiteId)
        .maybeSingle();
      if (!siteRow || !siteRow.active) {
        return new Response(JSON.stringify({ error: "not_found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ id: siteRow.id, name: siteRow.name }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert report
    const { data: report, error: insertError } = await supabase
      .from("porter_reports")
      .insert({
        job_site_id: parsed.data.job_site_id,
        area_label: parsed.data.area_label || null,
        issue_type: parsed.data.issue_type,
        description: parsed.data.description,
        reporter_name: parsed.data.reporter_name || null,
        reporter_contact: parsed.data.reporter_contact || null,
      })
      .select("id, job_site_id, issue_type, area_label, description")
      .single();
    if (insertError) throw insertError;

    // Job site name
    const { data: site } = await supabase
      .from("job_sites")
      .select("name")
      .eq("id", report.job_site_id)
      .maybeSingle();
    const siteName = site?.name ?? "a facility";

    // Find clocked-in porters for this site
    const { data: porters } = await supabase
      .from("porter_assignments")
      .select("user_id")
      .eq("job_site_id", report.job_site_id)
      .eq("active", true);

    const porterIds = (porters ?? []).map((p: any) => p.user_id);
    let onDutyPorterIds: string[] = [];
    if (porterIds.length > 0) {
      const { data: clockedIn } = await supabase
        .from("time_entries")
        .select("employee_id")
        .in("employee_id", porterIds)
        .is("clock_out", null);
      onDutyPorterIds = Array.from(new Set((clockedIn ?? []).map((t: any) => t.employee_id)));
    }

    // Managers + admins
    const { data: managerRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", ["admin", "manager"]);
    const managerIds = Array.from(new Set((managerRoles ?? []).map((r: any) => r.user_id)));

    const notifyIds = Array.from(new Set([...onDutyPorterIds, ...managerIds]));

    if (notifyIds.length > 0) {
      const title = `New ${report.issue_type} report at ${siteName}`;
      const body = `${report.area_label ? report.area_label + " – " : ""}${report.description.slice(0, 140)}`;
      await supabase.functions.invoke("send-push-notification", {
        body: {
          userIds: notifyIds,
          title,
          body,
          data: { type: "porter_report", report_id: report.id, job_site_id: report.job_site_id },
        },
      }).catch((e) => console.error("push invoke failed", e));
    }

    return new Response(
      JSON.stringify({ success: true, report_id: report.id, notified: notifyIds.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    console.error("submit-porter-report error", err);
    return new Response(
      JSON.stringify({ error: "Failed to submit report" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
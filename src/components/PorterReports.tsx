import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { MapPin, User, Phone, CheckCircle2, Clock } from "lucide-react";

interface Report {
  id: string;
  job_site_id: string;
  area_label: string | null;
  issue_type: "cleaning" | "supply" | "other";
  description: string;
  reporter_name: string | null;
  reporter_contact: string | null;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  job_sites?: { name: string };
}

export default function PorterReports() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<"open" | "acknowledged" | "resolved" | "all">("open");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    const { data, error } = await supabase
      .from("porter_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); setLoading(false); return; }
    const siteIds = Array.from(new Set((data || []).map((r: any) => r.job_site_id)));
    let sites: Record<string, { name: string }> = {};
    if (siteIds.length) {
      const { data: s } = await supabase.from("job_sites").select("id, name").in("id", siteIds);
      (s || []).forEach((x: any) => { sites[x.id] = { name: x.name }; });
    }
    setReports((data || []).map((r: any) => ({ ...r, job_sites: sites[r.job_site_id] })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("porter_reports_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "porter_reports" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const setStatus = async (id: string, status: "acknowledged" | "resolved") => {
    const patch: any = { status };
    if (status === "acknowledged") { patch.acknowledged_at = new Date().toISOString(); }
    if (status === "resolved") { patch.resolved_at = new Date().toISOString(); }
    const { error } = await supabase.from("porter_reports").update(patch).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
  };

  const filtered = reports.filter((r) => filter === "all" || r.status === filter);
  const badgeFor = (s: string) => s === "open" ? "bg-red-100 text-red-800" : s === "acknowledged" ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800";
  const typeColor = (t: string) => t === "cleaning" ? "bg-blue-100 text-blue-800" : t === "supply" ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-800";

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
        <TabsList>
          <TabsTrigger value="open">Open ({reports.filter(r => r.status === "open").length})</TabsTrigger>
          <TabsTrigger value="acknowledged">In progress</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>
      {loading ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No reports.</div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start gap-2">
                  <CardTitle className="text-base">
                    {r.job_sites?.name}{r.area_label ? ` — ${r.area_label}` : ""}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge className={typeColor(r.issue_type)}>{r.issue_type}</Badge>
                    <Badge className={badgeFor(r.status)}>{r.status}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm">{r.description}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</div>
                  {r.reporter_name && (<div className="flex items-center gap-1"><User className="h-3 w-3" />{r.reporter_name}</div>)}
                  {r.reporter_contact && (<div className="flex items-center gap-1"><Phone className="h-3 w-3" />{r.reporter_contact}</div>)}
                </div>
                {r.status !== "resolved" && (
                  <div className="flex gap-2 pt-2">
                    {r.status === "open" && (
                      <Button size="sm" variant="outline" onClick={() => setStatus(r.id, "acknowledged")}>
                        Acknowledge
                      </Button>
                    )}
                    <Button size="sm" onClick={() => setStatus(r.id, "resolved")}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark resolved
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
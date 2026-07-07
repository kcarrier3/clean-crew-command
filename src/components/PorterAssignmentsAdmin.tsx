import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Plus, Trash2, QrCode, Download, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface JobSite { id: string; name: string; }
interface Profile { id: string; first_name: string; last_name: string; job_title: string | null; }
interface Assignment { id: string; job_site_id: string; user_id: string; active: boolean; }

export default function PorterAssignmentsAdmin() {
  const { toast } = useToast();
  const [sites, setSites] = useState<JobSite[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedSite, setSelectedSite] = useState<string>("");
  const [addUserId, setAddUserId] = useState<string>("");
  const [qrArea, setQrArea] = useState<string>("");
  const [qrOpen, setQrOpen] = useState(false);

  const load = async () => {
    const [{ data: s }, { data: p }, { data: a }] = await Promise.all([
      supabase.from("job_sites").select("id, name").eq("active", true).order("name"),
      supabase.from("profiles").select("id, first_name, last_name, job_title").eq("active", true).order("last_name"),
      supabase.from("porter_assignments").select("*"),
    ]);
    setSites((s || []) as any);
    setProfiles((p || []) as any);
    setAssignments((a || []) as any);
  };

  useEffect(() => { load(); }, []);

  const siteAssignments = assignments.filter((a) => a.job_site_id === selectedSite);
  const site = sites.find((s) => s.id === selectedSite);

  const addPorter = async () => {
    if (!selectedSite || !addUserId) return;
    const { error } = await supabase.from("porter_assignments").upsert(
      { job_site_id: selectedSite, user_id: addUserId, active: true },
      { onConflict: "job_site_id,user_id" },
    );
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setAddUserId("");
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase.from("porter_assignments").update({ active }).eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("porter_assignments").delete().eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else load();
  };

  const reportUrl = selectedSite
    ? `${window.location.origin}/report/${selectedSite}${qrArea ? `?area=${encodeURIComponent(qrArea)}` : ""}`
    : "";

  const downloadQr = () => {
    const svg = document.getElementById("porter-qr-svg") as unknown as SVGSVGElement | null;
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qr-${site?.name || "location"}${qrArea ? "-" + qrArea : ""}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printQr = () => {
    const w = window.open("", "_blank");
    if (!w || !site) return;
    w.document.write(`<html><head><title>Print QR</title></head><body style="text-align:center;font-family:sans-serif;padding:40px">
      <h1>Report an issue</h1>
      <h2>${site.name}${qrArea ? " — " + qrArea : ""}</h2>
      <div>${document.getElementById("porter-qr-wrap")?.innerHTML ?? ""}</div>
      <p style="margin-top:20px">Scan with your phone camera to report a cleaning or supply issue.</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 200);
  };

  const availableProfiles = profiles.filter((p) => !siteAssignments.some((a) => a.user_id === p.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Porter Assignments & QR Codes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Select account / facility</Label>
            <Select value={selectedSite} onValueChange={setSelectedSite}>
              <SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger>
              <SelectContent>
                {sites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {selectedSite && (
            <>
              <div className="space-y-2">
                <Label>Porters for this account</Label>
                {siteAssignments.length === 0 && (<p className="text-sm text-muted-foreground">No porters assigned.</p>)}
                {siteAssignments.map((a) => {
                  const p = profiles.find((pp) => pp.id === a.user_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between border rounded-md p-2">
                      <div>
                        <div className="font-medium">{p ? `${p.first_name} ${p.last_name}` : a.user_id}</div>
                        <div className="text-xs text-muted-foreground">{p?.job_title}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <Switch checked={a.active} onCheckedChange={(v) => toggleActive(a.id, v)} />
                          Active
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => remove(a.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-2">
                  <Select value={addUserId} onValueChange={setAddUserId}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Add a porter" /></SelectTrigger>
                    <SelectContent>
                      {availableProfiles.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name} {p.job_title ? `— ${p.job_title}` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={addPorter} disabled={!addUserId}><Plus className="h-4 w-4 mr-1" />Add</Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  When a QR-code report comes in, only porters who are currently clocked in are notified along with managers.
                </p>
              </div>

              <div className="border-t pt-4">
                <Dialog open={qrOpen} onOpenChange={setQrOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline"><QrCode className="h-4 w-4 mr-2" />Generate QR code</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>QR code for {site?.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Area label (optional)</Label>
                        <Input value={qrArea} onChange={(e) => setQrArea(e.target.value)} placeholder="e.g. 2nd floor men's restroom" />
                      </div>
                      <div id="porter-qr-wrap" className="flex justify-center p-4 bg-white">
                        <QRCodeSVG id="porter-qr-svg" value={reportUrl} size={220} includeMargin />
                      </div>
                      <div className="text-xs text-muted-foreground break-all">{reportUrl}</div>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={downloadQr}><Download className="h-4 w-4 mr-1" />SVG</Button>
                        <Button onClick={printQr}><Printer className="h-4 w-4 mr-1" />Print</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
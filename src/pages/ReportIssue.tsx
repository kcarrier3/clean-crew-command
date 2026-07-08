import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ReportIssue() {
  const { jobSiteId } = useParams<{ jobSiteId: string }>();
  const [params] = useSearchParams();
  const areaFromQr = params.get("area") || "";

  const [siteName, setSiteName] = useState<string>("");
  const [siteError, setSiteError] = useState<string>("");
  const [issueType, setIssueType] = useState<"cleaning" | "supply" | "other">("cleaning");
  const [area, setArea] = useState(areaFromQr);
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!jobSiteId) return;
    (async () => {
      const { data, error } = await supabase.functions.invoke("submit-porter-report", {
        method: "GET",
        headers: { "x-lookup-site": jobSiteId },
        body: undefined as any,
      } as any);
      // Fallback: use fetch directly since functions.invoke doesn't easily support GET with query params
      try {
        const base = (supabase as any).functionsUrl || `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
        const res = await fetch(`${base}/submit-porter-report?action=lookup&job_site_id=${encodeURIComponent(jobSiteId)}`, {
          headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        });
        if (!res.ok) {
          setSiteError("This location code is invalid or inactive.");
          return;
        }
        const json = await res.json();
        setSiteName(json.name);
      } catch {
        setSiteError("This location code is invalid or inactive.");
      }
      // silence unused-var warnings
      void data; void error;
    })();
  }, [jobSiteId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobSiteId || description.trim().length < 3) return;
    setSubmitting(true);
    const { error } = await supabase.functions.invoke("submit-porter-report", {
      body: {
        job_site_id: jobSiteId,
        area_label: area || null,
        issue_type: issueType,
        description: description.trim(),
        reporter_name: name || null,
        reporter_contact: contact || null,
      },
    });
    setSubmitting(false);
    if (!error) setSubmitted(true);
  };

  if (siteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-destructive">{siteError}</CardContent></Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="h-14 w-14 text-green-600 mx-auto" />
            <h1 className="text-2xl font-bold">Thanks — report submitted!</h1>
            <p className="text-muted-foreground">
              Our on-duty porter and management team have been notified and will address this shortly.
            </p>
            <Button onClick={() => { setSubmitted(false); setDescription(""); setName(""); setContact(""); }}>
              Submit another
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 flex items-start justify-center">
      <Card className="max-w-md w-full my-6">
        <CardHeader>
          <CardTitle className="text-2xl">Report an issue</CardTitle>
          <p className="text-sm text-muted-foreground">{siteName || "Loading…"}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label>What kind of issue?</Label>
              <RadioGroup value={issueType} onValueChange={(v: any) => setIssueType(v)} className="mt-2 grid grid-cols-3 gap-2">
                {[
                  { v: "cleaning", l: "Cleaning" },
                  { v: "supply", l: "Supply" },
                  { v: "other", l: "Other" },
                ].map((o) => (
                  <label key={o.v} className={`border rounded-md p-2 text-center cursor-pointer text-sm ${issueType === o.v ? "border-primary bg-primary/10" : ""}`}>
                    <RadioGroupItem value={o.v} className="sr-only" />
                    {o.l}
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label htmlFor="area">Location / area (optional)</Label>
              <Input id="area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. 2nd floor men's restroom" />
            </div>
            <div>
              <Label htmlFor="desc">Describe the issue *</Label>
              <Textarea id="desc" required minLength={3} value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Out of paper towels, spill in hallway, etc." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label htmlFor="name">Your name (optional)</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="contact">Phone / email (optional)</Label>
                <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} />
              </div>
            </div>
            <Button type="submit" disabled={submitting || !siteName} className="w-full">
              {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</> : "Submit report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
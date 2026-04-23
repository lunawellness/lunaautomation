import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { CheckCircle2, AlertCircle, ExternalLink, Loader2, Wifi } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SETTING_GROUPS = [
  {
    title: "Email (Gmail)",
    description: "Sends all automated emails via your Gmail account. Requires a Gmail App Password — not your regular Gmail password.",
    keys: [
      { key: "gmail_user",        label: "Gmail Address",      placeholder: "info@lunafloat.ca",       type: "text",     required: true  },
      { key: "gmail_app_password",label: "Gmail App Password", placeholder: "xxxx xxxx xxxx xxxx",     type: "password", required: true  },
      { key: "staff_email",       label: "Staff Alert Email",  placeholder: "info@lunafloat.ca",       type: "text",     required: true  },
    ],
  },
  {
    title: "MINDBODY",
    description: "Apply $25 credits and verify first-time visits via the MINDBODY API. Use Site ID -99 and your sandbox credentials for testing, then swap to live credentials once approved.",
    keys: [
      { key: "mindbody_site_id",        label: "Site ID",             placeholder: "-99 (sandbox) or your real site ID", type: "text",     required: true  },
      { key: "mindbody_source_name",    label: "Source Name",         placeholder: "lunawellnesscenter",                 type: "text",     required: true  },
      { key: "mindbody_source_password",label: "Source Password",     placeholder: "Your source password",               type: "password", required: true  },
      { key: "mindbody_api_key",        label: "API Key (live only)", placeholder: "Issued after live access approved",   type: "password", required: false },
    ],
    testRoute: "/api/mindbody/test",
  },
  {
    title: "Google Reviews (Places API)",
    description: "Polls for new 5-star reviews every 30 minutes to trigger automatic $25 credits. Requires a Google Cloud API key with Places API enabled.",
    keys: [
      { key: "google_places_api_key", label: "Google Places API Key", placeholder: "AIzaSy...", type: "password", required: true },
    ],
  },
  {
    title: "General",
    description: "Core configuration for the automation.",
    keys: [
      { key: "google_review_link", label: "Google Review Link",        placeholder: "https://g.page/r/xxx/review",      type: "text", required: true },
      { key: "base_url",           label: "This Server's Public URL",  placeholder: "https://your-deployed-url.com",    type: "text", required: true },
    ],
  },
];

export default function Settings() {
  const { toast } = useToast();
  const [values, setValues]           = useState<Record<string, string>>({});
  const [saved, setSaved]             = useState<Record<string, boolean>>({});
  const [testResult, setTestResult]   = useState<{ ok: boolean; message: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: currentSettings = [] } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });

  const currentMap = Object.fromEntries(currentSettings.map((s: any) => [s.key, s.value]));

  const saveSetting = useMutation({
    mutationFn: ({ key, value }: { key: string; value: string }) =>
      apiRequest("POST", "/api/settings", { key, value }),
    onSuccess: (_, { key }) => {
      setSaved(p => ({ ...p, [key]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2000);
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({ title: "Saved", description: `${key} updated.` });
    },
    onError: () => toast({ title: "Error", description: "Failed to save setting.", variant: "destructive" }),
  });

  const handleSave = (key: string) => {
    const value = values[key];
    if (value === undefined) return;
    saveSetting.mutate({ key, value });
  };

  const handleTestMB = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/mindbody/test", {});
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Request failed — server may be offline" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Connect your services to activate the full automation.</p>
      </div>

      {/* MINDBODY status banner */}
      <Card className="border-teal-200 bg-teal-50 dark:bg-teal-950/20">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-teal-800 dark:text-teal-400">MINDBODY Sandbox Ready</p>
              <p className="text-xs text-teal-700 dark:text-teal-500">
                Sandbox credentials are saved (Site ID: -99). Click "Test Connection" in the MINDBODY section below to verify.
                Once your live access is approved (1–2 business days), update Site ID and credentials to go live.
              </p>
              <a
                href="https://developers.mindbodyonline.com"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-teal-800 dark:text-teal-400 underline"
              >
                developers.mindbodyonline.com <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Base URL warning if still localhost or broken tunnel */}
      {(currentMap["base_url"] || "").includes("localhost") || (currentMap["base_url"] || "").includes("trycloudflare") ? (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-800 dark:text-amber-400">Public URL not set — star links won't work in emails</p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Deploy this server to Render.com (free), then paste the URL into "This Server's Public URL" in General settings below.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {SETTING_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{group.title}</CardTitle>
            <CardDescription className="text-xs">{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {group.keys.map(({ key, label, placeholder, type, required }) => {
              const current = currentMap[key] || "";
              const hasValue = !!current;
              const inputValue = values[key] ?? "";

              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs font-medium">{label}</Label>
                    {required && <Badge variant="outline" className="text-[10px] px-1 py-0">Required</Badge>}
                    {hasValue && <CheckCircle2 className="w-3 h-3 text-green-500" />}
                  </div>
                  {current && (
                    <p className="text-xs text-muted-foreground">
                      Current: <span className="font-mono">{current}</span>
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Input
                      type={type}
                      placeholder={placeholder}
                      value={inputValue}
                      onChange={e => setValues(p => ({ ...p, [key]: e.target.value }))}
                      className="flex-1 font-mono text-xs"
                      data-testid={`input-${key}`}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSave(key)}
                      disabled={!inputValue || saveSetting.isPending}
                      data-testid={`button-save-${key}`}
                    >
                      {saved[key] ? "Saved ✓" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Test connection button for MINDBODY */}
            {"testRoute" in group && (
              <div className="pt-2 border-t space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTestMB}
                  disabled={testLoading}
                  className="gap-2"
                  data-testid="button-test-mindbody"
                >
                  {testLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wifi className="w-3 h-3" />}
                  Test MINDBODY Connection
                </Button>
                {testResult && (
                  <div className={`flex items-start gap-2 p-2 rounded text-xs ${testResult.ok ? "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-400" : "bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-400"}`}>
                    {testResult.ok
                      ? <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0" />
                      : <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                    }
                    <span>{testResult.message}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

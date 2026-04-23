import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Mail, Star, Gift, RefreshCw, Search, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Stats {
  totalFirstVisits: number;
  emailsSent: number;
  ratingsReceived: number;
  fiveStarRatings: number;
  reviewsDetected: number;
  creditsApplied: number;
}

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  serviceName: string;
  visitDate: string;
  rating: number | null;
  creditApplied: boolean;
  creditPending: boolean;
  reviewDetectedAt: string | null;
  feedbackEmailSentAt: string | null;
}

export default function Dashboard() {
  const { toast } = useToast();

  const { data: stats } = useQuery<Stats>({
    queryKey: ["/api/stats"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const runPoller = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/run-poller"),
    onSuccess: () => {
      toast({ title: "Review poller triggered", description: "Checking Google for new reviews now." });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
        queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      }, 3000);
    },
  });

  const recent = (clients || []).slice(0, 8);
  const conversionRate = stats && stats.ratingsReceived > 0
    ? Math.round((stats.fiveStarRatings / stats.ratingsReceived) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Luna Wellness post-visit automation</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runPoller.mutate()}
          disabled={runPoller.isPending}
          data-testid="button-run-poller"
        >
          <Search className="w-3.5 h-3.5 mr-1.5" />
          Check Reviews Now
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "First Visits", value: stats?.totalFirstVisits ?? 0, icon: Users, color: "text-primary" },
          { label: "Emails Sent", value: stats?.emailsSent ?? 0, icon: Mail, color: "text-blue-600" },
          { label: "Ratings Received", value: stats?.ratingsReceived ?? 0, icon: Star, color: "text-amber-500" },
          { label: "5-Star Ratings", value: stats?.fiveStarRatings ?? 0, icon: Star, color: "text-amber-500" },
          { label: "Reviews Detected", value: stats?.reviewsDetected ?? 0, icon: Search, color: "text-violet-600" },
          { label: "Credits Applied", value: stats?.creditsApplied ?? 0, icon: Gift, color: "text-green-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="border-border" data-testid={`stat-${label.toLowerCase().replace(/ /g, "-")}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Funnel Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { label: "First visits entered", value: stats?.totalFirstVisits ?? 0, total: stats?.totalFirstVisits ?? 1 },
            { label: "Emails sent", value: stats?.emailsSent ?? 0, total: stats?.totalFirstVisits ?? 1 },
            { label: "Ratings received", value: stats?.ratingsReceived ?? 0, total: stats?.totalFirstVisits ?? 1 },
            { label: "5-star ratings", value: stats?.fiveStarRatings ?? 0, total: stats?.totalFirstVisits ?? 1 },
            { label: "Credits applied ($25 each)", value: stats?.creditsApplied ?? 0, total: stats?.totalFirstVisits ?? 1 },
          ].map(({ label, value, total }) => {
            const pct = total > 0 ? Math.round((value / total) * 100) : 0;
            return (
              <div key={label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium text-foreground">{value} <span className="text-muted-foreground">({pct}%)</span></span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Recent clients */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Recent First Visits</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No clients yet. Connect MINDBODY or run a test simulation from Settings.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recent.map((c) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3" data-testid={`row-client-${c.id}`}>
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                    {c.firstName[0]}{c.lastName?.[0] || ""}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.firstName} {c.lastName}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.serviceName} · {new Date(c.visitDate).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    {c.feedbackEmailSentAt && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Email ✓</Badge>}
                    {c.rating && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${c.rating === 5 ? "border-amber-400 text-amber-600" : ""}`}>
                        {c.rating}★
                      </Badge>
                    )}
                    {c.creditApplied && <Badge className="text-[10px] px-1.5 py-0 bg-green-600">$25 ✓</Badge>}
                    {c.creditPending && !c.creditApplied && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-violet-600 border-violet-400">Pending</Badge>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

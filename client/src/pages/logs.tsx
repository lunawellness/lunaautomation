import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Log {
  id: number;
  clientId: number | null;
  mindbodyClientId: string | null;
  event: string;
  details: string | null;
  createdAt: string;
}

const eventConfig: Record<string, { label: string; color: string }> = {
  webhook_received:                    { label: "Webhook", color: "bg-slate-100 text-slate-600 border-slate-200" },
  first_visit_confirmed:               { label: "First Visit", color: "bg-blue-100 text-blue-700 border-blue-200" },
  feedback_email_sent:                 { label: "Email Sent", color: "bg-sky-100 text-sky-700 border-sky-200" },
  feedback_email_failed:               { label: "Email Failed", color: "bg-red-100 text-red-700 border-red-200" },
  rating_received:                     { label: "Rating", color: "bg-amber-100 text-amber-700 border-amber-200" },
  review_request_email_sent:           { label: "Review Email", color: "bg-violet-100 text-violet-700 border-violet-200" },
  review_detected:                     { label: "Review Detected", color: "bg-green-100 text-green-700 border-green-200" },
  credit_applied:                      { label: "$25 Credit ✓", color: "bg-green-100 text-green-700 border-green-200" },
  credit_failed_mindbody_not_configured: { label: "Credit Logged", color: "bg-orange-100 text-orange-700 border-orange-200" },
  test_visit_simulated:                { label: "Test", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function Logs() {
  const { data: logs = [], isLoading } = useQuery<Log[]>({
    queryKey: ["/api/logs"],
  });

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Activity Log</h1>
        <p className="text-sm text-muted-foreground">Full audit trail of every automation event</p>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : logs.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => {
                const cfg = eventConfig[log.event] || { label: log.event, color: "bg-muted text-muted-foreground border-border" };
                let details: any = null;
                try { details = log.details ? JSON.parse(log.details) : null; } catch {}

                return (
                  <div key={log.id} className="flex items-start gap-3 px-4 py-3" data-testid={`row-log-${log.id}`}>
                    <div className="shrink-0 pt-0.5">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${cfg.color}`}>{cfg.label}</Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      {log.mindbodyClientId && (
                        <p className="text-xs font-medium text-foreground">Client {log.mindbodyClientId}</p>
                      )}
                      {details && (
                        <p className="text-xs text-muted-foreground truncate">
                          {details.firstName && `${details.firstName} ${details.lastName || ""} · `}
                          {details.email && `${details.email} · `}
                          {details.rating && `${details.rating}★ · `}
                          {details.creditApplied !== undefined && (details.creditApplied ? "$25 applied" : "Credit logged (MINDBODY pending)")}
                          {details.reviewText && `"${details.reviewText.substring(0, 60)}…"`}
                        </p>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(log.createdAt).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

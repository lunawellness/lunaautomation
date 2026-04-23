import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { PlayCircle, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Client {
  id: number;
  mindbodyClientId: string;
  firstName: string;
  lastName: string;
  email: string;
  serviceName: string;
  visitDate: string;
  feedbackEmailSentAt: string | null;
  rating: number | null;
  reviewRequestEmailSentAt: string | null;
  creditPending: boolean;
  creditApplied: boolean;
  creditAppliedAt: string | null;
  reviewDetectedAt: string | null;
  reviewText: string | null;
}

function StatusBadge({ client }: { client: Client }) {
  if (client.creditApplied) return <Badge className="bg-green-600 text-white">$25 Credit Applied</Badge>;
  if (client.creditPending) return <Badge className="bg-violet-100 text-violet-700 border border-violet-300">Awaiting Review</Badge>;
  if (client.rating === 5) return <Badge className="bg-amber-100 text-amber-700 border border-amber-300">5★ — Email Sent</Badge>;
  if (client.rating) return <Badge variant="outline">{client.rating}★ Rated</Badge>;
  if (client.feedbackEmailSentAt) return <Badge variant="outline" className="text-blue-600 border-blue-300">Email Sent</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Email Pending</Badge>;
}

export default function Clients() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [testForm, setTestForm] = useState({ firstName: "", lastName: "", email: "", serviceName: "Float Therapy" });
  const [showTest, setShowTest] = useState(false);

  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const simulate = useMutation({
    mutationFn: (data: typeof testForm) => apiRequest("POST", "/api/test/simulate-visit", data),
    onSuccess: () => {
      toast({ title: "Test visit simulated", description: `Feedback email sent to ${testForm.email}` });
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setShowTest(false);
      setTestForm({ firstName: "", lastName: "", email: "", serviceName: "Float Therapy" });
    },
    onError: () => toast({ title: "Error", description: "Failed to simulate visit", variant: "destructive" }),
  });

  const filtered = clients.filter(c =>
    `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">{clients.length} first-visit clients tracked</p>
        </div>
        <Button size="sm" onClick={() => setShowTest(!showTest)} data-testid="button-test-visit">
          <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
          Simulate Visit
        </Button>
      </div>

      {/* Test simulation panel */}
      {showTest && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Simulate a First Visit (for testing)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">First Name</Label>
              <Input value={testForm.firstName} onChange={e => setTestForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Jane" data-testid="input-first-name" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Last Name</Label>
              <Input value={testForm.lastName} onChange={e => setTestForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Smith" data-testid="input-last-name" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Email</Label>
              <Input value={testForm.email} onChange={e => setTestForm(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" type="email" data-testid="input-email" />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Service</Label>
              <Input value={testForm.serviceName} onChange={e => setTestForm(p => ({ ...p, serviceName: e.target.value }))} data-testid="input-service" />
            </div>
            <div className="col-span-2 flex gap-2">
              <Button size="sm" onClick={() => simulate.mutate(testForm)} disabled={simulate.isPending || !testForm.email || !testForm.firstName} data-testid="button-submit-test">
                {simulate.isPending ? "Sending..." : "Send Test Email Now"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setShowTest(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
          data-testid="input-search"
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {search ? "No clients match your search." : "No clients yet. Use Simulate Visit to test the flow."}
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((c) => (
                <div key={c.id} className="px-4 py-3.5" data-testid={`row-client-${c.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground">{c.firstName} {c.lastName}</span>
                        <StatusBadge client={c} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{c.email} · {c.serviceName}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.visitDate).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                  </div>
                  {c.reviewText && (
                    <p className="mt-2 text-xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">"{c.reviewText.substring(0, 120)}{c.reviewText.length > 120 ? "…" : ""}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

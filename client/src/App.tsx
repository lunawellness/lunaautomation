import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import Dashboard from "@/pages/dashboard";
import Clients from "@/pages/clients";
import Logs from "@/pages/logs";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import Sidebar from "@/components/sidebar";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router hook={useHashLocation}>
        <div className="flex h-screen bg-background overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto">
            <Switch>
              <Route path="/" component={Dashboard} />
              <Route path="/clients" component={Clients} />
              <Route path="/logs" component={Logs} />
              <Route path="/settings" component={Settings} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </Router>
      <Toaster />
    </QueryClientProvider>
  );
}

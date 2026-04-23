import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, ScrollText, Settings, Waves } from "lucide-react";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/logs", label: "Activity Log", icon: ScrollText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-56 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Waves className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-bold text-sidebar-foreground leading-tight">LUNA WELLNESS</p>
            <p className="text-[10px] text-sidebar-foreground/50 leading-tight">Automation</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = location === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
              data-testid={`nav-${label.toLowerCase().replace(" ", "-")}`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <p className="text-[10px] text-sidebar-foreground/40 leading-tight">Chilliwack, BC</p>
        <p className="text-[10px] text-sidebar-foreground/40">lunawellnesscentre.ca</p>
      </div>
    </aside>
  );
}

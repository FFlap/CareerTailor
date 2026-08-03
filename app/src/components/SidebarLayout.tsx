import { SignedIn, SignedOut, UserButton } from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Briefcase,
  FileText,
  Flame,
  LayoutDashboard,
  LayoutTemplate,
  LogIn,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/generate", label: "Generate", icon: Sparkles },
  { to: "/job-applications", label: "Applications", icon: Briefcase },
  { to: "/statistics", label: "Statistics", icon: BarChart3 },
  { to: "/gallery", label: "Documents", icon: FileText },
  { to: "/roast", label: "Roast", icon: Flame },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

const STORAGE_KEY = "workspaceSidebarCollapsed";

/**
 * One sidebar, no second navigation: theme and account live in its footer.
 * Below `lg` the rail would eat the page, so it becomes a drawer.
 */
export default function SidebarLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Read persisted state after mount so the server and client agree on markup.
  useEffect(() => {
    setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "true");
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "true" : "false");
  }, [collapsed]);

  // Escape closes the drawer, and a route change should not leave it open.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Rail — lg and up */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white lg:flex dark:border-slate-800 dark:bg-slate-900",
          "transition-[width] duration-200 ease-out motion-reduce:transition-none",
          collapsed ? "w-[3.75rem]" : "w-56",
        )}
      >
        <SidebarBody
          collapsed={collapsed}
          isDark={isDark}
          onToggleTheme={toggleTheme}
          onToggleCollapse={() => setCollapsed((value) => !value)}
        />
      </aside>

      {/* Drawer — below lg */}
      <div
        className={cn(
          "fixed inset-0 z-40 lg:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!drawerOpen}
      >
        <button
          type="button"
          tabIndex={drawerOpen ? 0 : -1}
          aria-label="Close navigation"
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "absolute inset-0 bg-slate-950/30 transition-opacity duration-200 motion-reduce:transition-none",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "absolute inset-y-0 left-0 flex w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
            "transition-transform duration-200 ease-out motion-reduce:transition-none",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <SidebarBody
            collapsed={false}
            isDark={isDark}
            onToggleTheme={toggleTheme}
            onNavigate={() => setDrawerOpen(false)}
            onClose={() => setDrawerOpen(false)}
          />
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* The only top bar, and only where the rail cannot be shown. */}
        <div className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/90">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="rounded-md p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link
            to="/"
            className="font-display text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-50"
          >
            CareerTailor
          </Link>
        </div>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({
  collapsed,
  isDark,
  onToggleTheme,
  onToggleCollapse,
  onNavigate,
  onClose,
}: {
  collapsed: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-slate-200 dark:border-slate-800",
          collapsed ? "justify-center px-2" : "justify-between px-3",
        )}
      >
        {!collapsed && (
          <Link
            to="/"
            onClick={onNavigate}
            className="font-display text-sm font-semibold tracking-tight text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-50"
          >
            CareerTailor
          </Link>
        )}

        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-md p-1.5 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <SignedOut>
          <Link
            to="/sign-in"
            onClick={onNavigate}
            title={collapsed ? "Sign in" : undefined}
            className={cn(
              "flex h-9 items-center justify-center rounded-md bg-slate-900 text-[13px] font-medium text-white transition-colors hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white",
            )}
          >
            {collapsed ? <LogIn className="h-4 w-4" /> : "Sign in"}
          </Link>
        </SignedOut>

        <SignedIn>
          <ul className="space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "group/nav flex h-9 items-center rounded-md text-[13px] text-slate-600 outline-none transition-colors",
                    "hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15",
                    "dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100",
                    collapsed ? "justify-center px-0" : "gap-2.5 px-2.5",
                  )}
                  activeProps={{
                    className:
                      "bg-slate-100 font-medium text-slate-900 dark:bg-slate-800 dark:text-slate-50",
                  }}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {/* The label collapses by width so the icon never jumps. */}
                  <span
                    className={cn(
                      "overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200 ease-out motion-reduce:transition-none",
                      collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
          </ul>
        </SignedIn>
      </nav>

      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-slate-200 p-2 dark:border-slate-800",
          collapsed ? "flex-col" : "justify-between",
        )}
      >
        <div className={cn("flex items-center", collapsed ? "" : "gap-1")}>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            title={isDark ? "Light theme" : "Dark theme"}
            className="rounded-md p-2 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center px-1">
          <SignedIn>
            <UserButton
            afterSignOutUrl="/"
            appearance={{
              elements: {
                userButtonAvatarBox: "h-7 w-7",
                userButtonTrigger: "h-7 w-7",
              },
              }}
            />
          </SignedIn>
        </div>
      </div>
    </>
  );
}

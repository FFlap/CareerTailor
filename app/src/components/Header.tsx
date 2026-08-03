import {
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/tanstack-react-start";
import { Link } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/generate", label: "Generate" },
  { to: "/job-applications", label: "Applications" },
  { to: "/statistics", label: "Statistics" },
  { to: "/templates", label: "Templates" },
  { to: "/roast", label: "Roast" },
] as const;

export default function Header() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDarkMode = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5 sm:px-8">
        <Link
          to="/"
          className="shrink-0 font-display text-sm font-semibold tracking-tight text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:text-slate-50"
        >
          CareerTailor
        </Link>

        <SignedIn>
          <div className="hidden items-center gap-0.5 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-[13px] text-slate-500 outline-none transition-colors",
                  "hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15",
                  "dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100",
                  "[&.active]:font-medium [&.active]:text-slate-900 dark:[&.active]:text-slate-50",
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </SignedIn>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleDarkMode}
            aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
            className="rounded-md p-2 text-slate-400 outline-none transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-slate-900/15 dark:hover:bg-slate-900 dark:hover:text-slate-100"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

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
          <SignedOut>
            <Link
              to="/sign-in"
              className="rounded-md bg-slate-900 px-3 py-1.5 text-[13px] font-medium text-white outline-none transition-colors hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-slate-900/25 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Sign in
            </Link>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}

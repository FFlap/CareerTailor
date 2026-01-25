import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/generate', label: 'Generate', icon: 'add_box' },
  { to: '/job-applications', label: 'Job Applications', icon: 'work_outline' },
  { to: '/gallery', label: 'Documents Gallery', icon: 'collections' },
  { to: '/roast', label: 'Roast', icon: 'local_fire_department' },
  { to: '/templates', label: 'Templates', icon: 'auto_awesome' },
]

type SidebarLayoutProps = {
  children: ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100 font-sans">
      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-8 lg:flex-row">
          <aside className="hidden w-full shrink-0 space-y-6 lg:block lg:w-64">
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:sticky lg:top-24">
              <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Workspace</p>
              </div>
              <nav className="space-y-1 p-2" aria-label="Workspace">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white"
                    activeProps={{
                      className:
                        'bg-slate-50 text-slate-900 dark:bg-slate-700/50 dark:text-white',
                    }}
                  >
                    <span className="material-icons-outlined text-sm text-primary/70 group-hover:text-primary">{item.icon}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </div>
          </aside>

          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </main>
    </div>
  )
}

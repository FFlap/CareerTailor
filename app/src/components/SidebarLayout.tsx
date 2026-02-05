import { Link, useRouterState } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { SignedIn, UserButton, useUser } from '@clerk/tanstack-react-start'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/generate', label: 'Generate', icon: 'add_box' },
  { to: '/job-applications', label: 'Job Applications', icon: 'work_outline' },
  { to: '/statistics', label: 'Statistics', icon: 'insights' },
  { to: '/gallery', label: 'Documents Gallery', icon: 'collections' },
  { to: '/roast', label: 'Roast', icon: 'local_fire_department' },
  { to: '/templates', label: 'Templates', icon: 'auto_awesome' },
]


type SidebarLayoutProps = {
  children: ReactNode
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {  const { user } = useUser()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('workspaceSidebarCollapsed') === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem('workspaceSidebarCollapsed', collapsed ? 'true' : 'false')
  }, [collapsed])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      {/* Sidebar */}
      <aside
        className={cn(
          'hidden flex-col border-r border-slate-200 bg-white transition-[width] duration-300 dark:border-slate-700 dark:bg-slate-800 lg:flex',
          collapsed ? 'w-20' : 'w-64',
        )}
      >
        {/* Header / Logo */}
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-700">
          <Link to="/" className={cn("flex items-center gap-2 transition-opacity duration-300", collapsed ? "hidden opacity-0" : "flex opacity-100")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="material-icons-outlined text-xl text-white">description</span>
            </div>
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">
              <span className="text-slate-900 dark:text-white">Career</span>
              <span className="text-primary">Tailor</span>
            </span>
          </Link>
          
           {/* Collapsed Logo (Icon Only) */}
           <Link to="/" className={cn("flex items-center justify-center transition-opacity duration-300", collapsed ? "flex opacity-100 mx-auto" : "hidden opacity-0")}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <span className="material-icons-outlined text-xl text-white">description</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className={cn(
              'flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white',
              collapsed && 'hidden',
            )}
            aria-label="Collapse sidebar"
          >
            <span className="material-icons-outlined text-[20px]">chevron_left</span>
          </button>
        </div>
        
        {/* Expand Button for Collapsed State */}
        <div className={cn("flex justify-center py-2", !collapsed && "hidden")}>
             <button
            type="button"
            onClick={() => setCollapsed((prev) => !prev)}
            className="flex items-center justify-center rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
            aria-label="Expand sidebar"
          >
            <span className="material-icons-outlined text-[20px]">chevron_right</span>
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700/50 dark:hover:text-white',
                collapsed && 'justify-center px-0',
              )}
              activeProps={{
                className:
                  'bg-slate-100 text-slate-900 dark:bg-slate-700 dark:text-white',
              }}
            >
              <span className="material-icons-outlined text-[20px] text-slate-400 transition-colors group-hover:text-primary group-[.active]:text-primary dark:text-slate-500">
                {item.icon}
              </span>
              <span
                className={cn(
                  'whitespace-nowrap transition-all duration-300',
                  collapsed ? 'hidden w-0 opacity-0' : 'block w-auto opacity-100',
                )}
              >
                {item.label}
              </span>
            </Link>
          ))}
        </nav>
        
        {/* User Profile Footer */}
        <div className="shrink-0 border-t border-slate-100 p-4 dark:border-slate-700">
            <SignedIn>
                <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "")}>
                    <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-primary/10">
                        <UserButton 
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: "h-9 w-9",
                                    userButtonTrigger: "h-9 w-9"
                                }
                            }}
                        />
                    </div>
                    <div className={cn("overflow-hidden transition-all duration-300", collapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user?.fullName || 'User'}</p>
                        <p className="truncate text-xs text-slate-500">Premium Plan</p>
                    </div>
                </div>
            </SignedIn>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}

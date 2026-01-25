import { Link } from '@tanstack/react-router'
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/tanstack-start'
import { useState, useEffect } from 'react'

export default function Header() {
  const { user } = useUser()
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (document.documentElement.classList.contains('dark')) {
      setIsDark(true)
    }
  }, [])

  const toggleDarkMode = () => {
    const newIsDark = !isDark
    setIsDark(newIsDark)
    if (newIsDark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="material-icons-outlined text-xl text-white">description</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">CareerTailor</span>
            </Link>
            <div className="hidden md:flex space-x-4">
              <Link to="/dashboard" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary dark:text-slate-400 [&.active]:bg-primary/10 [&.active]:text-primary">Dashboard</Link>
              <Link to="/generate" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary dark:text-slate-400 [&.active]:bg-primary/10 [&.active]:text-primary">Generate</Link>
              <Link to="/templates" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-primary dark:text-slate-400 [&.active]:bg-primary/10 [&.active]:text-primary">Templates</Link>
            </div>
          </div>
          
          <div className="hidden flex-1 mx-8 max-w-md lg:flex">
            <div className="relative w-full">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <span className="material-icons-outlined text-sm text-slate-400">search</span>
              </span>
              <input 
                type="text" 
                placeholder="Search documents, jobs, or templates..." 
                className="block w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-3 leading-5 placeholder-slate-400 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary sm:text-sm dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={toggleDarkMode}
              className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <span className="material-icons-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
            </button>
            
            <SignedIn>
                <div className="flex items-center gap-3 border-l border-slate-200 pl-4 dark:border-slate-800">
                    <div className="hidden text-right sm:block">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{user?.fullName || 'User'}</p>
                    <p className="text-xs text-slate-500">Premium Plan</p>
                    </div>
                    <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full ring-2 ring-primary/20">
                        <UserButton 
                            appearance={{
                                elements: {
                                    userButtonAvatarBox: "h-10 w-10",
                                    userButtonTrigger: "h-10 w-10"
                                }
                            }}
                        />
                    </div>
                </div>
            </SignedIn>
            <SignedOut>
                 <div className="border-l border-slate-200 pl-4 dark:border-slate-800">
                    <Link to="/sign-in" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90">
                        Sign In
                    </Link>
                 </div>
            </SignedOut>
          </div>
        </div>
      </div>
    </nav>
  )
}

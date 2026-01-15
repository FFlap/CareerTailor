import { Link } from '@tanstack/react-router'
import { SignedIn, SignedOut, UserButton } from '@clerk/tanstack-start'

export default function Header() {
  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4">
        <Link to="/" className="font-semibold tracking-tight">
          ResumeGen
        </Link>
        <SignedIn>
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
            Dashboard
          </Link>
          <Link to="/generate" className="text-sm text-muted-foreground hover:text-foreground">
            Generate
          </Link>
        </SignedIn>

        <div className="ml-auto">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <Link to="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
          </SignedOut>
        </div>
      </div>
    </header>
  )
}

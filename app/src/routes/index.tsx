import { createFileRoute, Link, Navigate } from '@tanstack/react-router'
import { Authenticated, AuthLoading, Unauthenticated } from 'convex/react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12">
      <AuthLoading>
        <p className="text-sm text-muted-foreground">Loading...</p>
      </AuthLoading>

      <Authenticated>
        <Navigate to="/dashboard" />
      </Authenticated>
      
      <Unauthenticated>
        <h1 className="text-3xl font-semibold tracking-tight">ResumeGen</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">
          Generate tailored resumes and cover letters from job posts, then edit
          in Typst.
        </p>
        <div className="mt-6 flex gap-3">
          <Link className={buttonVariants()} to="/sign-in">
            Sign in
          </Link>
          <Link
            className={cn(buttonVariants({ variant: 'outline' }))}
            to="/sign-up"
          >
            Create account
          </Link>
        </div>
      </Unauthenticated>
    </main>
  )
}

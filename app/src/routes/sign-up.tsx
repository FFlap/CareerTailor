import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/tanstack-react-start'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-5xl place-items-center px-4 py-10">
      {/* A new account has an empty profile, and every document is written from
          it, so that is where signing up leads. */}
      <SignUp routing="hash" forceRedirectUrl="/profile" signInUrl="/sign-in" />
    </main>
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { SignIn } from '@clerk/tanstack-start'

export const Route = createFileRoute('/sign-in')({
  component: SignInPage,
})

function SignInPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-5xl place-items-center px-4 py-10">
      <SignIn routing="hash" />
    </main>
  )
}

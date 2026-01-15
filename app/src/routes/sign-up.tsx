import { createFileRoute } from '@tanstack/react-router'
import { SignUp } from '@clerk/tanstack-start'

export const Route = createFileRoute('/sign-up')({
  component: SignUpPage,
})

function SignUpPage() {
  return (
    <main className="mx-auto grid min-h-[calc(100vh-3.5rem)] max-w-5xl place-items-center px-4 py-10">
      <SignUp routing="hash" />
    </main>
  )
}

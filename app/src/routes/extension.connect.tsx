import { createFileRoute } from '@tanstack/react-router'
import { SignIn, SignedIn, SignedOut, useAuth } from '@clerk/tanstack-react-start'
import { useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/extension/connect')({
  validateSearch: (search: Record<string, unknown>) => ({
    redirect_uri:
      typeof search.redirect_uri === 'string' ? search.redirect_uri : undefined,
    state: typeof search.state === 'string' ? search.state : undefined,
    auto: typeof search.auto === 'string' ? search.auto : undefined,
  }),
  component: ExtensionConnectPage,
})

function ExtensionConnectPage() {
  const { getToken, isSignedIn } = useAuth()
  const { redirect_uri, state, auto } = Route.useSearch()
  const [status, setStatus] = useState<string>('')
  const autoConnectTriedRef = useRef(false)

  const redirectUri = useMemo(() => {
    const raw = (redirect_uri || '').trim()
    if (!raw) return null
    if (!raw.startsWith('chrome-extension://')) return null
    try {
      const parsed = new URL(raw)
      if (parsed.pathname !== '/pages/auth-callback.html') return null

      const allowed = String(import.meta.env.VITE_EXTENSION_IDS || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)

      if (import.meta.env.PROD && allowed.length === 0) return null
      if (allowed.length > 0 && !allowed.includes(parsed.host)) return null

      return parsed
    } catch {
      return null
    }
  }, [redirect_uri])

  async function connect() {
    if (!redirectUri) {
      setStatus(
        import.meta.env.PROD
          ? 'Invalid redirect_uri. Check VITE_EXTENSION_IDS and the extension callback URL.'
          : 'Missing or invalid redirect_uri.',
      )
      return
    }
    if (!state?.trim()) {
      setStatus('Missing connect state. Re-open connect from the extension.')
      return
    }
    setStatus('Creating token…')
    try {
      const token =
        (await getToken({ template: 'convex' }).catch(() => null)) ||
        (await getToken().catch(() => null))
      if (!token) {
        throw new Error('Unable to mint auth token.')
      }
      redirectUri.hash = `token=${encodeURIComponent(token)}&state=${encodeURIComponent(state)}`
      window.location.href = redirectUri.toString()
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to connect.')
    }
  }

  useEffect(() => {
    if (auto !== '1') return
    if (!isSignedIn) return
    if (!redirectUri) return
    if (!state?.trim()) return
    if (autoConnectTriedRef.current) return

    autoConnectTriedRef.current = true
    void connect()
  }, [auto, isSignedIn, redirectUri, state])

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">
        Connect Chrome Extension
      </h1>
      <SignedOut>
        <div className="mt-6">
          <SignIn routing="path" path="/extension/connect" />
        </div>
      </SignedOut>
      <SignedIn>
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Finish Linking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Click below to finish connecting your extension.</p>
            <Button type="button" onClick={connect}>
              Connect extension
            </Button>
            {status ? <p>{status}</p> : null}
          </CardContent>
        </Card>
      </SignedIn>
    </main>
  )
}

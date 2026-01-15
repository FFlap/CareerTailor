import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ClerkProvider, useAuth } from '@clerk/tanstack-start'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { ConvexReactClient } from 'convex/react'

import Header from '../components/Header'

import appCss from '../styles.css?url'

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string)

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'TanStack Start Starter',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        <html lang="en">
          <head>
            <HeadContent />
          </head>
          <body>
            <Header />
            {children}
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
            <Scripts />
          </body>
        </html>
      </ConvexProviderWithClerk>
    </ClerkProvider>
  )
}

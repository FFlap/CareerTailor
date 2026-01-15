import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/render/typst')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        void request
        return new Response('Typst PDF rendering is performed client-side.', {
          status: 410,
          headers: { 'Cache-Control': 'no-store' },
        })
      },
    },
  },
})

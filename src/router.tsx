import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

interface ChatContext {
  messages: any[]
  setMessages: React.Dispatch<React.SetStateAction<any[]>>
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    context: {
      messages: [],
      setMessages: () => {},
    } as ChatContext,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
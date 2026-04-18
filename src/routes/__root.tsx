import { HeadContent, Scripts, createRootRoute, Outlet } from '@tanstack/react-router'
import appCss from '../styles.css?url'

const THEME_INIT_SCRIPT = `(function(){try{var root=document.documentElement;root.classList.add('dark');root.style.colorScheme='dark';}catch(e){}})();`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, interactive-widget=resizes-content' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument() {
  return (
    <html lang="en" className="dark" style={{ colorScheme: 'dark' }} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <HeadContent />
      </head>
      <body className="font-sans max-h-screen antialiased bg-[#050505] text-slate-100">
        <Outlet />
        <Scripts />
      </body>
    </html>
  )
}
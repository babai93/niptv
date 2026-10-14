import type { Config } from '@netlify/functions'

const M3U_URL = 'https://iptv-org.github.io/iptv/index.m3u'

// Proxies the public iptv-org M3U playlist to avoid client-side CORS restrictions.
export default async () => {
  const upstream = await fetch(M3U_URL)
  if (!upstream.ok || !upstream.body) {
    console.error('Proxy error: upstream status', upstream.status)
    return new Response('Error fetching channels', { status: 500 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

export const config: Config = {
  path: '/api/channels',
}

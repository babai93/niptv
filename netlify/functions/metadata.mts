import type { Config } from '@netlify/functions'

const IPTV_API = 'https://iptv-org.github.io/api'
const SOURCES = ['channels', 'countries', 'categories'] as const

// Combines the iptv-org channel, country and category lists into one JSON object.
// The payload is several MB, so it is streamed rather than buffered.
export default async () => {
  let responses: Response[]
  try {
    responses = await Promise.all(SOURCES.map((name) => fetch(`${IPTV_API}/${name}.json`)))
  } catch (error) {
    console.error('Metadata error:', error)
    return new Response('Error fetching channel metadata', { status: 500 })
  }

  const failed = responses.find((response) => !response.ok || !response.body)
  if (failed) {
    console.error('Metadata error: upstream status', failed.status)
    return new Response('Error fetching channel metadata', { status: 500 })
  }

  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for (let i = 0; i < SOURCES.length; i++) {
          controller.enqueue(encoder.encode(`${i === 0 ? '{' : ','}"${SOURCES[i]}":`))
          const reader = responses[i].body!.getReader()
          while (true) {
            const { done, value } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
        }
        controller.enqueue(encoder.encode('}'))
        controller.close()
      } catch (error) {
        console.error('Metadata stream error:', error)
        controller.error(error)
      }
    },
  })

  return new Response(body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      'Netlify-CDN-Cache-Control': 'public, durable, max-age=3600, stale-while-revalidate=86400',
    },
  })
}

export const config: Config = {
  path: '/api/metadata',
}

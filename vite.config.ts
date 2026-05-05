import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function externalUploadPlugin() {
  const handler = (req: any, res: any, next: any) => {
    if (req.url === '/api/upload-external' && req.method === 'POST') {
      let body = ''

      req.on('data', (chunk: any) => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          const data = JSON.parse(body)

          if (!data.image || typeof data.image !== 'string') {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'image is required' }))
            return
          }

          const match = data.image.match(/^data:image\/png;base64,(.+)$/)
          if (!match) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'invalid image format' }))
            return
          }

          const buffer = Buffer.from(match[1], 'base64')
          const blob = new Blob([buffer], { type: 'image/png' })

          const filename = `miku_photo_${Date.now()}.png`

          // 1. Try file.io
          try {
            const formData = new FormData()
            formData.append('file', blob, filename)

            const response = await fetch('https://file.io/?expires=1d', {
              method: 'POST',
              body: formData,
            })

            const text = await response.text()

            if (response.ok) {
              const result = JSON.parse(text)
              if (result.success && result.link) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  url: result.link,
                  provider: 'file.io',
                }))
                return
              }
            }

            console.warn('file.io failed:', response.status, text)
          } catch (e) {
            console.warn('file.io error:', e)
          }

          // 2. Fallback to uguu.se
          try {
            const formData = new FormData()
            formData.append('files[]', blob, filename)

            const response = await fetch('https://uguu.se/upload', {
              method: 'POST',
              body: formData,
            })

            const text = await response.text()

            if (response.ok) {
              const result = JSON.parse(text)
              if (result.success && result.files?.[0]?.url) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({
                  url: result.files[0].url,
                  provider: 'uguu.se',
                }))
                return
              }
            }

            console.warn('uguu.se failed:', response.status, text)
          } catch (e) {
            console.warn('uguu.se error:', e)
          }

          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: 'All external upload providers failed',
          }))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: e instanceof Error ? e.message : String(e),
          }))
        }
      })

      return
    }

    next()
  }

  return {
    name: 'external-upload',
    configureServer(server: any) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  plugins: [react(), externalUploadPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true
    }
  },
})

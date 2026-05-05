import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

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
          const filename = `miku_photo_${Date.now()}.png`
          const tmpPath = path.join(os.tmpdir(), filename)
          fs.writeFileSync(tmpPath, buffer)

          // NOTE: We use "env -u http_proxy -u https_proxy" to bypass
          // the corporate proxy settings baked into ~/.bashrc, which
          // break all external connections when not on the corp network.

          // 1. Primary: uguu.se (confirmed working 2026-05-05)
          try {
            console.log(`[externalUploadPlugin] Trying uguu.se...`);
            const stdout = execSync(
              `env -u http_proxy -u https_proxy curl -s -L -F "files[]=@${tmpPath}" "https://uguu.se/upload"`,
              { encoding: 'utf-8', timeout: 30000 }
            )
            const result = JSON.parse(stdout)

            if (result.success && result.files?.[0]?.url) {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ url: result.files[0].url, provider: 'uguu.se' }))
              fs.unlinkSync(tmpPath)
              return
            }
            console.warn('uguu.se unexpected response:', stdout)
          } catch (e: any) {
            console.warn('uguu.se error:', e?.message || e)
          }

          // 2. Fallback: file.io (currently returning 405, kept for future recovery)
          try {
            console.log(`[externalUploadPlugin] Trying file.io...`);
            const stdout = execSync(
              `env -u http_proxy -u https_proxy curl -s -L -F "file=@${tmpPath}" "https://file.io/?expires=1d"`,
              { encoding: 'utf-8', timeout: 30000 }
            )

            // file.io may return HTML instead of JSON if API has changed
            if (stdout.trim().startsWith('{')) {
              const result = JSON.parse(stdout)
              if (result.success && result.link) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ url: result.link, provider: 'file.io' }))
                fs.unlinkSync(tmpPath)
                return
              }
            }
            console.warn('file.io failed or returned non-JSON:', stdout.substring(0, 200))
          } catch (e: any) {
            console.warn('file.io error:', e?.message || e)
          }

          if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath)

          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            error: 'All upload providers failed. Check network connectivity.',
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

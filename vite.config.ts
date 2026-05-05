import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import type { IncomingMessage, ServerResponse } from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
const PHOTO_DIR = path.resolve(__dirname, '.photos');

function getLocalIPv4() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (
        iface.family === 'IPv4' &&
        !iface.internal
      ) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

function cleanupOldPhotos() {
  if (!fs.existsSync(PHOTO_DIR)) return;

  const now = Date.now();
  for (const file of fs.readdirSync(PHOTO_DIR)) {
    if (!file.endsWith('.png')) continue;

    const filePath = path.join(PHOTO_DIR, file);
    const stat = fs.statSync(filePath);

    if (now - stat.mtimeMs > PHOTO_TTL_MS) {
      fs.unlinkSync(filePath);
    }
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function localUploadPlugin() {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? '';

    if (url === '/api/upload' && req.method === 'POST') {
      let body = '';

      req.on('data', (chunk) => {
        body += chunk.toString();

        // 画像が大きすぎる場合の保護。
        if (body.length > 20 * 1024 * 1024) {
          res.statusCode = 413;
          res.end('Payload too large');
          req.destroy();
        }
      });

      req.on('end', () => {
        try {
          cleanupOldPhotos();

          const data = JSON.parse(body);

          if (typeof data.image !== 'string') {
            return sendJson(res, 400, { error: 'image is required' });
          }

          const match = data.image.match(/^data:image\/png;base64,(.+)$/);
          if (!match) {
            return sendJson(res, 400, { error: 'invalid image format' });
          }

          const base64Data = match[1];

          if (!fs.existsSync(PHOTO_DIR)) {
            fs.mkdirSync(PHOTO_DIR, { recursive: true });
          }

          const id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          const filename = `photo_${id}.png`;
          const filePath = path.join(PHOTO_DIR, filename);

          fs.writeFileSync(filePath, base64Data, 'base64');

          const localIp = getLocalIPv4();

          const hostHeader = req.headers.host ?? `localhost:5173`;
          const port = hostHeader.includes(':')
            ? hostHeader.split(':')[1]
            : '5173';

          const shareUrl = `http://${localIp}:${port}/api/photos/${filename}`;

          return sendJson(res, 200, {
            url: shareUrl,
            expiresIn: 86400,
          });
        } catch (e) {
          return sendJson(res, 500, {
            error: e instanceof Error ? e.message : String(e),
          });
        }
      });

      return;
    }

    if (url.startsWith('/api/photos/') && req.method === 'GET') {
      try {
        cleanupOldPhotos();

        const filename = path.basename(url.split('?')[0]);

        if (!/^photo_[a-zA-Z0-9_.-]+\.png$/.test(filename)) {
          res.statusCode = 400;
          res.end('Bad request');
          return;
        }

        const filePath = path.join(PHOTO_DIR, filename);

        if (!fs.existsSync(filePath)) {
          res.statusCode = 404;
          res.end('Not found');
          return;
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'no-store');
        res.end(fs.readFileSync(filePath));
      } catch (e) {
        res.statusCode = 500;
        res.end(e instanceof Error ? e.message : String(e));
      }

      return;
    }

    next();
  };

  return {
    name: 'local-upload',
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  plugins: [react(), localUploadPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
});

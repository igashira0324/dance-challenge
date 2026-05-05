import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import os from 'os'

const localUploadPlugin = () => {
  const handler = (req: any, res: any, next: any) => {
    if (req.url === '/api/upload' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk: any) => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          const base64Data = data.image.replace(/^data:image\/png;base64,/, "");
          const id = Date.now();
          const filename = `photo_${id}.png`;
          
          // Save to a local hidden directory
          const dir = path.resolve(__dirname, '.photos');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, filename), base64Data, 'base64');
          
          // Find local network IP
          let ip = '192.168.0.10'; // default fallback
          const interfaces = os.networkInterfaces();
          for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]!) {
              if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.')) {
                ip = iface.address;
              }
            }
          }
          
          const hostHeader = req.headers.host || `${ip}:5175`;
          const port = hostHeader.split(':')[1] || '5175';
          
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ url: `http://${ip}:${port}/api/photos/${filename}` }));
        } catch (e) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: String(e) }));
        }
      });
    } else if (req.url.startsWith('/api/photos/') && req.method === 'GET') {
      const filename = req.url.split('/').pop();
      const filePath = path.resolve(__dirname, '.photos', filename);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 day
        res.end(fs.readFileSync(filePath));
      } else {
        res.statusCode = 404;
        res.end('Not found');
      }
    } else {
      next();
    }
  };

  return {
    name: 'local-upload',
    configureServer(server: any) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server: any) {
      server.middlewares.use(handler);
    }
  };
};

export default defineConfig({
  plugins: [react(), localUploadPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true
    }
  },
})

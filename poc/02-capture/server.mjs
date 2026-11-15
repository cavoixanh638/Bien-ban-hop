import {createServer} from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));
const types = {'.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.wav':'audio/wav'};
export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const absolute = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!absolute.startsWith(root + path.sep)) {response.writeHead(403); response.end('Forbidden'); return;}
    try {
      const info = await stat(absolute);
      if (!info.isFile()) throw new Error('directory');
      const content = await readFile(absolute);
      // No COOP/COEP. Verifies the non-isolated MessageChannel + transferable design.
      response.writeHead(200, {'Content-Type':types[path.extname(absolute)] || 'application/octet-stream',
        'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff'});
      response.end(content);
    } catch {response.writeHead(404); response.end('Not Found');}
  });
  await new Promise((resolve,reject) => {server.once('error', reject); server.listen(port,'127.0.0.1',resolve);});
  return {server, port:server.address().port};
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const requested = process.env.PORT ? Number(process.env.PORT) : 8765;
  const {port} = await startServer(requested);
  console.log(`Capture PoC: http://127.0.0.1:${port}/`);
}

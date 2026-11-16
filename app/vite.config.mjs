import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createLocalRecordingMiddleware } from './local-recordings.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  root,
  base:'./',
  plugins:[{name:'g10-local-recording-folder',apply:'serve',configureServer(server){
    server.middlewares.use(createLocalRecordingMiddleware(root));
  }}],
  build:{target:'es2022',outDir:resolve(root,'dist'),emptyOutDir:true},
  // G01 source lives at ../poc/01-editor, outside app/node_modules. Resolve all
  // Tiptap imports through this application rather than the source PoC folder.
  resolve:{alias:{
    '@tiptap/core':resolve(root,'node_modules/@tiptap/core'),
    '@tiptap/pm':resolve(root,'node_modules/@tiptap/pm'),
    '@tiptap/starter-kit':resolve(root,'node_modules/@tiptap/starter-kit')
  }},
  server:{fs:{allow:[resolve(root,'..')]}},
  preview:{host:'127.0.0.1',port:4173}
});

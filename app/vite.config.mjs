import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
export default defineConfig({
  root,
  base:'./',
  build:{target:'es2022',outDir:resolve(root,'dist'),emptyOutDir:true},
  server:{fs:{allow:[resolve(root,'..')]}},
  preview:{host:'127.0.0.1',port:4173}
});

import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Everything inlines into one dist/index.html — it can be hosted anywhere
// (GitHub Pages, an artifact host) or even opened as a local file.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
});

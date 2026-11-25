import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// base './' keeps asset paths relative, so the build works under any
// GitHub Pages sub-path (e.g. /expense-tracking/) without configuration.
export default defineConfig({
  base: './',
  plugins: [preact()],
});

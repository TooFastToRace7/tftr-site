import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import finish from './tools/finish.mjs';

export default defineConfig({
  site: 'https://toofasttorace.com',
  integrations: [sitemap({ customPages: ['https://toofasttorace.com/'] }), finish()],
  build: {
    inlineStylesheets: 'auto',
  },
  vite: {
    build: {
      cssCodeSplit: true,
      assetsInlineLimit: 4096,
    },
  },
});

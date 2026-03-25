import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port: 6001,
    allowedHosts: ['track.rethinkos.com', '172.21.0.1'],
    hmr: {
      host: 'track.rethinkos.com',
      protocol: 'wss',
      clientPort: 443,
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 6001,
    allowedHosts: ['track.rethinkos.com', '172.21.0.1'],
  },
});
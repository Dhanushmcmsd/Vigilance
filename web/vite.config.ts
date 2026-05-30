import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime — cached aggressively
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase client
          'vendor-supabase': ['@supabase/supabase-js'],
          // TanStack Query
          'vendor-query': ['@tanstack/react-query'],
          // Charts (Recharts is large)
          'vendor-charts': ['recharts'],
          // Map (Leaflet — react-leaflet is not used, only leaflet directly)
          'vendor-map': ['leaflet'],
        },
      },
    },
    // @react-pdf/renderer is ~1.5 MB minified and cannot be split further.
    // All other app chunks are well under 400 kB.
    chunkSizeWarningLimit: 1600,
  },
});

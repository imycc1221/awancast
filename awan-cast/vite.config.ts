import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createExplainMiddleware } from './src/agent/middleware';
import { makeAnthropicCaller } from './src/agent/anthropic';

/**
 * Dev-server endpoint for the explanation agent. Holds the Anthropic key server-side (never shipped to the
 * browser). If no key is set, explain() falls back to the deterministic reason, so the endpoint always
 * works. In production this would be a serverless function reusing the same middleware/explain core.
 */
function agentApi(): Plugin {
  return {
    name: 'awan-cast-agent-api',
    configureServer(server) {
      server.middlewares.use(
        createExplainMiddleware({
          resolveCallLlm: () => {
            const key = process.env.ANTHROPIC_API_KEY;
            if (!key) return undefined;
            const model = process.env.AWANCAST_AGENT_MODEL || 'claude-haiku-4-5-20251001';
            return makeAnthropicCaller(key, model);
          },
        }),
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), agentApi()],
  build: {
    rollupOptions: {
      output: {
        // Split heavy libraries into their own chunks so no single bundle trips the size warning
        // and the browser can cache them independently.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory')) return 'recharts';
          return undefined; // react + the rest stay with the app entry (avoids circular chunks)
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
});

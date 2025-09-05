import { fileURLToPath, URL } from 'node:url'

import { defineConfig, Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
// Small plugin to print env info at dev server start and build
function startupEnvLogger(): Plugin {
  return {
    name: 'startup-env-logger',
    apply: 'serve',
    configureServer(server) {
      const mode = server.config.mode
      const env = server.config.env
      const api = env.VITE_API_BASE_URL || 'http://localhost:8000'
      const source = env.VITE_API_BASE_URL ? 'VITE_API_BASE_URL' : 'default'
      // eslint-disable-next-line no-console
      console.info(`[Vite] mode=${mode} | API_BASE_URL(${source})=${api}${env.VITE_API_BASE_URL ? '' : ' (using fallback)'}\n`)
    },
  }
}

function buildEnvLogger(): Plugin {
  return {
    name: 'build-env-logger',
    apply: 'build',
    configResolved(config) {
      const env = config.env
      const api = env.VITE_API_BASE_URL || 'http://localhost:8000'
      const source = env.VITE_API_BASE_URL ? 'VITE_API_BASE_URL' : 'default'
      // eslint-disable-next-line no-console
      console.info(`[Build] mode=${config.mode} | API_BASE_URL(${source})=${api}${env.VITE_API_BASE_URL ? '' : ' (using fallback)'}\n`)
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    startupEnvLogger(),
    buildEnvLogger(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})

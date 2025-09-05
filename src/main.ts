import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

// Startup config logging (non-sensitive)
;(() => {
  const mode = import.meta.env.MODE
  const isDev = import.meta.env.DEV
  const isProd = import.meta.env.PROD
  const configuredApi = import.meta.env.VITE_API_BASE_URL as string | undefined
  const apiBase = configuredApi || 'http://localhost:8000'

  const source = configuredApi ? 'VITE_API_BASE_URL' : 'default'
  const note = configuredApi ? '' : ' (using fallback)'

  // Keep concise but informative
  // eslint-disable-next-line no-console
  console.info(
    `[App] mode=${mode} dev=${isDev} prod=${isProd} | API_BASE_URL(${source})=${apiBase}${note}`
  )
})()

app.mount('#app')

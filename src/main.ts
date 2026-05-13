import { ViteSSG } from 'vite-ssg'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router'
import { i18n, getLocaleRef } from './i18n'
import './assets/styles.css'

export const createApp = ViteSSG(
  App,
  // ViteSSG creates the router internally; we supply routes and shared options.
  // The /book redirect is excluded from SSG prerendering via ssgOptions in vite.config.ts.
  { routes },
  ({ app, isClient }) => {
    app.use(createPinia())
    app.use(i18n)

    // Set html[lang] imperatively on the client only. During SSG prerender
    // there is no document; unhead handles the lang attribute for the prerendered
    // shell via useHead() in App.vue.
    if (isClient) {
      document.documentElement.setAttribute('lang', getLocaleRef().value)
    }
  },
)

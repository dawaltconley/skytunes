import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://skytunes.app',
  output: 'static',
  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          includePaths: ['node_modules', 'src/styles'],
          quietDeps: true,
        },
      },
    },
  },
})

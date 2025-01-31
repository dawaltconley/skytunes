import { defineConfig } from 'astro/config'

// https://astro.build/config
export default defineConfig({
  site: 'https://skytunes.dylan.ac',
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

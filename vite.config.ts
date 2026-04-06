import { defineConfig } from 'vite'
import { resolve } from 'path'

// https://vite.dev/guide/build#library-mode
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PiniaPersistedIndexedDB',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      // vue and pinia are peerDependencies — do not bundle them
      external: ['vue', 'pinia'],
      output: {
        globals: {
          vue: 'Vue',
          pinia: 'Pinia',
        },
      },
    },
    // Generate sourcemaps for easier debugging by consumers
    sourcemap: true,
  },
})

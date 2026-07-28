import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'spreadsheet-import',
              test: /node_modules[\\/](exceljs|jszip|fast-csv|saxes|readable-stream|archiver|dayjs)[\\/]/,
              priority: 50,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/,
              priority: 40,
            },
            {
              name: 'authentication',
              test: /node_modules[\\/]@azure[\\/]msal/,
              priority: 30,
            },
            {
              name: 'icons',
              test: /node_modules[\\/]lucide-react/,
              priority: 20,
            },
            {
              name: 'vendor',
              test: /node_modules/,
              priority: 10,
            },
          ],
        },
      },
    },
  },
})

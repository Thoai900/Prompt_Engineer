import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Lưu ý: KHÔNG nhúng API key mặc định (Gemini/Groq) vào bundle nữa.
  // Key mặc định được giấu trong Firebase Cloud Functions (backend proxy); client
  // chỉ gọi proxy hoặc dùng key riêng người dùng tự nhập. Xem src/services/aiProxy.ts.
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 3000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@google/genai')) {
                return 'google-genai';
              }
              if (id.includes('lucide-react')) {
                return 'lucide';
              }
              // Thư viện nặng & chỉ dùng ở một số nơi → tách riêng để không kéo
              // theo bundle khởi động. Chúng chỉ được tải khi tab/component dùng tới.
              if (id.includes('/three/') || id.includes('\\three\\')) {
                return 'three';
              }
              if (
                id.includes('react-syntax-highlighter') ||
                id.includes('refractor') ||
                id.includes('prismjs') ||
                id.includes('highlight.js')
              ) {
                return 'syntax-highlighter';
              }
              if (id.includes('/firebase/') || id.includes('@firebase')) {
                return 'firebase';
              }
              if (id.includes('/motion') || id.includes('framer-motion')) {
                return 'motion';
              }
              return 'vendor';
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});

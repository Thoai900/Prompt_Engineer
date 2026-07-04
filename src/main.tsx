import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { WorkspaceProvider } from './context/WorkspaceContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </StrictMode>,
);

// M4 (PWA): đăng ký service worker — CHỈ ở bản build production.
// Dev không đăng ký để HMR/Vite không bị cache che (sw.js chỉ cache /assets/ hash + shell).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('Đăng ký service worker thất bại (bỏ qua):', err);
    });
  });
}

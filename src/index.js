import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// ── PWA SERVICE WORKER (offline support) ─────────────────────────────────────
// Nire-register ang service worker para gumana ang app offline sa phone/desktop.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = `${process.env.PUBLIC_URL || ''}/service-worker.js`;
    navigator.serviceWorker
      .register(swUrl)
      .then((reg) => console.log('Service worker registered:', reg.scope))
      .catch((err) => console.log('Service worker registration failed:', err));
  });
}

reportWebVitals();

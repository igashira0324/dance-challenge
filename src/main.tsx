import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

const renderError = (title: string, message: string) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `
      <div style="background:#1a1a1a; color:#ff4d4d; padding:2rem; font-family:sans-serif; min-height:100vh;">
        <h1 style="border-bottom:1px solid #333; padding-bottom:1rem;">⚠️ ${title}</h1>
        <pre style="background:#000; padding:1rem; border-radius:4px; overflow:auto; color: #fff; line-height: 1.5;">${message}</pre>
        <p style="color:#888; font-size:0.9rem;">Check the browser console and Vite terminal for more details.</p>
        <button onclick="location.reload()" style="background:#333; color:#fff; border:none; padding:0.5rem 1rem; border-radius:4px; cursor:pointer; margin-top:1rem;">Reload Page</button>
      </div>
    `;
  }
};

window.addEventListener('error', (e) => {
  console.error("GLOBAL ERROR CAPTURED:", e.message);
  renderError("Runtime Error", `${e.message}\nat ${e.filename}:${e.lineno}:${e.colno}`);
});

window.addEventListener('unhandledrejection', (e) => {
  console.error("UNHANDLED REJECTION:", e.reason);
  renderError("Promise Rejection", e.reason?.stack || e.reason || "Unknown Rejection");
});

console.log("main.tsx: Starting application...");
const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error("main.tsx: #root element not found in DOM");
} else {
  try {
    console.log("main.tsx: Mounting React root");
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log("main.tsx: Render called");
  } catch (err: any) {
    console.error("main.tsx: Render failed", err);
    renderError("Render Error", err.stack || err.message);
  }
}

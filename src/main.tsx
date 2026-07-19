import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global safety net for circular structures (prevents crashes from libraries or unexpected data)
const originalStringify = JSON.stringify;
JSON.stringify = function(obj: any, replacer?: any, space?: string | number) {
  try {
    return originalStringify(obj, replacer, space);
  } catch (err) {
    if (err instanceof TypeError && err.message.includes("circular")) {
      const cache = new WeakSet();
      return originalStringify(obj, (key, value) => {
        if (typeof value === "object" && value !== null) {
          if (cache.has(value)) return "[Circular]";
          cache.add(value);
        }
        if (typeof replacer === "function") {
          return replacer(key, value);
        }
        return value;
      }, space);
    }
    throw err;
  }
} as any;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { requestPersistentStorageOnce } from './lib/storage';

void requestPersistentStorageOnce();

// Preview switch between the two looks while the owner chooses ("wallet" default, "shipping").
try {
  const style = localStorage.getItem('bt.style');
  if (style) document.documentElement.dataset.style = style;
} catch {
  /* storage blocked – keep default look */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

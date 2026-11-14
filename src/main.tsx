import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { requestPersistentStorageOnce } from './lib/storage';
import { applyStoredTheme } from './lib/theme';
import { startPwaUpdates } from './lib/pwaUpdate';
import { startSearchIndex } from './features/search/searchIndex';
import { startOcrQueue } from './features/ocr/ocrQueue';

applyStoredTheme();
startPwaUpdates();
void requestPersistentStorageOnce();
startSearchIndex();
startOcrQueue();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

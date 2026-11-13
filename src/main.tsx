import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { requestPersistentStorageOnce } from './lib/storage';
import { startSearchIndex } from './features/search/searchIndex';

void requestPersistentStorageOnce();
startSearchIndex();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

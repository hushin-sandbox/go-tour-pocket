import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppProviders } from '@/react-app/app/bootstrap';
import { requestPersistentStorage } from '@/react-app/shared/lib';
import './index.css';

// iOS Safari は操作のないストレージを 7 日で削除する。永続化を要求しておく
void requestPersistentStorage();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
);

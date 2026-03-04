import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {HashRouter, Routes, Route} from 'react-router-dom';
import App from './App.tsx';
import SettingsPage from './pages/Settings';
import { installGlobalErrorHandlers } from './utils/debug-log';
import './index.css';

installGlobalErrorHandlers();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/chat" element={<App />} />
      </Routes>
    </HashRouter>
  </StrictMode>,
);

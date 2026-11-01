import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './vendor/98.css';
import './styles/os.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

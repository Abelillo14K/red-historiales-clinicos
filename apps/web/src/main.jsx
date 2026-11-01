import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { SesionProvider } from './plataforma/sesion/SesionContext.jsx';
import { NotificationsProvider } from './plataforma/ui/index.js';
import { registro } from './plataforma/modulos/registro.js';
import { aplicarTema, leerTema, vigilarSistema } from './plataforma/tema.js';
import './styles.css';
import './mockup.css';

aplicarTema(leerTema()); // index.html ya lo resolvió antes del primer pintado; aquí se confirma
vigilarSistema();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SesionProvider registro={registro}>
        <NotificationsProvider>
          <App />
        </NotificationsProvider>
      </SesionProvider>
    </BrowserRouter>
  </StrictMode>
);

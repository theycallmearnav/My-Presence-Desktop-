import React from 'react';
import ReactDOM from 'react-dom/client';
import gsap from 'gsap';
import { App } from './app/App';
import './styles/global.css';

gsap.config({ autoSleep: 60, force3D: true });
gsap.defaults({ overwrite: 'auto' });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

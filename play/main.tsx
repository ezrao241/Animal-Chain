// Static, single-browser copy of Animal Chain: the real game page and 3D scene, with the multiplayer API answered in the
// page (solo practice against bots). Build with `node node_modules/vite/bin/vite.js build --config play/vite.config.mjs`.
import React from 'react';
import {createRoot} from 'react-dom/client';
import '../app/globals.css';
import {installShim} from './api-shim';

(globalThis as any).__ANIMAL_CHAIN_ASSETS = new URL('./', location.href).href;
installShim();
const {default: Game} = await import('../app/page');
createRoot(document.getElementById('root')!).render(<Game/>);

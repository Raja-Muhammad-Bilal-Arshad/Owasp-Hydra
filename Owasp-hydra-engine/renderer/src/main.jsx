import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  console.error('root element not found in index.html');
} else {
  createRoot(rootEl).render(<App />);
}

import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/800.css'
import './index.css'

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

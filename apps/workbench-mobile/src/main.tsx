import React from 'react';
import ReactDOM from 'react-dom/client';
import '@axi/tokens/css';
import '@axi/core/styles.css';
import App from './App';
import './index.css';
import './styles/wechat-mobile.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

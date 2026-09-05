import React from 'react';
import ReactDOM from 'react-dom/client';
import 'antd/dist/reset.css';
import '@axi/tokens/css';
import '@axi/core/styles.css';
import '@axi/crud/styles.css';
import '@axi/shell/styles.css';
import '@axi/settings/styles.css';
import '@axi/widgets/styles.css';
import App from './App';
import { installTauriGatewayFetch } from './lib/tauriGateway';
import './index.css';

installTauriGatewayFetch();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

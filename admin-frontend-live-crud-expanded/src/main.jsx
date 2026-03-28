import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';

import './styles/base/variables.css';
import './styles/base/reset.css';
import './styles/base/app.css';

import './styles/layout/admin-layout.css';

import './styles/components/panel.css';
import './styles/components/form.css';
import './styles/components/table.css';
import './styles/components/badge.css';
import './styles/components/button.css';

import './styles/pages/login-page.css';
import './styles/pages/dashboard-page.css';
import './styles/pages/users-page.css';
import './styles/pages/comics-page.css';
import './styles/pages/guilds-page.css';
import './styles/pages/shop-page.css';
import './styles/pages/chapters-page.css';
import './styles/pages/readdy-admin-pages.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

import { ThemeProvider } from './ThemeContext'
import { registerConfirmHandler } from './services/aptos'
import { confirmTransaction } from './components/TransactionConfirmationModal'

registerConfirmHandler(confirmTransaction)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
)
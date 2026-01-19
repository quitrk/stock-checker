import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { StockChecklist } from './components/StockChecklist'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <ToastProvider>
          <div className="app">
            <StockChecklist />
            <Analytics />
          </div>
        </ToastProvider>
      </AppProvider>
    </AuthProvider>
  )
}

export default App

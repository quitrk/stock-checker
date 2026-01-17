import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { StockChecklist } from './components/StockChecklist'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <div className="app">
          <StockChecklist />
          <Analytics />
        </div>
      </ToastProvider>
    </AuthProvider>
  )
}

export default App

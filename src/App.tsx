import { ToastProvider } from './contexts/ToastContext'
import { StockChecklist } from './components/StockChecklist'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

function App() {
  return (
    <ToastProvider>
      <div className="app">
        <StockChecklist />
        <Analytics />
      </div>
    </ToastProvider>
  )
}

export default App

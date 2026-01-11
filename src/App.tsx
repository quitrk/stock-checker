import { ToastProvider } from './contexts/ToastContext'
import { StockChecklist } from './components/StockChecklist'
import './App.css'

function App() {
  return (
    <ToastProvider>
      <div className="app">
        <StockChecklist />
      </div>
    </ToastProvider>
  )
}

export default App

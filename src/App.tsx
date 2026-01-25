import { BrowserRouter, Routes, Route, useParams, useSearchParams } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { AppProvider } from './contexts/AppContext'
import { StockChecklist } from './components/StockChecklist'
import { SharedWatchlistPage } from './components/SharedWatchlistPage'
import { Analytics } from '@vercel/analytics/react'
import './App.css'

function WatchlistRoute() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const timestamp = searchParams.get('t');

  if (!id) return null;

  return (
    <SharedWatchlistPage
      watchlistId={id}
      timestamp={timestamp ? parseInt(timestamp, 10) : undefined}
    />
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppProvider>
          <ToastProvider>
            <div className="app">
              <Routes>
                <Route path="/watchlist/:id" element={<WatchlistRoute />} />
                <Route path="*" element={<StockChecklist />} />
              </Routes>
              <Analytics />
            </div>
          </ToastProvider>
        </AppProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App

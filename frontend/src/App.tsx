import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Layout from './components/layout/Layout'
import Landing from './pages/Landing'
import Estimator from './pages/Estimator'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import ModelPage from './pages/ModelPage'
import HistoryPage from './pages/HistoryPage'
import './index.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/"          element={<Landing />} />
            <Route path="/estimator" element={<Estimator />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/map"       element={<MapPage />} />
            <Route path="/model"     element={<ModelPage />} />
            <Route path="/history"   element={<HistoryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

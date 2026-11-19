import { Fragment } from 'react'
import './App.css'
import { AuthProvider } from './context/AuthContext.jsx'
import AppRoutes from './routes/AppRoutes.jsx'
import { BrowserRouter } from 'react-router-dom'

function App() {
  return (
    <Fragment>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </Fragment>
  )
}

export default App

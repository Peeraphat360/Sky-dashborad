import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { CustomerBookingApp } from './customer/CustomerBookingApp'
import './index.css'

// Two front-ends share one Vite app:
//   • /book*  → customer-facing LINE login + booking flow
//   • else    → staff/admin dashboard (existing App)
const isCustomer = window.location.pathname.startsWith('/book')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isCustomer ? <CustomerBookingApp /> : <App />}
  </React.StrictMode>,
)

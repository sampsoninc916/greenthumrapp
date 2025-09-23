import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css';
import './App.css';
import App from './App'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SignupPage } from './components/SignupPage';
import { LoginPage } from './components/LoginPage';
import { ProfilePage } from './components/ProfilePage';
import { NotFoundPage } from './NotFoundPage';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CartProvider } from './contexts/CartContext';
import { CartPage } from './components/checkout/CartPage';
import { CheckoutPage } from './components/checkout/CheckoutPage';
import { OrderConfirmationPage } from './components/checkout/OrderConfirmationPage';
import { Toaster } from 'sonner';
import { AdminRoute } from './components/AdminRoute';
import { AdminUsersPage } from './components/admin/AdminUsersPage';
import { AdminListingsPage } from './components/admin/AdminListingsPage';
import { AdminDisputesPage } from './components/admin/AdminDisputesPage';

// test to deploy to cloudflare workers pages.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <>
            <Toaster richColors position="top-right" />
            <Routes>
              <Route path="/" element={<App />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route
                path="/checkout"
                element={
                  <ProtectedRoute>
                    <CheckoutPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/checkout/confirmation"
                element={
                  <ProtectedRoute>
                    <OrderConfirmationPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <AdminRoute>
                    <Navigate to="/admin/users" replace />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <AdminRoute>
                    <AdminUsersPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/listings"
                element={
                  <AdminRoute>
                    <AdminListingsPage />
                  </AdminRoute>
                }
              />
              <Route
                path="/admin/disputes"
                element={
                  <AdminRoute>
                    <AdminDisputesPage />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)

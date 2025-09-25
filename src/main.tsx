import { StrictMode, Suspense, lazy, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './App.css';
import App from './App';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { CartProvider } from './contexts/CartContext';
import { Toaster } from 'sonner';
import { AdminRoute } from './components/AdminRoute';
import { telemetryService } from './services/telemetry';

const SignupPage = lazy(() => import('./components/SignupPage').then((module) => ({ default: module.SignupPage })));
const LoginPage = lazy(() => import('./components/LoginPage').then((module) => ({ default: module.LoginPage })));
const ProfilePage = lazy(() => import('./components/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const NotFoundPage = lazy(() => import('./NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const CartPage = lazy(() => import('./components/checkout/CartPage').then((module) => ({ default: module.CartPage })));
const CheckoutPage = lazy(() => import('./components/checkout/CheckoutPage').then((module) => ({ default: module.CheckoutPage })));
const OrderConfirmationPage = lazy(() => import('./components/checkout/OrderConfirmationPage').then((module) => ({ default: module.OrderConfirmationPage })));
const AdminUsersPage = lazy(() => import('./components/admin/AdminUsersPage').then((module) => ({ default: module.AdminUsersPage })));
const AdminListingsPage = lazy(() => import('./components/admin/AdminListingsPage').then((module) => ({ default: module.AdminListingsPage })));
const AdminDisputesPage = lazy(() => import('./components/admin/AdminDisputesPage').then((module) => ({ default: module.AdminDisputesPage })));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy').then((module) => ({ default: module.PrivacyPolicy })));
const TermsOfService = lazy(() => import('./pages/TermsOfService').then((module) => ({ default: module.TermsOfService })));

const FrequentRoutePrefetcher = () => {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const prefetchers: Array<() => Promise<unknown>> = [
      () => import('./components/ProfilePage'),
      () => import('./components/checkout/CartPage'),
      () => import('./components/checkout/CheckoutPage'),
      () => import('./components/checkout/OrderConfirmationPage'),
    ];

    const timeouts = prefetchers.map((prefetch, index) => {
      return window.setTimeout(() => {
        void prefetch();
      }, 500 * (index + 1));
    });

    return () => {
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  return null;
};

const PageLoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50">
    <span className="text-sm text-muted-foreground">Loading page...</span>
  </div>
);

telemetryService.initialize();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <>
            <Toaster richColors position="top-right" />
            <FrequentRoutePrefetcher />
            <Suspense fallback={<PageLoadingFallback />}>
              <Routes>
                <Route path="/" element={<App />} />
                <Route path="/plants/:plantId" element={<App />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />
                <Route path="/terms" element={<TermsOfService />} />
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
            </Suspense>
          </>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);

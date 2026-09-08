import React, { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { getUser } from './utils/storage';
import ErrorBoundary from './components/ErrorBoundary';
import { ConfirmProvider } from './components/ConfirmDialog';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import KYCRequests from './pages/KYCRequests';
import KYCDetail from './pages/KYCDetail';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Vendors from './pages/Vendors';

import Payouts from './pages/Payouts';
import TCEStore from './pages/TCEStore';
import Testimonials from './pages/Testimonials';
import PhoneVerifications from './pages/PhoneVerifications';
import BlogManager from './pages/BlogManager';
import BlogEditor from './pages/BlogEditor';
import ContactMessages from './pages/ContactMessages';
import QrScans from './pages/QrScans';
import ComparisonPlatforms from './pages/ComparisonPlatforms';
import AdminLayout from './components/AdminLayout';

// Protected Route wrapper
const ProtectedRoute = ({ children }) => {
  const user = getUser();

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <AdminLayout>{children}</AdminLayout>;
};

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <ErrorBoundary>
      <ConfirmProvider>
        <ScrollToTop />
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Protected Admin Routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/kyc"
            element={
              <ProtectedRoute>
                <KYCRequests />
              </ProtectedRoute>
            }
          />

          <Route
            path="/kyc/:id"
            element={
              <ProtectedRoute>
                <KYCDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <Users />
              </ProtectedRoute>
            }
          />

          <Route
            path="/users/:id"
            element={
              <ProtectedRoute>
                <UserDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <Products />
              </ProtectedRoute>
            }
          />

          <Route
            path="/products/:id"
            element={
              <ProtectedRoute>
                <ProductDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders"
            element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            }
          />

          <Route
            path="/orders/:id"
            element={
              <ProtectedRoute>
                <OrderDetail />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vendors"
            element={
              <ProtectedRoute>
                <Vendors />
              </ProtectedRoute>
            }
          />

          <Route
            path="/payouts"
            element={
              <ProtectedRoute>
                <Payouts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tce-store"
            element={
              <ProtectedRoute>
                <TCEStore />
              </ProtectedRoute>
            }
          />

          <Route
            path="/testimonials"
            element={
              <ProtectedRoute>
                <Testimonials />
              </ProtectedRoute>
            }
          />

          <Route
            path="/blog"
            element={
              <ProtectedRoute>
                <BlogManager />
              </ProtectedRoute>
            }
          />

          <Route
            path="/blog/new"
            element={
              <ProtectedRoute>
                <BlogEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/blog/:id/edit"
            element={
              <ProtectedRoute>
                <BlogEditor />
              </ProtectedRoute>
            }
          />

          <Route
            path="/phone-verifications"
            element={
              <ProtectedRoute>
                <PhoneVerifications />
              </ProtectedRoute>
            }
          />

          <Route
            path="/contact-messages"
            element={
              <ProtectedRoute>
                <ContactMessages />
              </ProtectedRoute>
            }
          />

          <Route
            path="/qr-scans"
            element={
              <ProtectedRoute>
                <QrScans />
              </ProtectedRoute>
            }
          />

          <Route
            path="/comparison-platforms"
            element={
              <ProtectedRoute>
                <ComparisonPlatforms />
              </ProtectedRoute>
            }
          />

          {/* Redirect to dashboard by default */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ConfirmProvider>
    </ErrorBoundary>
  );
}

export default App;

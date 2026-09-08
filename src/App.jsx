import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  useNavigationType,
  Navigate,
} from 'react-router-dom';
import { useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { ConfirmProvider } from './components/ConfirmDialog';
import { HelmetProvider } from 'react-helmet-async';
import { pageview } from './utils/gtag';
// Home, Category and NotFound are bundled eagerly, not lazy — Home/Category
// are the two most-visited entry routes, and NotFound is what a confused
// user hits right after a bad link; none of them should cost an extra chunk
// fetch and a visible Suspense-spinner flash on top of that. Every other
// route stays lazy/code-split.
import Home from './pages/Home';
import Category from './pages/Category';
import NotFound from './pages/NotFound';

const Account = lazy(() => import('./pages/Account'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Cart = lazy(() => import('./pages/Cart'));
const About = lazy(() => import('./pages/About'));
const Vision = lazy(() => import('./pages/Vision'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Terms = lazy(() => import('./pages/Terms'));
const FoundersNote = lazy(() => import('./pages/FoundersNote'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const SellerAgreement = lazy(() => import('./pages/SellerAgreement'));
const Checkout = lazy(() => import('./pages/Checkout'));
const VendorDashboard = lazy(() => import('./pages/VendorDashboard'));
const Contact = lazy(() => import('./pages/Contact'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Returns = lazy(() => import('./pages/Returns'));
const Links = lazy(() => import('./pages/Links'));

function ScrollToTop() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();
  useEffect(() => {
    // Only jump to the top when the user is going somewhere NEW (PUSH) or a
    // route replaced itself (REPLACE). On POP — Back/Forward, including the
    // Android hardware back button — the browser has its own saved scroll
    // offset for that history entry and restores it; scrolling to 0 here
    // fought that and dumped the shopper back at the top of a grid they had
    // scrolled halfway through. Product data is still in the react-query
    // cache (gcTime 10min, see main.jsx), so the restored position lands on
    // real content rather than an empty page.
    //
    // react-router's <ScrollRestoration> would do this too, but it is
    // data-router-only (createBrowserRouter); this app mounts <BrowserRouter>
    // with a <Routes> tree, so it is not available without a full router
    // rewrite. useNavigationType gets the same behaviour in three lines.
    if (navigationType === 'POP') return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
  return null;
}

function GATracker() {
  const { pathname } = useLocation();
  useEffect(() => {
    pageview(pathname);
  }, [pathname]);
  return null;
}

function App() {
  return (
    <HelmetProvider>
      <BrowserRouter>
        <ScrollToTop />
        <GATracker />
        <ErrorBoundary>
          <ToastProvider>
            <ConfirmProvider>
              {/* Safety net only. The boundary that actually catches lazy
                  ROUTE chunks now lives in Layout.jsx, wrapped around
                  <Outlet/> — when it sat out here it was the nearest boundary
                  to every suspending route, so React unmounted Layout, the
                  header and the bottom tab bar along with the page, and the
                  first tap on Cart/Account/a product white-screened the whole
                  app. Nothing rendered above <Outlet/> is lazy today, so this
                  fallback should never be visible; it exists so a future
                  suspension in the chrome degrades to a spinner instead of
                  React's hard "no fallback UI was specified" crash. */}
              <Suspense
                fallback={
                  <div
                    role="status"
                    aria-live="polite"
                    className="min-h-screen flex items-center justify-center bg-secondary-bg"
                  >
                    <div className="w-10 h-10 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin"></div>
                    <span className="sr-only">Loading</span>
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<Home />} />
                    <Route path="about-us" element={<Navigate to="/about" replace />} />
                    <Route path="/about" element={<About />} />
                    <Route path="/category" element={<Category />} />
                    <Route path="/category/:categorySlug" element={<Category />} />
                    <Route path="/vision" element={<Vision />} />
                    <Route path="/wishlist" element={<Wishlist />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/privacy" element={<Privacy />} />
                    <Route path="/terms" element={<Terms />} />
                    <Route path="/founders-note" element={<FoundersNote />} />
                    <Route path="/product/:id" element={<ProductDetail />} />
                    <Route path="/archive" element={<BlogPage />} />
                    <Route path="/archive/:slug" element={<BlogPost />} />
                    <Route path="/seller-agreement" element={<SellerAgreement />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/vendor-dashboard" element={<VendorDashboard />} />
                    <Route path="/contact" element={<Contact />} />
                    <Route path="/faq" element={<FAQ />} />
                    <Route path="/returns" element={<Returns />} />
                    <Route path="/links" element={<Links />} />
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </ConfirmProvider>
          </ToastProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </HelmetProvider>
  );
}

export default App;

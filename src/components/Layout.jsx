import React, { useState, useEffect, Suspense } from 'react';
import { Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowUp, Loader2 } from 'lucide-react';
import Header from './Header';
import Footer from './Footer';
import ConsentBanner from './ConsentBanner';
import WhatsAppIcon from './WhatsAppIcon';
import { ScrollProgress } from './Motion';
import { OrganizationSchema, SiteNavigationSchema } from './SEO';
import { whatsAppHref } from '../config/contact';

// Shown only for the few hundred ms it takes to fetch a route's JS chunk the
// first time it is opened. It sits INSIDE <main>, so the header, the bottom
// tab bar and the footer stay on screen and the navigation reads as instant.
const PageFallback = () => (
  <div
    role="status"
    aria-live="polite"
    className="min-h-[50vh] flex flex-col items-center justify-center gap-3 px-6"
  >
    <Loader2
      size={28}
      strokeWidth={1.5}
      aria-hidden="true"
      className="animate-spin text-luxury-gold"
    />
    <p className="font-sans text-[11px] uppercase tracking-[0.22em] text-heritage-bronze/70">
      Loading
    </p>
  </div>
);

const Layout = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const location = useLocation();
  const [searchParams] = useSearchParams();
  // Mirrors Header.jsx's own check: the mobile bottom tab bar hides itself
  // while an Account section is open, so the space <main> reserves for it
  // should collapse too, instead of leaving a dead gap at the bottom.
  const isAccountSectionOpen = location.pathname === '/account' && searchParams.has('tab');

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  return (
    <div className="min-h-screen flex flex-col bg-secondary-bg">
      <OrganizationSchema />
      <SiteNavigationSchema />
      <ScrollProgress />
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:bg-white focus:text-obsidian focus:px-6 focus:py-3 focus:text-sm focus:uppercase focus:tracking-widest focus:shadow-lg"
      >
        Skip to main content
      </a>
      {/* Mounted before the header so a keyboard user reaches Reject/Accept
          immediately after the skip link, rather than tabbing the whole page.
          It is position:fixed, so DOM order costs nothing visually. */}
      <ConsentBanner />
      <Header />
      <main
        id="main-content"
        className={`flex-grow ${isAccountSectionOpen ? 'pb-4' : 'pb-24'} lg:pb-0`}
      >
        {/* The Suspense boundary for lazy routes belongs HERE, not around
            <Layout/> in App.jsx. React unmounts the nearest boundary's whole
            subtree while a child suspends — with the boundary outside
            <Routes> that subtree was the entire app, so opening any
            code-split route (Cart, Account, ProductDetail, Checkout…) blanked
            the header and tab bar into a full-viewport spinner. Scoped to
            <main>, only the page area swaps. */}
        <Suspense fallback={<PageFallback />}>
          <div key={location.pathname} className="animate-page-enter">
            <Outlet />
          </div>
        </Suspense>
      </main>
      <Footer />
      <a
        href={whatsAppHref("Hi, I'm interested in The Collectors Exchange.")}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-24 lg:bottom-8 right-6 z-50 w-12 h-12 rounded-full bg-[#25D366] text-white shadow-lg hover:bg-[#20BD5A] transition-all duration-300 flex items-center justify-center hover:scale-110"
      >
        <WhatsAppIcon size={22} />
      </a>
      <button
        onClick={scrollToTop}
        aria-label="Scroll to top"
        className={`fixed bottom-40 lg:bottom-24 right-6 z-50 w-12 h-12 rounded-full bg-obsidian text-white shadow-lg hover:bg-luxury-gold hover:text-obsidian transition-all duration-300 flex items-center justify-center ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
      >
        <ArrowUp size={20} strokeWidth={2} />
      </button>
    </div>
  );
};

export default Layout;

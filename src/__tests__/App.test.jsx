import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('../utils/gtag', () => ({
  pageview: vi.fn(),
}));

vi.mock('../hooks/api/useProducts', () => ({
  useProducts: vi.fn(() => ({ data: { products: [] }, isLoading: false })),
}));

// Clicking through to /category mounts the real Category page, which reads
// this hook — App.test renders <App/> without a QueryClientProvider (that
// lives in main.jsx), so an unmocked useQuery would throw.
vi.mock('../hooks/api/useCategoryCounts', () => ({
  useCategoryCounts: vi.fn(() => ({ data: {} })),
}));

vi.mock('../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToCart: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRemoveFromCart: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../hooks/api/useWishlist', () => ({
  useWishlist: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRemoveFromWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../hooks/api/useTestimonials', () => ({
  useTestimonials: vi.fn(() => ({ data: [], isLoading: false })),
  useSubmitTestimonial: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../utils/storage', () => ({
  getUser: vi.fn(() => null),
}));

vi.mock('../hooks/useInView', () => ({
  useInView: () => [null, true],
}));

vi.mock('../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the header and footer mounted while a lazy route loads', async () => {
    // Home/Category are bundled eagerly (no fallback flash on the two
    // highest-traffic entry routes — see App.jsx), so exercise the Suspense
    // fallback on a route that's still lazy-loaded instead.
    //
    // Regression guard: the Suspense boundary used to sit outside <Routes>,
    // so the first visit to ANY lazy route unmounted Layout with it and the
    // user got a full-viewport white screen instead of a page swap. The
    // boundary now lives inside Layout's <main>, so the chrome must survive.
    window.history.pushState({}, '', '/wishlist');
    render(<App />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();

    // And the page itself still arrives once its chunk resolves (getUser is
    // mocked to null, so Wishlist renders its sign-in prompt).
    expect(await screen.findByText(/please sign in/i, {}, { timeout: 5000 })).toBeInTheDocument();
  });

  it('leaves scroll position alone on a POP navigation', () => {
    // The very first render of a BrowserRouter is a POP, which is exactly the
    // Back/Forward case: the browser has its own saved offset for that history
    // entry, and scrolling to 0 here would throw the shopper back to the top
    // of a grid they had scrolled halfway through.
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(window.scrollTo).not.toHaveBeenCalledWith(0, 0);
  });

  it('still scrolls to the top on a PUSH navigation', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(
      await screen.findByRole('link', { name: /explore the exchange/i }, { timeout: 5000 }),
    );
    await waitFor(() => expect(window.scrollTo).toHaveBeenCalledWith(0, 0));
  });

  it('renders 404 page for unknown routes', async () => {
    window.history.pushState({}, '', '/nonexistent');
    render(<App />);
    const notFound = await screen.findByText('404', {}, { timeout: 5000 });
    expect(notFound).toBeInTheDocument();
  });

  it('renders home page at root with header', async () => {
    window.history.pushState({}, '', '/');
    render(<App />);
    const heroCta = await screen.findByText(/explore the exchange/i, {}, { timeout: 5000 });
    expect(heroCta).toBeInTheDocument();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductDetail from '../ProductDetail';

// Mutable fixtures so each test can vary who is signed in, what is already in
// the cart, and whether the item is sold, without re-mocking the modules.
const fixtures = vi.hoisted(() => ({
  user: { id: 'user1' },
  cartItems: [],
  product: {},
  addToCart: vi.fn(() => Promise.resolve({})),
  addToCartPending: false,
  toast: vi.fn(),
}));

vi.mock('../../hooks/api/useProducts', () => ({
  useProduct: vi.fn((id) => ({
    data: id
      ? {
          id,
          title: 'Detail Watch',
          price: 25000,
          images: ['img1.jpg', 'img2.jpg'],
          category: 'watches',
          description: 'A **fine** watch',
          condition: 'Mint',
          listingCategory: 'premium',
          ...fixtures.product,
        }
      : null,
    isLoading: false,
  })),
  useProducts: vi.fn(() => ({ data: { products: [] }, isLoading: false })),
}));

vi.mock('../../hooks/api/useWishlist', () => ({
  useWishlist: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRemoveFromWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: fixtures.cartItems, isLoading: false })),
  useAddToCart: vi.fn(() => ({
    mutateAsync: fixtures.addToCart,
    isPending: fixtures.addToCartPending,
  })),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => fixtures.user),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => fixtures.toast),
}));

vi.mock('../../components/ConfirmDialog', () => ({
  useConfirm: vi.fn(() => vi.fn(() => Promise.resolve(true))),
}));

// The page fires an analytics view-track POST and chains .catch() onto it, so
// the mock must return a promise, not undefined.
vi.mock('../../hooks/api/apiClient', () => ({
  default: { post: vi.fn(() => Promise.resolve({ data: {} })) },
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

const renderPage = () =>
  render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={['/product/1']}>
          <Routes>
            <Route path="/product/:id" element={<ProductDetail />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );

beforeEach(() => {
  fixtures.user = { id: 'user1' };
  fixtures.cartItems = [];
  fixtures.product = {};
  fixtures.addToCartPending = false;
  fixtures.addToCart = vi.fn(() => Promise.resolve({}));
  fixtures.toast = vi.fn();
});

describe('ProductDetail', () => {
  it('renders product title', () => {
    renderPage();
    expect(screen.getByText('Detail Watch')).toBeInTheDocument();
  });

  it('renders product price', () => {
    renderPage();
    expect(screen.getByText(/25,000/)).toBeInTheDocument();
  });

  it('renders product images', () => {
    renderPage();
    const images = screen.getAllByRole('img');
    expect(images.length).toBeGreaterThan(0);
  });

  it('makes Add to Cart the primary CTA and keeps WhatsApp as secondary', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add to cart/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /reserve via whatsapp/i })).toBeInTheDocument();
  });

  it('adds the product to the cart for a signed-in buyer', async () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    await waitFor(() =>
      expect(fixtures.addToCart).toHaveBeenCalledWith({ userId: 'user1', productId: '1' }),
    );
    expect(await screen.findByText(/added to cart/i)).toBeInTheDocument();
  });

  it('offers a link into sign-in instead of Add to Cart when signed out', () => {
    fixtures.user = null;
    renderPage();
    const signIn = screen.getByRole('link', { name: /sign in to add to cart/i });
    expect(signIn).toHaveAttribute('href', '/account');
    expect(screen.queryByRole('button', { name: /^add to cart$/i })).not.toBeInTheDocument();
  });

  it('links to the cart instead of re-adding when the item is already in the cart', () => {
    fixtures.cartItems = [{ productId: '1' }];
    renderPage();
    const inCart = screen.getByRole('link', { name: /in cart/i });
    expect(inCart).toHaveAttribute('href', '/cart');
    expect(screen.queryByRole('button', { name: /^add to cart$/i })).not.toBeInTheDocument();
  });

  it('shows Sold Out and no purchase paths for a sold item', () => {
    fixtures.product = { status: 'Sold' };
    renderPage();
    expect(screen.getByText(/sold out/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add to cart/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /reserve via whatsapp/i })).not.toBeInTheDocument();
  });

  it("surfaces the server's message when adding to the cart fails", async () => {
    fixtures.addToCart = vi.fn(() =>
      Promise.reject({ response: { status: 409, data: { message: 'Item already reserved' } } }),
    );
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /add to cart/i }));
    await waitFor(() =>
      expect(fixtures.toast).toHaveBeenCalledWith('Item already reserved', 'error'),
    );
  });

  it('exposes shipping timings and a returns policy link before purchase', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /shipping & returns/i }));
    expect(screen.getByText(/dispatched within 2-5 business days/i)).toBeInTheDocument();
    expect(screen.getByText(/delivered in 5-10 business days/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /read the returns policy/i })).toHaveAttribute(
      'href',
      '/returns',
    );
  });

  it('makes the condition report requestable, prefilled with the item', () => {
    renderPage();
    const emailLink = screen.getByRole('link', { name: /^email$/i });
    expect(emailLink.getAttribute('href')).toContain('mailto:support@thecollectorsexchange.in');
    expect(emailLink.getAttribute('href')).toContain(encodeURIComponent('Detail Watch'));
    const waLink = screen.getByRole('link', { name: /^whatsapp$/i });
    expect(waLink.getAttribute('href')).toContain('https://wa.me/919740799109');
  });
});

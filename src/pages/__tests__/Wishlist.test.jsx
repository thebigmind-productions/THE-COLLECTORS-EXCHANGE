import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Wishlist from '../Wishlist';
import { useWishlist, useRemoveFromWishlist } from '../../hooks/api/useWishlist';
import { useAddToCart } from '../../hooks/api/useCart';
import { useToast } from '../../components/Toast';

vi.mock('../../hooks/api/useWishlist', () => ({
  useWishlist: vi.fn(() => ({
    data: [
      {
        id: '1',
        product: {
          id: 'p1',
          title: 'Wishlist Watch',
          price: 20000,
          images: ['img.jpg'],
          category: 'watches',
          condition: 'Mint',
          listingCategory: 'premium',
        },
      },
    ],
    isLoading: false,
  })),
  useRemoveFromWishlist: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToCart: vi.fn(() => ({ mutateAsync: vi.fn(), isPending: false })),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => ({ id: 'user1' })),
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('Wishlist', () => {
  it('renders My Wishlist heading', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Wishlist />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('My Wishlist')).toBeInTheDocument();
  });

  it('renders wishlist items', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Wishlist />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Wishlist Watch')).toBeInTheDocument();
  });

  it('renders add to cart button', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Wishlist />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/add to cart/i)).toBeInTheDocument();
  });
});

// Same defect as the category grid: a failed /wishlist read left `data`
// undefined, the page defaulted it to [], and the shopper was told they had
// saved nothing.
describe('Wishlist - failed query', () => {
  const defaultUseWishlist = vi.mocked(useWishlist).getMockImplementation();

  afterEach(() => {
    vi.mocked(useWishlist).mockImplementation(defaultUseWishlist);
  });

  const renderWishlist = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Wishlist />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );

  it('shows a retryable error instead of "your wishlist is empty"', () => {
    const refetch = vi.fn();
    vi.mocked(useWishlist).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
    });

    renderWishlist();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/we couldn't load your wishlist/i)).toBeInTheDocument();
    expect(screen.queryByText(/your wishlist is empty/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

// The wishlist is exactly where sold-out items accumulate, so the backend's
// 422 'Product is no longer available' is the routine answer here. It used to
// be swallowed by console.error: the shopper tapped Add to Cart, nothing moved,
// and the only available conclusion was that the site was broken.
describe('Wishlist - failed mutations are not silent', () => {
  const defaultUseWishlist = vi.mocked(useWishlist).getMockImplementation();

  afterEach(() => {
    vi.mocked(useWishlist).mockImplementation(defaultUseWishlist);
    vi.mocked(useToast).mockReturnValue(vi.fn());
  });

  const renderWishlist = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Wishlist />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );

  it('surfaces the backend reason when a sold item cannot be added to the cart', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue(showToast);
    vi.mocked(useAddToCart).mockReturnValue({
      mutateAsync: vi
        .fn()
        .mockRejectedValue({ response: { data: { error: 'Product is no longer available' } } }),
      isPending: false,
    });

    renderWishlist();
    fireEvent.click(screen.getByText(/add to cart/i));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Product is no longer available', 'error'),
    );
  });

  it('still says something when the failure carries no message', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue(showToast);
    vi.mocked(useAddToCart).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue(new Error('Network Error')),
      isPending: false,
    });

    renderWishlist();
    fireEvent.click(screen.getByText(/add to cart/i));

    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Could not add this to your cart', 'error'),
    );
  });

  it('confirms the item actually reached the cart', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue(showToast);
    vi.mocked(useAddToCart).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    });

    renderWishlist();
    fireEvent.click(screen.getByText(/add to cart/i));

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Added to your cart', 'success'));
  });

  it('surfaces a failed wishlist removal too', async () => {
    const showToast = vi.fn();
    vi.mocked(useToast).mockReturnValue(showToast);
    vi.mocked(useRemoveFromWishlist).mockReturnValue({
      mutateAsync: vi.fn().mockRejectedValue({ response: { data: { message: 'Nope' } } }),
      isPending: false,
    });

    renderWishlist();
    // The delete control is the icon-only button next to Add to Cart.
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Nope', 'error'));
  });
});

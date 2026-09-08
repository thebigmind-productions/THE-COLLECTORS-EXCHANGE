import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Category from '../Category';
import { useProducts } from '../../hooks/api/useProducts';

vi.mock('../../hooks/api/useProducts', () => ({
  useProducts: vi.fn(() => ({
    data: {
      products: [
        {
          id: '1',
          title: 'Category Product',
          price: 5000,
          images: ['img.jpg'],
          category: 'watches',
          condition: 'Good',
          listingCategory: 'standard',
        },
      ],
    },
    isLoading: false,
  })),
}));

vi.mock('../../hooks/api/useCategoryCounts', () => ({
  useCategoryCounts: vi.fn(() => ({ data: { Timepieces: 1, Accessories: 1 } })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToCart: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../hooks/api/useWishlist', () => ({
  useWishlist: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRemoveFromWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => null),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

vi.mock('../../components/Motion', () => ({
  Reveal: ({ children }) => <div>{children}</div>,
  Stagger: ({ children }) => <div>{children}</div>,
  Tilt: ({ children }) => <div>{children}</div>,
}));

const renderCategory = (initialEntry = '/category') => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/category" element={<Category />} />
            <Route path="/category/:categorySlug" element={<Category />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
};

describe('Category', () => {
  it('renders category filter buttons', () => {
    renderCategory();
    expect(screen.getByText(/all/i)).toBeInTheDocument();
  });

  it('renders product grid', () => {
    renderCategory();
    expect(screen.getByText('Category Product')).toBeInTheDocument();
  });

  it('renders category names', () => {
    renderCategory();
    expect(screen.getAllByText('Timepieces').length).toBeGreaterThan(0);
  });

  it('keeps the clean category hub indexable and self-canonical', async () => {
    renderCategory('/category');

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://thecollectorsexchange.in/category/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      );
    });
  });

  it('noindexes transient hub queries while canonicalizing a recognized category query', async () => {
    renderCategory('/category?cat=Timepieces&q=hmt&condition=Good&sort=price');

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://thecollectorsexchange.in/category/timepieces/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
    });
  });

  it('keeps search-only hub queries canonicalized to the category hub', async () => {
    renderCategory('/category?q=hmt&condition=Good&sort=price');

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://thecollectorsexchange.in/category/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
    });
  });

  it('indexes a clean category landing with a unique H1 and self-canonical', async () => {
    renderCategory('/category/timepieces');

    expect(screen.getByRole('heading', { level: 1, name: 'Shop Timepieces' })).toBeInTheDocument();

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://thecollectorsexchange.in/category/timepieces/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1',
      );
    });
  });

  it('noindexes transient filters on a clean landing while retaining its canonical', async () => {
    renderCategory('/category/timepieces?sort=price');

    await waitFor(() => {
      expect(document.querySelector('link[rel="canonical"]')).toHaveAttribute(
        'href',
        'https://thecollectorsexchange.in/category/timepieces/',
      );
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, follow',
      );
    });
  });

  // TEMPORARY: the category selector rail is hidden and VISIBLE_CATEGORIES is
  // filtered down to Accessories only, so none of these landing links render.
  // Re-enable together with items #2/#4 in docs/TEMPORARY_CHANGES_ROLLBACK.md.
  it.skip('links category navigation to clean landing URLs', () => {
    renderCategory('/category');

    expect(document.querySelector('a[href="/category/timepieces/"]')).toBeInTheDocument();
    expect(document.querySelector('a[href="/category/collectibles/"]')).toBeInTheDocument();
    expect(document.querySelector('a[href="/category/toys-and-pop-culture/"]')).toBeInTheDocument();
  });
});

// A rejected products query used to be indistinguishable from an empty
// catalogue: react-query hands back `data === undefined`, the page defaults
// `products` to [], `isLoading` is false, and the shopper was told the shop
// had nothing in it. On Indian mobile data that is a routine outcome, not an
// edge case.
describe('Category — failed products query', () => {
  const defaultUseProducts = vi.mocked(useProducts).getMockImplementation();

  afterEach(() => {
    vi.mocked(useProducts).mockImplementation(defaultUseProducts);
  });

  const failQuery = (overrides = {}) => {
    const refetch = vi.fn();
    vi.mocked(useProducts).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      isFetching: false,
      refetch,
      ...overrides,
    });
    return refetch;
  };

  it('shows a retryable error instead of the empty state', () => {
    failQuery();
    renderCategory();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/we couldn't load these listings/i)).toBeInTheDocument();
    expect(screen.queryByText(/no items found in this collection/i)).not.toBeInTheDocument();
  });

  it('refetches when the shopper presses Try again', () => {
    const refetch = failQuery();
    renderCategory();

    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it('still shows the plain empty state when the query succeeds with nothing', () => {
    vi.mocked(useProducts).mockReturnValue({
      data: { products: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderCategory();

    expect(screen.getByText(/no items found in this collection/i)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

// Search used to write every keystroke straight into the react-query key, add
// nothing but title/description/keywords to the server-side OR, offer no sort
// or price control, and dead-end on zero results.
describe('Category — search, sort and price filters', () => {
  const defaultUseProducts = vi.mocked(useProducts).getMockImplementation();

  afterEach(() => {
    vi.mocked(useProducts).mockImplementation(defaultUseProducts);
  });

  const lastCall = () => vi.mocked(useProducts).mock.calls.at(-1);

  it('debounces the search box instead of querying on every keystroke', async () => {
    renderCategory();
    const input = screen.getByLabelText('Search listings');
    vi.mocked(useProducts).mockClear();

    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.change(input, { target: { value: 'su' } });
    fireEvent.change(input, { target: { value: 'sub' } });

    // The field has re-rendered three times, but the value the query runs on
    // has not moved off '' yet.
    expect(input).toHaveValue('sub');
    expect(vi.mocked(useProducts).mock.calls.every((call) => call[1] === '')).toBe(true);

    await waitFor(() => expect(lastCall()[1]).toBe('sub'));
  });

  it('passes the chosen sort key through to the query', async () => {
    renderCategory();
    fireEvent.change(screen.getByLabelText('Sort listings'), { target: { value: 'price_asc' } });
    await waitFor(() => expect(lastCall()[6].sort).toBe('price_asc'));
  });

  it('offers exactly the whitelisted sort options', () => {
    renderCategory();
    const options = [...screen.getByLabelText('Sort listings').options].map((o) => o.value);
    expect(options).toEqual(['', 'newest', 'price_asc', 'price_desc']);
  });

  it('passes price bounds through to the query', async () => {
    renderCategory();
    fireEvent.change(screen.getByLabelText('Minimum price in rupees'), {
      target: { value: '2000' },
    });
    fireEvent.change(screen.getByLabelText('Maximum price in rupees'), {
      target: { value: '500000' },
    });
    await waitFor(() => {
      expect(lastCall()[6].minPrice).toBe('2000');
      expect(lastCall()[6].maxPrice).toBe('500000');
    });
  });

  it('does not send a half-typed or negative price bound to the server', async () => {
    renderCategory();
    fireEvent.change(screen.getByLabelText('Minimum price in rupees'), { target: { value: '-' } });
    await waitFor(() => expect(lastCall()[6].minPrice).toBeUndefined());
  });

  it('echoes the query and the active filters on zero results', () => {
    vi.mocked(useProducts).mockReturnValue({
      data: { products: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderCategory('/category?q=submariner&condition=Good&minPrice=2000');

    expect(screen.getByText(/no matches for/i)).toBeInTheDocument();
    expect(screen.getByText(/submariner/)).toBeInTheDocument();
    expect(screen.getByText(/Condition: Good/)).toBeInTheDocument();
    expect(screen.getByText(/₹2000/)).toBeInTheDocument();
  });

  it('clears every filter from the zero-results state', async () => {
    vi.mocked(useProducts).mockReturnValue({
      data: { products: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderCategory('/category?q=submariner&condition=Good&minPrice=2000&sort=price_asc');

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => {
      const call = lastCall();
      expect(call[1]).toBe('');
      expect(call[5]).toBe('');
      expect(call[6]).toEqual({ sort: '', minPrice: undefined, maxPrice: undefined });
    });
  });

  it('offers no Clear action when nothing is filtered', () => {
    vi.mocked(useProducts).mockReturnValue({
      data: { products: [] },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    });
    renderCategory('/category');

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    expect(screen.getByText(/no items found in this collection/i)).toBeInTheDocument();
  });

  // Tapping "Next" on a phone used to leave the shopper at the bottom of the
  // page, looking at the footer while a fresh grid rendered off-screen above.
  it('scrolls back to the grid when the page changes', async () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      vi.mocked(useProducts).mockReturnValue({
        data: {
          products: [{ id: '1', title: 'Paged Product', price: 100, condition: 'Good' }],
          totalPages: 3,
        },
        isLoading: false,
        isError: false,
        isFetching: false,
        refetch: vi.fn(),
      });
      renderCategory('/category');

      expect(scrollIntoView).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Next' }));

      await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
      await waitFor(() => expect(lastCall()[2]).toBe(2));
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });
});

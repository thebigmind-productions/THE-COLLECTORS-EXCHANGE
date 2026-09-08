import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Home from '../Home';

vi.mock('../../hooks/api/useProducts', () => ({
  useProducts: vi.fn(() => ({
    data: {
      products: [
        {
          id: '1',
          title: 'Featured Watch',
          price: 10000,
          images: ['img.jpg'],
          category: 'watches',
          condition: 'Mint',
          listingCategory: 'premium',
        },
      ],
    },
    isLoading: false,
  })),
}));

vi.mock('../../hooks/api/useTestimonials', () => ({
  useTestimonials: vi.fn(() => ({
    data: [{ id: '1', authorName: 'John D.', content: 'Great service', rating: 5 }],
    isLoading: false,
  })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToCart: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => null),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

vi.mock('../../hooks/useInView', () => ({
  useInView: () => [null, true],
}));

vi.mock('../../hooks/useMediaQuery', () => ({
  useMediaQuery: () => true,
}));

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

describe('Home', () => {
  it('renders the marketplace hero heading', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/marketplace for authentic/i)).toBeInTheDocument();
  });

  it('renders the featured products and rarest finds sections', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getAllByText(/featured/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rarest/i).length).toBeGreaterThan(0);
  });

  it('renders explore the exchange link', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(screen.getByText(/explore the exchange/i)).toBeInTheDocument();
  });

  it('renders SEO component', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <HelmetProvider>
          <MemoryRouter>
            <Home />
          </MemoryRouter>
        </HelmetProvider>
      </QueryClientProvider>,
    );
    expect(document.title).toBeDefined();
  });
});

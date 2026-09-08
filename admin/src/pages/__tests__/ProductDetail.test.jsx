import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProductDetail from '../ProductDetail';

const { mockNavigate, mockGet, mockPatch, mockDelete } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGet: vi.fn(),
  mockPatch: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: '123' }) };
});

vi.mock('../../hooks/api/apiClient', () => ({
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

vi.mock('../../components/ConfirmDialog', () => ({
  useConfirm: () => vi.fn().mockResolvedValue(true),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }) => (
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </MemoryRouter>
  );
};

const mockProduct = {
  id: '123',
  title: 'Vintage Watch',
  status: 'Pending',
  isPublished: false,
  price: 50000,
  category: 'Timepieces',
  brand: 'Rolex',
  condition: 'Excellent',
  description: 'A fine watch',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  image: 'http://example.com/watch.jpg',
  images: ['http://example.com/watch.jpg', 'http://example.com/watch2.jpg'],
  seller: { id: 's1', name: 'Seller Name', email: 'seller@test.com', phone: '9999999999' },
  listingCategory: 'normal',
  authenticityStatus: 'Pending',
  rejectionReason: null,
  keywords: ['vintage', 'luxury'],
  reviewedBy: null,
  reviewedAt: null,
};

describe('ProductDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url) => {
      if (url === '/admin/products/123') return Promise.resolve({ data: mockProduct });
      if (url === '/admin/brands') return Promise.resolve({ data: ['Rolex', 'Omega'] });
      if (url === '/admin/comparison-platforms') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    });
  });

  it('shows loading spinner', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<ProductDetail />, { wrapper: createWrapper() });
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders product details', async () => {
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Vintage Watch')).toBeInTheDocument();
    });
  });

  it('shows "Product not found" when product is null', async () => {
    mockGet.mockResolvedValue({ data: null });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Product not found')).toBeInTheDocument();
    });
  });

  it('renders action buttons', async () => {
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Start Review')).toBeInTheDocument();
      expect(screen.getByText('Approve & Publish')).toBeInTheDocument();
      expect(screen.getByText('Reject Product')).toBeInTheDocument();
      expect(screen.getByText('Edit Product')).toBeInTheDocument();
      expect(screen.getByText('Mark as Sold')).toBeInTheDocument();
      expect(screen.getByText('Delete Product')).toBeInTheDocument();
    });
  });

  it('calls review mutation on Start Review click', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Start Review'));
    });
    expect(mockPatch).toHaveBeenCalledWith('/admin/products/123/review');
  });

  it('calls approve mutation on Approve & Publish click', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Approve & Publish'));
    });
    expect(mockPatch).toHaveBeenCalledWith('/admin/products/123/approve');
  });

  it('opens reject modal and rejects product', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Reject Product'));
    });
    const textarea = screen.getByPlaceholderText(/e\.g\., Image quality/);
    fireEvent.change(textarea, { target: { value: 'Bad quality' } });
    fireEvent.click(screen.getByText('Confirm Rejection'));
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/admin/products/123/reject', {
        reason: 'Bad quality',
      });
    });
  });

  it('shows error when rejecting without reason', async () => {
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Reject Product'));
    });
    fireEvent.click(screen.getByText('Confirm Rejection'));
    await waitFor(() => {
      expect(screen.getByText('Please provide a reason for rejection')).toBeInTheDocument();
    });
  });

  it('opens delete modal and deletes product', async () => {
    mockDelete.mockResolvedValue({});
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Delete Product'));
    });
    fireEvent.click(screen.getByText('Confirm Delete'));
    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith('/admin/products/123');
    });
  });

  it('opens edit modal and saves changes', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Edit Product'));
    });
    const select = screen.getByDisplayValue('Normal');
    fireEvent.change(select, { target: { value: 'featured' } });
    fireEvent.click(screen.getByText('Save Changes'));
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalled();
    });
  });

  it('displays rejection reason when product is rejected', async () => {
    const rejectedProduct = {
      ...mockProduct,
      status: 'Rejected',
      rejectionReason: 'Image too blurry',
    };
    mockGet.mockImplementation((url) => {
      if (url === '/admin/products/123') return Promise.resolve({ data: rejectedProduct });
      if (url === '/admin/brands') return Promise.resolve({ data: [] });
      if (url === '/admin/comparison-platforms') return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: {} });
    });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Rejection Reason')).toBeInTheDocument();
      expect(screen.getByText('Image too blurry')).toBeInTheDocument();
    });
  });

  it('shows success message after approval', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Approve & Publish'));
    });
    await waitFor(() => {
      expect(screen.getByText('Product approved and published successfully!')).toBeInTheDocument();
    });
  });

  it('sends the AuthenticityStatus enum member for Under Review', async () => {
    // The radio value was "Under Review" (a space), which the API rejects with
    // a 400 — the option could never be applied.
    mockPatch.mockResolvedValue({ data: {} });
    render(<ProductDetail />, { wrapper: createWrapper() });
    fireEvent.click(await screen.findByText('Change Authenticity Status Manually'));

    const radio = await screen.findByDisplayValue('Under_Review');
    fireEvent.click(radio);
    fireEvent.click(screen.getByText('Update Status'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/admin/products/123/authenticity', {
        status: 'Under_Review',
      });
    });
  });

  it('preselects the current authenticity status in the modal', async () => {
    mockGet.mockImplementation((url) =>
      url === '/admin/products/123'
        ? Promise.resolve({ data: { ...mockProduct, authenticityStatus: 'Under_Review' } })
        : Promise.resolve({
            data:
              url === '/admin/brands'
                ? []
                : url === '/admin/comparison-platforms'
                  ? { data: [] }
                  : {},
          }),
    );
    render(<ProductDetail />, { wrapper: createWrapper() });
    fireEvent.click(await screen.findByText('Change Authenticity Status Manually'));
    expect(await screen.findByDisplayValue('Under_Review')).toBeChecked();
  });

  it('surfaces the server message rather than the axios status line', async () => {
    mockGet.mockImplementation((url) =>
      url === '/admin/products/123'
        ? Promise.resolve({ data: { ...mockProduct, status: 'Sold' } })
        : Promise.resolve({
            data:
              url === '/admin/brands'
                ? []
                : url === '/admin/comparison-platforms'
                  ? { data: [] }
                  : {},
          }),
    );
    mockPatch.mockRejectedValue({
      message: 'Request failed with status code 422',
      response: { data: { error: 'Cannot approve a sold product' } },
    });
    render(<ProductDetail />, { wrapper: createWrapper() });
    fireEvent.click(await screen.findByText('Approve & Publish'));
    expect(await screen.findByText('Cannot approve a sold product')).toBeInTheDocument();
    expect(screen.queryByText('Request failed with status code 422')).not.toBeInTheDocument();
  });
});

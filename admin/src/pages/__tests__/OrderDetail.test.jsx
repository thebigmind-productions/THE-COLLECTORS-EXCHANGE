import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import OrderDetail from '../OrderDetail';

const mockNavigate = vi.fn();
const mockGet = vi.fn();
const mockPatch = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'order123' }) };
});

vi.mock('../../hooks/api/apiClient', () => ({
  default: {
    get: (...args) => mockGet(...args),
    patch: (...args) => mockPatch(...args),
  },
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

const mockOrder = {
  id: 'order123',
  status: 'Pending',
  createdAt: '2024-01-01T00:00:00Z',
  totalAmount: 2500,
  shippingAddress: '123 Main St',
  city: 'Mumbai',
  state: 'MH',
  zipCode: '400001',
  phone: '9999999999',
  trackingID: null,
  // The "View Customer History" link is gated on the order's own userId
  // column (not order.user.id), which is what the API returns.
  userId: 'u1',
  user: { id: 'u1', name: 'John Doe', email: 'john@test.com' },
  items: [
    {
      id: 'item1',
      product: { image: 'img.jpg', title: 'Product A', category: 'Timepieces' },
      price: 2500,
      quantity: 1,
    },
  ],
};

describe('OrderDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: mockOrder });
  });

  it('shows loading spinner', () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    render(<OrderDetail />, { wrapper: createWrapper() });
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('renders order details', async () => {
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText(/ORDER123/i)).toBeInTheDocument();
      expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
      expect(screen.getByText('Product A')).toBeInTheDocument();
      expect(screen.getByText(/Mumbai/)).toBeInTheDocument();
    });
  });

  it('shows "Order not found" when order is null', async () => {
    mockGet.mockResolvedValue({ data: null });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Order not found')).toBeInTheDocument();
    });
  });

  it('marks order as Processing', async () => {
    mockPatch.mockResolvedValue({ data: {} });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Mark as Processing'));
    });
    expect(mockPatch).toHaveBeenCalledWith('/admin/orders/order123/status', {
      status: 'Processing',
    });
  });

  it('opens ship modal and ships order', async () => {
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Processing' } });
    mockPatch.mockResolvedValue({ data: {} });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Shipment'));
    });
    const awbInput = screen.getByPlaceholderText(/e\.g\. 129384756201/);
    fireEvent.change(awbInput, { target: { value: 'AWB123' } });
    fireEvent.click(screen.getByText('Confirm Dispatch'));
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/admin/orders/order123/ship', {
        trackingID: 'AWB123',
      });
    });
  });

  it('shows error when shipping without tracking ID', async () => {
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Processing' } });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm Shipment'));
    });
    fireEvent.click(screen.getByText('Confirm Dispatch'));
    await waitFor(() => {
      expect(screen.getByText('Please provide a tracking ID (AWB Number)')).toBeInTheDocument();
    });
  });

  it('offers Mark Payment Received for a pending whatsapp order, and calls the route', async () => {
    mockGet.mockResolvedValue({
      data: { ...mockOrder, paymentMethod: 'whatsapp', paymentStatus: 'Pending' },
    });
    mockPatch.mockResolvedValue({ data: {} });
    render(<OrderDetail />, { wrapper: createWrapper() });
    const button = await screen.findByText('Mark Payment Received');
    fireEvent.click(button);
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/admin/orders/order123/mark-paid');
    });
  });

  it('does not offer Mark Payment Received for a COD order', async () => {
    mockGet.mockResolvedValue({
      data: { ...mockOrder, paymentMethod: 'cod', paymentStatus: 'Pending' },
    });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText(/ORDER123/i)).toBeInTheDocument());
    expect(screen.queryByText('Mark Payment Received')).not.toBeInTheDocument();
  });

  it('does not offer Mark Payment Received once a whatsapp order is already paid', async () => {
    mockGet.mockResolvedValue({
      data: { ...mockOrder, paymentMethod: 'whatsapp', paymentStatus: 'Paid' },
    });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText(/ORDER123/i)).toBeInTheDocument());
    expect(screen.queryByText('Mark Payment Received')).not.toBeInTheDocument();
  });

  it('marks shipped order as Delivered', async () => {
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Shipped', trackingID: 'AWB123' } });
    mockPatch.mockResolvedValue({ data: {} });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      fireEvent.click(screen.getByText('Mark as Delivered'));
    });
    expect(mockPatch).toHaveBeenCalledWith('/admin/orders/order123/status', {
      status: 'Delivered',
    });
  });

  it('shows customer profile section with link', async () => {
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Customer Profile')).toBeInTheDocument();
      expect(screen.getByText('View Customer History')).toBeInTheDocument();
    });
  });

  it('shows tracking info when trackingID exists', async () => {
    mockGet.mockResolvedValue({
      data: { ...mockOrder, status: 'Shipped', trackingID: 'TRACK123' },
    });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText('TRACK123')).toBeInTheDocument();
    });
  });

  it('offers a Cancel Order action for an order that is still in flight', async () => {
    // The dashboard had no cancel path at all, even though the API supports it
    // from Pending / Processing / Shipped.
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Processing' } });
    render(<OrderDetail />, { wrapper: createWrapper() });
    expect(await screen.findByText('Cancel Order')).toBeInTheDocument();
  });

  it('does not offer Cancel Order once the order is Delivered', async () => {
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Delivered' } });
    render(<OrderDetail />, { wrapper: createWrapper() });
    await screen.findByText('Order Fulfillment');
    expect(screen.queryByText('Cancel Order')).not.toBeInTheDocument();
  });

  it('lets an operator correct a tracking ID on a shipped order', async () => {
    mockGet.mockResolvedValue({
      data: { ...mockOrder, status: 'Shipped', trackingID: 'WRONG123' },
    });
    mockPatch.mockResolvedValue({ data: {} });
    render(<OrderDetail />, { wrapper: createWrapper() });
    fireEvent.click(await screen.findByText('Correct Tracking ID'));
    // Prefilled, so fixing a typo does not mean retyping the whole AWB.
    const input = await screen.findByDisplayValue('WRONG123');
    fireEvent.change(input, { target: { value: 'RIGHT456' } });
    fireEvent.click(screen.getByText('Save Tracking ID'));
    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/admin/orders/order123/ship', {
        trackingID: 'RIGHT456',
      });
    });
  });

  it('surfaces the server reason when a status change is refused', async () => {
    mockGet.mockResolvedValue({ data: { ...mockOrder, status: 'Pending' } });
    mockPatch.mockRejectedValue({
      message: 'Request failed with status code 422',
      response: { data: { error: 'Cannot change order from Pending to Delivered' } },
    });
    render(<OrderDetail />, { wrapper: createWrapper() });
    fireEvent.click(await screen.findByText('Mark as Processing'));
    expect(
      await screen.findByText('Cannot change order from Pending to Delivered'),
    ).toBeInTheDocument();
  });
});

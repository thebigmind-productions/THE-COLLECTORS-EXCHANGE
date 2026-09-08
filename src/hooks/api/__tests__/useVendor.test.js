import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockApiClient = {
  get: vi.fn(),
  patch: vi.fn(),
};

vi.mock('../apiClient', () => ({
  default: mockApiClient,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useVendorProfile', () => {
    it('fetches vendor profile from /vendor/profile', async () => {
      const profile = { id: 'v1', businessName: 'My Shop', status: 'active' };
      mockApiClient.get.mockResolvedValue({ data: profile });
      const { useVendorProfile } = await import('../useVendor');
      const { result } = renderHook(() => useVendorProfile(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(profile);
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/profile');
    });

    it('has retry set to false', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Not registered'));
      const { useVendorProfile } = await import('../useVendor');
      const { result } = renderHook(() => useVendorProfile(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.failureCount).toBe(1);
    });
  });

  describe('useVendorStats', () => {
    it('fetches vendor stats from /vendor/stats', async () => {
      const stats = { totalProducts: 10, totalSales: 5, revenue: 5000 };
      mockApiClient.get.mockResolvedValue({ data: stats });
      const { useVendorStats } = await import('../useVendor');
      const { result } = renderHook(() => useVendorStats(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(stats);
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/stats');
    });

    it('handles API error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Stats fetch failed'));
      const { useVendorStats } = await import('../useVendor');
      const { result } = renderHook(() => useVendorStats(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useVendorAnalyticsOverview', () => {
    it('fetches analytics overview with default period', async () => {
      mockApiClient.get.mockResolvedValue({ data: { views: 100 } });
      const { useVendorAnalyticsOverview } = await import('../useVendor');
      renderHook(() => useVendorAnalyticsOverview(), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/analytics/overview?period=30d');
    });

    it('fetches analytics overview with custom period', async () => {
      mockApiClient.get.mockResolvedValue({ data: { views: 200 } });
      const { useVendorAnalyticsOverview } = await import('../useVendor');
      renderHook(() => useVendorAnalyticsOverview('7d'), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/analytics/overview?period=7d');
    });
  });

  describe('useVendorAnalyticsInterest', () => {
    it('fetches interest data with default period', async () => {
      mockApiClient.get.mockResolvedValue({ data: { interests: [] } });
      const { useVendorAnalyticsInterest } = await import('../useVendor');
      renderHook(() => useVendorAnalyticsInterest(), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/analytics/interest?period=30d');
    });
  });

  describe('useVendorSalesGraph', () => {
    it('fetches sales graph data with default period', async () => {
      mockApiClient.get.mockResolvedValue({ data: { sales: [] } });
      const { useVendorSalesGraph } = await import('../useVendor');
      renderHook(() => useVendorSalesGraph(), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/analytics/sales-graph?period=30d');
    });
  });

  describe('useVendorTopProducts', () => {
    it('fetches top products with default period', async () => {
      mockApiClient.get.mockResolvedValue({ data: { products: [] } });
      const { useVendorTopProducts } = await import('../useVendor');
      renderHook(() => useVendorTopProducts(), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/analytics/top-products?period=30d');
    });
  });

  describe('useVendorPayouts', () => {
    it('fetches payouts with default params', async () => {
      mockApiClient.get.mockResolvedValue({ data: { payouts: [] } });
      const { useVendorPayouts } = await import('../useVendor');
      renderHook(() => useVendorPayouts(), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/payouts?page=1&limit=20');
    });

    it('includes status filter when provided', async () => {
      mockApiClient.get.mockResolvedValue({ data: { payouts: [] } });
      const { useVendorPayouts } = await import('../useVendor');
      renderHook(() => useVendorPayouts({ status: 'paid' }), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/payouts?page=1&limit=20&status=paid');
    });

    it('uses custom page and limit', async () => {
      mockApiClient.get.mockResolvedValue({ data: { payouts: [] } });
      const { useVendorPayouts } = await import('../useVendor');
      renderHook(() => useVendorPayouts({ page: 2, limit: 10 }), { wrapper: createWrapper() });
      await waitFor(() => expect(mockApiClient.get).toHaveBeenCalled());
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/payouts?page=2&limit=10');
    });
  });

  describe('useVendorOrders', () => {
    it('fetches vendor orders from /vendor/orders', async () => {
      const orders = [{ id: 'ord-1', productName: 'Vase', quantity: 1 }];
      mockApiClient.get.mockResolvedValue({ data: orders });
      const { useVendorOrders } = await import('../useVendor');
      const { result } = renderHook(() => useVendorOrders(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(orders);
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/orders');
    });

    it('handles API error', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Orders fetch failed'));
      const { useVendorOrders } = await import('../useVendor');
      const { result } = renderHook(() => useVendorOrders(), { wrapper: createWrapper() });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useVendorPayoutItems', () => {
    it('fetches the breakdown for one payout', async () => {
      const breakdown = { payout: { id: 'po1' }, items: [], totals: { itemCount: 0 } };
      mockApiClient.get.mockResolvedValue({ data: breakdown });
      const { useVendorPayoutItems } = await import('../useVendor');
      const { result } = renderHook(() => useVendorPayoutItems('po1'), {
        wrapper: createWrapper(),
      });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(breakdown);
      expect(mockApiClient.get).toHaveBeenCalledWith('/vendor/payouts/po1/items');
    });

    // The dashboard only asks once a seller expands a row, so an unexpanded
    // list of twenty payouts must fire zero requests.
    it('stays idle without a payout id', async () => {
      const { useVendorPayoutItems } = await import('../useVendor');
      const { result } = renderHook(() => useVendorPayoutItems(null), { wrapper: createWrapper() });
      expect(result.current.fetchStatus).toBe('idle');
      expect(mockApiClient.get).not.toHaveBeenCalled();
    });
  });

  describe('useUpdatePayoutDetails', () => {
    it('patches the UPI ID and the account name', async () => {
      mockApiClient.patch.mockResolvedValue({ data: { payoutUpiMasked: '98******10@ybl' } });
      const { useUpdatePayoutDetails } = await import('../useVendor');
      const { result } = renderHook(() => useUpdatePayoutDetails(), { wrapper: createWrapper() });
      result.current.mutate({ payoutUpi: '9876543210@ybl', payoutUpiName: 'Asha Rao' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.patch).toHaveBeenCalledWith('/vendor/payout-details', {
        payoutUpi: '9876543210@ybl',
        payoutUpiName: 'Asha Rao',
      });
    });

    it('surfaces a rejection so the form can show the reason', async () => {
      mockApiClient.patch.mockRejectedValue({
        response: { data: { error: 'Enter a valid UPI ID' } },
      });
      const { useUpdatePayoutDetails } = await import('../useVendor');
      const { result } = renderHook(() => useUpdatePayoutDetails(), { wrapper: createWrapper() });
      result.current.mutate({ payoutUpi: 'nope' });
      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error.response.data.error).toBe('Enter a valid UPI ID');
    });
  });

  describe('useShipOrderItem', () => {
    it('sends patch request with orderItemId and trackingID', async () => {
      mockApiClient.patch.mockResolvedValue({ data: { shipped: true } });
      const { useShipOrderItem } = await import('../useVendor');
      const { result } = renderHook(() => useShipOrderItem(), { wrapper: createWrapper() });
      result.current.mutate({ orderItemId: 'item-1', trackingID: 'TRACK123' });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mockApiClient.patch).toHaveBeenCalledWith('/vendor/orders/item-1/ship', {
        trackingID: 'TRACK123',
      });
    });

    it('handles API error on ship', async () => {
      mockApiClient.patch.mockRejectedValue(new Error('Ship failed'));
      const { useShipOrderItem } = await import('../useVendor');
      const { result } = renderHook(() => useShipOrderItem(), { wrapper: createWrapper() });
      result.current.mutate({ orderItemId: 'bad', trackingID: '' });
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });
});

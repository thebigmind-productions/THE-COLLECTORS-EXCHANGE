import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

const mockApiClient = {
  post: vi.fn(),
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

describe('useCheckout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useCreateOrder', () => {
    it('sends post request to create order with order data', async () => {
      const orderData = { items: [{ productId: 'p1', quantity: 1 }], total: 100 };
      mockApiClient.post.mockResolvedValue({ data: { orderId: 'ord-1', status: 'created' } });
      const { useCreateOrder } = await import('../useCheckout');
      const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() });
      result.current.mutate(orderData);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ orderId: 'ord-1', status: 'created' });
      expect(mockApiClient.post).toHaveBeenCalledWith('/checkout/create-order', orderData);
    });

    it('handles API error on create order', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Order creation failed'));
      const { useCreateOrder } = await import('../useCheckout');
      const { result } = renderHook(() => useCreateOrder(), { wrapper: createWrapper() });
      result.current.mutate({});
      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe('useVerifyPayment', () => {
    it('sends post request to verify payment with payment details', async () => {
      const paymentDetails = { orderId: 'ord_456' };
      mockApiClient.post.mockResolvedValue({ data: { verified: true } });
      const { useVerifyPayment } = await import('../useCheckout');
      const { result } = renderHook(() => useVerifyPayment(), { wrapper: createWrapper() });
      result.current.mutate(paymentDetails);
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ verified: true });
      expect(mockApiClient.post).toHaveBeenCalledWith('/checkout/verify-payment', paymentDetails);
    });

    it('handles API error on verify payment', async () => {
      mockApiClient.post.mockRejectedValue(new Error('Payment verification failed'));
      const { useVerifyPayment } = await import('../useCheckout');
      const { result } = renderHook(() => useVerifyPayment(), { wrapper: createWrapper() });
      result.current.mutate({});
      await waitFor(() => expect(result.current.isError).toBe(true));
    });

    it('invalidates cart, orders, and notifications queries on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      queryClient.setQueryData(['cart', 'user-1'], []);
      queryClient.setQueryData(['orders', 'me'], []);
      queryClient.setQueryData(['notifications'], []);
      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
      mockApiClient.post.mockResolvedValue({ data: { verified: true } });
      const { useVerifyPayment } = await import('../useCheckout');
      const { result } = renderHook(() => useVerifyPayment(), {
        wrapper: ({ children }) =>
          React.createElement(QueryClientProvider, { client: queryClient }, children),
      });
      result.current.mutate({});
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['cart'], exact: false });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['orders', 'me'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['notifications'] });
    });
  });
});

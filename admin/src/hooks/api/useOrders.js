import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';

/**
 * Hook to fetch all orders with optional filters
 */
export const useOrders = (filters = {}) => {
  return useQuery({
    queryKey: ['adminOrders', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'all') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);

      const { data } = await apiClient.get(`/admin/orders?${params.toString()}`);
      return data;
    },
  });
};

/**
 * Hook to fetch single order details
 */
export const useOrderDetail = (id) => {
  return useQuery({
    queryKey: ['adminOrder', id],
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/orders/${id}`);
      return data;
    },
    enabled: !!id,
  });
};

/**
 * Hook to update order status
 */
export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data } = await apiClient.patch(`/admin/orders/${id}/status`, { status });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrder', variables.id] });
    },
  });
};

/**
 * Hook to mark order as shipped
 */
export const useShipOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, trackingID }) => {
      const { data } = await apiClient.patch(`/admin/orders/${id}/ship`, { trackingID });
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrder', variables.id] });
    },
  });
};

/**
 * Hook to mark a WhatsApp-checkout order's payment as received. There is no
 * gateway behind this method, so this is the only way to move it to Paid
 * ahead of the Delivered auto-mark that COD relies on.
 */
export const useMarkOrderPaid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.patch(`/admin/orders/${id}/mark-paid`);
      return data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminOrder', id] });
    },
  });
};

/**
 * Hook to create a manual order (cash/walk-in sale or backfill)
 */
export const useCreateManualOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderData) => {
      const { data } = await apiClient.post('/admin/orders/manual', orderData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminOrders'] });
      queryClient.invalidateQueries({ queryKey: ['adminProducts'] });
    },
  });
};

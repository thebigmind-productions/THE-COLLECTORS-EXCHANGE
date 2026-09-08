import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';

/**
 * Hook to fetch the current user's vendor profile
 */
export const useVendorProfile = () => {
  return useQuery({
    queryKey: ['vendor', 'profile'],
    queryFn: async () => {
      const { data } = await apiClient.get('/vendor/profile');
      return data;
    },
    retry: false, // Don't retry if not registered yet
  });
};

/**
 * Hook to fetch the vendor's statistics
 */
export const useVendorStats = ({ enabled = true } = {}) => {
  return useQuery({
    queryKey: ['vendor', 'stats'],
    queryFn: async () => {
      const { data } = await apiClient.get('/vendor/stats');
      return data;
    },
    // /vendor/stats 404s for anyone without a vendor profile, so a plain buyer
    // opening their account page would otherwise fire (and retry) a doomed request.
    enabled,
    retry: false,
  });
};

/**
 * Hook to subscribe/upgrade to bulk vendor plan
 */
/**
 * Hook to fetch vendor analytics overview
 */
export const useVendorAnalyticsOverview = (period = '30d') => {
  return useQuery({
    queryKey: ['vendor', 'analytics', 'overview', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/analytics/overview?period=${period}`);
      return data;
    },
  });
};

/**
 * Hook to fetch customer interest funnel data
 */
export const useVendorAnalyticsInterest = (period = '30d') => {
  return useQuery({
    queryKey: ['vendor', 'analytics', 'interest', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/analytics/interest?period=${period}`);
      return data;
    },
  });
};

/**
 * Hook to fetch sales graph data (time-series)
 */
export const useVendorSalesGraph = (period = '30d') => {
  return useQuery({
    queryKey: ['vendor', 'analytics', 'sales-graph', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/analytics/sales-graph?period=${period}`);
      return data;
    },
  });
};

/**
 * Hook to fetch top-selling products
 */
export const useVendorTopProducts = (period = '30d') => {
  return useQuery({
    queryKey: ['vendor', 'analytics', 'top-products', period],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/analytics/top-products?period=${period}`);
      return data;
    },
  });
};

/**
 * Hook to fetch vendor payouts
 */
export const useVendorPayouts = (params = {}) => {
  const { status, page = 1, limit = 20 } = params;
  const queryParams = new URLSearchParams({ page, limit });
  if (status) queryParams.set('status', status);

  return useQuery({
    queryKey: ['vendor', 'payouts', params],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/payouts?${queryParams.toString()}`);
      return data;
    },
  });
};

/**
 * Hook to fetch the order items that make up one payout.
 *
 * Lazily enabled: the dashboard only asks once a seller expands a payout row,
 * so the common case (glancing at the list) fires no extra requests.
 */
export const useVendorPayoutItems = (payoutId) => {
  return useQuery({
    queryKey: ['vendor', 'payouts', payoutId, 'items'],
    queryFn: async () => {
      const { data } = await apiClient.get(`/vendor/payouts/${payoutId}/items`);
      return data;
    },
    enabled: Boolean(payoutId),
  });
};

/**
 * Hook to save where the seller's payout money should go (UPI).
 */
export const useUpdatePayoutDetails = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ payoutUpi, payoutUpiName }) => {
      const { data } = await apiClient.patch('/vendor/payout-details', {
        payoutUpi,
        payoutUpiName,
      });
      return data;
    },
    onSuccess: () => {
      // The profile carries the masked UPI the dashboard renders.
      queryClient.invalidateQueries({ queryKey: ['vendor', 'profile'] });
    },
  });
};

/**
 * Hook to fetch vendor's sold order items
 */
export const useVendorOrders = () => {
  return useQuery({
    queryKey: ['vendor', 'orders'],
    queryFn: async () => {
      const { data } = await apiClient.get('/vendor/orders');
      return data;
    },
  });
};

/**
 * Hook to mark an order item as shipped
 */
export const useShipOrderItem = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderItemId, trackingID }) => {
      const { data } = await apiClient.patch(`/vendor/orders/${orderItemId}/ship`, { trackingID });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendor', 'orders'] });
    },
  });
};

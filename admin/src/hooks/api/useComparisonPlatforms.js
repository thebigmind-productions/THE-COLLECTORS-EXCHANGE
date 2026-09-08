import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from './apiClient';

export const useComparisonPlatforms = () => {
  return useQuery({
    queryKey: ['comparisonPlatforms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/comparison-platforms');
      return data.data;
    },
  });
};

export const useCreateComparisonPlatform = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.post('/admin/comparison-platforms', payload);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisonPlatforms'] });
    },
  });
};

export const useUpdateComparisonPlatform = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data } = await apiClient.patch(`/admin/comparison-platforms/${id}`, updates);
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisonPlatforms'] });
    },
  });
};

export const useDeleteComparisonPlatform = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(`/admin/comparison-platforms/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisonPlatforms'] });
    },
  });
};

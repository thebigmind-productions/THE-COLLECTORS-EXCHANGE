import { useQuery } from '@tanstack/react-query';
import apiClient from './apiClient';

/**
 * The admin-managed list of third-party marketplaces (eBay, Chrono24, ...) a
 * product's listing can be compared against. Rarely changes, so a long
 * staleTime avoids refetching it on every product page/listing form visit.
 */
export const useComparisonPlatforms = () => {
  return useQuery({
    queryKey: ['comparison-platforms'],
    queryFn: async () => {
      const { data } = await apiClient.get('/comparison-platforms');
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
};

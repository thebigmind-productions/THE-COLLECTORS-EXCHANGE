import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ComparisonPlatforms from '../ComparisonPlatforms';

const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPatch = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../hooks/api/apiClient', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    patch: (...args) => mockPatch(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const platforms = [
  { id: 'p1', name: 'eBay', logoUrl: null, active: true, sortOrder: 0 },
  { id: 'p2', name: 'Chrono24', logoUrl: null, active: false, sortOrder: 1 },
];

describe('ComparisonPlatforms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ data: { data: platforms } });
    window.confirm = vi.fn(() => true);
  });

  it('lists existing platforms', async () => {
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    expect(await screen.findByText('eBay')).toBeInTheDocument();
    expect(screen.getByText('Chrono24')).toBeInTheDocument();
  });

  it('shows an empty state with no platforms', async () => {
    mockGet.mockResolvedValue({ data: { data: [] } });
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    expect(await screen.findByText(/no platforms yet/i)).toBeInTheDocument();
  });

  it('creates a new platform', async () => {
    mockPost.mockResolvedValue({ data: { data: { id: 'p3', name: 'Chirp24' } } });
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    await screen.findByText('eBay');
    fireEvent.change(screen.getByPlaceholderText(/platform name/i), {
      target: { value: 'Chirp24' },
    });
    fireEvent.click(screen.getByText('Add Platform'));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith('/admin/comparison-platforms', {
        name: 'Chirp24',
        logoUrl: undefined,
      }),
    );
  });

  it('toggles a platform active/inactive', async () => {
    mockPatch.mockResolvedValue({ data: { data: {} } });
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    await screen.findByText('eBay');
    fireEvent.click(screen.getByLabelText('Toggle eBay'));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith('/admin/comparison-platforms/p1', { active: false }),
    );
  });

  it('deletes a platform after confirming', async () => {
    mockDelete.mockResolvedValue({ data: { success: true } });
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    await screen.findByText('eBay');
    fireEvent.click(screen.getAllByTitle('Delete')[0]);
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('/admin/comparison-platforms/p1'));
  });

  it('edits a platform name inline', async () => {
    mockPatch.mockResolvedValue({ data: { data: {} } });
    render(<ComparisonPlatforms />, { wrapper: createWrapper() });
    await screen.findByText('eBay');
    fireEvent.click(screen.getAllByTitle('Edit')[0]);
    const input = screen.getByDisplayValue('eBay');
    fireEvent.change(input, { target: { value: 'eBay Motors' } });
    fireEvent.click(screen.getByTitle('Save'));
    await waitFor(() =>
      expect(mockPatch).toHaveBeenCalledWith(
        '/admin/comparison-platforms/p1',
        expect.objectContaining({ name: 'eBay Motors' }),
      ),
    );
  });
});

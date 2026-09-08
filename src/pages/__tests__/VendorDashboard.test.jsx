import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import VendorDashboard from '../VendorDashboard';

// Mutable per-test state so a single module mock can serve every scenario.
const state = {
  profile: {
    id: 'v1',
    companyName: 'Test Vendor',
    pickupAddress: '12 Residency Road',
    pickupCity: 'Bengaluru',
    pickupState: 'Karnataka',
    pickupZip: '560025',
    payoutUpiMasked: null,
    payoutUpiName: null,
    payoutUpiUpdatedAt: null,
    payoutDetailsAvailable: true,
  },
  overview: {
    orderCount: 5,
    saleCount: 10,
    totalRevenue: 50000,
    totalPlatformFees: 5000,
    netEarnings: 45000,
    paidRevenue: 40000,
    pendingPayout: 10000,
    totalListings: 20,
    activeListings: 15,
    offlineSaleCount: 0,
    offlineRevenue: 0,
  },
  orders: [],
  payouts: { payouts: [], pagination: { page: 1, pages: 0, total: 0, limit: 20 } },
  payoutItems: { data: undefined, isLoading: false, error: null },
};

const shipMutate = vi.fn();
const shipState = { isPending: false, isError: false, isSuccess: false, error: null };
const savePayoutMutate = vi.fn();
const savePayoutState = { isPending: false, isError: false, isSuccess: false, error: null };

vi.mock('../../hooks/api/useVendor', () => ({
  useVendorProfile: vi.fn(() => ({ data: state.profile, isLoading: false })),
  useVendorAnalyticsOverview: vi.fn(() => ({ data: state.overview, isLoading: false })),
  useVendorAnalyticsInterest: vi.fn(() => ({
    data: { totalViews: 100, uniqueViewers: 50, cartAdds: 20, checkoutStarts: 5 },
    isLoading: false,
  })),
  useVendorSalesGraph: vi.fn(() => ({ data: [], isLoading: false })),
  useVendorTopProducts: vi.fn(() => ({ data: [], isLoading: false })),
  useVendorPayouts: vi.fn(() => ({ data: state.payouts, isLoading: false })),
  useVendorOrders: vi.fn(() => ({
    data: state.orders,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })),
  useVendorPayoutItems: vi.fn(() => state.payoutItems),
  useShipOrderItem: vi.fn(() => ({ ...shipState, mutate: shipMutate })),
  useUpdatePayoutDetails: vi.fn(() => ({
    ...savePayoutState,
    mutate: savePayoutMutate,
    reset: vi.fn(),
  })),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => ({ id: 'user1' })),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <MemoryRouter>
          <VendorDashboard />
        </MemoryRouter>
      </HelmetProvider>
    </QueryClientProvider>,
  );
}

const soldItem = {
  id: 'oi1',
  status: 'Pending',
  price: 50000,
  platformFee: 5000,
  quantity: 1,
  product: { id: 'p1', title: 'Vintage Rolex', image: 'rolex.jpg' },
  order: {
    displayId: 'TCE-1042',
    status: 'Processing',
    shippingAddress: '221B Baker Street',
    city: 'Mumbai',
    state: 'Maharashtra',
    zipCode: '400001',
    phone: '9876500000',
    user: { name: 'Priya Nair' },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  state.orders = [];
  state.payouts = { payouts: [], pagination: { page: 1, pages: 0, total: 0, limit: 20 } };
  state.payoutItems = { data: undefined, isLoading: false, error: null };
  state.profile.payoutUpiMasked = null;
  state.profile.payoutDetailsAvailable = true;
  state.overview.offlineSaleCount = 0;
  state.overview.offlineRevenue = 0;
  Object.assign(shipState, { isPending: false, isError: false, isSuccess: false, error: null });
  Object.assign(savePayoutState, {
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  });
});

describe('VendorDashboard', () => {
  it('renders vendor dashboard heading', () => {
    renderDashboard();
    expect(screen.getByText(/Test Vendor/i)).toBeInTheDocument();
  });

  it('renders stat cards with revenue', () => {
    renderDashboard();
    expect(screen.getByText(/50,000/)).toBeInTheDocument();
  });

  it('renders sales trend chart section', () => {
    renderDashboard();
    expect(screen.getByText(/Sales Trend/i)).toBeInTheDocument();
  });

  it('renders period filter buttons', () => {
    renderDashboard();
    const buttons = screen.getAllByText('30 Days');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  describe('sold items', () => {
    it('shows the buyer, order id and full shipping address for a sold item', () => {
      state.orders = [soldItem];
      renderDashboard();
      expect(screen.getByText('Vintage Rolex')).toBeInTheDocument();
      expect(screen.getByText(/TCE-1042/)).toBeInTheDocument();
      expect(screen.getByText(/221B Baker Street/)).toBeInTheDocument();
      expect(screen.getByText(/Mumbai, Maharashtra, 400001/)).toBeInTheDocument();
      expect(screen.getByText('9876500000')).toBeInTheDocument();
    });

    // price - platformFee is exactly what admin.js disburses.
    it('shows the sale price, the platform fee and the resulting payout', () => {
      state.orders = [soldItem];
      renderDashboard();
      const row = screen.getByText('Vintage Rolex').closest('div.border');
      expect(within(row).getByText('₹50,000')).toBeInTheDocument();
      expect(within(row).getByText('−₹5,000')).toBeInTheDocument();
      expect(within(row).getByText('₹45,000')).toBeInTheDocument();
    });

    it('ships an item with the tracking ID that was typed', () => {
      state.orders = [soldItem];
      renderDashboard();
      fireEvent.change(screen.getByLabelText(/Tracking ID for Vintage Rolex/i), {
        target: { value: 'BLUEDART123' },
      });
      fireEvent.click(screen.getByRole('button', { name: /Mark as shipped/i }));
      expect(shipMutate).toHaveBeenCalledWith({ orderItemId: 'oi1', trackingID: 'BLUEDART123' });
    });

    it('sends no tracking ID when the field is left blank', () => {
      state.orders = [soldItem];
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /Mark as shipped/i }));
      expect(shipMutate).toHaveBeenCalledWith({ orderItemId: 'oi1', trackingID: undefined });
    });

    // A generic "something went wrong" would hide the one thing the seller can act on.
    it("surfaces the server's own reason when shipping fails", () => {
      state.orders = [soldItem];
      Object.assign(shipState, {
        isError: true,
        error: {
          response: { data: { error: 'Cannot ship: this order has not been paid/confirmed yet' } },
        },
      });
      renderDashboard();
      expect(
        screen.getByText(/Cannot ship: this order has not been paid\/confirmed yet/i),
      ).toBeInTheDocument();
    });

    // Not shippable yet, so it is not in the "to ship" list at all - but it is a
    // real sale the seller should still be able to find, and be told why it is
    // waiting rather than left guessing.
    it('offers no ship control for an unpaid order, and says why', () => {
      state.orders = [{ ...soldItem, order: { ...soldItem.order, status: 'Pending' } }];
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: 'All (1)' }));
      expect(screen.queryByRole('button', { name: /Mark as shipped/i })).not.toBeInTheDocument();
      expect(screen.getByText(/Waiting on payment/i)).toBeInTheDocument();
    });

    it('offers no ship control for an already shipped item', () => {
      state.orders = [{ ...soldItem, status: 'Shipped', trackingID: 'BD-9' }];
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: 'All (1)' }));
      expect(screen.queryByRole('button', { name: /Mark as shipped/i })).not.toBeInTheDocument();
      expect(screen.getByText(/BD-9/)).toBeInTheDocument();
    });

    it('hides shipped items from the default "to ship" view but keeps them under All', () => {
      state.orders = [{ ...soldItem, status: 'Shipped' }];
      renderDashboard();
      expect(screen.getByText(/Nothing is waiting to be shipped/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'All (1)' }));
      expect(screen.getByText('Vintage Rolex')).toBeInTheDocument();
    });
  });

  describe('payout details', () => {
    it('prompts persistently when no UPI is on file', () => {
      renderDashboard();
      expect(screen.getByText(/nowhere to send your payouts/i)).toBeInTheDocument();
      // And again next to the payouts themselves, where the consequence bites.
      expect(screen.getAllByText(/No UPI ID on file/i).length).toBeGreaterThanOrEqual(2);
    });

    it('shows the masked UPI when one is on file', () => {
      state.profile.payoutUpiMasked = '98******10@ybl';
      renderDashboard();
      expect(screen.getAllByText(/98\*+10@ybl/).length).toBeGreaterThanOrEqual(1);
    });

    it('submits the UPI ID that was entered', () => {
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /Add UPI ID/i }));
      fireEvent.change(screen.getByLabelText(/^UPI ID$/i), {
        target: { value: '9876543210@ybl' },
      });
      fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));
      expect(savePayoutMutate).toHaveBeenCalledWith(
        { payoutUpi: '9876543210@ybl', payoutUpiName: undefined },
        expect.anything(),
      );
    });

    it("shows the server's validation message rather than a generic failure", () => {
      Object.assign(savePayoutState, {
        isError: true,
        error: {
          response: {
            data: { error: 'Enter a valid UPI ID like 9876543210@ybl — not an email address' },
          },
        },
      });
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /Add UPI ID/i }));
      expect(screen.getByText(/not an email address/i)).toBeInTheDocument();
    });

    // Deployed before the migration runs: nagging for a UPI we cannot store
    // would be a lie, so the card says so instead.
    it('does not prompt for a UPI when the feature is not available yet', () => {
      state.profile.payoutDetailsAvailable = false;
      renderDashboard();
      expect(screen.queryByText(/No UPI ID on file/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/nowhere to send your payouts/i)).not.toBeInTheDocument();
      expect(screen.getByText(/not available yet/i)).toBeInTheDocument();
    });

    it('renders the pickup address alongside it', () => {
      renderDashboard();
      expect(screen.getByText(/12 Residency Road/)).toBeInTheDocument();
    });
  });

  describe('payouts', () => {
    const payout = {
      id: 'po1',
      amount: 45000,
      status: 'PENDING',
      periodStart: '2026-08-01T00:00:00Z',
      periodEnd: '2026-08-31T00:00:00Z',
      note: 'Auto-created from 2 delivered item(s)',
    };

    it("renders the payout's note, which admin.js writes but nothing ever showed", () => {
      state.payouts = { payouts: [payout], pagination: { page: 1, pages: 1, total: 1, limit: 20 } };
      renderDashboard();
      expect(screen.getByText(/Auto-created from 2 delivered item\(s\)/)).toBeInTheDocument();
    });

    it('expands a payout into the items that make it up', () => {
      state.payouts = { payouts: [payout], pagination: { page: 1, pages: 1, total: 1, limit: 20 } };
      state.payoutItems = {
        data: {
          items: [
            {
              id: 'oi1',
              payout: 45000,
              product: { title: 'Vintage Rolex' },
              order: { displayId: 'TCE-1042' },
            },
          ],
          totals: { itemCount: 1, gross: 50000, platformFee: 5000, payout: 45000 },
        },
        isLoading: false,
        error: null,
      };
      renderDashboard();
      fireEvent.click(screen.getByRole('button', { name: /Show items/i }));
      expect(screen.getByText(/Vintage Rolex/)).toBeInTheDocument();
      expect(screen.getByText(/1 item · sale ₹50,000 − fee ₹5,000/)).toBeInTheDocument();
    });

    it('shows net earnings next to the payouts they come from', () => {
      renderDashboard();
      expect(screen.getByText(/Net earnings/i)).toBeInTheDocument();
      expect(screen.getByText('₹45,000')).toBeInTheDocument();
    });
  });

  describe('metrics that used to mislead', () => {
    it('names the checkout-start rate for what it measures', () => {
      renderDashboard();
      expect(screen.getByText(/Checkout start rate/i)).toBeInTheDocument();
      expect(screen.queryByText(/^Conversion Rate$/i)).not.toBeInTheDocument();
    });

    it('adds a real views-to-sales rate from saleCount', () => {
      renderDashboard();
      expect(screen.getByText(/Views to sales/i)).toBeInTheDocument();
      // 10 sales / 100 views
      expect(screen.getByText('10.0%')).toBeInTheDocument();
    });

    // Total Revenue includes offline sales; netEarnings cannot. Saying so is the
    // difference between an explanation and an apparent bug.
    it('explains the gap when the seller has marked items sold themselves', () => {
      state.overview.offlineSaleCount = 2;
      state.overview.offlineRevenue = 12000;
      renderDashboard();
      expect(screen.getByText(/marked sold by you outside the Exchange/i)).toBeInTheDocument();
      expect(screen.getByText(/Net earnings \(Exchange sales only\)/i)).toBeInTheDocument();
    });

    it('shows no such footnote when every sale went through the Exchange', () => {
      renderDashboard();
      expect(
        screen.queryByText(/marked sold by you outside the Exchange/i),
      ).not.toBeInTheDocument();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import Account from '../Account';
import { useMe } from '../../hooks/api/useUser';
import { useVendorProfile } from '../../hooks/api/useVendor';

vi.mock('../../hooks/api/useUser', () => ({
  useMe: vi.fn(() => ({
    data: { id: 'user1', name: 'Test User', email: 'test@test.com' },
    isLoading: false,
  })),
  useUpdateProfile: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useSubmitKyc: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRegisterUser: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../../hooks/api/useWishlist', () => ({
  useWishlist: vi.fn(() => ({ data: [], isLoading: false })),
  useAddToWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useRemoveFromWishlist: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../hooks/api/useOrders', () => ({
  useMyOrders: vi.fn(() => ({ data: [], isLoading: false })),
}));

vi.mock('../../hooks/api/useNotifications', () => ({
  useNotifications: vi.fn(() => ({ data: [], isLoading: false })),
  useMarkNotificationRead: vi.fn(() => ({ mutate: vi.fn() })),
  useMarkAllNotificationsRead: vi.fn(() => ({ mutate: vi.fn() })),
}));

vi.mock('../../hooks/api/useProducts', () => ({
  useAddProduct: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useDeleteProduct: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useAddBulkProducts: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useUpdateProduct: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
  useMarkAsSold: vi.fn(() => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(() => Promise.resolve()),
    isLoading: false,
  })),
}));

vi.mock('../../hooks/api/useVendor', () => ({
  useVendorProfile: vi.fn(() => ({ data: null, isLoading: false })),
  useVendorStats: vi.fn(() => ({ data: null, isLoading: false })),
}));

vi.mock('../../hooks/api/useTestimonials', () => ({
  useTestimonials: vi.fn(() => ({ data: [], isLoading: false })),
  useSubmitTestimonial: vi.fn(() => ({ mutate: vi.fn(), isLoading: false })),
}));

vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => ({ id: 'user1', name: 'Test User' })),
  setUser: vi.fn(),
  clearUser: vi.fn(),
  uploadProductImage: vi.fn(),
  uploadKycDocument: vi.fn(),
  uploadTestimonialImage: vi.fn(),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

vi.mock('../../components/ConfirmDialog', () => ({
  useConfirm: vi.fn(() => vi.fn(() => Promise.resolve(true))),
}));

vi.mock('../../utils/supabase', () => ({
  supabase: {
    auth: {
      signOut: vi.fn(() => Promise.resolve({ error: null })),
      getSession: vi.fn(() => Promise.resolve({ data: { session: null } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOAuth: vi.fn(() => Promise.resolve({ data: null, error: null })),
      updateUser: vi.fn(() => Promise.resolve({ data: null, error: null })),
    },
  },
}));

vi.mock('../../hooks/api/apiClient', () => ({
  default: { post: vi.fn(), get: vi.fn() },
}));

const renderAccount = () => renderWithProviders(<Account />, { route: '/account' });

describe('Account', () => {
  // Account gates its UI behind an async Supabase session check
  // ("Authenticating Profile..."), so every assertion has to wait for it.
  it('renders the account shell once the session check resolves', async () => {
    renderAccount();
    expect(await screen.findByRole('heading', { name: /collector profile/i })).toBeInTheDocument();
  });

  it('renders tab navigation', async () => {
    renderAccount();
    // Section labels come from the `sections` list in Account.jsx. They are
    // rendered twice (desktop sidebar + mobile section index), so match all.
    expect((await screen.findAllByText('My Orders')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Listings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Notifications').length).toBeGreaterThan(0);
  });

  it('renders edit profile section', async () => {
    renderAccount();
    // The profile card is headed "Collector Profile" (there is no
    // "Personal Information" heading in the current markup).
    expect(await screen.findByRole('heading', { name: /collector profile/i })).toBeInTheDocument();
  });
});

// ── Seller-side correctness ──────────────────────────────────────────────────
// These cover the four seller bugs that were invisible from the default
// (buyer, unverified) render: the KYC rejection state, the active-listing slot
// count, the mark-sold affordance and the Sold copy.

const BASE_USER = {
  id: 'user1',
  name: 'Test User',
  email: 'test@test.com',
  type: 'individual',
};

const setUser = (overrides) =>
  useMe.mockReturnValue({ data: { ...BASE_USER, ...overrides }, isLoading: false });

const setVendor = (vendor) => useVendorProfile.mockReturnValue({ data: vendor, isLoading: false });

describe('Account — seller verification', () => {
  beforeEach(() => {
    useMe.mockReturnValue({ data: BASE_USER, isLoading: false });
    useVendorProfile.mockReturnValue({ data: null, isLoading: false });
  });

  it('shows the admin rejection reason instead of a pristine empty form', async () => {
    setUser({
      kycStatus: 'none',
      kycData: {
        rejectionReason: 'Aadhaar scan is unreadable',
        rejectedAt: '2026-08-01T10:00:00.000Z',
        aadhaar: '123412341234',
        aadhaarDoc: 'kyc/sb-user1/aadhaar.pdf',
      },
    });
    renderWithProviders(<Account />, { route: '/account?tab=seller' });
    expect(await screen.findByText(/verification not approved/i)).toBeInTheDocument();
    expect(screen.getByText(/Aadhaar scan is unreadable/)).toBeInTheDocument();
    expect(screen.getByText(/fix the items below and resubmit/i)).toBeInTheDocument();
  });

  it('prefills the KYC form so an already-uploaded document is not re-collected', async () => {
    setUser({
      kycStatus: 'none',
      kycData: {
        rejectionReason: 'PAN card blurry',
        aadhaar: '123412341234',
        aadhaarDoc: 'kyc/sb-user1/aadhaar.pdf',
      },
    });
    renderWithProviders(<Account />, { route: '/account?tab=seller' });
    expect(await screen.findByPlaceholderText(/enter 12-digit aadhaar number/i)).toHaveValue(
      '123412341234',
    );
    // DocUploadField switches its label to "Replace Scan" once a doc is attached.
    expect(screen.getAllByText(/replace scan/i).length).toBeGreaterThan(0);
  });

  it('does not show the rejection banner to a seller who never applied', async () => {
    setUser({ kycStatus: 'none' });
    renderWithProviders(<Account />, { route: '/account?tab=seller' });
    expect(await screen.findByText(/upload identity documents/i)).toBeInTheDocument();
    expect(screen.queryByText(/verification not approved/i)).not.toBeInTheDocument();
  });
});

describe('Account — seller listings', () => {
  const soldProduct = {
    id: 'p-sold',
    title: 'Sold Watch',
    category: 'Timepieces',
    price: 10000,
    condition: 'Good',
    description: 'A watch',
    status: 'Sold',
    images: [],
  };
  const rejectedProduct = {
    ...soldProduct,
    id: 'p-rejected',
    title: 'Rejected Ring',
    status: 'Rejected',
  };
  const approvedProduct = { ...soldProduct, id: 'p-live', title: 'Live Coin', status: 'Approved' };

  beforeEach(() => {
    useMe.mockReturnValue({ data: BASE_USER, isLoading: false });
    useVendorProfile.mockReturnValue({ data: null, isLoading: false });
  });

  // Regression: the slot count used every product ever created, so a seller who
  // had SOLD their five items was refused a sixth listing the backend would
  // have accepted.
  it('counts only active listings against the slot allowance', async () => {
    setUser({
      kycStatus: 'verified',
      products: [soldProduct, rejectedProduct, approvedProduct],
    });
    setVendor({ type: 'SINGLE', maxListings: 5, status: 'APPROVED', offlineSoldIds: [] });
    renderWithProviders(<Account />, { route: '/account?tab=listings' });
    expect(await screen.findByText(/1 of 5 active listings used/i)).toBeInTheDocument();
  });

  // Regression: "In Review" counted anything that was neither Approved nor Sold,
  // so a seller with rejections was told those were still under review.
  it('does not count rejected listings as in review', async () => {
    setUser({ kycStatus: 'verified', products: [rejectedProduct, approvedProduct] });
    setVendor({ type: 'SINGLE', maxListings: 5, status: 'APPROVED', offlineSoldIds: [] });
    renderWithProviders(<Account />, { route: '/account?tab=listings' });
    expect(await screen.findByText('Needs Attention')).toBeInTheDocument();
  });

  it('never invites the seller to undo a sale a real buyer made', async () => {
    setUser({ kycStatus: 'verified', products: [soldProduct] });
    setVendor({ type: 'SINGLE', maxListings: 5, status: 'APPROVED', offlineSoldIds: [] });
    renderWithProviders(<Account />, { route: '/account?tab=listings' });
    expect(await screen.findByText(/this item found a buyer/i)).toBeInTheDocument();
    // Neither the desktop nor the mobile card may offer to undo it.
    expect(screen.queryByText(/by mistake/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/to relist/i)).not.toBeInTheDocument();
  });

  it('offers to relist a sale the seller marked themselves', async () => {
    setUser({ kycStatus: 'verified', products: [soldProduct] });
    setVendor({
      type: 'SINGLE',
      maxListings: 5,
      status: 'APPROVED',
      offlineSoldIds: ['p-sold'],
    });
    renderWithProviders(<Account />, { route: '/account?tab=listings' });
    expect(await screen.findByText(/marked it by mistake/i)).toBeInTheDocument();
  });

  // The backend rejects mark-as-sold for anything but an Approved listing, so
  // offering the button elsewhere could only ever produce an error toast.
  it('only offers mark-as-sold on approved listings', async () => {
    setUser({
      kycStatus: 'verified',
      products: [soldProduct, rejectedProduct, approvedProduct],
    });
    setVendor({ type: 'SINGLE', maxListings: 5, status: 'APPROVED', offlineSoldIds: [] });
    renderWithProviders(<Account />, { route: '/account?tab=listings' });
    // Each listing renders twice (a mobile compact card and a desktop card;
    // jsdom applies no media queries so both are in the DOM). Three listings =
    // six Delete buttons, but only the single Approved one may be marked sold.
    expect(await screen.findAllByTitle('Mark as sold')).toHaveLength(2);
    expect(screen.getAllByTitle('Delete listing')).toHaveLength(6);
  });
});

// ── Order history ────────────────────────────────────────────────────────────
// After paying, this page is the ONLY place a buyer can see what is happening
// to their money and their parcel. It used to show a status word, a total, and
// a tracking number as inert plain text with no courier named.

describe('Account — order history', () => {
  const baseOrder = {
    id: 'order-abc12345',
    displayId: 'HOR00042',
    createdAt: '2026-08-01T10:00:00.000Z',
    status: 'Shipped',
    totalAmount: 60000,
    paymentMethod: 'online',
    paymentStatus: 'Paid',
    buyerName: 'Priya Sharma',
    shippingAddress: '12 Residency Road',
    city: 'Bengaluru',
    state: 'Karnataka',
    zipCode: '560025',
    phone: '9876543210',
    trackingID: 'DL123456789',
    items: [
      {
        id: 'oi1',
        productId: 'p1',
        quantity: 1,
        price: 60000,
        product: { title: 'Rolex Submariner 5513', image: 'https://cdn.example/watch.jpg' },
      },
    ],
  };

  const renderOrders = async (overrides = {}) => {
    const L = await import('lucide-react');
    console.log(
      'ICONS',
      [
        'CircleHelp',
        'Banknote',
        'IndianRupee',
        'BadgeIndianRupee',
        'HandCoins',
        'Receipt',
        'CircleDollarSign',
        'LifeBuoy',
        'MessageCircle',
        'Wallet',
        'HelpCircle',
      ]
        .map((n) => n + '=' + typeof L[n])
        .join(' '),
    );
    const { useMyOrders } = await import('../../hooks/api/useOrders');
    vi.mocked(useMyOrders).mockReturnValue({
      data: [{ ...baseOrder, ...overrides }],
      isLoading: false,
    });
    useMe.mockReturnValue({ data: BASE_USER, isLoading: false });
    return renderWithProviders(<Account />, { route: '/account?tab=orders' });
  };

  it('makes the tracking number a real link that names the courier', async () => {
    await renderOrders();
    const link = await screen.findByRole('link', { name: /track with/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('DL123456789'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows a four-step timeline marking where the order has reached', async () => {
    await renderOrders({ status: 'Shipped' });
    const progress = await screen.findByRole('list', { name: /order progress/i });
    ['Placed', 'Processing', 'Shipped', 'Delivered'].forEach((step) => {
      expect(within(progress).getByText(step)).toBeInTheDocument();
    });
    // Shipped is step 3 of 4, so it is the current one.
    expect(within(progress).getByText('Shipped').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });

  it('replaces the timeline with an explanation for a cancelled order', async () => {
    await renderOrders({ status: 'Cancelled' });
    expect(await screen.findByText(/this order was cancelled/i)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: /order progress/i })).not.toBeInTheDocument();
  });

  it('states the exact cash due on a COD order', async () => {
    await renderOrders({ paymentMethod: 'cod', paymentStatus: 'Pending' });
    expect(await screen.findByText(/₹60,000 due on delivery/i)).toBeInTheDocument();
  });

  it('does not claim cash is due once COD has been collected', async () => {
    await renderOrders({ paymentMethod: 'cod', paymentStatus: 'Paid' });
    await screen.findByText(/Order #HOR00042/i);
    expect(screen.queryByText(/due on delivery/i)).not.toBeInTheDocument();
  });

  it('does not chase cash for a cancelled COD order', async () => {
    await renderOrders({ paymentMethod: 'cod', paymentStatus: 'Pending', status: 'Cancelled' });
    await screen.findByText(/Order #HOR00042/i);
    expect(screen.queryByText(/due on delivery/i)).not.toBeInTheDocument();
  });

  it('shows the delivery address and the payment method', async () => {
    await renderOrders();
    expect(await screen.findByText(/Delivering to/i)).toBeInTheDocument();
    expect(screen.getByText(/12 Residency Road/)).toBeInTheDocument();
    expect(screen.getByText(/Bengaluru/)).toBeInTheDocument();
    expect(screen.getByText(/560025/)).toBeInTheDocument();
    expect(screen.getByText(/Paid online/i)).toBeInTheDocument();
  });

  it('offers a help link prefilled with the order id', async () => {
    await renderOrders();
    const help = await screen.findByRole('link', { name: /need help with this order/i });
    const href = help.getAttribute('href');
    expect(href).toMatch(/^mailto:/);
    expect(decodeURIComponent(href)).toContain('HOR00042');
  });

  // via.placeholder.com is a third party: a missing product image used to leak
  // the page view to it and render broken whenever it was slow or blocked.
  it('never points an order thumbnail at a third-party placeholder host', async () => {
    await renderOrders({
      items: [{ ...baseOrder.items[0], product: { title: 'No Image Item', image: null } }],
    });
    await screen.findByText('No Image Item');
    document.querySelectorAll('img').forEach((img) => {
      expect(img.getAttribute('src') || '').not.toContain('via.placeholder.com');
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import { renderWithProviders } from '../../test/utils';
import Checkout from '../Checkout';
import { useCreateOrder, useVerifyPayment } from '../../hooks/api/useCheckout';

// Mock every export of the real module — a partial factory makes vitest throw
// "No <name> export is defined on the mock" as soon as the page imports one
// of the missing hooks.
vi.mock('../../hooks/api/useCheckout', () => ({
  useCreateOrder: vi.fn(() => ({
    mutateAsync: vi.fn(() => ({ id: 'order1', amount: 15000 })),
    isLoading: false,
  })),
  useApplyCoupon: vi.fn(() => ({ mutateAsync: vi.fn(), isLoading: false })),
  useValidateCoupon: vi.fn(() => ({ mutateAsync: vi.fn(), isLoading: false })),
  useVerifyPayment: vi.fn(() => ({ mutateAsync: vi.fn(), isLoading: false })),
}));

vi.mock('../../hooks/api/useCart', () => ({
  useCart: vi.fn(() => ({
    data: [
      {
        id: '1',
        productId: 'p1',
        product: {
          id: 'p1',
          title: 'Checkout Watch',
          price: 15000,
          images: ['img.jpg'],
          commissionPercent: 20,
          condition: 'Mint',
        },
        quantity: 1,
      },
    ],
    isLoading: false,
  })),
}));

// '1234567890' was never a reachable Indian mobile number — the 2-5 range is a
// landline trunk prefix. It only passed because the old rule was `length >= 10`.
vi.mock('../../utils/storage', () => ({
  getUser: vi.fn(() => ({
    id: 'user1',
    name: 'Test User',
    email: 'test@test.com',
    phone: '9876543210',
  })),
}));

vi.mock('../../components/Toast', () => ({
  useToast: vi.fn(() => vi.fn()),
}));

// The PIN field looks city and state up against India Post. No test may reach
// the real network for it, and no test's assertions may depend on it having
// answered — that is the whole point of it being best-effort.
beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderCheckout = () => renderWithProviders(<Checkout />);

describe('Checkout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders checkout heading', () => {
    renderCheckout();
    // "Checkout" also appears in the progress stepper, so target the h1.
    expect(screen.getByRole('heading', { level: 1, name: /secure checkout/i })).toBeInTheDocument();
  });

  it('renders order summary with product', () => {
    renderCheckout();
    expect(screen.getByText('Checkout Watch')).toBeInTheDocument();
  });

  it('renders shipping address field', () => {
    renderCheckout();
    expect(screen.getByText(/recipient name/i)).toBeInTheDocument();
  });

  it('renders place order button', () => {
    renderCheckout();
    expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument();
  });

  it('renders the order summary totals', () => {
    renderCheckout();
    expect(screen.getByText('Subtotal (1 items)')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    // Buyer-facing totals are tax-inclusive; no separate tax line is shown.
    expect(screen.getByText(/inclusive of all taxes/i)).toBeInTheDocument();
  });

  // The buyer-facing checkout deliberately shows a single tax-inclusive total.
  // "Platform Contribution", the per-item commission percent and the
  // "GST @ 18%" line are seller-side concepts and live in
  // src/components/account/CommissionSlider.jsx (covered by its own test) and
  // in the seller listing flow in Account.jsx — they have never been rendered
  // by Checkout.jsx. These three assertions were written against markup that
  // never shipped, so they are kept here (skipped) as a record of the intent
  // in case a buyer-side fee breakdown is ever added.
  it.skip('displays Platform Contribution in order summary', () => {
    renderCheckout();
    expect(screen.getByText('Platform Contribution')).toBeInTheDocument();
  });

  it.skip('shows commission percent breakdown per item', () => {
    renderCheckout();
    expect(screen.getByText('20%')).toBeInTheDocument();
  });

  it.skip('displays GST @ 18% in order summary', () => {
    renderCheckout();
    expect(screen.getByText('GST @ 18%')).toBeInTheDocument();
    expect(screen.getByText(/540/)).toBeInTheDocument();
  });
});

/**
 * A checkout that ends badly is the only place on this site where a buyer can
 * lose money. These cover what they are actually told when it happens: the old
 * code caught every failure with a bare `catch {}` and showed one toast reading
 * "Payment verification failed. Please contact support."
 */
describe('Checkout — payment failures', () => {
  const axiosError = (status, data) =>
    Object.assign(new Error('Request failed'), {
      response: { status, data },
    });

  const fillShippingForm = () => {
    fireEvent.change(screen.getByLabelText(/street address/i), {
      target: { value: '12 Marine Drive' },
    });
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: '400001' } });
  };

  const placeOrder = () => fireEvent.click(screen.getByRole('button', { name: /place order/i }));

  const mockCreateOrder = (data) => {
    const mutateAsync = vi.fn().mockResolvedValue(data);
    vi.mocked(useCreateOrder).mockReturnValue({ mutateAsync, isPending: false });
    return mutateAsync;
  };

  const mockVerifyRejects = (err) => {
    const mutateAsync = vi.fn().mockRejectedValue(err);
    vi.mocked(useVerifyPayment).mockReturnValue({ mutateAsync, isPending: false });
    return mutateAsync;
  };

  const codOrder = {
    orderId: 'ord_1',
    displayId: 'HOR00042',
    amount: 15000,
    isCOD: true,
  };

  // isMock takes the same branch shape as a real gateway payment (isCOD false),
  // without needing the Razorpay script.
  const onlineOrder = {
    orderId: 'ord_1',
    displayId: 'HOR00042',
    amount: 15000,
    isMock: true,
    razorpayOrderId: 'rp_order_1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('names the item and the refund when someone else bought it first', async () => {
    mockCreateOrder(codOrder);
    mockVerifyRejects(
      axiosError(409, {
        error: 'One or more items in your order are no longer available',
        soldOut: ['p1'],
        refundRequired: true,
        refundPending: false,
        displayId: 'HOR00042',
        amount: 15000,
      }),
    );
    renderWithProviders(<Checkout />);
    fillShippingForm();
    placeOrder();

    expect(await screen.findByText(/someone was faster/i)).toBeInTheDocument();
    // The piece they lost, by name — not a product id
    expect(screen.getByText('Checkout Watch')).toBeInTheDocument();
    expect(screen.getByText(/₹15,000 has already been refunded/i)).toBeInTheDocument();
    expect(screen.getByText(/5-7 working days/i)).toBeInTheDocument();
    // Support can always be given the reference
    expect(screen.getByText('HOR00042')).toBeInTheDocument();
  });

  it('says a human is releasing the refund when the automatic one failed', async () => {
    mockCreateOrder(onlineOrder);
    mockVerifyRejects(
      axiosError(409, {
        error: 'One or more items in your order are no longer available',
        soldOut: ['p1'],
        refundRequired: true,
        refundPending: true,
        displayId: 'HOR00042',
        amount: 15000,
      }),
    );
    renderWithProviders(<Checkout />);
    fillShippingForm();
    placeOrder();

    expect(
      await screen.findByText(/refund of ₹15,000 needs a person to release it/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/refund being processed/i)).toBeInTheDocument();
    expect(screen.getAllByText('support@thecollectorsexchange.in').length).toBeGreaterThan(0);
  });

  it('tells a buyer whose payment could not be confirmed NOT to pay again', async () => {
    mockCreateOrder(onlineOrder);
    mockVerifyRejects(axiosError(500, { error: 'Internal Server Error' }));
    renderWithProviders(<Checkout />);
    fillShippingForm();
    placeOrder();

    expect(await screen.findByText(/we could not confirm your payment/i)).toBeInTheDocument();
    // Said twice on purpose — once as the eyebrow above the headline, once in
    // the body where the consequence (being charged twice) is spelled out.
    expect(screen.getAllByText(/please do not pay again/i).length).toBeGreaterThan(1);
    // Quoted in the reference block and again wherever we ask them to email us
    expect(screen.getAllByText(/HOR00042/).length).toBeGreaterThan(0);
  });

  it('surfaces the same screen for a network failure with no response', async () => {
    mockCreateOrder(onlineOrder);
    mockVerifyRejects(new Error('Network Error'));
    renderWithProviders(<Checkout />);
    fillShippingForm();
    placeOrder();

    expect(await screen.findByText(/we could not confirm your payment/i)).toBeInTheDocument();
    expect(screen.getByText('HOR00042')).toBeInTheDocument();
  });

  it('does not tell a COD buyer their order failed to be created — it was', async () => {
    mockCreateOrder(codOrder);
    mockVerifyRejects(axiosError(500, { error: 'Internal Server Error' }));
    renderWithProviders(<Checkout />);
    fillShippingForm();
    placeOrder();

    expect(await screen.findByText(/we could not confirm your order/i)).toBeInTheDocument();
    expect(screen.getByText(/please do not place the order again/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByText('HOR00042')).toBeInTheDocument();
  });
});

/**
 * The Razorpay modal itself: closing it, and an attempt the bank declined.
 * Both used to be completely silent, and pressing pay again created a second
 * order and a second gateway order.
 */
describe('Checkout — Razorpay modal outcomes', () => {
  let rzpInstance;
  let createOrder;

  const fillShippingForm = () => {
    fireEvent.change(screen.getByLabelText(/street address/i), {
      target: { value: '12 Marine Drive' },
    });
    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'Mumbai' } });
    fireEvent.change(screen.getByLabelText(/^state$/i), { target: { value: 'Maharashtra' } });
    fireEvent.change(screen.getByLabelText(/pin code/i), { target: { value: '400001' } });
  };

  const openModal = async () => {
    renderWithProviders(<Checkout />);
    // jsdom never fetches the checkout script, so raise its load event by hand.
    const script = document.querySelector('script[src*="checkout.razorpay.com"]');
    fireEvent.load(script);
    fillShippingForm();
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalled());
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createOrder = vi.fn().mockResolvedValue({
      orderId: 'ord_1',
      displayId: 'HOR00042',
      amount: 15000,
      razorpayOrderId: 'rp_order_1',
      keyId: 'rzp_test_key',
      user: { name: 'Test User', email: 'test@test.com', phone: '1234567890' },
    });
    vi.mocked(useCreateOrder).mockReturnValue({ mutateAsync: createOrder, isPending: false });
    window.Razorpay = vi.fn((options) => {
      rzpInstance = {
        options,
        handlers: {},
        on: vi.fn((event, cb) => {
          rzpInstance.handlers[event] = cb;
        }),
        open: vi.fn(),
      };
      return rzpInstance;
    });
  });

  afterEach(() => {
    delete window.Razorpay;
  });

  it('tells the buyer their order is saved when they close the modal', async () => {
    await openModal();
    act(() => rzpInstance.options.modal.ondismiss());

    expect(await screen.findByText(/payment window closed/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing has been charged/i)).toBeInTheDocument();
    expect(screen.getByText(/HOR00042 is saved/i)).toBeInTheDocument();
  });

  it("passes through Razorpay's own reason when an attempt fails", async () => {
    await openModal();
    expect(rzpInstance.on).toHaveBeenCalledWith('payment.failed', expect.any(Function));
    act(() =>
      rzpInstance.handlers['payment.failed']({
        error: { description: 'Your card was declined by the issuing bank.' },
      }),
    );

    expect(await screen.findByText(/that payment did not go through/i)).toBeInTheDocument();
    expect(screen.getByText(/declined by the issuing bank/i)).toBeInTheDocument();
  });

  it('reuses the existing order on retry instead of creating a second one', async () => {
    await openModal();
    expect(createOrder).toHaveBeenCalledTimes(1);

    act(() => rzpInstance.options.modal.ondismiss());
    await screen.findByText(/payment window closed/i);

    // Pressing pay again with an unchanged cart and address must reopen the
    // gateway against the order that already exists.
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));
    await waitFor(() => expect(window.Razorpay).toHaveBeenCalledTimes(2));
    expect(createOrder).toHaveBeenCalledTimes(1);
    expect(rzpInstance.options.order_id).toBe('rp_order_1');
  });

  it('creates a fresh order when the shipping details change between attempts', async () => {
    await openModal();
    act(() => rzpInstance.options.modal.ondismiss());
    await screen.findByText(/payment window closed/i);

    fireEvent.change(screen.getByLabelText(/^city$/i), { target: { value: 'Pune' } });
    fireEvent.click(screen.getByRole('button', { name: /place order/i }));

    await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(2));
  });
});

/**
 * The shipping form as an Indian buyer meets it on a phone. Everything here
 * used to be either absent or wrong: PIN opened the alphabetic keyboard and
 * accepted "4", phone accepted "abcdefghij", state was free text, nothing was
 * autofillable, and a corrected field stayed red until the next submit.
 */
describe('Checkout — Indian address form', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const pinField = () => screen.getByLabelText(/pin code/i);
  const phoneField = () => screen.getByLabelText(/^phone$/i);
  const stateField = () => screen.getByLabelText(/^state$/i);
  const cityField = () => screen.getByLabelText(/^city$/i);

  const mockCreateOrder = () => {
    const mutateAsync = vi.fn().mockResolvedValue({
      orderId: 'ord_1',
      displayId: 'HOR00042',
      amount: 15000,
      isCOD: true,
    });
    vi.mocked(useCreateOrder).mockReturnValue({ mutateAsync, isPending: false });
    vi.mocked(useVerifyPayment).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({ order: { id: 'ord_1', items: [] } }),
      isPending: false,
    });
    return mutateAsync;
  };

  const fillValidAddress = () => {
    fireEvent.change(screen.getByLabelText(/street address/i), {
      target: { value: '12 Marine Drive' },
    });
    fireEvent.change(cityField(), { target: { value: 'Mumbai' } });
    fireEvent.change(stateField(), { target: { value: 'Maharashtra' } });
    fireEvent.change(pinField(), { target: { value: '400001' } });
  };

  const placeOrder = () => fireEvent.click(screen.getByRole('button', { name: /place order/i }));

  describe('mobile keyboards', () => {
    it('opens the number pad for the PIN code and caps it at six digits', () => {
      renderCheckout();
      expect(pinField()).toHaveAttribute('inputMode', 'numeric');
      expect(pinField()).toHaveAttribute('pattern', '[0-9]{6}');
      expect(pinField()).toHaveAttribute('maxLength', '6');
    });

    it('opens the phone pad for the phone number and caps it at ten digits', () => {
      renderCheckout();
      expect(phoneField()).toHaveAttribute('inputMode', 'tel');
      expect(phoneField()).toHaveAttribute('maxLength', '10');
    });

    it('drops anything that is not a digit out of the PIN code', () => {
      renderCheckout();
      fireEvent.change(pinField(), { target: { value: '4a0b0c0d0e1' } });
      expect(pinField()).toHaveValue('400001');
    });

    it('reduces a pasted +91 number to the bare ten digits', () => {
      renderCheckout();
      fireEvent.change(phoneField(), { target: { value: '+91 98765 43210' } });
      expect(phoneField()).toHaveValue('9876543210');
    });

    it('reduces a pasted 0-prefixed number to the bare ten digits', () => {
      renderCheckout();
      fireEvent.change(phoneField(), { target: { value: '09876543210' } });
      expect(phoneField()).toHaveValue('9876543210');
    });
  });

  describe('autofill tokens', () => {
    // Without these, Chrome and Safari on Android/iOS will never offer a saved
    // address, which on a mobile checkout is the single biggest drop-off.
    it.each([
      [/recipient name/i, 'name'],
      [/street address/i, 'street-address'],
      [/^city$/i, 'address-level2'],
      [/^state$/i, 'address-level1'],
      [/pin code/i, 'postal-code'],
      [/^phone$/i, 'tel'],
    ])('tags %s with the right autocomplete token', (label, token) => {
      renderCheckout();
      expect(screen.getByLabelText(label)).toHaveAttribute('autocomplete', token);
    });
  });

  describe('state', () => {
    it('is a closed list of the 28 states and 8 union territories', () => {
      renderCheckout();
      const select = stateField();
      expect(select.tagName).toBe('SELECT');
      // 36 real entries plus the "Select a state" placeholder.
      expect(select.querySelectorAll('option')).toHaveLength(37);
      expect(screen.getByRole('option', { name: 'Maharashtra' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Ladakh' })).toBeInTheDocument();
    });

    it('starts unselected rather than defaulting anyone to one state', () => {
      renderCheckout();
      expect(stateField()).toHaveValue('');
    });
  });

  describe('validation', () => {
    it('rejects a PIN code that is not six digits and does not create an order', async () => {
      const createOrder = mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      fireEvent.change(pinField(), { target: { value: '4000' } });
      placeOrder();

      expect(await screen.findByText(/6-digit pin code/i)).toBeInTheDocument();
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('rejects a phone number that is not a reachable Indian mobile', async () => {
      const createOrder = mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      // Ten digits, so the old `length >= 10` rule waved it through, but 1 is
      // not a mobile prefix and no courier can call it.
      fireEvent.change(phoneField(), { target: { value: '1234567890' } });
      placeOrder();

      expect(await screen.findByText(/starting with 6, 7, 8 or 9/i)).toBeInTheDocument();
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('rejects a blank state', async () => {
      const createOrder = mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      fireEvent.change(stateField(), { target: { value: '' } });
      placeOrder();

      expect(await screen.findByText(/state is required/i)).toBeInTheDocument();
      expect(createOrder).not.toHaveBeenCalled();
    });

    it('clears a field error the moment it is corrected, not on the next submit', async () => {
      mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      fireEvent.change(pinField(), { target: { value: '4000' } });
      placeOrder();
      expect(await screen.findByText(/6-digit pin code/i)).toBeInTheDocument();

      fireEvent.change(pinField(), { target: { value: '400001' } });
      expect(screen.queryByText(/6-digit pin code/i)).not.toBeInTheDocument();
    });

    it('marks an invalid field for assistive tech, and unmarks it when fixed', async () => {
      mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      fireEvent.change(pinField(), { target: { value: '4000' } });
      placeOrder();

      await waitFor(() => expect(pinField()).toHaveAttribute('aria-invalid', 'true'));
      expect(pinField()).toHaveAccessibleDescription(/6-digit pin code/i);

      fireEvent.change(pinField(), { target: { value: '400001' } });
      expect(pinField()).not.toHaveAttribute('aria-invalid');
    });

    it('places the order once the address is valid', async () => {
      const createOrder = mockCreateOrder();
      renderCheckout();
      fillValidAddress();
      placeOrder();

      await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
      expect(createOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          phone: '9876543210',
        }),
      );
    });
  });

  describe('PIN code lookup', () => {
    const mockLookup = (postOffice) =>
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => ({
          ok: true,
          json: async () => [{ Status: 'Success', PostOffice: [postOffice] }],
        })),
      );

    it('fills city and state in from the PIN code', async () => {
      mockLookup({ Name: 'Fort S.O', District: 'Mumbai', State: 'Maharashtra' });
      renderCheckout();
      fireEvent.change(pinField(), { target: { value: '400001' } });

      await waitFor(() => expect(cityField()).toHaveValue('Mumbai'));
      expect(stateField()).toHaveValue('Maharashtra');
    });

    it('never overwrites a city the buyer typed themselves', async () => {
      mockLookup({ District: 'Mumbai', State: 'Maharashtra' });
      renderCheckout();
      fireEvent.change(cityField(), { target: { value: 'Navi Mumbai' } });
      fireEvent.change(pinField(), { target: { value: '400001' } });

      await waitFor(() => expect(stateField()).toHaveValue('Maharashtra'));
      expect(cityField()).toHaveValue('Navi Mumbai');
    });

    // The degradation contract. `fetch` is stubbed to throw by this file's
    // top-level beforeEach, which is exactly what an offline phone does.
    it('says nothing and blocks nothing when India Post is unreachable', async () => {
      const createOrder = mockCreateOrder();
      renderCheckout();
      fillValidAddress();

      // Give the debounce and the failed request room to finish.
      await waitFor(() => expect(global.fetch).toHaveBeenCalled());

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText(/could not|failed|unavailable/i)).not.toBeInTheDocument();
      expect(cityField()).toHaveValue('Mumbai');

      placeOrder();
      await waitFor(() => expect(createOrder).toHaveBeenCalledTimes(1));
    });
  });
});

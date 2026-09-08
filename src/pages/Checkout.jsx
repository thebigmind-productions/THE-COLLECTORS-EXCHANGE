import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../components/SEO';
import {
  ShieldCheck,
  Loader2,
  Check,
  Percent,
  X,
  MapPin,
  Package,
  Truck,
  AlertCircle,
  Info,
  RefreshCw,
  MessageCircle,
} from 'lucide-react';
import { useCart } from '../hooks/api/useCart';
import { useCreateOrder, useVerifyPayment, useValidateCoupon } from '../hooks/api/useCheckout';
import { getUser } from '../utils/storage';
import apiClient from '../hooks/api/apiClient';
import { useToast } from '../components/Toast';
import { Reveal, Magnetic } from '../components/Motion';
import SignInPrompt from '../components/SignInPrompt';
import { imageUrl } from '../utils/image';
import { INDIAN_STATES, INDIAN_UNION_TERRITORIES } from '../config/indianStates';
import { lookupPincode, PIN_CODE_PATTERN } from '../utils/pincode';
import { SUPPORT_EMAIL, MAILTO_HREF, whatsAppHref } from '../config/contact';
import { DISPATCH_DAYS, DELIVERY_DAYS } from '../config/shipping';

// Indian mobile numbers are ten digits and always begin 6, 7, 8 or 9 — the 2-5
// ranges are landline trunk prefixes and can never be reached by a courier's
// delivery SMS. Ten digits only: no +91, no 0 prefix, no spaces, because the
// number is passed straight to the shipping label.
const PHONE_PATTERN = /^[6-9]\d{9}$/;

/**
 * Reduce anything a buyer can paste into a phone box — "+91 98765 43210",
 * "091-9876543210", "(9876) 543210" — to the bare ten digits the shipping
 * label wants. Stripping non-digits alone was not enough: "+919876543210"
 * becomes twelve digits, and a naive truncate to ten would have kept "9198765432".
 */
const normalizePhone = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
};

// One place for the shipping form's field chrome, so a contrast or focus-ring
// change is one edit rather than nine.
const labelClass =
  'block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2';
// border-red-400 was 2.7:1 against the gray-50 field and failed WCAG 1.4.11's
// 3:1 for a control boundary; red-500 clears it at 3.8:1.
const fieldClass = (hasError) =>
  `w-full p-4 bg-gray-50 border focus:outline-none focus:border-luxury-gold transition-colors ${
    hasError ? 'border-red-500' : 'border-gray-200'
  }`;
const errorClass = 'text-red-600 text-xs mt-1';

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const Checkout = () => {
  const currentUser = getUser();
  const { data: cartItems = [], isLoading: cartLoading } = useCart(currentUser?.id);
  const showToast = useToast();
  const createOrderMutation = useCreateOrder();
  const verifyPaymentMutation = useVerifyPayment();
  const validateCouponMutation = useValidateCoupon();

  const [orderSuccess, setOrderSuccess] = useState(null);
  // The cart is invalidated the moment payment verifies, and the verify-payment
  // response returns order items without their product relation. Snapshot the
  // products at purchase time so the confirmation can still show what was bought.
  const [purchasedItems, setPurchasedItems] = useState([]);
  const [form, setForm] = useState({
    shippingAddress: '',
    recipientName: currentUser?.name || '',
    city: '',
    state: '',
    zipCode: '',
    phone: currentUser?.phone || '',
  });
  const [paymentMethod, setPaymentMethod] = useState('whatsapp');
  const [couponInput, setCouponInput] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [errors, setErrors] = useState({});

  // A checkout that ends badly gets a screen of its own, never a toast: the
  // buyer may have been charged, and a message that disappears after four
  // seconds is the worst possible way to tell someone about their money.
  const [paymentIssue, setPaymentIssue] = useState(null);
  // Softer failures — the modal was closed, or an attempt was declined — stay
  // on the form as a banner so the buyer can simply try again.
  const [paymentNotice, setPaymentNotice] = useState(null);
  // An order row already exists the moment create-order returns, BEFORE the
  // WhatsApp handoff screen (or the COD confirmation) appears. Pressing pay
  // again must reuse it, or every abandoned attempt leaves another orphan
  // Pending order in the buyer's history. Keyed on everything the order was
  // priced from, so changing the cart, the coupon, the address or the
  // payment method correctly starts a fresh one.
  const [pendingOrder, setPendingOrder] = useState(null);

  // Shown instead of the order-confirmed screen when paymentMethod is
  // 'whatsapp': there is no payment gateway, so the order is reserved exactly
  // like COD and the buyer is sent to WhatsApp to actually arrange payment.
  const [whatsappHandoff, setWhatsappHandoff] = useState(null);

  // PIN → city/state autofill. Every Indian checkout has this, and typing a PIN
  // is far less error-prone on a phone than typing a district name.
  //
  // It is best-effort in the strictest sense: `lookupPincode` swallows every
  // failure and resolves to null, this effect never surfaces an error, and
  // nothing about placing the order depends on it. If India Post is down the
  // buyer just fills city and state in themselves.
  const [pinLookingUp, setPinLookingUp] = useState(false);
  // What the lookup last wrote, so a second PIN can correct a first PIN's
  // answer without ever overwriting something the buyer typed by hand.
  const autofilled = useRef({ city: null, state: null });
  // The effect below depends only on zipCode, so `form` in its closure can be a
  // render behind. This ref is what the lookup compares against before it writes
  // anything. Synced in an effect rather than during render (refs must not be
  // touched while rendering); the lookup is debounced 350ms and awaits a network
  // round trip, so it always reads a committed value.
  const formRef = useRef(form);
  useEffect(() => {
    formRef.current = form;
  });

  useEffect(() => {
    const pin = form.zipCode.trim();
    if (!PIN_CODE_PATTERN.test(pin)) return undefined;

    const controller = new AbortController();
    let live = true;

    // A short debounce: the last two digits of a PIN arrive in quick succession
    // and only the final value is worth a request.
    const timer = setTimeout(async () => {
      setPinLookingUp(true);
      const result = await lookupPincode(pin, { signal: controller.signal });
      if (!live) return;
      setPinLookingUp(false);
      if (!result) return;

      // Only ever fill a blank field, or replace a value this same lookup put
      // there on a previous PIN. A buyer who typed "Navi Mumbai" keeps
      // "Navi Mumbai" — an autofill that overwrites deliberate typing is worse
      // than no autofill at all.
      const current = formRef.current;
      const patch = {};
      if (result.city && (!current.city.trim() || current.city === autofilled.current.city)) {
        patch.city = result.city;
      }
      if (result.state && (!current.state || current.state === autofilled.current.state)) {
        patch.state = result.state;
      }
      if (Object.keys(patch).length === 0) return;

      autofilled.current = {
        city: patch.city ?? autofilled.current.city,
        state: patch.state ?? autofilled.current.state,
      };
      setForm((prev) => ({ ...prev, ...patch }));
      setErrors((prev) => {
        const next = { ...prev };
        if (patch.city) delete next.city;
        if (patch.state) delete next.state;
        return next;
      });
    }, 350);

    return () => {
      live = false;
      clearTimeout(timer);
      controller.abort();
      // Editing the PIN again while a lookup is in flight must take the hint
      // down with it, or "Looking up city and state…" outlives its request.
      setPinLookingUp(false);
    };
  }, [form.zipCode]);

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
  const discountAmount = appliedCoupon?.discountAmount || 0;
  const total = Math.max(0, subtotal - discountAmount);

  // A field's error used to be computed only here, on submit, and never cleared
  // again until the next submit — so a corrected field stayed red while the
  // buyer stared at it. Every input goes through this, and fixing a field
  // clears its own message the moment you type.
  const setField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const newErrors = {};
    if (!form.recipientName.trim()) newErrors.recipientName = 'Recipient name is required';
    if (!form.shippingAddress.trim()) newErrors.shippingAddress = 'Address is required';
    if (!form.city.trim()) newErrors.city = 'City is required';
    if (!form.state.trim()) newErrors.state = 'State is required';
    if (!form.zipCode.trim()) newErrors.zipCode = 'PIN code is required';
    else if (!PIN_CODE_PATTERN.test(form.zipCode.trim()))
      newErrors.zipCode = 'Enter a 6-digit PIN code';
    if (!form.phone.trim()) newErrors.phone = 'Phone number is required';
    else if (!PHONE_PATTERN.test(form.phone.trim()))
      newErrors.phone = 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Everything the backend prices the order from. If any of it changes, the
  // cached order no longer describes what the buyer is about to pay for.
  const orderFingerprint = () =>
    JSON.stringify({
      ...form,
      paymentMethod,
      couponCode: couponCode.trim(),
      items: cartItems.map((i) => i.productId).sort(),
    });

  // The backend answers a sold-out race with product IDs; the buyer needs names.
  const namesForProductIds = (ids = [], snapshot = []) =>
    ids.map((id) => {
      const match =
        snapshot.find((s) => s.productId === id) || cartItems.find((c) => c.productId === id);
      const product = match?.product;
      if (!product) return 'One of the pieces in your order';
      return [product.brand, product.title].filter(Boolean).join(' ');
    });

  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setPaymentNotice(null);

    // Captured before the cart query is invalidated by verification.
    const productSnapshot = cartItems.map((item) => ({
      productId: item.productId,
      product: item.product,
    }));
    const finalizeSuccess = (verifyData) => {
      setPendingOrder(null);
      setPurchasedItems(productSnapshot);
      setOrderSuccess(verifyData.order);
    };

    /**
     * Everything that can go wrong AFTER an order row exists. Nothing is ever
     * charged electronically anymore (cod/whatsapp are both pay-later), so
     * these are about the order itself, not a payment — each one names the
     * order and says what to do next.
     */
    const handleVerifyFailure = (err, orderData, kind) => {
      const status = err?.response?.status;
      const data = err?.response?.data;
      const reference = data?.displayId || orderData.displayId || orderData.orderId;

      if (status === 409 && Array.isArray(data?.soldOut)) {
        setPaymentIssue({
          kind: 'sold_out',
          reference,
          items: namesForProductIds(data.soldOut, productSnapshot),
          amount: data.amount ?? orderData.amount,
        });
        return;
      }

      setPaymentIssue({
        kind,
        reference,
        amount: orderData.amount,
        detail: data?.error || null,
      });
    };

    try {
      const fingerprint = orderFingerprint();
      let orderData = pendingOrder?.fingerprint === fingerprint ? pendingOrder.data : null;
      const isReusedOrder = !!orderData;

      if (!orderData) {
        const orderPayload = {
          ...form,
          paymentMethod,
          items: cartItems.map((item) => ({
            productId: item.productId,
            quantity: 1,
          })),
        };
        if (couponCode.trim()) {
          orderPayload.couponCode = couponCode.trim();
        }

        orderData = await createOrderMutation.mutateAsync(orderPayload);
        setPendingOrder({ fingerprint, data: orderData });

        // Set applied coupon state if coupon was applied
        if (orderData.couponApplied) {
          setAppliedCoupon({
            discountPercent: orderData.discountPercent,
            discountAmount: orderData.discountAmount,
          });
        }
      }

      // Track checkout events for each product — once per order, not once per
      // abandoned attempt.
      if (!isReusedOrder) {
        cartItems.forEach((item) => {
          apiClient
            .post('/analytics/checkout', {
              productId: item.productId,
              orderId: orderData.orderId,
            })
            .catch(() => {});
        });
      }

      // Every payment method left is manual — cod (pay on delivery) or
      // whatsapp (arranged over chat) — so there is no gateway to hand off
      // to. Both verify/finalize immediately and reserve the item the same
      // way; they only differ in what the buyer sees afterward. Branches on
      // what create-order actually stored the order as, not the radio's
      // current value — the two can only ever differ if pendingOrder is
      // being reused, and the order's real method is the one that matters.
      const isWhatsAppOrder = orderData.paymentMethod === 'whatsapp';
      try {
        const verifyData = await verifyPaymentMutation.mutateAsync({ orderId: orderData.orderId });
        if (isWhatsAppOrder) {
          setPendingOrder(null);
          setWhatsappHandoff({
            displayId: verifyData.order?.displayId || orderData.displayId || orderData.orderId,
            total: orderData.amount,
          });
        } else {
          finalizeSuccess(verifyData);
        }
      } catch (err) {
        // The order EXISTS at this point. "Failed to create order" was a lie
        // that sent people off to place a second one.
        handleVerifyFailure(
          err,
          orderData,
          isWhatsAppOrder ? 'unconfirmed_whatsapp' : 'unconfirmed_cod',
        );
      }
    } catch (err) {
      // Reached only if create-order itself failed, so no order and no charge.
      showToast(err?.response?.data?.error || err.message || 'Failed to create order', 'error');
    }
  };

  // Redirect if not logged in
  if (!currentUser) {
    return (
      <div className="container mx-auto py-20 px-6 text-center">
        <SEO
          title="Checkout"
          description="Securely complete your purchase of authentic collectibles on The Collectors Exchange."
          canonical="/checkout"
          noindex
        />
        <SignInPrompt
          title="Please Sign In"
          description="Sign in to securely complete your purchase."
        />
      </div>
    );
  }

  if (cartLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <SEO
          title="Checkout"
          description="Securely complete your purchase of authentic collectibles on The Collectors Exchange."
          canonical="/checkout"
          noindex
        />
        <Loader2 className="animate-spin text-luxury-gold mb-4" size={48} />
        <p className="text-gray-500 font-serif text-xl italic">Preparing Checkout...</p>
      </div>
    );
  }

  // A checkout that failed after money was (or may have been) taken. Deliberately
  // a full screen: it has to survive a page's worth of reading, be screenshot-able,
  // and always carry the order reference support will ask for.
  if (paymentIssue) {
    const isSoldOut = paymentIssue.kind === 'sold_out';
    const isCODIssue = paymentIssue.kind === 'unconfirmed_cod';
    const isWhatsAppIssue = paymentIssue.kind === 'unconfirmed_whatsapp';

    const eyebrow = isSoldOut ? 'Order Cancelled' : 'Order Saved';

    const heading = isSoldOut ? 'Someone Was Faster' : 'We Could Not Confirm Your Order';

    return (
      <div className="container mx-auto py-8 sm:py-12 px-4 sm:px-6 max-w-3xl">
        <SEO
          title="Order Could Not Be Completed"
          description="There was a problem completing your order on The Collectors Exchange."
          canonical="/checkout"
          noindex
        />

        <Reveal as="header" direction="up" className="text-center mb-8 sm:mb-10">
          <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-5">
            <AlertCircle size={20} className="text-amber-600" aria-hidden="true" />
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-heritage-bronze mb-3">
            {eyebrow}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-heritage-charcoal mb-4">
            {heading}
          </h1>
          <div className="w-16 h-px bg-luxury-gold mx-auto mb-5" aria-hidden="true" />
          <p className="text-sm sm:text-base text-gray-600 font-serif leading-relaxed max-w-xl mx-auto">
            {isSoldOut
              ? 'Every piece here is one of a kind, and this one was bought by another collector before your order could be confirmed. We could not complete your order.'
              : isWhatsAppIssue
                ? "Your order was created, but we could not finish confirming it. Nothing has been charged — no payment is due until we've arranged it with you on WhatsApp."
                : 'Your order was created, but we could not finish confirming it. Nothing has been charged — cash on delivery means nothing is due until it arrives.'}
          </p>
        </Reveal>

        {/* Order reference — the one thing support will ask for */}
        <Reveal
          as="section"
          direction="up"
          delay={60}
          aria-labelledby="issue-reference-heading"
          className="bg-heritage-cream border border-luxury-gold/20 p-5 sm:p-6 mb-6 text-center rounded-2xl"
        >
          <h2
            id="issue-reference-heading"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-heritage-bronze mb-2"
          >
            Your Order Reference
          </h2>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-heritage-charcoal tracking-wider break-all">
            {paymentIssue.reference}
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Quote this in any correspondence about this order
          </p>
        </Reveal>

        {/* The items that were lost */}
        {isSoldOut && paymentIssue.items.length > 0 && (
          <Reveal
            as="section"
            direction="up"
            delay={100}
            aria-labelledby="soldout-heading"
            className="bg-white border border-gray-100 shadow-heritage p-5 sm:p-8 mb-6 rounded-2xl"
          >
            <h2
              id="soldout-heading"
              className="flex items-center gap-2.5 text-lg sm:text-xl font-serif font-bold text-heritage-charcoal mb-4"
            >
              <Package size={18} className="text-luxury-gold shrink-0" aria-hidden="true" />
              {paymentIssue.items.length === 1 ? 'The piece you missed' : 'The pieces you missed'}
            </h2>
            <ul className="space-y-2 text-sm text-gray-700">
              {paymentIssue.items.map((name) => (
                <li key={name} className="font-serif">
                  {name}
                </li>
              ))}
            </ul>
          </Reveal>
        )}

        {/* Money */}
        <Reveal
          as="section"
          direction="up"
          delay={140}
          aria-labelledby="money-heading"
          className="bg-white border border-gray-100 shadow-heritage p-5 sm:p-8 mb-6 rounded-2xl"
        >
          <h2
            id="money-heading"
            className="flex items-center gap-2.5 text-lg sm:text-xl font-serif font-bold text-heritage-charcoal mb-4"
          >
            <RefreshCw size={18} className="text-luxury-gold shrink-0" aria-hidden="true" />
            {isSoldOut ? 'About your money' : 'What happens next'}
          </h2>

          {isSoldOut && (
            <p className="text-sm text-gray-700 leading-relaxed">
              No payment was ever collected upfront for this order, so no money changed hands and
              there is nothing to refund. The order has been cancelled.
            </p>
          )}

          {isCODIssue && (
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-heritage-charcoal">
                Please do not place the order again.
              </p>
              <p>
                Order {paymentIssue.reference} is saved. Check My Orders in a few minutes — if it is
                there, it is being prepared and you pay the courier on delivery.
              </p>
              <p>
                If it has not appeared within an hour, email{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-luxury-gold hover:underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                quoting {paymentIssue.reference}.
              </p>
            </div>
          )}

          {isWhatsAppIssue && (
            <div className="space-y-3 text-sm text-gray-700 leading-relaxed">
              <p className="font-semibold text-heritage-charcoal">
                Please do not place the order again.
              </p>
              <p>
                Order {paymentIssue.reference} is saved. Check My Orders in a few minutes — if it is
                there, message us on WhatsApp quoting that reference and we will arrange payment.
              </p>
              <p>
                If it has not appeared within an hour, email{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-luxury-gold hover:underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                quoting {paymentIssue.reference}.
              </p>
            </div>
          )}

          {paymentIssue.detail && (
            <p className="text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
              Technical detail for support: {paymentIssue.detail}
            </p>
          )}
        </Reveal>

        <Reveal as="div" direction="up" delay={180} className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/account?tab=orders"
            className="flex-1 bg-black text-white px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-luxury-gold transition-colors rounded-full"
          >
            View My Orders
          </Link>
          <Link
            to="/category"
            className="flex-1 border border-heritage-charcoal text-heritage-charcoal px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-heritage-charcoal hover:text-white transition-colors rounded-full"
          >
            Continue Browsing
          </Link>
        </Reveal>

        <p className="text-center text-xs text-gray-500 mt-8">
          Need a hand?{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-luxury-gold hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    );
  }

  if (cartItems.length === 0 && !orderSuccess && !whatsappHandoff) {
    return (
      <div className="container mx-auto py-20 px-6 text-center">
        <SEO
          title="Checkout"
          description="Securely complete your purchase of authentic collectibles on The Collectors Exchange."
          canonical="/checkout"
          noindex
        />
        <h1 className="text-2xl sm:text-4xl font-serif mb-4">Your cart is empty</h1>
        <Link
          to="/category"
          className="bg-black text-white px-6 py-3 uppercase tracking-widest text-sm hover:bg-luxury-gold transition-colors rounded-full"
        >
          Explore The Exchange
        </Link>
      </div>
    );
  }

  // Shown instead of the order-confirmed screen for a WhatsApp checkout: the
  // order is reserved (same as COD), but there is no payment gateway, so the
  // buyer's next and only step is to message us to arrange payment.
  if (whatsappHandoff) {
    return (
      <div className="container mx-auto py-8 sm:py-12 px-4 sm:px-6 max-w-3xl">
        <SEO
          title="Complete Your Order on WhatsApp"
          description="Finish your purchase on The Collectors Exchange by arranging payment over WhatsApp."
          canonical="/checkout"
          noindex
        />

        <Reveal as="header" direction="up" className="text-center mb-8 sm:mb-10">
          <div className="w-12 h-12 rounded-full bg-[#25D366]/10 border border-[#25D366]/30 flex items-center justify-center mx-auto mb-5">
            <MessageCircle size={20} className="text-[#128C4A]" aria-hidden="true" />
          </div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-heritage-bronze mb-3">
            Order Reserved
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-heritage-charcoal mb-4">
            One Last Step, on WhatsApp
          </h1>
          <div className="w-16 h-px bg-luxury-gold mx-auto mb-5" aria-hidden="true" />
          <p className="text-sm sm:text-base text-gray-600 font-serif leading-relaxed max-w-xl mx-auto">
            Our online payment gateway is temporarily unavailable. Your order is saved and the item
            is reserved for you — message us on WhatsApp to arrange payment and we will confirm and
            dispatch it.
          </p>
        </Reveal>

        <Reveal
          as="section"
          direction="up"
          delay={60}
          aria-labelledby="whatsapp-reference-heading"
          className="bg-heritage-cream border border-luxury-gold/20 p-5 sm:p-6 mb-6 text-center rounded-2xl"
        >
          <h2
            id="whatsapp-reference-heading"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-heritage-bronze mb-2"
          >
            Your Order Reference
          </h2>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-heritage-charcoal tracking-wider break-all">
            {whatsappHandoff.displayId}
          </p>
          <p className="text-sm text-gray-600 mt-3">
            Amount due:{' '}
            <span className="font-semibold text-heritage-charcoal">
              {rupees(whatsappHandoff.total)}
            </span>
          </p>
        </Reveal>

        <Reveal as="div" direction="up" delay={120} className="mb-6">
          <Magnetic className="block w-full">
            <a
              href={whatsAppHref(
                `Hi, I've placed order ${whatsappHandoff.displayId} for ${rupees(whatsappHandoff.total)} on The Collectors Exchange. I'm here to arrange payment.`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] text-white py-5 text-sm uppercase tracking-widest hover:bg-[#128C4A] transition-colors duration-300 flex items-center justify-center gap-3 rounded-full"
            >
              <MessageCircle size={18} />
              Continue on WhatsApp
            </a>
          </Magnetic>
        </Reveal>

        <Reveal as="div" direction="up" delay={160} className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/account?tab=orders"
            className="flex-1 bg-black text-white px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-luxury-gold transition-colors rounded-full"
          >
            View My Orders
          </Link>
          <Link
            to="/category"
            className="flex-1 border border-heritage-charcoal text-heritage-charcoal px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-heritage-charcoal hover:text-white transition-colors rounded-full"
          >
            Continue Browsing
          </Link>
        </Reveal>

        <p className="text-center text-xs text-gray-500 mt-8">
          Prefer email?{' '}
          <a href={MAILTO_HREF} className="text-luxury-gold hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    );
  }

  // Order success screen. Also covers a duplicate verify (the backend echoes the
  // already-finalized order back with the same shape) — still a success for the buyer.
  if (orderSuccess) {
    const isCODOrder = orderSuccess.paymentMethod === 'cod';
    // verify-payment returns order items without their product relation, so join
    // each priced line back onto the snapshot taken at purchase time.
    const confirmedItems = (orderSuccess.items || []).map((item) => ({
      ...item,
      product: purchasedItems.find((p) => p.productId === item.productId)?.product,
    }));
    const orderedOn = orderSuccess.createdAt
      ? new Date(orderSuccess.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null;
    const orderDiscount = orderSuccess.discountAmount || 0;
    const orderSubtotal =
      orderSuccess.subtotalBeforeDiscount || (orderSuccess.totalAmount || 0) + orderDiscount;

    return (
      <div className="container mx-auto py-8 sm:py-12 px-4 sm:px-6 max-w-3xl">
        <SEO
          title="Order Confirmed"
          description="Your order on The Collectors Exchange has been confirmed."
          canonical="/checkout"
          noindex
        />
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-0 mb-10 sm:mb-14">
          {['Cart', 'Checkout', 'Confirmation'].map((label, i) => (
            <React.Fragment key={label}>
              {i > 0 && <div className="w-12 sm:w-20 h-px bg-luxury-gold" />}
              <div className="flex flex-col items-center gap-1.5 text-luxury-gold">
                <div className="w-8 h-8 rounded-full flex items-center justify-center border-2 bg-luxury-gold border-luxury-gold text-white">
                  <Check size={14} strokeWidth={3} aria-hidden="true" />
                </div>
                <span className="text-[10px] uppercase tracking-widest font-medium">{label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
        {/* Masthead */}
        <Reveal as="header" direction="up" className="text-center mb-8 sm:mb-10">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-luxury-gold mb-3">
            {isCODOrder ? 'Order Placed' : 'Payment Received'}
          </p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-serif text-heritage-charcoal mb-4">
            Order Confirmed
          </h1>
          <div className="w-16 h-px bg-luxury-gold mx-auto mb-5" aria-hidden="true" />
          <p className="text-sm sm:text-base text-gray-600 font-serif leading-relaxed max-w-lg mx-auto">
            {isCODOrder
              ? 'Your order is placed and now being prepared. Payment will be collected in cash when it arrives.'
              : 'Your payment has been verified and your acquisition is now being prepared for dispatch.'}
          </p>
        </Reveal>

        {/* Order reference */}
        <Reveal
          as="section"
          direction="up"
          delay={60}
          aria-labelledby="order-reference-heading"
          className="bg-heritage-cream border border-luxury-gold/20 p-5 sm:p-6 mb-6 sm:mb-8 text-center rounded-2xl"
        >
          <h2
            id="order-reference-heading"
            className="text-[10px] font-bold uppercase tracking-[0.2em] text-heritage-bronze mb-2"
          >
            Your Order Reference
          </h2>
          <p className="font-mono text-xl sm:text-2xl font-semibold text-heritage-charcoal tracking-wider break-all">
            {orderSuccess.displayId || orderSuccess.id}
          </p>
          {orderedOn && (
            <p className="text-xs text-gray-500 mt-2">
              Placed on {orderedOn} &middot; Quote this reference in any correspondence
            </p>
          )}
        </Reveal>

        {/* What was acquired */}
        {confirmedItems.length > 0 && (
          <Reveal
            as="section"
            direction="up"
            delay={100}
            aria-labelledby="acquisition-heading"
            className="bg-white border border-gray-100 shadow-heritage p-5 sm:p-8 mb-6 sm:mb-8 rounded-2xl"
          >
            <h2
              id="acquisition-heading"
              className="flex items-center gap-2.5 text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-5 sm:mb-6"
            >
              <Package size={18} className="text-luxury-gold shrink-0" aria-hidden="true" />
              Your Acquisition
            </h2>

            <ul className="divide-y divide-gray-100">
              {confirmedItems.map((item) => (
                <li key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <img
                    src={imageUrl(
                      item.product?.image ||
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='80'%3E%3Crect width='80' height='80' fill='%23f5f0e8'/%3E%3C/svg%3E",
                      200,
                    )}
                    alt={item.product?.title ? `${item.product.title}` : 'Item from your order'}
                    width="80"
                    height="80"
                    loading="lazy"
                    className="w-16 h-16 sm:w-20 sm:h-20 object-cover border border-gray-100 shrink-0 rounded-lg"
                  />
                  <div className="flex-grow min-w-0">
                    {item.product?.brand && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-heritage-bronze mb-1">
                        {item.product.brand}
                      </p>
                    )}
                    <p className="font-serif text-sm sm:text-base font-medium text-heritage-charcoal leading-snug">
                      {item.product?.title || 'Item from your order'}
                    </p>
                    {item.product?.condition && (
                      <p className="text-xs text-gray-500 mt-1">{item.product.condition}</p>
                    )}
                    <p className="text-sm font-semibold text-heritage-charcoal mt-2 sm:hidden">
                      ₹{item.price?.toLocaleString('en-IN')}
                    </p>
                  </div>
                  <p className="hidden sm:block text-sm font-semibold text-heritage-charcoal whitespace-nowrap">
                    ₹{item.price?.toLocaleString('en-IN')}
                  </p>
                </li>
              ))}
            </ul>

            {/* Payment breakdown */}
            <dl className="border-t border-gray-100 mt-5 pt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-4 text-gray-600">
                <dt>Subtotal</dt>
                <dd>₹{orderSubtotal.toLocaleString('en-IN')}</dd>
              </div>
              {orderDiscount > 0 && (
                <div className="flex justify-between gap-4 text-green-700">
                  <dt className="flex items-center gap-1.5">
                    <Percent size={13} aria-hidden="true" />
                    Discount
                    {orderSuccess.discountPercent ? ` (${orderSuccess.discountPercent}% off)` : ''}
                  </dt>
                  <dd>-₹{orderDiscount.toLocaleString('en-IN')}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4 text-gray-600">
                <dt>Shipping</dt>
                <dd className="text-green-700">Free</dd>
              </div>
              <div className="flex justify-between gap-4 text-gray-600">
                <dt>Payment Method</dt>
                <dd className="font-medium text-heritage-charcoal text-right">
                  {isCODOrder ? 'Cash on Delivery' : 'WhatsApp Checkout'}
                </dd>
              </div>
              <div className="flex justify-between gap-4 items-baseline border-t border-gray-100 pt-4 font-serif font-bold text-base sm:text-lg text-heritage-charcoal">
                <dt>{isCODOrder ? 'Due on Delivery' : 'Amount Paid'}</dt>
                <dd>₹{orderSuccess.totalAmount?.toLocaleString('en-IN')}</dd>
              </div>
            </dl>
            <p className="text-[10px] text-gray-500 text-right mt-1">* Inclusive of all taxes</p>
          </Reveal>
        )}

        {/* Delivery details */}
        <Reveal
          as="section"
          direction="up"
          delay={140}
          aria-labelledby="delivery-heading"
          className="bg-white border border-gray-100 shadow-heritage p-5 sm:p-8 mb-6 sm:mb-8 rounded-2xl"
        >
          <h2
            id="delivery-heading"
            className="flex items-center gap-2.5 text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-5"
          >
            <MapPin size={18} className="text-luxury-gold shrink-0" aria-hidden="true" />
            Delivering To
          </h2>
          <address className="not-italic text-sm text-gray-700 leading-relaxed">
            {/* Read back off the ORDER, not local state. This line used to be
                the only place the recipient name existed — it was never
                persisted, so the label ops printed carried a different name. */}
            {(orderSuccess.buyerName || form.recipientName) && (
              <span className="block font-medium text-heritage-charcoal">
                {orderSuccess.buyerName || form.recipientName}
              </span>
            )}
            <span className="block">{orderSuccess.shippingAddress}</span>
            <span className="block">
              {orderSuccess.city}, {orderSuccess.state} {orderSuccess.zipCode}
            </span>
            {orderSuccess.phone && (
              <span className="block mt-2 text-gray-500">
                <span className="text-[10px] font-bold uppercase tracking-widest">Phone</span>{' '}
                {orderSuccess.phone}
              </span>
            )}
          </address>
        </Reveal>

        {/* What happens next — timelines mirror the stated Returns & Shipping policy */}
        <Reveal
          as="section"
          direction="up"
          delay={180}
          aria-labelledby="next-heading"
          className="bg-white border border-gray-100 shadow-heritage p-5 sm:p-8 mb-6 sm:mb-8 rounded-2xl"
        >
          <h2
            id="next-heading"
            className="flex items-center gap-2.5 text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-6"
          >
            <Truck size={18} className="text-luxury-gold shrink-0" aria-hidden="true" />
            What Happens Next
          </h2>
          <ol className="space-y-6">
            {[
              {
                title: 'Processing & Packaging',
                body: isCODOrder
                  ? `Orders are processed within ${DISPATCH_DAYS} business days. High-value or fragile items may require additional packaging time.`
                  : `Orders are processed within ${DISPATCH_DAYS} business days after payment confirmation. High-value or fragile items may require additional packaging time.`,
              },
              {
                title: 'Dispatch & Tracking',
                body: 'A tracking ID is provided once the order is shipped. You can monitor your delivery status from your account dashboard under "My Orders".',
              },
              {
                title: 'Delivery & Inspection',
                body: isCODOrder
                  ? `Domestic deliveries typically arrive within ${DELIVERY_DAYS} business days, so keep cash ready for the courier. You then have a 48-hour inspection period from delivery.`
                  : `Domestic deliveries typically arrive within ${DELIVERY_DAYS} business days. You then have a 48-hour inspection period from delivery.`,
              },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="shrink-0 w-7 h-7 rounded-full border border-luxury-gold/40 bg-luxury-gold/5 text-luxury-gold flex items-center justify-center text-xs font-bold"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="font-serif text-sm sm:text-base font-medium text-heritage-charcoal mb-1">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div
            className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mt-6"
            aria-hidden="true"
          />
          <p className="flex items-start gap-2.5 pt-5 text-xs text-gray-500 leading-relaxed">
            <ShieldCheck
              size={14}
              className="text-luxury-gold shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <span>
              All shipments are insured against loss or damage during transit. Read the full{' '}
              <Link to="/returns" className="text-luxury-gold hover:underline">
                returns, refunds &amp; shipping policy
              </Link>
              .
            </span>
          </p>
        </Reveal>

        {/* Onward routes */}
        <Reveal as="div" direction="up" delay={220} className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/account?tab=orders"
            className="flex-1 bg-black text-white px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-luxury-gold transition-colors rounded-full"
          >
            View My Orders
          </Link>
          <Link
            to="/category"
            className="flex-1 border border-heritage-charcoal text-heritage-charcoal px-6 py-4 text-sm uppercase tracking-widest text-center hover:bg-heritage-charcoal hover:text-white transition-colors rounded-full"
          >
            Continue Browsing
          </Link>
        </Reveal>

        <p className="text-center text-xs text-gray-500 mt-8">
          Questions about this order?{' '}
          <a href={MAILTO_HREF} className="text-luxury-gold hover:underline">
            {SUPPORT_EMAIL}
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 sm:py-12 px-4 sm:px-6">
      <SEO
        title="Checkout"
        description="Securely complete your purchase of authentic vintage watches and collectibles on The Collectors Exchange."
        canonical="/checkout"
        noindex
      />
      {/* Step Indicator */}
      <div className="flex items-center justify-center gap-0 mb-8 sm:mb-12">
        {[
          { label: 'Cart', href: '/cart', step: 1 },
          { label: 'Checkout', step: 2 },
          { label: 'Confirmation', step: 3 },
        ].map((item, i) => (
          <React.Fragment key={item.label}>
            {i > 0 && (
              <div
                className={`w-12 sm:w-20 h-px ${i <= 2 ? 'bg-luxury-gold/50' : 'bg-gray-200'}`}
              />
            )}
            {item.href ? (
              <Link
                to={item.href}
                className={`flex flex-col items-center gap-1.5 ${i <= 2 ? 'text-luxury-gold' : 'text-gray-300'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-300 ${
                    i <= 2
                      ? 'border-luxury-gold bg-luxury-gold/10 text-luxury-gold'
                      : 'border-gray-200 text-gray-300'
                  }`}
                >
                  {item.step}
                </div>
                <span className="text-[10px] uppercase tracking-widest font-medium">
                  {item.label}
                </span>
              </Link>
            ) : (
              <div
                className={`flex flex-col items-center gap-1.5 ${i <= 2 ? 'text-luxury-gold' : 'text-gray-300'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-300 ${
                    i <= 2
                      ? 'border-luxury-gold bg-luxury-gold/10 text-luxury-gold'
                      : 'border-gray-200 text-gray-300'
                  }`}
                >
                  {item.step}
                </div>
                <span className="text-[10px] uppercase tracking-widest font-medium">
                  {item.label}
                </span>
              </div>
            )}
          </React.Fragment>
        ))}
      </div>

      <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif mb-6 text-heritage-charcoal">
        Secure Checkout
      </h1>

      {/* A closed modal or a declined attempt: no money moved and the order is
          already saved, so the buyer stays on the form and can simply retry. */}
      {paymentNotice && (
        <div
          role="status"
          className={`flex items-start gap-3 p-4 mb-8 rounded-2xl border ${
            paymentNotice.tone === 'error'
              ? 'bg-red-50 border-red-200'
              : 'bg-heritage-cream border-luxury-gold/30'
          }`}
        >
          {paymentNotice.tone === 'error' ? (
            <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <Info size={18} className="text-luxury-gold shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-grow">
            <p className="text-sm font-semibold text-heritage-charcoal">{paymentNotice.title}</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
              {paymentNotice.body}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaymentNotice(null)}
            aria-label="Dismiss message"
            className="text-gray-500 hover:text-gray-700 transition-colors shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* `noValidate` because `pattern` on the PIN field would otherwise hand
          validation to the browser: submission is blocked silently-ish behind a
          native bubble reading "Please match the requested format", positioned
          by the browser and gone on the next tap. Our own messages say what is
          wrong in plain words, sit under the field, survive scrolling and are
          wired to the input with aria-describedby. `pattern` stays because it
          is also a keyboard hint on older mobile Safari — but this form's
          validation is `validate()`, and only `validate()`. */}
      <form onSubmit={handlePlaceOrder} noValidate>
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Shipping Form */}
          <div className="w-full lg:w-3/5 space-y-6">
            <Reveal as="div" direction="left">
              <div className="bg-white border border-gray-100 shadow-sm p-5 sm:p-8 rounded-2xl">
                <h2 className="text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-6">
                  Shipping Details
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="recipientName" className={labelClass}>
                      Recipient Name
                    </label>
                    <input
                      id="recipientName"
                      type="text"
                      name="recipientName"
                      autoComplete="name"
                      value={form.recipientName}
                      onChange={(e) => setField('recipientName', e.target.value)}
                      placeholder="Full name"
                      aria-invalid={errors.recipientName ? 'true' : undefined}
                      aria-describedby={errors.recipientName ? 'recipientName-error' : undefined}
                      className={fieldClass(errors.recipientName)}
                    />
                    {errors.recipientName && (
                      <p id="recipientName-error" className={errorClass}>
                        {errors.recipientName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="shippingAddress" className={labelClass}>
                      Street Address
                    </label>
                    <input
                      id="shippingAddress"
                      type="text"
                      name="shippingAddress"
                      autoComplete="street-address"
                      value={form.shippingAddress}
                      onChange={(e) => setField('shippingAddress', e.target.value)}
                      placeholder="House / Flat No., Street, Area"
                      aria-invalid={errors.shippingAddress ? 'true' : undefined}
                      aria-describedby={
                        errors.shippingAddress ? 'shippingAddress-error' : undefined
                      }
                      className={fieldClass(errors.shippingAddress)}
                    />
                    {errors.shippingAddress && (
                      <p id="shippingAddress-error" className={errorClass}>
                        {errors.shippingAddress}
                      </p>
                    )}
                  </div>

                  {/* Country is deliberately absent: the Order table has no
                      country column, so the field only ever looked like it was
                      being collected. Everything ships within India.

                      PIN comes BEFORE city and state now, because it is the one
                      that fills the other two in. */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="zipCode" className={labelClass}>
                        PIN Code
                      </label>
                      <input
                        id="zipCode"
                        type="text"
                        name="zipCode"
                        autoComplete="postal-code"
                        // The three that get an Indian phone keyboard right:
                        // numeric pad instead of QWERTY, digits-only, and a hard
                        // stop at six so an over-typed PIN cannot be submitted.
                        inputMode="numeric"
                        pattern="[0-9]{6}"
                        maxLength={6}
                        value={form.zipCode}
                        onChange={(e) => setField('zipCode', e.target.value.replace(/\D/g, ''))}
                        placeholder="400001"
                        aria-invalid={errors.zipCode ? 'true' : undefined}
                        aria-describedby={
                          errors.zipCode
                            ? 'zipCode-error'
                            : pinLookingUp
                              ? 'zipCode-hint'
                              : undefined
                        }
                        className={fieldClass(errors.zipCode)}
                      />
                      {errors.zipCode ? (
                        <p id="zipCode-error" className={errorClass}>
                          {errors.zipCode}
                        </p>
                      ) : (
                        pinLookingUp && (
                          <p id="zipCode-hint" className="text-gray-500 text-xs mt-1">
                            Looking up city and state…
                          </p>
                        )
                      )}
                    </div>
                    <div>
                      <label htmlFor="phone" className={labelClass}>
                        Phone
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        name="phone"
                        autoComplete="tel"
                        inputMode="tel"
                        maxLength={10}
                        value={form.phone}
                        onChange={(e) => setField('phone', normalizePhone(e.target.value))}
                        placeholder="9876543210"
                        aria-invalid={errors.phone ? 'true' : undefined}
                        aria-describedby={errors.phone ? 'phone-error' : undefined}
                        className={fieldClass(errors.phone)}
                      />
                      {errors.phone && (
                        <p id="phone-error" className={errorClass}>
                          {errors.phone}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="city" className={labelClass}>
                        City
                      </label>
                      <input
                        id="city"
                        type="text"
                        name="city"
                        autoComplete="address-level2"
                        value={form.city}
                        onChange={(e) => setField('city', e.target.value)}
                        placeholder="Mumbai"
                        aria-invalid={errors.city ? 'true' : undefined}
                        aria-describedby={errors.city ? 'city-error' : undefined}
                        className={fieldClass(errors.city)}
                      />
                      {errors.city && (
                        <p id="city-error" className={errorClass}>
                          {errors.city}
                        </p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="state" className={labelClass}>
                        State
                      </label>
                      {/* A closed list, not free text. "MH", "maharastra" and
                          "Mahrashtra" used to reach the courier label unedited. */}
                      <select
                        id="state"
                        name="state"
                        autoComplete="address-level1"
                        value={form.state}
                        onChange={(e) => setField('state', e.target.value)}
                        aria-invalid={errors.state ? 'true' : undefined}
                        aria-describedby={errors.state ? 'state-error' : undefined}
                        className={`${fieldClass(errors.state)} appearance-none ${
                          form.state ? '' : 'text-gray-500'
                        }`}
                      >
                        <option value="">Select a state</option>
                        <optgroup label="States">
                          {INDIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Union Territories">
                          {INDIAN_UNION_TERRITORIES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </optgroup>
                      </select>
                      {errors.state && (
                        <p id="state-error" className={errorClass}>
                          {errors.state}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>

            {/* Payment Method */}
            <Reveal as="div" direction="left" delay={120}>
              <div className="bg-white border border-gray-100 shadow-sm p-5 sm:p-8 rounded-2xl">
                <h2 className="text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-6">
                  Payment Method
                </h2>
                <div className="space-y-3">
                  <label
                    htmlFor="paymentMethod-whatsapp"
                    className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors rounded-xl ${paymentMethod === 'whatsapp' ? 'border-luxury-gold bg-luxury-gold/5' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      id="paymentMethod-whatsapp"
                      type="radio"
                      name="paymentMethod"
                      value="whatsapp"
                      checked={paymentMethod === 'whatsapp'}
                      onChange={() => setPaymentMethod('whatsapp')}
                      className="w-4 h-4 text-luxury-gold focus:ring-luxury-gold"
                    />
                    <div>
                      <p className="font-medium text-heritage-charcoal">WhatsApp Checkout</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        We&apos;ll confirm your order and collect payment over WhatsApp
                      </p>
                    </div>
                  </label>
                  <label
                    htmlFor="paymentMethod-cod"
                    className={`flex items-center gap-4 p-4 border cursor-pointer transition-colors rounded-xl ${paymentMethod === 'cod' ? 'border-luxury-gold bg-luxury-gold/5' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <input
                      id="paymentMethod-cod"
                      type="radio"
                      name="paymentMethod"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="w-4 h-4 text-luxury-gold focus:ring-luxury-gold"
                    />
                    <div>
                      <p className="font-medium text-heritage-charcoal">Cash on Delivery</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Pay when your order arrives at your doorstep
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            </Reveal>

            {/* Trust Badges */}
            <Reveal
              as="div"
              direction="up"
              delay={220}
              className="grid grid-cols-1 sm:grid-cols-3 gap-4"
            >
              {[
                { icon: ShieldCheck, label: 'Secure Ordering', sub: 'WhatsApp & COD available' },
                { icon: ShieldCheck, label: 'Authenticity', sub: 'Expert verified' },
                { icon: ShieldCheck, label: 'Insured Shipping', sub: 'Full coverage' },
              ].map(({ icon: Icon, label, sub }) => (
                <div
                  key={label}
                  className="bg-white border border-gray-100 p-4 text-center rounded-2xl"
                >
                  <Icon size={20} className="mx-auto text-luxury-gold mb-2" />
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-700">
                    {label}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{sub}</p>
                </div>
              ))}
            </Reveal>
          </div>

          {/* Order Summary */}
          <Reveal as="div" direction="right" className="w-full lg:w-2/5">
            <div className="bg-white border border-gray-100 shadow-sm p-5 sm:p-8 lg:sticky lg:top-24 rounded-2xl">
              <h2 className="text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal mb-6">
                Order Summary
              </h2>

              {/* Items */}
              <div className="space-y-4 mb-6 max-h-64 overflow-y-auto">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex gap-4 items-center">
                    <img
                      src={imageUrl(
                        item.product?.image ||
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='56'%3E%3Crect width='56' height='56' fill='%23f5f0e8'/%3E%3C/svg%3E",
                        200,
                      )}
                      alt={item.product?.title}
                      width="56"
                      height="56"
                      loading="lazy"
                      className="w-14 h-14 object-cover border border-gray-100 shrink-0 rounded-lg"
                    />
                    <div className="flex-grow min-w-0">
                      <p className="text-sm font-serif font-medium truncate">
                        {item.product?.title}
                      </p>
                      <p className="text-xs text-gray-500">{item.product?.condition}</p>
                    </div>
                    <p className="text-sm font-semibold whitespace-nowrap">
                      ₹{item.product?.price?.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>

              {/* Coupon Code */}
              <div className="border-t border-gray-100 pt-4 mb-4">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 p-3 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Percent size={14} className="text-green-600" />
                      <div>
                        <p className="text-xs font-semibold text-green-700">{couponCode}</p>
                        <p className="text-[10px] text-green-600">
                          {appliedCoupon.discountPercent}% off applied
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedCoupon(null);
                        setCouponCode('');
                        setCouponInput('');
                      }}
                      className="text-green-600 hover:text-green-800 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label htmlFor="coupon-code" className="sr-only">
                      Coupon code
                    </label>
                    <input
                      id="coupon-code"
                      type="text"
                      name="coupon-code"
                      autoComplete="off"
                      autoCapitalize="characters"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && couponInput.trim())
                          document.getElementById('apply-coupon-btn').click();
                      }}
                      placeholder="Enter coupon code"
                      className="flex-grow p-3 bg-gray-50 border border-gray-200 text-xs uppercase tracking-widest focus:outline-none focus:border-luxury-gold transition-colors"
                    />
                    <button
                      id="apply-coupon-btn"
                      type="button"
                      disabled={!couponInput.trim() || validateCouponMutation.isPending}
                      onClick={async () => {
                        try {
                          const items = cartItems
                            .map((item) => ({
                              productId: item.productId,
                              price: item.product?.price,
                              quantity: 1,
                            }))
                            .filter((i) => i.price > 0);
                          if (items.length === 0) {
                            showToast('Cart is empty or invalid', 'error');
                            return;
                          }
                          const result = await validateCouponMutation.mutateAsync({
                            code: couponInput.trim(),
                            items,
                          });
                          if (result.valid) {
                            setCouponCode(couponInput.trim());
                            setAppliedCoupon({
                              discountPercent: result.discountPercent,
                              discountAmount: result.discountAmount,
                            });
                          }
                        } catch (err) {
                          showToast(err?.response?.data?.error || 'Invalid coupon code', 'error');
                        }
                      }}
                      className="bg-black text-white px-4 text-[10px] uppercase tracking-widest hover:bg-luxury-gold transition-colors disabled:opacity-50 whitespace-nowrap"
                    >
                      {validateCouponMutation.isPending ? '...' : 'Apply'}
                    </button>
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 pt-4 space-y-3 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount ({appliedCoupon?.discountPercent}% off)</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
              </div>

              <div className="flex justify-between pt-4 border-t border-gray-100 font-serif font-bold text-lg mt-4 mb-1">
                <span>Total</span>
                <span>₹{total.toLocaleString('en-IN')}</span>
              </div>
              <p className="text-[10px] text-gray-500 text-right mb-8">* Inclusive of all taxes</p>

              <Magnetic className="block w-full">
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending || verifyPaymentMutation.isPending}
                  className="w-full bg-black text-white py-5 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors duration-300 flex items-center justify-center gap-3 disabled:opacity-60 rounded-full"
                >
                  {createOrderMutation.isPending || verifyPaymentMutation.isPending ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Processing...
                    </>
                  ) : paymentMethod === 'cod' ? (
                    <>
                      <ShieldCheck size={18} />
                      Place Order (Cash on Delivery)
                    </>
                  ) : (
                    <>
                      <MessageCircle size={18} />
                      Place Order & Pay via WhatsApp
                    </>
                  )}
                </button>
              </Magnetic>
            </div>
          </Reveal>
        </div>
      </form>
    </div>
  );
};

export default Checkout;

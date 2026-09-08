import React, { useState } from 'react';
import SEO from '../components/SEO';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  ShoppingBag,
  DollarSign,
  TrendingUp,
  CreditCard,
  Package,
  Loader2,
  Calendar,
  AlertCircle,
  RefreshCw,
  Truck,
  MapPin,
  Landmark,
  ChevronDown,
  CheckCircle,
} from 'lucide-react';
import {
  useVendorProfile,
  useVendorAnalyticsOverview,
  useVendorAnalyticsInterest,
  useVendorSalesGraph,
  useVendorTopProducts,
  useVendorPayouts,
  useVendorPayoutItems,
  useVendorOrders,
  useShipOrderItem,
  useUpdatePayoutDetails,
} from '../hooks/api/useVendor';
import { Reveal, Stagger, Tilt, CountUp } from '../components/Motion';
import { imageUrl } from '../utils/image';

const PERIODS = [
  { value: '7d', label: '7 Days' },
  { value: '10d', label: '10 Days' },
  { value: '15d', label: '15 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: '6m', label: '6 Months' },
  { value: '1y', label: '1 Year' },
  { value: 'all', label: 'All Time' },
];

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/** Rupees, grouped the Indian way — this is an India-facing marketplace. */
const inr = (n) => `₹${Number(n ?? 0).toLocaleString('en-IN')}`;

/**
 * Can this line still be marked shipped?
 *
 * Mirrors the guard in backend/routes/vendor.js `PATCH /orders/:id/ship`: an
 * unpaid (Pending) order has nothing to ship yet, and a Cancelled or Delivered
 * one is terminal. Getting this right here is what stops the button from
 * offering an action the server is going to refuse.
 */
const canShip = (item) =>
  item?.status === 'Pending' &&
  !['Pending', 'Cancelled', 'Delivered'].includes(item?.order?.status);

/** Why a line cannot be shipped, in the seller's words. */
function shipBlockedReason(item) {
  if (item?.status === 'Shipped') return null;
  if (item?.status === 'Delivered') return null;
  if (item?.order?.status === 'Pending') return 'Waiting on payment — you can ship once it clears';
  if (item?.order?.status === 'Cancelled') return 'This order was cancelled';
  if (item?.order?.status === 'Delivered') return 'This order is already delivered';
  return null;
}

function StatusPill({ status }) {
  const tone =
    status === 'Delivered'
      ? 'bg-green-100 text-green-700'
      : status === 'Shipped'
        ? 'bg-blue-100 text-blue-700'
        : 'bg-amber-100 text-amber-700';
  return (
    <span
      className={`shrink-0 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full ${tone}`}
    >
      {status}
    </span>
  );
}

function StatCard({ title, value, icon: Icon, color, prefix, loading, error, onRetry, note }) {
  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
              {title}
            </p>
            <p className="text-xs sm:text-sm text-red-600">Failed to load</p>
          </div>
          {/* The icon IS the control here, so it needs contrast in its own right
              — red-400 on white is under 3:1. */}
          <button
            onClick={onRetry}
            aria-label={`Retry loading ${title}`}
            className="text-red-600 hover:text-red-800 p-2"
          >
            <RefreshCw size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
            {title}
          </p>
          {loading ? (
            <Skeleton className="h-6 sm:h-8 w-16 sm:w-24 mt-1" />
          ) : (
            <p className="text-lg sm:text-2xl lg:text-3xl font-bold text-heritage-charcoal">
              {typeof value === 'number' ? (
                <CountUp end={value} prefix={prefix || ''} />
              ) : (
                `${prefix || ''}${value ?? 0}`
              )}
            </p>
          )}
          {note && !loading && <p className="text-[10px] sm:text-xs text-gray-500 mt-1">{note}</p>}
        </div>
        <div
          className={`${color} p-2 sm:p-3 rounded-full ${loading ? 'animate-pulse opacity-50' : ''}`}
        >
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6 text-white" />
        </div>
      </div>
    </div>
  );
}

function FunnelBar({ label, value, maxValue, color, loading }) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  return (
    <div className="flex items-center gap-2 sm:gap-4">
      <span className="text-[11px] sm:text-sm text-gray-600 w-20 sm:w-32 font-medium truncate">
        {label}
      </span>
      <div className="flex-grow bg-gray-100 rounded-full h-4 sm:h-6 overflow-hidden">
        {loading ? (
          <Skeleton className="h-full w-full rounded-full" />
        ) : (
          <div
            className={`h-full rounded-full transition-all duration-500 ${color}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        )}
      </div>
      <span className="text-xs sm:text-sm font-bold text-heritage-charcoal w-16 sm:w-24 text-right">
        {loading ? <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 ml-auto" /> : value}
      </span>
    </div>
  );
}

function PeriodSelector({ value, onChange }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentLabel = PERIODS.find((p) => p.value === value)?.label || 'Select Period';

  return (
    <div>
      {/* Desktop */}
      <div className="hidden sm:flex items-center gap-2 flex-wrap">
        <Calendar size={16} className="text-gray-400" />
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`px-2 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
              value === p.value
                ? 'bg-heritage-charcoal text-white shadow-sm'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* Mobile */}
      <div className="sm:hidden relative">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full text-sm font-medium"
        >
          <Calendar size={16} />
          {currentLabel}
        </button>
        {mobileOpen && (
          <div className="absolute top-10 left-0 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-lg z-50 w-48">
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => {
                  onChange(p.value);
                  setMobileOpen(false);
                }}
                className={`block w-full text-left px-4 py-3 text-sm hover:bg-gray-50 ${value === p.value ? 'font-bold text-luxury-gold' : 'text-gray-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white shadow-lg border border-gray-100 p-4 rounded-2xl">
        <p className="text-sm font-bold text-heritage-charcoal mb-2">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-sm" style={{ color: entry.color }}>
            {entry.name}:{' '}
            {entry.name === 'Sales' ? `₹${entry.value.toLocaleString()}` : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PLACEHOLDER_THUMB =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e5e7eb'/%3E%3C/svg%3E";

/**
 * One sold item, with everything needed to actually post it.
 *
 * The mutation hook lives per-row on purpose: pending state and — more
 * importantly — the server's error message belong to the row the seller
 * clicked, not to the whole list.
 */
function OrderRow({ item }) {
  const [trackingID, setTrackingID] = useState('');
  const ship = useShipOrderItem();

  const order = item.order || {};
  const buyerName = order.user?.name || order.buyerName || 'Buyer';
  const payout = (item.price ?? 0) - (item.platformFee ?? 0);
  const blockedReason = shipBlockedReason(item);
  const shippable = canShip(item);

  // Surface exactly what the server said — "Cannot ship: this order has not been
  // paid/confirmed yet" is a useful sentence, "Something went wrong" is not.
  const shipError = ship.isError
    ? ship.error?.response?.data?.error || ship.error?.message || 'Could not mark as shipped'
    : null;

  return (
    <div className="border border-gray-100 rounded-2xl p-3 sm:p-4">
      <div className="flex items-start gap-3 sm:gap-4">
        <img
          src={imageUrl(item.product?.image || PLACEHOLDER_THUMB, 200)}
          alt={item.product?.title || 'Item'}
          width="56"
          height="56"
          loading="lazy"
          className="w-12 h-12 sm:w-14 sm:h-14 object-cover rounded bg-gray-200 shrink-0"
        />
        <div className="flex-grow min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-heritage-charcoal truncate">
                {item.product?.title || 'Item'}
              </p>
              <p className="text-[11px] sm:text-xs text-gray-500">
                Order {order.displayId || '—'} · {buyerName}
              </p>
            </div>
            <StatusPill status={item.status} />
          </div>

          {/* Ship-to block. This is the whole reason a seller opens this page. */}
          <div className="mt-3 bg-gray-50 rounded-xl p-2.5 sm:p-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">
              Ship to
            </p>
            <address className="not-italic text-xs sm:text-sm text-heritage-charcoal leading-relaxed">
              {buyerName}
              <br />
              {order.shippingAddress}
              <br />
              {[order.city, order.state, order.zipCode].filter(Boolean).join(', ')}
              {order.phone && (
                <>
                  <br />
                  <a href={`tel:${order.phone}`} className="hover:text-luxury-gold">
                    {order.phone}
                  </a>
                </>
              )}
            </address>
          </div>

          {/* Money, spelled out — sale price, what the Exchange keeps, what lands
              with the seller. The subtraction is the same one admin.js pays on. */}
          <div className="mt-3 flex flex-wrap gap-x-4 sm:gap-x-6 gap-y-1 text-xs sm:text-sm">
            <span className="text-gray-500">
              Sale <span className="font-medium text-heritage-charcoal">{inr(item.price)}</span>
            </span>
            <span className="text-gray-500">
              Platform fee{' '}
              <span className="font-medium text-heritage-charcoal">−{inr(item.platformFee)}</span>
            </span>
            <span className="text-gray-500">
              You receive <span className="font-bold text-luxury-gold">{inr(payout)}</span>
            </span>
          </div>

          {/* Action */}
          {shippable ? (
            <form
              className="mt-3 flex flex-col sm:flex-row gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                ship.mutate({ orderItemId: item.id, trackingID: trackingID.trim() || undefined });
              }}
            >
              <input
                type="text"
                value={trackingID}
                onChange={(e) => setTrackingID(e.target.value)}
                placeholder="Tracking ID (optional)"
                aria-label={`Tracking ID for ${item.product?.title || 'this item'}`}
                className="flex-grow px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-luxury-gold"
              />
              <button
                type="submit"
                disabled={ship.isPending}
                className="shrink-0 inline-flex items-center justify-center gap-2 px-4 py-2 bg-heritage-charcoal text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-luxury-gold hover:text-black transition-colors disabled:opacity-60"
              >
                {ship.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Truck size={14} />
                )}
                Mark as shipped
              </button>
            </form>
          ) : (
            blockedReason && (
              <p className="mt-3 text-xs text-gray-500 flex items-center gap-1.5">
                <AlertCircle size={13} className="shrink-0" />
                {blockedReason}
              </p>
            )
          )}

          {item.trackingID && (
            <p className="mt-2 text-[11px] sm:text-xs text-gray-500">
              Tracking: <span className="font-medium">{item.trackingID}</span>
            </p>
          )}

          {shipError && (
            <p role="alert" className="mt-2 text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {shipError}
            </p>
          )}
          {ship.isSuccess && (
            <p className="mt-2 text-xs text-green-700 flex items-center gap-1.5">
              <CheckCircle size={13} className="shrink-0" />
              Marked as shipped.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Sold items and the shipping they need.
 *
 * `GET /vendor/orders` and `PATCH /vendor/orders/:id/ship` have both existed and
 * been tested for a while — nothing on the site had ever called them, so an item
 * could sell and the seller had no way to see it or act on it.
 */
function SellerOrders() {
  const { data: orders, isLoading, error, refetch } = useVendorOrders();
  const [showAll, setShowAll] = useState(false);

  const needsShipping = (orders || []).filter(canShip);
  const visible = showAll ? orders || [] : needsShipping;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal">
            Your Sales
          </h3>
          <p className="text-xs text-gray-500">Ship what has sold, and see what you will be paid</p>
        </div>
        <Truck size={20} className="text-gray-400 shrink-0" />
      </div>

      <div className="flex gap-1.5 sm:gap-2 my-4 flex-wrap">
        {[
          {
            key: false,
            label: `To ship${needsShipping.length ? ` (${needsShipping.length})` : ''}`,
          },
          { key: true, label: `All${orders?.length ? ` (${orders.length})` : ''}` },
        ].map((tab) => (
          <button
            key={String(tab.key)}
            onClick={() => setShowAll(tab.key)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${
              showAll === tab.key
                ? 'bg-heritage-charcoal text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="border border-gray-100 rounded-2xl p-3 sm:p-4 flex gap-4">
              <Skeleton className="w-12 h-12 sm:w-14 sm:h-14 rounded" />
              <div className="flex-grow">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-28 mt-2" />
                <Skeleton className="h-16 w-full mt-3 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl p-3">
          <AlertCircle size={16} className="text-red-600 shrink-0" />
          <p className="text-xs sm:text-sm text-red-700 flex-grow">
            {error?.response?.data?.error || 'Could not load your sales.'}
          </p>
          <button
            onClick={() => refetch()}
            className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : visible.length > 0 ? (
        <div className="space-y-3">
          {visible.map((item) => (
            <OrderRow key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center h-24 sm:h-32 text-gray-500 text-center px-4">
          <p className="font-serif text-sm sm:text-lg">
            {showAll ? 'Nothing has sold yet' : 'Nothing is waiting to be shipped'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Where the money goes.
 *
 * UPI-only by decision — a UPI ID is a payment address rather than an account
 * number + IFSC. Until this existed the dashboard showed sellers PENDING payouts
 * without ever having asked them where to send the money.
 */
function PayoutDestinationCard({ profile, loading }) {
  const [editing, setEditing] = useState(false);
  const [upi, setUpi] = useState('');
  const [name, setName] = useState('');
  const save = useUpdatePayoutDetails();

  const onFile = profile?.payoutUpiMasked;
  // Distinct from "nothing on file": the column may not exist in the database
  // yet, in which case nagging the seller for a UPI would be dishonest.
  const unavailable = profile && profile.payoutDetailsAvailable === false;

  const saveError = save.isError
    ? save.error?.response?.data?.error || save.error?.message || 'Could not save payout details'
    : null;

  const startEditing = () => {
    setUpi('');
    setName(profile?.payoutUpiName || '');
    save.reset();
    setEditing(true);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal">
          Payout Details
        </h3>
        <Landmark size={20} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-500 mb-4">The UPI ID your payouts are sent to</p>

      {loading ? (
        <Skeleton className="h-10 w-full rounded-xl" />
      ) : unavailable ? (
        <p className="text-xs sm:text-sm text-gray-500">
          Payout details are not available yet. This will open up shortly — your sales and payouts
          are unaffected.
        </p>
      ) : editing ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { payoutUpi: upi.trim(), payoutUpiName: name.trim() || undefined },
              { onSuccess: () => setEditing(false) },
            );
          }}
        >
          <div>
            <label
              htmlFor="payout-upi"
              className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1"
            >
              UPI ID
            </label>
            <input
              id="payout-upi"
              type="text"
              required
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              placeholder="9876543210@ybl"
              autoComplete="off"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-luxury-gold"
            />
          </div>
          <div>
            <label
              htmlFor="payout-upi-name"
              className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1"
            >
              Name on the UPI account <span className="font-medium normal-case">(optional)</span>
            </label>
            <input
              id="payout-upi-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="As it appears in your UPI app"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-full focus:outline-none focus:border-luxury-gold"
            />
          </div>
          {saveError && (
            <p role="alert" className="text-xs text-red-600 flex items-start gap-1.5">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              {saveError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={save.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-heritage-charcoal text-white text-xs font-semibold uppercase tracking-widest rounded-full hover:bg-luxury-gold hover:text-black transition-colors disabled:opacity-60"
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 rounded-full hover:bg-gray-100"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <>
          {onFile ? (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-sm font-medium text-heritage-charcoal break-all">{onFile}</p>
              {profile?.payoutUpiName && (
                <p className="text-xs text-gray-500 mt-0.5">{profile.payoutUpiName}</p>
              )}
              {profile?.payoutUpiUpdatedAt && (
                <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                  Updated {new Date(profile.payoutUpiUpdatedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ) : (
            // Persistent, but never a block on listing: a seller who has not
            // added a UPI yet can still trade, they just cannot be paid out.
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-amber-900">
                No UPI ID on file. We have nowhere to send your payouts until you add one.
              </p>
            </div>
          )}
          <button
            onClick={startEditing}
            className="mt-3 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-600 border border-gray-200 rounded-full hover:border-gray-400 transition-colors"
          >
            {onFile ? 'Change UPI ID' : 'Add UPI ID'}
          </button>
        </>
      )}
    </div>
  );
}

/** Read-only mirror of the pickup address so payout details have a neighbour. */
function PickupAddressCard({ profile, loading }) {
  const hasAddress = Boolean(profile?.pickupAddress);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal">
          Pickup Address
        </h3>
        <MapPin size={20} className="text-gray-400" />
      </div>
      <p className="text-xs text-gray-500 mb-4">Where couriers collect from you</p>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : hasAddress ? (
        <div className="bg-gray-50 rounded-xl p-3">
          <address className="not-italic text-xs sm:text-sm text-heritage-charcoal leading-relaxed">
            {profile.pickupContactName && (
              <>
                {profile.pickupContactName}
                <br />
              </>
            )}
            {profile.pickupAddress}
            <br />
            {[profile.pickupCity, profile.pickupState, profile.pickupZip]
              .filter(Boolean)
              .join(', ')}
            {profile.pickupPhone && (
              <>
                <br />
                {profile.pickupPhone}
              </>
            )}
          </address>
          {profile.pickupVerified && (
            <p className="text-[10px] sm:text-xs text-green-700 mt-2 flex items-center gap-1">
              <CheckCircle size={12} /> Verified
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs sm:text-sm text-gray-500">
          No pickup address on file. Add one from your Account page.
        </p>
      )}
    </div>
  );
}

/**
 * The order items behind one payout, so a seller can add them up themselves.
 *
 * `OrderItem.payoutId` has always recorded this; nothing ever exposed it, so a
 * payout was a single number a seller had to take on trust.
 */
function PayoutBreakdown({ payoutId }) {
  const { data, isLoading, error } = useVendorPayoutItems(payoutId);

  if (isLoading) {
    return (
      <div className="mt-2 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  if (error) {
    return (
      <p className="mt-2 text-xs text-red-600">
        {error?.response?.data?.error || 'Could not load this breakdown.'}
      </p>
    );
  }
  if (!data?.items?.length) {
    return (
      <p className="mt-2 text-xs text-gray-500">
        No individual items are linked to this payout yet.
      </p>
    );
  }

  return (
    <div className="mt-2 border-t border-gray-200 pt-2">
      <ul className="space-y-1.5">
        {data.items.map((item) => (
          <li key={item.id} className="flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate text-gray-600">
              {item.product?.title || 'Item'}
              <span className="text-gray-500"> · {item.order?.displayId}</span>
            </span>
            <span className="shrink-0 font-medium text-heritage-charcoal">{inr(item.payout)}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between gap-3 text-xs mt-2 pt-2 border-t border-gray-200">
        <span className="text-gray-600">
          {data.totals.itemCount} item{data.totals.itemCount === 1 ? '' : 's'} · sale{' '}
          {inr(data.totals.gross)} − fee {inr(data.totals.platformFee)}
        </span>
        <span className="shrink-0 font-bold text-heritage-charcoal">{inr(data.totals.payout)}</span>
      </div>
    </div>
  );
}

export default function VendorDashboard() {
  const [period, setPeriod] = useState('30d');
  const [payoutFilter, setPayoutFilter] = useState('');
  const [payoutPage, setPayoutPage] = useState(1);
  const [openPayoutId, setOpenPayoutId] = useState(null);

  const { data: profile, isLoading: profileLoading } = useVendorProfile();
  const {
    data: overview,
    isLoading: overviewLoading,
    error: overviewError,
    refetch: refetchOverview,
  } = useVendorAnalyticsOverview(period);
  const { data: interest, isLoading: interestLoading } = useVendorAnalyticsInterest(period);
  const { data: salesGraph, isLoading: salesGraphLoading } = useVendorSalesGraph(period);
  const { data: topProducts, isLoading: topProductsLoading } = useVendorTopProducts(period);
  const { data: payoutsData, isLoading: payoutsLoading } = useVendorPayouts({
    status: payoutFilter || undefined,
    page: payoutPage,
  });

  const isLoading = overviewLoading || interestLoading || salesGraphLoading || topProductsLoading;
  const hasOfflineSales = (overview?.offlineSaleCount || 0) > 0;

  return (
    <div className="min-h-screen bg-secondary-bg">
      <SEO
        title="Vendor Dashboard"
        description="Manage your listings, sales, and analytics on The Collectors Exchange vendor dashboard."
        canonical="/vendor-dashboard"
        noindex
      />

      <div className="container mx-auto py-6 px-3 sm:py-12 sm:px-6">
        {/* Header */}
        <Reveal className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-4xl font-serif mb-2">Vendor Dashboard</h1>
            <p className="text-gray-500 font-light">
              {profileLoading ? (
                <Skeleton className="h-5 w-48" />
              ) : profile ? (
                `Welcome back, ${profile.companyName || 'Vendor'}`
              ) : (
                'Analytics & Insights for your store'
              )}
            </p>
          </div>
          <div className="mt-4 md:mt-0">
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </Reveal>

        {overviewError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 sm:w-5 sm:h-5" />
            <p className="text-xs sm:text-sm text-red-700 flex-grow">
              Failed to load analytics. The backend may be unavailable.
            </p>
            <button
              onClick={() => refetchOverview()}
              className="text-red-600 hover:text-red-800 text-sm font-semibold flex items-center gap-1"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Stats Cards */}
        <Stagger className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Tilt>
            <StatCard
              title="Order Count"
              value={overview?.orderCount}
              icon={ShoppingBag}
              color="bg-blue-500"
              loading={isLoading}
              error={overviewError}
              onRetry={refetchOverview}
            />
          </Tilt>
          <Tilt>
            <StatCard
              title="Items Sold"
              value={overview?.saleCount}
              icon={Package}
              color="bg-green-500"
              loading={isLoading}
              error={overviewError}
              onRetry={refetchOverview}
            />
          </Tilt>
          <Tilt>
            <StatCard
              title="Total Revenue"
              value={overview?.totalRevenue?.toLocaleString('en-IN')}
              icon={TrendingUp}
              color="bg-purple-500"
              prefix="₹"
              loading={isLoading}
              error={overviewError}
              onRetry={refetchOverview}
              note={
                hasOfflineSales
                  ? 'Includes your own offline sales'
                  : 'Sale price, before platform fee'
              }
            />
          </Tilt>
          <Tilt>
            <StatCard
              title="Pending Payout"
              value={overview?.pendingPayout?.toLocaleString('en-IN')}
              icon={DollarSign}
              color="bg-amber-500"
              prefix="₹"
              loading={isLoading}
              error={overviewError}
              onRetry={refetchOverview}
              note="Approved and awaiting transfer"
            />
          </Tilt>
        </Stagger>

        {/*
          Total Revenue counts offline sales; Net Earnings cannot, because the
          Exchange never handled that money. Without saying so, a seller who used
          mark-as-sold reads "Total Sales ₹X / Net Earnings ₹0" as a bug.
        */}
        {hasOfflineSales && (
          <Reveal className="-mt-2 mb-6 sm:mb-8">
            <p className="text-xs text-gray-500 bg-white border border-gray-100 rounded-2xl px-4 py-3">
              {overview.offlineSaleCount} of these sale
              {overview.offlineSaleCount === 1 ? ' was' : 's were'} marked sold by you outside the
              Exchange, worth {inr(overview.offlineRevenue)}. That amount is counted in Total
              Revenue but not in Net Earnings or payouts — the Exchange never handled it, so there
              is nothing for us to pay out.
            </p>
          </Reveal>
        )}

        {/* Sold items and the shipping they need. */}
        <Reveal className="mb-6 sm:mb-8">
          <SellerOrders />
        </Reveal>

        {/* Verified seller profile: where couriers collect, where money lands. */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          <Reveal>
            <PickupAddressCard profile={profile} loading={profileLoading} />
          </Reveal>
          <Reveal delay={120}>
            <PayoutDestinationCard profile={profile} loading={profileLoading} />
          </Reveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-8 mb-6 sm:mb-8">
          {/* Sales Graph */}
          <Reveal className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal mb-1">
                Sales Trend
              </h3>
              <p className="text-xs text-gray-500 mb-6">Daily revenue over the selected period</p>
              {salesGraphLoading ? (
                <div className="flex items-center justify-center h-48 sm:h-64">
                  <Loader2 className="animate-spin text-luxury-gold" size={24} />
                </div>
              ) : salesGraph && salesGraph.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={salesGraph}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d) => {
                        const parts = d.split('-');
                        return `${parts[2]}/${parts[1]}`;
                      }}
                    />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₹${v}`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      name="Sales"
                      stroke="#D4AF37"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#D4AF37' }}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      name="Orders"
                      stroke="#2563EB"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 sm:h-64 text-gray-500">
                  <p className="font-serif text-sm sm:text-lg">No sales data yet for this period</p>
                </div>
              )}
            </div>
          </Reveal>

          {/* Customer Interest Funnel */}
          <Reveal delay={120}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal mb-1">
                Customer Interest
              </h3>
              <p className="text-xs text-gray-500 mb-6">From discovery to purchase</p>
              <div className="space-y-3 sm:space-y-6">
                <FunnelBar
                  label="Product Views"
                  value={interest?.totalViews || 0}
                  maxValue={interest?.totalViews || 1}
                  color="bg-blue-400"
                  loading={interestLoading}
                />
                <FunnelBar
                  label="Added to Cart"
                  value={interest?.cartAdds || 0}
                  maxValue={interest?.totalViews || 1}
                  color="bg-amber-400"
                  loading={interestLoading}
                />
                <FunnelBar
                  label="Checkout Starts"
                  value={interest?.checkoutStarts || 0}
                  maxValue={interest?.totalViews || 1}
                  color="bg-green-400"
                  loading={interestLoading}
                />
                <div className="mt-4 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100">
                  {interestLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : (
                    <>
                      {/*
                        This used to be labelled "Conversion Rate" while dividing
                        checkout *starts* by views — an abandoned cart counted as
                        a conversion. Both numbers are worth having; they just
                        have to be named for what they measure.
                      */}
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span className="text-gray-500">Checkout start rate</span>
                        <span className="font-bold text-heritage-charcoal">
                          {interest?.totalViews > 0
                            ? `${((interest.checkoutStarts / interest.totalViews) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm mt-1 sm:mt-2">
                        <span className="text-gray-500">Views to sales</span>
                        <span className="font-bold text-heritage-charcoal">
                          {interest?.totalViews > 0
                            ? `${(((overview?.saleCount || 0) / interest.totalViews) * 100).toFixed(1)}%`
                            : '0%'}
                        </span>
                      </div>
                      <div className="flex justify-between text-xs sm:text-sm mt-1 sm:mt-2">
                        <span className="text-gray-500">Unique Viewers</span>
                        <span className="font-bold text-heritage-charcoal">
                          {interest?.uniqueViewers || 0}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
          {/* Top Products */}
          <Reveal>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal mb-1">
                Top Products
              </h3>
              <p className="text-xs text-gray-500 mb-6">Best sellers in this period</p>
              {topProductsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-50 rounded"
                    >
                      <Skeleton className="w-4 sm:w-6 h-4" />
                      <Skeleton className="w-8 sm:w-10 h-8 sm:h-10 rounded" />
                      <div className="flex-grow">
                        <Skeleton className="h-3 sm:h-4 w-20 sm:w-32" />
                        <Skeleton className="h-2 sm:h-3 w-14 sm:w-20 mt-1" />
                      </div>
                      <Skeleton className="h-3 sm:h-4 w-12 sm:w-16" />
                    </div>
                  ))}
                </div>
              ) : topProducts && topProducts.length > 0 ? (
                <div className="space-y-4">
                  {topProducts.slice(0, 5).map((product, i) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-2 sm:gap-4 p-2 sm:p-3 bg-gray-50 rounded"
                    >
                      <span className="text-[10px] sm:text-xs font-bold text-gray-500 w-4 sm:w-6">
                        {i + 1}
                      </span>
                      <img
                        src={imageUrl(
                          product.image ||
                            "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect width='40' height='40' fill='%23e5e7eb'/%3E%3C/svg%3E",
                          200,
                        )}
                        alt={product.title}
                        width="40"
                        height="40"
                        loading="lazy"
                        className="w-8 sm:w-10 h-8 sm:h-10 object-cover rounded bg-gray-200 shrink-0"
                      />
                      <div className="flex-grow min-w-0">
                        <p className="text-xs sm:text-sm font-medium text-heritage-charcoal truncate">
                          {product.title}
                        </p>
                        <p className="text-[10px] sm:text-xs text-gray-500">
                          {product.quantitySold} sold
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs sm:text-sm font-bold text-heritage-charcoal">
                          ₹{product.totalRevenue?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 sm:h-48 text-gray-500">
                  <p className="font-serif text-sm sm:text-lg">No products sold yet</p>
                </div>
              )}
            </div>
          </Reveal>

          {/* Payout Dashboard */}
          <Reveal delay={120}>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-base sm:text-lg font-serif font-bold text-heritage-charcoal">
                  Payouts
                </h3>
                <CreditCard size={20} className="text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mb-4">Your payout history</p>

              {/*
                Net Earnings belongs here rather than in the stat row: it is the
                number the payouts below are drawn from, and pairing it with the
                gross makes the platform fee visible instead of implied.
              */}
              <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">
                    Net earnings{hasOfflineSales ? ' (Exchange sales only)' : ''}
                  </span>
                  <span className="font-bold text-heritage-charcoal">
                    {isLoading ? '—' : inr(overview?.netEarnings)}
                  </span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Platform fees</span>
                  <span className="text-heritage-charcoal">
                    {isLoading ? '—' : `−${inr(overview?.totalPlatformFees)}`}
                  </span>
                </div>
                {profile?.payoutUpiMasked ? (
                  <p className="text-[10px] sm:text-xs text-gray-500 pt-1">
                    Paid to {profile.payoutUpiMasked}
                  </p>
                ) : (
                  profile &&
                  profile.payoutDetailsAvailable !== false && (
                    <p className="text-[10px] sm:text-xs text-amber-700 pt-1">
                      No UPI ID on file — add one above so these can be paid.
                    </p>
                  )
                )}
              </div>

              <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-6 flex-wrap">
                {['', 'PENDING', 'PAID', 'FAILED'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setPayoutFilter(s === payoutFilter ? '' : s);
                      setPayoutPage(1);
                    }}
                    className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full transition-colors ${payoutFilter === s ? 'bg-heritage-charcoal text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    {s || 'All'}
                  </button>
                ))}
              </div>

              {payoutsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-2 sm:p-3 bg-gray-50 rounded"
                    >
                      <div>
                        <Skeleton className="h-3 sm:h-4 w-16 sm:w-24" />
                        <Skeleton className="h-2 sm:h-3 w-20 sm:w-32 mt-1" />
                      </div>
                      <Skeleton className="h-4 sm:h-5 w-12 sm:w-16 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : payoutsData?.payouts && payoutsData.payouts.length > 0 ? (
                <>
                  <div className="space-y-2 sm:space-y-3">
                    {payoutsData.payouts.map((payout) => (
                      <div key={payout.id} className="p-2 sm:p-3 bg-gray-50 rounded">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 mr-2">
                            <p className="text-xs sm:text-sm font-medium text-heritage-charcoal">
                              {inr(payout.amount)}
                            </p>
                            <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                              {new Date(payout.periodStart).toLocaleDateString()} to{' '}
                              {new Date(payout.periodEnd).toLocaleDateString()}
                            </p>
                            {/* Populated by admin.js on auto-create, never shown until now. */}
                            {payout.note && (
                              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                {payout.note}
                              </p>
                            )}
                            {profile?.payoutUpiMasked && (
                              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">
                                To {profile.payoutUpiMasked}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full ${
                              payout.status === 'PAID'
                                ? 'bg-green-100 text-green-700'
                                : payout.status === 'PROCESSING'
                                  ? 'bg-blue-100 text-blue-700'
                                  : payout.status === 'FAILED'
                                    ? 'bg-red-100 text-red-700'
                                    : 'bg-amber-100 text-amber-700'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </div>

                        <button
                          onClick={() =>
                            setOpenPayoutId((current) => (current === payout.id ? null : payout.id))
                          }
                          aria-expanded={openPayoutId === payout.id}
                          className="mt-1.5 inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-gray-600 hover:text-heritage-charcoal"
                        >
                          <ChevronDown
                            size={13}
                            className={`transition-transform ${openPayoutId === payout.id ? 'rotate-180' : ''}`}
                          />
                          {openPayoutId === payout.id ? 'Hide items' : 'Show items'}
                        </button>
                        {openPayoutId === payout.id && <PayoutBreakdown payoutId={payout.id} />}
                      </div>
                    ))}
                  </div>
                  {payoutsData.pagination?.pages > 1 && (
                    <div className="flex items-center justify-between mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-100">
                      <button
                        disabled={payoutPage <= 1}
                        onClick={() => setPayoutPage((p) => p - 1)}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full ${payoutPage <= 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        Previous
                      </button>
                      <span className="text-[10px] sm:text-xs text-gray-500">
                        Page {payoutsData.pagination.page} of {payoutsData.pagination.pages}
                      </span>
                      <button
                        disabled={payoutPage >= payoutsData.pagination.pages}
                        onClick={() => setPayoutPage((p) => p + 1)}
                        className={`px-2 sm:px-3 py-1 sm:py-1.5 text-[10px] sm:text-xs font-semibold uppercase tracking-wider rounded-full ${payoutPage >= payoutsData.pagination.pages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100'}`}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center h-24 sm:h-32 text-gray-500">
                  <p className="font-serif text-sm sm:text-lg">No payouts yet</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

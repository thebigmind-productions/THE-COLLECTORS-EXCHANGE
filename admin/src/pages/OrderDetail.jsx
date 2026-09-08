import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Truck,
  Package,
  CheckCircle,
  User,
  MapPin,
  CreditCard,
  ExternalLink,
  XCircle,
  Pencil,
} from 'lucide-react';
import {
  useOrderDetail,
  useUpdateOrderStatus,
  useShipOrder,
  useMarkOrderPaid,
} from '../hooks/api/useOrders';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ErrorState from '../components/ui/ErrorState';
import { useConfirm } from '../components/ConfirmDialog';
import { getErrorMessage } from '../utils/apiError';

function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [trackingID, setTrackingID] = useState('');
  const [showShipModal, setShowShipModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const {
    data: order,
    isLoading,
    isError,
    error: orderError,
    refetch,
    isFetching,
  } = useOrderDetail(id);
  const updateStatusMutation = useUpdateOrderStatus();
  const shipOrderMutation = useShipOrder();
  const markPaidMutation = useMarkOrderPaid();

  const handleMarkPaid = async () => {
    setError('');
    try {
      await markPaidMutation.mutateAsync(id);
      setSuccess('Order marked as paid');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark order as paid'));
    }
  };

  const handleUpdateStatus = async (status) => {
    setError('');
    try {
      await updateStatusMutation.mutateAsync({ id, status });
      setSuccess(`Order marked as ${status}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, `Failed to update status to ${status}`));
    }
  };

  /**
   * Cancelling is the one order action whose side effects the operator cannot
   * reverse from this screen: every item goes back to Approved (re-listed on
   * the storefront) and a paid order is marked Refunded on the ledger — there
   * is no payment gateway anymore, so the operator refunds the buyer manually
   * (UPI/bank transfer) outside the system. There was previously no way to
   * cancel an order from the dashboard at all, even though the API supports
   * it from Pending / Processing / Shipped.
   */
  const handleCancelOrder = async () => {
    const willRefund = order.paymentStatus === 'Paid';
    const itemCount = order.items?.length ?? 0;
    const label = order.displayId || `#${order.id.slice(-8).toUpperCase()}`;
    const confirmed = await confirm(
      `Cancel order ${label}? ${itemCount} item${itemCount === 1 ? '' : 's'} will go back on sale ` +
        'on the storefront, ' +
        (willRefund
          ? 'and the order will be marked Refunded — refund the buyer manually outside the system. '
          : 'and the unpaid order will be voided. ') +
        'The buyer is notified. This cannot be undone: Cancelled is a final status.',
    );
    if (!confirmed) return;
    await handleUpdateStatus('Cancelled');
  };

  const handleShipOrder = async () => {
    if (!trackingID.trim()) {
      setError('Please provide a tracking ID (AWB Number)');
      return;
    }

    setError('');
    try {
      await shipOrderMutation.mutateAsync({ id, trackingID: trackingID.trim() });
      setSuccess(
        order.status === 'Shipped' ? 'Tracking ID updated.' : 'Order shipped successfully!',
      );
      setShowShipModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to ship order'));
    }
  };

  const openShipModal = () => {
    // Prefill so correcting a mistyped AWB does not mean retyping all of it.
    setTrackingID(order?.trackingID || '');
    setShowShipModal(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <ErrorState
          error={orderError}
          title="Could not load this order"
          onRetry={refetch}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Order not found</p>
      </div>
    );
  }

  const isCancellable = ['Pending', 'Processing', 'Shipped'].includes(order.status);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/orders')}
          className="flex items-center gap-2 text-gray-600 hover:text-luxury-gold transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Orders</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-3xl font-serif font-bold text-heritage-charcoal">
                Order #{order.id.slice(-8).toUpperCase()}
              </h2>
              <StatusBadge status={order.status} />
            </div>
            <p className="text-gray-500 mt-1">
              Placed on {new Date(order.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.alert('Generating packing slip... (Placeholder)')}
              className="flex items-center gap-2 px-4 py-2 border border-blue-200 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 transition-colors"
            >
              <Printer size={18} />
              <span>Print Packing Slip</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-6">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Products List */}
          <div className="bg-white rounded-lg shadow-heritage overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center gap-3">
              <Package className="text-luxury-gold" size={20} />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">Ordered Items</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {order.items?.map((item) => (
                <div key={item.id} className="p-6 flex items-center gap-4">
                  <img
                    src={item.product?.image}
                    alt={item.product?.title}
                    className="w-16 h-16 object-cover rounded bg-gray-50 border border-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-heritage-charcoal truncate">
                      {item.product?.title}
                    </h4>
                    <p className="text-sm text-gray-500">Category: {item.product?.category}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-heritage-charcoal">₹{item.price.toFixed(2)}</div>
                    <div className="text-xs text-gray-500">Qty: {item.quantity}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 p-6 space-y-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Shipping</span>
                <span className="text-green-600">Free</span>
              </div>
              <div className="flex justify-between text-xl font-bold text-heritage-charcoal pt-2 border-t border-gray-200">
                <span>Total</span>
                <span className="text-luxury-gold">₹{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="flex items-center gap-3 mb-6 border-b pb-4">
              <MapPin className="text-luxury-gold" size={20} />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">
                Shipping Address
              </h3>
            </div>
            <div className="space-y-1">
              {/* buyerName FIRST: it is the recipient the buyer typed at
                  checkout, which is not always the account holder (gifts,
                  office deliveries). The account name is only the fallback. */}
              <p className="font-bold text-heritage-charcoal">
                {order.buyerName || order.user?.name || 'Walk-in'}
              </p>
              <p className="text-gray-700">{order.shippingAddress}</p>
              <p className="text-gray-700">
                {order.city}, {order.state} {order.zipCode}
              </p>
              <p className="text-gray-700 pt-2 flex items-center gap-2">
                <span className="font-semibold">Phone:</span> {order.phone}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Fulfillment Panel */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <h3 className="text-lg font-serif font-bold text-heritage-charcoal mb-4 border-b pb-2">
              Order Fulfillment
            </h3>

            <div className="space-y-4">
              {/* Step 1: Processing */}
              <div className="relative pl-6 pb-6 border-l-2 border-gray-200">
                <div
                  className={`absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    ['Processing', 'Shipped', 'Delivered'].includes(order.status)
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                ></div>
                <h4 className="font-bold text-sm text-heritage-charcoal">1. Packaging</h4>
                <p className="text-xs text-gray-500 mt-1 mb-3">Prepare items for dispatch.</p>

                {order.status === 'Pending' && (
                  <button
                    onClick={() => handleUpdateStatus('Processing')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full bg-blue-50 text-blue-700 py-2 rounded font-medium text-sm hover:bg-blue-100 transition-colors"
                  >
                    Mark as Processing
                  </button>
                )}
              </div>

              {/* Step 2: Shipping */}
              <div className="relative pl-6 pb-6 border-l-2 border-gray-200">
                <div
                  className={`absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    ['Shipped', 'Delivered'].includes(order.status) ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                ></div>
                <h4 className="font-bold text-sm text-heritage-charcoal">2. Dispatch</h4>
                <p className="text-xs text-gray-500 mt-1 mb-3">
                  Send via Delhivery or other courier.
                </p>

                {order.status === 'Processing' && (
                  <button
                    onClick={openShipModal}
                    className="w-full bg-amber-50 text-amber-700 py-2 rounded font-medium text-sm hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
                  >
                    <Truck size={16} />
                    Confirm Shipment
                  </button>
                )}

                {/* The API accepts /ship again while the order is Shipped, so a
                    mistyped AWB is fixable instead of permanent. */}
                {order.status === 'Shipped' && (
                  <button
                    onClick={openShipModal}
                    className="w-full border border-gray-200 text-gray-600 py-2 rounded font-medium text-sm hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <Pencil size={14} />
                    Correct Tracking ID
                  </button>
                )}

                {order.trackingID && (
                  <div className="mt-2 text-xs bg-gray-50 p-2 rounded border border-gray-200">
                    <span className="font-semibold text-gray-500 block uppercase">
                      Tracking ID (AWB)
                    </span>
                    <div className="flex items-center justify-between mt-1">
                      <span className="font-mono font-bold text-heritage-charcoal">
                        {order.trackingID}
                      </span>
                      <a
                        href={`${import.meta.env.VITE_TRACKING_URL || 'https://www.delhivery.com'}/track/package/${order.trackingID}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-luxury-gold hover:underline flex items-center gap-1"
                      >
                        Track <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: Delivery */}
              <div className="relative pl-6">
                <div
                  className={`absolute -left-2 top-0 w-4 h-4 rounded-full border-2 border-white shadow-sm ${
                    order.status === 'Delivered' ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                ></div>
                <h4 className="font-bold text-sm text-heritage-charcoal">3. Completion</h4>
                <p className="text-xs text-gray-500 mt-1 mb-3">Ensure customer received items.</p>

                {['Processing', 'Shipped'].includes(order.status) && (
                  <button
                    onClick={() => handleUpdateStatus('Delivered')}
                    disabled={updateStatusMutation.isPending}
                    className="w-full bg-green-50 text-green-700 py-2 rounded font-medium text-sm hover:bg-green-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle size={16} />
                    {updateStatusMutation.isPending ? 'Updating...' : 'Mark as Delivered'}
                  </button>
                )}
              </div>

              {isCancellable && (
                <div className="pt-4 mt-2 border-t border-gray-100">
                  <button
                    onClick={handleCancelOrder}
                    disabled={updateStatusMutation.isPending}
                    className="w-full bg-red-50 text-red-700 py-2 rounded font-medium text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    {updateStatusMutation.isPending ? 'Working...' : 'Cancel Order'}
                  </button>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    Re-lists the items and refunds a captured payment. Final once done.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Payment Information */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="flex items-center gap-3 mb-4">
              <CreditCard className="text-luxury-gold" size={20} />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">
                Payment Information
              </h3>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Method</span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full ${order.paymentMethod === 'cod' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}
                >
                  {order.paymentMethod === 'cod' ? 'Cash on Delivery' : 'WhatsApp Checkout'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">Status</span>
                <StatusBadge status={order.paymentStatus} />
              </div>
              {order.paymentId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Payment ID</span>
                  <span className="text-xs font-mono text-gray-700">{order.paymentId}</span>
                </div>
              )}
              {order.paymentMethod !== 'cod' && order.paymentOrderId && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">Gateway Order ID</span>
                  <span className="text-xs font-mono text-gray-700">{order.paymentOrderId}</span>
                </div>
              )}
              {/* No gateway or webhook confirms a WhatsApp order's payment, and it
                  is typically collected before dispatch — not on delivery like
                  COD — so this is the only way to move it to Paid ahead of the
                  Delivered auto-mark. */}
              {order.paymentMethod === 'whatsapp' && order.paymentStatus !== 'Paid' && (
                <button
                  onClick={handleMarkPaid}
                  disabled={markPaidMutation.isPending}
                  className="w-full mt-2 px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 font-medium text-sm transition-colors"
                >
                  {markPaidMutation.isPending ? 'Marking Paid…' : 'Mark Payment Received'}
                </button>
              )}
            </div>
          </div>

          {/* Customer Info Card */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="flex items-center gap-3 mb-4">
              <User className="text-luxury-gold" size={20} />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">
                Customer Profile
              </h3>
            </div>
            <div className="space-y-4">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Account</dt>
                <dd className="text-sm font-bold text-heritage-charcoal mt-1">
                  {order.user?.name || order.buyerName || 'Walk-in Customer'}
                </dd>
                <dd className="text-sm text-gray-500">
                  {order.user?.email || order.buyerPhone || ''}
                </dd>
              </div>
              {order.userId && (
                <button
                  onClick={() => navigate(`/users/${order.userId}`)}
                  className="w-full text-xs text-luxury-gold hover:underline font-medium text-center border-t pt-4 mt-2"
                >
                  View Customer History
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Ship Modal */}
      <Modal
        isOpen={showShipModal}
        onClose={() => setShowShipModal(false)}
        title={order.status === 'Shipped' ? 'Correct Tracking ID' : 'Confirm Shipment'}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enter the Tracking ID / AWB Number provided by your courier (e.g., Delhivery). This will
            be visible to the customer.
          </p>

          <div>
            <label className="block text-sm font-semibold text-heritage-dark mb-1">
              AWB / Tracking Number
            </label>
            <input
              type="text"
              value={trackingID}
              onChange={(e) => setTrackingID(e.target.value)}
              placeholder="e.g. 129384756201"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-amber-500 outline-none uppercase font-mono"
            />
          </div>

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setShowShipModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleShipOrder}
              disabled={shipOrderMutation.isPending}
              className="px-6 py-2 bg-luxury-gold text-white rounded-md hover:bg-luxury-gold/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              <Truck size={18} />
              {shipOrderMutation.isPending
                ? 'Processing...'
                : order.status === 'Shipped'
                  ? 'Save Tracking ID'
                  : 'Confirm Dispatch'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default OrderDetail;

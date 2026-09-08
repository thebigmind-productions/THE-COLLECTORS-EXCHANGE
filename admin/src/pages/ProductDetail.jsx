import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Package,
  Eye,
  EyeOff,
  Clock,
  MessageSquare,
  Trash2,
  Plus,
  Edit3,
  BadgeIndianRupee,
  Tag,
  Percent,
  Copy,
} from 'lucide-react';
import {
  useProductDetail,
  useApproveProduct,
  useRejectProduct,
  useReviewProduct,
  useUpdateAuthenticityStatus,
  useDeleteProduct,
  useUpdateProduct,
  useBrands,
  useMarkProductAsSold,
} from '../hooks/api/useProducts';
import { useCreateManualOrder } from '../hooks/api/useOrders';
import { useComparisonPlatforms } from '../hooks/api/useComparisonPlatforms';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ManualOrderModal from '../components/ManualOrderModal';
import { useConfirm } from '../components/ConfirmDialog';
import ErrorState from '../components/ui/ErrorState';
import { useProductCoupon, useGenerateCoupon, useDeleteCoupon } from '../hooks/api/useCoupons';
import { getUser } from '../utils/storage';
import { getErrorMessage } from '../utils/apiError';

/**
 * Values are AuthenticityStatus enum members from prisma/schema.prisma; the
 * admin route validates against exactly these four strings.
 */
const AUTHENTICITY_OPTIONS = [
  { value: 'Pending', label: 'Pending', note: 'Not yet assessed. Does not change the listing.' },
  {
    value: 'Under_Review',
    label: 'Under Review',
    note: 'Being assessed. Does not change the listing.',
  },
  {
    value: 'Verified',
    label: 'Verified',
    note: 'Also sets the listing to Approved and publishes it.',
  },
  {
    value: 'Rejected',
    label: 'Rejected',
    note: 'Also sets the listing to Rejected and unpublishes it.',
  },
];

// Comparisons form state is keyed by platform id — { [platformId]: { url,
// price } } — mirroring the seller-facing form in the main app's Account.jsx.
// Only platforms with a url are ever sent to the API.
const buildComparisonsPayload = (comparisonsMap) =>
  Object.entries(comparisonsMap || {})
    .filter(([, entry]) => entry?.url?.trim())
    .map(([platformId, entry]) => {
      const price = parseFloat(entry.price);
      return {
        platformId,
        url: entry.url.trim(),
        ...(Number.isFinite(price) && price > 0 ? { price } : {}),
      };
    });

const comparisonsToFormMap = (comparisons) => {
  const map = {};
  (Array.isArray(comparisons) ? comparisons : []).forEach((entry) => {
    if (!entry?.platformId) return;
    map[entry.platformId] = { url: entry.url || '', price: entry.price?.toString() || '' };
  });
  return map;
};

function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isSuperAdmin = getUser()?.role === 'admin';
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    category: '',
    description: '',
    price: 0,
    condition: '',
    brand: '',
    listingCategory: 'normal',
    quantity: 1,
    image: '',
    images: [],
    keywords: [],
    specs: [],
    comparisons: {},
    commissionPercent: 10,
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [brandInputMode, setBrandInputMode] = useState(false);
  const [customBrand, setCustomBrand] = useState('');
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [showManualOrderModal, setShowManualOrderModal] = useState(false);
  const [isBackfill, setIsBackfill] = useState(false);

  const {
    data: product,
    isLoading,
    isError,
    error: productError,
    refetch,
    isFetching,
  } = useProductDetail(id);
  const { data: brands = [] } = useBrands();
  const approveMutation = useApproveProduct();
  const rejectMutation = useRejectProduct();
  const reviewMutation = useReviewProduct();
  const updateStatusMutation = useUpdateAuthenticityStatus();
  const deleteMutation = useDeleteProduct();
  const updateProductMutation = useUpdateProduct();
  const markAsSoldMutation = useMarkProductAsSold();
  const createManualOrderMutation = useCreateManualOrder();
  const confirm = useConfirm();
  const { data: comparisonPlatforms } = useComparisonPlatforms();

  const { data: coupon, isLoading: couponLoading } = useProductCoupon(id);
  const generateCouponMutation = useGenerateCoupon();
  const deleteCouponMutation = useDeleteCoupon();

  const handleMarkAsSold = async () => {
    const confirmed = await confirm(
      `Mark "${product.title}" as sold? This will unpublish the listing.`,
    );
    if (!confirmed) return;
    setError('');
    try {
      await markAsSoldMutation.mutateAsync(id);
      setSuccess('Product marked as sold');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark as sold'));
    }
  };

  const handleManualOrder = async (orderData) => {
    setError('');
    try {
      await createManualOrderMutation.mutateAsync(orderData);
      setSuccess(isBackfill ? 'Order record created successfully!' : 'Order punched successfully!');
      setShowManualOrderModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create order'));
    }
  };

  const openPunchOrder = () => {
    setIsBackfill(false);
    setShowManualOrderModal(true);
  };

  const openBackfill = () => {
    setIsBackfill(true);
    setShowManualOrderModal(true);
  };

  const handleReview = async () => {
    setError('');
    try {
      await reviewMutation.mutateAsync(id);
      setSuccess('Product is now under review');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to start review'));
    }
  };

  const handleApprove = async () => {
    setError('');
    try {
      await approveMutation.mutateAsync(id);
      setSuccess('Product approved and published successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve product'));
    }
  };

  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [imageFeedback, setImageFeedback] = useState('');

  const allImages = product?.image
    ? [product.image, ...(product?.images?.filter((img) => img !== product.image) || [])]
    : product?.images || [];

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft' && lightboxIndex > 0) setLightboxIndex(lightboxIndex - 1);
      if (e.key === 'ArrowRight' && lightboxIndex < allImages.length - 1)
        setLightboxIndex(lightboxIndex + 1);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, allImages.length]);

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }

    setError('');
    try {
      await rejectMutation.mutateAsync({ id, reason: rejectionReason });
      setSuccess('Product rejected');
      setShowRejectModal(false);
      setRejectionReason('');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to reject product'));
    }
  };

  const handleDelete = async () => {
    setError('');
    try {
      await deleteMutation.mutateAsync(id);
      setSuccess('Product deleted');
      setTimeout(() => navigate('/products'), 1500);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete product'));
    }
  };

  const handleUpdateProduct = async () => {
    setError('');
    try {
      const fields = {};
      if (editForm.title !== (product.title || '')) fields.title = editForm.title;
      if (editForm.category !== (product.category || '')) fields.category = editForm.category;
      if (editForm.description !== (product.description || ''))
        fields.description = editForm.description;
      if (Number(editForm.price) !== Number(product.price || 0))
        fields.price = Number(editForm.price);
      if (editForm.condition !== (product.condition || '')) fields.condition = editForm.condition;
      const finalBrand = brandInputMode ? customBrand : editForm.brand;
      if (finalBrand !== (product.brand || '')) fields.brand = finalBrand;
      if (editForm.listingCategory !== (product.listingCategory || 'normal'))
        fields.listingCategory = editForm.listingCategory;
      if (Number(editForm.quantity) !== Number(product.quantity ?? 1))
        fields.quantity = Number(editForm.quantity);
      if (editForm.image !== (product.image || '')) fields.image = editForm.image;
      if (JSON.stringify(editForm.images) !== JSON.stringify(product.images || []))
        fields.images = editForm.images;
      if (JSON.stringify(editForm.keywords) !== JSON.stringify(product.keywords || []))
        fields.keywords = editForm.keywords;
      if (JSON.stringify(editForm.specs) !== JSON.stringify(product.specs || []))
        fields.specs = editForm.specs;
      const comparisonsPayload = buildComparisonsPayload(editForm.comparisons);
      if (JSON.stringify(comparisonsPayload) !== JSON.stringify(product.comparisons || []))
        fields.comparisons = comparisonsPayload;
      if (Number(editForm.commissionPercent) !== Number(product.commissionPercent ?? 10))
        fields.commissionPercent = Number(editForm.commissionPercent);
      if (Object.keys(fields).length === 0) {
        setShowEditModal(false);
        return;
      }
      await updateProductMutation.mutateAsync({ id, ...fields });
      setSuccess('Product updated successfully');
      setShowEditModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update product'));
    }
  };

  const handleUpdateAuthStatus = async () => {
    if (!selectedStatus) return;

    setError('');
    try {
      await updateStatusMutation.mutateAsync({ id, status: selectedStatus });
      setSuccess('Authenticity status updated!');
      setShowStatusModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to update status'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // A failed fetch is NOT the same as a missing product — saying "not found"
  // when the request 500'd sends the operator hunting for a deleted listing.
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <ErrorState
          error={productError}
          title="Could not load this product"
          onRetry={refetch}
          isRetrying={isFetching}
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Product not found</p>
      </div>
    );
  }

  const handleOpenEditModal = () => {
    setEditForm({
      title: product.title || '',
      category: product.category || '',
      description: product.description || '',
      price: product.price || 0,
      condition: product.condition || '',
      brand: product.brand || '',
      listingCategory: product.listingCategory || 'normal',
      quantity: product.quantity ?? 1,
      image: product.image || '',
      images: product.images || [],
      keywords: product.keywords || [],
      specs: product.specs || [],
      comparisons: comparisonsToFormMap(product.comparisons),
      commissionPercent: product.commissionPercent ?? 10,
    });
    setBrandInputMode(false);
    setCustomBrand('');
    setShowEditModal(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/products')}
          className="flex items-center gap-2 text-gray-600 hover:text-luxury-gold transition-colors mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Products</span>
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-serif font-bold text-heritage-charcoal">
              {product.title}
            </h2>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm text-gray-500">ID: {product.id}</span>
              <div className="flex gap-2">
                <StatusBadge status={product.status} />
                <div
                  className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${product.isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}
                >
                  {product.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                  {product.isPublished ? 'Live on Site' : 'Hidden'}
                </div>
              </div>
            </div>
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
        {/* Product Image & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Rejection Reason Alert */}
          {product.status === 'Rejected' && product.rejectionReason && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
              <div className="flex items-start gap-3">
                <MessageSquare className="text-red-500 mt-1" size={18} />
                <div>
                  <h4 className="font-bold text-red-800">Rejection Reason</h4>
                  <p className="text-red-700 mt-1">{product.rejectionReason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Image */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            {product.image ? (
              <img
                src={product.image}
                alt={product.title}
                className="w-full h-96 object-contain rounded-lg bg-gray-50 cursor-zoom-in"
                onClick={() => setLightboxIndex(0)}
              />
            ) : (
              <div className="w-full h-96 flex items-center justify-center bg-gray-50 rounded-lg text-gray-400">
                <Package size={64} strokeWidth={1} />
              </div>
            )}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {allImages.map((img, i) => (
                  <img
                    key={i}
                    src={img}
                    alt=""
                    className={`w-16 h-16 object-cover rounded border-2 cursor-pointer flex-shrink-0 ${i === 0 ? 'border-luxury-gold' : 'border-gray-200 hover:border-gray-400'}`}
                    onClick={() => setLightboxIndex(i)}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8 pb-6 border-b border-gray-100">
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Price
                </dt>
                <dd className="text-xl font-bold text-luxury-gold mt-1">₹{product.price}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Qty
                </dt>
                <dd className="text-xl font-bold text-heritage-charcoal mt-1">
                  {product.quantity ?? 1}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Category
                </dt>
                <dd className="text-sm font-medium text-heritage-charcoal mt-1">
                  {product.category}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Brand
                </dt>
                <dd className="text-sm font-medium text-heritage-charcoal mt-1">
                  {product.brand || 'Not set'}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Listing
                </dt>
                <dd className="text-sm font-medium mt-1">
                  {isEditingCategory ? (
                    <div className="flex gap-2">
                      <select
                        value={editForm.listingCategory}
                        onChange={(e) =>
                          setEditForm((f) => ({ ...f, listingCategory: e.target.value }))
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-xs outline-none focus:ring-2 focus:ring-luxury-gold"
                        autoFocus
                      >
                        <option value="normal">Normal</option>
                        <option value="featured">Featured</option>
                        <option value="most_rare">Most Rare</option>
                      </select>
                      <button
                        onClick={async () => {
                          if (editForm.listingCategory !== (product.listingCategory || 'normal')) {
                            await updateProductMutation.mutateAsync({
                              id,
                              listingCategory: editForm.listingCategory,
                            });
                          }
                          setIsEditingCategory(false);
                        }}
                        className="text-xs text-green-600 hover:underline font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditForm((f) => ({
                            ...f,
                            listingCategory: product.listingCategory || 'normal',
                          }));
                          setIsEditingCategory(false);
                        }}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      onClick={() => {
                        setEditForm((f) => ({
                          ...f,
                          listingCategory: product.listingCategory || 'normal',
                        }));
                        setIsEditingCategory(true);
                      }}
                      className={`cursor-pointer inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold ${product.listingCategory === 'most_rare' ? 'bg-purple-100 text-purple-800' : product.listingCategory === 'featured' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {product.listingCategory || 'normal'}
                      <Edit3 size={12} className="opacity-50 group-hover:opacity-100" />
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Condition
                </dt>
                <dd className="text-sm font-medium text-heritage-charcoal mt-1">
                  {product.condition}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider font-semibold text-gray-500">
                  Submitted
                </dt>
                <dd className="text-sm font-medium text-heritage-charcoal mt-1">
                  {new Date(product.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </div>

            <div>
              <dt className="text-sm font-semibold text-heritage-dark mb-2">Description</dt>
              <dd className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {product.description}
              </dd>
            </div>

            {(() => {
              let specs = [];
              if (Array.isArray(product.specs)) {
                specs = product.specs;
              } else if (typeof product.specs === 'string') {
                try {
                  specs = JSON.parse(product.specs);
                } catch {
                  specs = [];
                }
              }
              if (specs.length === 0) return null;
              return (
                <div>
                  <dt className="text-sm font-semibold text-heritage-dark mb-2">Specifications</dt>
                  <dd className="text-sm text-gray-700">
                    <div className="border border-gray-200 rounded overflow-hidden">
                      {specs.map((spec, index) => (
                        <div
                          key={index}
                          className={`flex text-sm ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                        >
                          <span className="w-2/5 px-3 py-2 font-medium text-heritage-charcoal border-r border-gray-200">
                            {spec.key}
                          </span>
                          <span className="flex-1 px-3 py-2 text-gray-600">{spec.value}</span>
                        </div>
                      ))}
                    </div>
                  </dd>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Verification Progress */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <h3 className="text-lg font-serif font-bold text-heritage-charcoal mb-4 border-b pb-2">
              Verification Panel
            </h3>

            <div className="space-y-4">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Actions
                </p>

                {product.status === 'Pending' && (
                  <button
                    onClick={handleReview}
                    disabled={reviewMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-md font-medium hover:bg-blue-100 transition-colors"
                  >
                    <Clock size={18} />
                    {reviewMutation.isPending ? 'Updating...' : 'Start Review'}
                  </button>
                )}

                <button
                  onClick={handleApprove}
                  disabled={approveMutation.isPending || product.status === 'Approved'}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors ${
                    product.status === 'Approved'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <CheckCircle size={18} />
                  {approveMutation.isPending ? 'Processing...' : 'Approve & Publish'}
                </button>

                <button
                  onClick={() => setShowRejectModal(true)}
                  disabled={rejectMutation.isPending || product.status === 'Rejected'}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors ${
                    product.status === 'Rejected'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <XCircle size={18} />
                  Reject Product
                </button>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Authenticity Info
                </p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-gray-600">Current Level</span>
                  <StatusBadge status={product.authenticityStatus} />
                </div>
                <button
                  onClick={() => {
                    setSelectedStatus(product.authenticityStatus);
                    setShowStatusModal(true);
                  }}
                  className="w-full text-xs text-luxury-gold hover:underline font-medium text-center"
                >
                  Change Authenticity Status Manually
                </button>
              </div>

              <div className="pt-4 border-t space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Product Settings
                </p>
                <button
                  onClick={handleOpenEditModal}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-md font-medium hover:bg-amber-100 transition-colors"
                >
                  Edit Product
                </button>
                <button
                  onClick={handleMarkAsSold}
                  disabled={markAsSoldMutation.isPending || product.status === 'Sold'}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-md font-medium transition-colors ${
                    product.status === 'Sold'
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
                >
                  <BadgeIndianRupee size={18} />
                  {markAsSoldMutation.isPending
                    ? 'Updating...'
                    : product.status === 'Sold'
                      ? 'Already Sold'
                      : 'Mark as Sold'}
                </button>
                {isSuperAdmin && product.status === 'Approved' && (
                  <button
                    onClick={openPunchOrder}
                    className="w-full flex items-center justify-center gap-2 bg-luxury-gold/10 text-luxury-gold py-3 rounded-md font-medium hover:bg-luxury-gold/20 transition-colors"
                  >
                    <BadgeIndianRupee size={18} />
                    Punch Order (Cash/Walk-in)
                  </button>
                )}
                {isSuperAdmin && product.status === 'Sold' && !product.orderItems?.length && (
                  <button
                    onClick={openBackfill}
                    className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-700 py-3 rounded-md font-medium hover:bg-blue-100 transition-colors"
                  >
                    <BadgeIndianRupee size={18} />
                    Create Order Record
                  </button>
                )}
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-700 py-3 rounded-md font-medium hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={18} />
                  Delete Product
                </button>
              </div>

              <div className="pt-4 border-t space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Listing Review
                </p>
                <textarea
                  value={imageFeedback}
                  onChange={(e) => setImageFeedback(e.target.value)}
                  placeholder="e.g., Blurry image, poor lighting, missing details, incorrect category..."
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-luxury-gold outline-none resize-none"
                ></textarea>
                <button
                  onClick={() => {
                    if (!imageFeedback.trim()) return;
                    setRejectionReason(imageFeedback);
                    setShowRejectModal(true);
                  }}
                  disabled={!imageFeedback.trim() || rejectMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 bg-orange-50 text-orange-700 py-2.5 rounded-md text-sm font-medium hover:bg-orange-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <XCircle size={16} />
                  Send Remarks & Reject
                </button>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Reject with these remarks. The seller will see them on their dashboard and can fix
                  the issues to resubmit for review. For queries, sellers can contact{' '}
                  <a
                    href="mailto:support@collectorsexchange.in"
                    className="text-luxury-gold hover:underline"
                  >
                    support@collectorsexchange.in
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>

          {/* Coupon Management */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="flex items-center gap-3 mb-4">
              <Tag className="w-5 h-5 text-luxury-gold" />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">
                Product Coupon
              </h3>
            </div>

            {couponLoading ? (
              <div className="text-sm text-gray-400">Loading...</div>
            ) : coupon ? (
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      Code
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(coupon.code);
                        setSuccess('Coupon code copied!');
                        setTimeout(() => setSuccess(''), 2000);
                      }}
                      className="text-luxury-gold hover:text-luxury-gold/80"
                      title="Copy code"
                    >
                      <Copy size={14} />
                    </button>
                  </div>
                  <p className="text-lg font-bold text-heritage-charcoal tracking-wider">
                    {coupon.code}
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Percent size={12} />
                      {coupon.discountPercent}% off
                    </span>
                    {!coupon.isActive && (
                      <span className="text-red-500 font-medium">Used / Inactive</span>
                    )}
                    {coupon._count?.usages > 0 && (
                      <span className="text-orange-500">(used {coupon._count.usages} time)</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await generateCouponMutation.mutateAsync({
                          productId: id,
                          discountPercent: 10,
                        });
                        setSuccess('New coupon generated! Old one expired.');
                        setTimeout(() => setSuccess(''), 3000);
                      } catch (err) {
                        setError(getErrorMessage(err, 'Failed to generate coupon'));
                      }
                    }}
                    disabled={generateCouponMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-50 text-indigo-700 py-2 rounded-md text-sm font-medium hover:bg-indigo-100 transition-colors disabled:opacity-50"
                  >
                    <Edit3 size={14} />{' '}
                    {generateCouponMutation.isPending ? 'Generating...' : 'Regenerate'}
                  </button>
                  <button
                    onClick={async () => {
                      const confirmed = await confirm(
                        `Delete coupon "${coupon.code}"? This cannot be undone.`,
                      );
                      if (!confirmed) return;
                      try {
                        await deleteCouponMutation.mutateAsync({
                          id: coupon.id,
                          productId: coupon.productId,
                        });
                        setSuccess('Coupon deleted');
                        setTimeout(() => setSuccess(''), 3000);
                      } catch (err) {
                        setError(getErrorMessage(err, 'Failed to delete coupon'));
                      }
                    }}
                    disabled={deleteCouponMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 text-red-700 py-2 rounded-md text-sm font-medium hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    <Trash2 size={14} /> {deleteCouponMutation.isPending ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await generateCouponMutation.mutateAsync({
                      productId: id,
                      discountPercent: 10,
                    });
                    setSuccess('Coupon generated!');
                    setTimeout(() => setSuccess(''), 3000);
                  } catch (err) {
                    setError(getErrorMessage(err, 'Failed to generate coupon'));
                  }
                }}
                disabled={generateCouponMutation.isPending}
                className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 py-3 rounded-md font-medium hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <Plus size={18} />{' '}
                {generateCouponMutation.isPending ? 'Generating...' : 'Generate Coupon Code'}
              </button>
            )}
          </div>

          {/* Seller Info */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <div className="flex items-center gap-3 mb-4">
              <Package className="w-5 h-5 text-luxury-gold" />
              <h3 className="text-lg font-serif font-bold text-heritage-charcoal">
                Seller Information
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Name</dt>
                <dd className="text-sm font-bold text-heritage-charcoal mt-1">
                  {product.seller?.name || 'N/A'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Email</dt>
                <dd className="text-sm text-luxury-gold mt-1 break-all">
                  <a href={`mailto:${product.seller?.email}`}>{product.seller?.email}</a>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Phone</dt>
                <dd className="text-sm text-heritage-charcoal mt-1">
                  {product.seller?.phone ? (
                    <a href={`tel:${product.seller?.phone}`}>{product.seller?.phone}</a>
                  ) : (
                    'Not provided'
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase">Seller ID</dt>
                <dd className="text-xs text-gray-500 mt-1 font-mono">
                  {product.seller?.id || 'N/A'}
                </dd>
              </div>
            </div>
          </div>

          {/* Product Info */}
          <div className="bg-white rounded-lg shadow-heritage p-6">
            <h3 className="text-lg font-serif font-bold text-heritage-charcoal mb-4 border-b pb-2">
              Product Info
            </h3>
            <div className="space-y-4">
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Keywords</dt>
                <dd className="flex flex-wrap gap-1">
                  {product.keywords?.length > 0 ? (
                    product.keywords.map((kw, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                      >
                        {kw}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-gray-400">None</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Images</dt>
                <dd className="text-sm text-gray-700">{product.images?.length || 1} image(s)</dd>
                {product.images?.length > 0 && (
                  <div className="flex gap-1 mt-2 overflow-x-auto">
                    {product.images.slice(0, 5).map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt=""
                        className="w-12 h-12 object-cover rounded border border-gray-100 flex-shrink-0"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ))}
                    {product.images.length > 5 && (
                      <span className="w-12 h-12 flex items-center justify-center text-xs text-gray-400 bg-gray-50 rounded border border-gray-100 flex-shrink-0">
                        +{product.images.length - 5}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div>
                <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">Timeline</dt>
                <div className="space-y-2 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Created</span>
                    <span>{new Date(product.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Last Updated</span>
                    <span>{new Date(product.updatedAt).toLocaleString()}</span>
                  </div>
                  {product.reviewedAt && (
                    <div className="flex justify-between">
                      <span>Reviewed</span>
                      <span>{new Date(product.reviewedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </div>
              {product.authenticityStatus !== 'Pending' && (
                <div>
                  <dt className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Authenticity
                  </dt>
                  <dd className="text-sm">
                    <StatusBadge status={product.authenticityStatus} />
                    {product.reviewedBy && (
                      <span className="text-xs text-gray-400 ml-2">by {product.reviewedBy}</span>
                    )}
                  </dd>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            onClick={() => setLightboxIndex(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white z-10"
          >
            <XCircle size={32} />
          </button>
          <span className="absolute top-4 left-4 text-white/60 text-sm font-mono">
            {lightboxIndex + 1} / {allImages.length}
          </span>
          {lightboxIndex > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex - 1);
              }}
              className="absolute left-4 text-white/80 hover:text-white"
            >
              <ArrowLeft size={36} />
            </button>
          )}
          <img
            src={allImages[lightboxIndex]}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {lightboxIndex < allImages.length - 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(lightboxIndex + 1);
              }}
              className="absolute right-4 text-white/80 hover:text-white"
            >
              <ArrowLeft size={36} className="rotate-180" />
            </button>
          )}
        </div>
      )}

      {/* Reject Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reason for Rejection"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Please provide a specific reason for rejecting this product. This reason will be visible
            to the seller on their dashboard.
          </p>

          <textarea
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="e.g., Image quality too low, missing required details, authenticity could not be verified..."
            className="w-full h-32 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-red-500 outline-none resize-none"
          ></textarea>

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setShowRejectModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleReject}
              disabled={rejectMutation.isPending}
              className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Product"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{product.title}</strong>? This action cannot be
            undone.
          </p>
          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setShowDeleteModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="px-6 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Confirm Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Product Modal — All Fields */}
      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Product"
        size="lg"
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
            />
          </div>

          {/* Category + Condition */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              >
                {[
                  'Timepieces',
                  'Accessories',
                  'Collectibles',
                  'Antiques',
                  'Toys & Pop Culture',
                  'Jewelry',
                ].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Condition
              </label>
              <input
                type="text"
                value={editForm.condition}
                onChange={(e) => setEditForm((f) => ({ ...f, condition: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Description
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none resize-none"
            />
          </div>

          {/* Price + Quantity + Commission */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Price (₹)
              </label>
              <input
                type="number"
                min="1"
                value={editForm.price}
                onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Quantity
              </label>
              <input
                type="number"
                min="1"
                value={editForm.quantity}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    quantity: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Commission (%)
              </label>
              <input
                type="number"
                min="10"
                max="25"
                value={editForm.commissionPercent}
                onChange={(e) => setEditForm((f) => ({ ...f, commissionPercent: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              />
            </div>
          </div>

          {/* Brand + Listing Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Brand
              </label>
              {brandInputMode ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customBrand}
                    onChange={(e) => setCustomBrand(e.target.value)}
                    placeholder="Enter brand name..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                    autoFocus
                  />
                  <button
                    onClick={() => setBrandInputMode(false)}
                    className="px-3 py-2 text-xs text-gray-500 border border-gray-300 rounded-md"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select
                    value={
                      brands.includes(editForm.brand)
                        ? editForm.brand
                        : editForm.brand
                          ? '__custom__'
                          : ''
                    }
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setBrandInputMode(true);
                        setCustomBrand('');
                        setEditForm((f) => ({ ...f, brand: '' }));
                      } else {
                        setEditForm((f) => ({ ...f, brand: e.target.value }));
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                  >
                    <option value="">No brand</option>
                    {brands.filter(Boolean).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                    <option value="__custom__">+ Add New Brand...</option>
                  </select>
                  {editForm.brand && !brands.includes(editForm.brand) && (
                    <span className="text-xs text-amber-600 self-center">(custom)</span>
                  )}
                </div>
              )}
              {brandInputMode && (
                <button
                  onClick={() => {
                    setBrandInputMode(false);
                    if (customBrand.trim())
                      setEditForm((f) => ({ ...f, brand: customBrand.trim() }));
                  }}
                  className="mt-1 text-xs text-luxury-gold hover:underline font-medium"
                >
                  + Add "{customBrand || 'new brand'}"
                </button>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Listing Type
              </label>
              <select
                value={editForm.listingCategory}
                onChange={(e) => setEditForm((f) => ({ ...f, listingCategory: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
              >
                <option value="normal">Normal</option>
                <option value="featured">Featured</option>
                <option value="most_rare">Most Rare</option>
              </select>
            </div>
          </div>

          {/* Primary Image URL */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Primary Image URL
            </label>
            <input
              type="url"
              value={editForm.image}
              onChange={(e) => setEditForm((f) => ({ ...f, image: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
            />
          </div>

          {/* Additional Images */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Additional Images (one URL per line)
            </label>
            <textarea
              value={(editForm.images || []).join('\n')}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  images: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={3}
              placeholder="https://example.com/img1.jpg&#10;https://example.com/img2.jpg"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none resize-none font-mono"
            />
          </div>

          {/* Keywords */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Keywords (one per line)
            </label>
            <textarea
              value={(editForm.keywords || []).join('\n')}
              onChange={(e) =>
                setEditForm((f) => ({
                  ...f,
                  keywords: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean),
                }))
              }
              rows={2}
              placeholder="vintage&#10;watch&#10;swiss"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none resize-none font-mono"
            />
          </div>

          {/* Specs */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
              Specifications
            </label>
            {(editForm.specs || []).map((spec, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={spec.key}
                  placeholder="Key"
                  onChange={(e) => {
                    const specs = [...editForm.specs];
                    specs[idx] = { ...specs[idx], key: e.target.value };
                    setEditForm((f) => ({ ...f, specs }));
                  }}
                  className="w-1/3 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                />
                <input
                  type="text"
                  value={spec.value}
                  placeholder="Value"
                  onChange={(e) => {
                    const specs = [...editForm.specs];
                    specs[idx] = { ...specs[idx], value: e.target.value };
                    setEditForm((f) => ({ ...f, specs }));
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                />
                <button
                  onClick={() =>
                    setEditForm((f) => ({ ...f, specs: f.specs.filter((_, i) => i !== idx) }))
                  }
                  className="px-2 text-red-400 hover:text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setEditForm((f) => ({ ...f, specs: [...(f.specs || []), { key: '', value: '' }] }))
              }
              className="text-xs text-luxury-gold hover:underline font-medium"
            >
              + Add Spec
            </button>
          </div>

          {/* Competitor Pricing — overrides whatever the seller set, or fills it
              in if they left it blank. Same platform list as the public
              "Compare Elsewhere" widget; leave a platform's URL empty to skip it. */}
          {Array.isArray(comparisonPlatforms) && comparisonPlatforms.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">
                Competitor Pricing
              </label>
              <div className="space-y-2">
                {comparisonPlatforms.map((platform) => {
                  const entry = editForm.comparisons[platform.id] || { url: '', price: '' };
                  const setEntry = (patch) =>
                    setEditForm((f) => ({
                      ...f,
                      comparisons: { ...f.comparisons, [platform.id]: { ...entry, ...patch } },
                    }));
                  return (
                    <div key={platform.id} className="flex gap-2">
                      <span className="w-20 shrink-0 text-xs text-gray-500 font-medium truncate pt-2">
                        {platform.name}
                      </span>
                      <input
                        type="url"
                        value={entry.url}
                        placeholder="Listing URL"
                        onChange={(e) => setEntry({ url: e.target.value })}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={entry.price}
                        placeholder="Price"
                        onChange={(e) => setEntry({ price: e.target.value })}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-luxury-gold outline-none"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 justify-end pt-4 border-t sticky bottom-0 bg-white">
            <button
              onClick={() => setShowEditModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateProduct}
              disabled={updateProductMutation.isPending}
              className="px-6 py-2 bg-luxury-gold text-white rounded-md hover:bg-luxury-gold/90 disabled:opacity-50 font-medium transition-colors"
            >
              {updateProductMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Status Modal (Legacy/Manual) */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title="Update Authenticity Status"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            {/* `value` must be the AuthenticityStatus enum member — the backend
                rejects anything outside this list with a 400, and "Under Review"
                (with a space) is not a member. The label is the pretty form. */}
            {AUTHENTICITY_OPTIONS.map(({ value, label, note }) => (
              <label
                key={value}
                className={`flex items-start gap-3 p-3 border rounded-md cursor-pointer ${
                  selectedStatus === value
                    ? 'border-luxury-gold bg-luxury-gold/5'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={selectedStatus === value}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="accent-luxury-gold mt-0.5"
                />
                <span>
                  <span className="font-medium block">{label}</span>
                  <span className="text-xs text-gray-500">{note}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Guard the one combination that leaves the storefront inconsistent:
              a listing that is still live and flagged Verified, but whose
              authenticity has been walked back to Pending/Under Review. */}
          {product.isPublished &&
            (selectedStatus === 'Pending' || selectedStatus === 'Under_Review') && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded p-3">
                This listing is currently live on the storefront. Setting authenticity back to{' '}
                <strong>
                  {AUTHENTICITY_OPTIONS.find((o) => o.value === selectedStatus)?.label}
                </strong>{' '}
                does not unpublish it — it will stay public while showing as unverified. Use{' '}
                <strong>Reject Product</strong> if you want it taken down.
              </div>
            )}

          <div className="flex gap-3 justify-end pt-4">
            <button
              onClick={() => setShowStatusModal(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateAuthStatus}
              disabled={updateStatusMutation.isPending}
              className="px-6 py-2 bg-luxury-gold text-white rounded-md hover:bg-luxury-gold/90 disabled:opacity-50"
            >
              {updateStatusMutation.isPending ? 'Updating...' : 'Update Status'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manual Order Modal */}
      <ManualOrderModal
        key={showManualOrderModal ? `${product.id}-${isBackfill}` : 'closed'}
        isOpen={showManualOrderModal}
        onClose={() => setShowManualOrderModal(false)}
        product={product}
        isBackfill={isBackfill}
        onSubmit={handleManualOrder}
        isPending={createManualOrderMutation.isPending}
      />
    </div>
  );
}

export default ProductDetail;

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import SEO from '../components/SEO';
import {
  User,
  Package,
  LogOut,
  Plus,
  ShieldCheck,
  Trash2,
  Tag,
  Info,
  Loader2,
  ShoppingBag,
  Store,
  BarChart3,
  Eye,
  Edit3,
  Download,
  XCircle,
  Bell,
  X,
  Mail,
  Upload,
  Image as ImageIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MapPin,
  CreditCard,
  Truck,
  HelpCircle,
  Wallet,
} from 'lucide-react';
import CommissionSlider from '../components/account/CommissionSlider';
import { LoginVisualPanel, LoginVisualBand } from '../components/account/LoginVisual';
import BrandCombobox from '../components/BrandCombobox';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Papa from 'papaparse';
import { getUser, setUser as setLocalUser, clearUser } from '../utils/storage';
import { useMe, useRegisterUser, useSubmitKyc, useUpdateProfile } from '../hooks/api/useUser';
import {
  useAddProduct,
  useDeleteProduct,
  useAddBulkProducts,
  useUpdateProduct,
  useMarkAsSold,
} from '../hooks/api/useProducts';
import { useMyOrders } from '../hooks/api/useOrders';
import { supabase } from '../utils/supabase';
import { uploadProductImage, uploadKycDocument, uploadTestimonialImage } from '../utils/storage';
import { resolveKycDocumentHref } from '../utils/kycDocuments';
import apiClient from '../hooks/api/apiClient';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { useVendorProfile, useVendorStats } from '../hooks/api/useVendor';
import { useSubmitTestimonial } from '../hooks/api/useTestimonials';
import { useNotifications } from '../hooks/api/useNotifications';
import PhoneVerification from '../components/account/PhoneVerification';
import NotificationsPanel from '../components/account/NotificationsPanel';
import DocUploadField from '../components/account/DocUploadField';
import ReviewForm from '../components/ReviewForm';
import ReviewList from '../components/ReviewList';
import { Reveal, CountUp } from '../components/Motion';
import { imageUrl } from '../utils/image';
import { mailtoHref } from '../config/contact';

const CATEGORIES = [
  'Timepieces',
  'Accessories',
  'Collectibles',
  'Antiques',
  'Toys & Pop Culture',
  'Jewelry',
];
const CONDITIONS = ['Mint', 'Like New', 'Excellent', 'Good', 'Fair'];
// A hard-coded `WhatsAppNumber = '+916362771355'` used to sit here. It was a
// second, stale public number that no code on this page ever read — the only
// harm it could do was be copied into a new call site. The single public number
// (and every href built from it) now lives in src/config/contact.js; import
// SUPPORT_PHONE_* / whatsAppHref from there if this page ever needs it.

// A listing only occupies one of a single seller's slots while it is awaiting or
// holding a live spot in the catalogue. Sold and Rejected listings free the slot.
// Mirrors the `status: { in: [...] }` filter used by backend/routes/products.js
// (create) and backend/routes/vendor.js (`activeCount`).
const ACTIVE_LISTING_STATUSES = ['Pending', 'In_Review', 'Approved'];

// The account sections are addressable as /account?tab=<id>. Only ids listed here
// are honoured from the URL — anything else (including the legacy, contentless
// 'payouts' section) falls back to DEFAULT_TAB rather than rendering an empty view.
const TAB_IDS = ['profile', 'seller', 'listings', 'orders', 'notifications'];
const DEFAULT_TAB = 'profile';

// ---------------------------------------------------------------------------
// Order history
//
// The courier is the same one the backend already names in its "on its way"
// notification (backend/routes/admin.js) and the same URL shape the admin order
// screen links to — this is the buyer-facing half of a link that already existed
// everywhere except the place the buyer actually looks.
// ---------------------------------------------------------------------------

const TRACKING_BASE = String(
  import.meta.env?.VITE_TRACKING_URL || 'https://www.delhivery.com',
).replace(/\/+$/, '');
const COURIER_NAME = import.meta.env?.VITE_COURIER_NAME || 'Delhivery';

const trackingHref = (trackingID) =>
  `${TRACKING_BASE}/track/package/${encodeURIComponent(trackingID)}`;

// Neutral heritage-beige tile, same approach as Cart.jsx: inline SVG rather than
// a via.placeholder.com round-trip that leaks the page view to a third party and
// shows a broken image whenever that host is slow or blocked.
const ORDER_IMAGE_PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23f5f0e8'/%3E%3C/svg%3E";

const ORDER_STEPS = ['Placed', 'Processing', 'Shipped', 'Delivered'];

// How far along the four steps each backend OrderStatus sits. 'Pending' is
// Placed: the order exists and nothing has happened to it yet. 'Cancelled' has
// no position on this line and is rendered separately.
const ORDER_STEP_INDEX = { Pending: 0, Processing: 1, Shipped: 2, Delivered: 3 };

const PAYMENT_METHOD_LABEL = {
  cod: 'Cash on delivery',
  online: 'Paid online',
  card: 'Card',
  upi: 'UPI',
  bank_transfer: 'Bank transfer',
};

// Money is still owed on a COD order until it is actually collected, and it
// stops being owed the moment the order is cancelled.
const codAmountDue = (order) =>
  order?.paymentMethod === 'cod' &&
  order?.paymentStatus !== 'Paid' &&
  order?.paymentStatus !== 'Refunded' &&
  order?.status !== 'Cancelled'
    ? order.totalAmount
    : null;

const OrderTimeline = ({ status }) => {
  if (status === 'Cancelled') {
    return (
      <p className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-100 px-3 py-2 rounded-lg">
        <XCircle size={14} className="shrink-0" aria-hidden="true" />
        This order was cancelled. Any payment taken has been refunded.
      </p>
    );
  }

  const current = ORDER_STEP_INDEX[status] ?? 0;

  return (
    <ol className="flex items-start" aria-label="Order progress">
      {ORDER_STEPS.map((step, i) => {
        const done = i <= current;
        return (
          <li
            key={step}
            className="flex-1 flex flex-col items-center text-center relative"
            aria-current={i === current ? 'step' : undefined}
          >
            {/* Connector, drawn behind the dot and only between steps. */}
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`absolute top-[5px] right-1/2 w-full h-px ${
                  done ? 'bg-luxury-gold' : 'bg-gray-200'
                }`}
              />
            )}
            <span
              aria-hidden="true"
              className={`relative z-10 w-[11px] h-[11px] rounded-full border-2 ${
                done ? 'bg-luxury-gold border-luxury-gold' : 'bg-white border-gray-300'
              }`}
            />
            <span
              className={`mt-1.5 text-[10px] uppercase tracking-wider ${
                done ? 'text-heritage-charcoal font-semibold' : 'text-gray-500'
              }`}
            >
              {step}
            </span>
            <span className="sr-only">{done ? ' — done' : ' — not yet'}</span>
          </li>
        );
      })}
    </ol>
  );
};

const Account = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  // A recognised ?tab drives the section; anything else resolves to the default.
  const activeTab = TAB_IDS.includes(tabParam) ? tabParam : DEFAULT_TAB;
  // On mobile the section list is an index: a section is only drilled into once
  // the URL explicitly names a valid one. Desktop always shows a section.
  const sectionOpen = TAB_IDS.includes(tabParam);

  // Both replace (not push) the history entry: the mobile index<->section
  // drill-down and every tab switch collapse into a single history slot, so
  // one browser/gesture back always leaves Account in one step — matching
  // the in-page back chevron — instead of stepping back through every tab
  // visited along the way.
  const setActiveTab = useCallback(
    (tabId) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.set('tab', tabId);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const closeSection = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('tab');
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  // The global ScrollToTop only keys on pathname, so section changes (which are
  // search-param changes) would otherwise keep the previous scroll offset.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tabParam]);
  const [localUser, setLocalUserState] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ password: '', confirm: '' });
  const [showCompanyPopup, setShowCompanyPopup] = useState(false);
  const [kycForm, setKycForm] = useState({
    aadhaar: '',
    pan: '',
    companyName: '',
    gst: '',
    founderName: '',
    aadhaarDoc: '',
    panDoc: '',
    gstDoc: '',
    incorporationDoc: '',
    signedByName: '',
  });
  const [tncAccepted, setTncAccepted] = useState(false);
  const [productForm, setProductForm] = useState({
    title: '',
    category: CATEGORIES[0],
    brand: '',
    description: '',
    condition: 'Good',
    price: '',
    imageUrls: [''],
    keywords: '',
    specs: [{ key: '', value: '' }],
    commissionPercent: 10,
  });
  const descRef = useRef(null);

  const insertMarkdown = (before, after = '') => {
    const textarea = descRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    const newText =
      textarea.value.substring(0, start) +
      before +
      selected +
      after +
      textarea.value.substring(end);
    setProductForm({ ...productForm, description: newText });
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    }, 0);
  };

  const toolbarItems = [
    { label: 'B', action: () => insertMarkdown('**', '**'), title: 'Bold' },
    { label: 'I', action: () => insertMarkdown('*', '*'), title: 'Italic' },
    { label: 'H', action: () => insertMarkdown('## ', ''), title: 'Heading' },
    {
      label: (
        <span role="img" aria-label="Bullet List">
          •
        </span>
      ),
      action: () => insertMarkdown('- ', ''),
      title: 'Bullet List',
    },
    { label: '1.', action: () => insertMarkdown('1. ', ''), title: 'Numbered List' },
    {
      label: (
        <span role="img" aria-label="Link">
          🔗
        </span>
      ),
      action: () => insertMarkdown('[', '](url)'),
      title: 'Link',
    },
    {
      label: (
        <span role="img" aria-label="Quote">
          ❝
        </span>
      ),
      action: () => insertMarkdown('> ', ''),
      title: 'Quote',
    },
  ];

  // API Hooks
  const queryClient = useQueryClient();
  const [descPreview, setDescPreview] = useState(false);
  const { data: userQuery } = useMe();
  const user = userQuery || localUser;
  const { data: vendorProfile } = useVendorProfile();
  // /vendor/stats 404s without a vendor profile, so only ask once we know there is one.
  const { data: vendorStats } = useVendorStats({ enabled: Boolean(vendorProfile) });

  // An admin rejection resets kycStatus to 'none' but keeps the submitted kycData
  // (see the reject handler in backend/routes/admin.js), so the presence of a
  // rejectionReason on a 'none' status is what marks a seller as rejected rather
  // than never-applied.
  const kycRejection =
    user?.kycStatus === 'none' && user?.kycData?.rejectionReason ? user.kycData : null;

  // Prefill the KYC form from whatever was already submitted, so a rejected seller
  // sees their previous entries and their already-uploaded documents (DocUploadField
  // renders an uploaded state from `docUrl`) and only has to replace the failing one.
  // Runs once; never clobbers edits in progress.
  const kycPrefilled = useRef(false);
  useEffect(() => {
    const kycData = user?.kycData;
    if (kycPrefilled.current || !kycData || typeof kycData !== 'object') return;
    if (user?.kycStatus === 'verified') return;
    kycPrefilled.current = true;
    setKycForm((prev) => ({
      ...prev,
      aadhaar: kycData.aadhaar || prev.aadhaar,
      pan: kycData.pan || prev.pan,
      companyName: kycData.companyName || prev.companyName,
      gst: kycData.gst || prev.gst,
      founderName: kycData.founderName || prev.founderName,
      aadhaarDoc: kycData.aadhaarDoc || prev.aadhaarDoc,
      panDoc: kycData.panDoc || prev.panDoc,
      gstDoc: kycData.gstDoc || prev.gstDoc,
      incorporationDoc: kycData.incorporationDoc || prev.incorporationDoc,
      signedByName: kycData.agreementSignedByName || prev.signedByName,
    }));
  }, [user?.kycData, user?.kycStatus]);
  const submitTestimonial = useSubmitTestimonial();
  const [testimonialForm, setTestimonialForm] = useState({
    content: '',
    authorName: '',
    rating: 5,
    images: [],
  });
  const [testimonialSubmitted, setTestimonialSubmitted] = useState(false);
  const [testimonialImageUploading, setTestimonialImageUploading] = useState(false);
  const [reviewingItem, setReviewingItem] = useState(null);
  const { mutateAsync: registerUser } = useRegisterUser();
  const kycMutation = useSubmitKyc();
  const addProductMutation = useAddProduct();
  const deleteProductMutation = useDeleteProduct();
  const bulkAddProductsMutation = useAddBulkProducts();
  const markAsSoldMutation = useMarkAsSold();
  const [bulkResults, setBulkResults] = useState(null);
  const { data: myOrders = [], isLoading: ordersLoading } = useMyOrders();
  // Shares the ['notifications'] cache with NotificationsPanel, so this is a read
  // of the same polled query rather than a second request.
  const { data: notifications = [] } = useNotifications(!!user);
  const unreadCount = notifications.filter((n) => !n.read).length;
  const showToast = useToast();
  const [editingProfile, setEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ name: '', phone: '' });
  const updateProfileMutation = useUpdateProfile();
  const updateProductMutation = useUpdateProduct();
  const [editingProductId, setEditingProductId] = useState(null);
  const [editProductForm, setEditProductForm] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    category: '',
    brand: '',
    keywords: '',
    image: '',
    images: [],
    commissionPercent: 10,
  });

  // Pickup address state
  const [editingPickup, setEditingPickup] = useState(false);
  const [pickupSaving, setPickupSaving] = useState(false);
  const [pickupForm, setPickupForm] = useState({
    pickupAddress: '',
    pickupCity: '',
    pickupState: '',
    pickupZip: '',
    pickupContactName: '',
    pickupPhone: '',
  });

  const welcomeShown = useRef(false);

  const handlePickupSubmit = async (e) => {
    e.preventDefault();
    setPickupSaving(true);
    try {
      await apiClient.patch('/vendor/pickup-address', pickupForm);
      showToast('Pickup address saved successfully!', 'success');
      setEditingPickup(false);
      queryClient.invalidateQueries({ queryKey: ['vendor', 'profile'] });
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to save pickup address.', 'error');
    } finally {
      setPickupSaving(false);
    }
  };

  const handleAuthChange = useCallback(
    async (session) => {
      if (session) {
        try {
          const syncData = {
            email: session.user.email,
            name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
            supabaseId: session.user.id,
            phone: session.user.phone || undefined,
            type: 'individual',
          };
          let user;
          try {
            user = await registerUser(syncData);
          } catch (err) {
            console.error('Backend sync failed (server may be waking up), using cached data', err);
            const cached = getUser();
            if (cached) {
              user = cached;
            } else {
              throw err;
            }
          }
          setLocalUser(user);
          setLocalUserState(user);
          queryClient.invalidateQueries({ queryKey: ['user'] });
          if (!welcomeShown.current) {
            welcomeShown.current = true;
            showToast('Welcome back!', 'success');
          }
        } catch (error) {
          console.error('Auth sync failed', error);
          showToast('Could not reach the server. Please refresh the page to retry.', 'error');
        }
      } else {
        setLocalUserState(null);
        clearUser();
      }
    },
    [registerUser, queryClient, showToast],
  );

  useEffect(() => {
    // Initial session check
    const checkSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const storedUser = getUser();
      if (storedUser) setLocalUserState(storedUser);
      // Await the sync so we don't flip to "checked" (and briefly render the login
      // screen) while a valid session's user is still being resolved.
      if (session) {
        await handleAuthChange(session);
      }
      setSessionChecked(true);
    };

    checkSession();

    // Auth listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      handleAuthChange(session);
    });

    return () => subscription.unsubscribe();
  }, [handleAuthChange]);

  // Populate pickup form when vendor profile loads
  useEffect(() => {
    if (vendorProfile) {
      setPickupForm({
        pickupAddress: vendorProfile.pickupAddress || '',
        pickupCity: vendorProfile.pickupCity || '',
        pickupState: vendorProfile.pickupState || '',
        pickupZip: vendorProfile.pickupZip || '',
        pickupContactName: vendorProfile.pickupContactName || '',
        pickupPhone: vendorProfile.pickupPhone || '',
      });
    }
  }, [vendorProfile]);

  const handleGoogleLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/account',
      },
    });
    if (error) {
      showToast(error.message, 'error');
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
    }
  };

  const userProducts = user?.products || [];

  // Slot accounting. `activeCount` from /vendor/profile is authoritative; the local
  // filter is the identical rule and only covers the window before that request
  // resolves. Both the submit guard and the usage bar must read these, never
  // `userProducts.length` (which includes Sold and Rejected items).
  const maxListings = vendorProfile?.maxListings || 5;
  const activeListingCount =
    vendorProfile?.activeCount ??
    userProducts.filter((p) => ACTIVE_LISTING_STATUSES.includes(p.status)).length;

  // Listings the seller marked Sold themselves (no order behind them). Anything
  // Sold that is NOT in this set was bought by a real buyer.
  const offlineSoldIds = useMemo(
    () => new Set(vendorProfile?.offlineSoldIds || []),
    [vendorProfile?.offlineSoldIds],
  );

  // Single source of truth for the section navigation — consumed by the mobile
  // index list, the mobile section header and the desktop sidebar alike.
  const isVerifiedSeller = user?.kycStatus === 'verified';
  const sections = useMemo(
    () => [
      {
        id: 'profile',
        label: 'Profile',
        icon: User,
        hint: 'Your name, contact details and membership',
      },
      {
        id: 'seller',
        label: isVerifiedSeller ? 'Seller Profile' : 'Seller Registration',
        icon: Store,
        hint: isVerifiedSeller
          ? 'Verification status and pickup address'
          : 'Verify your identity to start listing',
      },
      {
        id: 'listings',
        label: 'Listings',
        icon: Package,
        hint: userProducts.length
          ? `${userProducts.length} item${userProducts.length === 1 ? '' : 's'} brokered`
          : 'List an item on The Exchange',
      },
      {
        id: 'orders',
        label: 'My Orders',
        icon: ShoppingBag,
        hint: myOrders.length
          ? `${myOrders.length} order${myOrders.length === 1 ? '' : 's'} placed`
          : 'Track your purchases and shipments',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        icon: Bell,
        hint: unreadCount ? `${unreadCount} unread` : 'Account and listing updates',
        badge: unreadCount,
      },
    ],
    [isVerifiedSeller, userProducts.length, myOrders.length, unreadCount],
  );

  const activeSection = sections.find((s) => s.id === activeTab);

  const handleSetPassword = async (e) => {
    e.preventDefault();
    if (passwordForm.password !== passwordForm.confirm) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    if (passwordForm.password.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return;
    }
    if (!/[A-Z]/.test(passwordForm.password)) {
      showToast('Password must contain at least one uppercase letter.', 'error');
      return;
    }
    if (!/[a-z]/.test(passwordForm.password)) {
      showToast('Password must contain at least one lowercase letter.', 'error');
      return;
    }
    if (!/[0-9]/.test(passwordForm.password)) {
      showToast('Password must contain at least one number.', 'error');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.password });
      if (error) throw error;
      showToast('Password set successfully!', 'success');
      setShowPasswordSetup(false);
      setPasswordForm({ password: '', confirm: '' });
    } catch (err) {
      showToast(err.message || 'Failed to set password.', 'error');
    }
  };

  const handleKycSubmit = async (e) => {
    e.preventDefault();
    const base =
      user.type === 'individual'
        ? {
            aadhaar: kycForm.aadhaar,
            pan: kycForm.pan,
            aadhaarDoc: kycForm.aadhaarDoc,
            panDoc: kycForm.panDoc,
          }
        : {
            companyName: kycForm.companyName,
            gst: kycForm.gst,
            founderName: kycForm.founderName,
            aadhaarDoc: kycForm.aadhaarDoc,
            panDoc: kycForm.panDoc,
            gstDoc: kycForm.gstDoc,
            incorporationDoc: kycForm.incorporationDoc,
          };

    if (!tncAccepted) {
      showToast('Please accept the Terms & Conditions.', 'error');
      return;
    }

    const kycData = {
      ...base,
      agreementAccepted: true,
      agreementAcceptedAt: new Date().toISOString(),
    };

    try {
      await kycMutation.mutateAsync({ kycData });
      showToast('Verification documents submitted successfully!', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error || 'KYC submission failed.', 'error');
    }
  };

  const handleKycDocUpload = async (docType, file) => {
    if (!file) return;
    setKycDocUploading((prev) => ({ ...prev, [docType]: true }));
    try {
      // Returns a PRIVATE storage path (`kyc/<uid>/<uuid>.<ext>`), not a URL.
      // That path is what gets persisted in kycData; only an admin can exchange
      // it for a short-lived signed URL.
      const storagePath = await uploadKycDocument(file, docType);
      const fieldMap = {
        aadhaar: 'aadhaarDoc',
        pan: 'panDoc',
        gst: 'gstDoc',
        incorporation: 'incorporationDoc',
      };
      setKycForm((prev) => ({ ...prev, [fieldMap[docType]]: storagePath }));
      showToast(
        `${docType.charAt(0).toUpperCase() + docType.slice(1)} document uploaded successfully`,
        'success',
      );
    } catch (err) {
      console.error('KYC doc upload failed:', err);
      showToast(`Failed to upload ${docType} document. Please try again.`, 'error');
    } finally {
      setKycDocUploading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const handlePhoneVerified = (newPhone) => {
    setLocalUser((prev) => ({ ...prev, phone: newPhone, phoneVerificationStatus: 'pending' }));
    setLocalUserState((prev) => ({ ...prev, phone: newPhone, phoneVerificationStatus: 'pending' }));
  };

  // Image URL handling
  const [imageUploading, setImageUploading] = useState(false);
  const [kycDocUploading, setKycDocUploading] = useState({
    aadhaar: false,
    pan: false,
    gst: false,
    incorporation: false,
  });

  const handleImageUrlChange = (index, value) => {
    const newUrls = [...productForm.imageUrls];
    newUrls[index] = value;
    setProductForm({ ...productForm, imageUrls: newUrls });
  };

  const addImageField = () => {
    if (productForm.imageUrls.length < 10) {
      setProductForm({ ...productForm, imageUrls: [...productForm.imageUrls, ''] });
    }
  };

  const removeImageField = (index) => {
    const newUrls = productForm.imageUrls.filter((_, i) => i !== index);
    setProductForm({ ...productForm, imageUrls: newUrls });
  };

  const handleFileUpload = async (index, file) => {
    if (!file) return;
    setImageUploading(true);
    try {
      const url = await uploadProductImage(file);
      handleImageUrlChange(index, url);
    } catch (err) {
      console.error('Upload failed:', err);
      showToast('Failed to upload image. Please try again or use a URL directly.', 'error');
    } finally {
      setImageUploading(false);
    }
  };

  const handleMultipleFileUpload = async (files) => {
    if (!files?.length) return;
    setImageUploading(true);
    const fileArray = Array.from(files);
    const urls = [...productForm.imageUrls];

    try {
      const results = await Promise.allSettled(fileArray.map((file) => uploadProductImage(file)));

      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          const emptyIndex = urls.findIndex((u) => u.trim() === '');
          if (emptyIndex !== -1) {
            urls[emptyIndex] = result.value;
          } else if (urls.length < 10) {
            urls.push(result.value);
          }
        }
      }

      setProductForm({ ...productForm, imageUrls: urls });

      const failedCount = results.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        showToast(`${results.length - failedCount} uploaded, ${failedCount} failed.`, 'error');
      }
    } catch {
      showToast('Failed to upload images.', 'error');
    } finally {
      setImageUploading(false);
    }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();

    // 1. Validate User Type Limit. Only ACTIVE listings occupy a slot — a Sold or
    // Rejected item does not, which is exactly how the backend counts
    // (backend/routes/products.js). Counting every product ever created locked
    // out sellers who had successfully sold their allowance.
    if (vendorProfile?.type !== 'BULK' && activeListingCount >= maxListings) {
      showToast(
        `You already have ${activeListingCount} active listing${
          activeListingCount === 1 ? '' : 's'
        }, the maximum for a single seller. Sell or remove one to list something new.`,
        'error',
      );
      return;
    }

    // 2. Validate Images (Min 4)
    const validImages = productForm.imageUrls.filter((url) => url.trim() !== '');
    if (validImages.length < 4) {
      showToast('Please provide at least 4 high-quality images of the item.', 'error');
      return;
    }

    // 3. Process Keywords
    const keywordsArray = productForm.keywords
      .split(',')
      .map((k) => k.trim())
      .filter((k) => k !== '');
    if (keywordsArray.length === 0) {
      showToast('Please provide at least one keyword for categorization.', 'error');
      return;
    }

    try {
      await addProductMutation.mutateAsync({
        title: productForm.title,
        category: productForm.category,
        // Brand is optional (unbranded collectibles are common) — omit rather than
        // send an empty string so the column stays null for those listings.
        brand: productForm.brand.trim() || undefined,
        description: productForm.description,
        condition: productForm.condition,
        price: parseFloat(productForm.price),
        sellerId: user.id,
        images: validImages,
        image: validImages[0],
        keywords: keywordsArray,
        specs: productForm.specs.filter((s) => s.key.trim() !== '' && s.value.trim() !== ''),
        commissionPercent: productForm.commissionPercent,
      });

      setProductForm({
        title: '',
        category: CATEGORIES[0],
        brand: '',
        description: '',
        condition: 'Good',
        price: '',
        imageUrls: [''],
        keywords: '',
        specs: [{ key: '', value: '' }],
        commissionPercent: 10,
      });
      showToast(
        'Listing submitted for review. We will notify you as soon as it goes live in The Exchange.',
        'success',
      );
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to list product.', 'error');
    }
  };

  const handleBulkCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        if (results.errors.length > 0) {
          showToast('CSV parsing error. Check your file format.', 'error');
          return;
        }
        try {
          const res = await bulkAddProductsMutation.mutateAsync(results.data);
          setBulkResults(res);
          queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
          if (res.created > 0) {
            showToast(`${res.created} products created successfully!`, 'success');
          }
        } catch (err) {
          showToast(err?.response?.data?.error || 'Bulk upload failed.', 'error');
        }
      },
      error: () => {
        showToast('Failed to read CSV file.', 'error');
      },
    });
    e.target.value = '';
  };

  const handleDownloadCsvTemplate = () => {
    const headers = [
      'title',
      'category',
      'description',
      'condition',
      'price',
      'image',
      'keywords',
      'commissionPercent',
    ];
    const sampleRow = [
      'Example Item',
      'Timepieces',
      'A detailed description of the item.',
      'Excellent',
      '999',
      'https://example.com/image.jpg',
      'vintage, luxury, rare',
      '15',
    ];
    const csv = Papa.unparse({ fields: headers, data: [sampleRow] });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tce-bulk-upload-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportPortfolioCsv = () => {
    const headers = [
      'title',
      'category',
      'description',
      'condition',
      'price',
      'status',
      'authenticityStatus',
      'keywords',
      'image',
    ];
    const data = userProducts.map((p) => ({
      title: p.title,
      category: p.category,
      description: p.description?.replace(/"/g, '""'),
      condition: p.condition,
      price: p.price || 0,
      status: p.status || 'Pending',
      authenticityStatus: p.authenticityStatus || 'Pending',
      keywords: (p.keywords || []).join(', '),
      image: p.image || '',
    }));
    const csv = Papa.unparse({ fields: headers, data });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-portfolio-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const confirm = useConfirm();
  const handleMarkAsSold = async (productId) => {
    if (
      !(await confirm(
        'Are you sure you want to mark this item as sold? This will unpublish the listing.',
      ))
    )
      return;
    try {
      await markAsSoldMutation.mutateAsync(productId);
      showToast('Item marked as sold.', 'success');
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to mark item as sold.', 'error');
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!(await confirm('Are you sure you want to delete this listing?'))) return;
    try {
      await deleteProductMutation.mutateAsync(productId);
      showToast('Product deleted.', 'success');
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to delete product.', 'error');
    }
  };

  const handleStartEdit = (product) => {
    setEditingProductId(product.id);
    setEditProductForm({
      title: product.title || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      condition: product.condition || '',
      category: product.category || '',
      brand: product.brand || '',
      keywords: (product.keywords || []).join(', '),
      image: product.image || '',
      images: product.images || [],
      commissionPercent: product.commissionPercent ?? 10,
    });
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditProductForm({
      title: '',
      description: '',
      price: '',
      condition: '',
      category: '',
      brand: '',
      keywords: '',
      image: '',
      images: [],
    });
  };

  const handleSaveEdit = async (productId) => {
    try {
      await updateProductMutation.mutateAsync({
        id: productId,
        productData: {
          title: editProductForm.title,
          description: editProductForm.description,
          price: parseFloat(editProductForm.price),
          condition: editProductForm.condition,
          category: editProductForm.category,
          // Optional. A cleared brand must be sent explicitly as null (the schema is
          // nullable) so it is unset — omitting the key would leave the old value in
          // place, since this is a partial update.
          brand: editProductForm.brand.trim() || null,
          keywords: editProductForm.keywords
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean),
          image: editProductForm.image || undefined,
          images: editProductForm.images.length > 0 ? editProductForm.images : undefined,
          commissionPercent: editProductForm.commissionPercent,
        },
      });
      showToast('Product updated! It will be re-reviewed.', 'success');
      handleCancelEdit();
      queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
    } catch (err) {
      showToast(err?.response?.data?.error || 'Failed to update product.', 'error');
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    clearUser();
    setLocalUserState(null);
    // Drop ?tab so a later sign-in lands on a clean /account (which resolves to
    // the default section anyway) rather than resuming the last one.
    closeSection();
  };

  if (!sessionChecked) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-secondary-bg">
        <SEO
          title="My Account"
          description="Manage your profile, orders, and seller account on The Collectors Exchange."
          canonical="/account"
          noindex
        />
        <Loader2 className="animate-spin text-luxury-gold mb-4" size={64} />
        <p className="text-gray-500 font-serif text-xl italic">Authenticating Profile...</p>
      </div>
    );
  }

  if (!localUser) {
    return (
      <div className="container mx-auto py-12 sm:py-16 lg:py-20 px-4 sm:px-6 max-w-4xl">
        <SEO
          title="My Account"
          description="Manage your profile, orders, and seller account on The Collectors Exchange."
          canonical="/account"
          noindex
        />

        <Reveal
          as="div"
          direction="up"
          className="grid lg:grid-cols-2 rounded-2xl overflow-hidden shadow-heritage border border-gray-100 bg-white"
        >
          <LoginVisualPanel />
          <LoginVisualBand />

          <div className="p-6 sm:p-10 lg:p-12 flex flex-col justify-center">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif mb-3">Welcome Back</h1>
            <p className="text-gray-500 font-light mb-8">
              Sign in to The Collectors' Exchange secure portal.
            </p>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl py-3.5 sm:py-4 text-sm sm:text-base font-medium hover:bg-gray-50 transition-colors"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
              Continue with Google
            </button>

            <p className="mt-8 flex items-center justify-center gap-2 text-[11px] text-gray-500 uppercase tracking-[0.15em]">
              <ShieldCheck size={14} className="text-luxury-gold" aria-hidden="true" />
              Secure sign-in &middot; Verified marketplace
            </p>
          </div>
        </Reveal>

        {/* Company Registration Popup */}
        {showCompanyPopup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6 animate-in fade-in duration-200">
            <div className="bg-white p-8 max-w-md w-full rounded-2xl shadow-2xl border border-gray-100 relative">
              <button
                onClick={() => setShowCompanyPopup(false)}
                className="absolute top-4 right-4 text-gray-500 hover:text-black transition-colors"
              >
                <X size={20} />
              </button>
              <div className="text-center">
                <div className="w-12 h-12 bg-luxury-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Info size={24} className="text-luxury-gold" />
                </div>
                <h3 className="font-serif text-base sm:text-xl mb-3 text-heritage-charcoal">
                  Company Registration
                </h3>
                <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                  To register as a company please connect with us on the following email. We will
                  get back to you within the next 2 working days.
                </p>
                <a
                  href="mailto:support@thecollectorsexchange.in"
                  className="flex items-center justify-center w-full bg-black text-white rounded-full py-3 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors gap-2"
                >
                  <Mail size={16} />
                  support@thecollectorsexchange.in
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return (
          <div className="bg-white p-4 sm:p-10 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-6 sm:mb-8">
              <h3 className="text-lg sm:text-2xl font-serif text-heritage-charcoal">
                Collector Profile
              </h3>
              <button
                onClick={() => {
                  if (editingProfile) {
                    setEditingProfile(false);
                    setEditProfileForm({ name: '', phone: '' });
                  } else {
                    setEditProfileForm({ name: user.name || '', phone: user.phone || '' });
                    setEditingProfile(true);
                  }
                }}
                className="text-sm text-luxury-gold hover:underline font-medium uppercase tracking-wider self-start"
              >
                {editingProfile ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
            {editingProfile ? (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  try {
                    const updatedUser = await updateProfileMutation.mutateAsync(editProfileForm);
                    setLocalUser(updatedUser);
                    setLocalUserState(updatedUser);
                    showToast('Profile updated successfully!', 'success');
                    setEditingProfile(false);
                  } catch {
                    showToast('Failed to update profile.', 'error');
                  }
                }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8"
              >
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={editProfileForm.name}
                    onChange={(e) =>
                      setEditProfileForm({ ...editProfileForm, name: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Email
                  </label>
                  <div className="p-4 bg-gray-100 border border-gray-200 text-gray-500 cursor-not-allowed">
                    {user.email}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editProfileForm.phone}
                    onChange={(e) =>
                      setEditProfileForm({ ...editProfileForm, phone: e.target.value })
                    }
                    className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={updateProfileMutation.isPending}
                    className="bg-heritage-charcoal text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full text-sm uppercase tracking-widest hover:bg-heritage-brown transition-colors flex items-center gap-2"
                  >
                    {updateProfileMutation.isPending && (
                      <Loader2 size={16} className="animate-spin" />
                    )}
                    Save Changes
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Full Name
                  </label>
                  <div className="p-4 bg-gray-50 border border-gray-100 text-gray-800 font-serif">
                    {user.name}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Email Address
                  </label>
                  <div className="p-4 bg-gray-50 border border-gray-100 text-gray-800">
                    {user.email}
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Phone
                  </label>
                  {user.phone ? (
                    <div
                      className={`p-4 border flex justify-between items-center ${user.phoneVerificationStatus === 'verified' ? 'bg-green-50 border-green-100 text-green-800' : user.phoneVerificationStatus === 'pending' ? 'bg-amber-50 border-amber-200 text-amber-800' : user.phoneVerificationStatus === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-gray-50 border-gray-100 text-gray-800'}`}
                    >
                      <span>{user.phone}</span>
                      <span className="text-xs uppercase tracking-widest font-bold flex items-center gap-1">
                        {user.phoneVerificationStatus === 'verified' ? (
                          <>
                            <ShieldCheck size={14} /> Verified
                          </>
                        ) : user.phoneVerificationStatus === 'pending' ? (
                          <>Pending Verification</>
                        ) : user.phoneVerificationStatus === 'rejected' ? (
                          <>Rejected</>
                        ) : (
                          <ShieldCheck size={14} />
                        )}
                      </span>
                    </div>
                  ) : (
                    <PhoneVerification onVerified={handlePhoneVerified} />
                  )}
                </div>
                <div>
                  <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                    Membership Type
                  </label>
                  <div className="p-4 bg-gray-50 border border-gray-100 text-gray-800 capitalize flex items-center gap-2">
                    {user.type}
                    {user.kycStatus === 'verified' && (
                      <ShieldCheck size={16} className="text-luxury-gold" />
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'seller':
        return (
          <div className="bg-white p-4 sm:p-10 rounded-2xl shadow-sm border border-gray-100">
            <h3 className="text-lg sm:text-2xl font-serif mb-6 sm:mb-8 text-heritage-charcoal">
              {user.kycStatus === 'verified' ? 'Seller Profile' : 'Seller Registration'}
            </h3>

            {user.kycStatus === 'verified' ? (
              <>
                <div className="bg-green-50 text-green-800 p-6 border border-green-100 flex items-start gap-4 mb-8">
                  <ShieldCheck size={32} className="text-green-600 mt-1" />
                  <div>
                    <h4 className="font-serif text-base sm:text-lg font-medium mb-1">
                      Verified Status: Active
                    </h4>
                    <p className="text-sm opacity-80">
                      Your identity has been verified. You have full access to list items on The
                      Exchange.
                    </p>
                  </div>
                </div>

                {/* Pickup Address */}
                <div className="border-t border-gray-100 pt-8">
                  <h4 className="font-serif text-base sm:text-xl mb-2 text-heritage-charcoal">
                    Pickup Address
                  </h4>
                  <p className="text-sm text-gray-500 mb-6">
                    This address will be used by our delivery partner to collect items for shipping
                    to buyers.
                  </p>

                  {vendorProfile && (vendorProfile.pickupAddress || vendorProfile.pickupCity) ? (
                    <div className="bg-gray-50 p-6 border border-gray-100 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="md:col-span-2">
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            Address
                          </span>
                          <p className="text-gray-800 mt-1">{vendorProfile.pickupAddress}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            City
                          </span>
                          <p className="text-gray-800 mt-1">{vendorProfile.pickupCity}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            State
                          </span>
                          <p className="text-gray-800 mt-1">{vendorProfile.pickupState}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            ZIP Code
                          </span>
                          <p className="text-gray-800 mt-1">{vendorProfile.pickupZip}</p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            Contact Person
                          </span>
                          <p className="text-gray-800 mt-1">
                            {vendorProfile.pickupContactName || '—'}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-bold uppercase tracking-widest text-gray-500">
                            Contact Phone
                          </span>
                          <p className="text-gray-800 mt-1">{vendorProfile.pickupPhone || '—'}</p>
                        </div>
                      </div>
                      {/* Only the positive badge is rendered. Nothing in the codebase
                          ever sets `pickupVerified` (no route writes it), so the old
                          `else` branch showed a permanent amber "Pending Verification"
                          on every correct address. Restore the negative branch once an
                          admin toggle actually sets this field. */}
                      {vendorProfile.pickupVerified && (
                        <span className="inline-flex items-center gap-1 mt-4 text-xs text-green-700 bg-green-50 px-3 py-1 rounded-full font-medium">
                          <ShieldCheck size={12} /> Verified by Delivery Partner
                        </span>
                      )}
                      <button
                        onClick={() => setEditingPickup(true)}
                        className="mt-4 text-sm text-luxury-gold hover:underline font-medium"
                      >
                        Edit Address
                      </button>
                    </div>
                  ) : null}

                  {(editingPickup || !vendorProfile?.pickupAddress) && (
                    <form
                      onSubmit={handlePickupSubmit}
                      className="bg-gray-50 p-6 border border-gray-100 space-y-4"
                    >
                      <div className="md:col-span-2">
                        <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                          Pickup Address
                        </label>
                        <textarea
                          required
                          rows={2}
                          value={pickupForm.pickupAddress}
                          onChange={(e) =>
                            setPickupForm({ ...pickupForm, pickupAddress: e.target.value })
                          }
                          className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                          placeholder="Street address, landmark, etc."
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                            City
                          </label>
                          <input
                            required
                            value={pickupForm.pickupCity}
                            onChange={(e) =>
                              setPickupForm({ ...pickupForm, pickupCity: e.target.value })
                            }
                            className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                            State
                          </label>
                          <input
                            required
                            value={pickupForm.pickupState}
                            onChange={(e) =>
                              setPickupForm({ ...pickupForm, pickupState: e.target.value })
                            }
                            className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                            ZIP Code
                          </label>
                          <input
                            required
                            value={pickupForm.pickupZip}
                            onChange={(e) =>
                              setPickupForm({ ...pickupForm, pickupZip: e.target.value })
                            }
                            className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                            Contact Person Name
                          </label>
                          <input
                            value={pickupForm.pickupContactName}
                            onChange={(e) =>
                              setPickupForm({ ...pickupForm, pickupContactName: e.target.value })
                            }
                            className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                            placeholder="Optional"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                            Contact Phone
                          </label>
                          <input
                            value={pickupForm.pickupPhone}
                            onChange={(e) =>
                              setPickupForm({ ...pickupForm, pickupPhone: e.target.value })
                            }
                            className="w-full p-3 border border-gray-200 text-sm focus:outline-none focus:border-luxury-gold"
                            placeholder="Optional"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3 pt-2">
                        {editingPickup && (
                          <button
                            type="button"
                            onClick={() => setEditingPickup(false)}
                            className="px-6 py-2.5 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="submit"
                          disabled={pickupSaving}
                          className="px-6 py-2.5 rounded-full text-sm bg-heritage-charcoal text-white hover:bg-heritage-brown flex items-center gap-2"
                        >
                          {pickupSaving && <Loader2 size={14} className="animate-spin" />}
                          Save Address
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            ) : user.kycStatus === 'pending' ? (
              <div className="bg-yellow-50 text-yellow-800 p-6 border border-yellow-100 flex items-start gap-4">
                <ShieldCheck size={32} className="text-yellow-600 mt-1" />
                <div>
                  <h4 className="font-serif text-base sm:text-lg font-medium mb-1">
                    Application Submitted
                  </h4>
                  <p className="text-sm opacity-80">
                    Your application has been submitted successfully. Verification will be completed
                    within 48 hours.
                    <br />
                    Our internal team is currently reviewing your documents.
                  </p>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl">
                {kycRejection && (
                  <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-6 flex items-start gap-4">
                    <AlertCircle size={28} className="text-red-600 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="font-serif text-base sm:text-lg font-medium text-red-800 mb-1">
                        Verification not approved
                      </h4>
                      <p className="text-sm text-red-700 leading-relaxed">
                        <span className="font-medium">Reason: </span>
                        {kycRejection.rejectionReason}
                      </p>
                      <p className="text-sm text-red-700 leading-relaxed mt-3">
                        Fix the items below and resubmit. Your previous details and documents have
                        been kept — replace only what needs correcting.
                      </p>
                      {kycRejection.rejectedAt && (
                        <p className="text-xs text-red-600 mt-3">
                          Reviewed on{' '}
                          {new Date(kycRejection.rejectedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                <p className="text-gray-500 mb-8 font-light">
                  To maintain the integrity of our marketplace, all sellers must complete identity
                  verification and accept the Seller Agreement. Your data is encrypted and handled
                  per our Privacy Policy.
                </p>
                <form onSubmit={handleKycSubmit} className="space-y-6">
                  {/* ── Section 1: Identity Documents ── */}
                  <div className="bg-gray-50 p-6 border border-gray-100">
                    <h4 className="font-serif text-base sm:text-lg font-medium mb-4 text-heritage-charcoal">
                      1. Upload Identity Documents
                    </h4>

                    {user.type === 'individual' ? (
                      <>
                        <DocUploadField
                          label="Aadhaar Number"
                          placeholder="Enter 12-digit Aadhaar number"
                          value={kycForm.aadhaar}
                          docUrl={kycForm.aadhaarDoc}
                          docHref={resolveKycDocumentHref(kycForm.aadhaarDoc)}
                          docType="aadhaar"
                          uploading={kycDocUploading.aadhaar}
                          onValueChange={(v) => setKycForm({ ...kycForm, aadhaar: v })}
                          onFileUpload={(f) => handleKycDocUpload('aadhaar', f)}
                        />
                        <DocUploadField
                          label="PAN Number"
                          placeholder="Enter 10-digit PAN"
                          value={kycForm.pan}
                          docUrl={kycForm.panDoc}
                          docHref={resolveKycDocumentHref(kycForm.panDoc)}
                          docType="pan"
                          uploading={kycDocUploading.pan}
                          onValueChange={(v) => setKycForm({ ...kycForm, pan: v })}
                          onFileUpload={(f) => handleKycDocUpload('pan', f)}
                        />
                      </>
                    ) : (
                      <>
                        <DocUploadField
                          label="Aadhaar Number (Director/Authorised Signatory)"
                          placeholder="Enter 12-digit Aadhaar number"
                          value={kycForm.aadhaar}
                          docUrl={kycForm.aadhaarDoc}
                          docHref={resolveKycDocumentHref(kycForm.aadhaarDoc)}
                          docType="aadhaar"
                          uploading={kycDocUploading.aadhaar}
                          onValueChange={(v) => setKycForm({ ...kycForm, aadhaar: v })}
                          onFileUpload={(f) => handleKycDocUpload('aadhaar', f)}
                        />
                        <DocUploadField
                          label="PAN Number (Company / Director)"
                          placeholder="Enter 10-digit PAN"
                          value={kycForm.pan}
                          docUrl={kycForm.panDoc}
                          docHref={resolveKycDocumentHref(kycForm.panDoc)}
                          docType="pan"
                          uploading={kycDocUploading.pan}
                          onValueChange={(v) => setKycForm({ ...kycForm, pan: v })}
                          onFileUpload={(f) => handleKycDocUpload('pan', f)}
                        />
                        <div className="space-y-4 pt-4 border-t border-gray-200">
                          <h5 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500">
                            Company Details
                          </h5>
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                              Registered Company Name
                            </label>
                            <input
                              type="text"
                              required
                              value={kycForm.companyName}
                              onChange={(e) =>
                                setKycForm({ ...kycForm, companyName: e.target.value })
                              }
                              className="w-full p-3 sm:p-4 border border-gray-300 focus:outline-none focus:border-luxury-gold"
                            />
                          </div>
                          <DocUploadField
                            label="GST Registration Certificate"
                            placeholder="Enter GST number"
                            value={kycForm.gst}
                            docUrl={kycForm.gstDoc}
                            docHref={resolveKycDocumentHref(kycForm.gstDoc)}
                            docType="gst"
                            uploading={kycDocUploading.gst}
                            onValueChange={(v) => setKycForm({ ...kycForm, gst: v })}
                            onFileUpload={(f) => handleKycDocUpload('gst', f)}
                          />
                          <div>
                            <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                              Founder / Director Name
                            </label>
                            <input
                              type="text"
                              required
                              value={kycForm.founderName}
                              onChange={(e) =>
                                setKycForm({ ...kycForm, founderName: e.target.value })
                              }
                              className="w-full p-3 sm:p-4 border border-gray-300 focus:outline-none focus:border-luxury-gold"
                            />
                          </div>
                          <DocUploadField
                            label="Certificate of Incorporation / LLP Registration"
                            docUrl={kycForm.incorporationDoc}
                            docHref={resolveKycDocumentHref(kycForm.incorporationDoc)}
                            docType="incorporation"
                            uploading={kycDocUploading.incorporation}
                            onFileUpload={(f) => handleKycDocUpload('incorporation', f)}
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Section 2: Seller Agreement ── */}
                  <div className="bg-gray-50 p-6 border border-gray-100">
                    <h4 className="font-serif text-base sm:text-lg font-medium mb-4 text-heritage-charcoal">
                      2. Seller Agreement
                    </h4>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 max-h-80 overflow-y-auto text-sm text-gray-700 leading-relaxed space-y-3">
                      <p className="font-semibold text-heritage-charcoal">
                        Seller Agreement - The Collectors Exchange
                      </p>
                      <p>
                        By listing items on The Collectors Exchange, you agree to the following
                        terms:
                      </p>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>
                          <strong>Verification:</strong> All items are subject to verification by
                          our curation team before listing. We reserve the right to reject any item
                          that does not meet our standards of authenticity, condition, or
                          provenance.
                        </li>
                        <li>
                          <strong>Authenticity:</strong> You warrant that every item you list is
                          genuine, authentic, and accurately described. Misrepresentation of any
                          item will result in immediate suspension and legal action.
                        </li>
                        <li>
                          <strong>Fraudulent Listings:</strong> Knowingly listing counterfeit,
                          stolen, or misrepresented items is strictly prohibited. Violators will be
                          permanently banned and reported to relevant authorities.
                        </li>
                        <li>
                          <strong>Payment Hold:</strong> Payments for sold items are held for 7 days
                          after delivery to allow for buyer inspection and verification.
                        </li>
                        <li>
                          <strong>Identity Privacy:</strong> The Collectors Exchange prioritizes
                          collector privacy. For individual sellers, your identity remains anonymous
                          to buyers unless you choose otherwise.
                        </li>
                        <li>
                          <strong>Suspension:</strong> We reserve the right to suspend or terminate
                          your seller account at any time for violations of these terms.
                        </li>
                      </ul>
                      <p className="text-xs text-gray-500 mt-2">
                        This agreement is governed by the laws of India. By signing below, you
                        acknowledge that you have read, understood, and agree to be bound by these
                        terms.
                      </p>
                    </div>

                    <div className="mt-6 flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="tnc"
                        checked={tncAccepted}
                        onChange={(e) => setTncAccepted(e.target.checked)}
                        className="mt-1 h-4 w-4 border-gray-300 rounded"
                      />
                      <label htmlFor="tnc" className="text-sm text-gray-600 leading-relaxed">
                        I have read and agree to the Seller Agreement and Terms & Conditions. I
                        confirm that all information provided is accurate and truthful.
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={kycMutation.isPending}
                    className="bg-black text-white px-6 sm:px-10 py-3 sm:py-4 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors flex items-center justify-center gap-2"
                  >
                    {kycMutation.isPending && <Loader2 size={16} className="animate-spin" />}
                    Submit Verification Documents
                  </button>
                </form>
              </div>
            )}
          </div>
        );

      case 'listings':
        return (
          <div className="space-y-12">
            {/* Add New Product Form */}
            {user.kycStatus === 'verified' && (
              <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-100">
                <div className="mb-6 sm:mb-8 pb-6 sm:pb-8 border-b border-gray-100">
                  <h3 className="text-lg sm:text-2xl font-serif mb-2 text-heritage-charcoal">
                    Broker a New Item
                  </h3>
                  <p className="text-gray-500 font-light text-sm">
                    All listings are subject to administrator approval. Please provide accurate,
                    detailed information to ensure swift verification.
                  </p>
                </div>

                <form onSubmit={handleProductSubmit} className="space-y-6 sm:space-y-8">
                  {/* Essential Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                    <div className="col-span-1 md:col-span-2">
                      <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Item Title <span className="text-luxury-gold">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g., 1950s Hans Wegner Papa Bear Chair"
                        value={productForm.title}
                        onChange={(e) => setProductForm({ ...productForm, title: e.target.value })}
                        className="w-full p-3 sm:p-4 border border-gray-200 focus:outline-none focus:border-luxury-gold font-serif text-lg"
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Use the official name or a factual description. No decorative adjectives in
                        title.
                      </p>
                    </div>

                    <div className="col-span-1 md:col-span-2">
                      <label
                        htmlFor="product-brand"
                        className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
                      >
                        Brand / Maker <span className="text-gray-500 normal-case">(optional)</span>
                      </label>
                      <BrandCombobox
                        id="product-brand"
                        value={productForm.brand}
                        onChange={(brand) => setProductForm({ ...productForm, brand })}
                      />
                      <p className="text-xs text-gray-500 mt-2">
                        Search the list or type your own; unlisted and house-marked names are
                        accepted. Leave blank for unbranded pieces.
                      </p>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Primary Category <span className="text-luxury-gold">*</span>
                      </label>
                      <select
                        value={productForm.category}
                        onChange={(e) =>
                          setProductForm({ ...productForm, category: e.target.value })
                        }
                        className="w-full p-3 sm:p-4 border border-gray-200 focus:outline-none focus:border-luxury-gold bg-white"
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Listing Price (₹) <span className="text-luxury-gold">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        className="w-full p-3 sm:p-4 border border-gray-200 focus:outline-none focus:border-luxury-gold"
                      />
                    </div>
                  </div>

                  {/* Story & Provenance */}
                  <div>
                    <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                      Provenance & Description <span className="text-luxury-gold">*</span>
                    </label>
                    <div className="border border-gray-200">
                      <div className="flex items-center border-b border-gray-200 overflow-x-auto">
                        <button
                          type="button"
                          onClick={() => setDescPreview(false)}
                          className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-widest font-medium flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0 ${!descPreview ? 'bg-luxury-gold text-black' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                          <Edit3 size={11} className="hidden sm:block" />
                          Write
                        </button>
                        <button
                          type="button"
                          onClick={() => setDescPreview(true)}
                          className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs uppercase tracking-widest font-medium flex items-center gap-1 sm:gap-1.5 transition-colors shrink-0 ${descPreview ? 'bg-luxury-gold text-black' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                          <Eye size={11} className="hidden sm:block" />
                          Preview
                        </button>
                        {!descPreview && (
                          <div className="flex items-center gap-0.5 ml-auto pl-2 border-l border-gray-200 overflow-x-auto">
                            {toolbarItems.map((item) => (
                              <button
                                key={item.label}
                                type="button"
                                onClick={item.action}
                                title={item.title}
                                className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-[10px] sm:text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors font-bold shrink-0"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {descPreview ? (
                        <div className="p-4 min-h-[150px] prose prose-sm max-w-none">
                          {productForm.description ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {productForm.description}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-gray-500 italic">Nothing to preview</p>
                          )}
                        </div>
                      ) : (
                        <textarea
                          ref={descRef}
                          required
                          rows={8}
                          placeholder="Describe your item... Supports Markdown (use the toolbar above for formatting)"
                          value={productForm.description}
                          onChange={(e) =>
                            setProductForm({ ...productForm, description: e.target.value })
                          }
                          className="w-full p-3 sm:p-4 border-0 focus:outline-none focus:ring-0 leading-relaxed resize-y"
                        />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Condition Grade <span className="text-luxury-gold">*</span>
                      </label>
                      <select
                        value={productForm.condition}
                        onChange={(e) =>
                          setProductForm({ ...productForm, condition: e.target.value })
                        }
                        className="w-full p-3 sm:p-4 border border-gray-200 focus:outline-none focus:border-luxury-gold bg-white"
                      >
                        {CONDITIONS.map((cond) => (
                          <option key={cond} value={cond}>
                            {cond}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                        Keywords / Tags <span className="text-luxury-gold">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          required
                          placeholder="Separate with commas (e.g., vintage, gold, 1980s)"
                          value={productForm.keywords}
                          onChange={(e) =>
                            setProductForm({ ...productForm, keywords: e.target.value })
                          }
                          className="w-full pt-3 pb-3 pr-3 pl-9 sm:pt-4 sm:pb-4 sm:pr-4 sm:pl-10 border border-gray-200 focus:outline-none focus:border-luxury-gold"
                        />
                        <Tag
                          size={16}
                          className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Image Upload Section */}
                  <div className="bg-gray-50 p-4 sm:p-6 border border-gray-100 rounded-sm">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-600">
                        Image Gallery (Min 4 Required) <span className="text-luxury-gold">*</span>
                      </label>
                      <span className="text-xs text-gray-500">
                        {productForm.imageUrls.filter((u) => u).length} / 10 Images
                      </span>
                    </div>

                    <div className="space-y-3 sm:space-y-4">
                      {productForm.imageUrls.map((url, index) => (
                        <div key={index}>
                          {/* Mobile: stacked layout */}
                          <div className="sm:hidden flex items-center gap-2">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              <div
                                className={`${url ? 'w-8 h-8' : 'w-8'} flex-shrink-0 bg-gray-100 rounded overflow-hidden`}
                              >
                                {url ? (
                                  <img
                                    src={url}
                                    alt=""
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 flex items-center justify-center text-[9px] text-gray-500 font-mono">
                                    {index === 0 ? '1' : `${index + 1}`}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1 relative">
                                <input
                                  type="url"
                                  placeholder={
                                    index === 0 ? 'Image URL...' : `Image ${index + 1} URL...`
                                  }
                                  value={url}
                                  onChange={(e) => handleImageUrlChange(index, e.target.value)}
                                  className="w-full p-2 pr-7 border border-gray-200 focus:outline-none focus:border-luxury-gold text-[13px]"
                                />
                              </div>
                            </div>
                            <label
                              className="cursor-pointer p-1.5 text-gray-500 hover:text-luxury-gold transition-colors shrink-0"
                              title="Upload file"
                            >
                              <Upload size={13} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={imageUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(index, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {productForm.imageUrls.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeImageField(index)}
                                className="text-gray-500 hover:text-red-600 p-1.5 shrink-0"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                          {/* Desktop: inline layout */}
                          <div className="hidden sm:flex gap-4 items-center">
                            <div className="w-8 text-xs text-gray-500 font-mono text-center">
                              {index === 0 ? 'MAIN' : `#${index + 1}`}
                            </div>
                            {url && (
                              <div className="w-12 h-12 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                                <img
                                  src={url}
                                  alt=""
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.target.style.display = 'none';
                                  }}
                                />
                              </div>
                            )}
                            <div className="flex-grow relative">
                              <input
                                type="url"
                                placeholder={
                                  index === 0 ? 'Primary image URL...' : 'Additional image URL...'
                                }
                                value={url}
                                onChange={(e) => handleImageUrlChange(index, e.target.value)}
                                className="w-full p-3 pl-10 border border-gray-200 focus:outline-none focus:border-luxury-gold text-sm"
                              />
                              <ImageIcon
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                              />
                            </div>
                            <label
                              className="cursor-pointer p-2 text-gray-500 hover:text-luxury-gold transition-colors"
                              title="Upload file"
                            >
                              <Upload size={16} />
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={imageUploading}
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(index, file);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {productForm.imageUrls.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeImageField(index)}
                                className="text-gray-500 hover:text-red-600 p-2"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {productForm.imageUrls.length < 10 && (
                      <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={addImageField}
                          className="flex items-center gap-2 text-xs sm:text-sm text-luxury-gold font-semibold hover:underline"
                        >
                          <Plus size={14} className="sm:hidden" />
                          <Plus size={16} className="hidden sm:block" /> Add Another Image
                        </button>
                        <span className="text-gray-300 hidden sm:inline">|</span>
                        <label className="cursor-pointer flex items-center gap-2 text-xs sm:text-sm text-gray-500 hover:text-luxury-gold font-semibold transition-colors">
                          <Upload size={14} className="sm:hidden" />
                          <Upload size={16} className="hidden sm:block" />
                          Upload Multiple Images
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            disabled={imageUploading}
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files?.length) handleMultipleFileUpload(files);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}

                    <div className="mt-3 sm:mt-4 flex items-start gap-2 text-[10px] sm:text-xs text-gray-500 bg-white p-2 sm:p-3 rounded-lg border border-gray-100">
                      <Info size={12} className="mt-0.5 flex-shrink-0 hidden sm:block" />
                      <Info size={14} className="mt-0.5 flex-shrink-0 sm:hidden" />
                      <p>
                        Upload images directly or paste image URLs. The first image will be the
                        primary detailed view and card thumbnail.{' '}
                        {imageUploading && (
                          <span className="text-luxury-gold font-medium">Uploading...</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Specifications / Key-Value Pairs */}
                  <div className="bg-gray-50 p-4 sm:p-6 border border-gray-100 rounded-sm">
                    <div className="flex items-center justify-between mb-3 sm:mb-4">
                      <label className="block text-xs font-bold uppercase tracking-widest text-gray-600">
                        Specifications
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setProductForm({
                            ...productForm,
                            specs: [...productForm.specs, { key: '', value: '' }],
                          })
                        }
                        className="flex items-center gap-1 text-xs text-luxury-gold font-semibold hover:underline"
                      >
                        <Plus size={14} /> Add Field
                      </button>
                    </div>

                    <div className="space-y-2">
                      {productForm.specs.map((spec, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Key (e.g., Movement Model)"
                            value={spec.key}
                            onChange={(e) => {
                              const newSpecs = [...productForm.specs];
                              newSpecs[index] = { ...newSpecs[index], key: e.target.value };
                              setProductForm({ ...productForm, specs: newSpecs });
                            }}
                            className="flex-1 p-2 sm:p-3 border border-gray-200 focus:outline-none focus:border-luxury-gold text-sm"
                          />
                          <input
                            type="text"
                            placeholder="Value (e.g., 6R5J)"
                            value={spec.value}
                            onChange={(e) => {
                              const newSpecs = [...productForm.specs];
                              newSpecs[index] = { ...newSpecs[index], value: e.target.value };
                              setProductForm({ ...productForm, specs: newSpecs });
                            }}
                            className="flex-1 p-2 sm:p-3 border border-gray-200 focus:outline-none focus:border-luxury-gold text-sm"
                          />
                          {productForm.specs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const newSpecs = productForm.specs.filter((_, i) => i !== index);
                                setProductForm({ ...productForm, specs: newSpecs });
                              }}
                              className="text-gray-500 hover:text-red-600 p-2"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="mt-2 sm:mt-3 flex items-start gap-2 text-[10px] sm:text-xs text-gray-500 bg-white p-2 sm:p-3 rounded-lg border border-gray-100">
                      <Info size={12} className="mt-0.5 flex-shrink-0 hidden sm:block" />
                      <Info size={14} className="mt-0.5 flex-shrink-0 sm:hidden" />
                      <p>
                        Add technical or descriptive specifications (e.g., Movement Model, Case
                        Material, Year of Manufacture). Leave empty to skip.
                      </p>
                    </div>
                  </div>

                  {/* Commission / Partner Contribution */}
                  <CommissionSlider
                    value={productForm.commissionPercent}
                    price={productForm.price}
                    onChange={(val) => setProductForm({ ...productForm, commissionPercent: val })}
                    disabled={addProductMutation.isPending}
                  />

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <button
                      type="submit"
                      disabled={addProductMutation.isPending}
                      className="w-full sm:w-auto bg-heritage-charcoal text-white px-6 sm:px-12 py-3 sm:py-4 rounded-full text-sm uppercase tracking-widest hover:bg-heritage-brown transition-colors shadow-lg flex items-center justify-center gap-2"
                    >
                      {addProductMutation.isPending && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      Submit for Brokerage
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* User's Listings / Portfolio */}
            <div className="bg-white p-6 sm:p-10 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 sm:mb-8">
                <div>
                  <h3 className="text-lg sm:text-2xl font-serif text-heritage-charcoal">
                    My Collection
                  </h3>
                  {vendorProfile ? (
                    <p className="text-sm text-gray-500 mt-1">
                      {vendorProfile.type === 'BULK' ? (
                        <span className="text-luxury-gold font-medium">
                          Bulk Vendor - Unlimited Listings
                        </span>
                      ) : (
                        <span>
                          {activeListingCount} of {maxListings} active listings used
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 mt-1">
                      {activeListingCount} of {maxListings} active listings used
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3 sm:mt-0 flex-wrap">
                  {vendorProfile?.type === 'BULK' && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadCsvTemplate}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                      >
                        <Download size={16} /> Template
                      </button>
                      <button
                        type="button"
                        onClick={() => document.getElementById('bulk-csv-input')?.click()}
                        className="flex items-center gap-2 px-4 py-2 text-sm border border-luxury-gold text-luxury-gold hover:bg-luxury-gold hover:text-black transition-colors font-medium"
                      >
                        <Upload size={16} /> Bulk Upload
                      </button>
                    </>
                  )}
                  {userProducts.length > 0 && (
                    <button
                      type="button"
                      onClick={handleExportPortfolioCsv}
                      className="flex items-center gap-2 px-4 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
                    >
                      <Download size={16} /> Export CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Slot usage bar for single vendors */}
              {(!vendorProfile || vendorProfile.type !== 'BULK') && (
                <div className="w-full bg-gray-100 h-2 mb-6 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-luxury-gold transition-all rounded-full"
                    style={{
                      width: `${Math.min((activeListingCount / maxListings) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}

              {/* CSV Bulk Upload Section (hidden file input) */}
              <input
                id="bulk-csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleBulkCsvUpload}
              />

              {/* Bulk upload progress / results */}
              {bulkResults && (
                <div
                  className={`mb-6 p-4 border ${bulkResults.errors?.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-green-200 bg-green-50'}`}
                >
                  <p className="text-sm font-medium mb-1">
                    {bulkResults.created > 0
                      ? `✓ ${bulkResults.created} products created`
                      : 'No products created'}
                  </p>
                  {bulkResults.errors?.length > 0 && (
                    <div className="text-xs text-red-600 mt-2">
                      {bulkResults.errors.map((err, i) => (
                        <p key={i}>
                          Row {err.row} ({err.title}): {err.error}
                        </p>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setBulkResults(null)}
                    className="text-xs text-gray-500 underline mt-2"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {userProducts.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
                  <div className="bg-gray-50 p-3 sm:p-4 border border-gray-100">
                    <p className="text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal">
                      <CountUp end={userProducts.length} />
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                      Total Listings
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 border border-gray-100">
                    <p className="text-lg sm:text-2xl font-serif font-bold text-green-700">
                      <CountUp end={userProducts.filter((p) => p.status === 'Approved').length} />
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                      Live / Published
                    </p>
                  </div>
                  <div className="bg-gray-50 p-3 sm:p-4 border border-gray-100">
                    <p className="text-lg sm:text-2xl font-serif font-bold text-heritage-charcoal">
                      {/* Rejected listings are NOT in review — they are counted
                          separately under "Needs Attention" below. */}
                      <CountUp
                        end={
                          userProducts.filter(
                            (p) => p.status === 'Pending' || p.status === 'In_Review',
                          ).length
                        }
                      />
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                      In Review
                    </p>
                  </div>
                  {userProducts.some((p) => p.status === 'Rejected') && (
                    <div className="bg-red-50 p-3 sm:p-4 border border-red-100">
                      <p className="text-lg sm:text-2xl font-serif font-bold text-red-700">
                        <CountUp end={userProducts.filter((p) => p.status === 'Rejected').length} />
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                        Needs Attention
                      </p>
                    </div>
                  )}
                  <div className="bg-gray-50 p-3 sm:p-4 border border-gray-100">
                    <p className="text-lg sm:text-2xl font-serif font-bold text-luxury-gold">
                      {vendorStats ? (
                        <CountUp end={vendorStats.totalSales || 0} prefix="₹" />
                      ) : (
                        '₹0'
                      )}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                      Total Sales
                    </p>
                  </div>
                  {vendorStats?.netEarnings !== undefined && (
                    <div className="bg-green-50 p-3 sm:p-4 border border-green-100">
                      <p className="text-lg sm:text-2xl font-serif font-bold text-green-700">
                        <CountUp end={vendorStats.netEarnings} prefix="₹" />
                      </p>
                      <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                        Net Earnings
                      </p>
                    </div>
                  )}
                  {vendorStats?.totalPlatformFees !== undefined &&
                    vendorStats.totalPlatformFees > 0 && (
                      <div className="bg-amber-50 p-3 sm:p-4 border border-amber-100">
                        <p className="text-lg sm:text-2xl font-serif font-bold text-amber-700">
                          <CountUp end={vendorStats.totalPlatformFees} prefix="₹" />
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mt-0.5 sm:mt-1">
                          Platform Contribution
                        </p>
                      </div>
                    )}
                </div>
              )}

              {userProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[...userProducts]
                    .sort((a, b) => {
                      if (a.status === 'Sold' && b.status !== 'Sold') return 1;
                      if (a.status !== 'Sold' && b.status === 'Sold') return -1;
                      return 0;
                    })
                    .map((product) =>
                      editingProductId === product.id ? (
                        <div
                          key={product.id}
                          className="border border-luxury-gold bg-white col-span-1 sm:col-span-2 lg:col-span-3"
                        >
                          <div className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <h4 className="font-serif text-base sm:text-lg font-medium">
                                Edit: {product.title}
                              </h4>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="text-gray-500 hover:text-black"
                              >
                                <X size={18} />
                              </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Title
                                </label>
                                <input
                                  value={editProductForm.title}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      title: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm"
                                />
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Main Image URL
                                </label>
                                <input
                                  value={editProductForm.image}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      image: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm"
                                  placeholder="https://..."
                                />
                                <div className="flex flex-wrap gap-2 mt-2">
                                  {editProductForm.images.map((url, i) => (
                                    <div key={i} className="relative w-14 h-14">
                                      <img
                                        src={url}
                                        alt=""
                                        className="w-full h-full object-cover rounded border"
                                      />
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setEditProductForm({
                                            ...editProductForm,
                                            images: editProductForm.images.filter(
                                              (_, j) => j !== i,
                                            ),
                                          })
                                        }
                                        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] flex items-center justify-center"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const url = prompt('Enter image URL:');
                                      if (url)
                                        setEditProductForm({
                                          ...editProductForm,
                                          images: [...editProductForm.images, url],
                                        });
                                    }}
                                    className="w-14 h-14 border border-dashed border-gray-300 rounded flex items-center justify-center text-gray-500 hover:border-luxury-gold hover:text-luxury-gold transition-colors text-xl"
                                  >
                                    +
                                  </button>
                                </div>
                              </div>
                              <div className="md:col-span-2">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Description
                                </label>
                                <textarea
                                  rows={4}
                                  value={editProductForm.description}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      description: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Price (₹)
                                </label>
                                <input
                                  type="number"
                                  value={editProductForm.price}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      price: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Condition
                                </label>
                                <select
                                  value={editProductForm.condition}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      condition: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm bg-white"
                                >
                                  {CONDITIONS.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Category
                                </label>
                                <select
                                  value={editProductForm.category}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      category: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm bg-white"
                                >
                                  {CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label
                                  htmlFor={`edit-brand-${product.id}`}
                                  className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1"
                                >
                                  Brand / Maker{' '}
                                  <span className="text-gray-500 normal-case">(optional)</span>
                                </label>
                                <BrandCombobox
                                  id={`edit-brand-${product.id}`}
                                  value={editProductForm.brand}
                                  onChange={(brand) =>
                                    setEditProductForm({ ...editProductForm, brand })
                                  }
                                  placeholder="Search or type a brand"
                                  inputClassName="w-full p-3 border border-gray-200 text-base sm:text-sm focus:outline-none focus:border-luxury-gold"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">
                                  Keywords (comma separated)
                                </label>
                                <input
                                  value={editProductForm.keywords}
                                  onChange={(e) =>
                                    setEditProductForm({
                                      ...editProductForm,
                                      keywords: e.target.value,
                                    })
                                  }
                                  className="w-full p-3 border border-gray-200 text-sm"
                                />
                              </div>
                            </div>
                            <div className="mt-4">
                              <CommissionSlider
                                value={editProductForm.commissionPercent}
                                price={editProductForm.price}
                                onChange={(val) =>
                                  setEditProductForm({ ...editProductForm, commissionPercent: val })
                                }
                                disabled={updateProductMutation.isPending}
                              />
                            </div>
                            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-6 py-2 text-sm border border-gray-300 text-gray-600 hover:bg-gray-50"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(product.id)}
                                disabled={updateProductMutation.isPending}
                                className="px-6 py-2 rounded-full text-sm bg-heritage-charcoal text-white hover:bg-heritage-brown flex items-center gap-2"
                              >
                                {updateProductMutation.isPending && (
                                  <Loader2 size={14} className="animate-spin" />
                                )}
                                Save Changes
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div
                          key={product.id}
                          className="border border-gray-100 bg-white rounded-xl overflow-hidden sm:border-gray-100 sm:hover:shadow-md sm:transition-shadow sm:group"
                        >
                          {/* Mobile: horizontal compact card */}
                          <div className="flex sm:hidden">
                            <div className="relative w-[88px] h-[88px] shrink-0 bg-gray-50 overflow-hidden">
                              <img
                                src={product.image || 'https://via.placeholder.com/300'}
                                alt={product.title}
                                className="w-full h-full object-cover"
                              />
                              {product.status === 'Sold' && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                  <span className="text-[9px] text-white font-semibold uppercase tracking-wider">
                                    Sold
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0 p-2.5">
                              <div className="flex items-start justify-between gap-1">
                                <div className="min-w-0">
                                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                    {product.category}
                                  </span>
                                  <h4 className="font-serif text-xs font-medium text-heritage-charcoal truncate">
                                    {product.title}
                                  </h4>
                                </div>
                                <span
                                  className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded ${product.status === 'Approved' ? 'bg-blue-50 text-blue-700' : product.status === 'Rejected' ? 'bg-red-50 text-red-700' : product.status === 'In_Review' ? 'bg-purple-50 text-purple-700' : product.status === 'Sold' ? 'bg-gray-100 text-gray-700' : 'bg-amber-50 text-amber-700'}`}
                                >
                                  {product.status === 'Sold'
                                    ? 'Sold'
                                    : product.status === 'Approved'
                                      ? 'Live'
                                      : product.status === 'In_Review'
                                        ? 'In Review'
                                        : product.status === 'Rejected'
                                          ? 'Rejected'
                                          : 'Pending'}
                                </span>
                              </div>
                              <p className="text-luxury-gold font-sans text-xs font-medium mt-0.5">
                                ₹{product.price?.toLocaleString()}
                              </p>
                              {product.status === 'Rejected' && product.rejectionReason && (
                                <p className="text-[10px] text-red-600 leading-tight mt-0.5 line-clamp-2">
                                  {product.rejectionReason}
                                </p>
                              )}
                              <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t border-gray-100">
                                <span className="text-[10px] text-gray-500">
                                  {product.condition}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(product)}
                                    className={`transition-colors p-1 ${product.status === 'Rejected' ? 'text-orange-500' : 'text-gray-500 hover:text-luxury-gold'}`}
                                    title="Edit listing"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                  {/* Same rule as the desktop card: the backend only
                                      accepts Approved listings. */}
                                  {product.status === 'Approved' && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAsSold(product.id)}
                                      disabled={markAsSoldMutation.isPending}
                                      className="text-gray-500 hover:text-green-600 transition-colors p-1 disabled:opacity-30"
                                      title="Mark as sold"
                                    >
                                      {markAsSoldMutation.isPending ? (
                                        <Loader2 size={12} className="animate-spin" />
                                      ) : (
                                        <Tag size={12} />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    disabled={deleteProductMutation.isPending}
                                    className="text-gray-500 hover:text-red-600 transition-colors p-1 disabled:opacity-30"
                                    title="Delete listing"
                                  >
                                    {deleteProductMutation.isPending ? (
                                      <Loader2 size={12} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={12} />
                                    )}
                                  </button>
                                </div>
                              </div>
                              {product.status === 'Sold' &&
                                (offlineSoldIds.has(product.id) ? (
                                  <p className="text-[10px] text-gray-500 leading-snug mt-1.5">
                                    You marked this sold. By mistake? Contact{' '}
                                    <a
                                      href="mailto:support@thecollectorsexchange.in"
                                      className="underline font-medium text-gray-600"
                                    >
                                      support@thecollectorsexchange.in
                                    </a>{' '}
                                    to relist.
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-green-700 leading-snug mt-1.5">
                                    Sold to a buyer. Payout is released after delivery.
                                  </p>
                                ))}
                            </div>
                          </div>
                          {/* Desktop: vertical card */}
                          <div className="hidden sm:block">
                            <div className="relative aspect-[4/3] bg-gray-50 overflow-hidden">
                              <img
                                src={product.image || 'https://via.placeholder.com/300'}
                                alt={product.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <div className="absolute top-2 right-2">
                                {product.status === 'Sold' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-gray-700 bg-gray-100 px-2 py-1 rounded">
                                    <Tag size={10} /> Sold
                                  </span>
                                ) : product.status === 'Rejected' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-red-700 bg-red-50 px-2 py-1 rounded">
                                    <XCircle size={10} /> Rejected
                                  </span>
                                ) : product.authenticityStatus === 'Verified' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-green-700 bg-green-50 px-2 py-1 rounded">
                                    <ShieldCheck size={10} /> Authenticated
                                  </span>
                                ) : product.status === 'Approved' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 bg-blue-50 px-2 py-1 rounded">
                                    Published
                                  </span>
                                ) : product.status === 'In_Review' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-purple-700 bg-purple-50 px-2 py-1 rounded">
                                    In Review
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-2 py-1 rounded">
                                    Pending
                                  </span>
                                )}
                              </div>
                              {product.status === 'Approved' && (
                                <div className="absolute top-2 left-2">
                                  <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">
                                    Live
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                                {product.category}
                              </span>
                              <h4 className="font-serif text-base font-medium text-heritage-charcoal line-clamp-1 mt-0.5">
                                {product.title}
                              </h4>
                              <p className="text-luxury-gold font-sans text-sm font-medium mt-1">
                                ₹{product.price?.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2 leading-relaxed">
                                {product.description}
                              </p>
                              {product.status === 'Sold' &&
                                (offlineSoldIds.has(product.id) ? (
                                  // Self-marked sold with no order behind it — this is the
                                  // only case where "undo" is a sensible offer.
                                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded">
                                    <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider mb-1">
                                      Marked Sold
                                    </p>
                                    <p className="text-xs text-gray-600 leading-relaxed">
                                      You marked this item as sold, so it is hidden from buyers.
                                      Marked it by mistake? Contact{' '}
                                      <a
                                        href="mailto:support@thecollectorsexchange.in"
                                        className="underline font-medium"
                                      >
                                        support@thecollectorsexchange.in
                                      </a>{' '}
                                      to relist it.
                                    </p>
                                  </div>
                                ) : (
                                  // A real buyer purchased this. Never invite the seller to
                                  // undo it — point them at the order and the payout instead.
                                  <div className="mt-3 p-3 bg-green-50 border border-green-100 rounded">
                                    <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider mb-1">
                                      Sold
                                    </p>
                                    <p className="text-xs text-green-800 leading-relaxed">
                                      This item found a buyer and is no longer shown in The
                                      Exchange. Your payout is released after delivery — track it in
                                      your seller dashboard.
                                    </p>
                                  </div>
                                ))}
                              {product.status === 'Rejected' && product.rejectionReason && (
                                <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded">
                                  <p className="text-[10px] font-bold text-red-700 uppercase tracking-wider mb-1">
                                    Reason for Rejection
                                  </p>
                                  <p className="text-xs text-red-600 leading-relaxed">
                                    {product.rejectionReason}
                                  </p>
                                  <p className="text-[10px] text-red-600 mt-2">
                                    Edit your listing to fix the issues and it will be sent for
                                    review again. For queries, contact{' '}
                                    <a
                                      href="mailto:support@thecollectorsexchange.in"
                                      className="underline font-medium"
                                    >
                                      support@thecollectorsexchange.in
                                    </a>
                                    .
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                <span className="text-[10px] text-gray-500">
                                  {product.condition}
                                </span>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleStartEdit(product)}
                                    className={`transition-colors p-1 ${product.status === 'Rejected' ? 'text-orange-500 hover:text-orange-700 bg-orange-50 rounded' : 'text-gray-500 hover:text-luxury-gold'}`}
                                    title="Edit listing"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  {/* The backend only accepts Approved listings
                                      (backend/routes/products.js), so offering the
                                      action on Pending/Rejected/Sold cards could only
                                      ever produce an error. */}
                                  {product.status === 'Approved' && (
                                    <button
                                      type="button"
                                      onClick={() => handleMarkAsSold(product.id)}
                                      disabled={markAsSoldMutation.isPending}
                                      className="text-gray-500 hover:text-green-600 transition-colors p-1 disabled:opacity-30"
                                      title="Mark as sold"
                                    >
                                      {markAsSoldMutation.isPending ? (
                                        <Loader2 size={14} className="animate-spin" />
                                      ) : (
                                        <Tag size={14} />
                                      )}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteProduct(product.id)}
                                    disabled={deleteProductMutation.isPending}
                                    className="text-gray-500 hover:text-red-600 transition-colors p-1 disabled:opacity-30"
                                    title="Delete listing"
                                  >
                                    {deleteProductMutation.isPending ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <Trash2 size={14} />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ),
                    )}
                </div>
              ) : (
                <div className="text-center py-16 bg-gray-50 border border-gray-100 border-dashed">
                  <Package size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-serif text-lg">Your listings are empty.</p>
                  <p className="text-gray-500 text-sm mt-1">List items to see them appear here.</p>
                  {user.kycStatus !== 'verified' && (
                    <button
                      onClick={() => setActiveTab('seller')}
                      className="text-luxury-gold font-semibold hover:underline mt-4 text-sm uppercase tracking-widest"
                    >
                      Complete Verification to List Items
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );

      case 'orders':
        return (
          <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-lg sm:text-2xl font-serif mb-2">My Orders</h2>
            <p className="text-gray-500 text-sm mb-6 sm:mb-8">Track your purchases and shipments</p>
            {ordersLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="animate-spin text-luxury-gold" size={32} />
              </div>
            ) : myOrders.length === 0 ? (
              <div className="text-center py-16 bg-gray-50 border border-gray-100 border-dashed">
                <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-500 font-serif text-lg">No orders yet.</p>
                <p className="text-gray-500 text-sm mt-1">
                  When you make a purchase, your orders will appear here.
                </p>
                <Link
                  to="/category"
                  className="inline-block mt-6 text-luxury-gold font-semibold hover:underline text-sm uppercase tracking-widest"
                >
                  Browse The Exchange
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {myOrders.map((order) => {
                  const displayId = order.displayId || order.id.slice(-8).toUpperCase();
                  const amountDue = codAmountDue(order);
                  return (
                    <div
                      key={order.id}
                      className="border border-gray-100 p-4 sm:p-6 hover:shadow-md transition-shadow"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 uppercase tracking-wider">
                            Order #{displayId}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(order.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 text-xs font-semibold rounded-full ${order.status === 'Delivered' ? 'bg-green-100 text-green-800' : order.status === 'Shipped' ? 'bg-blue-100 text-blue-800' : order.status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : order.status === 'Cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}
                        >
                          {order.status}
                        </span>
                      </div>

                      {/* Where the order actually is. A status word on its own
                        does not tell a buyer whether anything is still to come. */}
                      <div className="mb-4">
                        <OrderTimeline status={order.status} />
                      </div>

                      {order.items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 py-3 border-t border-gray-50"
                        >
                          <img
                            src={imageUrl(item.product?.image || ORDER_IMAGE_PLACEHOLDER, 200)}
                            alt={item.product?.title || ''}
                            width="56"
                            height="56"
                            loading="lazy"
                            decoding="async"
                            className="w-14 h-14 object-cover bg-heritage-beige shrink-0"
                          />
                          <div className="flex-grow min-w-0">
                            <p className="text-sm font-medium truncate">{item.product?.title}</p>
                            <p className="text-xs text-gray-500">
                              Qty: {item.quantity} &middot; ₹{item.price?.toLocaleString()}
                            </p>
                          </div>
                          {order.status === 'Delivered' && (
                            <button
                              onClick={() =>
                                setReviewingItem(
                                  reviewingItem?.orderId === order.id &&
                                    reviewingItem?.productId === item.productId
                                    ? null
                                    : {
                                        orderId: order.id,
                                        productId: item.productId,
                                        productName: item.product?.title,
                                      },
                                )
                              }
                              className="text-[10px] uppercase tracking-widest text-luxury-gold font-medium hover:underline shrink-0 px-3 py-1.5 border border-luxury-gold/30 hover:bg-luxury-gold/5 transition-colors"
                            >
                              {reviewingItem?.orderId === order.id &&
                              reviewingItem?.productId === item.productId
                                ? 'Cancel'
                                : 'Write Review'}
                            </button>
                          )}
                        </div>
                      ))}
                      {order.status === 'Delivered' && reviewingItem?.orderId === order.id && (
                        <div className="mt-3">
                          <ReviewForm
                            orderId={reviewingItem.orderId}
                            productId={reviewingItem.productId}
                            productName={reviewingItem.productName}
                            onSuccess={() => setReviewingItem(null)}
                          />
                        </div>
                      )}
                      <div className="flex flex-wrap justify-between items-center gap-2 pt-3 border-t border-gray-100 mt-3">
                        <p className="text-sm text-gray-600">
                          Total:{' '}
                          <span className="font-semibold">
                            ₹{order.totalAmount?.toLocaleString()}
                          </span>
                        </p>
                        {order.trackingID && (
                          <a
                            href={trackingHref(order.trackingID)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-luxury-gold font-semibold hover:underline"
                          >
                            <Truck size={13} aria-hidden="true" />
                            Track with {COURIER_NAME}
                            <span className="text-gray-500 font-normal">({order.trackingID})</span>
                          </a>
                        )}
                      </div>

                      {/* Money still to hand over on the doorstep. The buyer has
                        to know the exact figure before the courier arrives, so
                        it is stated rather than left to be inferred from
                        "Total" plus "Cash on delivery". */}
                      {amountDue != null && (
                        <div className="mt-3 flex items-start gap-2 bg-amber-50 border border-amber-200 px-3 py-2.5 rounded-lg">
                          <Wallet
                            size={15}
                            className="text-amber-700 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <p className="text-xs text-amber-900">
                            <span className="font-semibold">
                              ₹{amountDue.toLocaleString()} due on delivery.
                            </span>{' '}
                            Please keep the exact amount in cash ready for the courier.
                          </p>
                        </div>
                      )}

                      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
                        <div className="flex items-start gap-2">
                          <MapPin
                            size={14}
                            className="text-gray-500 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <dt className="text-gray-500 uppercase tracking-wider">
                              Delivering to
                            </dt>
                            <dd className="text-gray-700 mt-0.5 break-words">
                              {order.buyerName && <span className="block">{order.buyerName}</span>}
                              {order.shippingAddress}
                              {order.city ? `, ${order.city}` : ''}
                              {order.state ? `, ${order.state}` : ''}
                              {order.zipCode ? ` ${order.zipCode}` : ''}
                              {order.phone && <span className="block">{order.phone}</span>}
                            </dd>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CreditCard
                            size={14}
                            className="text-gray-500 mt-0.5 shrink-0"
                            aria-hidden="true"
                          />
                          <div className="min-w-0">
                            <dt className="text-gray-500 uppercase tracking-wider">Payment</dt>
                            <dd className="text-gray-700 mt-0.5">
                              {PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod}
                              {order.paymentStatus && (
                                <span className="text-gray-500">
                                  {' '}
                                  &middot; {order.paymentStatus}
                                </span>
                              )}
                            </dd>
                          </div>
                        </div>
                      </dl>

                      {/* A buyer with a problem should not have to work out which
                        order they are writing about, or find the address. */}
                      <a
                        href={mailtoHref(
                          `Help with order ${displayId}`,
                          `Order: ${displayId}\nPlaced: ${new Date(order.createdAt).toLocaleDateString()}\nStatus: ${order.status}\n\nWhat I need help with:\n`,
                        )}
                        className="mt-4 inline-flex items-center gap-1.5 text-xs text-gray-600 hover:text-luxury-gold hover:underline"
                      >
                        <HelpCircle size={13} aria-hidden="true" />
                        Need help with this order?
                      </a>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-10 pt-8 border-t border-gray-100">
              <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500 mb-4">
                Share Your Experience
              </h3>
              {testimonialSubmitted ? (
                <p className="text-green-700 bg-green-50 p-4 text-sm">
                  Thank you! Your testimonial has been submitted for review.
                </p>
              ) : (
                <div className="max-w-lg">
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                      Rating
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setTestimonialForm((prev) => ({ ...prev, rating: i }))}
                          className={`text-2xl ${i <= testimonialForm.rating ? 'text-amber-400' : 'text-gray-200'} hover:text-amber-300 transition-colors`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={testimonialForm.authorName}
                      onChange={(e) =>
                        setTestimonialForm((prev) => ({ ...prev, authorName: e.target.value }))
                      }
                      placeholder="Your name"
                      className="w-full p-3 border border-gray-200 text-sm"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                      Your Testimonial
                    </label>
                    <textarea
                      rows={4}
                      value={testimonialForm.content}
                      onChange={(e) =>
                        setTestimonialForm((prev) => ({ ...prev, content: e.target.value }))
                      }
                      placeholder="Share your experience with The Collectors Exchange..."
                      className="w-full p-3 border border-gray-200 text-sm resize-none"
                    />
                  </div>
                  <div className="mb-4">
                    <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                      Images (optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = Array.from(e.target.files);
                        if (!files.length) return;
                        setTestimonialImageUploading(true);
                        try {
                          const urls = await Promise.all(
                            files.map((f) => uploadTestimonialImage(f)),
                          );
                          setTestimonialForm((prev) => ({
                            ...prev,
                            images: [...prev.images, ...urls],
                          }));
                        } catch {
                          showToast('Failed to upload one or more images', 'error');
                        }
                        setTestimonialImageUploading(false);
                      }}
                      className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:border-0 file:text-xs file:bg-gray-100 file:hover:bg-gray-200 file:cursor-pointer"
                    />
                    {testimonialImageUploading && (
                      <p className="text-xs text-gray-500 mt-1">Uploading...</p>
                    )}
                    {testimonialForm.images.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {testimonialForm.images.map((url, i) => (
                          <div key={i} className="relative w-16 h-16">
                            <img
                              src={url}
                              alt=""
                              className="w-full h-full object-cover rounded border"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setTestimonialForm((prev) => ({
                                  ...prev,
                                  images: prev.images.filter((_, j) => j !== i),
                                }))
                              }
                              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!testimonialForm.content || testimonialForm.content.length < 10) {
                        showToast('Please write at least 10 characters.', 'error');
                        return;
                      }
                      try {
                        await submitTestimonial.mutateAsync(testimonialForm);
                        setTestimonialSubmitted(true);
                      } catch (err) {
                        const msg = err?.response?.data?.error || 'Failed to submit testimonial';
                        showToast(msg, 'error');
                      }
                    }}
                    disabled={submitTestimonial.isPending || testimonialImageUploading}
                    className="px-6 py-3 rounded-full bg-heritage-charcoal text-white text-xs uppercase tracking-widest hover:bg-heritage-brown transition-colors"
                  >
                    {submitTestimonial.isPending ? 'Submitting...' : 'Submit Testimonial'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      case 'notifications':
        return <NotificationsPanel />;
      case 'payouts':
        return null;
      default:
        return null;
    }
  };

  if (showPasswordSetup) {
    return (
      <div className="min-h-screen bg-secondary-bg">
        <SEO
          title="Set Your Password - The Collectors Exchange"
          description=""
          canonical="/account"
          noindex
        />
        <div className="container mx-auto py-20 px-6 max-w-xl">
          <Reveal
            as="div"
            direction="up"
            className="bg-white p-6 sm:p-10 rounded-2xl shadow-heritage border border-gray-100 space-y-6"
          >
            <div className="text-center mb-4">
              <h1 className="text-3xl font-serif mb-3">Set Your Password</h1>
              <p className="text-gray-500 font-light">
                Your email has been verified. Choose a password to secure your account.
              </p>
            </div>
            <form onSubmit={handleSetPassword} className="space-y-6">
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordForm.password}
                  onChange={(e) => setPasswordForm({ ...passwordForm, password: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors"
                  placeholder="Min 8 chars, uppercase, lowercase, number"
                />
              </div>
              <div>
                <label className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={passwordForm.confirm}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                  className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors"
                  placeholder="Re-enter your password"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-black text-white py-5 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors duration-300"
              >
                Set Password
              </button>
            </form>
          </Reveal>
        </div>
      </div>
    );
  }

  // Mobile only. Anchors the drilled-into section: names where you are and offers
  // the way back to the index. Sticky so it survives the very long sections.
  const renderMobileSectionHeader = () => (
    <div
      className="lg:hidden sticky z-30 bg-white/95 backdrop-blur border-b border-gray-100 shadow-sm"
      style={{ top: 'var(--header-h, 4rem)' }}
    >
      <div className="flex items-center gap-1 h-14 px-2">
        <button
          type="button"
          onClick={closeSection}
          aria-label="Back to account menu"
          className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full text-heritage-charcoal transition-colors hover:bg-heritage-cream focus:outline-none focus-visible:ring-2 focus-visible:ring-luxury-gold cursor-pointer"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold">
            Account
          </p>
          <p className="truncate font-serif text-base leading-tight text-heritage-charcoal">
            {activeSection?.label}
          </p>
        </div>
      </div>
    </div>
  );

  // Mobile only. A full-width row per section — icon, label, context and a chevron
  // — in place of the horizontally-scrolling pills. Every section is on screen at
  // 375px and every target clears 44px.
  const renderMobileSectionIndex = () => (
    <div className="lg:hidden">
      <div className="bg-white border border-gray-100 rounded-2xl shadow-heritage p-5 mb-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-heritage-cream flex flex-shrink-0 items-center justify-center text-heritage-bronze">
            <User size={24} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-luxury-gold mb-1">
              {localUser.type}
            </p>
            <h1 className="font-serif text-xl text-heritage-charcoal truncate">{localUser.name}</h1>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
        </div>
      </div>

      <nav
        aria-label="Account sections"
        className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-heritage divide-y divide-gray-100"
      >
        {sections.map(({ id, label, icon: Icon, hint, badge }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className="group flex w-full min-h-[64px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-heritage-cream/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-luxury-gold cursor-pointer"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-heritage-cream text-heritage-bronze transition-colors group-hover:text-luxury-gold">
              <Icon size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-serif text-base text-heritage-charcoal">{label}</span>
                {badge > 0 && (
                  <span
                    aria-hidden="true"
                    className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-luxury-gold px-1.5 text-[10px] font-bold text-white"
                  >
                    {badge > 9 ? '9+' : badge}
                  </span>
                )}
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">{hint}</span>
            </span>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-luxury-gold"
            />
          </button>
        ))}
        {vendorProfile?.status === 'APPROVED' && (
          <Link
            to="/vendor-dashboard"
            className="group flex w-full min-h-[64px] items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-heritage-cream/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-luxury-gold"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center bg-heritage-cream text-heritage-bronze transition-colors group-hover:text-luxury-gold">
              <BarChart3 size={18} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-base text-heritage-charcoal">
                Vendor Dashboard
              </span>
              <span className="mt-0.5 block truncate text-xs text-gray-500">
                Sales performance and payouts
              </span>
            </span>
            <ChevronRight
              size={18}
              aria-hidden="true"
              className="flex-shrink-0 text-gray-300 transition-colors group-hover:text-luxury-gold"
            />
          </Link>
        )}
      </nav>

      <button
        type="button"
        onClick={handleLogout}
        className="mt-4 flex w-full min-h-[56px] items-center justify-center gap-3 border border-gray-100 bg-white px-4 text-sm font-medium uppercase tracking-widest text-red-600 shadow-heritage transition-colors hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400 cursor-pointer"
      >
        <LogOut size={16} aria-hidden="true" /> Sign Out
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-secondary-bg">
      <SEO
        title="My Account"
        description="Manage your profile, orders, and seller account on The Collectors Exchange."
        canonical="/account"
        noindex
      />
      {sectionOpen && renderMobileSectionHeader()}
      <div className="container mx-auto py-8 sm:py-12 lg:py-16 px-4 sm:px-6">
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-12">
          {/* Desktop Sidebar */}
          <div className="hidden lg:block lg:w-1/4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 lg:sticky lg:top-24">
              <div className="p-8 border-b border-gray-100 text-center">
                <div className="w-20 h-20 rounded-full bg-heritage-cream mx-auto flex items-center justify-center mb-4 text-heritage-bronze">
                  <User size={32} aria-hidden="true" />
                </div>
                <h2 className="font-serif text-xl mb-1">{localUser.name}</h2>
                <p className="text-xs text-gray-500 uppercase tracking-widest border px-2 py-0.5 inline-block rounded-sm border-gray-200">
                  {localUser.type}
                </p>
              </div>
              <nav aria-label="Account sections" className="p-4 space-y-1">
                {sections.map(({ id, label, icon: Icon, badge }) => {
                  const isActive = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative flex items-center gap-4 w-full p-4 text-sm font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-luxury-gold ${isActive ? 'bg-heritage-charcoal text-white shadow-md' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-0 bottom-0 w-0.5 bg-luxury-gold"
                        />
                      )}
                      <Icon size={18} aria-hidden="true" />
                      <span className="flex-1 text-left">{label}</span>
                      {badge > 0 && (
                        <span
                          aria-hidden="true"
                          className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${isActive ? 'bg-white text-heritage-charcoal' : 'bg-luxury-gold text-white'}`}
                        >
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </button>
                  );
                })}
                {vendorProfile?.status === 'APPROVED' && (
                  <Link
                    to="/vendor-dashboard"
                    className="flex items-center gap-4 w-full p-4 text-sm font-medium transition-all text-gray-600 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-luxury-gold"
                  >
                    <BarChart3 size={18} aria-hidden="true" /> Vendor Dashboard
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-4 w-full p-4 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors mt-8 border-t border-gray-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-400"
                >
                  <LogOut size={18} aria-hidden="true" /> Sign Out
                </button>
              </nav>
            </div>
          </div>

          {/* Mobile section index — replaced by the section itself once one is open */}
          {!sectionOpen && renderMobileSectionIndex()}

          {/* Main Content — always rendered on desktop; on mobile only once a
              section has been opened, so the index reads as a screen of its own. */}
          <div className={`w-full lg:w-3/4 ${sectionOpen ? '' : 'hidden lg:block'}`}>
            <Reveal key={activeTab} as="div" direction="up">
              {renderContent()}
            </Reveal>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;

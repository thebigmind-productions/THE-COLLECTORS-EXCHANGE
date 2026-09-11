import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import SEO, { ProductSchema, BreadcrumbSchema } from '../components/SEO';
import {
  ShieldCheck,
  Heart,
  ChevronRight,
  ChevronDown,
  Share2,
  Info,
  Loader2,
  Check,
  ArrowRight,
  Gem,
  Award,
  ImageOff,
  XCircle,
  MessageCircle,
  ShoppingBag,
  Truck,
  ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useProduct, useProducts } from '../hooks/api/useProducts';
import { useComparisonPlatforms } from '../hooks/api/useComparisonPlatforms';
import { useAddToWishlist, useRemoveFromWishlist, useWishlist } from '../hooks/api/useWishlist';
import { useCart, useAddToCart } from '../hooks/api/useCart';
import { useProductReviews } from '../hooks/api/useReviews';
import { getUser } from '../utils/storage';
import { imageUrl, imageSrcSet } from '../utils/image';
import apiClient from '../hooks/api/apiClient';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import { Reveal, Parallax, Magnetic, Tilt } from '../components/Motion';
import ReviewList from '../components/ReviewList';
import { whatsAppHref, mailtoHref } from '../config/contact';
import {
  DISPATCH_DAYS,
  DELIVERY_DAYS,
  INSPECTION_HOURS,
  SHIPPING_COST_COPY,
} from '../config/shipping';

const ProductDetail = () => {
  const { id } = useParams();
  const { data: product, isLoading } = useProduct(id);
  const { data: reviewsData } = useProductReviews(id);
  const { data: comparisonPlatforms } = useComparisonPlatforms();
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);
  const [selectedQty, setSelectedQty] = useState(1);
  const [cartAdded, setCartAdded] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);

  const currentUser = getUser();
  const showToast = useToast();
  const confirm = useConfirm();
  const { data: wishlistItems = [] } = useWishlist(currentUser?.id);
  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const { data: cartItems = [] } = useCart(currentUser?.id);
  const addToCartMutation = useAddToCart();

  const inWishlist = wishlistItems.some((item) => item.productId === product?.id);
  const inCart = cartItems.some(
    (item) => item.productId === product?.id || item.product?.id === product?.id,
  );

  const shareCopiedTimer = useRef(null);
  const cartAddedTimer = useRef(null);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShareCopied(true);
    clearTimeout(shareCopiedTimer.current);
    shareCopiedTimer.current = setTimeout(() => setShareCopied(false), 2000);
  };

  useEffect(() => {
    return () => {
      clearTimeout(shareCopiedTimer.current);
      clearTimeout(cartAddedTimer.current);
    };
  }, []);

  // Mirrors the grid card in Category.jsx (ArchiveProductCard): await the
  // mutation so a failure is surfaced rather than swallowed, and ignore
  // clicks while one is in flight so a double-click can't post twice.
  const handleAddToCart = async () => {
    if (!product || product.status === 'Sold') return;
    if (!currentUser) {
      // The signed-out CTA is a link into /account, so this only fires if the
      // session expired between render and click.
      showToast('Please sign in to add items to cart', 'error');
      return;
    }
    if (inCart || addToCartMutation.isPending || cartAdded) return;
    try {
      await addToCartMutation.mutateAsync({ userId: currentUser.id, productId: product.id });
      apiClient.post('/analytics/cart', { productId: product.id, action: 'ADD' }).catch(() => {});
      setCartAdded(true);
      clearTimeout(cartAddedTimer.current);
      cartAddedTimer.current = setTimeout(() => setCartAdded(false), 2000);
    } catch (err) {
      if (err?.response?.status === 401) {
        showToast('Please sign in to add items to cart', 'error');
      } else {
        showToast(
          err?.response?.data?.message || err?.response?.data?.error || 'Failed to add to cart',
          'error',
        );
      }
    }
  };

  const handleWishlistToggle = async () => {
    if (!product || !currentUser) return;
    if (inWishlist && !(await confirm('Remove this item from your wishlist?'))) return;
    try {
      if (inWishlist) {
        await removeFromWishlistMutation.mutateAsync({
          userId: currentUser.id,
          productId: product.id,
        });
      } else {
        await addToWishlistMutation.mutateAsync({ userId: currentUser.id, productId: product.id });
      }
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to update wishlist', 'error');
    }
  };

  // Track product view
  const tracked = useRef(false);
  useEffect(() => {
    tracked.current = false;
    if (product && !tracked.current) {
      tracked.current = true;
      apiClient
        .post('/analytics/view', {
          productId: product.id,
          sessionId: localStorage.getItem('session_id') || `anon_${Date.now()}`,
        })
        .catch(() => {});
    }
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="hero-bleed min-h-screen flex flex-col items-center justify-center bg-white">
        <Helmet>
          <title>Product - The Collectors Exchange</title>
        </Helmet>
        <Loader2 className="animate-spin text-luxury-gold mb-4" size={48} />
        <p className="text-gray-500 font-serif text-xl italic">Retrieving Item Records...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Helmet>
          <title>Product - The Collectors Exchange</title>
        </Helmet>
        <div className="text-center">
          <h2 className="text-2xl font-serif text-gray-500">Item Not Found</h2>
          <Link to="/category" className="text-luxury-gold hover:underline mt-4 inline-block">
            Return to The Exchange
          </Link>
        </div>
      </div>
    );
  }

  const images = product.images?.length > 0 ? product.images : product.image ? [product.image] : [];

  // Shared by every state the primary CTA can be in (button or link), so the
  // three branches below only differ by colour and label.
  const primaryCtaClass =
    'flex-1 py-3 sm:py-5 rounded-full text-[10px] sm:text-sm uppercase tracking-widest font-medium transition-colors flex items-center justify-center gap-1.5 sm:gap-3 shadow-lg';

  const conditionReportRequest = `Hi, could I please see the detailed condition report for "${product.title}" (item ${product.id})? ${window.location.href}`;
  const conditionReportMailto = mailtoHref(
    `Condition report request: ${product.title}`,
    conditionReportRequest,
  );
  const conditionReportWhatsApp = whatsAppHref(conditionReportRequest);

  const breadcrumbItems = [
    { name: 'Home', url: '/' },
    { name: 'The Exchange', url: '/category' },
    { name: product.category, url: '/category' },
    { name: product.title, url: `/product/${product.id}` },
  ];

  return (
    // hero-bleed pulls the page's own background up behind the floating nav
    // so the generic layout background doesn't show through as a seam.
    <div className="hero-bleed min-h-screen bg-white">
      <SEO
        title={product.title}
        description={
          product.description?.replace(/<[^>]*>/g, '')?.substring(0, 160) ||
          `${product.category} collectible at ₹${product.price?.toLocaleString()}. Verified by The Collectors Exchange.`
        }
        canonical={`/product/${product.id}`}
        image={product.images?.[0] || product.image}
        ogType="product"
      />
      <ProductSchema product={product} reviews={reviewsData} />
      <BreadcrumbSchema items={breadcrumbItems} />
      {/* Breadcrumbs */}
      <div className="hidden sm:block border-b border-gray-100 bg-gray-50/50">
        <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center text-xs text-gray-500 uppercase tracking-widest gap-2 overflow-x-auto scrollbar-hide whitespace-nowrap">
            <Link to="/" className="hover:text-luxury-gold shrink-0">
              Home
            </Link>
            <ChevronRight size={10} className="sm:w-3 sm:h-3 shrink-0" />
            <Link to="/category" className="hover:text-luxury-gold shrink-0">
              The Exchange
            </Link>
            <ChevronRight size={10} className="sm:w-3 sm:h-3 shrink-0" />
            <span className="text-gray-800 font-medium truncate">{product.category}</span>
          </div>
        </div>
      </div>

      {/* Top Row */}
      <div className="container mx-auto px-4 sm:px-6 pt-4 sm:pt-12 md:pt-20">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-12 lg:gap-16">
          {/* Left: Main Image + Thumbnails */}
          <div className="w-full lg:w-3/5 flex gap-2 sm:gap-4 order-1">
            {/* Thumbnails — capped to the main image's own max-height and
                scrollable, so a listing with many photos doesn't stretch the
                whole gallery column far past the image it belongs next to. */}
            {images.length > 1 && (
              <div className="flex flex-col gap-1 sm:gap-3 w-12 sm:w-16 md:w-20 shrink-0 max-h-[500px] sm:max-h-[600px] overflow-y-auto scrollbar-hide pr-0.5">
                {images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveImageIndex(idx)}
                    className={`aspect-square rounded-xl overflow-hidden border-2 shrink-0 transition-all ${activeImageIndex === idx ? 'border-luxury-gold ring-1 ring-luxury-gold/50' : 'border-gray-100 hover:border-gray-300'}`}
                  >
                    <img
                      loading="lazy"
                      decoding="async"
                      width="80"
                      height="80"
                      src={imageUrl(img, 200, { resize: 'cover', height: 200 })}
                      alt={`View ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
            {/* Main Image */}
            <Reveal
              direction="left"
              blur
              distance={90}
              className="relative flex-1 min-h-[300px] sm:min-h-[400px] max-h-[500px] sm:max-h-[600px]"
            >
              <Parallax speed={0.1} className="h-full">
                <div className="relative h-full rounded-2xl bg-gray-50 overflow-hidden shadow-sm border border-gray-100 group">
                  {images.length > 0 ? (
                    <>
                      {/* Desktop zoom version */}
                      <div
                        className="w-full h-full hidden lg:block"
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = ((e.clientX - rect.left) / rect.width) * 100;
                          const y = ((e.clientY - rect.top) / rect.height) * 100;
                          e.currentTarget.querySelector('img').style.transformOrigin =
                            `${x}% ${y}%`;
                        }}
                      >
                        <img
                          width="800"
                          height="600"
                          src={imageUrl(images[activeImageIndex], 1200)}
                          srcSet={imageSrcSet(images[activeImageIndex], [400, 800, 1200])}
                          sizes="(min-width: 1024px) 60vw, 100vw"
                          loading="eager"
                          fetchPriority="high"
                          decoding="async"
                          alt={product.title}
                          className="w-full h-full object-contain p-2 sm:p-6 md:p-8 transition-transform duration-300 ease-out lg:group-hover:scale-150"
                        />
                      </div>
                      {/* Mobile fallback */}
                      {/* Same src/srcSet/sizes as the desktop zoom copy above:
                          both are always in the DOM (only one is displayed) and
                          browsers still fetch images inside display:none, so
                          matching candidate lists keeps it to one download. */}
                      <img
                        width="800"
                        height="600"
                        src={imageUrl(images[activeImageIndex], 1200)}
                        srcSet={imageSrcSet(images[activeImageIndex], [400, 800, 1200])}
                        sizes="(min-width: 1024px) 60vw, 100vw"
                        loading="eager"
                        fetchPriority="high"
                        decoding="async"
                        alt={product.title}
                        className="w-full h-full object-contain p-2 sm:p-6 md:p-8 block lg:hidden"
                      />
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ImageOff size={48} strokeWidth={1} />
                    </div>
                  )}
                  {product.isVerified && (
                    <div className="absolute top-2 sm:top-6 left-2 sm:left-6 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-full px-2 sm:px-4 py-1 sm:py-2 flex items-center gap-1 sm:gap-2 shadow-sm">
                      <ShieldCheck size={12} className="sm:w-4 sm:h-4 text-green-700" />
                      <span className="text-[9px] sm:text-xs font-bold uppercase tracking-widest text-gray-800">
                        Verified Authentic
                      </span>
                    </div>
                  )}
                </div>
              </Parallax>
            </Reveal>
          </div>

          {/* Right: Product Info */}
          <Reveal direction="right" className="w-full lg:w-2/5 order-2">
            <div className="mb-4 sm:mb-8">
              <div className="flex items-center flex-wrap gap-1.5 sm:gap-3 mb-2 sm:mb-4">
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-heritage-cream text-heritage-bronze text-[9px] sm:text-xs font-bold uppercase tracking-widest">
                  {product.category}
                </span>
                {product.condition && (
                  <span className="text-[9px] sm:text-xs text-gray-500 uppercase tracking-widest border border-gray-200 px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full">
                    {product.condition}
                  </span>
                )}
                {product.listingCategory && product.listingCategory !== 'normal' && (
                  <span
                    className={`text-[10px] sm:text-xs px-2 py-0.5 rounded-full uppercase tracking-widest font-semibold ${product.listingCategory === 'most_rare' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}
                  >
                    {product.listingCategory === 'most_rare'
                      ? 'Most Rare'
                      : product.listingCategory === 'featured'
                        ? 'Featured'
                        : product.listingCategory}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-3xl md:text-4xl lg:text-5xl font-serif text-heritage-charcoal leading-tight mb-2 sm:mb-6">
                {product.title}
              </h1>
              <p className="text-xl sm:text-3xl font-light text-heritage-charcoal">
                ₹{product.price?.toLocaleString()}
              </p>
              {product.brand && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2 uppercase tracking-wider">
                  {product.brand}
                </p>
              )}
            </div>

            {/* Seller Info */}
            {product.seller && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest mb-0.5 sm:mb-1">
                  Brokered By
                </p>
                <p className="font-serif text-sm sm:text-base font-medium text-heritage-charcoal">
                  {product.seller.role === 'admin' ||
                  product.seller.role === 'superadmin' ||
                  product.seller.role === 'curator'
                    ? 'THE COLLECTORS EXCHANGE'
                    : product.seller.name || 'The Collectors Exchange'}
                </p>
                {product.seller.type === 'company' && (
                  <span className="text-[9px] sm:text-[10px] text-luxury-gold uppercase tracking-wider">
                    Verified Company
                  </span>
                )}
                {product.seller.vendor && product.seller.vendor.ratingCount > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <span
                        key={star}
                        className={`text-xs ${star <= Math.round(product.seller.vendor.rating) ? 'text-amber-400' : 'text-gray-300'}`}
                      >
                        &#9733;
                      </span>
                    ))}
                    <span className="text-[10px] text-gray-500 ml-1">
                      ({product.seller.vendor.ratingCount})
                    </span>
                  </div>
                )}
              </div>
            )}

            {product.status !== 'Sold' && (product.quantity ?? 1) === 1 && (
              <div className="flex items-center gap-2 mt-4">
                <Gem size={14} className="text-luxury-gold" />
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-luxury-gold font-bold">
                  One of One: Once Sold, Gone
                </span>
              </div>
            )}

            {product.status !== 'Sold' && (product.quantity ?? 1) > 1 && (
              <div className="flex items-center gap-3 mt-4">
                <span className="text-[10px] sm:text-xs uppercase tracking-widest text-gray-500 font-medium">
                  Qty
                </span>
                <div className="flex items-center rounded-full border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setSelectedQty(Math.max(1, selectedQty - 1))}
                    className="px-3 py-1.5 text-gray-500 hover:text-heritage-charcoal transition-colors"
                  >
                    −
                  </button>
                  <span className="px-4 py-1.5 text-sm font-medium min-w-[2rem] text-center">
                    {selectedQty}
                  </span>
                  <button
                    onClick={() => setSelectedQty(Math.min(product.quantity ?? 1, selectedQty + 1))}
                    disabled={selectedQty >= (product.quantity ?? 1)}
                    className="px-3 py-1.5 text-gray-500 hover:text-heritage-charcoal transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
                {(product.quantity ?? 1) <= 5 && (
                  <span className="text-[10px] text-amber-600 font-medium">
                    Only {product.quantity ?? 1} left
                  </span>
                )}
              </div>
            )}

            {/* Actions — Add to Cart is the primary CTA so checkout (COD or
                WhatsApp) is reachable from the page where intent is highest;
                "Reserve via WhatsApp" stays available as the secondary path. */}
            <div className="mt-3 space-y-2 sm:space-y-3">
              <div className="flex gap-2 sm:gap-4">
                {product.status === 'Sold' ? (
                  <div className="flex-1 py-3 sm:py-5 rounded-full text-[10px] sm:text-sm uppercase tracking-widest font-medium flex items-center justify-center gap-1.5 sm:gap-3 bg-gray-100 text-gray-500 cursor-default">
                    <XCircle size={14} className="sm:w-[18px] sm:h-[18px]" />
                    Sold Out
                  </div>
                ) : !currentUser ? (
                  // Signed out: a link into sign-in beats a dead-end toast.
                  <Magnetic className="flex-1 flex">
                    <Link
                      to="/account"
                      className={`${primaryCtaClass} bg-heritage-charcoal text-white hover:bg-heritage-brown`}
                    >
                      <ShoppingBag size={14} className="sm:w-[18px] sm:h-[18px]" />
                      Sign In to Add to Cart
                    </Link>
                  </Magnetic>
                ) : inCart ? (
                  <Magnetic className="flex-1 flex">
                    <Link
                      to="/cart"
                      className={`${primaryCtaClass} bg-luxury-gold text-white hover:bg-luxury-gold/90`}
                    >
                      <ShoppingBag size={14} className="sm:w-[18px] sm:h-[18px]" />
                      In Cart &rarr;
                    </Link>
                  </Magnetic>
                ) : (
                  <Magnetic className="flex-1 flex">
                    <button
                      onClick={handleAddToCart}
                      disabled={addToCartMutation.isPending || cartAdded}
                      className={`${primaryCtaClass} disabled:cursor-default ${
                        cartAdded
                          ? 'bg-luxury-gold text-white'
                          : 'bg-heritage-charcoal text-white hover:bg-heritage-brown'
                      }`}
                    >
                      {cartAdded ? (
                        <Check size={14} className="sm:w-[18px] sm:h-[18px]" />
                      ) : (
                        <ShoppingBag size={14} className="sm:w-[18px] sm:h-[18px]" />
                      )}
                      {addToCartMutation.isPending
                        ? 'Adding...'
                        : cartAdded
                          ? 'Added to Cart'
                          : 'Add to Cart'}
                    </button>
                  </Magnetic>
                )}
                <button
                  onClick={handleWishlistToggle}
                  disabled={
                    !currentUser ||
                    addToWishlistMutation.isPending ||
                    removeFromWishlistMutation.isPending
                  }
                  className={`px-3 sm:px-6 rounded-full border transition-colors ${
                    inWishlist
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-gray-200 hover:border-heritage-charcoal text-gray-500 hover:text-heritage-charcoal'
                  } disabled:opacity-40`}
                >
                  <Heart
                    size={16}
                    className="sm:w-5 sm:h-5"
                    fill={inWishlist ? 'currentColor' : 'none'}
                  />
                </button>
                <button
                  onClick={handleShare}
                  title={shareCopied ? 'Link copied' : 'Share this item'}
                  aria-label={shareCopied ? 'Link copied' : 'Share this item'}
                  className="px-3 sm:px-6 rounded-full border border-gray-200 hover:border-heritage-charcoal text-gray-500 hover:text-heritage-charcoal transition-colors"
                >
                  {shareCopied ? (
                    <Check size={16} className="sm:w-5 sm:h-5 text-green-600" />
                  ) : (
                    <Share2 size={16} className="sm:w-5 sm:h-5" />
                  )}
                </button>
              </div>

              {product.status !== 'Sold' && (
                <a
                  href={whatsAppHref(
                    `Hi, I'm interested in "${product?.title}" (Qty: ${selectedQty}). Here's the product link: ${window.location.href}`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 sm:py-4 rounded-full text-[10px] sm:text-sm uppercase tracking-widest font-medium transition-colors flex items-center justify-center gap-1.5 sm:gap-3 border border-gray-200 text-heritage-charcoal hover:border-[#25D366] hover:text-[#128C4A]"
                >
                  <MessageCircle size={14} className="sm:w-[18px] sm:h-[18px]" />
                  Reserve via WhatsApp
                </a>
              )}
            </div>

            {/* Shipping & Returns — the cost, the timings and the returns
                policy a buyer needs before committing, sourced from
                src/config/shipping.js so the page cannot drift from
                /returns, /faq and checkout. */}
            <div className="mt-4 sm:mt-6 rounded-xl border border-gray-200">
              <button
                type="button"
                onClick={() => setShippingOpen((open) => !open)}
                aria-expanded={shippingOpen}
                className="w-full flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 text-left"
              >
                <Truck size={16} className="sm:w-5 sm:h-5 text-luxury-gold flex-shrink-0" />
                <span className="flex-1 font-serif text-xs sm:text-sm md:text-base font-medium text-black">
                  Shipping &amp; Returns
                </span>
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`text-gray-500 transition-transform ${shippingOpen ? 'rotate-180' : ''}`}
                />
              </button>
              {shippingOpen && (
                <ul className="px-3 sm:px-4 pb-3 sm:pb-4 space-y-1.5 text-[11px] sm:text-xs text-gray-600 leading-relaxed">
                  <li>{SHIPPING_COST_COPY}</li>
                  <li>Dispatched within {DISPATCH_DAYS} business days of payment confirmation.</li>
                  <li>Delivered in {DELIVERY_DAYS} business days across India.</li>
                  <li>
                    {INSPECTION_HOURS}-hour inspection window from delivery &mdash;{' '}
                    <Link to="/returns" className="text-luxury-gold underline">
                      read the returns policy
                    </Link>
                    .
                  </li>
                </ul>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="grid grid-cols-1 gap-2 sm:gap-3 mt-4 sm:mt-6">
              <div
                className="flex gap-2 sm:gap-3 items-start"
                title="Every item is verified by our expert team before shipping."
              >
                <ShieldCheck
                  size={16}
                  className="sm:w-5 sm:h-5 text-luxury-gold flex-shrink-0 mt-0.5"
                />
                <div>
                  <h4 className="font-serif text-xs sm:text-sm md:text-base font-medium text-black">
                    Authenticity Guarantee
                  </h4>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
                    Every item is verified by our expert team before shipping.
                  </p>
                </div>
              </div>
              <div
                className="flex gap-2 sm:gap-3 items-start"
                title="Insured shipping and secure ownership transfer."
              >
                <ShieldCheck
                  size={16}
                  className="sm:w-5 sm:h-5 text-luxury-gold flex-shrink-0 mt-0.5"
                />
                <div>
                  <h4 className="font-serif text-xs sm:text-sm md:text-base font-medium text-black">
                    Secure Transfer
                  </h4>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
                    Insured shipping and secure ownership transfer.
                  </p>
                </div>
              </div>
              {/* Was a dead line of text ("available on request") with no way to
                  request it. Now two real actions, prefilled with the item. */}
              <div className="flex gap-2 sm:gap-3 items-start">
                <Info size={16} className="sm:w-5 sm:h-5 text-luxury-gold flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-serif text-xs sm:text-sm md:text-base font-medium text-black">
                    Condition Report
                  </h4>
                  <p className="text-[10px] sm:text-xs text-gray-500 leading-relaxed">
                    Request a detailed condition assessment for this piece by{' '}
                    <a href={conditionReportMailto} className="text-luxury-gold underline">
                      email
                    </a>{' '}
                    or{' '}
                    <a
                      href={conditionReportWhatsApp}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-luxury-gold underline"
                    >
                      WhatsApp
                    </a>
                    .
                  </p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>

      {/* Below: Full-width content */}
      <div className="container mx-auto px-4 sm:px-6 pb-12 md:pb-20">
        <div className="max-w-4xl mx-auto space-y-8 sm:space-y-12 mt-8 sm:mt-16 pt-8 sm:pt-16">
          {/* Decorative section divider — centered gold micro-line replaces a
              bare gray hairline (see DESIGN.md dividers convention). */}
          <div className="w-12 h-px bg-luxury-gold/50 mx-auto" />
          {/* Provenance & Story */}
          <div>
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 sm:mb-6">
              Provenance & Story
            </h3>
            <div className="font-serif text-gray-700 text-sm sm:text-lg leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => <p className="mb-4 sm:mb-6 last:mb-0">{children}</p>,
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 sm:pl-6 mb-4 sm:mb-6 space-y-1 sm:space-y-2">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 sm:pl-6 mb-4 sm:mb-6 space-y-1 sm:space-y-2">
                      {children}
                    </ol>
                  ),
                  h1: ({ children }) => (
                    <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 mt-6 sm:mt-8">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 mt-4 sm:mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base sm:text-lg font-bold mb-2 mt-3 sm:mt-4">{children}</h3>
                  ),
                  strong: ({ children }) => <strong className="font-bold">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      className="text-luxury-gold underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-4 border-luxury-gold/30 pl-3 sm:pl-4 italic text-heritage-brown/70 my-4 sm:my-6">
                      {children}
                    </blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-gray-50 px-1.5 py-0.5 text-[11px] sm:text-sm rounded">
                        {children}
                      </code>
                    ) : (
                      <pre className="bg-gray-50 p-3 sm:p-4 rounded overflow-x-auto mb-4 sm:mb-6">
                        <code className="bg-transparent p-0 text-[11px] sm:text-sm">
                          {children}
                        </code>
                      </pre>
                    );
                  },
                  hr: () => <hr className="border-gray-200 my-4 sm:my-6" />,
                }}
              >
                {product.description}
              </ReactMarkdown>
            </div>
          </div>

          {/* Specifications Table */}
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
                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 sm:mb-6">
                  Specifications
                </h3>
                <div className="rounded-xl overflow-hidden border border-gray-100">
                  {specs.map((spec, index) => (
                    <div
                      key={index}
                      className={`flex text-sm sm:text-base ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <span className="w-2/5 sm:w-1/3 px-3 sm:px-5 py-2.5 sm:py-3.5 font-medium text-heritage-charcoal border-r border-gray-100">
                        {spec.key}
                      </span>
                      <span className="flex-1 px-3 sm:px-5 py-2.5 sm:py-3.5 text-gray-600">
                        {spec.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Compare Elsewhere — competitor pricing set by the seller (optional)
              or overwritten by an admin. Every active platform renders, even
              with no link, so the grid never looks like something is missing —
              it just reads as "not listed there" on hover. */}
          {Array.isArray(comparisonPlatforms) && comparisonPlatforms.length > 0 && (
            <Reveal as="div">
              <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-3 sm:mb-6">
                Compare Elsewhere
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {comparisonPlatforms.map((platform) => {
                  const entry = Array.isArray(product.comparisons)
                    ? product.comparisons.find((c) => c.platformId === platform.id)
                    : null;

                  if (!entry) {
                    return (
                      <div
                        key={platform.id}
                        className="group relative rounded-xl border border-gray-100 bg-gray-50 p-4 text-center cursor-not-allowed overflow-hidden"
                      >
                        <p className="text-sm font-medium text-gray-400 grayscale">
                          {platform.name}
                        </p>
                        <div className="max-h-0 opacity-0 group-hover:max-h-6 group-hover:opacity-100 group-focus-within:max-h-6 group-focus-within:opacity-100 transition-all duration-300 overflow-hidden">
                          <p className="text-[11px] text-gray-400 mt-1.5">Not available</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={platform.id}
                      href={entry.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative rounded-xl border border-gray-100 hover:border-luxury-gold/40 bg-white hover:shadow-heritage p-4 text-center transition-colors duration-300 overflow-hidden"
                    >
                      <p className="text-sm font-medium text-heritage-charcoal flex items-center justify-center gap-1.5">
                        {platform.name}
                        <ExternalLink
                          size={12}
                          className="text-gray-400 group-hover:text-luxury-gold transition-colors"
                        />
                      </p>
                      <div className="max-h-0 opacity-0 group-hover:max-h-6 group-hover:opacity-100 group-focus-within:max-h-6 group-focus-within:opacity-100 transition-all duration-300 overflow-hidden">
                        {typeof entry.price === 'number' ? (
                          <p className="text-[11px] font-semibold text-luxury-gold mt-1.5">
                            ₹{entry.price.toLocaleString('en-IN')}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-500 mt-1.5">View listing</p>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            </Reveal>
          )}

          {/* Trust Indicators */}
          {product.isVerified && (
            <div className="rounded-2xl bg-heritage-cream border border-luxury-gold/20 p-3 sm:p-6">
              <div className="flex items-start gap-2 sm:gap-4">
                <ShieldCheck size={20} className="sm:w-8 sm:h-8 text-green-700 flex-shrink-0" />
                <div>
                  <h4 className="font-serif text-sm sm:text-base font-medium text-heritage-charcoal mb-0.5 sm:mb-1">
                    The Exchange's Guarantee
                  </h4>
                  <p className="text-[11px] sm:text-sm text-heritage-charcoal/70 leading-relaxed">
                    This item is marked <strong>Verified Authentic</strong> by The Collectors
                    Exchange. When you purchase this item, you receive our unconditional guarantee
                    of authenticity, backed by our expert curation team.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      {(reviewsData?.total ?? 0) > 0 && (
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-10">
          {/* Decorative section divider — centered gold micro-line replaces a
              bare gray hairline (see DESIGN.md dividers convention). */}
          <div className="w-12 h-px bg-luxury-gold/50 mx-auto mb-8" />
          <h3 className="text-lg sm:text-xl font-serif text-heritage-charcoal mb-6">
            Customer Reviews
          </h3>
          <ReviewList reviews={reviewsData?.data || []} total={reviewsData?.total || 0} />
        </div>
      )}

      {/* Suggested Products */}
      <SuggestedProducts category={product.category} currentId={product.id} />
    </div>
  );
};

const SuggestedProducts = ({ category, currentId }) => {
  const { data, isLoading } = useProducts(category, '', 1, 8);
  const products = (data?.products || []).filter((p) => p.id !== currentId).slice(0, 4);

  if (products.length === 0 && !isLoading) return null;

  return (
    <section className="relative py-12 sm:py-20 px-4 sm:px-6 bg-heritage-cream">
      {/* Decorative full-bleed section boundary — soft fade replaces a bare
          gray hairline (see DESIGN.md dividers convention). Absolutely
          positioned at the section's top edge so it doesn't add extra
          vertical spacing beyond what the border-t it replaces used to. */}
      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
      <div className="container mx-auto max-w-6xl">
        <div className="flex items-center justify-between mb-6 sm:mb-10">
          <div>
            <h2 className="text-xl sm:text-3xl lg:text-4xl font-serif text-heritage-charcoal">
              Suggested <span className="text-luxury-gold italic font-light">Products</span>
            </h2>
            <p className="text-heritage-bronze/70 font-sans text-xs sm:text-sm mt-1 sm:mt-2">
              You may also be interested in
            </p>
          </div>
          <Link
            to="/category"
            className="flex items-center gap-1 sm:gap-2 text-heritage-charcoal/70 hover:text-luxury-gold text-[10px] sm:text-xs uppercase tracking-widest transition-colors border-b border-transparent hover:border-luxury-gold pb-0.5"
          >
            View All <ArrowRight size={10} className="sm:w-[14px] sm:h-[14px]" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl overflow-hidden bg-white border border-heritage-beige animate-pulse"
                >
                  <div className="aspect-square bg-gray-200" />
                  <div className="p-4 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
              ))
            : products.map((product) => {
                const title = product.title || product.name;
                return (
                  <Tilt key={product.id} className="h-full">
                    <Link
                      to={`/product/${product.id}`}
                      className="block h-full rounded-2xl overflow-hidden bg-white border border-heritage-beige group hover:shadow-heritage-hover transition-all duration-500"
                    >
                      <div className="relative aspect-square bg-heritage-beige overflow-hidden">
                        {product.image ? (
                          <img
                            loading="lazy"
                            decoding="async"
                            width="400"
                            height="400"
                            src={imageUrl(product.image, 400, { resize: 'cover', height: 400 })}
                            srcSet={imageSrcSet(product.image, [200, 400, 800], {
                              resize: 'cover',
                              square: true,
                            })}
                            sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                            alt={title}
                            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center text-heritage-bronze/30 bg-heritage-cream">
                            <Gem size={32} strokeWidth={1} />
                          </div>
                        )}
                        {product.status === 'Sold' && (
                          <div className="absolute inset-0 bg-heritage-charcoal/40 backdrop-blur-[1px] flex items-center justify-center">
                            <span className="bg-white/90 text-heritage-charcoal text-[10px] font-bold px-4 py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg">
                              Sold Out
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-3 left-3 bg-heritage-charcoal/90 backdrop-blur-sm text-white text-[10px] px-3 py-1.5 rounded-full font-sans tracking-[0.12em] uppercase flex items-center gap-1.5">
                          <Award size={12} strokeWidth={1.5} />
                          <span>{product.condition || 'Excellent'}</span>
                        </div>
                      </div>
                      <div className="p-4">
                        <h3
                          className="font-serif text-sm sm:text-base md:text-lg font-medium text-heritage-charcoal leading-snug line-clamp-1"
                          title={title}
                        >
                          {title}
                        </h3>
                        <p
                          className={`font-sans text-sm font-medium mt-1.5 ${product.status === 'Sold' ? 'text-gray-500 line-through' : 'text-heritage-gold-muted'}`}
                        >
                          ₹{product.price?.toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </Tilt>
                );
              })}
        </div>
      </div>
    </section>
  );
};

export default ProductDetail;

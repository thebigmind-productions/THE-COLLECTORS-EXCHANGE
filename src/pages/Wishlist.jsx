import React from 'react';
import { Trash2, ShoppingBag, ShieldCheck, Loader2 } from 'lucide-react';
import SEO from '../components/SEO';
import { Link } from 'react-router-dom';
import { useWishlist, useRemoveFromWishlist } from '../hooks/api/useWishlist';
import { useAddToCart, useCart } from '../hooks/api/useCart';
import { getUser } from '../utils/storage';
import { imageUrl, imageSrcSet } from '../utils/image';
import { Tilt } from '../components/Motion';
import SignInPrompt from '../components/SignInPrompt';
import QueryError from '../components/QueryError';
import EmptyWishlistVisual from '../components/EmptyWishlistVisual';
import { useToast } from '../components/Toast';

const Wishlist = () => {
  const user = getUser();
  const showToast = useToast();
  const {
    data: wishlistData = [],
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useWishlist(user?.id);
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const addToCartMutation = useAddToCart();
  const { data: cartItems = [] } = useCart(user?.id);

  const wishlistItems = wishlistData.map((item) => item.product);

  // The wishlist is precisely where sold-out items pile up, so the backend's
  // 422 'Product is no longer available' is the EXPECTED answer here, not an
  // edge case. Swallowing it into console.error meant the button did nothing at
  // all: the shopper taps, nothing moves, they tap again, and conclude the site
  // is broken. Same pattern as Category.jsx.
  const errorMessage = (error, fallback) =>
    error?.response?.data?.error || error?.response?.data?.message || fallback;

  const handleRemove = async (productId) => {
    if (!user?.id) return;
    try {
      await removeFromWishlistMutation.mutateAsync({ userId: user.id, productId });
    } catch (error) {
      showToast(errorMessage(error, 'Could not remove this from your wishlist'), 'error');
    }
  };

  const handleAddToCart = async (productId) => {
    if (!user?.id) return;
    if (addToCartMutation.isPending) return;
    try {
      await addToCartMutation.mutateAsync({ userId: user.id, productId });
      showToast('Added to your cart', 'success');
    } catch (error) {
      showToast(errorMessage(error, 'Could not add this to your cart'), 'error');
    }
  };

  const isInCart = (productId) => {
    return cartItems.some((item) => item.productId === productId);
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 sm:py-20 px-4 sm:px-6">
        <SEO
          title="Wishlist"
          description="View your saved collectibles and rare finds on The Collectors Exchange wishlist."
          canonical="/wishlist"
          noindex
        />
        <SignInPrompt
          title="Please Sign In"
          description="Your saved treasures are waiting. Sign in to view your wishlist."
          illustration={<EmptyWishlistVisual />}
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 sm:py-20 px-4 sm:px-6 text-center">
        <SEO
          title="Wishlist"
          description="View your saved collectibles and rare finds on The Collectors Exchange wishlist."
          canonical="/wishlist"
          noindex
        />
        <Loader2 className="animate-spin mx-auto text-luxury-gold mb-4" size={40} />
        <p className="font-serif italic text-sm sm:text-base text-gray-500">
          Loading your collection...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:py-12 sm:px-6">
      <SEO
        title="Wishlist"
        description="View your saved collectibles and rare finds on The Collectors Exchange wishlist."
        canonical="/wishlist"
        noindex
      />
      <h1 className="text-2xl sm:text-3xl font-serif mb-6 sm:mb-8 text-center md:text-left">
        My Wishlist
      </h1>

      {/* Error before empty: a rejected /wishlist read leaves wishlistData at
          its [] default, which would tell the shopper they have saved nothing
          when in fact the request never came back. */}
      {isError ? (
        <QueryError
          title="We couldn't load your wishlist"
          message="Your saved pieces are still there — the request just didn't get through. Please try again."
          onRetry={refetch}
          isRetrying={isFetching}
          className="max-w-2xl mx-auto"
        />
      ) : wishlistItems.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {[...wishlistItems]
            .sort((a, b) => {
              const aSold = a.status === 'Sold' || a.product?.status === 'Sold';
              const bSold = b.status === 'Sold' || b.product?.status === 'Sold';
              if (aSold && !bSold) return 1;
              if (!aSold && bSold) return -1;
              return 0;
            })
            .map((product) => (
              <Tilt key={product.id} className="h-full">
                <div className="bg-white border border-gray-100 group hover:shadow-heritage transition-all duration-500 flex flex-col h-full rounded-2xl overflow-hidden">
                  {/* Image */}
                  <Link
                    to={`/product/${product.id}`}
                    className="block relative aspect-square bg-heritage-beige overflow-hidden shrink-0"
                  >
                    <img
                      src={imageUrl(
                        product.image ||
                          "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Crect width='400' height='400' fill='%23f5f0e8'/%3E%3C/svg%3E",
                        400,
                        { resize: 'cover', height: 400 },
                      )}
                      srcSet={imageSrcSet(product.image, [200, 400, 800], {
                        resize: 'cover',
                        square: true,
                      })}
                      sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      alt={product.title}
                      width="400"
                      height="400"
                      loading="lazy"
                      decoding="async"
                      className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                    />

                    {/* Condition Badge */}
                    <div className="absolute top-1.5 left-1.5 sm:top-3 sm:left-3 bg-white/90 backdrop-blur-sm text-heritage-charcoal/70 text-[10px] sm:text-xs px-1 sm:px-2.5 py-0.5 sm:py-1 font-sans tracking-widest uppercase rounded-full">
                      {product.condition || 'Excellent'}
                    </div>

                    {/* Sold Badge */}
                    {product.status === 'Sold' && (
                      <div className="absolute inset-0 bg-heritage-charcoal/40 backdrop-blur-[1px] flex items-center justify-center">
                        <span className="bg-white/90 text-heritage-charcoal text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1 sm:py-1.5 uppercase tracking-widest shadow-lg rounded-full">
                          Sold Out
                        </span>
                      </div>
                    )}

                    {/* Verified Badge */}
                    {product.isVerified && (
                      <div className="absolute bottom-1.5 left-1.5 sm:bottom-3 sm:left-3 bg-heritage-charcoal/90 backdrop-blur-sm text-white text-[10px] px-1.5 sm:px-2.5 py-0.5 sm:py-1 font-sans tracking-widest uppercase flex items-center gap-1 rounded-full">
                        <ShieldCheck size={10} />
                        <span className="inline">Verified</span>
                      </div>
                    )}
                  </Link>

                  {/* Content */}
                  <div className="p-3 sm:p-5 flex flex-col flex-grow">
                    <p className="text-[10px] sm:text-xs text-heritage-bronze/80 uppercase tracking-widest truncate mb-0.5 sm:mb-1">
                      {product.category}
                    </p>
                    {product.seller?.name && (
                      <p className="text-[10px] sm:text-xs text-heritage-charcoal/70 truncate mb-0.5 sm:mb-1">
                        by {product.seller.name}
                      </p>
                    )}
                    <Link
                      to={`/product/${product.id}`}
                      className="block hover:text-heritage-bronze transition-colors"
                    >
                      <h3 className="font-serif text-sm md:text-base text-heritage-charcoal leading-tight line-clamp-2">
                        {product.title}
                      </h3>
                    </Link>
                    <p className="text-heritage-gold-muted font-sans text-xs md:text-sm font-semibold mt-1.5 sm:mt-2 mb-2 sm:mb-3">
                      ₹{product.price?.toLocaleString()}
                    </p>

                    {product.status === 'Sold' ? (
                      <div className="w-full py-2 sm:py-1.5 text-[10px] uppercase tracking-[0.12em] sm:tracking-[0.15em] flex items-center justify-center gap-1 sm:gap-1.5 bg-gray-100 text-gray-600 cursor-default mt-auto rounded-full">
                        Sold Out
                      </div>
                    ) : (
                      <div className="flex gap-1.5 sm:gap-2 mt-auto">
                        <button
                          onClick={() => handleAddToCart(product.id)}
                          disabled={isInCart(product.id)}
                          className="flex-1 bg-heritage-charcoal text-white py-2 sm:py-1.5 text-[10px] uppercase tracking-widest hover:bg-luxury-gold active:scale-[0.97] transition-all disabled:bg-gray-300 flex items-center justify-center gap-1 rounded-full"
                        >
                          <ShoppingBag size={11} className="sm:w-[10px] sm:h-[10px]" />
                          {isInCart(product.id) ? 'In Cart' : 'Add to Cart'}
                        </button>
                        <button
                          onClick={() => handleRemove(product.id)}
                          className="px-2 sm:px-3 py-1 sm:py-1.5 border border-gray-200 text-red-600 hover:bg-red-50 transition-colors rounded-full"
                        >
                          <Trash2 size={12} className="sm:w-[14px] sm:h-[14px]" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </Tilt>
            ))}
        </div>
      ) : (
        <div className="text-center py-12 sm:py-20 bg-white border border-gray-100 rounded-2xl">
          <EmptyWishlistVisual />
          <h3 className="text-lg sm:text-xl font-serif text-gray-600 mb-2">
            Your wishlist is empty
          </h3>
          <p className="text-sm sm:text-base text-gray-500 mb-6">
            Save items you love by clicking the heart icon.
          </p>
          <Link
            to="/category"
            className="inline-block bg-black text-white px-6 sm:px-8 py-3 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors rounded-full"
          >
            Explore The Exchange
          </Link>
        </div>
      )}
    </div>
  );
};

export default Wishlist;

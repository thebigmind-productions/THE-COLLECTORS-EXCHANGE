import { Trash2, ShoppingBag, Loader2, ArrowRight } from 'lucide-react';
import SEO from '../components/SEO';
import { Link, useNavigate } from 'react-router-dom';
import { useCart, useRemoveFromCart } from '../hooks/api/useCart';
import { useProducts } from '../hooks/api/useProducts';
import { getUser } from '../utils/storage';
import { imageUrl, imageSrcSet } from '../utils/image';
import apiClient from '../hooks/api/apiClient';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';
import QueryError from '../components/QueryError';
import { Reveal, Magnetic } from '../components/Motion';

const Cart = () => {
  const user = getUser();
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: cartItems = [], isLoading, isError, isFetching, refetch } = useCart(user?.id);
  const removeMutation = useRemoveFromCart();
  const confirm = useConfirm();
  const { data: featuredData } = useProducts(null, '', 1, 6);
  const featuredProducts = (featuredData?.products || [])
    .filter(
      (p) =>
        (p.listingCategory === 'featured' || p.listingCategory === 'most_rare') &&
        p.status !== 'Sold',
    )
    .slice(0, 4);

  const handleRemove = async (productId) => {
    if (!user) return;
    const confirmed = await confirm('Remove this item from your cart?');
    if (!confirmed) return;
    try {
      await removeMutation.mutateAsync({ userId: user.id, productId });
      apiClient.post('/analytics/cart', { productId, action: 'REMOVE' }).catch(() => {});
    } catch {
      showToast('Failed to remove item from cart.', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-luxury-gold mb-4" size={48} />
        <p className="text-gray-500 font-serif text-xl italic">Loading Your Collection...</p>
      </div>
    );
  }

  const subtotal = cartItems.reduce((sum, item) => sum + (item.product?.price || 0), 0);
  const total = subtotal;

  return (
    <div className="container mx-auto py-8 px-4 sm:py-12 sm:px-6">
      <SEO
        title="Cart"
        description="Review your curated collection of authenticated collectibles before checkout on The Collectors Exchange."
        canonical="/cart"
        noindex
      />
      <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif mb-6 sm:mb-12 text-center md:text-left">
        Shopping Cart
      </h1>

      {/* The error branch has to come first: a failed /cart read leaves
          cartItems as the [] default, which would otherwise render "Your cart
          is empty" over a cart that may well have items in it. */}
      {isError ? (
        <QueryError
          title="We couldn't load your cart"
          message="Your items are safe — we just couldn't reach them. Check your connection and try again."
          onRetry={refetch}
          isRetrying={isFetching}
          className="max-w-2xl mx-auto"
        />
      ) : cartItems.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-8 sm:gap-12">
          {/* Cart Items */}
          <Reveal as="div" direction="up" className="w-full lg:w-2/3">
            <div className="bg-white shadow-sm border border-gray-100 rounded-2xl overflow-hidden">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 sm:gap-6 p-3 sm:p-6 border-b border-gray-100 last:border-0 items-center"
                >
                  <img
                    src={imageUrl(
                      item.product?.image ||
                        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='96'%3E%3Crect width='96' height='96' fill='%23f5f0e8'/%3E%3C/svg%3E",
                      200,
                      { resize: 'cover', height: 200 },
                    )}
                    alt={item.product?.title || 'Product'}
                    width="96"
                    height="96"
                    loading="lazy"
                    decoding="async"
                    className="w-16 sm:w-24 h-16 sm:h-24 object-cover shrink-0 rounded-lg"
                  />
                  <div className="flex-grow min-w-0">
                    <p className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest mb-0.5 sm:mb-1">
                      {item.product?.category || 'Unknown'}
                    </p>
                    <h3 className="font-serif text-sm sm:text-base md:text-lg font-medium truncate">
                      {item.product?.title || 'Unavailable'}
                    </h3>
                    <p className="text-[11px] sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                      {item.product?.condition || ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-sans text-xs sm:text-base font-semibold mb-1 sm:mb-2">
                      ₹{item.product?.price?.toLocaleString() || '0'}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemove(item.product?.id || item.productId)}
                      aria-label={`Remove ${item.product?.title || 'item'} from cart`}
                      className="text-red-500 hover:text-red-700 transition-colors p-2"
                    >
                      <Trash2 size={16} aria-hidden="true" className="sm:w-[18px] sm:h-[18px]" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Checkout Summary */}
          <Reveal as="div" direction="up" delay={120} className="w-full lg:w-1/3">
            <div className="bg-white p-6 sm:p-8 shadow-sm border border-gray-100 lg:sticky lg:top-24 rounded-2xl">
              <h3 className="text-lg sm:text-xl lg:text-2xl font-serif mb-4 sm:mb-6">
                Order Summary
              </h3>
              <div className="space-y-3 sm:space-y-4 text-sm text-gray-600 border-b border-gray-100 pb-4 sm:pb-6">
                <div className="flex justify-between">
                  <span>Subtotal ({cartItems.length} items)</span>
                  <span>₹{subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-green-600">Free</span>
                </div>
              </div>
              <div className="flex justify-between pt-4 sm:pt-6 font-serif font-bold text-base sm:text-lg mb-6 sm:mb-8">
                <span>Total</span>
                <span>₹{total.toLocaleString()}</span>
              </div>
              <Magnetic className="block w-full">
                <button
                  onClick={() => navigate('/checkout')}
                  className="w-full bg-black text-white py-3 sm:py-4 font-sans text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors rounded-full"
                >
                  Proceed to Checkout
                </button>
              </Magnetic>
              <div className="mt-4 text-center">
                <p className="text-xs text-gray-400">
                  Secure checkout with online payment or Cash on Delivery.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      ) : (
        <div className="text-center py-12 sm:py-16">
          <ShoppingBag size={48} className="mx-auto text-gray-300 mb-4 sm:mb-6" />
          <h3 className="text-lg sm:text-xl font-serif text-gray-600 mb-2">Your cart is empty</h3>
          <p className="text-sm sm:text-base text-gray-400 mb-6 sm:mb-8">
            Add items to your cart to proceed.
          </p>
          <Link
            to="/category"
            className="inline-block bg-black text-white px-6 sm:px-8 py-3 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors mb-8 sm:mb-16 rounded-full"
          >
            Explore The Exchange
          </Link>
          {featuredProducts.length > 0 && (
            <Reveal as="div" direction="up" className="max-w-5xl mx-auto">
              <div className="flex items-center justify-center gap-4 mb-6 sm:mb-8">
                <div className="h-px w-8 bg-luxury-gold/40" />
                <span className="text-luxury-gold tracking-[0.3em] text-xs font-bold uppercase">
                  Curated Picks
                </span>
                <div className="h-px w-8 bg-luxury-gold/40" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                {featuredProducts.map((product) => (
                  <Link
                    key={product.id}
                    to={`/product/${product.id}`}
                    className="group bg-white border border-gray-100 hover:shadow-heritage transition-all duration-500 flex flex-col rounded-2xl overflow-hidden"
                  >
                    <div className="relative aspect-square bg-heritage-beige overflow-hidden shrink-0">
                      {product.image ? (
                        <img
                          src={imageUrl(product.image, 400, { resize: 'cover', height: 400 })}
                          srcSet={imageSrcSet(product.image, [200, 400], {
                            resize: 'cover',
                            square: true,
                          })}
                          sizes="(min-width: 640px) 25vw, 50vw"
                          alt={product.title}
                          loading="lazy"
                          decoding="async"
                          width="200"
                          height="200"
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-heritage-bronze/30">
                          <ShoppingBag size={24} strokeWidth={1} />
                        </div>
                      )}
                    </div>
                    <div className="p-3 sm:p-5 text-left flex flex-col flex-grow">
                      <p className="text-[10px] sm:text-xs text-heritage-bronze/80 uppercase tracking-widest truncate">
                        {product.category}
                      </p>
                      {product.seller?.name && (
                        <p className="text-[10px] sm:text-xs text-heritage-charcoal/50 truncate">
                          by {product.seller.name}
                        </p>
                      )}
                      <h3 className="font-serif text-sm sm:text-base md:text-lg text-heritage-charcoal leading-tight sm:leading-snug line-clamp-2 mt-0.5 sm:mt-1">
                        {product.title}
                      </h3>
                      <p className="text-heritage-gold-muted font-sans text-xs sm:text-base lg:text-lg font-semibold mt-1 sm:mt-1.5">
                        ₹{product.price?.toLocaleString()}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
              <Link
                to="/category"
                className="inline-flex items-center gap-2 mt-6 sm:mt-8 text-xs sm:text-sm uppercase tracking-widest text-heritage-charcoal/60 hover:text-luxury-gold transition-colors group"
              >
                View All{' '}
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Reveal>
          )}
        </div>
      )}
    </div>
  );
};

export default Cart;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, ShoppingBag, ShieldCheck } from 'lucide-react';
import { getUser } from '../utils/storage';
import { imageUrl, imageSrcSet } from '../utils/image';
import { useCart, useAddToCart } from '../hooks/api/useCart';
import { useWishlist, useAddToWishlist, useRemoveFromWishlist } from '../hooks/api/useWishlist';
import { useToast } from './Toast';

const ProductCard = ({ product }) => {
  const user = getUser();
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: cartItems = [] } = useCart(user?.id);
  const addToCartMutation = useAddToCart();
  const { data: wishlistItems = [] } = useWishlist(user?.id);
  const addToWishlistMutation = useAddToWishlist();
  const removeFromWishlistMutation = useRemoveFromWishlist();
  const [wishPulse, setWishPulse] = useState(false);

  const inCart = cartItems.some((item) => item.productId === product.id);
  const inWishlist = wishlistItems.some(
    (item) => item.product?.id === product.id || item.productId === product.id,
  );

  const handleWishlistToggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      showToast('Please sign in to add to wishlist', 'error');
      return;
    }

    setWishPulse(true);
    setTimeout(() => setWishPulse(false), 200);

    if (inWishlist) {
      removeFromWishlistMutation.mutate({ userId: user.id, productId: product.id });
    } else {
      addToWishlistMutation.mutate({ userId: user.id, productId: product.id });
    }
  };

  const handleAddToCart = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      showToast('Please sign in to add items to cart', 'error');
      return;
    }
    if (inCart) return;
    try {
      await addToCartMutation.mutateAsync({ userId: user.id, productId: product.id });
    } catch (err) {
      showToast(err?.response?.data?.message || 'Failed to add to cart', 'error');
    }
  };

  const title = product.title || product.name;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden group hover:shadow-lg transition-shadow duration-300 flex flex-col h-full">
      <Link
        to={`/product/${product.id}`}
        className="block relative aspect-square bg-gray-100 overflow-hidden cursor-pointer shrink-0"
      >
        {product.image ? (
          <img
            src={imageUrl(product.image, 400, { resize: 'cover', height: 400 })}
            srcSet={imageSrcSet(product.image, [200, 400, 800], { resize: 'cover', square: true })}
            sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
            alt={title}
            loading="lazy"
            decoding="async"
            width="400"
            height="400"
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-gray-600 bg-gray-200">
            No Image
          </div>
        )}

        <button
          onClick={handleWishlistToggle}
          className={`absolute top-4 right-4 p-2 bg-white rounded-full shadow-sm transition-all duration-200 z-10 cursor-pointer ${inWishlist ? 'text-red-600' : 'text-gray-500 hover:text-red-600'} ${wishPulse ? 'scale-125' : 'scale-100'}`}
        >
          <Heart size={16} fill={inWishlist ? 'currentColor' : 'none'} />
        </button>

        <div className="absolute top-4 left-4 flex flex-col gap-1">
          {product.isVerified && (
            <div className="bg-black text-white text-[10px] px-2 py-1 font-sans tracking-widest uppercase flex items-center gap-1 shadow-sm">
              <ShieldCheck size={10} /> Verified
            </div>
          )}
          {(product.commissionPercent ?? 10) >= 20 && (
            <div className="bg-luxury-gold text-black text-[10px] px-2 py-1 font-sans tracking-widest uppercase flex items-center gap-1 shadow-sm">
              <ShieldCheck size={10} /> Promoted
            </div>
          )}
          {(product.commissionPercent ?? 10) >= 25 && (
            <div className="bg-purple-700 text-white text-[10px] px-2 py-1 font-sans tracking-widest uppercase flex items-center gap-1 shadow-sm">
              <ShieldCheck size={10} /> Premium
            </div>
          )}
        </div>
      </Link>

      <div className="p-3 sm:p-6 flex flex-col flex-grow">
        <div className="flex-grow flex flex-col gap-1 sm:gap-2">
          <div className="text-[10px] sm:text-xs text-gray-500 uppercase tracking-widest">
            {product.category}
          </div>
          <Link
            to={`/product/${product.id}`}
            className="block hover:text-luxury-gold transition-colors"
          >
            <h3 className="font-serif text-sm sm:text-lg font-medium leading-tight line-clamp-2">
              {title}
            </h3>
          </Link>
          <p className="text-luxury-gold font-sans font-semibold text-base sm:text-lg mt-0.5 sm:mt-1">
            ₹{product.price?.toLocaleString()}
          </p>
        </div>

        <button
          onClick={inCart ? () => navigate('/cart') : handleAddToCart}
          disabled={addToCartMutation.isPending}
          className={`w-full py-2 sm:py-3 text-[11px] sm:text-sm uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-2 mt-auto active:scale-[0.97] ${
            inCart
              ? 'bg-luxury-gold text-white cursor-pointer hover:bg-luxury-gold/90'
              : 'bg-black text-white hover:bg-luxury-gold'
          }`}
        >
          <ShoppingBag size={13} />
          {addToCartMutation.isPending ? 'Adding...' : inCart ? 'In Cart →' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;

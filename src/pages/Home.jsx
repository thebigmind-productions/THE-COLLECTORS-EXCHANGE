import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SEO, { WebSiteSchema, VideoObjectSchema } from '../components/SEO';
import { CORE_PAGES } from '../config/seo-pages';
import heroWestarWebm from '../assets/hero-westar/hero-westar-916.webm';
import heroWestarMp4 from '../assets/hero-westar/hero-westar-916.mp4';
import heroWestarPoster from '../assets/hero-westar/hero-westar-916-poster.jpg';
import crestSeal from '../assets/brand/crest-seal-520.webp';
import verificationAuthenticity from '../assets/verification_authenticity.webp';
import {
  ShieldCheck,
  UserCheck,
  Star,
  ArrowRight,
  Archive,
  Award,
  Crown,
  Gem,
  Quote,
  QuoteIcon,
  ShoppingBag,
  Check,
  XCircle,
  Instagram,
  Facebook,
  Linkedin,
  Mail,
} from 'lucide-react';
import Bullet from '../components/Bullet';
import { useProducts } from '../hooks/api/useProducts';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useTestimonials } from '../hooks/api/useTestimonials';
import { useCart, useAddToCart } from '../hooks/api/useCart';
import { getUser } from '../utils/storage';
import { imageUrl, imageSrcSet } from '../utils/image';
import { useToast } from '../components/Toast';
import QueryError from '../components/QueryError';
import { Reveal, Stagger, Parallax, Magnetic, Tilt, Marquee } from '../components/Motion';

const FeaturedProductCard = ({ product, badge = 'Featured', BadgeIcon = Award }) => {
  const user = getUser();
  const navigate = useNavigate();
  const showToast = useToast();
  const { data: cartItems = [] } = useCart(user?.id);
  const addToCartMutation = useAddToCart();
  const [cartFeedback, setCartFeedback] = useState(false);
  const cartFeedbackTimer = useRef(null);
  const inCart = cartItems.some((item) => item.productId === product.id);
  const title = product.title || product.name;

  useEffect(() => {
    return () => clearTimeout(cartFeedbackTimer.current);
  }, []);

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
      setCartFeedback(true);
      clearTimeout(cartFeedbackTimer.current);
      cartFeedbackTimer.current = setTimeout(() => setCartFeedback(false), 2000);
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

  return (
    <div className="w-full h-full bg-white border border-heritage-beige rounded-2xl overflow-hidden group hover:shadow-heritage-hover transition-all duration-500 flex flex-col">
      <Link to={`/product/${product.id}`} className="block">
        <div className="relative aspect-[4/5] bg-heritage-beige overflow-hidden">
          {product.image ? (
            <img
              loading="lazy"
              decoding="async"
              width="400"
              height="500"
              src={imageUrl(product.image, 400, { resize: 'cover', height: 500 })}
              srcSet={imageSrcSet(product.image, [200, 400, 800], {
                resize: 'cover',
                aspectRatio: 1.25,
              })}
              sizes="(min-width: 768px) 320px, 50vw"
              alt={title}
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-700"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-heritage-bronze/40 bg-heritage-beige">
              <Gem size={36} strokeWidth={1} />
            </div>
          )}
          {product.status === 'Sold' && (
            <div className="absolute inset-0 bg-heritage-charcoal/40 backdrop-blur-[1px] flex items-center justify-center z-10">
              <span className="bg-white/90 text-heritage-charcoal text-[10px] sm:text-sm font-bold px-3 sm:px-4 py-1 sm:py-1.5 rounded-full uppercase tracking-[0.15em] shadow-lg">
                Sold Out
              </span>
            </div>
          )}
          <div className="absolute bottom-2 sm:bottom-4 left-2 sm:left-4 bg-heritage-charcoal/90 backdrop-blur-sm text-white text-[10px] sm:text-xs px-2 sm:px-4 py-1 sm:py-2 rounded-full font-sans tracking-[0.15em] uppercase flex items-center gap-1 sm:gap-2">
            <BadgeIcon size={12} strokeWidth={1.5} />
            <span>{badge}</span>
          </div>
        </div>
      </Link>
      <div className="p-3 sm:p-5 flex flex-col flex-grow">
        {/* Meta and title absorb the slack so price and CTA align across the rail
            regardless of how many lines the title runs to. */}
        <div className="flex-grow">
          <span className="text-[10px] sm:text-xs text-heritage-bronze uppercase tracking-[0.15em] font-medium">
            {product.category}
          </span>
          {product.seller?.name && (
            <p className="text-[10px] sm:text-xs text-heritage-charcoal/50 truncate mt-0.5">
              by {product.seller.name}
            </p>
          )}
          <Link
            to={`/product/${product.id}`}
            className="block hover:text-luxury-gold transition-colors"
          >
            <h3 className="font-serif text-sm sm:text-base md:text-lg font-medium text-heritage-charcoal mb-1 leading-tight mt-1 line-clamp-2">
              {title}
            </h3>
          </Link>
        </div>
        <p className="text-heritage-gold-muted font-serif text-xs sm:text-base lg:text-lg font-medium mt-2">
          ₹{product.price?.toLocaleString()}
        </p>
        {product.status === 'Sold' ? (
          <div className="w-full py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs uppercase tracking-widest flex items-center justify-center gap-1 sm:gap-1.5 mt-2 sm:mt-3 bg-gray-100 text-gray-400 cursor-default">
            <XCircle size={11} className="sm:w-[12px] sm:h-[12px]" />
            Sold Out
          </div>
        ) : (
          <button
            onClick={inCart ? () => navigate('/cart') : cartFeedback ? undefined : handleAddToCart}
            disabled={addToCartMutation.isPending || cartFeedback}
            className={`w-full py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs uppercase tracking-widest transition-colors duration-300 flex items-center justify-center gap-1 sm:gap-1.5 mt-2 sm:mt-3 active:scale-[0.97] ${
              cartFeedback || inCart
                ? 'bg-luxury-gold text-white cursor-pointer hover:bg-luxury-gold/90'
                : 'bg-black text-white hover:bg-luxury-gold'
            }`}
          >
            {cartFeedback ? (
              <Check size={11} className="sm:w-[12px] sm:h-[12px]" />
            ) : (
              <ShoppingBag size={11} className="sm:w-[12px] sm:h-[12px]" />
            )}
            {addToCartMutation.isPending
              ? 'Adding...'
              : cartFeedback
                ? 'Added'
                : inCart
                  ? 'In Cart →'
                  : 'Add to Cart'}
          </button>
        )}
      </div>
    </div>
  );
};

const FeaturedProductsCarousel = () => {
  const trackRef = useRef(null);
  const [paused, setPaused] = React.useState(false);
  // The second copy of the rail exists ONLY to make the CSS marquee loop
  // seamless, and the CSS below kills that animation under
  // `(hover: none), (pointer: coarse)` — on a phone the rail is a plain
  // swipeable scroller, so a duplicate there just makes every shopper swipe the
  // whole catalogue twice. Gate it on the same capability the animation uses.
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)');
  // Query featured directly on the server. The old approach fetched only the
  // top-10 by commission and filtered client-side, so featured items that
  // happened to rank below the top 10 never appeared at all. most_rare items
  // live in their own RarestFinds section below.
  const {
    data: featuredData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useProducts(null, '', 1, 20, 'featured');
  let products = featuredData?.products || [];

  // A failed request used to be indistinguishable from "no featured products",
  // so the whole section silently vanished from the home page. Nothing to show
  // is still a legitimate reason to render nothing; a failed fetch is not.
  if (isError) {
    return (
      <section className="py-12 sm:py-20 px-6 bg-heritage-cream">
        <div className="container mx-auto max-w-3xl">
          <QueryError
            title="We couldn't load the featured products"
            message="This section needs a connection we didn't get. Try again in a moment."
            onRetry={refetch}
            isRetrying={isFetching}
          />
        </div>
      </section>
    );
  }

  if (isLoading || products.length === 0) return null;

  // Sort: non-sold items first, sold items last
  products = [...products].sort((a, b) => {
    if (a.status === 'Sold' && b.status !== 'Sold') return 1;
    if (a.status !== 'Sold' && b.status === 'Sold') return -1;
    return 0;
  });

  // Fixed-width wrappers keep the rail geometry identical for both marquee
  // halves; the card itself is width-agnostic so it can also fill grid cells
  // in the Rarest Finds section.
  const CARD_WRAPPER = 'shrink-0 snap-start w-[240px] sm:w-[280px] md:w-[320px]';
  const cards = products.map((product) => (
    <div key={product.id} className={CARD_WRAPPER}>
      <FeaturedProductCard product={product} />
    </div>
  ));
  // Second copy for the seamless marquee loop — must use distinct keys or React
  // warns about duplicate keys and mis-reconciles the two halves. It is purely
  // decorative and gets hidden from assistive tech at the wrapper below, the
  // same way <Marquee> in Motion.jsx already does it.
  // `aria-hidden` stops a screen reader announcing the whole featured list
  // twice; `inert` (string form — React 18 rejects the boolean) takes the
  // duplicated product links out of the tab order so keyboard users don't walk
  // the same rail a second time. `tabIndex={-1}` is belt-and-braces for
  // browsers that don't support `inert` yet. Attributes go on each wrapper
  // rather than a shared parent so the flex/gap geometry of the two halves
  // stays identical — the marquee's translateX(-50%) depends on it.
  const cardsDuplicate = products.map((product) => (
    <div
      key={`dup-${product.id}`}
      className={CARD_WRAPPER}
      aria-hidden="true"
      inert=""
      tabIndex={-1}
    >
      <FeaturedProductCard product={product} />
    </div>
  ));

  return (
    <section className="py-12 sm:py-20 px-6 bg-heritage-cream overflow-hidden">
      <div className="container mx-auto max-w-6xl">
        <Reveal>
          <div className="text-center mb-8 sm:mb-10">
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="h-px w-8 bg-luxury-gold/40"></div>
              <span className="text-luxury-gold tracking-[0.3em] text-xs font-bold uppercase">
                Curated Selection
              </span>
              <div className="h-px w-8 bg-luxury-gold/40"></div>
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif text-heritage-charcoal">
              Featured <span className="text-luxury-gold italic font-light">Products</span>
            </h2>
          </div>
        </Reveal>

        <div className="relative">
          <style>{`
                        @keyframes marquee {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-50%); }
                        }
                        .carousel-track {
                            animation: marquee 40s linear infinite;
                        }
                        .carousel-track:hover {
                            animation-play-state: paused;
                        }
                        /* On touch devices, stop the auto-scroll entirely — the rail
                           becomes a normal swipeable, snapping scroller instead, so
                           buttons aren't moving targets and users control browsing. */
                        @media (hover: none), (pointer: coarse) {
                            .carousel-track { animation: none !important; }
                        }
                    `}</style>
          <div className="overflow-x-auto snap-x snap-mandatory scrollbar-hide">
            <div
              ref={trackRef}
              className="carousel-track flex gap-6 w-max"
              style={{ animationPlayState: paused ? 'paused' : '' }}
              onMouseEnter={() => setPaused(true)}
              onMouseLeave={() => setPaused(false)}
            >
              {cards}
              {hoverCapable && cards.length >= 2 && cardsDuplicate}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

const RarestFinds = () => {
  const { data, isLoading, isError, isFetching, refetch } = useProducts(
    null,
    '',
    1,
    8,
    'most_rare',
  );
  let products = data?.products || [];

  // Same reasoning as FeaturedProductsCarousel above: only an empty result
  // gets to delete the section, a failed request gets a retry.
  if (isError) {
    return (
      <section className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 bg-heritage-charcoal">
        <div className="container mx-auto max-w-3xl">
          <QueryError
            tone="dark"
            title="We couldn't load the Rarest Finds"
            message="This section needs a connection we didn't get. Try again in a moment."
            onRetry={refetch}
            isRetrying={isFetching}
          />
        </div>
      </section>
    );
  }

  if (isLoading || products.length === 0) return null;

  products = [...products].sort((a, b) => {
    if (a.status === 'Sold' && b.status !== 'Sold') return 1;
    if (a.status !== 'Sold' && b.status === 'Sold') return -1;
    return 0;
  });

  return (
    <section className="py-14 sm:py-20 lg:py-24 px-4 sm:px-6 bg-heritage-charcoal relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, #D4AF37 1px, transparent 0)',
          backgroundSize: '26px 26px',
        }}
      />
      <div className="container mx-auto max-w-7xl relative">
        <Reveal>
          <div className="text-center mb-10 sm:mb-14">
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="h-px w-8 bg-luxury-gold/40" />
              <span className="text-luxury-gold tracking-[0.3em] text-xs font-bold uppercase">
                From The Vault
              </span>
              <div className="h-px w-8 bg-luxury-gold/40" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-serif text-white">
              Rarest <span className="text-luxury-gold italic font-light">Finds</span>
            </h2>
            <p className="text-white/50 text-sm sm:text-base mt-3 max-w-xl mx-auto leading-relaxed">
              Museum-grade pieces that surface once in a lifetime, hand-picked by our curators for
              provenance, condition and story.
            </p>
          </div>
        </Reveal>

        <Stagger
          step={60}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          childClassName="h-full"
        >
          {products.map((product) => (
            <FeaturedProductCard
              key={product.id}
              product={product}
              badge="Most Rare"
              BadgeIcon={Crown}
            />
          ))}
        </Stagger>

        <Reveal>
          <div className="text-center mt-10 sm:mt-12">
            <Link
              to="/category"
              className="inline-flex items-center gap-2 rounded-full border border-luxury-gold/40 text-luxury-gold px-6 py-3 text-xs uppercase tracking-widest hover:bg-luxury-gold hover:text-black transition-all duration-300"
            >
              Explore The Vault
              <ArrowRight size={14} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
};

const homeSeo = CORE_PAGES['/'];

const Home = () => {
  return (
    <div className="flex flex-col">
      <SEO title={homeSeo.title} description={homeSeo.description} canonical="/" ogType="website" />
      <WebSiteSchema />
      <VideoObjectSchema
        name="The Collectors Exchange: Authenticated Vintage Watches & Rare Collectibles"
        description="Discover authenticated vintage watches, rare collectibles, and expert-verified antiques at The Collectors Exchange. India's trusted marketplace for heritage timepieces."
        thumbnail={heroWestarPoster}
        uploadDate="2026-01-01T00:00:00+05:30"
        contentUrl={`${window.location.origin}${heroWestarMp4}`}
        duration="PT10S"
      />
      {/* Hero Section — hero-bleed pulls the cream background up behind the
          floating nav so the true viewport top isn't the mismatched generic
          layout background. The section's own vertical padding lives on the
          inner container, not here: hero-bleed's padding-top is unlayered
          CSS and unconditionally wins over a layered Tailwind py/pt utility
          on the same element (replaces it, doesn't add to it), so combining
          them on one element silently deletes the smaller value. */}
      <section className="hero-bleed relative overflow-hidden bg-cream">
        <div className="container mx-auto max-w-7xl px-6 md:px-10 py-20 sm:py-28 lg:py-32">
          <div className="grid lg:grid-cols-2 items-center gap-14 lg:gap-16">
            <div className="text-center lg:text-left order-2 lg:order-1">
              <Reveal delay={100}>
                <p className="text-[11px] sm:text-xs tracking-[0.4em] uppercase text-brass mb-6 flex items-center justify-center lg:justify-start gap-3">
                  <span className="w-8 h-px bg-brass/60" />
                  Authorized &amp; Premium
                </p>
              </Reveal>
              <h1
                className="animate-heritage-clip text-balance text-heritage-charcoal font-serif font-extrabold tracking-tight leading-[1.08] text-[clamp(2.2rem,4.6vw,3.4rem)]"
                style={{ animationDelay: '0.25s' }}
              >
                A Marketplace for Authentic{' '}
                <em className="not-italic animate-gold-shimmer">Vintage Watches</em> &amp; Rare
                Collectibles
              </h1>
              <Reveal delay={500}>
                <p className="mt-6 mx-auto lg:mx-0 text-heritage-charcoal/60 text-sm sm:text-base leading-relaxed max-w-md">
                  Verified. Original. Limited. Discover a curated world of rare finds and verified
                  sellers, archived and authenticated by The Collectors Exchange.
                </p>
              </Reveal>
              <Reveal delay={650}>
                <div className="mt-9 flex justify-center lg:justify-start">
                  <Magnetic>
                    <Link
                      to="/category"
                      className="inline-flex items-center gap-3 rounded-full bg-heritage-charcoal text-white px-8 py-4 font-sans text-xs tracking-[0.22em] uppercase transition-transform duration-300 hover:scale-[1.02] active:scale-[0.97]"
                    >
                      Explore the Exchange
                      <ArrowRight size={16} />
                    </Link>
                  </Magnetic>
                </div>
              </Reveal>
            </div>

            {/* Mobile: brand crest in place of the video — no autoplaying media on
                small screens, and a cleaner moment than a cropped product film. */}
            <Reveal direction="up" distance={30} className="lg:hidden order-1 flex justify-center">
              <div className="relative w-36 sm:w-44 py-4">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-luxury-gold/10 blur-2xl"
                />
                <img
                  src={crestSeal}
                  alt="The Collectors Exchange crest"
                  className="relative w-full h-auto"
                />
              </div>
            </Reveal>

            {/* Desktop/tablet: the real product film */}
            <Reveal
              direction="right"
              distance={60}
              className="hidden lg:block lg:order-2 mx-auto w-full max-w-xs sm:max-w-sm"
            >
              <div className="rounded-[2rem] overflow-hidden shadow-heritage-hover">
                <video
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  fetchpriority="high"
                  poster={heroWestarPoster}
                  className="w-full h-auto block"
                  aria-label="Westar automatic watch, cinematic product shot"
                >
                  <source src={heroWestarWebm} type="video/webm" />
                  <source src={heroWestarMp4} type="video/mp4" />
                </video>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Trust ticker */}
      <div className="bg-heritage-charcoal text-white/70 py-3.5 sm:py-4 text-[10px] sm:text-xs uppercase tracking-[0.3em] font-medium border-y border-luxury-gold/10">
        <Marquee
          items={[
            'Authenticated',
            'Verified Provenance',
            'Rare & Collectible',
            'Curated by Experts',
            'Heritage Timepieces',
            'Trusted Sellers',
          ]}
          duration={30}
        />
      </div>

      {/* Marketplace Overview */}
      <section className="py-12 sm:py-16 lg:py-20 px-6 bg-secondary-bg">
        <div className="container mx-auto max-w-6xl">
          <Reveal>
            <div className="rounded-3xl bg-white shadow-heritage divide-y sm:divide-y-0 sm:divide-x divide-heritage-beige sm:grid sm:grid-cols-3 overflow-hidden">
              <Tilt className="h-full">
                <div className="h-full p-8 sm:p-10 flex flex-col items-center text-center gap-4 hover:bg-heritage-cream/40 transition-colors duration-300">
                  <Archive className="text-luxury-gold w-9 h-9 sm:w-10 sm:h-10" strokeWidth={1.5} />
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif mb-2">Curated Collection</h3>
                    <p className="text-sm text-gray-600 font-sans font-light leading-relaxed">
                      From vintage artifacts to limited edition luxury goods, every item is
                      hand-picked for its uniqueness.
                    </p>
                  </div>
                </div>
              </Tilt>
              <Tilt className="h-full">
                <div className="h-full p-8 sm:p-10 flex flex-col items-center text-center gap-4 hover:bg-heritage-cream/40 transition-colors duration-300">
                  <ShieldCheck
                    className="text-luxury-gold w-9 h-9 sm:w-10 sm:h-10"
                    strokeWidth={1.5}
                  />
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif mb-2">Authenticity Verified</h3>
                    <p className="text-sm text-gray-600 font-sans font-light leading-relaxed">
                      We verify products with brands and experts to ensure 100% originality. No
                      replicas, no fakes.
                    </p>
                  </div>
                </div>
              </Tilt>
              <Tilt className="h-full">
                <div className="h-full p-8 sm:p-10 flex flex-col items-center text-center gap-4 hover:bg-heritage-cream/40 transition-colors duration-300">
                  <UserCheck
                    className="text-luxury-gold w-9 h-9 sm:w-10 sm:h-10"
                    strokeWidth={1.5}
                  />
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif mb-2">Trusted Sellers</h3>
                    <p className="text-sm text-gray-600 font-sans font-light leading-relaxed">
                      Sellers are strictly vetted with mandatory KYC and compliance checks before
                      they can list.
                    </p>
                  </div>
                </div>
              </Tilt>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Featured Products Carousel */}
      <FeaturedProductsCarousel />

      {/* Rarest Finds — most_rare tier */}
      <RarestFinds />

      {/* Verification Works */}
      <section className="py-12 sm:py-16 lg:py-20 px-6 bg-primary-bg">
        <div className="container mx-auto max-w-5xl flex flex-col lg:flex-row items-center gap-10 sm:gap-14 lg:gap-16">
          <div className="lg:w-1/2">
            <Reveal>
              <h2 className="text-3xl sm:text-4xl font-serif mb-6 leading-tight">
                The Standard of <br /> <span className="text-luxury-gold">Authenticity</span>
              </h2>
            </Reveal>
            <p className="text-gray-600 mb-6 font-light leading-relaxed">
              At The Collectors Exchange, trust is our currency. Our rigorous verification process
              ensures that every item you purchase is genuine.
            </p>
          </div>
        </div>
      </section>

      {/* Institutional Registry Section */}
      <section className="py-16 sm:py-24 lg:py-32 px-6 bg-gray-100 relative">
        <div className="container mx-auto max-w-7xl">
          <div className="flex flex-col md:flex-row items-center justify-between mb-12 sm:mb-20 gap-6 sm:gap-8">
            <div>
              <Reveal>
                <span className="text-luxury-gold text-xs font-bold tracking-[0.3em] uppercase mb-4 block">
                  Institutional Framework
                </span>
                <h2 className="text-3xl sm:text-4xl font-serif leading-tight text-heritage-charcoal">
                  A New Standard of{' '}
                  <span className="italic text-luxury-gold">Archival Integrity</span>
                </h2>
              </Reveal>
            </div>
            <Link
              to="/vision"
              className="group flex items-center gap-4 text-heritage-charcoal/50 hover:text-luxury-gold transition-colors text-xs font-bold tracking-widest uppercase"
            >
              Our Full Vision{' '}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
            </Link>
          </div>

          <div className="rounded-3xl bg-gray-200/80 shadow-md divide-y md:divide-y-0 md:divide-x divide-heritage-charcoal/10 md:grid md:grid-cols-3 overflow-hidden">
            <div className="p-8 sm:p-12 lg:p-14 flex flex-col items-center text-center hover:bg-gray-200 transition-colors group">
              <Archive
                className="text-luxury-gold w-10 h-10 sm:w-12 sm:h-12 mb-6 sm:mb-8 group-hover:scale-110 transition-transform"
                strokeWidth={1.5}
              />
              <h3 className="text-lg sm:text-2xl font-serif uppercase tracking-widest mb-4 sm:mb-6 font-bold text-heritage-charcoal">
                The Archive
              </h3>
              <p className="text-sm sm:text-base text-heritage-charcoal/80 leading-relaxed font-medium">
                Hand-picked artifacts sourced directly from the streets and private vaults. We don't
                list items; we archive history.
              </p>
            </div>
            <div className="p-8 sm:p-12 lg:p-14 flex flex-col items-center text-center hover:bg-gray-200 transition-colors group">
              <ShieldCheck
                className="text-luxury-gold w-10 h-10 sm:w-12 sm:h-12 mb-6 sm:mb-8 group-hover:scale-110 transition-transform"
                strokeWidth={1.5}
              />
              <h3 className="text-lg sm:text-2xl font-serif uppercase tracking-widest mb-4 sm:mb-6 font-bold text-heritage-charcoal">
                Verification
              </h3>
              <p className="text-sm sm:text-base text-heritage-charcoal/80 leading-relaxed font-medium">
                Our institutional verification process ensures that every piece is original. We
                restore the trust lost in the pre-owned market.
              </p>
            </div>
            <div className="p-8 sm:p-12 lg:p-14 flex flex-col items-center text-center hover:bg-gray-200 transition-colors group">
              <UserCheck
                className="text-luxury-gold w-10 h-10 sm:w-12 sm:h-12 mb-6 sm:mb-8 group-hover:scale-110 transition-transform"
                strokeWidth={1.5}
              />
              <h3 className="text-lg sm:text-2xl font-serif uppercase tracking-widest mb-4 sm:mb-6 font-bold text-heritage-charcoal">
                Handshake
              </h3>
              <p className="text-sm sm:text-base text-heritage-charcoal/80 leading-relaxed font-medium">
                Sellers are vetted with archival rigor. We ensure every agreement is honored and
                every transaction is backed by integrity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Authenticated Heritage Section */}
      <section className="py-16 sm:py-24 lg:py-32 px-6 bg-white overflow-hidden">
        <div className="container mx-auto max-w-6xl">
          <div className="flex flex-col lg:flex-row items-center gap-12 sm:gap-16 lg:gap-24">
            <Reveal
              direction="left"
              distance={90}
              blur
              className="lg:w-1/2 space-y-6 sm:space-y-10 relative"
            >
              <h2 className="text-3xl sm:text-4xl font-serif text-heritage-charcoal leading-[1.1] tracking-tighter uppercase relative z-10">
                The Truth Of <br />
                <span className="text-luxury-gold">Heritage</span>
              </h2>
              <p className="text-sm sm:text-base md:text-lg lg:text-xl text-heritage-charcoal font-sans font-medium leading-relaxed max-w-xl relative z-10">
                Trust is our only currency. Our verification process is not a check; it is a
                commitment to the preservation of truth.
              </p>
              <ul className="border-t border-heritage-charcoal/10 relative z-10 max-w-md">
                {[
                  'Institutional verification with heritage brands',
                  'Expert archival appraisal for all artifacts',
                  'Transparent provenance and documented history',
                ].map((item, i) => (
                  <li
                    key={i}
                    className="py-4 border-b border-heritage-charcoal/10 flex items-baseline gap-4"
                  >
                    <span className="text-[10px] tracking-[0.15em] text-luxury-gold shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-heritage-charcoal font-sans font-bold text-xs sm:text-sm tracking-wide">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal direction="right" distance={90} blur className="lg:w-1/2 relative">
              <Parallax speed={0.14}>
                <div className="relative z-10 rounded-[1.75rem] bg-white border border-heritage-bronze/10 shadow-2xl overflow-hidden group">
                  <img
                    loading="lazy"
                    width="600"
                    height="600"
                    src={verificationAuthenticity}
                    alt="Heritage Verification"
                    className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-tr from-heritage-charcoal/5 to-transparent"></div>
                </div>
              </Parallax>
              <div className="absolute -bottom-10 -right-10 w-64 h-64 bg-luxury-gold/10 rounded-full blur-3xl -z-0"></div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Sell with Confidence Section */}
      <section className="py-16 sm:py-24 lg:py-32 px-6 bg-heritage-charcoal text-white text-center border-t border-white/5">
        <div className="container mx-auto max-w-6xl">
          <Reveal>
            <span className="text-luxury-gold text-xs font-bold tracking-[0.4em] uppercase mb-6 sm:mb-8 block">
              Global Outreach
            </span>
            <h2 className="text-3xl sm:text-4xl font-serif mb-12 sm:mb-20 leading-tight">
              Sell with Confidence
            </h2>
          </Reveal>

          <div className="rounded-3xl bg-[#0A0D12] border border-white/5 p-6 sm:p-12 lg:p-24 grid md:grid-cols-2 gap-8 sm:gap-12 lg:gap-20 text-left max-w-5xl mx-auto shadow-heritage relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-luxury-gold/5 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2"></div>
            <div className="space-y-6 sm:space-y-8 relative z-10">
              <h3 className="text-xl sm:text-2xl font-serif text-luxury-gold flex items-center gap-4">
                <div className="w-8 h-px bg-luxury-gold/50"></div>
                Individual Sellers
              </h3>
              <ul className="border-t border-white/10">
                {[
                  'Mandatory KYC (Aadhaar/PAN)',
                  'Limit of 5 listings per account',
                  'Strict manual archival approval',
                ].map((item, i) => (
                  <li key={i} className="py-3.5 border-b border-white/10 flex items-baseline gap-4">
                    <span className="text-[10px] tracking-[0.15em] text-luxury-gold/70 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-300 font-sans font-bold tracking-widest uppercase">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-6 sm:space-y-8 relative z-10">
              <h3 className="text-xl sm:text-2xl font-serif text-luxury-gold flex items-center gap-4">
                <div className="w-8 h-px bg-luxury-gold/50"></div>
                Company Sellers
              </h3>
              <ul className="border-t border-white/10">
                {[
                  'GST & Founder verification required',
                  'Company profile archival audit',
                  'Unlimited listings (post-approval)',
                ].map((item, i) => (
                  <li key={i} className="py-3.5 border-b border-white/10 flex items-baseline gap-4">
                    <span className="text-[10px] tracking-[0.15em] text-luxury-gold/70 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[10px] sm:text-xs text-gray-300 font-sans font-bold tracking-widest uppercase">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-12 sm:mt-24">
            <Link
              to="/account"
              className="inline-flex items-center gap-4 sm:gap-6 rounded-full text-white border border-white/20 px-8 sm:px-12 py-4 sm:py-6 hover:bg-white hover:text-black transition-all duration-500 font-sans text-[10px] sm:text-xs tracking-[0.4em] uppercase font-black group"
            >
              Start Selling{' '}
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 group-hover:translate-x-2 transition-transform duration-500" />
            </Link>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <TestimonialsSection />

      {/* Internal Links for SEO */}
      <section className="py-12 sm:py-16 px-6 bg-white border-t border-heritage-beige">
        <div className="container mx-auto max-w-4xl text-center">
          <Reveal>
            <h2 className="text-2xl sm:text-3xl font-serif text-heritage-charcoal mb-8">
              Learn More About Us
            </h2>
          </Reveal>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Reveal delay={100}>
              <Link
                to="/about"
                className="block p-6 rounded-2xl bg-heritage-cream border border-heritage-beige hover:border-luxury-gold transition-colors group"
              >
                <h3 className="text-lg font-serif text-heritage-charcoal group-hover:text-luxury-gold transition-colors mb-2">
                  About Us
                </h3>
                <p className="text-sm text-gray-500">
                  Discover our mission to preserve heritage through verified sourcing and expert
                  authentication.
                </p>
              </Link>
            </Reveal>
            <Reveal delay={200}>
              <Link
                to="/contact"
                className="block p-6 rounded-2xl bg-heritage-cream border border-heritage-beige hover:border-luxury-gold transition-colors group"
              >
                <h3 className="text-lg font-serif text-heritage-charcoal group-hover:text-luxury-gold transition-colors mb-2">
                  Contact Us
                </h3>
                <p className="text-sm text-gray-500">
                  Have questions? Reach our team for buying, selling, or partnership inquiries.
                </p>
              </Link>
            </Reveal>
            <Reveal delay={300}>
              <Link
                to="/faq"
                className="block p-6 rounded-2xl bg-heritage-cream border border-heritage-beige hover:border-luxury-gold transition-colors group"
              >
                <h3 className="text-lg font-serif text-heritage-charcoal group-hover:text-luxury-gold transition-colors mb-2">
                  FAQ
                </h3>
                <p className="text-sm text-gray-500">
                  Find answers about buying, selling, shipping, payments, and account security.
                </p>
              </Link>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Social Links - Mobile only */}
      <div className="lg:hidden py-8 px-6 bg-heritage-cream border-t border-heritage-beige">
        <div className="max-w-md mx-auto flex items-center justify-center gap-5">
          <a
            href="https://www.instagram.com/the_collectors_exchange/?utm_source=ig_web_button_share_sheet"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-heritage-bronze/60 hover:text-luxury-gold transition-colors"
          >
            <Instagram size={20} strokeWidth={1.5} />
          </a>
          <a
            href="https://www.facebook.com/share/18mue4rLC4/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Facebook"
            className="text-heritage-bronze/60 hover:text-luxury-gold transition-colors"
          >
            <Facebook size={20} strokeWidth={1.5} />
          </a>
          <a
            href="https://x.com/TCE_store"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X (Twitter)"
            className="text-heritage-bronze/60 hover:text-luxury-gold transition-colors"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="none">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
          </a>
          <a
            href="https://www.linkedin.com/company/thecollectorsexchange"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="LinkedIn"
            className="text-heritage-bronze/60 hover:text-luxury-gold transition-colors"
          >
            <Linkedin size={20} strokeWidth={1.5} />
          </a>
          <a
            href="mailto:support@thecollectorsexchange.in"
            aria-label="Email"
            className="text-heritage-bronze/60 hover:text-luxury-gold transition-colors"
          >
            <Mail size={20} strokeWidth={1.5} />
          </a>
        </div>
      </div>
    </div>
  );
};

const TestimonialsSection = () => {
  const { data: testimonials, isLoading } = useTestimonials();
  const [activeIndex, setActiveIndex] = React.useState(0);

  if (isLoading || !testimonials?.length) return null;

  const t = testimonials[activeIndex];

  return (
    <section className="py-16 sm:py-20 px-6 bg-heritage-cream">
      <div className="container mx-auto max-w-4xl text-center">
        <Reveal>
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="h-px w-8 bg-luxury-gold/40"></div>
            <span className="text-luxury-gold tracking-[0.3em] text-xs font-bold uppercase">
              Testimonials
            </span>
            <div className="h-px w-8 bg-luxury-gold/40"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif text-heritage-charcoal mb-10">
            What Our <span className="text-luxury-gold italic font-light">Collectors</span> Say
          </h2>
        </Reveal>
        <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-sm border border-gray-100 relative">
          <Quote className="text-luxury-gold/20 absolute top-4 left-4 w-12 h-12 sm:w-16 sm:h-16" />
          <p className="text-lg sm:text-xl text-gray-700 leading-relaxed font-sans italic mb-6 relative z-10">
            {'\u201C'}
            {t.content}
            {'\u201D'}
          </p>
          {t.images?.length > 0 && (
            <div className="flex justify-center gap-3 mb-4 overflow-x-auto">
              {t.images.map((img, i) => (
                <img
                  key={i}
                  loading="lazy"
                  decoding="async"
                  width="96"
                  height="96"
                  src={imageUrl(img, 200, { resize: 'cover', height: 200 })}
                  alt={`${t.authorName}'s collectible`}
                  className="w-20 h-20 sm:w-24 sm:h-24 object-cover rounded-xl border border-gray-200 flex-shrink-0"
                />
              ))}
            </div>
          )}
          <div className="flex items-center justify-center gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`text-lg ${i <= t.rating ? 'text-amber-400' : 'text-gray-200'}`}
                aria-label={`${i <= t.rating ? 'Filled star' : 'Empty star'}`}
              >
                &#9733;
              </span>
            ))}
          </div>
          <p className="font-serif font-bold text-heritage-charcoal">{t.authorName}</p>
        </div>
        {testimonials.length > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            {testimonials.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`w-2.5 h-2.5 rounded-full transition-all ${i === activeIndex ? 'bg-luxury-gold w-6' : 'bg-gray-300 hover:bg-gray-400'}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Home;

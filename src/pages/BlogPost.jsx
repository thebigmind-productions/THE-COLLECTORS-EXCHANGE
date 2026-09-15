import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import SEO, { ArticleSchema, BreadcrumbSchema } from '../components/SEO';
import { useBlogBySlug, usePublishedBlogs, useIncrementBlogView } from '../hooks/api/useBlog';
import {
  ArrowLeft,
  Clock,
  User,
  BookOpen,
  Share2,
  ArrowRight,
  Check,
  List,
  BookMarked,
  Quote,
  Eye,
} from 'lucide-react';
import DOMPurify from 'dompurify';
import { Reveal, Parallax, Tilt, Magnetic } from '../components/Motion';
import { imageUrl, imageSrcSet } from '../utils/image';

function BlogPost() {
  const { slug } = useParams();
  const { data: post, isLoading } = useBlogBySlug(slug);
  const incrementView = useIncrementBlogView();
  const [copied, setCopied] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeHeading, setActiveHeading] = useState('');
  const viewCountedRef = useRef(false);

  useEffect(() => {
    if (post?.slug && !viewCountedRef.current) {
      viewCountedRef.current = true;
      incrementView.mutate(post.slug);
    }
  }, [post?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0);
      document.querySelectorAll('[data-section-id]').forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= 120) setActiveHeading(el.getAttribute('data-section-id'));
      });
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hooks must be called at the top level — not inside an IIFE/callback.
  const { data: relatedData } = usePublishedBlogs({ category: post?.category, limit: '4' });
  const related = (relatedData?.posts || []).filter((p) => p.slug !== slug).slice(0, 3);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const processContent = useMemo(() => {
    if (!post?.content) return { html: '', headings: [] };
    const headings = [];
    let count = 0;
    const html = post.content.replace(/<h2>(.*?)<\/h2>/gi, (match, text) => {
      count++;
      // Extract plain text by removing HTML tags for ID generation
      const plainText = text.replace(/<[^>]*>/g, '');
      const id = plainText
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      headings.push({ id, html: text });
      const separator = count > 1 ? '<div class="section-divider"></div>' : '';
      return `${separator}<h2 id="${id}" data-section-id="${id}" class="group scroll-mt-24">${text}</h2>`;
    });
    return { html: DOMPurify.sanitize(html), headings };
  }, [post?.content]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-luxury-gold border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-serif italic">Opening the archive...</p>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={56} className="mx-auto text-gray-200 mb-4" strokeWidth={1} />
          <h2 className="text-2xl font-serif text-gray-500 mb-4">Article Not Found</h2>
          <Link
            to="/archive"
            className="inline-flex items-center gap-2 text-sm uppercase tracking-widest text-luxury-gold hover:text-heritage-brown transition-colors"
          >
            <ArrowLeft size={16} /> Back to Archive
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{`
                .section-divider {
                    margin: 3.5rem 0 2rem;
                    height: 1px;
                    background: linear-gradient(to right, transparent, #D4AF37, transparent);
                    opacity: 0.3;
                }
                /* Layout safety net, not content styling: GFM tables in
                   article body have no built-in mobile handling from the
                   typography plugin, so a wide table would force the whole
                   page to scroll horizontally. Scope it to just the table. */
                .prose table {
                    display: block;
                    overflow-x: auto;
                }
            `}</style>
      <SEO
        title={post.metaTitle || post.title}
        description={post.metaDescription || post.excerpt}
        canonical={`/archive/${post.slug}`}
        image={post.coverImage}
        ogType="article"
        publishedTime={post.publishedAt || post.createdAt}
      />
      <ArticleSchema
        headline={post.title}
        image={post.coverImage}
        datePublished={post.publishedAt || post.createdAt}
        dateModified={post.updatedAt || post.publishedAt || post.createdAt}
        author={post.author}
      />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'The Archive', url: '/archive' },
          { name: post.title, url: `/archive/${post.slug}` },
        ]}
      />

      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-gray-100">
        <div
          className="h-full bg-luxury-gold transition-all duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Hero — hero-bleed pulls this band up behind the floating nav so its
          image/background reaches the true viewport top instead of the
          generic Layout background showing through as a mismatched seam.
          This band uses a fixed viewport-relative height (not padding), so
          the bled height is grown by --header-h at each breakpoint to
          exactly offset the negative margin-top hero-bleed applies —
          otherwise the section (and everything below it) would silently
          shift up by the header's height. */}
      {post.coverImage ? (
        <section className="hero-bleed relative h-[calc(40vh_+_var(--header-h,0px))] sm:h-[calc(50vh_+_var(--header-h,0px))] lg:h-[calc(60vh_+_var(--header-h,0px))] min-h-[calc(300px_+_var(--header-h,0px))] overflow-hidden">
          <Reveal direction="scale" className="absolute inset-0">
            <Parallax speed={0.12} className="w-full h-full">
              <img
                src={imageUrl(post.coverImage, 1200)}
                srcSet={imageSrcSet(post.coverImage, [400, 800, 1200])}
                sizes="100vw"
                alt={post.title}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                className="w-full h-full object-cover scale-110"
              />
            </Parallax>
          </Reveal>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-12 lg:p-16">
            <Reveal className="container mx-auto max-w-4xl">
              <Link
                to="/archive"
                className="inline-flex items-center gap-2 text-white/60 hover:text-luxury-gold text-xs uppercase tracking-widest transition-colors mb-4 sm:mb-6"
              >
                <ArrowLeft size={14} /> Back to Archive
              </Link>
              <div className="flex items-center flex-wrap gap-2 mb-3">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-luxury-gold bg-black/30 px-3 py-1.5 rounded-full backdrop-blur-sm">
                  {post.category}
                </span>
                {post.readingTime && (
                  <span className="text-[10px] text-white/60 flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    <Clock size={10} /> {post.readingTime} min read
                  </span>
                )}
                {(post.viewCount ?? 0) > 0 && (
                  <span className="text-[10px] text-white/60 flex items-center gap-1 bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm">
                    <Eye size={10} /> {post.viewCount.toLocaleString()} views
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif text-white leading-tight max-w-3xl">
                {post.title}
              </h1>
            </Reveal>
          </div>
        </section>
      ) : (
        <section className="hero-bleed relative px-6 bg-heritage-charcoal overflow-hidden">
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'radial-gradient(#D4AF37 0.5px, transparent 0.5px)',
              backgroundSize: '32px 32px',
            }}
          ></div>
          <Reveal className="container mx-auto max-w-4xl relative z-10 py-20 sm:py-28">
            <Link
              to="/archive"
              className="inline-flex items-center gap-2 text-white/60 hover:text-luxury-gold text-xs uppercase tracking-widest transition-colors mb-8"
            >
              <ArrowLeft size={14} /> Back to Archive
            </Link>
            <div className="flex items-center flex-wrap gap-2 mb-4">
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-luxury-gold bg-black/20 px-3 py-1.5 rounded-full">
                {post.category}
              </span>
              {post.readingTime && (
                <span className="text-[10px] text-white/60 flex items-center gap-1 bg-black/10 px-3 py-1.5 rounded-full">
                  <Clock size={10} /> {post.readingTime} min read
                </span>
              )}
              {(post.viewCount ?? 0) > 0 && (
                <span className="text-[10px] text-white/60 flex items-center gap-1 bg-black/10 px-3 py-1.5 rounded-full">
                  <Eye size={10} /> {post.viewCount.toLocaleString()} views
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-serif text-white leading-tight max-w-3xl">
              {post.title}
            </h1>
          </Reveal>
        </section>
      )}

      {/* Meta Bar */}
      <div className="relative bg-white">
        <div className="container mx-auto max-w-4xl px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500">
              <span className="flex items-center gap-1.5">
                <User size={14} /> {post.author}
              </span>
              <span className="text-gray-300">|</span>
              <span className="flex items-center gap-1.5">
                <Clock size={14} />
                {post.publishedAt
                  ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })
                  : new Date(post.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
              </span>
              {post.tags?.length > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span className="flex items-center flex-wrap gap-1.5">
                    {post.tags.map((tag) => (
                      <span key={tag} className="text-[10px] bg-gray-50 px-2 py-0.5 rounded-full">
                        #{tag}
                      </span>
                    ))}
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleShare}
              className="relative flex items-center gap-1.5 text-xs uppercase tracking-widest text-gray-500 hover:text-luxury-gold transition-colors self-start sm:self-auto"
            >
              {copied ? <Check size={14} className="text-green-500" /> : <Share2 size={14} />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-12 h-px bg-luxury-gold/50" />
      </div>

      {/* Article Layout */}
      <div className="container mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex gap-12 relative">
          {/* Table of Contents - Desktop */}
          {processContent.headings.length > 0 && (
            <aside className="hidden xl:block w-56 flex-shrink-0 py-12">
              <div className="sticky top-24">
                <div className="flex items-center gap-2 mb-4">
                  <BookMarked size={14} className="text-luxury-gold" />
                  <span className="text-xs uppercase tracking-widest font-bold text-gray-500">
                    Contents
                  </span>
                </div>
                <nav className="space-y-1">
                  {processContent.headings.map((h) => (
                    <a
                      key={h.id}
                      href={`#${h.id}`}
                      onClick={(e) => {
                        e.preventDefault();
                        document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className={`block text-xs py-1.5 border-l-2 pl-3 transition-all duration-200 ${
                        activeHeading === h.id
                          ? 'border-luxury-gold text-heritage-charcoal font-medium'
                          : 'border-gray-100 text-gray-500 hover:text-heritage-charcoal hover:border-gray-300'
                      }`}
                      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(h.html) }}
                    />
                  ))}
                </nav>
              </div>
            </aside>
          )}

          {/* Content */}
          <main className="flex-1 min-w-0 py-10 sm:py-16">
            <Reveal>
              <article
                className="prose prose-sm sm:prose-lg
                                prose-headings:font-serif prose-headings:text-heritage-charcoal prose-headings:tracking-tight
                                prose-h2:text-2xl sm:prose-h2:text-4xl prose-h2:mt-0 prose-h2:mb-6 sm:prose-h2:mb-8 prose-h2:pb-3 prose-h2:border-b prose-h2:border-gray-100
                                prose-h3:text-xl sm:prose-h3:text-2xl prose-h3:mt-8 sm:prose-h3:mt-10 prose-h3:mb-3 sm:prose-h3:mb-4
                                prose-p:text-heritage-charcoal/80 prose-p:leading-relaxed prose-p:mb-4 sm:prose-p:mb-6
                                prose-a:text-luxury-gold prose-a:no-underline hover:prose-a:underline
                                prose-blockquote:border-l-luxury-gold prose-blockquote:bg-heritage-cream prose-blockquote:py-5 prose-blockquote:px-6 sm:prose-blockquote:px-8 prose-blockquote:italic prose-blockquote:text-base sm:prose-blockquote:text-lg prose-blockquote:rounded-r-2xl prose-blockquote:my-10 sm:prose-blockquote:my-12
                                prose-strong:text-heritage-charcoal
                                prose-ul:space-y-2 prose-li:marker:text-luxury-gold
                                prose-img:rounded-2xl prose-img:shadow-md prose-img:my-8
                                prose-code:bg-gray-50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm
                                prose-pre:bg-heritage-charcoal prose-pre:text-gray-100 prose-pre:rounded-2xl"
                dangerouslySetInnerHTML={{ __html: processContent.html }}
              />
            </Reveal>

            {/* Author Bio */}
            <Reveal direction="up" className="mt-12 sm:mt-16">
              <div className="w-12 h-px bg-luxury-gold/50 mb-8" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full bg-heritage-charcoal flex items-center justify-center flex-shrink-0">
                  <BookOpen size={18} className="text-luxury-gold" />
                </div>
                <div>
                  <p className="font-serif font-bold text-heritage-charcoal">
                    Written by {post.author}
                  </p>
                  <p className="text-sm text-gray-500 mt-1 leading-relaxed">
                    The Collectors Exchange is a curated marketplace for verified pre-owned
                    collectibles and antiques. Our editorial team brings you stories from the world
                    of horology, gemology, art, and collecting.
                  </p>
                </div>
              </div>
            </Reveal>
          </main>
        </div>
      </div>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="py-16 sm:py-20 px-6 bg-heritage-cream/50 mt-4">
          <div className="container mx-auto max-w-6xl">
            <Reveal as="div" className="flex items-center gap-3 mb-10">
              <div className="h-px w-8 bg-luxury-gold/30" />
              <h2 className="text-sm uppercase tracking-[0.2em] font-bold text-heritage-charcoal">
                Related Articles
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-gray-200 to-transparent" />
            </Reveal>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              {related.map((r, i) => (
                <Reveal key={r.id} delay={i * 130} className="h-full">
                  <Tilt className="h-full">
                    <Link
                      to={`/archive/${r.slug}`}
                      className="group block h-full bg-white rounded-2xl border border-gray-100 hover:border-luxury-gold/30 hover:shadow-md transition-all duration-500 overflow-hidden"
                    >
                      {r.coverImage ? (
                        <div className="relative h-40 overflow-hidden">
                          <img
                            src={imageUrl(r.coverImage, 800)}
                            srcSet={imageSrcSet(r.coverImage, [400, 800])}
                            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                            alt={r.title}
                            width="800"
                            height="450"
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          />
                        </div>
                      ) : (
                        <div className="h-40 bg-gradient-to-br from-heritage-cream to-gray-50 flex items-center justify-center">
                          <BookOpen size={32} className="text-gray-200" />
                        </div>
                      )}
                      <div className="p-5">
                        <span className="text-[9px] uppercase tracking-[0.2em] font-bold text-luxury-gold bg-luxury-gold/5 px-2 py-0.5 rounded-full">
                          {r.category}
                        </span>
                        <h3 className="font-serif font-bold text-heritage-charcoal group-hover:text-luxury-gold transition-colors mt-2 mb-2 line-clamp-2">
                          {r.title}
                        </h3>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={10} /> {r.readingTime} min read
                        </span>
                      </div>
                    </Link>
                  </Tilt>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="py-16 px-6 text-center bg-white">
        <Reveal className="container mx-auto max-w-lg">
          <BookOpen size={24} className="mx-auto text-luxury-gold/40 mb-4" strokeWidth={1} />
          <h3 className="font-serif text-2xl text-heritage-charcoal mb-3">Discover more stories</h3>
          <p className="text-gray-500 text-sm mb-6">
            Browse the full archive for more insights into the world of collecting.
          </p>
          <Magnetic>
            <Link
              to="/archive"
              className="inline-flex items-center gap-2 bg-black text-white px-8 py-3.5 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors rounded-full"
            >
              Browse The Archive <ArrowRight size={14} />
            </Link>
          </Magnetic>
        </Reveal>
      </section>
    </div>
  );
}

export default BlogPost;

import React from 'react';
import { Landmark, ShieldCheck, History, Sparkles } from 'lucide-react';
import SEO, { PageSchema, BreadcrumbSchema } from '../components/SEO';
import { CORE_PAGES } from '../config/seo-pages';
import Bullet from '../components/Bullet';
import { Reveal, Stagger, Parallax, Tilt } from '../components/Motion';
// Section images served responsively from public/img (see scripts/optimize-assets.cjs).

const InstitutionalIcon = () => (
  <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.5">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" fill="#D4AF37" />
    </svg>
  </div>
);

const DiamondBullet = () => (
  <div className="mt-1.5 flex-shrink-0">
    <svg width="9" height="9" viewBox="0 0 24 24" className="text-luxury-gold">
      <rect x="12" y="0" width="16.97" height="16.97" transform="rotate(45 12 0)" fill="#D4AF37" />
    </svg>
  </div>
);

const visionSeo = CORE_PAGES['/vision'];

const Vision = () => {
  return (
    <div className="min-h-screen bg-heritage-cream text-heritage-charcoal font-sans overflow-x-clip">
      <SEO title={visionSeo.title} description={visionSeo.description} canonical="/vision" />
      <PageSchema
        type="AboutPage"
        name={visionSeo.h1}
        description={visionSeo.description}
        path="/vision"
      />
      <BreadcrumbSchema items={visionSeo.breadcrumb} />
      {/* Vision Hero & Statement Section — hero-bleed pulls this section's cream
          background up behind the floating nav so the true viewport top matches
          the page background instead of the generic layout background peeking
          through the gap. The section's own padding lives on the inner
          container, not here: hero-bleed's padding-top is unlayered CSS and
          unconditionally wins over a layered Tailwind pt-* utility on the
          *same* element (replaces it, doesn't add to it). */}
      <section className="hero-bleed relative bg-heritage-cream">
        <div className="container mx-auto max-w-4xl text-center pt-16 sm:pt-20 pb-28 px-6">
          <Reveal className="flex items-center justify-center gap-6 mb-10 mt-12">
            <div className="w-16 h-[1px] bg-luxury-gold/40"></div>
            <span className="text-luxury-gold tracking-[0.3em] font-sans text-[10px] font-bold uppercase whitespace-nowrap">
              Our Collective Purpose
            </span>
            <div className="w-16 h-[1px] bg-luxury-gold/40"></div>
          </Reveal>

          <Reveal
            as="h1"
            blur
            delay={100}
            className="text-6xl sm:text-7xl md:text-8xl font-serif mb-16 text-heritage-charcoal tracking-tight leading-none"
          >
            Our <span className="italic text-luxury-gold font-normal">Vision</span>
          </Reveal>

          <div className="relative max-w-4xl mx-auto">
            <div className="absolute -left-8 top-0 w-px h-full bg-gradient-to-b from-[#C9A962]/30 via-[#C9A962]/5 to-transparent hidden md:block"></div>
            <Stagger className="space-y-6 text-sm sm:text-base lg:text-lg font-serif italic leading-relaxed text-[#4A443E]">
              <p className="text-2xl sm:text-3xl lg:text-4xl text-[#1A1816] font-medium not-italic mb-8 leading-tight">
                To restore integrity to the world of collectibles by eliminating cheap quality in
                favor of authentic Indian heritage.
              </p>
              <div className="flex items-center justify-center gap-3 my-8">
                <div className="w-12 h-px bg-luxury-gold/40"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A962]/60"></div>
                <div className="w-12 h-px bg-luxury-gold/40"></div>
              </div>
              <div className="pl-0 md:pl-8 space-y-6">
                <p className="text-base sm:text-lg lg:text-xl">
                  We are building the world's most trusted bridge from the local streets to the
                  global collector, honoring the craftsmanship of our ancestors while securing
                  history for the generations to come.
                </p>
                <p className="text-lg sm:text-xl lg:text-2xl font-medium text-[#1A1816] border-l-4 border-[#C9A962]/40 pl-6 py-4 bg-white/50 not-italic rounded-r-lg">
                  We draw inspiration from ancient India, a time when objects were not discarded,
                  but preserved; when possessions were not replaced, but respected; and when value
                  was measured not by price, but by the ability to be carried forward across
                  generations.
                </p>
                <p className="text-base sm:text-lg lg:text-xl">
                  In a world driven by speed and excess, we believe it is time to pause, to protect
                  every lantern that once lit a home, every radio that carried voices across
                  decades, every gramophone that captured moments in time, and every timepiece
                  handed down by a grandparent with quiet pride.
                </p>
              </div>
              <div className="pt-8 pl-0 md:pl-8 not-italic">
                <p className="text-lg sm:text-xl lg:text-2xl font-medium text-[#1A1816] border-l-4 border-[#C9A962]/40 pl-6 py-4 bg-white/50 rounded-r-lg">
                  Our vision is to ensure that such objects are not lost to neglect, imitation, or
                  indifference, but are given a future worthy of their past.
                </p>
              </div>
            </Stagger>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-32 h-32 border border-[#C9A962]/5 rounded-full -translate-x-1/2"></div>
        <div className="absolute bottom-0 right-0 w-44 h-44 bg-[#C9A962]/5 rounded-tl-full blur-2xl"></div>
      </section>

      {/* For Collectors Section */}
      <section className="py-10 px-6 bg-white relative overflow-hidden">
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-1 hidden lg:flex flex-col items-center gap-6 opacity-30">
              <span className="text-[8px] uppercase tracking-[0.3em] font-bold rotate-90 whitespace-nowrap">
                EXT.01
              </span>
              <div className="w-px h-16 bg-[#1A1816]"></div>
            </div>

            <Reveal direction="left" blur className="lg:col-span-5 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full border border-[#C9A962] flex items-center justify-center">
                  <div className="w-1.5 h-1.5 bg-[#C9A962] rounded-full"></div>
                </div>
                <h2 className="text-lg sm:text-2xl font-serif text-[#1A1816]">For Collectors</h2>
              </div>

              <div className="space-y-4 text-[#4A443E] leading-relaxed text-sm lg:text-base font-light">
                <p className="text-base sm:text-lg lg:text-xl font-serif italic text-[#1A1816]">
                  For collectors, The Collectors’ Exchange is a sanctuary.
                </p>
                <div className="w-10 h-px bg-[#C9A962]/50"></div>
                <p>
                  A place built by people who understand the discipline, patience, and emotional
                  commitment required to collect with purpose. Every collection represents years of
                  intention, research, restraint, and passion.
                </p>
                <div className="bg-[#F9F7F4] p-6 border border-[#C9A962]/10 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-[2px] h-full bg-[#C9A962]"></div>
                  <p className="mb-4 font-serif italic text-base md:text-lg text-[#1A1816]">
                    Our vision is to create an environment where collectors can:
                  </p>
                  <ul className="space-y-3">
                    {[
                      'Discover and exchange meaningful objects with confidence',
                      'Pursue their passion without fear of fraud, misrepresentation, or compromise',
                      'Trust that authenticity, provenance, and integrity are never optional',
                    ].map((item, i) => (
                      <li key={i} className="flex items-start gap-2.5 group text-xs sm:text-sm">
                        <Bullet className="text-[#C9A962] mt-0.5" />
                        <span className="text-[#6B635B] group-hover:text-[#1A1816] transition-colors">
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="font-serif italic text-lg md:text-xl text-[#1A1816] pt-2 flex items-center gap-3">
                  <span className="w-8 h-px bg-[#C9A962]/40 inline-block"></span>
                  Here, collectors are custodians of history.
                </p>
              </div>
            </Reveal>

            <Reveal direction="right" distance={90} blur className="lg:col-span-6 relative">
              <Parallax speed={0.1}>
                <div className="relative z-10 p-1 bg-white border border-[#C9A962]/20 shadow-[-10px_10px_30px_rgba(0,0,0,0.05)] rounded-2xl group overflow-hidden">
                  <img
                    src="/img/collectors-study-800.webp"
                    srcSet="/img/collectors-study-480.webp 480w, /img/collectors-study-800.webp 800w"
                    sizes="(max-width: 1024px) 100vw, 500px"
                    alt="Collector's Study"
                    loading="lazy"
                    className="w-full h-[250px] sm:h-[350px] lg:h-[500px] object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-1000 scale-100 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816]/20 to-transparent"></div>
                </div>
              </Parallax>
              {/* Decorative Archival Label */}
              <div className="absolute -bottom-3 -right-3 p-4 bg-[#1A1816] text-[#C9A962] z-20 shadow-xl">
                <div className="text-[7px] uppercase tracking-[0.2em] font-bold">Reference</div>
                <div className="text-base font-serif italic">Unit.01</div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* For Brands & Creators Section */}
      <section className="py-10 px-6 bg-[#F9F7F4] relative overflow-hidden border-y border-[#C9A962]/10">
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid lg:grid-cols-12 gap-10 items-center">
            <Reveal
              direction="left"
              distance={90}
              blur
              className="lg:col-span-6 order-2 lg:order-1 relative"
            >
              <Parallax speed={0.1}>
                <div className="relative z-10 p-1 bg-white border border-[#C9A962]/20 shadow-[10px_10px_30px_rgba(0,0,0,0.05)] rounded-2xl group overflow-hidden">
                  <img
                    src="/img/artisan-800.webp"
                    srcSet="/img/artisan-480.webp 480w, /img/artisan-800.webp 800w"
                    sizes="(max-width: 1024px) 100vw, 500px"
                    alt="Artisan at Work"
                    loading="lazy"
                    className="w-full h-[250px] sm:h-[350px] lg:h-[500px] object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-1000 scale-100 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1816]/20 to-transparent"></div>
                </div>
              </Parallax>
              {/* Decorative Frame */}
              <div className="absolute -top-6 -left-6 w-24 h-24 border border-[#C9A962]/10 rounded-full animate-pulse"></div>
            </Reveal>

            <Reveal direction="right" blur className="lg:col-span-5 order-1 lg:order-2 space-y-5">
              <div className="flex items-center gap-3">
                <h2 className="text-lg sm:text-2xl font-serif text-[#1A1816]">
                  For Brands & Creators
                </h2>
                <div className="w-5 h-5 rounded-full border border-[#C9A962] flex items-center justify-center">
                  <div className="w-1 h-1 bg-[#C9A962] rounded-full"></div>
                </div>
              </div>

              <div className="space-y-4 text-[#4A443E] leading-relaxed text-sm lg:text-base font-light">
                <p className="text-base sm:text-lg lg:text-xl font-serif italic text-[#1A1816]">
                  We believe the secondary market should not diminish creation: it should honour it.
                </p>
                <div className="w-10 h-px bg-[#C9A962]/50 ml-auto"></div>
                <p>
                  For brands and creators who produce limited works, rare editions, or culturally
                  significant pieces, The Collectors’ Exchange is a modern online museum: a place
                  where intent and originality are preserved long after the first sale.
                </p>
                <div className="bg-white p-6 border border-[#C9A962]/10 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-[2px] h-full bg-[#C9A962]"></div>
                  <p className="mb-4 font-serif italic text-base md:text-lg text-[#1A1816]">
                    Our vision is to offer:
                  </p>
                  <ul className="space-y-3">
                    {[
                      'A refined platform to showcase limited editions and collectible works',
                      'A transparent and respectful ecosystem that protects intellectual property',
                      'A secondary market that strengthens brand legacy rather than eroding it',
                    ].map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 group text-xs sm:text-sm text-right justify-end"
                      >
                        <span className="text-[#6B635B] group-hover:text-[#1A1816] transition-colors">
                          {item}
                        </span>
                        <Bullet className="text-[#C9A962] mt-0.5" />
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="font-serif italic text-lg md:text-xl text-[#1A1816] pt-2 flex items-center justify-end gap-3 text-right">
                  By safeguarding authenticity, we ensure that value flows forward.
                  <span className="w-8 h-px bg-[#C9A962]/40 inline-block"></span>
                </p>
              </div>
            </Reveal>

            <div className="lg:col-span-1 hidden lg:flex flex-col items-center gap-6 opacity-30 order-3">
              <span className="text-[8px] uppercase tracking-[0.3em] font-bold rotate-90 whitespace-nowrap">
                EXT.02
              </span>
              <div className="w-px h-16 bg-[#1A1816]"></div>
            </div>
          </div>
        </div>
      </section>

      {/* A Living Legacy Section */}
      <section className="relative py-32 px-6 bg-[#FDFDFD] text-[#1A1816] text-center overflow-hidden border-t border-[#C9A962]/10">
        {/* Subtle Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-[#C9A962]/8 rounded-full blur-[80px] -z-0"></div>

        <div className="container mx-auto max-w-4xl relative z-10">
          <Reveal className="flex justify-center mb-12">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-[#C9A962]/40 flex items-center justify-center bg-white shadow-lg relative">
                <Landmark className="text-[#1A1816] w-8 h-8" strokeWidth={1.2} />
              </div>
              <div className="absolute inset-0 rounded-full border border-[#C9A962]/20 animate-pulse"></div>
              <div className="absolute -inset-1 rounded-full border border-[#C9A962]/10"></div>
            </div>
          </Reveal>

          <Reveal
            as="h2"
            delay={100}
            className="text-3xl sm:text-4xl lg:text-5xl font-serif mb-8 text-[#1A1816] tracking-tight"
          >
            A <span className="text-[#C9A962] italic font-normal">Living Legacy</span>
          </Reveal>

          <div className="flex items-center justify-center gap-4 mb-16">
            <div className="w-12 h-px bg-[#C9A962]/30"></div>
            <div className="w-2 h-2 rounded-full bg-[#C9A962]/50"></div>
            <div className="w-12 h-px bg-[#C9A962]/30"></div>
          </div>

          <Stagger className="space-y-8 text-lg md:text-xl text-heritage-charcoal font-serif italic leading-relaxed max-w-3xl mx-auto mb-16">
            <p className="font-medium">
              We aren't here for the exit; we're here for the century. We draw inspiration from a
              time when value was measured not by price, but by the ability to be carried forward
              across generations.
            </p>
            <p className="font-medium">
              Our goal is to restore the trust that has been lost in the pre-owned market and become
              the definitive destination where every collector can find their piece of history,
              backed by a handshake of absolute integrity.
            </p>
          </Stagger>

          <Reveal
            blur
            className="bg-white border-l-4 border-luxury-gold p-8 md:p-12 shadow-md max-w-3xl mx-auto text-center rounded-r-2xl"
          >
            <p className="text-2xl md:text-3xl font-serif text-heritage-charcoal font-medium leading-tight">
              "We ensure that legacy is given a future worthy of its past."
            </p>
          </Reveal>
        </div>
      </section>

      {/* Three Pillars of Vision */}
      <section className="py-32 px-6 bg-heritage-cream border-y border-heritage-bronze/10">
        <div className="container mx-auto max-w-6xl">
          <Reveal className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-serif text-heritage-charcoal mb-4 tracking-tight">
              Three Pillars
            </h2>
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-px bg-heritage-bronze/30"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-heritage-bronze/50"></div>
              <div className="w-12 h-px bg-heritage-bronze/30"></div>
            </div>
          </Reveal>
          <Stagger step={130} className="grid md:grid-cols-3 gap-8">
            <Tilt>
              <div className="bg-white p-8 lg:p-12 border border-heritage-bronze/10 rounded-2xl group hover:border-luxury-gold hover:shadow-lg transition-all duration-500 shadow-sm flex flex-col h-full">
                <div className="mb-8">
                  <History
                    className="text-luxury-gold w-10 h-10 group-hover:scale-110 transition-transform duration-500"
                    strokeWidth={1.2}
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-serif mb-4 text-heritage-charcoal uppercase tracking-wider">
                  Global Access
                </h3>
                <p className="text-sm text-heritage-charcoal/70 leading-relaxed font-medium flex-grow">
                  Bringing the hidden treasures of India's street markets to the world's most
                  discerning collectors.
                </p>
              </div>
            </Tilt>
            <Tilt>
              <div className="bg-white p-8 lg:p-12 border border-heritage-bronze/10 rounded-2xl group hover:border-luxury-gold hover:shadow-lg transition-all duration-500 shadow-sm flex flex-col h-full">
                <div className="mb-8">
                  <ShieldCheck
                    className="text-luxury-gold w-10 h-10 group-hover:scale-110 transition-transform duration-500"
                    strokeWidth={1.2}
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-serif mb-4 text-heritage-charcoal uppercase tracking-wider">
                  Digital Integrity
                </h3>
                <p className="text-sm text-heritage-charcoal/70 leading-relaxed font-medium flex-grow">
                  Using technology to verify provenance and ensure every transaction is rooted in
                  absolute transparency.
                </p>
              </div>
            </Tilt>
            <Tilt>
              <div className="bg-white p-8 lg:p-12 border border-heritage-bronze/10 rounded-2xl group hover:border-luxury-gold hover:shadow-lg transition-all duration-500 shadow-sm flex flex-col h-full">
                <div className="mb-8">
                  <Landmark
                    className="text-luxury-gold w-10 h-10 group-hover:scale-110 transition-transform duration-500"
                    strokeWidth={1.2}
                  />
                </div>
                <h3 className="text-lg sm:text-xl font-serif mb-4 text-heritage-charcoal uppercase tracking-wider">
                  Heritage Trust
                </h3>
                <p className="text-sm text-heritage-charcoal/70 leading-relaxed font-medium flex-grow">
                  Establishing an institutional registry that protects the legacy of every artifact
                  we touch.
                </p>
              </div>
            </Tilt>
          </Stagger>
        </div>
      </section>

      {/* For Collectors Section — NO image */}
      <section className="py-32 px-6 bg-white relative">
        {/* Archival Marker */}
        <div className="absolute left-10 top-1/2 -translate-y-1/2 hidden xl:block">
          <div className="flex flex-col items-center gap-8">
            <div className="w-px h-24 bg-heritage-bronze/20"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-heritage-charcoal/20 [writing-mode:vertical-rl] rotate-180">
              EXT.01
            </span>
            <div className="w-px h-24 bg-heritage-bronze/20"></div>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl">
          <Reveal className="flex items-center gap-4 mb-10">
            <InstitutionalIcon />
            <h2 className="text-xl sm:text-3xl font-serif text-heritage-charcoal tracking-tight">
              For Collectors
            </h2>
          </Reveal>

          <Stagger className="space-y-6 mb-12">
            <p className="text-2xl font-serif italic text-heritage-charcoal leading-relaxed">
              For collectors, The Collectors' Exchange is a sanctuary.
            </p>
            <p className="text-lg text-heritage-charcoal/70 font-sans leading-relaxed">
              A place built by people who understand the discipline, patience, and emotional
              commitment required to collect with purpose. Every collection represents years of
              intention, research, restraint, and passion.
            </p>
          </Stagger>

          {/* Highlight Box */}
          <Reveal
            blur
            className="bg-heritage-cream/60 border-l-2 border-luxury-gold p-8 md:p-10 space-y-7"
          >
            <p className="text-lg font-serif italic text-heritage-charcoal font-medium">
              Our vision is to create an environment where collectors can:
            </p>
            <ul className="space-y-5">
              {[
                'Discover and exchange meaningful objects with confidence',
                'Pursue their passion without fear of fraud, misrepresentation, or compromise',
                'Trust that authenticity, provenance, and integrity are the foundation of every transaction',
              ].map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-4 text-sm text-heritage-charcoal/80 font-sans leading-snug"
                >
                  <DiamondBullet />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* For Originators Section — NO image */}
      <section className="py-32 px-6 bg-heritage-cream/20 relative">
        {/* Archival Marker */}
        <div className="absolute right-10 top-1/2 -translate-y-1/2 hidden xl:block">
          <div className="flex flex-col items-center gap-8">
            <div className="w-px h-24 bg-heritage-bronze/20"></div>
            <span className="text-[10px] font-bold uppercase tracking-[0.4em] text-heritage-charcoal/20 [writing-mode:vertical-rl]">
              EXT.02
            </span>
            <div className="w-px h-24 bg-heritage-bronze/20"></div>
          </div>
        </div>

        <div className="container mx-auto max-w-4xl">
          <Reveal className="flex items-center gap-4 mb-10">
            <InstitutionalIcon />
            <h2 className="text-xl sm:text-3xl font-serif text-heritage-charcoal tracking-tight">
              For Originators
            </h2>
          </Reveal>

          <Stagger className="space-y-6 mb-12">
            <p className="text-2xl font-serif italic text-heritage-charcoal leading-relaxed">
              For the originators, we are the bridge to a global legacy.
            </p>
            <p className="text-lg text-heritage-charcoal/70 font-sans leading-relaxed">
              We honor the craftsmen, the sellers, and the families who have preserved these
              treasures. Our platform ensures that their dedication is recognized and rewarded by
              connecting them directly with those who value history most.
            </p>
          </Stagger>

          {/* Highlight Box */}
          <Reveal blur className="bg-white border-l-2 border-luxury-gold p-8 md:p-10 space-y-7">
            <p className="text-lg font-serif italic text-heritage-charcoal font-medium">
              Our vision is to create a marketplace where originators can:
            </p>
            <ul className="space-y-5">
              {[
                'Present their heritage to a global audience of dedicated custodians',
                'Receive fair and transparent value for their historical treasures',
                'Contribute to the preservation of cultural legacy through authorized exchange',
              ].map((item, index) => (
                <li
                  key={index}
                  className="flex items-start gap-4 text-sm text-heritage-charcoal/80 font-sans leading-snug"
                >
                  <DiamondBullet />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* Final Vision Statement */}
      <section className="py-32 bg-heritage-charcoal text-white text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <Landmark
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px]"
            strokeWidth={0.5}
          />
        </div>
        <Reveal blur className="relative z-10 container mx-auto px-6 max-w-3xl">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <Sparkles
                className="text-luxury-gold w-14 h-14 drop-shadow-[0_0_20px_rgba(212,175,55,0.3)]"
                strokeWidth={1}
              />
              <div className="absolute -inset-2 border border-luxury-gold/20 rounded-full animate-pulse"></div>
            </div>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-serif mb-12 italic leading-tight tracking-tight">
            "To ensure that history remains not just a memory, but a tangible legacy that can be
            held, shared, and passed forward."
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className="w-12 h-px bg-luxury-gold/50"></div>
            <div className="w-2 h-2 rounded-full bg-luxury-gold/60"></div>
            <div className="w-12 h-px bg-luxury-gold/50"></div>
          </div>
        </Reveal>
      </section>
    </div>
  );
};

export default Vision;

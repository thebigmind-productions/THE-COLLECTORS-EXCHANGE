import React from 'react';
import SEO, { PageSchema, BreadcrumbSchema } from '../components/SEO';
import { Reveal } from '../components/Motion';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from '../config/contact';

const TERMS_TITLE = 'Terms & Conditions';
const TERMS_DESC =
  'Read the Terms & Conditions of The Collectors Exchange. Understand the custodianship agreement, buyer terms, and legal policies for our platform.';

const Terms = () => {
  return (
    <div className="min-h-screen bg-white text-black py-8 sm:py-12 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto">
      <SEO title={TERMS_TITLE} description={TERMS_DESC} canonical="/terms" />
      <PageSchema type="WebPage" name={TERMS_TITLE} description={TERMS_DESC} path="/terms" />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Terms & Conditions', url: '/terms' },
        ]}
      />
      {/* Header */}
      <Reveal className="mb-12 border-b border-gray-200 pb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4">
          THE COLLECTORS EXCHANGE: CUSTODIANSHIP AGREEMENT
        </h1>
        <p className="text-gray-500 font-sans">Last Updated: April 2026</p>
        <div className="w-20 h-1 bg-luxury-gold mt-6"></div>
      </Reveal>

      {/* Business Information - PayU Compliance */}
      <Reveal className="mb-10 p-6 bg-gray-50 border border-gray-200 rounded-2xl">
        <h2 className="text-sm font-bold uppercase tracking-widest text-luxury-gold mb-4">
          Business Information
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700">
          <div>
            <p className="font-medium text-black">Legal Name (Proprietor):</p>
            <p>Shaik Mohammed Faraz</p>
          </div>
          <div>
            <p className="font-medium text-black">Phone:</p>
            <p>{SUPPORT_PHONE_DISPLAY}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="font-medium text-black">Operating Address:</p>
            <p>
              No 51/2, 2nd Main Road, New Guruppanapalya, Bangalore South, PO: Dharmaram College,
              DIST: Bengaluru, Karnataka - 560029
            </p>
          </div>
          <div>
            <p className="font-medium text-black">Email:</p>
            <p>{SUPPORT_EMAIL}</p>
          </div>
        </div>
      </Reveal>

      {/* Introduction */}
      <Reveal className="mb-10 font-sans text-gray-700 leading-relaxed">
        <p className="mb-4 italic text-lg font-serif text-black">
          Welcome to The Collectors Exchange. By acquiring an article from our collection, you are
          entering into a relationship built on the "Truth of Heritage."
        </p>
        <p>This document outlines our mutual responsibilities to the history we preserve.</p>
      </Reveal>

      {/* Sections */}
      <div className="space-y-10 font-sans text-gray-800">
        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            1. The Authenticity Pledge (The "Doctor vs. Cobbler" Rule)
          </h2>
          <p className="mb-3 text-gray-700">
            We reject "misbranding." Every article sold through The Collectors Exchange undergoes a
            rigorous internal verification process to ensure it is exactly what we claim it to be.
          </p>
          <p className="mb-2 font-medium text-black">The Guarantee:</p>
          <p className="mb-3 text-gray-700">
            We guarantee the authenticity of the mechanical heartbeat and historical provenance of
            our articles.
          </p>
          <p className="mb-2 font-medium text-black">The Recourse:</p>
          <p className="text-gray-700">
            If an article is proven by a certified independent third-party expert to be a modern
            imitation or "misbranded" contrary to our description, The Collectors Exchange will
            provide a full recovery of the purchase price. We do not sell "luxury labels"; we sell
            "historic truths."
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            2. Condition of Heritage Articles
          </h2>
          <p className="mb-3 text-gray-700">
            You are acquiring pieces of time. Most articles in our collection, specifically
            Timepieces, Antiques, and Collectibles, are "pre-owned" and sourced from the streets,
            pawn shops, and private collections of India.
          </p>
          <p className="mb-2 font-medium text-black">Patina & History:</p>
          <p className="mb-3 text-gray-700">
            Visible wear, aging, and "character marks" are considered part of the article's history,
            not defects.
          </p>
          <p className="mb-2 font-medium text-black">Functional State:</p>
          <p className="text-gray-700">
            While we ensure that all mechanical items (like watches) are in working order at the
            time of sale, they are vintage machines. They require the care of a custodian, not the
            rough handling of a consumer.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            3. The Stewardship & Annual Health Check
          </h2>
          <p className="mb-3 text-gray-700">
            Unique to our brand, our responsibility does not end at your doorstep.
          </p>
          <p className="mb-2 font-medium text-black">The Annual Review:</p>
          <p className="mb-3 text-gray-700">
            Every 12 months, The Collectors Exchange will attempt to contact the Custodian (the
            buyer) to check on the "health" of the article.
          </p>
          <p className="mb-2 font-medium text-black">Scope:</p>
          <p className="text-gray-700">
            This is a consultation service. We provide advice on preservation, storage, and
            maintenance. While we may offer cleaning or servicing for a fee, the Annual Health Check
            is a commitment to the item's longevity, not a lifetime free repair warranty.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            4. Ethical Sourcing & The "Street" Mandate
          </h2>
          <p className="mb-3 text-gray-700">
            We "collect the streets" to find the needle in the haystack.
          </p>
          <p className="mb-2 font-medium text-black">Provenance:</p>
          <p className="mb-3 text-gray-700">
            We verify that every item we source from pawn shops or local markets is acquired legally
            and ethically.
          </p>
          <p className="mb-2 font-medium text-black">Title:</p>
          <p className="text-gray-700">
            Upon full payment, the legal title and "Custodianship" of the article pass to you. You
            are now the protector of that piece of Indian history.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            5. Transfer of Custodianship (Returns & Exchanges)
          </h2>
          <p className="mb-3 text-gray-700">
            Because our articles are unique, historical, and often one-of-a-kind, we do not operate
            a "mass-market" return policy.
          </p>
          <p className="mb-2 font-medium text-black">Finality:</p>
          <p className="mb-3 text-gray-700">
            All sales are considered a transfer of heritage and are final once the article has been
            inspected and accepted by the Custodian.
          </p>
          <p className="mb-2 font-medium text-black">Inspection Period:</p>
          <p className="text-gray-700">
            For online acquisitions, the Custodian has 48 hours from delivery to report any
            discrepancies between the article received and the "Truth" described on our platform.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            6. The Custodian's Responsibility
          </h2>
          <p className="mb-3 text-gray-700">By purchasing from us, you agree to:</p>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>Treat the article with the respect due to a piece of Indian heritage.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Avoid "cheap" or unverified repairs that could damage the historical value of the
                article.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Notify us if you intend to sell the item in the future, as we often maintain a
                "Registry of History" for the pieces we have rescued.
              </span>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            7. Limitations of Modern Technology
          </h2>
          <p className="text-gray-700">
            While we use digital platforms to reach "netizens," we are not an "innovation company."
            We are a traditional business. We are not liable for minor color variations caused by
            your screen settings or for the "digital noise" of the internet. The "Truth" of the
            article is found in its physical form, not its digital image.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">8. Governing Law</h2>
          <p className="text-gray-700">
            This Exchange is rooted in Indian values and is governed by the laws of the Republic of
            India. Any disputes will be settled with the integrity our ancestors taught us, through
            mediation, or under the jurisdiction of the courts in Bangalore, Karnataka.
          </p>
        </Reveal>
      </div>

      {/* Founder's Closing Note */}
      <Reveal className="mt-12 sm:mt-16 p-6 sm:p-8 bg-heritage-cream border border-luxury-gold/20 rounded-2xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-luxury-gold mb-4">
          Founder's Closing Note
        </h3>
        <p className="font-serif italic text-lg text-heritage-charcoal leading-relaxed">
          "These terms are not here to hide behind. They are here to ensure that both the seller and
          the buyer remain honest to the history we are holding in our hands. If you seek a startup
          bubble, look elsewhere. If you seek the Truth, welcome to the Exchange."
        </p>
      </Reveal>
    </div>
  );
};

export default Terms;

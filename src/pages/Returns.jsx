import React from 'react';
import SEO, { PageSchema, BreadcrumbSchema } from '../components/SEO';
import { Reveal } from '../components/Motion';
import { SUPPORT_EMAIL, MAILTO_HREF } from '../config/contact';
import { DISPATCH_DAYS, DELIVERY_DAYS, REFUND_DAYS, INSPECTION_HOURS } from '../config/shipping';

const RETURNS_TITLE = 'Returns, Refunds & Shipping Policy';
const RETURNS_DESC =
  'Learn about The Collectors Exchange returns, refunds, and shipping policy. 48-hour return window, free domestic shipping, and authenticity guarantee.';

const Returns = () => {
  return (
    <div className="min-h-screen bg-white text-black py-8 sm:py-12 px-6 md:px-12 lg:px-24 max-w-5xl mx-auto">
      <SEO title={RETURNS_TITLE} description={RETURNS_DESC} canonical="/returns" />
      <PageSchema type="WebPage" name={RETURNS_TITLE} description={RETURNS_DESC} path="/returns" />
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: '/' },
          { name: 'Returns & Refunds', url: '/returns' },
        ]}
      />
      <Reveal className="mb-12 border-b border-gray-200 pb-8">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold mb-4">
          RETURNS, REFUNDS & SHIPPING POLICY
        </h1>
        <p className="text-gray-500 font-sans">Last Updated: May 2026</p>
        <div className="w-20 h-1 bg-luxury-gold mt-6"></div>
      </Reveal>

      <div className="space-y-10 font-sans text-gray-800">
        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            1. Authenticity Guarantee & Returns
          </h2>
          <p className="mb-3 text-gray-700">
            Every item sold on The Collectors Exchange is verified for authenticity before listing.
            We guarantee that what you receive is exactly what was described.
          </p>
          <p className="mb-2 font-medium text-black">If an item is found to be inauthentic:</p>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Contact us within 7 days of delivery with a detailed description and supporting
                evidence from a certified independent expert.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Upon verification by our team, we will provide a full refund of the purchase price
                including shipping.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>The item must be returned in the same condition it was delivered.</span>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            2. Inspection Period & Condition Discrepancies
          </h2>
          <p className="mb-3 text-gray-700">
            Because our articles are one-of-a-kind heritage pieces, we provide a {INSPECTION_HOURS}
            -hour inspection period from the time of delivery.
          </p>
          <p className="mb-2 font-medium text-black">During this period:</p>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Examine the item thoroughly. Compare it against the description, images, and
                condition notes provided on the listing.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                If there is a significant discrepancy (e.g., damage not disclosed, incorrect model,
                missing components), report it to us immediately at{' '}
                <a href={MAILTO_HREF} className="text-luxury-gold hover:underline">
                  {SUPPORT_EMAIL}
                </a>
                .
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                We will review your claim and may offer a partial refund, full return, or
                replacement depending on the nature of the discrepancy.
              </span>
            </li>
          </ul>
          <p className="text-sm text-gray-500 mt-2 italic">
            Note: Normal wear, patina, and character marks consistent with the item's age and
            described condition are not considered discrepancies.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            3. Change of Mind / Buyer's Remorse
          </h2>
          <p className="text-gray-700">
            Given the unique, curated nature of our inventory, we do not accept returns for change
            of mind. Each piece is one-of-a-kind and removed from the market once purchased. We
            encourage buyers to review all details, images, and descriptions carefully before
            completing a purchase.
          </p>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            4. Shipping & Delivery
          </h2>
          <p className="mb-3 text-gray-700">
            We partner with trusted courier services to ensure your item arrives safely.
          </p>
          <ul className="space-y-3 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5 font-bold" aria-hidden="true">
                •
              </span>
              <div>
                <span className="font-medium text-black">Processing Time:</span>
                <span className="block text-gray-600">
                  {' '}
                  Orders are processed within {DISPATCH_DAYS} business days after payment
                  confirmation. High-value or fragile items may require additional packaging time.
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5 font-bold" aria-hidden="true">
                •
              </span>
              <div>
                <span className="font-medium text-black">Tracking:</span>
                <span className="block text-gray-600">
                  {' '}
                  A tracking ID is provided once the order is shipped. You can monitor your delivery
                  status from your account dashboard under "My Orders."
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5 font-bold" aria-hidden="true">
                •
              </span>
              <div>
                <span className="font-medium text-black">Insurance:</span>
                <span className="block text-gray-600">
                  {' '}
                  All shipments are insured against loss or damage during transit.
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5 font-bold" aria-hidden="true">
                •
              </span>
              <div>
                <span className="font-medium text-black">Delivery Timeline:</span>
                <span className="block text-gray-600">
                  {' '}
                  Domestic deliveries typically arrive within {DELIVERY_DAYS} business days.
                  International shipping timelines vary by destination.
                </span>
              </div>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            5. Damaged or Lost in Transit
          </h2>
          <p className="mb-3 text-gray-700">
            If your item arrives damaged or is lost during shipping:
          </p>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>Document the damage with photographs and retain all packaging materials.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Contact us within {INSPECTION_HOURS} hours of delivery at{' '}
                <a href={MAILTO_HREF} className="text-luxury-gold hover:underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                with your order number and photos.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                We will file a claim with the courier and arrange a replacement or full refund,
                including shipping.
              </span>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">
            6. Refund Processing
          </h2>
          <p className="mb-3 text-gray-700">
            Approved refunds are processed within {REFUND_DAYS} business days and credited to the
            original payment method.
          </p>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Refunds cover the full purchase price and applicable shipping charges for approved
                return requests.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Return shipping costs for non-defect returns (where applicable) are borne by the
                buyer.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>Payment gateway charges (if any) are non-refundable.</span>
            </li>
          </ul>
        </Reveal>

        <Reveal as="section" delay={60} distance={40}>
          <h2 className="text-2xl font-serif font-semibold mb-4 text-black">7. Exclusions</h2>
          <ul className="space-y-2 text-gray-700 mb-3">
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>
                Auction purchases are final and are not eligible for returns unless the item is
                found to be inauthentic as per Section 1.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>Custom or modified items cannot be returned.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-luxury-gold mt-1.5" aria-hidden="true">
                •
              </span>
              <span>Items returned without prior authorization will not be accepted.</span>
            </li>
          </ul>
        </Reveal>
      </div>

      <Reveal className="mt-12 sm:mt-16 p-6 sm:p-8 bg-heritage-cream border border-luxury-gold/20 rounded-2xl">
        <h3 className="text-sm font-bold uppercase tracking-widest text-luxury-gold mb-4">
          Need Help?
        </h3>
        <p className="font-serif text-lg text-heritage-charcoal leading-relaxed">
          If you have any questions about our return policy or need assistance with an order, please
          contact us at{' '}
          <a href={MAILTO_HREF} className="text-luxury-gold hover:underline">
            {SUPPORT_EMAIL}
          </a>
          . We are here to ensure your experience with The Collectors Exchange is one of trust and
          satisfaction.
        </p>
      </Reveal>
    </div>
  );
};

export default Returns;

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import SEO, { FAQSchema, PageSchema, BreadcrumbSchema } from '../components/SEO';
import { CORE_PAGES } from '../config/seo-pages';
import { Reveal, Stagger, Magnetic } from '../components/Motion';
import { SUPPORT_EMAIL } from '../config/contact';
import { DELIVERY_DAYS, DISPATCH_DAYS, INSPECTION_HOURS } from '../config/shipping';

const FAQ_ITEMS = [
  {
    category: 'Buying',
    questions: [
      {
        q: 'How do I purchase an item on The Collectors Exchange?',
        a: "Browse The Exchange, find an item you love, add it to your cart, and proceed to checkout. You'll need to create an account and choose your preferred payment method: pay online via our secure Razorpay integration (UPI, cards, net banking) or select Cash on Delivery.",
      },
      {
        q: "Is there a buyer's premium or additional fee?",
        a: 'For online payments, a 5% platform fee is included in the checkout total. Cash on Delivery orders have a small additional handling fee. This covers authentication, secure transactions, and collector support.',
      },
      {
        q: 'Can I return an item?',
        a: `Items are eligible for return within ${INSPECTION_HOURS} hours of delivery if they do not match the described condition. Please refer to our Terms & Conditions for the full inspection period policy.`,
      },
      {
        q: 'How are items authenticated?',
        a: 'All items listed on The Exchange go through a rigorous verification process by our curation team before being published. Each item is individually reviewed for authenticity and condition.',
      },
      {
        q: 'What payment methods are accepted?',
        a: 'We offer two payment options: (1) Online Payment via Razorpay, which supports UPI, credit/debit cards, net banking, and other major Indian payment methods. (2) Cash on Delivery (COD), pay in cash when your order arrives at your doorstep.',
      },
    ],
  },
  {
    category: 'Selling',
    questions: [
      {
        q: 'How do I start selling on The Exchange?',
        a: 'Create an account, complete identity verification (KYC), accept the Seller Agreement, and submit your items for brokerage. Once approved by our curation team, your items will be listed on The Exchange.',
      },
      {
        q: 'What are the seller fees?',
        a: 'Individual sellers can list up to 5 items. Company accounts have unlimited listings. Platform fees are deducted at the time of sale.',
      },
      {
        q: 'How do I get paid?',
        a: 'Payments for sold items are held for 7 days after delivery to allow for buyer inspection. After this period, funds become available for payout.',
      },
      {
        q: 'What items can I sell?',
        a: 'We accept timepieces, collectibles, antiques, jewelry, toys & pop culture items. All items must be authentic and accurately described. Our curation team reserves the right to reject any listing.',
      },
      {
        q: 'How long does verification take?',
        a: 'KYC verification is typically completed within 48 hours. Product listing review times vary based on the current volume.',
      },
    ],
  },
  {
    category: 'Account & Security',
    questions: [
      {
        q: 'How do I create an account?',
        a: 'Click on the Account icon and choose "Create Application". You can sign up with your email or use Google OAuth for a faster registration.',
      },
      {
        q: 'Is my personal information secure?',
        a: 'Yes. All data is encrypted and handled per our Privacy Policy. We use Supabase for authentication and secure data storage. Your identity remains anonymous to buyers unless you choose otherwise.',
      },
      {
        q: 'How do I delete my account?',
        a: `Please contact our support team at ${SUPPORT_EMAIL} with your account details, and we will assist you with account deletion.`,
      },
      {
        q: 'What is the KYC verification process?',
        a: 'KYC requires submitting identity documents (Aadhaar, PAN) along with a digital signature of the Seller Agreement. Company accounts require additional documentation including GST and incorporation certificates.',
      },
    ],
  },
  {
    category: 'Shipping & Delivery',
    questions: [
      {
        q: 'How are items shipped?',
        a: 'Items are shipped via Delhivery, our logistics partner. Tracking IDs are provided once the order is shipped from our verification center.',
      },
      {
        q: 'What are the shipping costs?',
        a: 'Shipping is free for all orders within India. International shipping costs vary based on the item and destination.',
      },
      {
        q: 'How long does delivery take?',
        a: `Orders are dispatched within ${DISPATCH_DAYS} business days, and domestic deliveries typically arrive within ${DELIVERY_DAYS} business days. International delivery times vary.`,
      },
      {
        q: 'Do you ship internationally?',
        a: 'Yes, we ship to select international destinations. Please contact our support team for international shipping inquiries.',
      },
    ],
  },
];

const faqSeo = CORE_PAGES['/faq'];

const FAQ = () => {
  const [search, setSearch] = useState('');
  const [openItems, setOpenItems] = useState({});

  // Keyed by category slug, not by the index into `filtered` — that index
  // shifts as soon as a search removes a category, which would silently move
  // the open/closed state onto a different question.
  const slug = (value) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

  const toggleItem = (catSlug, qIdx) => {
    const key = `${catSlug}-${qIdx}`;
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filtered = FAQ_ITEMS.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (item) =>
        !search ||
        item.q.toLowerCase().includes(search.toLowerCase()) ||
        item.a.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.questions.length > 0);

  const faqItems = FAQ_ITEMS.flatMap((cat) => cat.questions);

  return (
    <div className="min-h-screen bg-secondary-bg">
      <SEO title={faqSeo.title} description={faqSeo.description} canonical="/faq" />
      <PageSchema type="FAQPage" name={faqSeo.h1} description={faqSeo.description} path="/faq" />
      <BreadcrumbSchema items={faqSeo.breadcrumb} />
      <FAQSchema items={faqItems} />
      <div className="container mx-auto py-12 sm:py-20 px-6 max-w-3xl">
        <Reveal className="text-center mb-12" blur>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-gray-500 text-sm sm:text-base font-light mb-8">
            Find answers to common questions about buying, selling, and using The Collectors
            Exchange.
          </p>
          <div className="relative max-w-md mx-auto">
            <label htmlFor="faq-search" className="sr-only">
              Search frequently asked questions
            </label>
            <Search
              size={18}
              aria-hidden="true"
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
            <input
              id="faq-search"
              name="faq-search"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="Search FAQs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:border-luxury-gold"
            />
          </div>
        </Reveal>

        {/* `filtered` drops empty categories, so a search with no matches used
            to render literally nothing: no message, no way back. */}
        {search && filtered.length === 0 && (
          <div
            role="status"
            className="bg-white border border-gray-100 shadow-sm rounded-2xl p-10 text-center"
          >
            <p className="font-serif text-lg text-heritage-charcoal mb-2">
              No answers matched &ldquo;{search}&rdquo;
            </p>
            <p className="text-gray-600 text-sm mb-6">
              Try a different word, or clear the search to see every question.
            </p>
            <button
              type="button"
              onClick={() => setSearch('')}
              className="inline-block bg-black text-white px-8 py-3 text-xs uppercase tracking-widest hover:bg-luxury-gold hover:text-black transition-colors rounded-full"
            >
              Clear search
            </button>
          </div>
        )}

        <div className="space-y-8">
          {filtered.map((category) => (
            <Reveal key={category.category} as="div">
              <h2 className="text-xl sm:text-2xl font-serif mb-3 text-heritage-charcoal">
                {category.category}
              </h2>
              <div className="w-12 h-px bg-luxury-gold/50 mb-4" />
              <Stagger className="space-y-2" step={70} distance={28}>
                {category.questions.map((item, qIdx) => {
                  const catSlug = slug(category.category);
                  const key = `${catSlug}-${qIdx}`;
                  const isOpen = openItems[key];
                  const panelId = `faq-answer-${key}`;
                  return (
                    <div
                      key={qIdx}
                      className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden"
                    >
                      {/* aria-expanded/aria-controls: without them the
                          trigger is announced as a plain button and a screen
                          reader user has no way to know it reveals an answer,
                          or whether that answer is already showing. */}
                      <button
                        type="button"
                        onClick={() => toggleItem(catSlug, qIdx)}
                        aria-expanded={Boolean(isOpen)}
                        aria-controls={panelId}
                        id={`${panelId}-trigger`}
                        className="w-full flex items-center justify-between p-5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <span className="font-medium text-heritage-charcoal pr-4">{item.q}</span>
                        {isOpen ? (
                          <ChevronUp
                            size={18}
                            aria-hidden="true"
                            className="text-luxury-gold flex-shrink-0"
                          />
                        ) : (
                          <ChevronDown
                            size={18}
                            aria-hidden="true"
                            className="text-gray-500 flex-shrink-0"
                          />
                        )}
                      </button>
                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={`${panelId}-trigger`}
                        className={`px-5 text-gray-600 leading-relaxed text-sm border-t border-gray-100 ${isOpen ? 'pb-5 pt-4' : 'h-0 overflow-hidden p-0 border-t-0'}`}
                        hidden={!isOpen}
                      >
                        {item.a}
                      </div>
                    </div>
                  );
                })}
              </Stagger>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-16 text-center bg-white p-10 border border-gray-100 shadow-sm rounded-2xl">
          <h2 className="text-xl sm:text-2xl font-serif mb-4">Still have questions?</h2>
          <p className="text-gray-500 mb-6">We're here to help you.</p>
          <Magnetic>
            {/* <Link>, not <a href>: a raw anchor forces a full document
                reload and a fresh bundle download mid-session. */}
            <Link
              to="/contact"
              className="inline-block bg-black text-white px-10 py-4 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors rounded-full"
            >
              Contact Us
            </Link>
          </Magnetic>
        </Reveal>
      </div>
    </div>
  );
};

export default FAQ;

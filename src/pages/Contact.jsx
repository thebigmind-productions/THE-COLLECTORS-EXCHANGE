import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail,
  MessageSquare,
  Clock,
  Send,
  Loader2,
  CheckCircle,
  MessageCircle,
  Zap,
} from 'lucide-react';
import SEO, { PageSchema, BreadcrumbSchema } from '../components/SEO';
import { CORE_PAGES } from '../config/seo-pages';
import { whatsAppHref, SUPPORT_PHONE_DISPLAY, SUPPORT_EMAIL, MAILTO_HREF } from '../config/contact';
import apiClient from '../hooks/api/apiClient';
import { Reveal, Magnetic, Tilt } from '../components/Motion';

const cards = [
  {
    icon: MessageCircle,
    title: 'WhatsApp (Preferred)',
    content: (
      <div className="flex flex-col items-center gap-2">
        <a
          href={whatsAppHref()}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-green-600 font-medium hover:underline break-words"
        >
          {SUPPORT_PHONE_DISPLAY}
        </a>
        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
          <Zap size={12} /> Immediate Response
        </span>
      </div>
    ),
  },
  {
    icon: Mail,
    title: 'Email',
    content: (
      <a
        href={MAILTO_HREF}
        className="text-sm text-gray-600 hover:text-luxury-gold transition-colors break-words"
      >
        {SUPPORT_EMAIL}
      </a>
    ),
  },
  {
    icon: Clock,
    title: 'Response Time',
    content: (
      <div className="text-center">
        <p className="text-sm font-medium text-green-600 mb-1">WhatsApp</p>
        <p className="text-xs text-gray-600">Within minutes</p>
        <p className="text-xs text-gray-400 mt-2">Email: 24–48 hours</p>
      </div>
    ),
  },
];

const contactSeo = CORE_PAGES['/contact'];

const Contact = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await apiClient.post('/contact', form);
      setSent(true);
    } catch {
      const mailto = `${MAILTO_HREF}&body=${encodeURIComponent(`From: ${form.name} (${form.email})\n\n${form.message}`)}`;
      window.location.href = mailto;
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-secondary-bg flex items-center justify-center px-4">
        <SEO title={contactSeo.title} description={contactSeo.description} canonical="/contact" />
        <PageSchema
          type="ContactPage"
          name={contactSeo.h1}
          description={contactSeo.description}
          path="/contact"
        />
        <BreadcrumbSchema items={contactSeo.breadcrumb} />
        <div className="text-center max-w-md mx-auto p-6 sm:p-12">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-6 sm:w-16 sm:h-16" />
          <h1 className="text-2xl sm:text-3xl font-serif mb-4">Message Sent</h1>
          <p className="text-gray-500 mb-8 text-sm sm:text-base">
            Thank you for reaching out. Our team will respond within 24–48 hours.
          </p>
          {/* <Link>, not <a href="/">: a raw anchor tears down the SPA and
              re-downloads the whole bundle mid-session. */}
          <Link to="/" className="text-luxury-gold hover:underline font-medium">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-secondary-bg flex items-center">
      <SEO title={contactSeo.title} description={contactSeo.description} canonical="/contact" />
      <PageSchema
        type="ContactPage"
        name={contactSeo.h1}
        description={contactSeo.description}
        path="/contact"
      />
      <BreadcrumbSchema items={contactSeo.breadcrumb} />
      <div className="w-full container mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 md:py-24">
        <Reveal className="text-center mb-10 sm:mb-14 md:mb-16" blur>
          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-serif mb-3 sm:mb-4">Contact Us</h1>
          <p className="text-gray-500 text-sm sm:text-base font-light max-w-2xl mx-auto px-2">
            Have a question or need assistance? We're here to help.
          </p>
        </Reveal>

        {/* Quick Contact Methods */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 mb-12 sm:mb-16 max-w-5xl mx-auto">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const isWhatsApp = card.title.includes('WhatsApp');
            return (
              <Reveal key={i} delay={i * 130} className="h-full">
                <Tilt className="h-full">
                  <div
                    className={`h-full rounded-2xl p-6 sm:p-8 text-center shadow-sm hover:shadow-md transition-all duration-300 border flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px] ${
                      isWhatsApp
                        ? 'bg-gradient-to-br from-white to-green-50/30 border-green-200/50 ring-1 ring-green-100/50'
                        : 'bg-white border-gray-100'
                    }`}
                  >
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mb-4 sm:mb-5 shrink-0 ${
                        isWhatsApp ? 'bg-green-500/15' : 'bg-luxury-gold/10'
                      }`}
                    >
                      <Icon
                        size={22}
                        className={`sm:w-7 sm:h-7 ${
                          isWhatsApp ? 'text-green-600' : 'text-luxury-gold'
                        }`}
                      />
                    </div>
                    <h2
                      className={`font-serif text-base sm:text-lg font-medium mb-2 ${
                        isWhatsApp ? 'text-green-700' : ''
                      }`}
                    >
                      {card.title}
                    </h2>
                    <div className="max-w-full">{card.content}</div>
                  </div>
                </Tilt>
              </Reveal>
            );
          })}
        </div>

        {/* WhatsApp CTA Banner */}
        <Reveal direction="up" className="mb-12 sm:mb-16 max-w-3xl mx-auto">
          <a
            href={whatsAppHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="block bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300/50 rounded-2xl p-8 sm:p-10 text-center hover:border-green-400 hover:shadow-lg transition-all duration-300 group"
          >
            <div className="flex items-center justify-center gap-3 mb-3">
              <MessageCircle size={24} className="text-green-600" />
              <h3 className="text-xl sm:text-2xl font-serif font-medium text-green-900">
                Connect with us on WhatsApp
              </h3>
            </div>
            <p className="text-green-700/80 text-sm sm:text-base mb-4">
              Get immediate responses to your queries. We're available for instant assistance.
            </p>
            <div className="inline-flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-full font-medium text-sm group-hover:bg-green-700 transition-colors">
              <MessageCircle size={16} />
              Open WhatsApp — {SUPPORT_PHONE_DISPLAY}
            </div>
          </a>
        </Reveal>

        <Reveal
          direction="up"
          className="bg-white rounded-2xl p-6 sm:p-8 md:p-12 shadow-sm border border-gray-100 max-w-3xl mx-auto"
        >
          <div className="text-center mb-8 sm:mb-10">
            <h2 className="text-lg sm:text-2xl font-serif mb-2 text-center">Send us a message</h2>
            <p className="text-xs sm:text-sm text-gray-500 italic">
              Or connect on WhatsApp for faster responses
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <div>
                <label
                  htmlFor="contact-name"
                  className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 sm:mb-2"
                >
                  Name
                </label>
                <input
                  id="contact-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors rounded text-sm sm:text-base"
                />
              </div>
              <div>
                <label
                  htmlFor="contact-email"
                  className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 sm:mb-2"
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  inputMode="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors rounded text-sm sm:text-base"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="contact-subject"
                className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 sm:mb-2"
              >
                Subject
              </label>
              <input
                id="contact-subject"
                name="subject"
                type="text"
                required
                autoComplete="off"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors rounded text-sm sm:text-base"
              />
            </div>
            <div>
              <label
                htmlFor="contact-message"
                className="block text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5 sm:mb-2"
              >
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                required
                rows={5}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full p-3 sm:p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors leading-relaxed rounded text-sm sm:text-base"
              />
            </div>
            <Magnetic className="block w-full sm:w-auto sm:mx-auto">
              <button
                type="submit"
                disabled={sending}
                className="bg-black text-white px-8 sm:px-10 py-3 sm:py-4 text-xs sm:text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors flex items-center justify-center gap-2 w-full sm:w-auto sm:mx-auto rounded-full"
              >
                {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Send Message
              </button>
            </Magnetic>
          </form>
        </Reveal>
      </div>
    </section>
  );
};

export default Contact;

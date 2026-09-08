import React from 'react';
import { Link } from 'react-router-dom';
import { Instagram, Facebook, Linkedin, Mail, Phone, MessageCircle } from 'lucide-react';
import { openConsentPreferences } from '../utils/consent';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  TEL_HREF,
  MAILTO_HREF,
  whatsAppHref,
} from '../config/contact';

const Footer = () => {
  return (
    <footer className="bg-black text-white pt-12 sm:pt-20 pb-28 md:pb-28 lg:pb-10 border-t border-gray-900">
      <div className="px-3 sm:px-6 md:px-12 lg:px-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 md:gap-12">
          {/* Left: Brand */}
          <div className="lg:col-span-5 flex flex-col space-y-3 sm:space-y-6 text-left">
            <div>
              <h2 className="text-base sm:text-2xl font-serif font-bold tracking-widest mb-1.5 sm:mb-2">
                THE COLLECTORS EXCHANGE
              </h2>
              <div className="w-12 sm:w-16 h-0.5 bg-luxury-gold opacity-70"></div>
            </div>
            <p className="text-gray-400 font-light leading-relaxed max-w-sm text-xs sm:text-sm">
              A curated marketplace for verified pre-owned collectibles, antiques, and limited
              pieces.
            </p>
            <p className="font-serif italic text-white text-base sm:text-lg">
              Preserving Value. Celebrating Authenticity.
            </p>
            <div className="pt-1 sm:pt-2 space-y-3">
              <div>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-luxury-gold mb-1.5 sm:mb-2">
                  Proprietor
                </p>
                <p className="text-gray-400 text-xs sm:text-sm font-medium">SYEEDA SABA</p>
              </div>
              <div>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-luxury-gold mb-1.5 sm:mb-2">
                  Contact Us
                </p>
                <a
                  href={MAILTO_HREF}
                  className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
                >
                  <Mail size={14} />
                  {SUPPORT_EMAIL}
                </a>
              </div>
              <div>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-luxury-gold mb-1.5 sm:mb-2">
                  Operating Address
                </p>
                <p className="text-gray-400 text-xs sm:text-sm leading-relaxed">
                  New Guruppanapalya, Bengaluru, Karnataka - 560029
                </p>
              </div>
              <div>
                <p className="text-[8px] sm:text-[10px] uppercase tracking-widest text-luxury-gold mb-1.5 sm:mb-2">
                  Call &amp; WhatsApp
                </p>
                <div className="flex items-center gap-4">
                  <a
                    href={TEL_HREF}
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
                  >
                    <Phone size={14} />
                    {SUPPORT_PHONE_DISPLAY}
                  </a>
                  <a
                    href={whatsAppHref()}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Chat on WhatsApp"
                    className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm"
                  >
                    <MessageCircle size={14} />
                    WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Links */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <div className="flex flex-col space-y-3 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-serif font-semibold text-luxury-gold uppercase tracking-wider">
                Company
              </h3>
              <div className="flex flex-col space-y-2 sm:space-y-3 font-light text-gray-400 text-xs sm:text-sm">
                <Link to="/about" className="hover:text-white transition-colors duration-300">
                  About Us
                </Link>
                <Link to="/archive" className="hover:text-white transition-colors duration-300">
                  Archive
                </Link>
                <Link to="/vision" className="hover:text-white transition-colors duration-300">
                  Our Vision
                </Link>
                <Link
                  to="/founders-note"
                  className="hover:text-white transition-colors duration-300"
                >
                  Founder&rsquo;s Note
                </Link>
              </div>
            </div>
            <div className="flex flex-col space-y-3 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-serif font-semibold text-luxury-gold uppercase tracking-wider">
                Support
              </h3>
              <div className="flex flex-col space-y-2 sm:space-y-3 font-light text-gray-400 text-xs sm:text-sm">
                <Link to="/contact" className="hover:text-white transition-colors duration-300">
                  Contact Us
                </Link>
                <Link to="/faq" className="hover:text-white transition-colors duration-300">
                  FAQ
                </Link>
                <Link to="/returns" className="hover:text-white transition-colors duration-300">
                  Returns & Refunds
                </Link>
                <Link
                  to="/seller-agreement"
                  className="hover:text-white transition-colors duration-300"
                >
                  Seller Agreement
                </Link>
              </div>
            </div>
            <div className="flex flex-col space-y-3 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-serif font-semibold text-luxury-gold uppercase tracking-wider">
                Legal
              </h3>
              <div className="flex flex-col space-y-2 sm:space-y-3 font-light text-gray-400 text-xs sm:text-sm">
                <Link to="/terms" className="hover:text-white transition-colors duration-300">
                  Terms &amp; Conditions
                </Link>
                <Link to="/privacy" className="hover:text-white transition-colors duration-300">
                  Privacy Policy
                </Link>
                <Link to="/account" className="hover:text-white transition-colors duration-300">
                  My Account
                </Link>
                {/* Withdrawal path for the analytics/advertising consent gate —
                    reopens ConsentBanner so a visitor can change their mind. */}
                <button
                  type="button"
                  onClick={openConsentPreferences}
                  className="text-left hover:text-white transition-colors duration-300"
                >
                  Cookie Preferences
                </button>
              </div>
              <div className="flex gap-3 sm:gap-4 pt-1 sm:pt-2">
                <a
                  href="https://www.instagram.com/the_collectors_exchange/?utm_source=ig_web_button_share_sheet"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="text-white hover:text-luxury-gold transition-colors duration-300"
                >
                  <Instagram size={20} strokeWidth={1.5} />
                </a>
                <a
                  href="https://www.facebook.com/share/18mue4rLC4/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="text-white hover:text-luxury-gold transition-colors duration-300"
                >
                  <Facebook size={20} strokeWidth={1.5} />
                </a>
                <a
                  href="https://x.com/TCE_store"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className="text-white hover:text-luxury-gold transition-colors duration-300"
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
                  className="text-white hover:text-luxury-gold transition-colors duration-300"
                >
                  <Linkedin size={20} strokeWidth={1.5} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-900 mt-8 sm:mt-12 md:mt-16 pt-6 sm:pt-8 text-center">
          <p className="text-gray-600 text-xs sm:text-sm font-light tracking-wide">
            &copy; {new Date().getFullYear()} The Collectors&rsquo; Exchange. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

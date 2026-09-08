import { Link } from 'react-router-dom';
import { Instagram, Facebook, Linkedin, Mail } from 'lucide-react';
import SEO from '../components/SEO';
import { Stagger } from '../components/Motion';

const Links = () => {
  return (
    <div className="min-h-screen bg-white px-4 sm:px-6 py-8 pb-24">
      <SEO
        title="Links"
        description="Quick access to all pages on The Collectors Exchange."
        noindex
      />
      <Stagger className="max-w-md mx-auto space-y-8" step={110}>
        {/* The page previously started at h3, so it had no h1 at all and its
            outline began two levels down. */}
        <header className="text-center">
          <h1 className="font-serif text-2xl sm:text-3xl text-heritage-charcoal">
            The Collectors Exchange
          </h1>
          <p className="mt-2 text-sm text-gray-500">Quick access to every page.</p>
        </header>
        <div className="flex flex-col space-y-4">
          <h2 className="text-sm font-serif font-semibold text-luxury-gold uppercase tracking-wider">
            Company
          </h2>
          <div className="flex flex-col space-y-3 font-light text-gray-500 text-sm">
            <Link to="/about" className="hover:text-luxury-gold transition-colors">
              About Us
            </Link>
            <Link to="/archive" className="hover:text-luxury-gold transition-colors">
              Archive
            </Link>
            <Link to="/vision" className="hover:text-luxury-gold transition-colors">
              Our Vision
            </Link>
            <Link to="/founders-note" className="hover:text-luxury-gold transition-colors">
              Founder's Note
            </Link>
          </div>
        </div>
        <div className="w-12 h-px bg-luxury-gold/50 mx-auto" />
        <div className="flex flex-col space-y-4">
          <h2 className="text-sm font-serif font-semibold text-luxury-gold uppercase tracking-wider">
            Support
          </h2>
          <div className="flex flex-col space-y-3 font-light text-gray-500 text-sm">
            <Link to="/contact" className="hover:text-luxury-gold transition-colors">
              Contact Us
            </Link>
            <Link to="/faq" className="hover:text-luxury-gold transition-colors">
              FAQ
            </Link>
            <Link to="/returns" className="hover:text-luxury-gold transition-colors">
              Returns & Refunds
            </Link>
            <Link to="/seller-agreement" className="hover:text-luxury-gold transition-colors">
              Seller Agreement
            </Link>
          </div>
        </div>
        <div className="w-12 h-px bg-luxury-gold/50 mx-auto" />
        <div className="flex flex-col space-y-4">
          <h2 className="text-sm font-serif font-semibold text-luxury-gold uppercase tracking-wider">
            Legal
          </h2>
          <div className="flex flex-col space-y-3 font-light text-gray-500 text-sm">
            <Link to="/terms" className="hover:text-luxury-gold transition-colors">
              Terms & Conditions
            </Link>
            <Link to="/privacy" className="hover:text-luxury-gold transition-colors">
              Privacy Policy
            </Link>
            <Link to="/account" className="hover:text-luxury-gold transition-colors">
              My Account
            </Link>
          </div>
        </div>
        <div className="w-12 h-px bg-luxury-gold/50 mx-auto" />
        <div className="flex flex-col space-y-4">
          <h2 className="text-sm font-serif font-semibold text-luxury-gold uppercase tracking-wider">
            Connect
          </h2>
          <div className="flex gap-4">
            <a
              href="https://www.instagram.com/the_collectors_exchange/?utm_source=ig_web_button_share_sheet"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="text-gray-500 hover:text-luxury-gold transition-colors"
            >
              <Instagram size={22} strokeWidth={1.5} />
            </a>
            <a
              href="https://www.facebook.com/share/18mue4rLC4/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Facebook"
              className="text-gray-500 hover:text-luxury-gold transition-colors"
            >
              <Facebook size={22} strokeWidth={1.5} />
            </a>
            <a
              href="https://x.com/TCE_store"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="X (Twitter)"
              className="text-gray-500 hover:text-luxury-gold transition-colors"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" stroke="none">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com/company/thecollectorsexchange"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              className="text-gray-500 hover:text-luxury-gold transition-colors"
            >
              <Linkedin size={22} strokeWidth={1.5} />
            </a>
            <a
              href="mailto:support@thecollectorsexchange.in"
              aria-label="Email"
              className="text-gray-500 hover:text-luxury-gold transition-colors"
            >
              <Mail size={22} strokeWidth={1.5} />
            </a>
          </div>
        </div>
      </Stagger>
    </div>
  );
};

export default Links;

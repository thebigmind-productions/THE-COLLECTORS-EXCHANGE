import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

const KeyholeIllustration = () => (
  <svg
    viewBox="0 0 200 200"
    fill="none"
    aria-hidden="true"
    className="w-36 h-36 sm:w-44 sm:h-44 mb-6 sm:mb-8"
  >
    <circle
      cx="100"
      cy="100"
      r="92"
      stroke="#C9A962"
      strokeOpacity="0.4"
      strokeWidth="1"
      strokeDasharray="2 7"
    />
    <circle cx="100" cy="100" r="66" fill="#F5F0E8" />
    <path
      d="M76 134 V98 a24 24 0 0 1 48 0 v36 Z"
      fill="#FFFFFF"
      stroke="#1C1C1C"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
    <line
      x1="100"
      y1="76"
      x2="100"
      y2="134"
      stroke="#1C1C1C"
      strokeOpacity="0.12"
      strokeWidth="1"
    />
    <circle cx="100" cy="104" r="5.5" stroke="#C9A962" strokeWidth="1.6" />
    <path
      d="M98.2 108.5 L96.8 120 h6.4 L101.8 108.5"
      stroke="#C9A962"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <g transform="translate(140 140) rotate(38)">
      <circle cx="0" cy="0" r="7" fill="#FAF8F5" stroke="#D4AF37" strokeWidth="1.6" />
      <circle cx="0" cy="0" r="2.5" stroke="#D4AF37" strokeWidth="1.2" />
      <line x1="7" y1="0" x2="30" y2="0" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" />
      <line
        x1="24"
        y1="0"
        x2="24"
        y2="5"
        stroke="#D4AF37"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <line
        x1="29"
        y1="0"
        x2="29"
        y2="5"
        stroke="#D4AF37"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </g>
    <path
      d="M50 62 h9 M54.5 57.5 v9"
      stroke="#8B7355"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.45"
    />
    <path
      d="M146 48 h7 M149.5 44.5 v7"
      stroke="#8B7355"
      strokeWidth="1"
      strokeLinecap="round"
      opacity="0.3"
    />
  </svg>
);

const SignInPrompt = ({
  title = 'Please Sign In',
  description,
  cta = 'Sign In',
  illustration = <KeyholeIllustration />,
}) => (
  <div className="flex flex-col items-center justify-center text-center py-14 sm:py-20 px-6">
    {illustration}
    <p className="text-[10px] uppercase tracking-[0.3em] text-heritage-gold-muted font-sans mb-3">
      Members Only
    </p>
    <h1 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-normal tracking-wide text-heritage-charcoal mb-3">
      {title}
    </h1>
    {description && (
      <p className="text-sm sm:text-base text-heritage-charcoal/70 leading-relaxed max-w-sm mb-8">
        {description}
      </p>
    )}
    <Link
      to="/account"
      className="bg-black text-white px-8 py-3 uppercase tracking-widest text-xs hover:bg-luxury-gold transition-all duration-300 flex items-center gap-2"
    >
      {cta}
      <ArrowRight size={14} />
    </Link>
    <p className="mt-5 text-[10px] uppercase tracking-[0.2em] text-heritage-bronze/40 flex items-center gap-1.5">
      <ShieldCheck size={12} />
      Secure portal · Takes seconds
    </p>
  </div>
);

export default SignInPrompt;

import React from 'react';
import { TrendingUp, BarChart3, Zap } from 'lucide-react';

const TIERS = [
  {
    threshold: 10,
    label: 'Standard',
    desc: 'Basic visibility',
    color: 'text-gray-500',
    bar: 'bg-gray-300',
  },
  {
    threshold: 15,
    label: 'Boosted',
    desc: 'Higher search ranking',
    color: 'text-blue-600',
    bar: 'bg-blue-500',
  },
  {
    threshold: 20,
    label: 'Promoted',
    desc: 'Featured placement + badge',
    color: 'text-luxury-gold',
    bar: 'bg-luxury-gold',
  },
  {
    threshold: 25,
    label: 'Premium',
    desc: 'Top visibility + Premium badge',
    color: 'text-purple-700',
    bar: 'bg-purple-600',
  },
];

const CommissionSlider = ({ value, price, onChange, disabled }) => {
  const priceNum = parseFloat(price) || 0;
  const platformFee = (priceNum * value) / 100;
  // Must mirror `payoutFromItems` in backend/lib/money.js: payout = price - platformFee.
  // No GST is deducted from the seller's payout anywhere in the backend, so none is
  // shown here — this figure has to equal what the payout actually creates.
  //
  // OPEN QUESTION - 18% GST on commission (parked 2026-09-04, owner undecided).
  // This used to read `price - platformFee - (platformFee * 0.18)`, and SUMMARY.md
  // records that as deliberate: "Vendor's 'Your Earnings' must reflect true take-home
  // after both commission and GST deduction". But the backend half was never built —
  // checkout stores only `platformFee`, and payouts pay `price - platformFee`. So the
  // slider was under-quoting every seller (₹8,230 shown vs ₹8,500 paid on ₹10,000 at
  // 15%) and the platform could not reconcile the two numbers.
  //
  // The display was corrected to match reality so nothing misleads a seller today.
  // That is NOT a ruling on the tax question. If GST on commission is genuinely owed
  // and meant to come out of the seller's side, the fix belongs in the BACKEND
  // (checkout fee computation + payoutFromItems), not here — and it would mean past
  // payouts were over-generous by 18% of commission. Settle with an accountant before
  // changing either side. See MEMORY.md, Session 9.
  const yourEarnings = priceNum - platformFee;

  const activeTier = TIERS.reduce(
    (prev, curr) => (value >= curr.threshold ? curr : prev),
    TIERS[0],
  );
  const nextTier = TIERS.find((t) => t.threshold > value);

  return (
    <div className="bg-gradient-to-br from-gray-50 to-white p-6 sm:p-8 border border-gray-100 rounded-2xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <label
            htmlFor="commission-percent"
            className="block text-xs font-bold uppercase tracking-widest text-gray-600"
          >
            Marketplace Partner Contribution <span className="text-luxury-gold">*</span>
          </label>
          <p id="commission-percent-help" className="text-xs text-gray-500 mt-1">
            Choose your partner contribution rate. Higher contribution = greater visibility and
            sales potential.
          </p>
        </div>
        <div className={`text-right ${activeTier.color}`}>
          <span className="text-3xl font-serif font-bold">{value}%</span>
          <p className="text-[10px] uppercase tracking-widest font-semibold">{activeTier.label}</p>
        </div>
      </div>

      {/* Tier selector */}
      <div className="relative mb-6">
        <input
          id="commission-percent"
          name="commissionPercent"
          aria-describedby="commission-percent-help"
          aria-valuetext={`${value} percent`}
          type="range"
          min="10"
          max="25"
          step="1"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          disabled={disabled}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-luxury-gold disabled:opacity-50
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-luxury-gold [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:bg-luxury-gold [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0"
          style={{
            background: `linear-gradient(to right, #D4AF37 0%, #D4AF37 ${((value - 10) / 15) * 100}%, #e5e7eb ${((value - 10) / 15) * 100}%, #e5e7eb 100%)`,
          }}
        />
        <div className="flex justify-between mt-1 px-0.5">
          {TIERS.map((tier) => (
            <button
              key={tier.threshold}
              type="button"
              onClick={() => onChange(tier.threshold)}
              disabled={disabled}
              className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-1 py-0.5 rounded-full transition-colors ${
                value >= tier.threshold
                  ? `${tier.color} bg-white shadow-sm`
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tier.label}
            </button>
          ))}
        </div>
      </div>

      {/* Earnings breakdown */}
      {priceNum > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white border border-gray-100 p-3 text-center rounded-xl">
            <p className="text-lg sm:text-xl font-serif font-bold text-green-700">
              ₹
              {yourEarnings.toLocaleString('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest">
              You receive on payout
            </p>
          </div>
          <div className="bg-white border border-gray-100 p-3 text-center rounded-xl">
            <p className="text-lg sm:text-xl font-serif font-bold text-amber-700">
              ₹
              {platformFee.toLocaleString('en-IN', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </p>
            <p className="text-[9px] sm:text-[10px] text-gray-500 uppercase tracking-widest">
              Platform Contribution
            </p>
          </div>
        </div>
      )}
      {/* Boost meter */}
      <div className="bg-white border border-gray-100 p-3 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {value >= 20 ? (
              <Zap size={14} className="text-luxury-gold" />
            ) : value >= 15 ? (
              <TrendingUp size={14} className="text-blue-500" />
            ) : (
              <BarChart3 size={14} className="text-gray-400" aria-hidden="true" />
            )}
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-600">
              Visibility Boost
            </span>
          </div>
          {nextTier ? (
            <span className="text-[9px] text-gray-500">
              Next tier at {nextTier.threshold}%, {nextTier.desc}
            </span>
          ) : (
            <span className="text-[9px] text-luxury-gold font-semibold uppercase">
              Maximum Boost
            </span>
          )}
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${activeTier.bar}`}
            style={{ width: `${((value - 10) / 15) * 100}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[8px] text-gray-500">
          <span>Standard</span>
          <span>Premium</span>
        </div>
      </div>

      {value >= 20 && (
        <div className="mt-4 bg-gradient-to-r from-luxury-gold/10 to-purple-50 border border-luxury-gold/20 p-3 rounded-xl flex items-start gap-2">
          <Zap size={14} className="text-luxury-gold mt-0.5 shrink-0" />
          <p className="text-[11px] text-gray-600">
            {value >= 20
              ? 'Your item will be featured with a Promoted badge and prioritized in search results, giving maximum exposure to serious collectors.'
              : 'Your item will receive boosted visibility in search results.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default CommissionSlider;

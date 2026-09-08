import React, { useState } from 'react';
import apiClient from '../../hooks/api/apiClient';
import { useToast } from '../Toast';
import WhatsAppIcon from '../WhatsAppIcon';

const WhatsAppNumber = '+916362771355';

const PhoneVerification = ({ onVerified }) => {
  const showToast = useToast();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!phone || phone.length < 10) {
      showToast('Please enter a valid phone number', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiClient.post('/users/phone/submit', { phone });
      setSubmitted(true);
      if (onVerified) onVerified(phone);
    } catch (err) {
      showToast(err.response?.data?.error || err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bg-amber-50 border border-amber-200 p-4">
        <p className="text-sm text-amber-800 font-medium mb-1">Phone Submitted for Verification</p>
        <p className="text-xs text-amber-700">
          Our team will verify your number shortly. This usually takes a few hours.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-100 p-4 space-y-3">
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
          Your Phone Number
        </label>
        <input
          type="tel"
          placeholder="Enter your phone number"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full p-3 border border-gray-200 focus:outline-none focus:border-luxury-gold text-sm"
        />
      </div>
      <div className="bg-blue-50 border border-blue-100 p-3">
        <p className="text-xs text-blue-700 font-medium mb-1">Step 1: Send us a WhatsApp message</p>
        <p className="text-xs text-blue-600 mb-2">
          Send a message to <strong>{WhatsAppNumber}</strong> on WhatsApp with your name and the
          phone number above so we can verify you.
        </p>
        <a
          href={`https://wa.me/${WhatsAppNumber.replace(/\D/g, '')}?text=Hi%2C%20I%20want%20to%20verify%20my%20phone%20number%3A%20${encodeURIComponent(phone)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 px-3 py-1.5 rounded border border-green-200 hover:bg-green-100 transition-colors"
        >
          <WhatsAppIcon size={14} />
          Open WhatsApp
        </a>
      </div>
      <p className="text-[11px] text-gray-400">
        Step 2: After sending the message, click submit below.
      </p>
      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full py-3 bg-heritage-charcoal text-white text-xs uppercase tracking-widest hover:bg-luxury-gold transition-colors"
      >
        {loading ? 'Submitting...' : "I've Sent the Message, Submit for Verification"}
      </button>
    </div>
  );
};

export default PhoneVerification;

import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../utils/supabase';
import { useToast } from '../Toast';

const LoginForm = () => {
  const navigate = useNavigate();
  const showToast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState('email');
  const [mode, setMode] = useState('otp');
  const [loading, setLoading] = useState(false);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      showToast('Login Code sent to your email!', 'success');
      setStep('otp');
    } catch (error) {
      showToast(error.message || 'Failed to send OTP', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast('Welcome back!', 'success');
      navigate('/');
    } catch (error) {
      showToast(error.message || 'Login failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
      if (error) throw error;
      showToast('Welcome back!', 'success');
      navigate('/');
    } catch (error) {
      showToast(error.message || 'Invalid Code', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'otp') {
    return (
      <form onSubmit={handleVerifyOtp} className="space-y-4">
        <div className="text-center mb-4">
          <p className="text-sm text-gray-600">
            Enter the code sent to <span className="font-semibold">{email}</span>
          </p>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="text-xs text-luxury-gold hover:underline mt-1"
          >
            Change Email
          </button>
        </div>
        <div>
          <label
            htmlFor="login-otp"
            className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
          >
            6-Digit Code
          </label>
          {/* `one-time-code` is what lets Android and iOS offer the code
                        straight from the SMS/mail notification, and inputMode
                        numeric gets the number pad instead of full QWERTY. */}
          <input
            id="login-otp"
            name="otp"
            type="text"
            required
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors text-center text-lg tracking-widest"
            placeholder="123456"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-black text-white py-4 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors duration-300 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : 'Verify & Sign In'}
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode('otp')}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-medium transition-colors ${mode === 'otp' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          Email OTP
        </button>
        <button
          type="button"
          onClick={() => setMode('password')}
          className={`flex-1 py-2 text-xs uppercase tracking-widest font-medium transition-colors ${mode === 'password' ? 'bg-black text-white' : 'bg-gray-100 text-gray-500'}`}
        >
          Password
        </button>
      </div>
      {mode === 'otp' ? (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label
              htmlFor="login-otp-email"
              className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
            >
              Email Address
            </label>
            <input
              id="login-otp-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
              className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="vip@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors duration-300 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            Send Login Code
          </button>
        </form>
      ) : (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label
              htmlFor="login-password-email"
              className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
            >
              Email Address
            </label>
            <input
              id="login-password-email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              inputMode="email"
              autoCapitalize="none"
              spellCheck="false"
              className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="vip@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="login-password"
              className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-2"
            >
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full p-4 bg-gray-50 border border-gray-200 focus:outline-none focus:border-luxury-gold transition-colors"
              placeholder="Your password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 text-sm uppercase tracking-widest hover:bg-luxury-gold transition-colors duration-300 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign In'}
          </button>
          <div className="text-center">
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  showToast('Please enter your email first', 'error');
                  return;
                }
                setLoading(true);
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email);
                  if (error) throw error;
                  showToast('Password reset link sent to your email!', 'success');
                } catch (error) {
                  showToast(error.message || 'Failed to send reset email', 'error');
                } finally {
                  setLoading(false);
                }
              }}
              className="text-xs text-gray-500 hover:text-luxury-gold hover:underline mt-2"
            >
              Forgot Password?
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default LoginForm;

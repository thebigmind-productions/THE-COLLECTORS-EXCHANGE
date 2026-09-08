import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import LoginForm from '../LoginForm';

const mockSignInWithOtp = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockVerifyOtp = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockShowToast = vi.fn();

vi.mock('../../../utils/supabase', () => ({
  supabase: {
    auth: {
      signInWithOtp: (...args) => mockSignInWithOtp(...args),
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      verifyOtp: (...args) => mockVerifyOtp(...args),
      resetPasswordForEmail: (...args) => mockResetPasswordForEmail(...args),
    },
  },
}));

vi.mock('../../Toast', () => ({
  useToast: () => mockShowToast,
}));

const renderLoginForm = () =>
  render(
    <BrowserRouter>
      <LoginForm />
    </BrowserRouter>,
  );

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input with placeholder vip@example.com', () => {
    renderLoginForm();
    expect(screen.getByPlaceholderText('vip@example.com')).toBeInTheDocument();
  });

  it('renders mode toggle buttons', () => {
    renderLoginForm();
    expect(screen.getByText('Email OTP')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
  });

  it('renders Send Login Code button in OTP mode', () => {
    renderLoginForm();
    expect(screen.getByText('Send Login Code')).toBeInTheDocument();
  });

  it('switches to password mode', () => {
    renderLoginForm();
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByText('Sign In')).toBeInTheDocument();
  });

  it('shows password input in password mode', () => {
    renderLoginForm();
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();
  });

  it('handles email input change', () => {
    renderLoginForm();
    const input = screen.getByPlaceholderText('vip@example.com');
    fireEvent.change(input, { target: { value: 'test@test.com' } });
    expect(input.value).toBe('test@test.com');
  });

  it('submits OTP request', () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });
    renderLoginForm();
    fireEvent.change(screen.getByPlaceholderText('vip@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.click(screen.getByText('Send Login Code'));
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'test@test.com' });
  });

  it('submits password login', () => {
    mockSignInWithPassword.mockResolvedValue({ data: {}, error: null });
    renderLoginForm();
    fireEvent.click(screen.getByText('Password'));
    fireEvent.change(screen.getByPlaceholderText('vip@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Your password'), {
      target: { value: 'pass123' },
    });
    fireEvent.click(screen.getByText('Sign In'));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'test@test.com',
      password: 'pass123',
    });
  });

  it('shows forgot password button', () => {
    renderLoginForm();
    fireEvent.click(screen.getByText('Password'));
    expect(screen.getByText('Forgot Password?')).toBeInTheDocument();
  });

  it('shows OTP input after sending OTP', async () => {
    mockSignInWithOtp.mockResolvedValue({ data: {}, error: null });
    renderLoginForm();
    fireEvent.change(screen.getByPlaceholderText('vip@example.com'), {
      target: { value: 'test@test.com' },
    });
    fireEvent.click(screen.getByText('Send Login Code'));
    expect(await screen.findByPlaceholderText('123456')).toBeInTheDocument();
  });
});

/**
 * None of these four inputs were labelled, autofillable or keyboard-appropriate:
 * a saved email was never offered, a password manager had nothing to fill, and
 * the six-digit login code opened the full QWERTY keyboard.
 */
describe('LoginForm — labels, autofill and keyboards', () => {
  const goToPasswordMode = () => fireEvent.click(screen.getByText('Password'));

  const goToOtpStep = async () => {
    mockSignInWithOtp.mockResolvedValue({ error: null });
    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: 'collector@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send login code/i }));
    return screen.findByLabelText(/6-digit code/i);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labels the OTP-mode email field and offers a saved email', () => {
    renderLoginForm();
    const email = screen.getByLabelText(/email address/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');
    expect(email).toHaveAttribute('inputmode', 'email');
  });

  it('labels the password-mode email and password fields', () => {
    renderLoginForm();
    goToPasswordMode();
    expect(screen.getByLabelText(/email address/i)).toHaveAttribute('autocomplete', 'email');
    // Without this a password manager has nothing to fill.
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });

  it('labels the login code and takes it from the SMS/mail notification', async () => {
    renderLoginForm();
    const otp = await goToOtpStep();
    expect(otp).toHaveAttribute('autocomplete', 'one-time-code');
    expect(otp).toHaveAttribute('inputmode', 'numeric');
    expect(otp).toHaveAttribute('maxlength', '6');
  });

  it('keeps the login code to six digits and drops anything else', async () => {
    renderLoginForm();
    const otp = await goToOtpStep();
    fireEvent.change(otp, { target: { value: '1a2b3c4d5e6f7' } });
    expect(otp).toHaveValue('123456');
  });
});

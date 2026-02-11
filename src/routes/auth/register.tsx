/**
 * Registration Page
 *
 * Glassmorphism-styled registration form with validation and password strength.
 * Route: /auth/register
 */
import { useMemo, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { registerFn } from '@server/api/auth';

export const Route = createFileRoute('/auth/register')({
  component: RegisterPage,
});

/** Simple password strength calculator */
function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: 'Weak', color: '#ef4444' };
  if (score <= 2) return { score, label: 'Fair', color: '#f59e0b' };
  if (score <= 3) return { score, label: 'Good', color: '#22c55e' };
  return { score, label: 'Strong', color: '#06b6d4' };
}

function RegisterPage() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, Array<string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = useMemo(
    () => (password.length > 0 ? getPasswordStrength(password) : null),
    [password],
  );

  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: ['Passwords do not match'] });
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await registerFn({
        data: { email, password, displayName },
      });

      if (result.success) {
        navigate({ to: '/' });
      } else if (result.error) {
        setError(result.error.message);
        if (result.error.fieldErrors) {
          setFieldErrors(result.error.fieldErrors);
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
      </div>

      <div className="auth-container">
        {/* Branding */}
        <div className="auth-brand">
          <div className="auth-logo">
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect
                width="40"
                height="40"
                rx="12"
                fill="url(#logo-gradient)"
              />
              <path
                d="M12 14h6v12h-6V14zm10 0h6v12h-6V14z"
                fill="white"
                opacity="0.9"
              />
              <defs>
                <linearGradient
                  id="logo-gradient"
                  x1="0"
                  y1="0"
                  x2="40"
                  y2="40"
                >
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <h1 className="auth-title">Create your account</h1>
          <p className="auth-subtitle">
            Get started with Dashy in seconds
          </p>
        </div>

        {/* Glass Card */}
        <div className="auth-card">
          <form onSubmit={handleSubmit} className="auth-form" id="register-form">
            {/* Error Banner */}
            {error && (
              <div className="auth-error" role="alert">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                  className="auth-error-icon"
                >
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                {error}
              </div>
            )}

            {/* Display Name */}
            <div className="auth-field">
              <label htmlFor="register-name" className="auth-label">
                Display name
              </label>
              <input
                id="register-name"
                type="text"
                autoComplete="name"
                autoFocus
                required
                placeholder="John Doe"
                className={`auth-input ${fieldErrors.displayName ? 'auth-input-error' : ''}`}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
                maxLength={50}
              />
              {fieldErrors.displayName?.map((msg, i) => (
                <p key={i} className="auth-field-error">{msg}</p>
              ))}
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="register-email" className="auth-label">
                Email address
              </label>
              <input
                id="register-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                className={`auth-input ${fieldErrors.email ? 'auth-input-error' : ''}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
              />
              {fieldErrors.email?.map((msg, i) => (
                <p key={i} className="auth-field-error">{msg}</p>
              ))}
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="register-password" className="auth-label">
                Password
              </label>
              <div className="auth-input-wrapper">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  placeholder="••••••••"
                  className={`auth-input ${fieldErrors.password ? 'auth-input-error' : ''}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isSubmitting}
                  minLength={8}
                  maxLength={128}
                />
                <button
                  type="button"
                  className="auth-toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Password strength */}
              {strength && (
                <div className="auth-strength">
                  <div className="auth-strength-bar">
                    <div
                      className="auth-strength-fill"
                      style={{
                        width: `${(strength.score / 5) * 100}%`,
                        backgroundColor: strength.color,
                      }}
                    />
                  </div>
                  <span
                    className="auth-strength-label"
                    style={{ color: strength.color }}
                  >
                    {strength.label}
                  </span>
                </div>
              )}
              {fieldErrors.password?.map((msg, i) => (
                <p key={i} className="auth-field-error">{msg}</p>
              ))}
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label htmlFor="register-confirm" className="auth-label">
                Confirm password
              </label>
              <input
                id="register-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                placeholder="••••••••"
                className={`auth-input ${!passwordsMatch ? 'auth-input-error' : ''}`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isSubmitting}
              />
              {!passwordsMatch && (
                <p className="auth-field-error">Passwords do not match</p>
              )}
              {fieldErrors.confirmPassword?.map((msg, i) => (
                <p key={i} className="auth-field-error">{msg}</p>
              ))}
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="auth-submit"
              disabled={isSubmitting || !passwordsMatch}
              id="register-submit"
            >
              {isSubmitting ? (
                <>
                  <span className="auth-spinner" />
                  Creating account…
                </>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="auth-footer">
            <p>
              Already have an account?{' '}
              <Link to="/auth/login" className="auth-link">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

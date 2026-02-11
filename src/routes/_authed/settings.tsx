/**
 * Account Settings Page
 *
 * Allows authenticated users to update their profile and change password.
 * Route: /_authed/settings (rendered at /settings for users)
 */
import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { updateAccountFn, logoutFn } from '@server/api/auth';
import type { SafeUser } from '@server/services/auth';

export const Route = createFileRoute('/_authed/settings' as string)({
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = Route.useRouteContext() as { user: SafeUser };

  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleProfileUpdate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const data: Record<string, string> = {};

      if (displayName !== user.displayName) data.displayName = displayName;
      if (email !== user.email) data.email = email;

      if (Object.keys(data).length === 0) {
        setError('No changes to save');
        setIsSubmitting(false);
        return;
      }

      const result = await updateAccountFn({ data });

      if (result.success) {
        setSuccess('Profile updated successfully');
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await updateAccountFn({
        data: { currentPassword, newPassword },
      });

      if (result.success) {
        setSuccess('Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logoutFn();
    } catch {
      // logoutFn throws redirect — expected
    }
  }

  return (
    <div className="settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">
            Manage your profile, email, and password
          </p>
        </div>

        {/* Feedback */}
        {success && (
          <div className="settings-success" role="status">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 8l2 2 3.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {success}
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="auth-error-icon">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
          </div>
        )}

        {/* Profile Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">Profile</h2>
          <form onSubmit={handleProfileUpdate} className="settings-form" id="profile-form">
            <div className="auth-field">
              <label htmlFor="settings-name" className="auth-label">
                Display name
              </label>
              <input
                id="settings-name"
                type="text"
                className="auth-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isSubmitting}
                maxLength={50}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="settings-email" className="auth-label">
                Email address
              </label>
              <input
                id="settings-email"
                type="email"
                className="auth-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <button
              type="submit"
              className="settings-btn settings-btn-primary"
              disabled={isSubmitting}
              id="save-profile"
            >
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </div>

        {/* Password Section */}
        <div className="settings-section">
          <h2 className="settings-section-title">Change Password</h2>
          <form onSubmit={handlePasswordChange} className="settings-form" id="password-form">
            <div className="auth-field">
              <label htmlFor="settings-current-pw" className="auth-label">
                Current password
              </label>
              <input
                id="settings-current-pw"
                type="password"
                className="auth-input"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="settings-new-pw" className="auth-label">
                New password
              </label>
              <input
                id="settings-new-pw"
                type="password"
                className="auth-input"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={isSubmitting}
                required
                minLength={8}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="settings-confirm-pw" className="auth-label">
                Confirm new password
              </label>
              <input
                id="settings-confirm-pw"
                type="password"
                className="auth-input"
                autoComplete="new-password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>
            <button
              type="submit"
              className="settings-btn settings-btn-primary"
              disabled={isSubmitting}
              id="change-password"
            >
              {isSubmitting ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className="settings-section settings-section-danger">
          <h2 className="settings-section-title">Session</h2>
          <p className="settings-section-desc">
            Sign out of your account on this device.
          </p>
          <button
            className="settings-btn settings-btn-danger"
            onClick={handleLogout}
            disabled={isLoggingOut}
            id="logout-btn"
          >
            {isLoggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </div>
  );
}

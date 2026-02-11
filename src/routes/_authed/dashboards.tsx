/**
 * Dashboard List Page
 *
 * Displays all dashboards owned by the authenticated user.
 * Supports search/filter, create new, and navigation to individual dashboards.
 * Route: /_authed/dashboards (rendered at /dashboards)
 */
import { useCallback, useEffect, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import {
  createDashboardFn,
  deleteDashboardFn,
  duplicateDashboardFn,
  listDashboardsFn,
} from '@server/api/dashboards';
import type { DashboardSummary } from '@server/api/dashboards';

export const Route = createFileRoute('/_authed/dashboards')({
  component: DashboardsPage,
});

function DashboardsPage() {
  const navigate = useNavigate();

  const [dashboards, setDashboards] = useState<Array<DashboardSummary>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [totalCount, setTotalCount] = useState(0);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboards = useCallback(async (searchQuery = '') => {
    setIsLoading(true);
    try {
      const result = await listDashboardsFn({
        data: {
          page: 1,
          limit: 50,
          search: searchQuery || undefined,
          sortBy: 'updatedAt',
          sortDir: 'desc',
        },
      });
      if (result.success && result.data) {
        setDashboards(result.data.items);
        setTotalCount(result.data.total);
      }
    } catch {
      setError('Failed to fetch dashboards');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDashboards(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchDashboards]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      const result = await createDashboardFn({
        data: {
          name: newName.trim(),
          description: newDescription.trim() || undefined,
        },
      });

      if (result.success && result.data) {
        setShowCreateDialog(false);
        setNewName('');
        setNewDescription('');
        // Navigate to the new dashboard (will be /dashboards/$slug when route exists)
        void navigate({ to: '/dashboards' as string });
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('Failed to create dashboard');
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This action can be undone.`)) return;

    try {
      const result = await deleteDashboardFn({ data: { id, permanent: false } });
      if (result.success) {
        await fetchDashboards(search);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('Failed to delete dashboard');
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const result = await duplicateDashboardFn({ data: { id } });
      if (result.success) {
        await fetchDashboards(search);
      } else if (result.error) {
        setError(result.error.message);
      }
    } catch {
      setError('Failed to duplicate dashboard');
    }
  }

  return (
    <div className="dash-list-page">
      {/* Background orbs */}
      <div className="auth-bg">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
      </div>

      <div className="dash-list-container">
        {/* Header */}
        <div className="dash-list-header">
          <div className="dash-list-header-text">
            <h1 className="dash-list-title">Dashboards</h1>
            <p className="dash-list-subtitle">
              {totalCount} dashboard{totalCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="dash-list-header-actions">
            <Link to="/settings" className="dash-header-link" id="settings-link">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
            </Link>
            <button
              className="dash-create-btn"
              onClick={() => setShowCreateDialog(true)}
              id="create-dashboard-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              New Dashboard
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="dash-list-search">
          <svg className="dash-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="dash-search-input"
            placeholder="Search dashboards…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            id="search-dashboards"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="auth-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="auth-error-icon">
              <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3.5M8 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {error}
            <button
              className="dash-error-dismiss"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* Dashboard Grid */}
        {isLoading ? (
          <div className="dash-list-loading">
            <span className="auth-spinner" />
            <p>Loading dashboards…</p>
          </div>
        ) : dashboards.length === 0 ? (
          <div className="dash-list-empty">
            <div className="dash-empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </div>
            <h2 className="dash-empty-title">
              {search ? 'No dashboards found' : 'No dashboards yet'}
            </h2>
            <p className="dash-empty-desc">
              {search
                ? 'Try a different search term'
                : 'Create your first dashboard to get started'}
            </p>
            {!search && (
              <button
                className="dash-create-btn"
                onClick={() => setShowCreateDialog(true)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Create Dashboard
              </button>
            )}
          </div>
        ) : (
          <div className="dash-grid">
            {dashboards.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onDelete={() => handleDelete(d.id, d.name)}
                onDuplicate={() => handleDuplicate(d.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="dash-dialog-overlay" onClick={() => setShowCreateDialog(false)}>
          <div className="dash-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dash-dialog-title">Create Dashboard</h2>
            <form onSubmit={handleCreate} className="dash-dialog-form" id="create-dashboard-form">
              <div className="auth-field">
                <label htmlFor="dash-name" className="auth-label">
                  Name
                </label>
                <input
                  id="dash-name"
                  type="text"
                  className="auth-input"
                  placeholder="My Dashboard"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                  required
                  maxLength={100}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="dash-desc" className="auth-label">
                  Description <span className="dash-optional">(optional)</span>
                </label>
                <textarea
                  id="dash-desc"
                  className="auth-input dash-textarea"
                  placeholder="A brief description of your dashboard"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  disabled={isCreating}
                  maxLength={500}
                  rows={3}
                />
              </div>
              <div className="dash-dialog-actions">
                <button
                  type="button"
                  className="dash-dialog-cancel"
                  onClick={() => setShowCreateDialog(false)}
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="dash-create-btn"
                  disabled={isCreating || !newName.trim()}
                  id="submit-create-dashboard"
                >
                  {isCreating ? (
                    <>
                      <span className="auth-spinner" />
                      Creating…
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Card Component ──────────────────────

function DashboardCard({
  dashboard,
  onDelete,
  onDuplicate,
}: {
  dashboard: DashboardSummary;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);

  const timeAgo = getTimeAgo(dashboard.updatedAt);

  return (
    <div className="dash-card" id={`dashboard-${dashboard.id}`}>
      <Link
        to={'/dashboards' as string}
        className="dash-card-main"
      >
        {/* Icon */}
        <div className="dash-card-icon">
          {dashboard.icon ? (
            <span className="dash-card-emoji">{dashboard.icon}</span>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="dash-card-content">
          <h3 className="dash-card-name">{dashboard.name}</h3>
          {dashboard.description && (
            <p className="dash-card-desc">{dashboard.description}</p>
          )}
          <div className="dash-card-meta">
            <span className="dash-card-stat">
              {dashboard.pageCount} page{dashboard.pageCount !== 1 ? 's' : ''}
            </span>
            <span className="dash-card-dot">·</span>
            <span className="dash-card-stat">
              {dashboard.widgetCount} widget{dashboard.widgetCount !== 1 ? 's' : ''}
            </span>
            <span className="dash-card-dot">·</span>
            <span className="dash-card-time">{timeAgo}</span>
          </div>
        </div>

        {/* Badges */}
        <div className="dash-card-badges">
          {dashboard.isDefault && (
            <span className="dash-badge dash-badge-default">Default</span>
          )}
          {dashboard.isPublic && (
            <span className="dash-badge dash-badge-public">Public</span>
          )}
        </div>
      </Link>

      {/* Actions Menu */}
      <div className="dash-card-actions">
        <button
          className="dash-card-menu-btn"
          onClick={() => setShowMenu(!showMenu)}
          aria-label="Dashboard actions"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div
              className="dash-menu-backdrop"
              onClick={() => setShowMenu(false)}
            />
            <div className="dash-card-menu">
              <button
                className="dash-menu-item"
                onClick={() => {
                  onDuplicate();
                  setShowMenu(false);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                </svg>
                Duplicate
              </button>
              <button
                className="dash-menu-item dash-menu-item-danger"
                onClick={() => {
                  onDelete();
                  setShowMenu(false);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────

function getTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
}

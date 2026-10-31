import { useEffect, useState, type JSX } from 'react'
import type { User } from 'firebase/auth'
import {
  signInWithGoogle,
  signOutUser,
} from './firebase'

interface AuthDialogProps {
  user: User | null
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error' | 'offline'
  lastSyncTime: Date | null
  onSyncToCloud: () => Promise<void>
  onRestoreFromCloud: () => Promise<void>
}

function getReadableErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = String((err as { code: unknown }).code)
    switch (code) {
      case 'auth/popup-closed-by-user':
        return 'Google sign-in popup was closed before completing.'
      case 'auth/unauthorized-domain':
        return 'This domain is not authorized in Firebase. Please add it to Firebase Console -> Authentication -> Settings -> Authorized domains.'
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.'
      case 'auth/operation-not-allowed':
        return 'Google sign-in is not enabled in Firebase Console. Please enable Google provider under Authentication -> Sign-in method.'
      default:
        break
    }
  }
  if (err instanceof Error) {
    return err.message
  }
  return 'An unexpected error occurred. Please try again.'
}

export default function AuthDialog({
  user,
  syncStatus,
  lastSyncTime,
  onSyncToCloud,
  onRestoreFromCloud,
}: AuthDialogProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const handleGoogleSignIn = async (): Promise<void> => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      await signInWithGoogle()
      setMessage('Signed in with Google!')
    } catch (err) {
      setError(getReadableErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async (): Promise<void> => {
    setError('')
    setMessage('')
    setLoading(true)
    try {
      await signOutUser()
      setMessage('Signed out successfully.')
    } catch (err) {
      setError(getReadableErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  const getSyncBadge = (): { text: string; icon: string } => {
    if (syncStatus === 'syncing') return { text: 'Syncing to cloud...', icon: '🔄' }
    if (syncStatus === 'error') return { text: 'Sync error', icon: '⚠️' }
    if (user) return { text: 'Cloud connected', icon: '☁️' }
    return { text: 'Cloud Login & Sync', icon: '☁️' }
  }

  const badge = getSyncBadge()

  return (
    <>
      <button
        type="button"
        className={`tab-button auth-toggle ${user ? 'is-logged-in' : ''}`}
        onClick={() => {
          setOpen(true)
          setError('')
          setMessage('')
        }}
        aria-label="Cloud account & sync"
        title={user ? `Signed in as ${user.displayName || user.email || 'User'} (${badge.text})` : 'Cloud Account & Login'}
      >
        <span aria-hidden="true">{badge.icon}</span>
        {user && <span className="auth-status-dot" aria-hidden="true" />}
      </button>

      {open && (
        <div
          className="backup-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false)
          }}
        >
          <section className="backup-dialog auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
            <header className="backup-heading">
              <h2 id="auth-title">Cloud Sync & Account</h2>
              <button
                type="button"
                className="backup-close"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </header>

            {message && <div className="auth-alert success" role="status">{message}</div>}
            {error && <div className="auth-alert error" role="alert">{error}</div>}

            {user ? (
              /* When Logged In */
              <div className="auth-logged-in-view">
                <div className="auth-user-card">
                  <div className="auth-user-avatar">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="auth-avatar-img" />
                    ) : (
                      <span>{(user.displayName?.[0] ?? user.email?.[0] ?? 'U').toUpperCase()}</span>
                    )}
                  </div>
                  <div className="auth-user-info">
                    <p className="auth-user-email">
                      <strong>{user.displayName || user.email || 'Google User'}</strong>
                    </p>
                    {user.displayName && user.email && (
                      <span className="auth-hint">{user.email}</span>
                    )}
                    <p className="auth-user-sync-status">
                      {syncStatus === 'syncing' ? 'Syncing...' : 'All changes saved to cloud'}
                      {lastSyncTime && (
                        <span className="auth-last-sync">
                          {' '}• {lastSyncTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="auth-actions-group">
                  <button
                    type="button"
                    className="tab-button auth-action-btn"
                    onClick={onSyncToCloud}
                    disabled={loading || syncStatus === 'syncing'}
                  >
                    ☁️ Upload Local Data to Cloud
                  </button>
                  <button
                    type="button"
                    className="tab-button auth-action-btn"
                    onClick={onRestoreFromCloud}
                    disabled={loading || syncStatus === 'syncing'}
                  >
                    ⬇️ Download / Merge from Cloud
                  </button>
                </div>

                <div className="auth-footer-actions">
                  <button
                    type="button"
                    className="tab-button auth-danger-btn"
                    onClick={handleSignOut}
                    disabled={loading}
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            ) : (
              /* When Logged Out */
              <div className="auth-google-only">
                <p className="auth-desc">
                  Sign in with your Google account to back up your habits and automatically sync across your phone and computer.
                </p>

                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="auth-google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                  </svg>
                  <span>{loading ? 'Connecting...' : 'Continue with Google'}</span>
                </button>

                <p className="auth-hint" style={{ marginTop: '16px', textAlign: 'center' }}>
                  Your habit data is stored securely in your private cloud account.
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  )
}

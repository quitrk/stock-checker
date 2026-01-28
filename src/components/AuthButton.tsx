import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthButton.css';

export function AuthButton() {
  const { user, isLoading, isAuthenticated, login, logout, deleteAccount } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading) {
    return <div className="auth-button-skeleton" />;
  }

  if (isAuthenticated && user) {
    return (
      <div className="auth-wrapper" ref={dropdownRef}>
        <button
          className="auth-button authenticated"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {user.avatar ? (
            <img src={user.avatar} alt="" className="user-avatar" />
          ) : (
            <span className="user-initial">{user.name[0]}</span>
          )}
        </button>

        {showDropdown && (
          <div className="auth-dropdown">
            <div className="auth-dropdown-header">
              <span className="user-name">{user.name}</span>
              <span className="user-email">{user.email}</span>
            </div>
            <div className="auth-dropdown-divider" />
            <a
              href="/privacy"
              className="auth-dropdown-item"
              onClick={() => setShowDropdown(false)}
            >
              Privacy Policy
            </a>
            <a
              href="/terms"
              className="auth-dropdown-item"
              onClick={() => setShowDropdown(false)}
            >
              Terms of Service
            </a>
            <div className="auth-dropdown-divider" />
            <button
              className="auth-dropdown-item"
              onClick={() => { logout(); setShowDropdown(false); }}
            >
              Sign out
            </button>
            <button
              className="auth-dropdown-item auth-dropdown-item-danger"
              onClick={() => { setShowDeleteConfirm(true); setShowDropdown(false); }}
            >
              Delete Account
            </button>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="auth-modal-overlay" onClick={() => !isDeleting && setShowDeleteConfirm(false)}>
            <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
              <h3 className="auth-modal-title">Delete Account</h3>
              <p className="auth-modal-message">
                This action cannot be undone. Your account, watchlists, and all data will be permanently deleted.
              </p>
              <div className="auth-modal-actions">
                <button
                  className="auth-modal-button auth-modal-button-cancel"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="auth-modal-button auth-modal-button-danger"
                  onClick={async () => {
                    setIsDeleting(true);
                    try {
                      await deleteAccount();
                      setShowDeleteConfirm(false);
                    } catch {
                      alert('Failed to delete account. Please try again.');
                    } finally {
                      setIsDeleting(false);
                    }
                  }}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Account'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button className="auth-button" onClick={() => login('google')}>
      Sign in
    </button>
  );
}


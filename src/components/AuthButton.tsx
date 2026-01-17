import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './AuthButton.css';

export function AuthButton() {
  const { user, isLoading, isAuthenticated, login, logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
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
            <button
              className="auth-dropdown-item"
              onClick={() => { logout(); setShowDropdown(false); }}
            >
              Sign out
            </button>
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


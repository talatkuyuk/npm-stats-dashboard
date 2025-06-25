import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LogIn,
  LogOut,
  User,
  Crown,
  Loader2,
  AlertCircle,
  WifiOff,
} from "lucide-react";

export function AuthStatus() {
  const {
    user,
    loading,
    subscription,
    signInWithGitHub,
    signOut,
    isAuth0Configured,
    connectionError,
  } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setError(null);
      setIsSigningIn(true);
      await signInWithGitHub();
    } catch (error) {
      console.error("Sign in failed:", error);
      setError(error instanceof Error ? error.message : "Sign in failed");
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setError(null);
      setIsSigningOut(true);
      await signOut();
    } catch (error) {
      console.error("Sign out failed:", error);
      setError(error instanceof Error ? error.message : "Sign out failed");
    } finally {
      setIsSigningOut(false);
    }
  };

  if (loading) {
    return (
      <div className="auth-status loading">
        <Loader2 size={16} className="animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // Show connection status if there's an issue (but still allow mock auth)
  if (connectionError && connectionError.includes("mock")) {
    return (
      <div className="auth-status unauthenticated">
        <div className="auth-config-warning">
          <AlertCircle size={16} />
          <span>Mock Auth</span>
        </div>
        {!user && (
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="auth-button sign-in"
          >
            {isSigningIn ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            <span>Mock Sign In</span>
          </button>
        )}
      </div>
    );
  }

  if (user) {
    const avatarUrl = user.picture;
    const userName = user.nickname || user.name || "User";
    const isPaid = subscription?.isPaid || false;

    return (
      <div className="auth-status authenticated">
        <div className="user-info">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="user-avatar" />
          ) : (
            <div className="user-avatar-placeholder">
              <User size={16} />
            </div>
          )}
          <div className="user-details">
            <span className="user-name">{userName}</span>
            <div className="user-plan">
              {isPaid ? (
                <div className="plan-badge pro">
                  <Crown size={12} />
                  <span>Pro</span>
                </div>
              ) : (
                <div className="plan-badge free">
                  <span>Free</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="auth-button sign-out"
          title="Sign out"
        >
          {isSigningOut ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <LogOut size={16} />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-status unauthenticated">
      {error && (
        <div className="auth-error">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className="auth-button sign-in"
      >
        {isSigningIn ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <LogIn size={16} />
        )}
        <span>Mock Sign In</span>
      </button>
    </div>
  );
}

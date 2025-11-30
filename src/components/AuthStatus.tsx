import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  LogIn,
  LogOut,
  User,
  Crown,
  Loader2,
  AlertCircle,
  Globe,
} from "lucide-react";
import styles from "./AuthStatus.module.css";

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

  // Get plan info for display
  const getPlanInfo = () => {
    if (!user) {
      return {
        type: "guest",
        name: "Guest",
        limit: "20 packages",
        icon: Globe,
        className: "guest",
      };
    }

    const isPaid = subscription?.isPaid || false;

    if (isPaid) {
      return {
        type: "pro",
        name: "Pro",
        limit: "Unlimited",
        icon: Crown,
        className: "pro",
      };
    }

    return {
      type: "free",
      name: "Free",
      limit: "100 packages",
      icon: User,
      className: "free",
    };
  };

  const planInfo = getPlanInfo();
  const PlanIcon = planInfo.icon;

  if (loading) {
    return (
      <div className={`${styles.authStatus} ${styles.loading}`}>
        <Loader2 size={16} className="animate-spin" />
        <span>Loading...</span>
      </div>
    );
  }

  // Show connection status if there's an issue (but still allow mock auth)
  if (connectionError && connectionError.includes("mock")) {
    return (
      <div className={styles.authStatus}>
        <div className={styles.authConfigWarning}>
          <AlertCircle size={16} />
          <span>Mock Auth</span>
        </div>
        {!user && (
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className={`${styles.authButton} ${styles.signIn}`}
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
      <div className={`${styles.authStatus} ${styles.authenticated}`}>
        <div className={styles.userInfo}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className={styles.userAvatar} />
          ) : (
            <div className={styles.userAvatarPlaceholder}>
              <User size={16} />
            </div>
          )}
          <div className={styles.userDetails}>
            <span className={styles.userName}>{userName}</span>
            <div className={styles.userPlan}>
              <div
                className={`${styles.planBadge} ${styles[planInfo.className]}`}
              >
                <PlanIcon size={12} />
                <span>{planInfo.name}</span>
                <span className={styles.planLimit}>({planInfo.limit})</span>
              </div>
            </div>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className={`${styles.authButton} ${styles.signOut}`}
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

  // Show plan info for guests too
  return (
    <div className={styles.authStatus}>
      {error && (
        <div className={styles.authError}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {/* Show guest plan info */}
      <div className={styles.guestPlanInfo}>
        <div className={`${styles.planBadge} ${styles[planInfo.className]}`}>
          <PlanIcon size={12} />
          <span>{planInfo.name}</span>
          <span className={styles.planLimit}>({planInfo.limit})</span>
        </div>
      </div>

      <button
        onClick={handleSignIn}
        disabled={isSigningIn}
        className={`${styles.authButton} ${styles.signIn}`}
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

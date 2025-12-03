import React, { useState } from "react";
import { TrendingUp, Crown, Users, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { PricingPage } from "./PricingPage";
import styles from "./FeaturePromotion.module.css";

export function FeaturePromotion() {
  const { user } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if user is logged in or if dismissed
  if (isDismissed || user) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    // No localStorage - dismissal only lasts for current session
  };

  return (
    <>
      <div className={styles.featurePromotion}>
        <button
          className={styles.dismissButton}
          onClick={handleDismiss}
          title="Dismiss"
        >
          <X size={16} />
        </button>

        <div className={styles.promotionContent}>
          <div className={styles.promotionText}>
            <h3>
              <TrendingUp size={20} className={styles.titleIcon} />
              Unlock Advanced Features
            </h3>
            <p>
              Sign in with GitHub to track package statistics over time and see
              changes with visual diffs!
            </p>
          </div>

          <div className={styles.promotionFeatures}>
            <div className={styles.featureItem}>
              <TrendingUp size={16} />
              <span>Diff tracking against last checked</span>
            </div>
            <div className={styles.featureItem}>
              <Users size={16} />
              <span>Up to 100 packages (Free)</span>
            </div>
            <div className={styles.featureItem}>
              <Crown size={16} />
              <span>Unlimited packages (Pro)</span>
            </div>
          </div>

          <div className={styles.promotionActions}>
            <button
              className={`${styles.promotionButton} ${styles.primary}`}
              onClick={() => setShowPricing(true)}
            >
              View Plans
            </button>
          </div>
        </div>
      </div>

      {showPricing && <PricingPage onClose={() => setShowPricing(false)} />}
    </>
  );
}

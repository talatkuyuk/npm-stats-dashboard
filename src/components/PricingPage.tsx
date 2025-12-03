import React from "react";
import { Check, X, Crown, Package, Zap, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import styles from "./PricingPage.module.css";

interface PricingPageProps {
  onClose: () => void;
}

export function PricingPage({ onClose }: PricingPageProps) {
  const { user, subscription } = useAuth();
  const isPaid = subscription?.isPaid || false;

  const handleUpgrade = () => {
    // TODO: Implement Stripe integration
    alert("Payment integration coming soon!");
  };

  return (
    <div className={styles.pricingOverlay}>
      <div className={styles.pricingModal}>
        <div className={styles.pricingHeader}>
          <h2>Choose Your Plan</h2>
          <button onClick={onClose} className={styles.closeButton}>
            <X size={20} />
          </button>
        </div>

        <div className={styles.pricingPlans}>
          {/* Free Plan */}
          <div className={`${styles.pricingPlan} ${styles.free}`}>
            <div className={styles.planHeader}>
              <Package size={32} className={styles.planIcon} />
              <h3>Free</h3>
              <div className={styles.planPrice}>
                <span className={styles.price}>$0</span>
                <span className={styles.period}>/month</span>
              </div>
            </div>

            <div className={styles.planFeatures}>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>GitHub authentication required</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Up to 100 packages per search</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Historical data & diff tracking</span>
              </div>
              <div className={styles.feature}>
                <X
                  size={16}
                  className={`${styles.featureIcon} ${styles.excluded}`}
                />
                <span>Ads displayed</span>
              </div>
              <div className={styles.feature}>
                <X
                  size={16}
                  className={`${styles.featureIcon} ${styles.excluded}`}
                />
                <span>Limited package count</span>
              </div>
            </div>

            <button
              className={`${styles.planButton} ${styles.freeButton}`}
              disabled={user !== null}
            >
              {user ? "Current Plan" : "Sign Up Free"}
            </button>
          </div>

          {/* Pro Plan */}
          <div
            className={`${styles.pricingPlan} ${styles.pro} ${
              isPaid ? styles.current : ""
            }`}
          >
            <div className={styles.planBadge}>
              <Crown size={16} />
              <span>Most Popular</span>
            </div>

            <div className={styles.planHeader}>
              <Zap size={32} className={styles.planIcon} />
              <h3>Pro</h3>
              <div className={styles.planPrice}>
                <span className={styles.price}>$3</span>
                <span className={styles.period}>/month</span>
              </div>
            </div>

            <div className={styles.planFeatures}>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Everything in Free</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Unlimited packages per search</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Ad-free experience</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Priority support</span>
              </div>
              <div className={styles.feature}>
                <Check
                  size={16}
                  className={`${styles.featureIcon} ${styles.included}`}
                />
                <span>Advanced export features</span>
              </div>
            </div>

            <button
              className={`${styles.planButton} ${styles.proButton}`}
              onClick={handleUpgrade}
              disabled={isPaid}
            >
              {isPaid ? "Current Plan" : "Upgrade to Pro"}
            </button>
          </div>
        </div>

        <div className={styles.pricingFooter}>
          <div className={styles.securityNote}>
            <Shield size={16} />
            <span>Secure payments powered by Stripe. Cancel anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

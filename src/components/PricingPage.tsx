import React from "react";
import { Check, X, Crown, Package, Zap, Shield } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

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
    <div className="pricing-overlay">
      <div className="pricing-modal">
        <div className="pricing-header">
          <h2>Choose Your Plan</h2>
          <button onClick={onClose} className="close-button">
            <X size={20} />
          </button>
        </div>

        <div className="pricing-plans">
          {/* Free Plan */}
          <div className="pricing-plan free">
            <div className="plan-header">
              <Package size={32} className="plan-icon" />
              <h3>Free</h3>
              <div className="plan-price">
                <span className="price">$0</span>
                <span className="period">/month</span>
              </div>
            </div>

            <div className="plan-features">
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>GitHub authentication required</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Up to 100 packages per search</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Historical data & diff tracking</span>
              </div>
              <div className="feature">
                <X size={16} className="feature-icon excluded" />
                <span>Ads displayed</span>
              </div>
              <div className="feature">
                <X size={16} className="feature-icon excluded" />
                <span>Limited package count</span>
              </div>
            </div>

            <button
              className="plan-button free-button"
              disabled={user !== null}
            >
              {user ? "Current Plan" : "Sign Up Free"}
            </button>
          </div>

          {/* Pro Plan */}
          <div className={`pricing-plan pro ${isPaid ? "current" : ""}`}>
            <div className="plan-badge">
              <Crown size={16} />
              <span>Most Popular</span>
            </div>

            <div className="plan-header">
              <Zap size={32} className="plan-icon" />
              <h3>Pro</h3>
              <div className="plan-price">
                <span className="price">$3</span>
                <span className="period">/month</span>
              </div>
            </div>

            <div className="plan-features">
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Everything in Free</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Unlimited packages per search</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Ad-free experience</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Priority support</span>
              </div>
              <div className="feature">
                <Check size={16} className="feature-icon included" />
                <span>Advanced export features</span>
              </div>
            </div>

            <button
              className="plan-button pro-button"
              onClick={handleUpgrade}
              disabled={isPaid}
            >
              {isPaid ? "Current Plan" : "Upgrade to Pro"}
            </button>
          </div>
        </div>

        <div className="pricing-footer">
          <div className="security-note">
            <Shield size={16} />
            <span>Secure payments powered by Stripe. Cancel anytime.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

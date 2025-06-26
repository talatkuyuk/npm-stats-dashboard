import React, { useState } from "react";
import { TrendingUp, Crown, Users, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { PricingPage } from "./PricingPage";

export function FeaturePromotion() {
  const { user } = useAuth();
  const [showPricing, setShowPricing] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed || user) {
    return null;
  }

  return (
    <>
      <div className="feature-promotion">
        <button
          className="dismiss-button"
          onClick={() => setIsDismissed(true)}
          title="Dismiss"
        >
          <X size={16} />
        </button>

        <div className="promotion-content">
          <div className="promotion-icon">
            <TrendingUp size={24} />
          </div>

          <div className="promotion-text">
            <h3>Unlock Advanced Features</h3>
            <p>
              Sign in with GitHub to track package statistics over time and see
              changes with visual diffs!
            </p>
          </div>

          <div className="promotion-features">
            <div className="feature-item">
              <TrendingUp size={16} />
              <span>Historical data & diff tracking</span>
            </div>
            <div className="feature-item">
              <Users size={16} />
              <span>Up to 100 packages (Free)</span>
            </div>
            <div className="feature-item">
              <Crown size={16} />
              <span>Unlimited packages (Pro)</span>
            </div>
          </div>

          <div className="promotion-actions">
            <button
              className="promotion-button primary"
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

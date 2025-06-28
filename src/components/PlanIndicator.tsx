import React from "react";
import { Crown, User, Globe } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function PlanIndicator() {
  const { user, subscription } = useAuth();

  // Determine plan type and limits
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
  const Icon = planInfo.icon;

  return (
    <div className="plan-indicator">
      <div className={`plan-badge-display ${planInfo.className}`}>
        <Icon size={12} />
        <span className="plan-name">{planInfo.name}</span>
        <span className="plan-limit">({planInfo.limit})</span>
      </div>
    </div>
  );
}

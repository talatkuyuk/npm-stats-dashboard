import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface DiffDisplayProps {
  current: number;
  previous?: number;
  type?: "number" | "percentage";
  showIcon?: boolean;
}

export function DiffDisplay({
  current,
  previous,
  type = "number",
  showIcon = true,
}: DiffDisplayProps) {
  if (previous === undefined || previous === null) {
    return null;
  }

  const diff = current - previous;
  const isPositive = diff > 0;
  const isNegative = diff < 0;
  const isNeutral = diff === 0;

  // Don't show anything if diff is 0
  if (isNeutral) {
    return null;
  }

  const displayValue =
    type === "percentage"
      ? `${diff > 0 ? "+" : ""}${((diff / previous) * 100).toFixed(1)}%`
      : `${diff > 0 ? "+" : ""}${diff.toLocaleString()}`;

  return (
    <span className={`diff-display ${isPositive ? "positive" : "negative"}`}>
      {showIcon &&
        (isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
      <span>({displayValue})</span>
    </span>
  );
}

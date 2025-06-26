import React from "react";

interface ShimmerCellProps {
  width?: string;
  height?: string;
}

export const ShimmerCell: React.FC<ShimmerCellProps> = ({
  width = "60px",
  height = "20px",
}) => {
  return <div className="shimmer-cell" style={{ width, height }} />;
};

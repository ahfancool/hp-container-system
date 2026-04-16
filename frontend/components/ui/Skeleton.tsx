import React from "react";

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = "",
  width,
  height,
  borderRadius,
  style
}) => {
  return (
    <div
      className={`skeleton ${className}`}
      style={{
        width: width ?? "100%",
        height: height ?? "1rem",
        borderRadius: borderRadius ?? "8px",
        ...style
      }}
    />
  );
};

export const TableSkeleton: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 4 }) => (
  <div className="flex flex-col gap-4 w-full">
    <div className="flex gap-4 mb-4">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height="2rem" />
      ))}
    </div>
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex gap-4 border-b border-line pb-4">
        {Array.from({ length: cols }).map((_, j) => (
          <Skeleton key={j} height="1.5rem" />
        ))}
      </div>
    ))}
  </div>
);

export const DashboardListSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => (
  <div className="flex flex-col gap-4">
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="card flex flex-col gap-4">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2 w-2/3">
            <Skeleton width="40%" height="0.875rem" />
            <Skeleton width="80%" height="1.25rem" />
          </div>
          <Skeleton width="80px" height="2rem" borderRadius="999px" />
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton width="90%" height="0.75rem" />
          <Skeleton width="70%" height="0.75rem" />
        </div>
      </div>
    ))}
  </div>
);

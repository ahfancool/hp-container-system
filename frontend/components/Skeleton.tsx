import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  width,
  height,
  borderRadius,
  className = "",
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

export const CardSkeleton: React.FC = () => (
  <div className="content-panel fade-in">
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <Skeleton height="1.5rem" width="40%" />
      <Skeleton height="2rem" width="70%" />
      <Skeleton height="4rem" />
      <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
        <Skeleton height="2.5rem" width="100px" borderRadius="999px" />
        <Skeleton height="2.5rem" width="100px" borderRadius="999px" />
      </div>
    </div>
  </div>
);

export const ListSkeleton: React.FC<{ items?: number }> = ({ items = 3 }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    {Array.from({ length: items }).map((_, i) => (
      <div key={i} className="content-panel fade-in" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "15px" }}>
          <div style={{ width: "60%" }}>
            <Skeleton height="1.2rem" width="30%" style={{ marginBottom: "8px" }} />
            <Skeleton height="1.8rem" width="80%" />
          </div>
          <Skeleton height="2rem" width="100px" borderRadius="999px" />
        </div>
        <Skeleton height="1rem" width="90%" style={{ marginBottom: "8px" }} />
        <Skeleton height="1rem" width="70%" />
      </div>
    ))}
  </div>
);

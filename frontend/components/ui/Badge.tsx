import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "danger";
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "primary",
  className = "",
}) => {
  const variants = {
    primary: "badge-primary",
    secondary: "badge-secondary",
    outline: "badge-outline",
    danger: "status-danger", // existing class for danger badges
  };

  return (
    <span className={`badge ${variants[variant]} ${className}`.trim()}>
      {children}
    </span>
  );
};

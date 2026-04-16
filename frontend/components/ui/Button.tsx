import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  className?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  isLoading = false,
  className = "",
  children,
  disabled,
  ...props
}) => {
  const variantMap = {
    primary: "primary-button",
    secondary: "secondary-button",
    destructive: "destructive-button",
    ghost: "ghost-button",
  };
  
  const sizeMap = {
    sm: "compact-button",
    md: "",
    lg: "scan-action-button",
  };

  const combinedClasses = [
    variantMap[variant],
    sizeMap[size],
    "flex items-center gap-2",
    className
  ].filter(Boolean).join(" ");

  return (
    <button 
      className={combinedClasses} 
      disabled={isLoading || disabled} 
      aria-busy={isLoading}
      {...props}
    >
      {isLoading && (
        <svg className="spinner w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
          <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" />
        </svg>
      )}
      {children}
    </button>
  );
};

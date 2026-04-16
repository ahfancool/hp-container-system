import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  variant?: "default" | "strong" | "danger";
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = "", 
  variant = "default",
  ...props
}) => {
  const variantClass = variant === "strong" ? "signal-panel" : 
                       variant === "danger" ? "dashboard-alert-panel" : 
                       "card";
  
  return (
    <div className={`${variantClass} ${className}`.trim()} {...props}>
      {children}
    </div>
  );
};

export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = "" 
}) => (
  <div className={`panel-header ${className}`.trim()}>
    {children}
  </div>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = "" 
}) => (
  <div className={`${className}`.trim()}>
    {children}
  </div>
);

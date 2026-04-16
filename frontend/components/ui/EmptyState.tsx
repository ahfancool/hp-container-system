import React from "react";
import { Card } from "./Card";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
  className = ""
}) => {
  return (
    <Card className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
      {icon && (
        <div className="w-16 h-16 bg-surface-strong rounded-full flex items-center justify-center mb-6 text-muted">
          {icon}
        </div>
      )}
      <h3 className="text-xl font-bold text-ink mb-2">{title}</h3>
      <p className="text-muted max-w-sm mb-8">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="secondary">
          {action.label}
        </Button>
      )}
    </Card>
  );
};

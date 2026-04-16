import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  label?: string;
  error?: string;
  containerClassName?: string;
}

export const Input: React.FC<InputProps> = ({ 
  className = "", 
  label, 
  error, 
  containerClassName = "",
  id,
  ...props 
}) => {
  const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, "-")}` : undefined);
  const errorId = error ? `${inputId}-error` : undefined;
  
  return (
    <div className={`field-group ${containerClassName}`.trim()}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <input
        id={inputId}
        className={`text-input ${error ? "border-danger" : ""} ${className}`.trim()}
        aria-invalid={!!error}
        aria-describedby={errorId}
        {...props}
      />
      {error && <span id={errorId} className="text-xs text-danger mt-1" role="alert">{error}</span>}
    </div>
  );
};

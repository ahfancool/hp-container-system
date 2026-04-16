import { useState, useCallback, useRef, useEffect } from 'react';

export interface ValidationRules {
  required?: boolean;
  email?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  numeric?: boolean;
  custom?: (value: any) => string | null;
}

export type FormSchema<T> = {
  [K in keyof T]: ValidationRules;
};

export type FormErrors<T> = {
  [K in keyof T]?: string;
};

export type FormTouched<T> = {
  [K in keyof T]?: boolean;
};

export function useForm<T extends Record<string, any>>(
  initialValues: T,
  schema: FormSchema<T>,
  onSubmit: (values: T) => void | Promise<void>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors<T>>({});
  const [touched, setTouched] = useState<FormTouched<T>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const validateField = useCallback(
    (name: keyof T, value: any) => {
      const rules = schema[name];
      if (!rules) return null;

      if (rules.required && (value === undefined || value === null || value === '')) {
        return 'Field ini wajib diisi';
      }

      if (value) {
        if (rules.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return 'Email tidak valid';
        }

        if (rules.numeric && isNaN(Number(value))) {
          return 'Harus berupa angka';
        }

        if (rules.min !== undefined && value.length < rules.min) {
          return `Minimal ${rules.min} karakter`;
        }

        if (rules.max !== undefined && value.length > rules.max) {
          return `Maksimal ${rules.max} karakter`;
        }

        if (rules.pattern && !rules.pattern.test(value)) {
          return 'Format tidak valid';
        }

        if (rules.custom) {
          return rules.custom(value);
        }
      }

      return null;
    },
    [schema]
  );

  const handleChange = (name: keyof T, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    setIsDirty(true);
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: error || undefined }));
    }
  };

  const handleBlur = (name: keyof T) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const error = validateField(name, values[name]);
    setErrors((prev) => ({ ...prev, [name]: error || undefined }));
  };

  const validateForm = () => {
    const newErrors: FormErrors<T> = {};
    let isValid = true;

    (Object.keys(schema) as Array<keyof T>).forEach((name) => {
      const error = validateField(name, values[name]);
      if (error) {
        newErrors[name] = error;
        isValid = false;
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const isValid = validateForm();
    if (!isValid) {
      // Scroll to first error
      const firstErrorKey = Object.keys(schema).find((key) => {
        const error = validateField(key as keyof T, values[key as keyof T]);
        return !!error;
      });

      if (firstErrorKey) {
        const element = document.getElementById(`input-${String(firstErrorKey).toLowerCase().replace(/\s+/g, "-")}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(values);
      setIsDirty(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsDirty(false);
  };

  const isValid = Object.keys(schema).every((key) => !validateField(key as keyof T, values[key as keyof T]));

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isDirty,
    isValid,
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    setValues,
  };
}

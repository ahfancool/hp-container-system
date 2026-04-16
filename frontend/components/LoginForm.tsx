import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/Button";
import { Input } from "./ui/Input";
import { useRouter } from "next/router";
import { useForm } from "../hooks/useForm";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";

import { translateError } from "../lib/errors";

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Email atau password salah. Silakan coba lagi.",
  "Email not confirmed": "Email belum dikonfirmasi. Silakan cek inbox Anda.",
  "User not found": "Akun tidak ditemukan. Pastikan email Anda benar.",
  "Inactive account": "Akun Anda dinonaktifkan. Hubungi admin sekolah.",
};

function mapAuthError(message: string | null): string | null {
  if (!message) return null;
  return translateError(message);
}

export function LoginForm() {
  const { error, signInWithPassword } = useAuth();
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const router = useRouter();

  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    handleChange,
    handleBlur,
    handleSubmit,
  } = useForm(
    { email: "", password: "" },
    {
      email: { required: true, email: true },
      password: { required: true, min: 6 },
    },
    async (formValues) => {
      setSubmitMessage(null);
      const success = await signInWithPassword(formValues.email, formValues.password);
      if (success) {
        setSubmitMessage("Login berhasil. Sedang mengalihkan...");
      }
    }
  );

  useUnsavedChanges(isDirty);

  const displayError = mapAuthError(error);

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <Input
        label="Email"
        type="email"
        placeholder="nama@sekolah.sch.id"
        value={values.email}
        onChange={(e) => handleChange("email", e.target.value)}
        onBlur={() => handleBlur("email")}
        error={touched.email ? errors.email : undefined}
        autoComplete="email"
        required
      />

      <Input
        label="Password"
        type="password"
        placeholder="Masukkan password"
        value={values.password}
        onChange={(e) => handleChange("password", e.target.value)}
        onBlur={() => handleBlur("password")}
        error={touched.password ? errors.password : undefined}
        autoComplete="current-password"
        required
      />

      <Button 
        className="form-button" 
        isLoading={isSubmitting} 
        type="submit"
        disabled={!isValid || isSubmitting}
        title={!isValid ? "Harap lengkapi form dengan benar" : ""}
      >
        Masuk
      </Button>

      {submitMessage && <p className="form-success">{submitMessage}</p>}
      {displayError && <p className="form-error">{displayError}</p>}
    </form>
  );
}

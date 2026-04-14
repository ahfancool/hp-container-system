import { useState, type FormEvent } from "react";

import { useAuth } from "../context/AuthContext";

export function LoginForm() {
  const { error, isLoading, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitMessage(null);

    const success = await signInWithPassword(email, password);

    if (success) {
      setSubmitMessage("Login berhasil. Profil aplikasi sedang disinkronkan.");
      setPassword("");
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field-group">
        <span>Email</span>
        <input
          autoComplete="email"
          className="text-input"
          onChange={(event) => {
            setEmail(event.target.value);
          }}
          placeholder="nama@sekolah.sch.id"
          required
          type="email"
          value={email}
        />
      </label>

      <label className="field-group">
        <span>Password</span>
        <input
          autoComplete="current-password"
          className="text-input"
          onChange={(event) => {
            setPassword(event.target.value);
          }}
          placeholder="Masukkan password"
          required
          type="password"
          value={password}
        />
      </label>

      <button className="primary-button form-button" disabled={isLoading} type="submit">
        {isLoading ? "Memproses..." : "Masuk"}
      </button>

      {submitMessage ? <p className="form-success">{submitMessage}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

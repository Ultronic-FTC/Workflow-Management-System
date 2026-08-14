"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });

    setMessage(error ? error.message : "Check your email for the sign-in link.");
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <p className="eyebrow">ULTRONIC</p>
        <h1>Sign in</h1>
        <p>Use your team email to receive a secure magic link.</p>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <button className="primary-button" type="submit">
          Email me a sign-in link
        </button>
        {message && <p className="form-message">{message}</p>}
      </form>
    </div>
  );
}

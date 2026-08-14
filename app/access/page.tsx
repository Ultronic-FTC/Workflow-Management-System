"use client";

import { FormEvent, useState } from "react";

export default function AccessPage() {
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setMessage(data.error ?? "That access code was not accepted.");
        setSubmitting(false);
        return;
      }

      window.location.href = "/";
    } catch {
      setMessage("Unable to check the team access code. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="access-wrap">
      <form className="access-card" onSubmit={submit}>
        <div className="access-brand">
          <span className="brand-mark" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <div>
            <strong>ULTRONIC</strong>
            <small>TEAM MANAGER</small>
          </div>
        </div>

        <p className="eyebrow">TEAM ACCESS</p>
        <h1>Enter the team workspace</h1>
        <p>
          Everyone uses the same team access code. Once inside, choose your
          name from the <strong>Working as</strong> menu.
        </p>

        <label>
          Team Access Code
          <input
            autoFocus
            type="password"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Enter team code"
            autoComplete="current-password"
          />
        </label>

        <button className="primary-button" type="submit" disabled={submitting}>
          {submitting ? "Checking…" : "Enter Team Board"}
        </button>

        {message && <p className="access-error">{message}</p>}
        <small className="access-note">
          This is a shared team workspace, not an individual account system.
        </small>
      </form>
    </div>
  );
}

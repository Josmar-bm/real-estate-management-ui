"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type MeResponse = {
  user?: {
    displayName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  message?: string;
};

type ProfileResponse = {
  user?: {
    displayName?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  message?: string;
};

function normalizePhoneInput(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return "";
  }

  let normalized = trimmed.replace(/[^\d+]/g, "");

  if (normalized.startsWith("00")) {
    normalized = `+${normalized.slice(2)}`;
  }

  if (!normalized.startsWith("+")) {
    const digitsOnly = normalized.replace(/\D/g, "");
    if (digitsOnly.length === 10) {
      normalized = `+1${digitsOnly}`;
    } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      normalized = `+${digitsOnly}`;
    }
  }

  return normalized;
}

export default function SettingsPage() {
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<string | null>(null);

  const canSave = useMemo(() => {
    return displayName.trim().length > 1 && !isSaving;
  }, [displayName, isSaving]);

  function handlePhoneBlur() {
    const normalized = normalizePhoneInput(phone);
    if (!normalized) {
      setPhone("");
      setPhoneHint(null);
      return;
    }

    setPhone(normalized);
    setPhoneHint("Stored format: E.164");
  }

  useEffect(() => {
    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setError("You need to login before editing settings.");
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const payload = (await response.json().catch(() => ({}))) as MeResponse;

        if (!response.ok) {
          if (!isCancelled) {
            setError(payload.message ?? "Unable to load profile.");
          }
          return;
        }

        if (!isCancelled) {
          setDisplayName(payload.user?.displayName ?? "");
          setPhone(payload.user?.phone ?? "");
          setEmail(payload.user?.email ?? "");
        }
      } catch {
        if (!isCancelled) {
          setError("Unable to load profile right now.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    loadProfile();

    return () => {
      isCancelled = true;
    };
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setError("Session expired. Please login again.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          displayName,
          phone: normalizePhoneInput(phone),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as ProfileResponse;

      if (!response.ok) {
        setError(payload.message ?? "Unable to save settings.");
        return;
      }

      setDisplayName(payload.user?.displayName ?? displayName);
      setPhone(payload.user?.phone ?? phone);
      setEmail(payload.user?.email ?? email);
      setMessage("Profile updated successfully.");
    } catch {
      setError("Unable to save right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-zinc-600">Loading profile...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Account</p>
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Settings</h2>
        <p className="text-sm text-zinc-600">Update your display name and phone number.</p>
      </div>

      <form className="space-y-5" onSubmit={onSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-700">Email</span>
          <input
            type="email"
            value={email}
            readOnly
            className="w-full rounded-xl border border-zinc-300 bg-zinc-100 px-4 py-3 text-base text-zinc-600"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-700">Display name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            required
            placeholder="Name"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-zinc-700">Phone</span>
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            onBlur={handlePhoneBlur}
            placeholder="+15551234567"
            className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-base outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
          />
          <p className="mt-2 text-xs text-zinc-500">Use international format (E.164), example: +15551234567.</p>
          {phoneHint ? <p className="mt-2 text-xs font-medium text-emerald-700">{phoneHint}</p> : null}
        </label>

        <button
          type="submit"
          disabled={!canSave}
          className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
        >
          {isSaving ? "Saving..." : "Save changes"}
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}

      {message ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}

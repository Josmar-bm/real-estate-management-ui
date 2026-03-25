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

type Personnel = {
  id: string;
  name: string;
  worker_type: string;
  default_rate: number;
};

type Vendor = {
  id: string;
  name: string;
};

type PersonnelResponse = {
  personnel?: Personnel[];
  message?: string;
};

type PersonnelItemResponse = {
  personnel?: Personnel;
  message?: string;
};

type VendorsResponse = {
  vendors?: Vendor[];
  message?: string;
};

type VendorItemResponse = {
  vendor?: Vendor;
  message?: string;
};

const workerTypeOptions = ["employee", "sub-contractor", "other"] as const;

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

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [personnelMessage, setPersonnelMessage] = useState<string | null>(null);
  const [personnelError, setPersonnelError] = useState<string | null>(null);
  const [vendorsMessage, setVendorsMessage] = useState<string | null>(null);
  const [vendorsError, setVendorsError] = useState<string | null>(null);

  const [newPersonnelName, setNewPersonnelName] = useState("");
  const [newPersonnelType, setNewPersonnelType] = useState<(typeof workerTypeOptions)[number]>("employee");
  const [newPersonnelRate, setNewPersonnelRate] = useState("");
  const [isCreatingPersonnel, setIsCreatingPersonnel] = useState(false);

  const [newVendorName, setNewVendorName] = useState("");
  const [isCreatingVendor, setIsCreatingVendor] = useState(false);

  const [savingPersonnelId, setSavingPersonnelId] = useState<string | null>(null);
  const [deletingPersonnelId, setDeletingPersonnelId] = useState<string | null>(null);
  const [savingVendorId, setSavingVendorId] = useState<string | null>(null);
  const [deletingVendorId, setDeletingVendorId] = useState<string | null>(null);

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
        const [profileResponse, personnelResponse, vendorsResponse] = await Promise.all([
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/personnel", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/vendors", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const payload = (await profileResponse.json().catch(() => ({}))) as MeResponse;

        if (!profileResponse.ok) {
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

        const personnelPayload = (await personnelResponse.json().catch(() => ({}))) as PersonnelResponse;
        if (!isCancelled) {
          if (personnelResponse.ok) {
            setPersonnel(personnelPayload.personnel ?? []);
          } else {
            setPersonnelError(personnelPayload.message ?? "Unable to load personnel.");
          }
        }

        const vendorsPayload = (await vendorsResponse.json().catch(() => ({}))) as VendorsResponse;
        if (!isCancelled) {
          if (vendorsResponse.ok) {
            setVendors(vendorsPayload.vendors ?? []);
          } else {
            setVendorsError(vendorsPayload.message ?? "Unable to load vendors.");
          }
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

  async function createPersonnel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPersonnelMessage(null);
    setPersonnelError(null);

    if (!workerTypeOptions.includes(newPersonnelType)) {
      setPersonnelError("Type is required.");
      return;
    }

    if (newPersonnelRate === "" || Number.isNaN(Number(newPersonnelRate))) {
      setPersonnelError("Default rate is required.");
      return;
    }

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setPersonnelError("Session expired. Please login again.");
      return;
    }

    setIsCreatingPersonnel(true);

    try {
      const response = await fetch("/api/personnel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newPersonnelName,
          worker_type: newPersonnelType,
          default_rate: newPersonnelRate,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as PersonnelItemResponse;
      if (!response.ok) {
        setPersonnelError(payload.message ?? "Unable to create personnel.");
        return;
      }

      if (payload.personnel) {
        setPersonnel((current) => [...current, payload.personnel!].sort((a, b) => a.name.localeCompare(b.name)));
      }

      setNewPersonnelName("");
      setNewPersonnelType("employee");
      setNewPersonnelRate("");
      setPersonnelMessage("Personnel added.");
    } catch {
      setPersonnelError("Unable to create personnel right now.");
    } finally {
      setIsCreatingPersonnel(false);
    }
  }

  function updatePersonnelDraft(id: string, patch: Partial<Personnel>) {
    setPersonnel((current) => current.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  async function savePersonnel(person: Personnel) {
    setPersonnelMessage(null);
    setPersonnelError(null);

    if (!workerTypeOptions.includes(person.worker_type as (typeof workerTypeOptions)[number])) {
      setPersonnelError("Type must be employee, sub-contractor, or other.");
      return;
    }

    if (person.default_rate === null || person.default_rate === undefined || Number.isNaN(Number(person.default_rate))) {
      setPersonnelError("Default rate is required.");
      return;
    }

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setPersonnelError("Session expired. Please login again.");
      return;
    }

    setSavingPersonnelId(person.id);

    try {
      const response = await fetch(`/api/personnel/${person.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: person.name,
          worker_type: person.worker_type ?? "",
          default_rate: person.default_rate ?? "",
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as PersonnelItemResponse;
      if (!response.ok) {
        setPersonnelError(payload.message ?? "Unable to update personnel.");
        return;
      }

      if (payload.personnel) {
        setPersonnel((current) =>
          current
            .map((entry) => (entry.id === payload.personnel!.id ? payload.personnel! : entry))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      setPersonnelMessage("Personnel updated.");
    } catch {
      setPersonnelError("Unable to update personnel right now.");
    } finally {
      setSavingPersonnelId(null);
    }
  }

  async function removePersonnel(id: string) {
    setPersonnelMessage(null);
    setPersonnelError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setPersonnelError("Session expired. Please login again.");
      return;
    }

    setDeletingPersonnelId(id);

    try {
      const response = await fetch(`/api/personnel/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setPersonnelError(payload.message ?? "Unable to delete personnel.");
        return;
      }

      setPersonnel((current) => current.filter((person) => person.id !== id));
      setPersonnelMessage("Personnel removed.");
    } catch {
      setPersonnelError("Unable to delete personnel right now.");
    } finally {
      setDeletingPersonnelId(null);
    }
  }

  async function createVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setVendorsMessage(null);
    setVendorsError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setVendorsError("Session expired. Please login again.");
      return;
    }

    setIsCreatingVendor(true);

    try {
      const response = await fetch("/api/vendors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newVendorName }),
      });

      const payload = (await response.json().catch(() => ({}))) as VendorItemResponse;
      if (!response.ok) {
        setVendorsError(payload.message ?? "Unable to create vendor.");
        return;
      }

      if (payload.vendor) {
        setVendors((current) => [...current, payload.vendor!].sort((a, b) => a.name.localeCompare(b.name)));
      }

      setNewVendorName("");
      setVendorsMessage("Vendor added.");
    } catch {
      setVendorsError("Unable to create vendor right now.");
    } finally {
      setIsCreatingVendor(false);
    }
  }

  function updateVendorDraft(id: string, name: string) {
    setVendors((current) => current.map((vendor) => (vendor.id === id ? { ...vendor, name } : vendor)));
  }

  async function saveVendor(vendor: Vendor) {
    setVendorsMessage(null);
    setVendorsError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setVendorsError("Session expired. Please login again.");
      return;
    }

    setSavingVendorId(vendor.id);

    try {
      const response = await fetch(`/api/vendors/${vendor.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: vendor.name }),
      });

      const payload = (await response.json().catch(() => ({}))) as VendorItemResponse;
      if (!response.ok) {
        setVendorsError(payload.message ?? "Unable to update vendor.");
        return;
      }

      if (payload.vendor) {
        setVendors((current) =>
          current
            .map((entry) => (entry.id === payload.vendor!.id ? payload.vendor! : entry))
            .sort((a, b) => a.name.localeCompare(b.name))
        );
      }

      setVendorsMessage("Vendor updated.");
    } catch {
      setVendorsError("Unable to update vendor right now.");
    } finally {
      setSavingVendorId(null);
    }
  }

  async function removeVendor(id: string) {
    setVendorsMessage(null);
    setVendorsError(null);

    const token = window.localStorage.getItem("access_token");
    if (!token) {
      setVendorsError("Session expired. Please login again.");
      return;
    }

    setDeletingVendorId(id);

    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const payload = (await response.json().catch(() => ({}))) as { message?: string };
      if (!response.ok) {
        setVendorsError(payload.message ?? "Unable to delete vendor.");
        return;
      }

      setVendors((current) => current.filter((vendor) => vendor.id !== id));
      setVendorsMessage("Vendor removed.");
    } catch {
      setVendorsError("Unable to delete vendor right now.");
    } finally {
      setDeletingVendorId(null);
    }
  }

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
        <p className="text-sm text-zinc-600">Manage your profile and configure vendors and personnel.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-lg font-semibold text-zinc-900">Profile</h3>
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
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                Display name <span className="text-red-600">*</span>
              </span>
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
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
          ) : null}

          {message ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>
          ) : null}
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="mb-4 space-y-1">
            <h3 className="text-lg font-semibold text-zinc-900">Configure Vendors</h3>
            <p className="text-sm text-zinc-600">Create, edit, and delete vendor records.</p>
            <p className="text-xs font-medium text-zinc-500">Fields marked with <span className="text-red-600">*</span> are required.</p>
          </div>

          <form className="mb-5 flex gap-3" onSubmit={createVendor}>
            <label className="block flex-1">
              <span className="mb-2 block text-sm font-medium text-zinc-700">
                Vendor name <span className="text-red-600">*</span>
              </span>
              <input
                type="text"
                value={newVendorName}
                onChange={(event) => setNewVendorName(event.target.value)}
                required
                placeholder="New vendor name"
                className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
            </label>
            <button
              type="submit"
              disabled={isCreatingVendor}
              className="self-end rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
            >
              {isCreatingVendor ? "Adding..." : "Add"}
            </button>
          </form>

          <div className="space-y-3">
            {vendors.map((vendor) => (
              <div key={vendor.id} className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 sm:flex-row">
                <input
                  type="text"
                  value={vendor.name}
                  onChange={(event) => updateVendorDraft(vendor.id, event.target.value)}
                  required
                  placeholder="Vendor name *"
                  className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveVendor(vendor)}
                    disabled={savingVendorId === vendor.id}
                    className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {savingVendorId === vendor.id ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeVendor(vendor.id)}
                    disabled={deletingVendorId === vendor.id}
                    className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
                  >
                    {deletingVendorId === vendor.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
            {vendors.length === 0 ? <p className="text-sm text-zinc-500">No vendors yet.</p> : null}
          </div>

          {vendorsError ? (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{vendorsError}</p>
          ) : null}

          {vendorsMessage ? (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {vendorsMessage}
            </p>
          ) : null}
        </section>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-4 space-y-1">
          <h3 className="text-lg font-semibold text-zinc-900">Configure Personnel</h3>
          <p className="text-sm text-zinc-600">Create, edit, and delete workers used for labor logs.</p>
          <p className="text-xs font-medium text-zinc-500">Fields marked with <span className="text-red-600">*</span> are required.</p>
        </div>

        <form className="mb-5 grid gap-3 md:grid-cols-4" onSubmit={createPersonnel}>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">
              Worker name <span className="text-red-600">*</span>
            </span>
            <input
              type="text"
              value={newPersonnelName}
              onChange={(event) => setNewPersonnelName(event.target.value)}
              required
              placeholder="Worker name"
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">
              Type <span className="text-red-600">*</span>
            </span>
            <select
              value={newPersonnelType}
              onChange={(event) => setNewPersonnelType(event.target.value as (typeof workerTypeOptions)[number])}
              required
              className="w-full rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
            >
              {workerTypeOptions.map((typeOption) => (
                <option key={typeOption} value={typeOption}>
                  {typeOption}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">
              Default rate <span className="text-red-600">*</span>
            </span>
            <span className="flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm">
              <span className="font-medium text-zinc-500">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={newPersonnelRate}
                onChange={(event) => setNewPersonnelRate(event.target.value)}
                required
                placeholder="Default rate"
                className="w-full bg-transparent outline-none"
              />
            </span>
          </label>
          <button
            type="submit"
            disabled={isCreatingPersonnel}
            className="self-end rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300"
          >
            {isCreatingPersonnel ? "Adding..." : "Add personnel"}
          </button>
        </form>

        <div className="mb-2 hidden grid-cols-5 gap-3 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-zinc-500 md:grid">
          <p>
            Name <span className="text-red-600">*</span>
          </p>
          <p>
            Type <span className="text-red-600">*</span>
          </p>
          <p>
            Default Rate <span className="text-red-600">*</span>
          </p>
          <p>Save</p>
          <p>Delete</p>
        </div>

        <div className="space-y-3">
          {personnel.map((person) => (
            <div key={person.id} className="grid gap-3 rounded-xl border border-zinc-200 p-3 md:grid-cols-5">
              <input
                type="text"
                value={person.name}
                onChange={(event) => updatePersonnelDraft(person.id, { name: event.target.value })}
                required
                placeholder="Worker name *"
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              />
              <select
                value={person.worker_type}
                onChange={(event) => updatePersonnelDraft(person.id, { worker_type: event.target.value })}
                required
                className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
              >
                {!workerTypeOptions.includes(person.worker_type as (typeof workerTypeOptions)[number]) ? (
                  <option value={person.worker_type}>{person.worker_type}</option>
                ) : null}
                {workerTypeOptions.map((typeOption) => (
                  <option key={typeOption} value={typeOption}>
                    {typeOption}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm">
                <span className="font-medium text-zinc-500">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={person.default_rate}
                  onChange={(event) => {
                    const rawValue = event.target.value;
                    updatePersonnelDraft(person.id, {
                      default_rate: rawValue === "" ? 0 : Number(rawValue),
                    });
                  }}
                  required
                  placeholder="Default rate"
                  className="w-full bg-transparent outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => savePersonnel(person)}
                disabled={savingPersonnelId === person.id}
                className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {savingPersonnelId === person.id ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => removePersonnel(person.id)}
                disabled={deletingPersonnelId === person.id}
                className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-red-300"
              >
                {deletingPersonnelId === person.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
          {personnel.length === 0 ? <p className="text-sm text-zinc-500">No personnel yet.</p> : null}
        </div>

        {personnelError ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{personnelError}</p>
        ) : null}

        {personnelMessage ? (
          <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {personnelMessage}
          </p>
        ) : null}
      </section>
    </div>
  );
}

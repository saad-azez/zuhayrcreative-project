"use server";

/**
 * Contact-form inquiry → inquiry@zuhayrcreative.org.
 *
 * Sent server-side through Resend's HTTP API (plain fetch, no SDK), so the
 * visitor never leaves the page for their mail app. The visitor's address is
 * set as Reply-To, so hitting Reply in the inbox answers them directly.
 *
 * Environment (set in Vercel → Project → Settings → Environment Variables,
 * and in .env.local for local testing):
 *   RESEND_API_KEY      required — API key from resend.com
 *   CONTACT_FROM_EMAIL  optional — sender. Defaults to
 *                       "Zuhayr Creative <website@zuhayrcreative.org>"
 *                       (zuhayrcreative.org is verified in Resend, 17 Nov 2026).
 *   CONTACT_TO_EMAIL    optional — defaults to inquiry@zuhayrcreative.org.
 *                       Test-only override; never set it in Vercel.
 *
 * Values are read at BUILD time on Vercel: after changing one there, redeploy.
 * Surrounding quotes are stripped — Vercel's dashboard keeps quotes as part of
 * the value (unlike .env files), and a quoted sender is rejected by Resend.
 */

import { headers } from "next/headers";

export type InquiryResult = { ok: true } | { ok: false; error: string };

/** An env value, trimmed and with any wrapping quotes removed; "" → undefined. */
const env = (key: string) =>
  process.env[key]?.trim().replace(/^(["'])(.*)\1$/, "$2").trim() || undefined;

const TO = env("CONTACT_TO_EMAIL") || "inquiry@zuhayrcreative.org";
const FROM = env("CONTACT_FROM_EMAIL") || "Zuhayr Creative <website@zuhayrcreative.org>";

const LIMITS = { name: 120, email: 200, company: 160, message: 5000 } as const;
const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]+$/;

const field = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );

// Header-safe: no line breaks in anything that lands in the subject line.
const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ");

/**
 * Rate limit: at most MAX_PER_WINDOW inquiries per visitor IP per window.
 * Stops a script from flooding the inbox or burning the Resend quota.
 *
 * In-memory, so it is per server instance — Vercel may run several, which
 * makes this a speed bump rather than a wall. For a hard limit, add a Vercel
 * Firewall rate-limit rule on POST /contact (dashboard → Firewall).
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return true;
  }
  hits.push(now);
  recent.set(ip, hits);
  // Keep the map from growing without bound on a long-lived instance.
  if (recent.size > 5000) {
    for (const [key, times] of recent) {
      if (times.every((t) => now - t >= WINDOW_MS)) recent.delete(key);
    }
  }
  return false;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-forwarded-for to the real client IP (first entry).
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

export async function sendInquiry(formData: FormData): Promise<InquiryResult> {
  if (rateLimited(await clientIp())) {
    return {
      ok: false,
      error: "You've sent several messages in a short time. Please wait a few minutes and try again.",
    };
  }

  // Honeypot: a hidden field real visitors never see. Bots that fill every
  // input get a quiet "success" and nothing is sent.
  if (field(formData, "website")) return { ok: true };

  const name = field(formData, "name");
  const email = field(formData, "email");
  const company = field(formData, "company");
  const message = field(formData, "message");

  if (!name || !email || !message) {
    return { ok: false, error: "Please fill in your name, email and message." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "That email address doesn't look right." };
  }
  if (
    name.length > LIMITS.name ||
    email.length > LIMITS.email ||
    company.length > LIMITS.company ||
    message.length > LIMITS.message
  ) {
    return { ok: false, error: "One of the fields is too long. Please shorten it and try again." };
  }

  const apiKey = env("RESEND_API_KEY");
  if (!apiKey) {
    console.error("[contact] RESEND_API_KEY is not set — inquiry not sent.");
    return {
      ok: false,
      error: "We couldn't send your message right now. Please email inquiry@zuhayrcreative.org directly.",
    };
  }

  const subject = oneLine(
    `Project Inquiry from ${name}${company ? ` (${company})` : ""}`,
  );

  const text =
    `Name: ${name}\nEmail: ${email}\nCompany: ${company || "—"}\n\nMessage:\n${message}\n`;

  const row = (label: string, value: string) =>
    `<tr><td style="padding:4px 16px 4px 0;color:#888;vertical-align:top">${label}</td>` +
    `<td style="padding:4px 0">${value}</td></tr>`;

  const html =
    `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.5;color:#111">` +
    `<h2 style="margin:0 0 16px;font-size:18px">New project inquiry</h2>` +
    `<table style="border-collapse:collapse;margin-bottom:20px">` +
    row("Name", escapeHtml(name)) +
    row("Email", `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`) +
    row("Company", escapeHtml(company || "—")) +
    `</table>` +
    `<div style="white-space:pre-wrap;border-top:1px solid #ddd;padding-top:16px">${escapeHtml(message)}</div>` +
    `</div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: [TO],
        reply_to: email,
        subject,
        text,
        html,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("[contact] Resend rejected the inquiry:", res.status, await res.text());
      return {
        ok: false,
        error: "We couldn't send your message right now. Please try again in a moment.",
      };
    }
  } catch (err) {
    console.error("[contact] Failed to reach Resend:", err);
    return {
      ok: false,
      error: "We couldn't send your message right now. Please try again in a moment.",
    };
  }

  return { ok: true };
}

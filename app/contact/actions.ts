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
 *   CONTACT_FROM_EMAIL  optional — sender, e.g. "Zuhayr Creative <website@zuhayrcreative.org>".
 *                       Needs zuhayrcreative.org verified in Resend. Defaults to
 *                       Resend's shared test sender, which only delivers to the
 *                       address the Resend account was registered with.
 *   CONTACT_TO_EMAIL    optional — defaults to inquiry@zuhayrcreative.org.
 */

export type InquiryResult = { ok: true } | { ok: false; error: string };

const TO = process.env.CONTACT_TO_EMAIL || "inquiry@zuhayrcreative.org";
const FROM =
  process.env.CONTACT_FROM_EMAIL || "Zuhayr Creative Website <onboarding@resend.dev>";

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

export async function sendInquiry(formData: FormData): Promise<InquiryResult> {
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

  const apiKey = process.env.RESEND_API_KEY;
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

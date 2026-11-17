"use client";

import { useState } from "react";
import UnicornBackground from "../components/UnicornBackground";
import LiquidGlassCTA from "../components/LiquidGlassCTA";
import { sendInquiry } from "./actions";

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  // Sent server-side (./actions.ts) straight to inquiry@zuhayrcreative.org —
  // the visitor stays on the page instead of being bounced to a mail app.
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError("");
    try {
      const result = await sendInquiry(new FormData(e.currentTarget));
      if (result.ok) {
        setStatus("sent");
        setFormData({ name: "", email: "", company: "", message: "" });
      } else {
        setStatus("error");
        setError(result.error);
      }
    } catch {
      setStatus("error");
      setError(
        "We couldn't send your message right now. Please try again in a moment.",
      );
    }
  };

  return (
    <>
      <UnicornBackground />

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        {/* Two-column layout — big left title hugging the left edge, contact
            form hugging the right edge. Edge padding matches the hero so the
            content runs to the margins instead of sitting in a centred box. */}
        <section className="w-full min-h-svh flex items-center px-[clamp(1.25rem,5vw,8rem)] py-28 sm:py-32 lg:py-20">
          <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
            {/* LEFT — title block, left-aligned */}
            <div className="flex flex-col justify-center text-left">
              <p className="text-xs sm:text-sm font-medium tracking-[0.3em] uppercase text-title-red mb-6">
                Get in Touch
              </p>
              <h1 className="font-display uppercase font-bold text-[clamp(3rem,9vw,7.5rem)] leading-[1.25] tracking-[-0.02em] text-foreground">
                Let&apos;s build
                <br />
                something
                <br />
                <span className="text-title-red">remarkable</span>.
              </h1>
              <p className="mt-8 text-base sm:text-lg text-foreground-muted leading-relaxed max-w-xl">
                Tell us about your vision and we&apos;ll craft a strategy
                tailored to your goals. Every project starts with a
                conversation — drop your details and we&apos;ll get back within
                24 hours.
              </p>
            </div>

            {/* RIGHT — form, no container background, pushed to the right edge */}
            <div className="flex flex-col justify-center lg:items-end">
              {status === "sent" ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex flex-col items-start gap-6 w-full max-w-xl"
                >
                  <span
                    aria-hidden
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-title-red text-white shadow-[0_0_24px_rgba(255,42,69,0.45)]"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  </span>
                  <p className="text-xs sm:text-sm font-medium tracking-[0.3em] uppercase text-foreground">
                    Inquiry sent
                  </p>
                  <h2 className="font-display uppercase font-bold text-[clamp(2rem,4vw,3rem)] leading-[1.1] tracking-[-0.02em] text-foreground">
                    Thank you — we&apos;ve got it.
                  </h2>
                  <p className="text-base sm:text-lg text-foreground-muted leading-relaxed">
                    Your message is on its way to our team. We&apos;ll get back
                    to you within 24 hours.
                  </p>
                  <button
                    type="button"
                    onClick={() => setStatus("idle")}
                    className="mt-2 text-xs font-medium tracking-wider uppercase text-foreground-muted underline underline-offset-4 decoration-white/30 hover:text-foreground hover:decoration-title-red transition-colors"
                  >
                    Send another inquiry
                  </button>
                </div>
              ) : (
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-7 w-full max-w-xl"
              >
                {/* Honeypot — hidden from people and screen readers; bots that
                    fill it are dropped server-side. */}
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden
                  className="absolute -left-[9999px] h-px w-px opacity-0"
                />

                {/* Name & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="name"
                      className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                    >
                      Name <span className="text-title-red">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your name"
                      className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-foreground placeholder:text-foreground-subtle text-base focus:outline-none focus:border-title-red transition-colors"
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label
                      htmlFor="email"
                      className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                    >
                      Email <span className="text-title-red">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@company.com"
                      className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-foreground placeholder:text-foreground-subtle text-base focus:outline-none focus:border-title-red transition-colors"
                    />
                  </div>
                </div>

                {/* Company */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="company"
                    className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                  >
                    Company
                  </label>
                  <input
                    type="text"
                    id="company"
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    placeholder="Your company name"
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-foreground placeholder:text-foreground-subtle text-base focus:outline-none focus:border-title-red transition-colors"
                  />
                </div>

                {/* Message */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="message"
                    className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                  >
                    Message <span className="text-title-red">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    placeholder="Tell us about your project, goals, and timeline..."
                    className="w-full px-0 py-3 bg-transparent border-0 border-b border-white/15 text-foreground placeholder:text-foreground-subtle text-base focus:outline-none focus:border-title-red transition-colors resize-none"
                  />
                </div>

                {/* Submit — liquid-glass CTA with the accepting-new-projects roll */}
                {status === "error" && (
                  <p
                    role="alert"
                    className="-mb-2 flex items-start gap-2.5 text-sm text-foreground leading-relaxed"
                  >
                    <span
                      aria-hidden
                      className="mt-[0.45em] h-2 w-2 shrink-0 rounded-full bg-title-red shadow-[0_0_8px_2px_rgba(255,42,69,0.7)]"
                    />
                    {error}
                  </p>
                )}

                <LiquidGlassCTA
                  type="submit"
                  label={status === "sending" ? "Sending…" : "Send Inquiry"}
                  disabled={status === "sending"}
                  rect
                  fullWidth
                  className="mt-4"
                />
              </form>
              )}
            </div>
          </div>
        </section>

        {/* Footer — same as other pages */}
      </main>
    </>
  );
}

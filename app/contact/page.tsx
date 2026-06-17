"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import ContactFooter from "../components/ContactFooter";

const Beams = dynamic(() => import("../components/Beams/Beams"), {
  ssr: false,
});

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Project Inquiry from ${formData.name || "Website"}`,
    );
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\n\nMessage:\n${formData.message}`,
    );
    window.location.href = `mailto:inquiry@zuhayrcreative.org?subject=${subject}&body=${body}`;
  };

  return (
    <>
      {/* Beams animated background */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          zIndex: -10,
          overflow: "hidden",
        }}
      >
        <Beams
          beamWidth={3}
          beamHeight={24}
          beamNumber={19}
          lightColor="#e10a7c"
          speed={2.2}
          noiseIntensity={0}
          scale={0.2}
          rotation={35}
        />
      </div>

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        {/* Two-column layout — big left title, right contact form */}
        <section className="w-full min-h-svh flex items-center px-6 sm:px-10 lg:px-20 py-28 sm:py-32 lg:py-20">
          <div className="mx-auto max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
            {/* LEFT — title block, left-aligned */}
            <div className="flex flex-col justify-center text-left">
              <p className="text-xs sm:text-sm font-medium tracking-[0.3em] uppercase text-title-red mb-6">
                Get in Touch
              </p>
              <h1 className="font-anton uppercase font-bold text-[clamp(3rem,9vw,7.5rem)] leading-[0.95] tracking-[-0.02em] text-foreground">
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

            {/* RIGHT — form, no container background */}
            <div className="flex flex-col justify-center">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col gap-7 w-full max-w-xl"
              >
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

                {/* Submit */}
                <button
                  type="submit"
                  className="mt-4 self-start inline-flex items-center justify-center px-8 py-4 rounded-full bg-title-red/90 hover:bg-title-red text-white font-semibold text-sm tracking-wide transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] shadow-[0_12px_36px_rgba(220,20,60,0.35)]"
                >
                  Send Inquiry →
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* Footer — same as other pages */}
        <ContactFooter />
      </main>
    </>
  );
}

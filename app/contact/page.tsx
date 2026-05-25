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
    service: "",
    budget: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = encodeURIComponent(
      `Project Inquiry from ${formData.name || "Website"}`,
    );
    const body = encodeURIComponent(
      `Name: ${formData.name}\nEmail: ${formData.email}\nCompany: ${formData.company}\nService: ${formData.service}\nBudget: ${formData.budget}\n\nMessage:\n${formData.message}`,
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
          lightColor="#ce0e3e"
          speed={2.2}
          noiseIntensity={0}
          scale={0.2}
          rotation={35}
        />
      </div>

      <main className="relative w-full max-w-full min-h-screen overflow-x-hidden">
        {/* Contact Form Section */}
        <section className="w-full flex items-center justify-center px-4 sm:px-6 py-24 sm:py-32">
          <div className="w-full max-w-2xl">
            {/* Heading */}
            <div className="text-center mb-12 sm:mb-16">
              <p className="text-xs font-medium tracking-[0.3em] uppercase text-title-red mb-4">
                Get in Touch
              </p>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-foreground leading-tight">
                Start Your Project
              </h1>
              <p className="mt-4 text-foreground-muted text-sm sm:text-base max-w-md mx-auto leading-relaxed">
                Tell us about your vision and we&apos;ll craft a strategy
                tailored to your goals.
              </p>
            </div>

            {/* Form Container */}
            <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-xl p-8 sm:p-10">
              <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-foreground-subtle text-sm focus:outline-none focus:border-title-red/50 transition-colors"
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
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-foreground-subtle text-sm focus:outline-none focus:border-title-red/50 transition-colors"
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
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-foreground-subtle text-sm focus:outline-none focus:border-title-red/50 transition-colors"
                />
              </div>

              {/* Service & Budget Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="service"
                    className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                  >
                    Service Interested In
                  </label>
                  <select
                    id="service"
                    name="service"
                    value={formData.service}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-title-red/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-background">
                      Select a service
                    </option>
                    <option value="Web Design" className="bg-background">
                      Web Design
                    </option>
                    <option value="Web Development" className="bg-background">
                      Web Development
                    </option>
                    <option value="AI Automation" className="bg-background">
                      AI Automation
                    </option>
                    <option value="AI Consulting" className="bg-background">
                      AI Consulting
                    </option>
                    <option value="SEO Optimization" className="bg-background">
                      SEO Optimization
                    </option>
                    <option
                      value="Social Media Marketing"
                      className="bg-background"
                    >
                      Social Media Marketing
                    </option>
                    <option
                      value="Marketing Strategy"
                      className="bg-background"
                    >
                      Marketing Strategy
                    </option>
                    <option value="Other" className="bg-background">
                      Other
                    </option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="budget"
                    className="text-xs font-medium tracking-wider uppercase text-foreground-muted"
                  >
                    Budget Range
                  </label>
                  <select
                    id="budget"
                    name="budget"
                    value={formData.budget}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground text-sm focus:outline-none focus:border-title-red/50 transition-colors appearance-none"
                  >
                    <option value="" className="bg-background">
                      Select budget
                    </option>
                    <option value="$1k - $5k" className="bg-background">
                      $1k – $5k
                    </option>
                    <option value="$5k - $15k" className="bg-background">
                      $5k – $15k
                    </option>
                    <option value="$15k - $50k" className="bg-background">
                      $15k – $50k
                    </option>
                    <option value="$50k+" className="bg-background">
                      $50k+
                    </option>
                  </select>
                </div>
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
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-foreground placeholder:text-foreground-subtle text-sm focus:outline-none focus:border-title-red/50 transition-colors resize-none"
                />
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="mt-4 w-full py-4 rounded-lg bg-title-red/90 hover:bg-title-red text-white font-medium text-sm tracking-wide transition-all duration-300 hover:scale-[1.01] active:scale-[0.99]"
              >
                Send Inquiry
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

import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata, SITE_URL } from "../lib/seo";
import { COMPANY, SERVICES, PROCESS, FAQS } from "../lib/company";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "About",
  description:
    "Zuhayr Creative is a design-led creative agency in Hong Kong: brand design, experience design and web development, communication design, content production and AI integration. Services, process and FAQ.",
});

/**
 * About — the company in plain words (AEO, 19 Nov 2026).
 *
 * The home page shows the work; this page says what the company is, what it
 * does and how, in sentences an answer engine (ChatGPT, Perplexity, Google AI
 * Overviews) can quote. Every fact comes from app/lib/company.ts, which also
 * feeds the site's structured data, so the two cannot disagree.
 *
 * Not in the menu: "About" was taken out of navItems.ts on purpose. It is in
 * the sitemap and llms.txt, which is how crawlers find it.
 *
 * Styled like app/club and app/not-found (the same gradient and red display
 * type), with no WebGL scene: it is a page for reading.
 */
export default function AboutPage() {
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/about#faq`,
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };

  return (
    <main
      className="relative w-full overflow-x-hidden px-6 pb-24 pt-28 text-white md:px-12 md:pt-32"
      style={{ background: "radial-gradient(125% 125% at 50% 0%, #2a0a12 0%, #0a0a0a 60%)" }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
      />

      <div className="mx-auto max-w-4xl">
        <header>
          <span className="text-xs uppercase tracking-[0.3em] text-white/50 sm:text-sm">About</span>
          <h1
            className="mt-3 font-display uppercase leading-[1.05] text-[clamp(2.75rem,9vw,7rem)]"
            style={{ color: "#C4010D" }}
          >
            Zuhayr Creative
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/85 sm:text-xl">{COMPANY.summary}</p>
          <ul className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm uppercase tracking-[0.18em] text-white/60">
            <li>{COMPANY.city}</li>
            <li>{COMPANY.projects} projects</li>
            <li>{COMPANY.continents} continents</li>
            <li>Accepting new projects</li>
          </ul>
        </header>

        <section aria-labelledby="services" className="mt-20">
          <h2 id="services" className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            What we do
          </h2>
          <div className="mt-8 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {SERVICES.map((s) => (
              <article key={s.name} className="border-t border-white/15 pt-5">
                <h3 className="text-lg font-semibold uppercase tracking-[0.12em]">{s.name}</h3>
                <p className="mt-2 leading-relaxed text-white/70">{s.blurb}</p>
                <ul className="mt-3 space-y-1 text-sm text-white/55">
                  {s.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="process" className="mt-20">
          <h2 id="process" className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            How we work
          </h2>
          <ol className="mt-8 space-y-6">
            {PROCESS.map((p, i) => (
              <li key={p.name} className="grid gap-2 border-t border-white/15 pt-5 sm:grid-cols-[12rem_1fr] sm:gap-8">
                <h3 className="text-lg font-semibold uppercase tracking-[0.12em]">
                  <span className="mr-3 text-white/40">{String(i + 1).padStart(2, "0")}</span>
                  {p.name}
                  <span className="mt-1 block text-xs font-normal tracking-[0.2em] text-white/45">{p.stage}</span>
                </h3>
                <p className="leading-relaxed text-white/70">{p.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="faq" className="mt-20">
          <h2 id="faq" className="font-display text-3xl uppercase tracking-wide sm:text-4xl">
            Questions
          </h2>
          <dl className="mt-8 space-y-8">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="border-t border-white/15 pt-5">
                <dt className="text-lg font-semibold">{q}</dt>
                <dd className="mt-2 leading-relaxed text-white/70">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="company" className="mt-20 border-t border-white/15 pt-8">
          <h2 id="company" className="sr-only">
            Company
          </h2>
          <p className="text-sm leading-relaxed text-white/55">
            {COMPANY.name} is a trading name of {COMPANY.legalName}, a concern of{" "}
            <a
              href={COMPANY.parent.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              {COMPANY.parent.name}
            </a>
            . Office: {COMPANY.city}. Email:{" "}
            <a href={`mailto:${COMPANY.email}`} className="underline decoration-white/30 underline-offset-4 hover:text-white">
              {COMPANY.email}
            </a>
            .
          </p>
          <Link
            href="/contact"
            className="group mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm uppercase tracking-[0.18em] text-white transition-colors hover:border-[#C4010D] hover:bg-[#C4010D]/15"
          >
            Start a project
            <span aria-hidden className="transition-transform duration-300 ease-out group-hover:translate-x-1">
              &rarr;
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}

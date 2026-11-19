/**
 * Facts about the company, in one place: the About page (app/about), the
 * structured data in app/layout.tsx and public/llms.txt all say the same
 * thing, which is what search and AI answer engines need to trust it.
 *
 * Every fact here is taken from the site itself (services from
 * ServicesSectionV3 MODEL_DETAILS, process from VerticalGallery/galleryData,
 * figures from ImpactSection, legal lines and office from ContactFooter).
 * When one of those changes, change it here and in public/llms.txt too.
 */

export const COMPANY = {
  name: "Zuhayr Creative",
  legalName: "Zuhayr Media LTD",
  parent: { name: "Zuhayr Holdings", url: "https://zuhayrholdings.org/" },
  city: "Hong Kong",
  countryCode: "HK",
  email: "inquiry@zuhayrcreative.org",
  careersEmail: "careers@zuhayrcreative.org",
  /** One plain sentence: what an answer engine should say the company is. */
  summary:
    "Zuhayr Creative is a design-led creative agency based in Hong Kong, working across brand design, experience design, communication design, content production and AI integration.",
  projects: "250+",
  continents: 4,
};

export interface CompanyService {
  name: string;
  blurb: string;
  items: string[];
}

export const SERVICES: CompanyService[] = [
  {
    name: "Brand Design",
    blurb: "Identities built as systems, distinct at a glance, consistent everywhere.",
    items: ["Brand Development", "Brand Consultation", "Concept Design", "VI / CI Design"],
  },
  {
    name: "Experience Design",
    blurb: "Digital experiences designed to be felt, built to perform.",
    items: ["UX Design", "UI Design", "Website & App Development", "E-commerce Development", "Digital Experience"],
  },
  {
    name: "Communication Design",
    blurb: "One idea, one point of view, carried through everything we make.",
    items: ["Communication Strategy", "Creative Planning", "Creative & Art Direction", "Social Media"],
  },
  {
    name: "Content Production",
    blurb: "Moving image made to hold attention.",
    items: ["Video / Still Production", "Commercial Planning / Production", "Graphic / Motion Design", "CGI"],
  },
  {
    name: "AI Integration",
    blurb: "AI woven into your brand, your experiences, and how you're found.",
    items: ["AI Consultation", "AI Experience Development", "Generative Content Production", "Generative Engine Optimization (GEO)"],
  },
];

export interface ProcessStep {
  name: string;
  stage: string;
  text: string;
}

export const PROCESS: ProcessStep[] = [
  {
    name: "Consultation",
    stage: "Discovery",
    text: "Discovery sessions to understand your vision, pain points and business objectives, then aligning your goals with the right approach.",
  },
  {
    name: "Analysis",
    stage: "Research",
    text: "An audit of your current digital presence, market position and competitors, turned into insight on where the biggest opportunities are.",
  },
  {
    name: "Formulation",
    stage: "Strategy",
    text: "A plan built from that research, where every tactic ties to a measurable outcome, and the design of the solution from user journeys to technical specs.",
  },
  {
    name: "Execution",
    stage: "Delivery",
    text: "Production-grade design and development, delivered in iterations with feedback at every step.",
  },
  {
    name: "Refinement",
    stage: "Optimization",
    text: "After launch, performance is measured against the starting baseline and the work keeps improving through testing and feedback.",
  },
];

export interface Faq {
  q: string;
  a: string;
}

const serviceNames = SERVICES.map((s) => s.name);

export const FAQS: Faq[] = [
  {
    q: "What is Zuhayr Creative?",
    a: `${COMPANY.summary} It is a trading name of ${COMPANY.legalName} and a concern of ${COMPANY.parent.name}.`,
  },
  {
    q: "Where is Zuhayr Creative based?",
    a: `Zuhayr Creative's office is in ${COMPANY.city}. The agency works with clients across ${COMPANY.continents} continents.`,
  },
  {
    q: "What services does Zuhayr Creative offer?",
    a: `Five practices: ${serviceNames.slice(0, -1).join(", ")} and ${serviceNames.at(-1)}. They cover brand identity, UX and UI design, website, app and e-commerce development, communication strategy and social media, video, motion and CGI production, and AI consultation and development.`,
  },
  {
    q: "Does Zuhayr Creative design and build websites?",
    a: "Yes. Experience Design covers UX design, UI design, website and app development, e-commerce development and wider digital experiences, from the first sketch to launch.",
  },
  {
    q: "What is Generative Engine Optimization (GEO)?",
    a: "GEO is making a brand easy for AI answer engines such as ChatGPT, Perplexity, Gemini and Google's AI Overviews to understand, trust and cite. Zuhayr Creative offers it as part of AI Integration, alongside AI consultation, AI experience development and generative content production.",
  },
  {
    q: "How does a project with Zuhayr Creative work?",
    a: `In five stages: ${PROCESS.map((p) => `${p.name} (${p.stage.toLowerCase()})`).join(", ")}. Each stage builds on the one before, and the work keeps being measured and improved after launch.`,
  },
  {
    q: "How many projects has Zuhayr Creative completed?",
    a: `More than ${COMPANY.projects.replace("+", "")} projects, for clients across ${COMPANY.continents} continents.`,
  },
  {
    q: "Is Zuhayr Creative taking on new projects?",
    a: `Yes, the agency is accepting new projects. Send a message through the contact page or email ${COMPANY.email}.`,
  },
  {
    q: "Is Zuhayr Creative hiring?",
    a: `Open roles are listed on the careers page. They include AI Specialist, Creative Direction, Designer, Motion Design and Web Developer. Applications go to ${COMPANY.careersEmail}.`,
  },
];

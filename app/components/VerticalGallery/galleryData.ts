export interface GalleryItem {
  id: number;
  src: string;
  srcSet: string;
  alt: string;
  titleTop: string;
  titleBottom: string;
  textLeftTitle: string;
  textLeftDesc: string;
  textRightTitle: string;
  textRightDesc: string;
}

export const galleryData: GalleryItem[] = [
  {
    id: 1,
    src: "/consultation1.svg",
    srcSet: "/consultation1.svg",
    alt: "Consultation Meeting",
    titleTop: "CONSULTATION",
    titleBottom: "DISCOVERY",
    textLeftTitle: "LISTEN",
    textLeftDesc:
      "Deep-dive discovery sessions to understand your vision, pain points, and business objectives. Every solution starts with hearing your story.",
    textRightTitle: "ALIGN",
    textRightDesc:
      "Strategic alignment between your goals and our capabilities. We map your needs to proven methodologies for maximum impact.",
  },
  {
    id: 2,
    src: "/analysis1.svg",
    srcSet: "/analysis1.svg",
    alt: "Data Analysis",
    titleTop: "ANALYSIS",
    titleBottom: "RESEARCH",
    textLeftTitle: "AUDIT",
    textLeftDesc:
      "Comprehensive audit of your current digital presence, market position, and competitive landscape. Data reveals the hidden opportunities.",
    textRightTitle: "INSIGHT",
    textRightDesc:
      "Raw data transformed into actionable insights. We identify patterns, benchmark performance, and pinpoint high-impact areas for growth.",
  },
  {
    id: 3,
    src: "/formulation1.svg",
    srcSet: "/formulation1.svg",
    alt: "Strategy Formulation",
    titleTop: "FORMULATION",
    titleBottom: "STRATEGY",
    textLeftTitle: "PLAN",
    textLeftDesc:
      "Blueprint crafted from research and insight. Every tactic ties directly to measurable business outcomes and brand objectives.",
    textRightTitle: "DESIGN",
    textRightDesc:
      "Architectural design of the solution — from user journeys to technical specs. A comprehensive roadmap that guides every下一步 execution step.",
  },
  {
    id: 4,
    src: "/execution1.svg",
    srcSet: "/execution1.svg",
    alt: "Project Execution",
    titleTop: "EXECUTION",
    titleBottom: "DELIVERY",
    textLeftTitle: "BUILD",
    textLeftDesc:
      "Production-grade development and deployment. Cross-functional teams execute in parallel, delivering quality at speed.",
    textRightTitle: "ITERATE",
    textRightDesc:
      "Agile sprints with continuous integration and feedback loops. Each iteration pushes the product closer to perfection.",
  },
  {
    id: 5,
    src: "/refinement1.svg",
    srcSet: "/refinement1.svg",
    alt: "Optimization Review",
    titleTop: "REFINEMENT",
    titleBottom: "OPTIMIZATION",
    textLeftTitle: "MEASURE",
    textLeftDesc:
      "Post-launch analytics and performance tracking. We measure every KPI against baseline to quantify real results.",
    textRightTitle: "OPTIMIZE",
    textRightDesc:
      "Continuous refinement through A/B testing, user feedback, and performance data. The solution never stops evolving toward peak efficiency.",
  },
];

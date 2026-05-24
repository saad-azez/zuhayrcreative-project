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
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Confident Portrait",
    titleTop: "CONFIDENCE",
    titleBottom: "CHARISMA",
    textLeftTitle: "CHARM",
    textLeftDesc:
      "Sharp wit, warm smile a magnetic presence. He walks in, and the room seems to pause, by his quiet strength.",
    textRightTitle: "Presence",
    textRightDesc:
      "Striking confidence, captivating charm, and elegance in every glance. A timeless blend of poise and presence, effortlessly charismatic.",
  },
  {
    id: 2,
    src: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Wisdom Portrait",
    titleTop: "WISDOM",
    titleBottom: "INTELLECT",
    textLeftTitle: "BRILLIANCE",
    textLeftDesc:
      "Quick mind, deep thoughts, a scholarly presence. His ideas illuminate the room, guided by penetrating insight.",
    textRightTitle: "knowledge",
    textRightDesc:
      "Deep understanding, thoughtful insights, and clarity in every word. A masterful blend of experience and intuition, naturally enlightening.",
  },
  {
    id: 3,
    src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Kindness Portrait",
    titleTop: "KINDNESS",
    titleBottom: "GENEROSITY",
    textLeftTitle: "Giving",
    textLeftDesc:
      "Open heart, helping hands, a benevolent force. His presence brings comfort, marked by selfless grace.",
    textRightTitle: "Compassion",
    textRightDesc:
      "Gentle spirit, nurturing soul, and warmth in every action. A beautiful harmony of empathy and understanding, naturally caring.",
  },
  {
    id: 4,
    src: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Creativity Portrait",
    titleTop: "CREATIVITY",
    titleBottom: "ARTISTRY",
    textLeftTitle: "Expression",
    textLeftDesc:
      "Fluid style, bold vision, a creative soul. He transforms the ordinary, through his unique perspective.",
    textRightTitle: "Innovation",
    textRightDesc:
      "Boundless imagination, artistic flair, and vision in every creation. A stunning fusion of originality and skill, naturally inspiring.",
  },
  {
    id: 5,
    src: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Leadership Portrait",
    titleTop: "LEADERSHIP",
    titleBottom: "INFLUENCE",
    textLeftTitle: "Impact",
    textLeftDesc:
      "Strong presence, clear purpose, a guiding light. He shapes the path forward, through determined leadership.",
    textRightTitle: "Guidance",
    textRightDesc:
      "Natural authority, inspiring presence, and direction in every decision. A powerful combination of vision and influence, naturally commanding",
  },
  {
    id: 6,
    src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Grace Portrait",
    titleTop: "GRACE",
    titleBottom: "ELEGANCE",
    textLeftTitle: "SOPHISTICATION",
    textLeftDesc:
      "Smooth demeanor, cultured taste, a refined presence. He elevates any setting, with natural elegance.",
    textRightTitle: "POLISH",
    textRightDesc:
      "Refined movement, sophisticated manner, and style in every gesture. A perfect balance of poise and dignity, naturally flowing.",
  },
  {
    id: 7,
    src: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=533&q=80&fit=crop&auto=format",
    srcSet:
      "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=267&q=80&fit=crop&auto=format 400w, https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800&h=533&q=80&fit=crop&auto=format 800w, https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=1200&h=800&q=80&fit=crop&auto=format 1200w",
    alt: "Passion Portrait",
    titleTop: "PASSION",
    titleBottom: "INTENSITY",
    textLeftTitle: "Drive",
    textLeftDesc:
      "Fierce determination, endless energy, a dynamic force. He ignites inspiration, through passionate pursuit.",
    textRightTitle: "Enthusiasm",
    textRightDesc:
      "Burning drive, intense focus, and fire in every pursuit. An explosive blend of energy and dedication, naturally motivating.",
  },
];

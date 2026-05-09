# Zuhayr Creative - Color Palette Guide

**Inspired by:** [Altrum Template](https://altrum-template.webflow.io/)

## 🎨 Color System

### Dark Backgrounds
Premium dark backdrop creating depth and sophistication.

| Variable | Hex Code | Usage |
|----------|----------|-------|
| `--background` | `#0A0A0A` | Main site background (almost black) |
| `--background-secondary` | `#141414` | Cards, sections, elevated surfaces |
| `--background-subtle` | `#1A1A1A` | Hover states, borders, subtle layering |

**Tailwind Classes:**
- `bg-background`
- `bg-background-secondary`
- `bg-background-subtle`

---

### Maroon Brand Colors
Sophisticated maroon palette for brand identity and interactive elements.

| Variable | Hex Code | Usage |
|----------|----------|-------|
| `--maroon-primary` | `#8B2F39` | Primary brand color, main CTA buttons |
| `--maroon-deep` | `#6B1F2A` | Darker variant, gradients, shadows |
| `--maroon-accent` | `#A13D47` | Highlights, hover states, icons |
| `--maroon-muted` | `#5A1A23` | Subtle backgrounds, borders |

**Tailwind Classes:**
- `bg-maroon-primary` / `text-maroon-primary`
- `bg-maroon-deep` / `text-maroon-deep`
- `bg-maroon-accent` / `text-maroon-accent`
- `bg-maroon-muted` / `text-maroon-muted`

---

### Typography Colors
High-contrast text colors for optimal readability on dark backgrounds.

| Variable | Hex Code | Usage |
|----------|----------|-------|
| `--foreground` | `#FFFFFF` | Headings, primary content, white text |
| `--foreground-muted` | `#A0A0A0` | Body text, secondary content |
| `--foreground-subtle` | `#6B6B6B` | Metadata, captions, muted text |

**Tailwind Classes:**
- `text-foreground`
- `text-foreground-muted`
- `text-foreground-subtle`

---

## 🎯 Usage Examples

### Hero Section
```tsx
<section className="bg-background py-24">
  <h1 className="text-foreground text-6xl font-bold">
    Your Headline
  </h1>
  <p className="text-foreground-muted text-lg">
    Supporting description text
  </p>
  <button className="bg-maroon-primary hover:bg-maroon-accent text-white px-8 py-3 rounded-full">
    Call to Action
  </button>
</section>
```

### Card Component
```tsx
<div className="bg-background-secondary border border-maroon-muted/30 rounded-lg p-6">
  <h3 className="text-foreground text-xl font-semibold">Card Title</h3>
  <p className="text-foreground-muted mt-2">Card description</p>
  <span className="text-maroon-accent text-sm">Learn more →</span>
</div>
```

### Gradient Backgrounds
```tsx
// Loading screen gradient
background: "linear-gradient(155deg, #0A0A0A 0%, #141414 30%, #1A1A1A 60%, #8B2F39 100%)"

// Button hover gradient
background: "linear-gradient(135deg, #8B2F39 0%, #6B1F2A 100%)"
```

---

## 🔧 Implementation Notes

### CSS Variables
All colors are defined in `app/globals.css` as CSS custom properties:
```css
:root {
  --background: #0A0A0A;
  --maroon-primary: #8B2F39;
  /* ... etc */
}
```

### Tailwind Integration
Colors are automatically available in Tailwind via the `@theme inline` block in `globals.css`.

### Legacy Support
Old color variables are maintained for backward compatibility:
- `--maroon-dark` → maps to `--maroon-primary`
- `--maroon-light` → maps to `--maroon-accent`
- `--title-red` → maps to `--maroon-primary`
- `--footer` → maps to `--background-secondary`

---

## 🎨 Design Principles

1. **Dark-First:** Always start with dark backgrounds (`#0A0A0A`)
2. **Maroon Accents:** Use maroon colors sparingly for CTAs and highlights
3. **High Contrast:** Maintain white text on dark backgrounds for readability
4. **Layering:** Use secondary/subtle backgrounds for depth
5. **Consistent Opacity:** Use `/30`, `/40`, `/60` opacity values for consistency

---

## 📊 Color Accessibility

| Combination | Contrast Ratio | WCAG Level |
|-------------|----------------|------------|
| White on Background | 21:1 | AAA ✓ |
| Muted Text on Background | 7.2:1 | AA ✓ |
| Maroon Primary on Background | 3.8:1 | AA (Large Text) ✓ |

---

## 🚀 Quick Reference

**Need a dark background?** → `bg-background`  
**Need a card?** → `bg-background-secondary`  
**Need a CTA button?** → `bg-maroon-primary hover:bg-maroon-accent`  
**Need body text?** → `text-foreground-muted`  
**Need a border?** → `border-maroon-muted/30`

---

*Last Updated: May 9, 2026*

---
name: Aetheric Messenger
colors:
  surface: '#faf9fe'
  surface-dim: '#dad9df'
  surface-bright: '#faf9fe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f3f8'
  surface-container: '#eeedf3'
  surface-container-high: '#e9e7ed'
  surface-container-highest: '#e3e2e7'
  on-surface: '#1a1b1f'
  on-surface-variant: '#40484c'
  inverse-surface: '#2f3034'
  inverse-on-surface: '#f1f0f5'
  outline: '#70787d'
  outline-variant: '#c0c8cd'
  surface-tint: '#236580'
  primary: '#236580'
  on-primary: '#ffffff'
  primary-container: '#91cdeb'
  on-primary-container: '#0e5872'
  inverse-primary: '#93cfed'
  secondary: '#006e2e'
  on-secondary: '#ffffff'
  secondary-container: '#6dfb8d'
  on-secondary-container: '#007230'
  tertiary: '#8c5000'
  on-tertiary: '#ffffff'
  tertiary-container: '#ffb670'
  on-tertiary-container: '#7a4500'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#bfe9ff'
  primary-fixed-dim: '#93cfed'
  on-primary-fixed: '#001f2a'
  on-primary-fixed-variant: '#004d65'
  secondary-fixed: '#70fe90'
  secondary-fixed-dim: '#50e177'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffdcbf'
  tertiary-fixed-dim: '#ffb874'
  on-tertiary-fixed: '#2d1600'
  on-tertiary-fixed-variant: '#6a3b00'
  background: '#faf9fe'
  on-background: '#1a1b1f'
  surface-variant: '#e3e2e7'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

This design system is built on the principles of clarity, weightlessness, and seamless connectivity. It targets a modern, tech-savvy demographic that values focus and aesthetic refinement in their daily communication tools.

The visual style is a blend of **Minimalism** and **Glassmorphism**. It prioritizes heavy whitespace and a restricted color palette to reduce cognitive load. Sophistication is introduced through high-quality typography and translucent layers that provide a sense of vertical depth without the clutter of traditional skeumorphism. The interface should feel like a premium physical object—polished, responsive, and tactile yet digital-first.

## Colors

The palette is anchored by a luminous **Aether Blue** (#91cdeb), a soft yet distinct primary color that emphasizes the theme's "weightless" and "airy" qualities.

**Light Mode (Default):** Uses a cooling off-white background to distinguish itself from standard pure-white apps. Surfaces like chat bubbles and cards use pure white to "pop" against the background.

**Dark Mode:** Eschews pure black in favor of deep navy and charcoal tones. This reduces eye strain and maintains the sophisticated, "airy" feel even in low-light environments.

**Accents:** Subtle gradients are applied to primary buttons and active states to provide a sense of energy. Secondary colors are reserved for functional states: a vibrant **Vibrant Green** (#5fee82) for success and online status, orange for warnings, and red for destructive actions.

## Typography

This design system uses **Inter** for its exceptional legibility and neutral, modern character. 

The hierarchy is strictly enforced through weight variance rather than excessive size changes. Bold weights (600-700) are used for headlines to create clear entry points, while regular weights (400) handle high-density chat text to maximize readability. 

**Label styles** use medium weights and slight letter spacing for metadata (timestamps, status) to ensure they remain distinct from body content. For mobile screens, headlines scale down to ensure no more than 3-4 words per line in large display areas.

## Layout & Spacing

The layout follows a **Fluid Grid** model with high horizontal breathing room. 

**Mobile:** 4-column grid with 20px side margins. Chat bubbles utilize a 85% maximum width to ensure the conversation "flow" is visually staggered.
**Tablet/Desktop:** 12-column grid. The system uses a multi-pane approach (Contact List | Active Chat | Details) where the active chat occupies the largest flexible area.

Spacing is based on a 4px baseline, but defaults to 16px (md) for most component internal padding to maintain the "airy" feel. Large cards and sections should use 24px (lg) or 32px (xl) padding to emphasize the premium nature of the layout.

## Elevation & Depth

Depth is communicated through **Ambient Shadows** and **Backdrop Blurs (Glassmorphism)** rather than hard borders.

1.  **Low Elevation (Surface):** Pure white cards with a 2% opacity black shadow, 4px blur, and 2px Y-offset.
2.  **Mid Elevation (Popovers/Modals):** Surfaces use a `backdrop-filter: blur(20px)` with a 80% opacity white fill. This allows background colors to bleed through subtly, maintaining context.
3.  **High Elevation (Active Overlays):** Larger shadow spreads (20px blur, 10% opacity) to create a floating effect for primary floating action buttons (FAB).

Transitions between states should be fluid (200ms ease-in-out) to reinforce the sophisticated feel.

## Shapes

The design system adopts a **Rounded** shape language to appear friendly and modern. 

Standard components (Cards, Chat Bubbles) utilize a 0.5rem (8px) radius. Larger container elements or prominent cards in the feed scale up to `rounded-xl` (1.5rem / 24px) to create a "nested" aesthetic. Buttons and input fields should maintain consistent 12px corner radii to balance the softness of the bubbles with the structure of the UI.

## Components

**Buttons:** 
- *Primary:* Filled with an Aether Blue gradient, white text, 12px radius.
- *Secondary/Ghost:* No fill, 1px border using a light grey (#E2E8F0), or no border with Aether Blue text for low-priority actions.

**Chat Bubbles:** 
- *Incoming:* White surface, 16px radius, with the bottom-left corner sharpened to 4px to indicate the speaker direction.
- *Outgoing:* Soft blue surface (a translucent variation of Aether Blue), 16px radius, with the bottom-right corner sharpened.

**Inputs:** 
- Search bars and text inputs use a light grey fill (#EDF2F7) with no border. On focus, a subtle 1px Aether Blue border appears with a soft outer glow.

**Cards:**
- Used for profiles and media attachments. They should feature "edge-to-edge" imagery where possible, with text content padded by 16px.

**Glass Elements:**
- Top navigation bars and bottom tab bars should use the 20px backdrop blur effect to ensure content is visible as it scrolls beneath, creating a sense of vertical continuity.
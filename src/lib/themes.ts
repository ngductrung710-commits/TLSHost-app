/**
 * The four looks a host can give their booking page.
 *
 * Presets rather than free-form styling, for one reason: every pairing below
 * was checked for contrast, and a host choosing a look should not be able to
 * produce a page a guest cannot read. The brand colour is the single free
 * choice, and it is checked against the chosen preset's background before it
 * is saved — see contrastRatio().
 *
 * Plain values rather than Tailwind classes so the guest page can render them
 * as inline custom properties. That page is served to strangers on unknown
 * devices; it should not depend on a class the build might have tree-shaken.
 */

export type BookingTheme = "CLASSIC" | "MINIMAL" | "WARM" | "BOLD";

export type ThemeTokens = {
  /** Page background. */
  bg: string;
  /** Cards and the booking form. */
  surface: string;
  /** Body text. */
  ink: string;
  /** Secondary text — captions, hints. */
  inkSoft: string;
  /** Hairlines. */
  line: string;
  /** Buttons and emphasis, unless the host set a brand colour. */
  accent: string;
  /** Text on top of the accent. */
  onAccent: string;
  /** Corner radius for cards and buttons. */
  radius: string;
  /** Heading font stack. */
  display: string;
};

export const THEMES: Record<BookingTheme, ThemeTokens> = {
  // The palette the rest of TLSHost uses: espresso on bone.
  CLASSIC: {
    bg: "#f2f0ed",
    surface: "#ffffff",
    ink: "#231813",
    inkSoft: "#544a43",
    line: "#dcd5cc",
    accent: "#a05436",
    onAccent: "#ffffff",
    radius: "1rem",
    display: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  // Nothing but paper and a hairline. For hosts whose photographs are the
  // point and who want the page to get out of the way.
  MINIMAL: {
    bg: "#ffffff",
    surface: "#ffffff",
    ink: "#111111",
    inkSoft: "#5c5c5c",
    line: "#e4e4e4",
    accent: "#111111",
    onAccent: "#ffffff",
    radius: "0.25rem",
    display: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  // Terracotta and sand — the coastal homestay look.
  WARM: {
    bg: "#fbf6f1",
    surface: "#ffffff",
    ink: "#3b2a20",
    inkSoft: "#6b5445",
    line: "#e8d9cb",
    // #c2643a was the first choice and shipped a button label at 4.06:1 —
    // below the 4.5 a label needs. Caught by check:themes, which is the whole
    // reason these presets are a fixed set: an unreadable one would otherwise
    // reach a guest before it reached anyone else.
    accent: "#b4552c",
    onAccent: "#ffffff",
    radius: "1.5rem",
    display: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
  // Dark ground, high contrast. Reads as a boutique property rather than a
  // spare room.
  BOLD: {
    bg: "#14100e",
    surface: "#1e1815",
    ink: "#f5f0ea",
    inkSoft: "#b8aca1",
    line: "#3a302a",
    accent: "#e8a06a",
    onAccent: "#14100e",
    radius: "0.75rem",
    display: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
  },
};

export const THEME_LABELS: Record<BookingTheme, string> = {
  CLASSIC: "Cổ điển",
  MINIMAL: "Tối giản",
  WARM: "Ấm áp",
  BOLD: "Nổi bật",
};

/* -------------------------------------------------------------------------- */
/* Contrast                                                                    */
/* -------------------------------------------------------------------------- */

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance per WCAG 2. Returns null for anything unparseable. */
function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** WCAG contrast ratio, 1–21. Null if either colour is unparseable. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Whether a brand colour can be used as a button background on this theme.
 *
 * 4.5:1 against the button's own text, because a button label is text and
 * WCAG 1.4.3 applies to it. Checked on save rather than on render: a host who
 * picks an unreadable colour should be told immediately, by the form, rather
 * than discover it from a guest who could not find the button.
 */
export function brandColorProblem(
  hex: string,
  theme: BookingTheme,
): string | null {
  if (!/^#[0-9a-f]{6}$/i.test(hex.trim())) {
    return "Màu phải ở dạng #rrggbb, ví dụ #a05436.";
  }

  const tokens = THEMES[theme];
  const onAccent = contrastRatio(hex, tokens.onAccent);
  if (onAccent === null) return "Không đọc được mã màu này.";

  if (onAccent < 4.5) {
    return (
      `Chữ trên nút sẽ khó đọc với màu này (tỷ lệ tương phản ` +
      `${onAccent.toFixed(1)}:1, cần từ 4.5:1). Thử màu đậm hơn.`
    );
  }

  // A button also has to be findable against the page behind it. 3:1 is the
  // non-text threshold, which is what a button's shape is.
  const onPage = contrastRatio(hex, tokens.bg);
  if (onPage !== null && onPage < 3) {
    return (
      `Màu này quá gần với nền trang (${onPage.toFixed(1)}:1, cần từ 3:1), ` +
      `nút sẽ chìm mất.`
    );
  }

  return null;
}

/** The custom properties the guest page renders with. */
export function themeVars(
  theme: BookingTheme,
  brandColor: string | null,
): Record<string, string> {
  const t = THEMES[theme];
  const accent = brandColor ?? t.accent;

  // If the host set a brand colour, the text on top of it is chosen for
  // contrast rather than taken from the preset: a pale accent with the
  // preset's white label would be exactly the unreadable pairing the save
  // check exists to prevent.
  const onAccent =
    brandColor === null
      ? t.onAccent
      : (contrastRatio(accent, "#ffffff") ?? 0) >=
          (contrastRatio(accent, "#111111") ?? 0)
        ? "#ffffff"
        : "#111111";

  return {
    "--bg": t.bg,
    "--surface": t.surface,
    "--ink": t.ink,
    "--ink-soft": t.inkSoft,
    "--line": t.line,
    "--accent": accent,
    "--on-accent": onAccent,
    "--radius": t.radius,
    "--display": t.display,
  };
}

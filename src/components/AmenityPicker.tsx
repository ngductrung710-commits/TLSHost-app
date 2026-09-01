"use client";

import { useMemo, useState } from "react";

import { useT } from "@/components/I18nProvider";
import {
  AMENITY_CATEGORIES,
  CATEGORY_ORDER,
  amenitiesFor,
  type Amenity,
  type AmenityCategory,
} from "@/lib/amenities";
import { fill } from "@/lib/i18n";

/**
 * Pick amenities from a categorised, searchable list.
 *
 * Two of these appear in the wizard — one for the property, one for the first
 * room — so it is a component rather than markup written twice. They hold
 * separate state and separate catalogues: "Bãi đỗ xe máy" belongs to a
 * property and "Điều hòa" to a room, and offering both in both lists is how
 * you end up with a property that claims air conditioning in the lobby.
 *
 * The list is filtered, not paged. A host who knows they want a lift types
 * "thang" and finds it; a host who does not scrolls fourteen headed sections.
 * Search matches both languages, because a host reading the Vietnamese
 * interface may still know the amenity by its English name from an OTA.
 */

/** One glyph per category rather than per amenity. */
const CATEGORY_ICON: Record<AmenityCategory, string> = {
  BASIC: "M3 12h18M12 3v18",
  BATHROOM: "M4 12h16v3a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-3ZM7 12V6a2 2 0 0 1 4 0",
  BEDROOM: "M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 14h18M7 9V6h5v3",
  ENTERTAINMENT: "M3 5h18v11H3zM8 20h8M12 16v4",
  FAMILY: "M9 6a2 2 0 1 0 0-.01M6 20v-5l-2-3 3-3h4l3 3-2 3v5M17 20v-6M15 14h4",
  CLIMATE: "M12 3v13M9 6l3-3 3 3M7 20h10M5 16h14",
  SAFETY: "M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6l7-3Z",
  INTERNET: "M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01",
  KITCHEN: "M6 3v8a3 3 0 0 0 6 0V3M9 11v10M17 3c-1.5 2-2 4-2 6h4c0-2-.5-4-2-6ZM17 9v12",
  LOCATION: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  OUTDOOR: "M12 3v18M5 9a7 7 0 0 1 14 0M3 20c2 0 2-2 4.5-2S10 20 12 20s2-2 4.5-2S19 20 21 20",
  PARKING: "M8 20V5h5a4.5 4.5 0 0 1 0 9H8",
  ACCESS: "M12 5a1.5 1.5 0 1 0 0-.01M10 9h5M10 9v5l4 5M10 14a4 4 0 1 0 4 4",
  SERVICE: "M4 18h16M12 6a6 6 0 0 1 6 6H6a6 6 0 0 1 6-6ZM12 6V4",
};

function Icon({ category }: { category: AmenityCategory }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={CATEGORY_ICON[category]} />
    </svg>
  );
}

export function AmenityPicker({
  label,
  scope,
  lang,
  selected,
  onChange,
}: {
  label: string;
  scope: "property" | "room";
  lang: "vi" | "en";
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");

  const catalogue = useMemo(() => amenitiesFor(scope), [scope]);
  const byId = useMemo(
    () => new Map(catalogue.map((a) => [a.id, a])),
    [catalogue],
  );

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (a: Amenity) =>
      needle === "" ||
      a.vi.toLowerCase().includes(needle) ||
      a.en.toLowerCase().includes(needle);

    const out: { category: AmenityCategory; items: Amenity[] }[] = [];
    for (const category of CATEGORY_ORDER) {
      const items = catalogue.filter((a) => a.category === category && matches(a));
      if (items.length > 0) out.push({ category, items });
    }
    return out;
  }, [catalogue, query]);

  const toggle = (id: string) =>
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id],
    );

  const listId = `amenities-${scope}`;

  return (
    <div>
      <span className="block text-[14px] font-medium text-ink-700">{label}</span>

      <div className="mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-surface">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <span className="text-[13.5px] font-semibold text-ink-900">
            {fill(t("Đã chọn {n}"), { n: selected.length })}
          </span>
          {selected.length > 0 ? (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[13px] font-medium text-ink-500 hover:text-ink-900"
            >
              {t("Bỏ chọn")}
            </button>
          ) : null}
        </div>

        {selected.length > 0 ? (
          <ul className="flex flex-wrap gap-2 px-4 pt-2.5">
            {selected.map((id) => {
              const amenity = byId.get(id);
              if (!amenity) return null;
              return (
                <li key={id}>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-clay-200 bg-clay-50 py-1 pl-2.5 pr-1.5 text-[13px] text-brand-dark">
                    <Icon category={amenity.category} />
                    {amenity[lang]}
                    <button
                      type="button"
                      onClick={() => toggle(id)}
                      aria-label={fill(t("Bỏ {ten}"), { ten: amenity[lang] })}
                      className="grid size-5 place-items-center rounded-full text-brand hover:bg-clay-100"
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="px-4 pb-3 pt-2.5">
          <div className="relative">
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Tìm tiện nghi")}
              aria-controls={listId}
              className="block min-h-10 w-full rounded-lg border border-line bg-canvas pl-9 pr-3 text-[14px] text-ink-900 outline-none focus-visible:border-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/15"
            />
          </div>
        </div>

        <div id={listId} className="max-h-72 overflow-y-auto border-t border-line">
          {grouped.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13.5px] text-ink-500">
              {t("Không có tiện nghi nào khớp.")}
            </p>
          ) : (
            grouped.map(({ category, items }) => (
              <section key={category}>
                <h4 className="sticky top-0 z-10 bg-canvas-alt px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-500">
                  {AMENITY_CATEGORIES[category][lang]}
                </h4>
                <ul>
                  {items.map((amenity) => {
                    const on = selected.includes(amenity.id);
                    return (
                      <li key={amenity.id}>
                        <button
                          type="button"
                          onClick={() => toggle(amenity.id)}
                          aria-pressed={on}
                          className={`flex min-h-11 w-full items-center gap-3 border-b border-line px-4 text-left text-[14px] transition-colors last:border-b-0 hover:bg-sand-50 ${
                            on ? "font-medium text-ink-900" : "text-ink-700"
                          }`}
                        >
                          <span
                            className={`grid size-7 shrink-0 place-items-center rounded-full ${
                              on ? "bg-brand text-white" : "bg-sand-100 text-ink-500"
                            }`}
                          >
                            {on ? (
                              <svg
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                                className="size-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="m5 13 4 4L19 7" />
                              </svg>
                            ) : (
                              <Icon category={amenity.category} />
                            )}
                          </span>
                          {amenity[lang]}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

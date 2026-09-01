"use client";

import { useState } from "react";

import { useT } from "@/components/I18nProvider";

/**
 * A labelled value with a copy button.
 *
 * Built for the transfer screen, where every value is about to be retyped into
 * a banking app on a different device. The account number and the reference
 * are the two a typo actually costs something, so they copy as raw text —
 * `display` exists so the amount can read as "690.000 ₫" and copy as "690000",
 * which is what a bank's amount field will accept.
 */
export function CopyLine({
  label,
  value,
  display,
  mono = false,
  emphasis = false,
}: {
  label: string;
  value: string;
  /** What the reader sees, when that differs from what they should copy. */
  display?: string;
  mono?: boolean;
  emphasis?: boolean;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard access can be refused — an insecure origin, a browser
      // setting, a permission prompt declined. The value is on screen and
      // selectable either way, so this is not worth an error message.
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-b-0">
      <div className="min-w-0">
        <dt className="text-[12.5px] text-ink-500">{label}</dt>
        <dd
          className={`mt-0.5 break-all ${
            emphasis ? "text-[17px] font-semibold" : "text-[15px]"
          } text-ink-900 ${mono ? "tnum" : ""}`}
        >
          {display ?? value}
        </dd>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[12.5px] font-medium text-ink-700 hover:bg-sand-100"
      >
        {copied ? t("Đã chép") : t("Chép")}
      </button>
    </div>
  );
}

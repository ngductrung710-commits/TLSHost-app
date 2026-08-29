import Link from "next/link";

/**
 * The "there is nothing here yet" block, and the one action that fixes it.
 *
 * There were four of these, each with its own padding, its own type sizes and
 * its own button — a dashed box on one screen, a plain centred column on
 * another. Four spellings of the same sentence is how a product starts feeling
 * like it was assembled rather than designed.
 *
 * Measured off the app this was modelled on: 48px of vertical air, 14px/600
 * title, 14px muted description capped at 24rem, and a 40px pill 16px below
 * it. No card and no dashed border — the block sits on the page ground, so
 * nothing frames an absence.
 */
export function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="px-4 py-12 text-center">
      <p className="text-[14px] font-semibold leading-5 text-ink-900">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-[14px] leading-5 text-ink-500">
        {description}
      </p>

      {actionLabel && actionHref ? (
        <Link
          href={actionHref}
          className="mx-auto mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-brand px-5 text-[14px] font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

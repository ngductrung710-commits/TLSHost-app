import { addDays, toIsoDate } from "@/lib/dates";

/**
 * iCalendar, the subset that availability feeds actually use.
 *
 * Written here rather than pulled from a package for one reason: the part that
 * matters is the DTEND convention, and a general-purpose parser hands back a
 * Date that a caller then has to interpret correctly anyway. The interpretation
 * is the bug surface, so it lives in the open.
 *
 * What OTAs publish is narrow — VEVENTs with all-day DTSTART/DTEND, a UID, and
 * a SUMMARY that is usually a placeholder. No timezones worth honouring, no
 * recurrence, no attendees. Everything below is scoped to that.
 */

export type VEvent = {
  uid: string;
  /** First night, inclusive. */
  start: Date;
  /** Morning the room is free again, exclusive — see below. */
  end: Date;
  summary: string | null;
};

/* -------------------------------------------------------------------------- */
/* Reading                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Undoes RFC 5545 line folding.
 *
 * Long lines are split with CRLF followed by a single space or tab, and that
 * whitespace is not part of the value. Skipping this step corrupts any UID
 * longer than 75 octets — which is most of Airbnb's — and the damage is
 * invisible until a re-sync fails to match the row it made last time and
 * creates a duplicate instead.
 */
function unfold(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\r\n|\n|\r/)) {
    if ((raw.startsWith(" ") || raw.startsWith("\t")) && out.length > 0) {
      out[out.length - 1] += raw.slice(1);
    } else {
      out.push(raw);
    }
  }
  return out;
}

/** Splits "DTSTART;VALUE=DATE:20260712" into its name, params and value. */
function splitLine(line: string): {
  name: string;
  params: string;
  value: string;
} | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  const left = line.slice(0, colon);
  const semi = left.indexOf(";");
  return {
    name: (semi < 0 ? left : left.slice(0, semi)).toUpperCase(),
    params: semi < 0 ? "" : left.slice(semi + 1).toUpperCase(),
    value: line.slice(colon + 1),
  };
}

/**
 * Reads a DTSTART/DTEND value as a calendar date at UTC midnight.
 *
 * Two forms appear in these feeds: `20260712` (a date) and `20260712T150000Z`
 * (an instant). The date form is what every OTA uses for availability. The
 * instant form shows up occasionally; its time is discarded rather than
 * converted, because a night belongs to a property's local calendar and an
 * arrival "at 15:00Z" is still the 12th everywhere a guest would say so.
 */
function parseDate(value: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(value.trim());
  if (!m) return null;
  const date = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ParseResult = {
  events: VEvent[];
  /** Lines that looked like an event but could not be used. */
  skipped: number;
};

/**
 * Parses an iCalendar document into events.
 *
 * DTEND is exclusive in RFC 5545 for all-day events, and it is exclusive here,
 * which is the same half-open convention the database uses. That alignment is
 * not a coincidence — it is why the schema chose half-open ranges, and it means
 * an imported reservation needs no adjustment in either direction. Getting this
 * backwards blocks one extra night per reservation, so a busy calendar quietly
 * refuses bookings it could have taken.
 */
export function parseIcal(text: string): ParseResult {
  const lines = unfold(text);

  const events: VEvent[] = [];
  let skipped = 0;

  let inEvent = false;
  let uid: string | null = null;
  let start: Date | null = null;
  let end: Date | null = null;
  let summary: string | null = null;

  const reset = () => {
    uid = null;
    start = null;
    end = null;
    summary = null;
  };

  for (const line of lines) {
    const parsed = splitLine(line);
    if (!parsed) continue;
    const { name, value } = parsed;

    if (name === "BEGIN" && value.toUpperCase() === "VEVENT") {
      inEvent = true;
      reset();
      continue;
    }

    if (name === "END" && value.toUpperCase() === "VEVENT") {
      if (uid && start && end && end > start) {
        events.push({ uid, start, end, summary });
      } else {
        // An event with no UID cannot be matched on the next sync, and one with
        // a backwards or empty range would violate the database's own check.
        // Counted rather than thrown: one malformed event in a feed of forty
        // should not cost the other thirty-nine.
        skipped += 1;
      }
      inEvent = false;
      reset();
      continue;
    }

    if (!inEvent) continue;

    if (name === "UID") uid = value.trim();
    else if (name === "DTSTART") start = parseDate(value);
    else if (name === "DTEND") end = parseDate(value);
    else if (name === "SUMMARY") summary = unescapeText(value);
  }

  return { events, skipped };
}

/** RFC 5545 escapes: \n \, \; \\ */
function unescapeText(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

/* -------------------------------------------------------------------------- */
/* Writing                                                                     */
/* -------------------------------------------------------------------------- */

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Folds at 75 octets, per RFC 5545. Counted in bytes, not characters. */
function fold(line: string): string {
  const bytes = Buffer.from(line, "utf8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let cut = 0;
  while (cut < bytes.length) {
    // 74 on continuation lines: the leading space counts toward the 75.
    let take = Math.min(cut === 0 ? 75 : 74, bytes.length - cut);
    // Never split a UTF-8 sequence: back off to a lead byte.
    while (take > 1 && (bytes[cut + take] & 0b1100_0000) === 0b1000_0000) {
      take -= 1;
    }
    parts.push(bytes.subarray(cut, cut + take).toString("utf8"));
    cut += take;
  }
  return parts.join("\r\n ");
}

/** "20260712" — the all-day form, read in UTC. */
function icalDate(date: Date): string {
  return toIsoDate(date).replace(/-/g, "");
}

function stamp(now: Date): string {
  return `${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
}

export type ExportEvent = {
  uid: string;
  start: Date;
  /** Exclusive, matching the database. Written out unchanged. */
  end: Date;
  summary: string;
};

/**
 * Builds an availability feed.
 *
 * Deliberately says nothing about who is staying. This URL is handed to
 * Airbnb, Booking.com and anyone who learns it, and the only thing they need
 * is which nights are gone. Guest names, prices and contact details stay in
 * the app.
 */
export function buildIcal({
  name,
  events,
  now = new Date(),
}: {
  name: string;
  events: ExportEvent[];
  now?: Date;
}): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TLSHost//Availability//VI",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    fold(`X-WR-CALNAME:${escapeText(name)}`),
  ];

  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      fold(`UID:${escapeText(event.uid)}`),
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${icalDate(event.start)}`,
      `DTEND;VALUE=DATE:${icalDate(event.end)}`,
      fold(`SUMMARY:${escapeText(event.summary)}`),
      "TRANSP:OPAQUE",
      "END:VEVENT",
    );
  }

  lines.push("END:VCALENDAR");

  // CRLF throughout and a trailing one: some readers are strict about it, and
  // the ones that are not do not mind.
  return lines.join("\r\n") + "\r\n";
}

/** Nights covered by an event, for reporting. */
export function nightsIn(event: { start: Date; end: Date }): number {
  return Math.round((event.end.getTime() - event.start.getTime()) / 86_400_000);
}

/** Re-exported so callers building export events can shift a date. */
export { addDays };

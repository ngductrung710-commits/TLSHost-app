"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { useT } from "@/components/I18nProvider";

import type { AssistantState, Drafted } from "@/app/(app)/tro-ly/actions";

/**
 * The assistant, docked to the right of every screen.
 *
 * It replaced a tab that linked to /tro-ly, and the reason is what a host is
 * doing when they want it: looking at the calendar, mid-thought about a room
 * and a set of nights. Navigating away to ask, then navigating back to see
 * whether it worked, loses the thing they were looking at — and losing it is
 * the reason the question was worth asking.
 *
 * What this is NOT is an agent with a keyboard. The model behind it has no
 * write path at all: it reads a snapshot and returns one structured proposal,
 * and the change only happens when the host presses Duyệt, through the same
 * availability check their own click goes through. A panel that looks like a
 * chat window invites the assumption that typing makes things happen, so the
 * footer says so in one line, every time.
 *
 * The thread here lives for as long as the panel is open. It is not the
 * record — /tro-ly is, and it reads from the database. Keeping the thread in
 * component state rather than refetching is what lets an answer arrive without
 * redrawing the calendar underneath it.
 */

const OPEN_KEY = "tlshost_assistant_open";

/**
 * Whether the panel is open, remembered across navigations.
 *
 * A module-level store read through useSyncExternalStore rather than an effect
 * that calls setState. The server has no localStorage, so the first render has
 * to say "closed" and the client has to correct it — and doing that correction
 * in an effect is both a cascading render and, since React 19, a lint error
 * that is right to complain.
 */
let openState = false;
let read = false;
const listeners = new Set<() => void>();

function subscribeOpen(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function openSnapshot(): boolean {
  if (!read) {
    try {
      openState = window.localStorage.getItem(OPEN_KEY) === "1";
    } catch {
      // A private window, or site data blocked. Closed is the right answer
      // when the question cannot be asked.
      openState = false;
    }
    read = true;
  }
  return openState;
}

/** What the server renders, before any of the above exists. */
function openServerSnapshot(): boolean {
  return false;
}

function writeOpen(next: boolean): void {
  openState = next;
  read = true;
  try {
    window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
  } catch {
    // The panel still works; it just will not be remembered.
  }
  for (const fn of listeners) fn();
}

type Turn =
  | { role: "host"; text: string }
  | { role: "assistant"; text: string; drafted?: Drafted | null };

function Send({ pending }: { pending: boolean }) {
  const t = useT();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={t("Gửi")}
      className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-sand-100 transition-opacity hover:opacity-90 disabled:opacity-40"
    >
      {pending ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <circle
            cx="12"
            cy="12"
            r="9"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeDasharray="14 42"
            strokeLinecap="round"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 12 12"
              to="360 12 12"
              dur="0.8s"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 19V5" />
          <path d="m5 12 7-7 7 7" />
        </svg>
      )}
    </button>
  );
}

export function AssistantPanel({
  action,
  approve,
  reject,
  enabled,
  configured,
  canUse,
  planHref,
}: {
  action: (prev: AssistantState, formData: FormData) => Promise<AssistantState>;
  approve: (formData: FormData) => Promise<void>;
  reject: (formData: FormData) => Promise<void>;
  /** The plan allows the assistant. */
  enabled: boolean;
  /** The server has an ANTHROPIC_API_KEY. */
  configured: boolean;
  /** The role allows it — a housekeeper does not get one. */
  canUse: boolean;
  /** Where upgrading happens, or null for anyone who cannot buy. */
  planHref: string | null;
}) {
  const t = useT();
  const open = useSyncExternalStore(subscribeOpen, openSnapshot, openServerSnapshot);
  const [thread, setThread] = useState<Turn[]>([]);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // The reply is appended where it arrives, not in an effect watching for it.
  // Both turns — the question and the answer — belong to the same submit, and
  // writing them in the same place is what keeps them in order when someone
  // asks twice quickly.
  const send = (formData: FormData) => {
    const text = String(formData.get("prompt") ?? "").trim();
    if (!text) return;
    setThread((prev) => [...prev, { role: "host", text }]);
    formRef.current?.reset();

    startTransition(async () => {
      const reply = await action({ error: null }, formData);
      setThread((prev) => [
        ...prev,
        reply.error
          ? { role: "assistant", text: reply.error }
          : {
              role: "assistant",
              text: reply.drafted?.summary ?? "",
              drafted: reply.drafted,
            },
      ]);
    });
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [thread]);

  if (!canUse) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => writeOpen(true)}
        aria-label={t("Mở trợ lý AI")}
        title={t("Mở trợ lý AI")}
        className="fixed right-0 top-1/2 z-35 hidden -translate-y-1/2 items-center rounded-l-full border border-r-0 border-line bg-ink-900 py-3 pl-3 pr-2 text-white shadow-lg transition-colors hover:bg-ink-800 md:flex"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
      </button>
    );
  }

  return (
    <aside
      aria-label={t("Trợ lý")}
      className="fixed inset-y-0 right-0 z-35 hidden w-[380px] flex-col border-l border-line bg-surface shadow-xl md:flex"
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-900 text-sand-100">
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8V4H8" />
            <rect width="16" height="12" x="4" y="8" rx="2" />
            <path d="M2 14h2" />
            <path d="M20 14h2" />
            <path d="M15 13v2" />
            <path d="M9 13v2" />
          </svg>
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-ink-900">
            {t("Trợ lý")}
          </p>
          <p className="text-[12px] text-ink-500">
            {enabled && configured ? t("Sẵn sàng") : t("Chưa hoạt động")}
          </p>
        </div>
        {thread.length > 0 ? (
          <button
            type="button"
            onClick={() => setThread([])}
            aria-label={t("Xoá cuộc trò chuyện")}
            title={t("Xoá cuộc trò chuyện")}
            className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
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
              <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
            </svg>
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => writeOpen(false)}
          aria-label={t("Đóng trợ lý")}
          title={t("Đóng trợ lý")}
          className="grid size-9 place-items-center rounded-full text-ink-500 hover:bg-sand-100 hover:text-ink-900"
        >
          <svg
            viewBox="0 0 24 24"
            width="17"
            height="17"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-5">
        {!enabled ? (
          <div className="grid h-full place-items-center px-2 text-center">
            <div>
              <p className="text-[15px] font-semibold text-ink-900">
                {t("Nâng cấp để mở khoá trợ lý")}
              </p>
              <p className="mx-auto mt-2 max-w-[17rem] text-[13.5px] leading-relaxed text-ink-600">
                {t("Trợ lý soạn sẵn thay đổi cho bạn duyệt. Gói hiện tại chưa có tính năng này.")}
              </p>
              {planHref ? (
                <Link
                  href={planHref}
                  className="mt-5 inline-flex min-h-11 items-center rounded-full bg-ink-900 px-6 text-[14px] font-semibold text-sand-100 hover:bg-ink-800"
                >
                  {t("Xem các gói")}
                </Link>
              ) : (
                <p className="mt-4 text-[13px] text-ink-500">
                  {t("Nhờ chủ tài khoản nâng gói.")}
                </p>
              )}
            </div>
          </div>
        ) : !configured ? (
          <div className="grid h-full place-items-center px-2 text-center">
            <p className="max-w-[17rem] text-[13.5px] leading-relaxed text-ink-600">
              {t("Máy chủ chưa đặt ANTHROPIC_API_KEY nên trợ lý chưa chạy. Những đề xuất đã có vẫn duyệt được bình thường.")}
            </p>
          </div>
        ) : thread.length === 0 ? (
          <div className="grid h-full place-items-center px-2 text-center">
            <div>
              <p className="text-[14px] font-medium text-ink-900">
                {t("Mô tả việc bạn cần bằng lời thường ngày.")}
              </p>
              <p className="mx-auto mt-2 max-w-[17rem] text-[13px] leading-relaxed text-ink-500">
                {t("Ví dụ: khoá Garden Suite từ 5 đến 8 tháng 12 để sơn lại phòng tắm.")}
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-4">
            {thread.map((turn, i) => (
              <li
                key={i}
                className={turn.role === "host" ? "flex justify-end" : ""}
              >
                {turn.role === "host" ? (
                  <p className="max-w-[85%] rounded-2xl rounded-br-sm bg-ink-900 px-3.5 py-2.5 text-[13.5px] leading-relaxed text-sand-100">
                    {turn.text}
                  </p>
                ) : (
                  <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-sand-50 px-3.5 py-2.5">
                    <p className="text-[13.5px] leading-relaxed text-ink-800">
                      {turn.text}
                    </p>
                    {turn.drafted ? (
                      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
                        <form action={approve}>
                          <input type="hidden" name="id" value={turn.drafted.id} />
                          <button
                            type="submit"
                            className="min-h-9 rounded-full bg-ink-900 px-4 text-[13px] font-semibold text-sand-100 hover:bg-ink-800"
                          >
                            {t("Duyệt")}
                          </button>
                        </form>
                        <form action={reject}>
                          <input type="hidden" name="id" value={turn.drafted.id} />
                          <button
                            type="submit"
                            className="min-h-9 rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-100"
                          >
                            {t("Bỏ qua")}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            ))}
            <div ref={endRef} />
          </ul>
        )}
      </div>

      <footer className="border-t border-line px-4 py-3">
        {enabled && configured ? (
          <form ref={formRef} action={send} className="flex items-end gap-2">
            <textarea
              name="prompt"
              rows={1}
              required
              minLength={3}
              maxLength={2000}
              placeholder={t("Nhắn cho trợ lý")}
              onKeyDown={(e) => {
                // Enter sends, Shift+Enter breaks the line. A textarea rather
                // than an input because a booking described in one sentence is
                // often two.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              className="max-h-32 min-h-9 flex-1 resize-none rounded-2xl border border-line-strong bg-white px-3.5 py-2 text-[14px] text-ink-900 outline-none focus-visible:border-ink-900"
            />
            <Send pending={pending} />
          </form>
        ) : null}

        <p className="mt-2.5 text-[11.5px] leading-relaxed text-ink-500">
          {t("Trợ lý chỉ soạn sẵn — không có gì được ghi vào lịch trước khi bạn bấm Duyệt.")}{" "}
          <Link href="/tro-ly" className="font-medium underline underline-offset-2 hover:text-ink-900">
            {t("Xem tất cả đề xuất")}
          </Link>
        </p>
      </footer>
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";

/**
 * Turning push notifications on, from this device.
 *
 * Everything here has to happen in the browser: the permission prompt, the
 * subscription, and the key exchange all belong to the browser's own push
 * service. The server only ever sees the result, which it stores through a
 * form the component submits itself.
 *
 * Written defensively because this is the least uniform API in the platform.
 * Safari only allows it in an installed app, Firefox on some builds refuses
 * silently, and every one of them fails in a different shape. The component
 * says which of those is happening rather than showing a button that does
 * nothing.
 */

type State =
  | { kind: "checking" }
  | { kind: "unsupported"; why: string }
  | { kind: "denied" }
  | { kind: "off" }
  | { kind: "on"; endpoint: string };

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function PushControls({
  publicKey,
  subscribeAction,
  unsubscribeAction,
  testAction,
  knownEndpoints,
}: {
  publicKey: string;
  subscribeAction: (formData: FormData) => Promise<void>;
  unsubscribeAction: (formData: FormData) => Promise<void>;
  testAction: () => Promise<void>;
  /** Endpoints the server already has, so we can tell "this device" apart. */
  knownEndpoints: string[];
}) {
  const [state, setState] = useState<State>({ kind: "checking" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (typeof window === "undefined") return;

      if (!("serviceWorker" in navigator)) {
        setState({ kind: "unsupported", why: "Trình duyệt này không hỗ trợ." });
        return;
      }
      if (!("PushManager" in window)) {
        // The usual case on iOS: Safari only exposes PushManager once the site
        // has been added to the home screen. Worth saying, because it is
        // fixable by the person reading it.
        const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        setState({
          kind: "unsupported",
          why: iOS
            ? "Trên iPhone cần thêm TLSHost vào Màn hình chính trước, rồi mở từ đó."
            : "Trình duyệt này không hỗ trợ thông báo đẩy.",
        });
        return;
      }
      if (Notification.permission === "denied") {
        setState({ kind: "denied" });
        return;
      }

      const reg = await navigator.serviceWorker.ready.catch(() => null);
      if (cancelled) return;
      if (!reg) {
        setState({ kind: "unsupported", why: "Chưa cài được service worker." });
        return;
      }

      const existing = await reg.pushManager.getSubscription();
      if (cancelled) return;

      // A subscription the browser has but the server does not is a stale one
      // — the row was deleted elsewhere. Treated as off, so the button
      // re-registers it rather than showing "on" for something that will
      // never arrive.
      if (existing && knownEndpoints.includes(existing.endpoint)) {
        setState({ kind: "on", endpoint: existing.endpoint });
      } else {
        setState({ kind: "off" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [knownEndpoints]);

  async function enable() {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState({ kind: permission === "denied" ? "denied" : "off" });
        return;
      }

      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          // Required by every browser now: a push that cannot be shown to a
          // person is not allowed to wake the app.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        }));

      const json = sub.toJSON();
      const form = new FormData();
      form.set("endpoint", sub.endpoint);
      form.set("p256dh", json.keys?.p256dh ?? "");
      form.set("auth", json.keys?.auth ?? "");
      form.set("userAgent", navigator.userAgent.slice(0, 300));

      await subscribeAction(form);
      setState({ kind: "on", endpoint: sub.endpoint });
    } catch {
      setState({ kind: "unsupported", why: "Không đăng ký được thông báo." });
    } finally {
      setBusy(false);
    }
  }

  async function disable(endpoint: string) {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      // Unsubscribed in the browser *and* removed on the server. Doing only
      // one leaves either a row that fails forever or a device that keeps
      // buzzing for a host who turned it off.
      await sub?.unsubscribe();

      const form = new FormData();
      form.set("endpoint", endpoint);
      await unsubscribeAction(form);
      setState({ kind: "off" });
    } finally {
      setBusy(false);
    }
  }

  if (state.kind === "checking") {
    return <p className="text-[14px] text-ink-500">Đang kiểm tra…</p>;
  }

  if (state.kind === "unsupported") {
    return (
      <p className="max-w-xl rounded-xl border border-line bg-sand-50 px-4 py-3 text-[13.5px] leading-relaxed text-ink-600">
        {state.why}
      </p>
    );
  }

  if (state.kind === "denied") {
    return (
      <p className="max-w-xl rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-[13.5px] leading-relaxed text-warning">
        Thiết bị này đã chặn thông báo từ TLSHost. Mở cài đặt của trình duyệt,
        cho phép lại rồi tải lại trang — nút ở đây không mở lại được, đó là
        chủ ý của trình duyệt.
      </p>
    );
  }

  if (state.kind === "off") {
    return (
      <button
        type="button"
        onClick={enable}
        disabled={busy}
        className="inline-flex min-h-11 items-center rounded-full bg-ink-900 px-5 text-[14px] font-semibold text-sand-100 hover:bg-ink-800 disabled:opacity-60"
      >
        {busy ? "Đang bật…" : "Bật thông báo trên thiết bị này"}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-positive-soft px-3 py-1.5 text-[13px] font-semibold text-positive">
        Đang bật trên thiết bị này
      </span>
      <form action={testAction}>
        <button
          type="submit"
          className="flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] font-medium text-ink-700 hover:bg-sand-50"
        >
          Gửi thử một thông báo
        </button>
      </form>
      <button
        type="button"
        onClick={() => disable(state.endpoint)}
        disabled={busy}
        className="min-h-11 px-3 text-[13px] font-medium text-danger hover:underline disabled:opacity-60"
      >
        Tắt
      </button>
    </div>
  );
}

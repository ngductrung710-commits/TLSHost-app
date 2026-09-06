import "server-only";

/**
 * Sending mail.
 *
 * Raw HTTP rather than an SDK, for the same reason src/lib/payments.ts talks
 * to Stripe and PayPal that way: this is one endpoint, and a client
 * constructed per call is most of what a library would give back.
 *
 * Resend because its send endpoint is a single POST with an API key, which
 * makes the whole transport the twenty lines below. It is not a commitment —
 * `deliver()` is the only function that knows the provider, and swapping it
 * for SMTP or a Vietnamese provider means rewriting that one function and
 * nothing else. Worth knowing before choosing: deliverability into Vietnamese
 * inboxes is something to measure with real sends, not to assume.
 *
 * Not configured is a supported state, not an error. Without a key the
 * message is written to the server log and reported as sent, so local
 * development has a working password-reset flow without an account anywhere —
 * the link is in the terminal. The alternative, throwing, turns a missing
 * environment variable into a five-hundred on a page a locked-out host is
 * using.
 */

const API = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

export type Mail = {
  to: string;
  subject: string;
  /** Plain text. Every message this product sends is short enough not to need HTML. */
  text: string;
};

export type MailResult = { ok: true } | { ok: false; error: string };

function from(): string {
  // A display name and an address on a domain the sender is allowed to use.
  // Getting this wrong is the usual reason a provider accepts the call and the
  // message still lands nowhere.
  return process.env.TLSHOST_MAIL_FROM || "TLSHost <noreply@tlshost.vn>";
}

/**
 * The provider. The only function here that knows which one.
 */
async function deliver(mail: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;

  if (!key) {
    // Deliberately loud, and deliberately not an error. In development this is
    // how you read the reset link; in production it is how you find out the
    // key was never set, without a host discovering it instead.
    console.warn(
      `[mail] RESEND_API_KEY chưa đặt — không gửi được. Nội dung:\n` +
        `  đến   : ${mail.to}\n` +
        `  chủ đề: ${mail.subject}\n` +
        mail.text
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n"),
    );
    return { ok: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from(),
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
      signal: controller.signal,
    });

    if (res.ok) return { ok: true };

    // The body is logged, never returned. A provider's rejection can name the
    // address it refused, and this string reaches a page that must not confirm
    // whether an address exists.
    console.error(`[mail] gửi hỏng ${res.status}: ${await res.text()}`);
    return { ok: false, error: `Nhà cung cấp email trả về ${res.status}.` };
  } catch (error) {
    console.error("[mail] không gọi được nhà cung cấp:", error);
    return { ok: false, error: "Không kết nối được tới dịch vụ email." };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send, and never throw.
 *
 * Callers are asked to decide what a failure means to them. For a password
 * reset the answer is "say the same thing either way", because telling a
 * visitor that delivery failed for this address tells them the address exists.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  return deliver(mail);
}

/** Whether a real send is possible. For a settings screen to report honestly. */
export function mailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

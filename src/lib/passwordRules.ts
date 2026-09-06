/**
 * The password rules, kept apart from the hashing.
 *
 * `passwords.ts` imports "server-only" — it has to, since a bundle that pulls
 * Argon2 into the browser is a build error at best. But the form that asks for
 * a new password is a client component, and it needs to say how long the
 * password must be. Importing the constant from there dragged the whole
 * server-only module into the client graph and broke the build.
 *
 * So the numbers and the sentence live here, where both sides can read them,
 * and nothing in this file touches a hash.
 */

/**
 * The rules shown to a person creating an account.
 *
 * A length floor and nothing else: composition rules ("one capital, one
 * symbol") push people toward `Password1!` and are no longer recommended by
 * NIST. Twelve characters of anything beats eight of theatre.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * The message, as a translation key rather than a finished sentence.
 *
 * It used to be a template literal with the number interpolated, which meant
 * check:i18n could not see it — that check reads quoted literals, and a
 * backtick is not a quote. So it had no English translation, and four
 * different flows showed a Vietnamese sentence to a host reading the
 * application in English. Callers fill the number in.
 */
export const PASSWORD_TOO_SHORT = "Mật khẩu cần ít nhất {n} ký tự.";

export function passwordProblem(plain: string): string | null {
  return plain.length < MIN_PASSWORD_LENGTH ? PASSWORD_TOO_SHORT : null;
}

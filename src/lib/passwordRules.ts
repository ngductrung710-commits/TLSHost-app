/**
 * The password rules, kept apart from the hashing.
 *
 * `passwords.ts` imports "server-only" — it has to, since a bundle that pulls
 * Argon2 into the browser is a build error at best. But the form that asks for
 * a new password is a client component, and it needs to say how long the
 * password must be. Importing the constant from there dragged the whole
 * server-only module into the client graph and broke the build.
 *
 * So the numbers and the sentences live here, where both sides can read them,
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
 * How many different characters a password must contain.
 *
 * Twelve characters of one letter is twelve characters. This is the cheapest
 * rule here and it removes the passwords a length floor alone invites:
 * aaaaaaaaaaaa, abababababab, 121212121212 — each of which is exactly long
 * enough and worth nothing.
 */
const MIN_DISTINCT = 5;

/* -------------------------------------------------------------------------- */
/* Messages                                                                    */
/* -------------------------------------------------------------------------- */
//
// Translation keys rather than finished sentences. The length one used to be a
// template literal with the number interpolated, which meant check:i18n could
// not see it — that check reads quoted literals, and a backtick is not a
// quote. So it had no English translation, and four different flows showed a
// Vietnamese sentence to a host reading the application in English.

export const PASSWORD_TOO_SHORT = "Mật khẩu cần ít nhất {n} ký tự.";
export const PASSWORD_TOO_PLAIN =
  "Mật khẩu này chỉ gồm vài ký tự lặp lại. Chọn mật khẩu khác.";
export const PASSWORD_SEQUENTIAL =
  "Mật khẩu này là một dãy liên tiếp trên bàn phím. Chọn mật khẩu khác.";
export const PASSWORD_TOO_COMMON =
  "Mật khẩu này quá dễ đoán. Chọn mật khẩu khác.";
export const PASSWORD_PERSONAL =
  "Mật khẩu không nên chứa tên hoặc email của bạn.";

/* -------------------------------------------------------------------------- */
/* The lists                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Common bases, not common passwords.
 *
 * NIST SP 800-63B asks for four screens: breached passwords, dictionary words,
 * repetitive or sequential characters, and context-specific words. This file
 * does the last three properly and the first one partially, and it is worth
 * saying which is which rather than implying a breach corpus that is not here.
 *
 * A twelve-character floor already removes almost every entry in a classic
 * top-ten-thousand list — those are six to nine characters. What survives the
 * floor is the same word with padding on the end: password1234, matkhau123456,
 * iloveyou2026. So the list holds the *base*, and the check below asks whether
 * the letters of a password are essentially just one of these.
 *
 * Vietnamese entries are here because this product's users type Vietnamese.
 * A list built only from English leaks matkhau and xinchao straight through.
 */
const COMMON_BASES = [
  "password", "passwd", "pass", "matkhau", "matkhaucua", "khaumat",
  "iloveyou", "loveyou", "anhyeuem", "emyeuanh", "yeuem", "yeuanh",
  "qwerty", "asdfgh", "zxcvbn", "letmein", "welcome", "admin", "administrator",
  "login", "abcdef", "monkey", "dragon", "sunshine", "princess", "shadow",
  "football", "baseball", "superman", "batman", "trustno", "master",
  "xinchao", "chaoban", "vietnam", "vietname", "hanoi", "saigon", "danang",
  "haiphong", "hochiminh", "thanhpho", "khachsan", "homestay", "nhanghi",
  "chunha", "quanly", "chudnha",
];

/**
 * Context-specific words, in NIST's sense: the name of the service.
 *
 * Anywhere in the password, not just as the whole of it. "tlshost2026!!" is a
 * password a stranger guesses on the second try, and it is long enough and
 * varied enough to pass every other rule in this file.
 */
const SITE_WORDS = ["tlshost", "tlshostvn"];

/**
 * Walks a keyboard or the alphabet takes, written out so a substring test can
 * find them. The digits repeat because 123456789012 runs off the end of one
 * decade and back into the next, and that is a real password people choose.
 */
const WALKS = [
  "01234567890123456789012345678901234567890",
  "qwertyuiopasdfghjklzxcvbnm",
  "abcdefghijklmnopqrstuvwxyz",
];

/* -------------------------------------------------------------------------- */
/* Checking                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Lowercase, and undo the substitutions people reach for first.
 *
 * P@ssw0rd is not a different password from password; it is the same password
 * with the same shape, and every cracking dictionary has applied these
 * substitutions since the nineties. Folding them here is what stops the list
 * above from being trivially stepped around.
 */
/**
 * Chữ thường, bỏ dấu. Không đụng tới chữ số.
 *
 * Bỏ dấu vì nếu không thì tên "Trần Bảo Long" tách ra thành tr, n, b, o, long
 * — bốn mảnh quá ngắn để đem so, và luật "không được chứa tên bạn" lặng lẽ
 * chỉ còn hiệu lực với những cái tên không dấu.
 */
function plainFold(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function fold(text: string): string {
  return plainFold(text)
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4@]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t");
}

const reverse = (text: string): string => [...text].reverse().join("");

/** Is the whole password just a run along a keyboard row or the alphabet? */
function isWalk(folded: string): boolean {
  return WALKS.some(
    (walk) => walk.includes(folded) || reverse(walk).includes(folded),
  );
}

/**
 * Is this a common word with padding stuck on?
 *
 * The letters are pulled out and compared to the bases; the digits and symbols
 * around them are exactly what somebody adds to clear a length rule, so they
 * are not evidence of anything. Two characters of slack, no more — otherwise
 * "mypasswordisalongone" would match "password" and a perfectly good
 * passphrase would be refused.
 */
function isPaddedCommon(plain: string): boolean {
  // The padding is cut off the ends BEFORE folding, and the order matters.
  // Folding first turns 1234 into iaea, which are letters, so P@ssw0rd1234
  // ends up an eleven-letter word that matches nothing — measured, and it was
  // the first thing this function got wrong. Padding lives on the ends, which
  // is what makes it strippable at all.
  const core = plain.replace(/^[^a-zA-Z]+/, "").replace(/[^a-zA-Z]+$/, "");
  const letters = fold(core).replace(/[^a-z]/g, "");
  if (letters.length === 0) return false;

  return COMMON_BASES.some(
    (base) =>
      letters.length - base.length <= 2 &&
      (letters === base || letters.startsWith(base) || letters.endsWith(base)),
  );
}

/** Words from an email address or a person's name, long enough to matter. */
function personalWords(context: PasswordContext): string[] {
  const source = [context.email?.split("@")[0] ?? "", context.name ?? ""].join(" ");
  return fold(source)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4);
}

/**
 * What the caller knows about whose password this is.
 *
 * Optional, and the check is honest about being weaker without it — a form
 * that has the email and does not pass it here simply loses one rule. Every
 * flow in this app has at least the email by the time it validates a password,
 * so there is no reason not to.
 */
export type PasswordContext = {
  email?: string | null;
  name?: string | null;
};

export function passwordProblem(
  plain: string,
  context: PasswordContext = {},
): string | null {
  if (plain.length < MIN_PASSWORD_LENGTH) return PASSWORD_TOO_SHORT;

  // Hai cách chuẩn hoá, dùng vào hai việc khác nhau, và lẫn chúng là một lỗi
  // thật: leet-fold biến 1 thành i, 3 thành e, 5 thành s — nên "123456789012"
  // sau khi fold là "i2eas6t89oi2" và không còn giống một dãy số nào nữa.
  // Phép so dãy phải chạy trên bản chưa đổi chữ số; chỉ phép so với danh sách
  // từ mới cần leet-fold, vì ở đó P@ssw0rd và password đúng là một thứ.
  const plainly = plainFold(plain);
  const folded = fold(plain);

  if (new Set(plainly).size < MIN_DISTINCT) return PASSWORD_TOO_PLAIN;

  if (isWalk(plainly)) return PASSWORD_SEQUENTIAL;
  if (SITE_WORDS.some((word) => folded.includes(word))) return PASSWORD_TOO_COMMON;
  if (isPaddedCommon(plain)) return PASSWORD_TOO_COMMON;

  // Không chỉ hỏi "tên có nằm trong đó không" mà "tên có chiếm phần đáng kể
  // không". Hỏi cách thứ nhất thì "mypasswordisalongone" bị từ chối vì trong
  // chữ "along" có "long", trùng một mảnh của tên Trần Bảo Long — một câu
  // hoàn toàn tử tế bị chặn vì một sự tình cờ. Đo được: chính nó làm hỏng
  // phần kiểm tra mật khẩu tốt, và đó là lý do phần đó tồn tại.
  //
  // Một phần tư là ngưỡng: "baolong-2026-ab" thì "long" chiếm 27%, còn trong
  // một câu hai mươi ký tự thì nó chỉ là 20% và là chuyện ngẫu nhiên.
  const personal = personalWords({
    email: context.email ?? undefined,
    name: context.name ?? undefined,
  });
  const substantial = personal.some(
    (word) => folded.includes(word) && word.length * 4 >= folded.length,
  );
  if (substantial) return PASSWORD_PERSONAL;

  return null;
}

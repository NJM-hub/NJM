/** 메모에서 메신저 연락처(WHATSAPP·WECHAT·KAKAO·LINE 등)를 뽑아 전화번호와 함께 보여준다 */
const MESSENGER = /^(whatsapp|wechat|kakao(?:talk)?|line|telegram|viber|微信|카카오톡?|라인|https?:\/\/(?:line\.me|wa\.me|t\.me)\S*)/i;

export function splitContact(phone: string | null | undefined, memo: string | null | undefined): { contact: string | null; memo: string | null } {
  const parts = (memo ?? "").split(" / ").map((s) => s.trim()).filter(Boolean);
  const messengers = parts.filter((p) => MESSENGER.test(p));
  const rest = parts.filter((p) => !MESSENGER.test(p));
  const contact = [phone ? `☎ ${phone}` : null, ...messengers].filter(Boolean).join(" / ");
  return { contact: contact || null, memo: rest.join(" / ") || null };
}

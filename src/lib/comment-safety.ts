export function normalizeComment(text: string) {
  return text
    .normalize("NFKC")
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}
export function commentSafetyError(text: string): string | undefined {
  const normalized = normalizeComment(text);
  const digits = normalized.replace(/[٠-٩۰-۹]/g, (c) =>
    String(
      "٠١٢٣٤٥٦٧٨٩".includes(c)
        ? "٠١٢٣٤٥٦٧٨٩".indexOf(c)
        : "۰۱۲۳۴۵۶۷۸۹".indexOf(c),
    ),
  );
  if (
    /(?:\+?\d[\s().\-/]*){7,}/.test(digits) ||
    /[\w.+-]+\s*@\s*[\w.-]+/iu.test(normalized) ||
    /\b\w+\s*(?:\[at\]|\(at\))\s*\w+/iu.test(normalized)
  )
    return "حيد أرقام الهاتف والإيميلات والمعلومات الشخصية.";
  if (
    /(?:https?|hxxps?|ftp|javascript|data)\s*:|www\s*\.|[<>]|(?:[\p{L}\d-]+\.)+(?:[a-z]{2,24}|xn--[a-z\d-]+)(?:\b|\/)|(?:\[dot\]|\(dot\))/iu.test(
      normalized,
    )
  )
    return "الروابط غير مسموحة فالتعليقات أو الاسم المستعار.";
  const folded = normalized
    .toLowerCase()
    .replace(/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u0640]/g, "")
    .replace(/[أإآ]/g, "ا");
  if (
    /(قحبة|شرموط|نقتلك|غادي نقتلك|ساقتلك|سوف اقتلك|نذبحك|fuck|nigger|kike|\bputain\b|\bsalope\b|kill\s+you|je\s+vais\s+te\s+tuer)/iu.test(
      folded,
    )
  )
    return "السب والتهديد وخطاب الكراهية ممنوع.";
}

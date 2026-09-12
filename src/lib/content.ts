import { z } from "zod";
export const stopSchema = z
  .string()
  .transform((s) =>
    s
      .normalize("NFKC")
      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim(),
  )
  .pipe(
    z
      .string()
      .min(12, "كتب فكرة واضحة، على الأقل 12 حرف.")
      .max(400, "الحد الأقصى هو 400 حرف."),
  );
export function validateContent(input: unknown) {
  const result = stopSchema.safeParse(input);
  if (!result.success) return { error: result.error.issues[0].message };
  const text = result.data;
  const digits = text.replace(/[٠-٩۰-۹]/g, (c) =>
    String(
      "٠١٢٣٤٥٦٧٨٩".includes(c)
        ? "٠١٢٣٤٥٦٧٨٩".indexOf(c)
        : "۰۱۲۳۴۵۶۷۸۹".indexOf(c),
    ),
  );
  if (
    /[\w.+-]+\s*@\s*[\w.-]+|https?:|www\.|<|>|@[\p{L}\w]/iu.test(text) ||
    /(?:\+?\d[\s().-]*){7,}/.test(digits)
  )
    return { error: "حيد أرقام الهاتف، الروابط والمعلومات الشخصية." };
  if (
    /(زنقة|شارع|حي)\s+.{0,35}(رقم|منزل|دار)|(?:السيد|السيدة|فلان|فلانة)\s+\S+|\b(?:Mr|Mme|Monsieur)\b/iu.test(
      text,
    )
  )
    return { error: "كتب على السلوك بلا أسماء أو عناوين شخصية." };
  if (/(ولد القحبة|قحبة|شرموط|نقتلك|غادي نقتلك|fuck|nigger)/iu.test(text))
    return { error: "السب والتهديد وخطاب الكراهية ممنوع." };
  return { text };
}
export function inferCategory(text: string) {
  if (/طريق|سياقة|طوموبيل|سائق|سير|كلاكسون/.test(text)) return "road";
  if (/زب[ال]|نفايات|بيئة|شجر|بلاستيك|تلوث/.test(text)) return "environment";
  if (/إدار|ادار|وثائق|رشوة|موظف/.test(text)) return "administration";
  if (/رياض|كورة|كرة|ملعب|شغب/.test(text)) return "sport";
  return "society";
}
export const categories: Record<string, string> = {
  society: "المجتمع",
  road: "الطريق",
  environment: "البيئة",
  administration: "الإدارة",
  sport: "الرياضة",
  other: "أخرى",
};
export type Stop = {
  id: string;
  text: string;
  category: string;
  status: string;
  votes_count: number;
  created_at: string;
  updated_at: string;
};
export const number = (n: number) => new Intl.NumberFormat("ar-MA").format(n);

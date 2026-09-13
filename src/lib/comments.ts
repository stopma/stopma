import { z } from "zod";
import { commentSafetyError, normalizeComment } from "./comment-safety";
const safeText = (max: number, empty: string, tooLong: string) =>
  z
    .string()
    .transform(normalizeComment)
    .pipe(z.string().min(1, empty).max(max, tooLong))
    .superRefine((text, ctx) => {
      const error = commentSafetyError(text);
      if (error) ctx.addIssue({ code: "custom", message: error });
    });

export const commentInput = z.object({
  stop_id: z.uuid(),
  display_name: safeText(
    40,
    "كتب الاسم المستعار.",
    "الاسم المستعار طويل بزاف.",
  ),
  content: safeText(
    300,
    "كتب التعليق ديالك.",
    "التعليق خاصو ما يفوتش 300 حرف.",
  ),
  website: z.string().max(0).optional(),
});
export function commenterLabel(code: string) {
  return "#" + code.replaceAll("-", "").slice(0, 12).toUpperCase();
}
export type PublicComment = {
  id: string;
  content: string;
  display_name: string;
  commenter_code: string;
  created_at: string;
};

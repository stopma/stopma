import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin, auth, configured, limit, sameOrigin } from "@/lib/server";
import { commentInput } from "@/lib/comments";
export const runtime = "nodejs";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const requestSchema = z.object({
  id: z.uuid(),
  updated_at: z.iso.datetime({ offset: true }),
  action: z.enum(["approve", "reject", "edit", "delete"]),
});
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "طلب غير مسموح." }, 403);
  if (!configured()) return reply({ error: "الخدمة غير متاحة مؤقتاً." }, 503);
  try {
    const user = await admin();
    if (!user) return reply({ error: "خاصك تسجل الدخول." }, 401);
    if (!(await limit(req, "comment-moderation", 120, 60, user.id)))
      return reply({ error: "محاولات كثيرة. عاود من بعد شوية." }, 429);
    if (Number(req.headers.get("content-length") || 0) > 4096)
      return reply({ error: "طلب كبير جداً." }, 413);
    const raw = await req.text();
    if (raw.length > 4096) return reply({ error: "طلب كبير جداً." }, 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "طلب غير صالح." }, 400);
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return reply({ error: "طلب غير صالح." }, 400);
    const { id, action, updated_at } = parsed.data;
    // Use the admin session's JWT: comments RLS remains enforced on mutations.
    const client = await auth();
    let mutation;
    if (action === "delete") mutation = client.from("comments").delete();
    else if (action === "reject")
      mutation = client.from("comments").update({ status: "rejected" });
    else {
      const text = commentInput
        .pick({ content: true, display_name: true })
        .safeParse(body);
      if (!text.success)
        return reply({ error: text.error.issues[0].message }, 400);
      mutation = client.from("comments").update({
        ...text.data,
        ...(action === "edit"
          ? {}
          : { status: action === "approve" ? "approved" : "rejected" }),
      });
    }
    const { data, error } = await mutation
      .eq("id", id)
      .eq("updated_at", updated_at)
      .select("id,stop_id")
      .maybeSingle();
    if (error) {
      if (error.code === "23505")
        return reply({ error: "هاد النص موجود من قبل لنفس STOP." }, 409);
      throw error;
    }
    if (!data)
      return reply({ error: "التعليق تبدّل أو تحذف. عاود تحميل الصفحة." }, 409);
    revalidatePath("/stop/" + data.stop_id);
    revalidatePath("/admin");
    return reply({ ok: true });
  } catch {
    return reply({ error: "تعذر حفظ التغيير. عاود المحاولة." }, 500);
  }
}

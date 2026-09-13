import { NextRequest, NextResponse } from "next/server";
import { configured, db, limit, sameOrigin } from "@/lib/server";
import { commentIdentity } from "@/lib/comments-server";
import { commenterLabel, commentInput } from "@/lib/comments";

export const runtime = "nodejs";
const reply = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  if (!configured())
    return reply({ error: "التعليقات غير متاحة مؤقتاً." }, 503);
  try {
    return reply({ code: commenterLabel(await commentIdentity()) });
  } catch {
    return reply({ error: "تعذر تجهيز معرف التعليق. عاود المحاولة." }, 503);
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return reply({ error: "طلب غير مسموح." }, 403);
  if (!configured() || process.env.SITE_LAUNCH_READY !== "true")
    return reply({ error: "إرسال التعليقات غير متاح حالياً." }, 503);
  try {
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
    const parsed = commentInput.safeParse(body);
    if (!parsed.success)
      return reply(
        { error: parsed.error.issues[0]?.message || "راجع بيانات التعليق." },
        400,
      );
    const code = await commentIdentity();
    if (
      !(await limit(req, "comment-ip", 20, 3600)) ||
      !(await limit(req, "comment-device", 5, 3600, code))
    )
      return reply(
        { error: "وصلتي للحد المؤقت ديال التعليقات. عاود من بعد." },
        429,
      );
    const { error } = await db().from("comments").insert({
      stop_id: parsed.data.stop_id,
      content: parsed.data.content,
      display_name: parsed.data.display_name,
      commenter_code: code,
      status: "pending",
    });
    if (error) {
      if (error.code === "23505")
        return reply({ error: "هاد التعليق ترسل من قبل." }, 409);
      if (error.message.includes("comment_rate_limited"))
        return reply(
          { error: "وصلتي للحد المؤقت ديال التعليقات. عاود من بعد." },
          429,
        );
      if (
        error.message.includes("comment_stop_unavailable") ||
        error.code === "23503"
      )
        return reply({ error: "هاد STOP ما بقاش متاح." }, 404);
      if (error.code === "23514")
        return reply({ error: "راجع التعليق والاسم المستعار." }, 400);
      throw error;
    }
    return reply(
      {
        message: "وصل التعليق ديالك. غادي يبان من بعد الموافقة عليه.",
        code: commenterLabel(code),
      },
      201,
    );
  } catch {
    return reply(
      { error: "وقع مشكل مؤقت. التعليق ما تأكدش إرساله، عاود المحاولة." },
      500,
    );
  }
}

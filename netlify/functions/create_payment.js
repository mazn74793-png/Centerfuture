import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

    const body = JSON.parse(event.body || "{}");
    const user_id = Number(body.user_id || 0);
    const course_id = Number(body.course_id || 0);
    const method = (body.method || "").trim(); // vodafone | instapay
    const amount = body.amount ?? null;
    const receipt_note = (body.receipt_note || "").trim(); // رقم عملية / ملاحظة

    if (!user_id || !course_id || !method) {
      return json(400, { ok: false, error: "Missing fields" });
    }

    // سجل طلب الدفع pending
    const r = await sql`
      insert into payments (user_id, course_id, method, amount, status, receipt_note)
      values (${user_id}, ${course_id}, ${method}, ${amount}, 'pending', ${receipt_note || null})
      returning id, status, created_at;
    `;

    return json(200, { ok: true, payment: r[0] });
  } catch (e) {
    console.error("create_payment:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

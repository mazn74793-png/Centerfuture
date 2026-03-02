import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    const user_id = Number(event.queryStringParameters?.user_id || 0);
    const course_id = Number(event.queryStringParameters?.course_id || 0);
    if (!user_id || !course_id) return json(400, { ok: false, error: "user_id & course_id required" });

    const rows = await sql`
      select id, status, created_at
      from payments
      where user_id=${user_id} and course_id=${course_id} and status='approved'
      order by id desc
      limit 1;
    `;

    return json(200, { ok: true, approved: rows.length > 0, approved_payment: rows[0] || null });
  } catch (e) {
    console.error("access_check:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const status = (event.queryStringParameters?.status || "pending").trim(); // pending/approved/rejected

      const rows = await sql`
        select
          p.id, p.status, p.method, p.amount, p.receipt_note, p.created_at,
          p.user_id, u.full_name, u.phone_student, u.grade,
          p.course_id, c.title as course_title, c.subject, c.teacher_name
        from payments p
        join users u on u.id = p.user_id
        left join courses c on c.id = p.course_id
        where p.status = ${status}
        order by p.id desc
        limit 200;
      `;
      return json(200, { ok: true, payments: rows });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const id = Number(body.id || 0);
      const action = (body.action || "").trim(); // approve | reject
      if (!id || !action) return json(400, { ok: false, error: "Missing fields" });

      const newStatus = action === "approve" ? "approved" : "rejected";
      const r = await sql`
        update payments
        set status=${newStatus}
        where id=${id}
        returning id, status;
      `;
      return json(200, { ok: true, payment: r[0] || null });
    }

    return json(405, { ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("admin_payments:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

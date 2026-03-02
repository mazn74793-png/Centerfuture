import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    const grade = (event.queryStringParameters?.grade || "").trim();
    if (!grade) return json(400, { ok: false, error: "grade required" });

    const rows = await sql`
      select id, grade, subject, title, teacher_name, is_active
      from courses
      where grade=${grade} and is_active=true
      order by id desc;
    `;
    return json(200, { ok: true, courses: rows });
  } catch (e) {
    console.error("public_courses:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

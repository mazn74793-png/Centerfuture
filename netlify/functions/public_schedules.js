import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    const course_id = Number(event.queryStringParameters?.course_id || 0);
    if (!course_id) return json(400, { ok: false, error: "course_id required" });

    const rows = await sql`
      select id, course_id, day_of_week, start_time, end_time, notes
      from schedules
      where course_id=${course_id}
      order by id desc;
    `;
    return json(200, { ok: true, schedules: rows });
  } catch (e) {
    console.error("public_schedules:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

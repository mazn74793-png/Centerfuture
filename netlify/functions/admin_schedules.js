import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const course_id = Number(event.queryStringParameters?.course_id || 0);
      if (!course_id) return json(400, { ok: false, error: "course_id required" });

      const rows = await sql`
        select id, course_id, day_of_week, start_time, end_time, notes
        from schedules
        where course_id=${course_id}
        order by id desc;
      `;
      return json(200, { ok: true, schedules: rows });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      const id = body.id ? Number(body.id) : null;
      const course_id = Number(body.course_id || 0);
      const day_of_week = (body.day_of_week || "").trim();
      const start_time = (body.start_time || "").trim();
      const end_time = (body.end_time || "").trim();
      const notes = (body.notes || "").trim();

      if (!course_id || !day_of_week || !start_time || !end_time) {
        return json(400, { ok: false, error: "Missing fields" });
      }

      if (!id) {
        const r = await sql`
          insert into schedules (course_id, day_of_week, start_time, end_time, notes)
          values (${course_id}, ${day_of_week}, ${start_time}, ${end_time}, ${notes || null})
          returning id, course_id, day_of_week, start_time, end_time, notes;
        `;
        return json(200, { ok: true, schedule: r[0] });
      } else {
        const r = await sql`
          update schedules
          set day_of_week=${day_of_week}, start_time=${start_time}, end_time=${end_time}, notes=${notes || null}
          where id=${id} and course_id=${course_id}
          returning id, course_id, day_of_week, start_time, end_time, notes;
        `;
        return json(200, { ok: true, schedule: r[0] || null });
      }
    }

    if (event.httpMethod === "DELETE") {
      const body = JSON.parse(event.body || "{}");
      const id = Number(body.id || 0);
      if (!id) return json(400, { ok: false, error: "id required" });

      await sql`delete from schedules where id=${id};`;
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("admin_schedules error:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

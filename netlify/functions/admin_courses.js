import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    if (event.httpMethod === "GET") {
      const grade = (event.queryStringParameters?.grade || "").trim(); // optional
      const subject = (event.queryStringParameters?.subject || "").trim(); // optional

      let rows;
      if (grade && subject) {
        rows = await sql`
          select id, grade, subject, title, teacher_name, is_active
          from courses
          where grade=${grade} and subject=${subject}
          order by id desc;
        `;
      } else if (grade) {
        rows = await sql`
          select id, grade, subject, title, teacher_name, is_active
          from courses
          where grade=${grade}
          order by id desc;
        `;
      } else {
        rows = await sql`
          select id, grade, subject, title, teacher_name, is_active
          from courses
          order by id desc;
        `;
      }

      return json(200, { ok: true, courses: rows });
    }

    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");

      const id = body.id ? Number(body.id) : null;
      const grade = (body.grade || "").trim();
      const subject = (body.subject || "").trim();
      const title = (body.title || "").trim();
      const teacher_name = (body.teacher_name || "").trim();
      const is_active = body.is_active === false ? false : true;

      if (!grade || !subject || !title || !teacher_name) {
        return json(400, { ok: false, error: "Missing fields" });
      }

      if (!id) {
        const r = await sql`
          insert into courses (grade, subject, title, teacher_name, is_active)
          values (${grade}, ${subject}, ${title}, ${teacher_name}, ${is_active})
          returning id, grade, subject, title, teacher_name, is_active;
        `;
        return json(200, { ok: true, course: r[0] });
      } else {
        const r = await sql`
          update courses
          set grade=${grade}, subject=${subject}, title=${title}, teacher_name=${teacher_name}, is_active=${is_active}
          where id=${id}
          returning id, grade, subject, title, teacher_name, is_active;
        `;
        return json(200, { ok: true, course: r[0] || null });
      }
    }

    return json(405, { ok: false, error: "Method not allowed" });
  } catch (e) {
    console.error("admin_courses error:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

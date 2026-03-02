import { sql, json } from "./_db.js";

export async function handler(event) {
  try {
    const user_id = Number(event.queryStringParameters?.user_id || 0);
    const course_id = Number(event.queryStringParameters?.course_id || 0);
    if (!user_id || !course_id) return json(400, { ok: false, error: "user_id & course_id required" });

    // هل Approved؟
    const okPay = await sql`
      select 1
      from payments
      where user_id=${user_id} and course_id=${course_id} and status='approved'
      limit 1;
    `;
    if (okPay.length === 0) return json(403, { ok: false, error: "Not approved yet" });

    // هات بيانات الكورس عشان نجيب فيديوهات grade+subject
    const course = await sql`
      select id, grade, subject, title
      from courses
      where id=${course_id}
      limit 1;
    `;
    if (course.length === 0) return json(404, { ok: false, error: "Course not found" });

    const c = course[0];

    const videos = await sql`
      select id, grade, subject, title, youtube_url, order_index, is_active
      from video_library
      where grade=${c.grade} and subject=${c.subject} and is_active=true
      order by order_index asc, id asc;
    `;

    return json(200, { ok: true, course: c, videos });
  } catch (e) {
    console.error("public_videos:", e);
    return json(500, { ok: false, error: "Server error" });
  }
}

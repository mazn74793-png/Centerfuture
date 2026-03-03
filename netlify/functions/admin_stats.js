import { sql, json } from "./_db.js";

export async function handler() {
  try {
    const [users] = await sql`select count(*)::int as n from users;`;
    const [courses] = await sql`select count(*)::int as n from courses;`;
    const [schedules] = await sql`select count(*)::int as n from schedules;`;

    const [pending] = await sql`select count(*)::int as n from payments where status='pending';`;
    const [approved] = await sql`select count(*)::int as n from payments where status='approved';`;
    const [rejected] = await sql`select count(*)::int as n from payments where status='rejected';`;

    const latestUsers = await sql`
      select id, full_name, phone_student, phone_parent, grade, role, created_at
      from users
      order by id desc
      limit 10;
    `;

    const latestPayments = await sql`
      select
        p.id, p.status, p.method, p.amount, p.receipt_note, p.created_at,
        u.full_name, u.phone_student, u.grade,
        c.title as course_title, c.subject, c.teacher_name
      from payments p
      join users u on u.id = p.user_id
      left join courses c on c.id = p.course_id
      order by p.id desc
      limit 10;
    `;

    return json(200, {
      ok: true,
      counts: {
        users: users?.n ?? 0,
        courses: courses?.n ?? 0,
        schedules: schedules?.n ?? 0,
        pending: pending?.n ?? 0,
        approved: approved?.n ?? 0,
        rejected: rejected?.n ?? 0,
      },
      latestUsers,
      latestPayments,
    });
  } catch (e) {
    return json(500, { ok: false, error: "Server error", details: String(e?.message || e) });
  }
}

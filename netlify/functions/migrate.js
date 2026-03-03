import { sql, json } from "./_db.js";

export async function handler() {
  try {
    // 1) sanity check
    await sql`select 1 as ok;`;

    // 2) tables (idempotent: safe to run multiple times)
    await sql`
      create table if not exists users (
        id bigserial primary key,
        full_name text not null,
        phone_student text not null,
        phone_parent text not null,
        grade text not null,
        username text,
        password_hash text,
        role text not null default 'student', -- student | admin | super_admin
        created_at timestamptz not null default now()
      );
    `;

    await sql`
      create unique index if not exists users_phone_student_uniq
      on users (phone_student);
    `;

    await sql`
      create table if not exists courses (
        id bigserial primary key,
        grade text not null,
        subject text not null, -- Math | English
        title text not null,
        teacher_name text not null,
        price int,
        is_active boolean not null default true,
        created_at timestamptz not null default now()
      );
    `;

    await sql`
      create index if not exists courses_grade_subject_idx
      on courses (grade, subject);
    `;

    await sql`
      create table if not exists schedules (
        id bigserial primary key,
        course_id bigint not null references courses(id) on delete cascade,
        day_of_week text not null, -- Sat/Sun/Mon...
        start_time text not null,  -- "18:00"
        end_time text not null,    -- "20:00"
        notes text,
        created_at timestamptz not null default now()
      );
    `;

    await sql`
      create index if not exists schedules_course_idx
      on schedules(course_id);
    `;

    await sql`
      create table if not exists payments (
        id bigserial primary key,
        user_id bigint not null references users(id) on delete cascade,
        course_id bigint references courses(id) on delete set null,
        method text not null, -- vodafone_cash | instapay
        amount int,
        status text not null default 'pending', -- pending | approved | rejected
        receipt_note text,
        created_at timestamptz not null default now()
      );
    `;

    await sql`
      create index if not exists payments_status_idx
      on payments(status);
    `;

    await sql`
      create index if not exists payments_user_course_idx
      on payments(user_id, course_id);
    `;

    await sql`
      create table if not exists video_library (
        id bigserial primary key,
        grade text not null,
        subject text not null, -- Math | English
        title text not null,
        youtube_url text not null,
        order_index int not null default 0,
        is_active boolean not null default true,
        created_at timestamptz not null default now()
      );
    `;

    await sql`
      create index if not exists video_grade_subject_idx
      on video_library(grade, subject);
    `;

    // 3) seed minimal data if empty
    const [c] = await sql`select count(*)::int as n from courses;`;
    if ((c?.n ?? 0) === 0) {
      await sql`
        insert into courses (grade, subject, title, teacher_name, price, is_active)
        values
          ('3prep','Math','Math تأسيس','Mr. Ahmed',200,true),
          ('3prep','English','English تأسيس','Ms. Farah',200,true),
          ('1sec','Math','Math مراجعة','Mr. Karim',250,true),
          ('1sec','English','English Grammar','Ms. Farah',250,true)
      `;
    }

    const [v] = await sql`select count(*)::int as n from video_library;`;
    if ((v?.n ?? 0) === 0) {
      await sql`
        insert into video_library (grade, subject, title, youtube_url, order_index, is_active)
        values
          ('3prep','Math','فيديو 1 (تجربة)','https://www.youtube.com/watch?v=dQw4w9WgXcQ',1,true),
          ('3prep','Math','فيديو 2 (تجربة)','https://www.youtube.com/watch?v=dQw4w9WgXcQ',2,true),
          ('3prep','English','فيديو 1 (تجربة)','https://www.youtube.com/watch?v=dQw4w9WgXcQ',1,true)
      `;
    }

    return json(200, { ok: true, msg: "Migration OK ✅" });
  } catch (e) {
    // IMPORTANT: return the real error so we can debug instantly
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
      body: JSON.stringify({
        ok: false,
        error: "Migration failed",
        details: String(e?.message || e),
        stack: String(e?.stack || ""),
      }),
    };
  }
}

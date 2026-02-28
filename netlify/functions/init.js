import { sql, json } from "./_db.js";

export async function handler() {
  // جداول أساسية
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      full_name TEXT NOT NULL,
      phone_student TEXT NOT NULL UNIQUE,
      phone_parent TEXT,
      grade TEXT NOT NULL,
      username TEXT UNIQUE,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student', -- student | superadmin
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS courses (
      id BIGSERIAL PRIMARY KEY,
      grade TEXT NOT NULL,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      teacher_name TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS schedules (
      id BIGSERIAL PRIMARY KEY,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      notes TEXT
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      method TEXT NOT NULL,
      amount NUMERIC,
      status TEXT NOT NULL DEFAULT 'pending',
      receipt_note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS video_library (
      id BIGSERIAL PRIMARY KEY,
      grade TEXT NOT NULL,
      subject TEXT NOT NULL,
      title TEXT NOT NULL,
      youtube_url TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      order_index INT NOT NULL DEFAULT 0
    );
  `;

  // Seed بسيط لو مفيش كورسات
  const c = await sql`SELECT COUNT(*)::int AS n FROM courses;`;
  if (c[0].n === 0) {
    await sql`
      INSERT INTO courses (grade, subject, title, teacher_name) VALUES
      ('3prep','Math','Math Basics','Mr. Ali'),
      ('3prep','English','Grammar Starter','Ms. Sara'),
      ('1sec','Math','Algebra 1','Mr. Karim'),
      ('1sec','English','Reading Skills','Ms. Mona'),
      ('2sec','Math','Functions','Mr. Omar'),
      ('2sec','English','Writing','Ms. Nour'),
      ('3sec','Math','Revision','Mr. Hany'),
      ('3sec','English','Exam Prep','Ms. Reem');
    `;

    await sql`
      INSERT INTO video_library (grade, subject, title, youtube_url, order_index) VALUES
      ('3prep','Math','Intro Lesson','https://www.youtube.com/watch?v=dQw4w9WgXcQ',1),
      ('1sec','English','Reading 1','https://www.youtube.com/watch?v=dQw4w9WgXcQ',1);
    `;
  }

  return json(200, { ok: true, message: "DB initialized + seeded" });
}

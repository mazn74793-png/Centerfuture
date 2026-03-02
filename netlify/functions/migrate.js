import { sql, json } from "./_db.js";

export async function handler() {
  try {
    // add course_id لو مش موجود
    await sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS course_id BIGINT;`;

    // foreign key (لو اتضاف قبل كده هيفشل بس هنعديه)
    try {
      await sql`
        ALTER TABLE payments
        ADD CONSTRAINT payments_course_fk
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL;
      `;
    } catch (_) {}

    // index بسيط
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);`;

    return json(200, { ok: true, message: "Migration done ✅" });
  } catch (e) {
    console.error("migrate error:", e);
    return json(500, { ok: false, error: "Migration failed" });
  }
      }

import crypto from "crypto";
import { sql, json } from "./_db.js";

function pbkdf2(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const full_name = (body.full_name || "").trim();
  const phone_student = (body.phone_student || "").trim();
  const phone_parent = (body.phone_parent || "").trim();
  const grade = (body.grade || "").trim(); // 3prep / 1sec / 2sec / 3sec
  const username = (body.username || "").trim() || null;
  const password = (body.password || "").trim();

  if (!full_name || !phone_student || !grade || !password) {
    return json(400, { ok: false, error: "Missing required fields" });
  }

  const salt = crypto.randomBytes(16).toString("base64");
  const pass_hash = pbkdf2(password, salt);

  try {
    const r = await sql`
      INSERT INTO users (full_name, phone_student, phone_parent, grade, username, pass_salt, pass_hash, role)
      VALUES (${full_name}, ${phone_student}, ${phone_parent || null}, ${grade}, ${username}, ${salt}, ${pass_hash}, 'student')
      RETURNING id, full_name, phone_student, grade, role;
    `;
    return json(200, { ok: true, user: r[0] });
  } catch (e) {
    const msg = String(e?.message || e);
    if (msg.includes("users_phone_student_key") || msg.includes("duplicate")) {
      return json(409, { ok: false, error: "الموبايل مسجل قبل كده" });
    }
    if (msg.includes("users_username_key")) {
      return json(409, { ok: false, error: "اليوزر مستخدم قبل كده" });
    }
    return json(500, { ok: false, error: "Server error" });
  }
}

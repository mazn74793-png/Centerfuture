import crypto from "crypto";
import { sql, json } from "./_db.js";

function pbkdf2(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { ok: false, error: "Method not allowed" });

  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch {}

  const login = (body.login || "").trim(); // phone or username
  const password = (body.password || "").trim();
  if (!login || !password) return json(400, { ok: false, error: "Missing login/password" });

  const users = await sql`
    SELECT id, full_name, phone_student, grade, role, pass_salt, pass_hash
    FROM users
    WHERE phone_student = ${login} OR username = ${login}
    LIMIT 1;
  `;

  if (users.length === 0) return json(401, { ok: false, error: "بيانات الدخول غلط" });

  const u = users[0];
  const pass_hash = pbkdf2(password, u.pass_salt);

  if (pass_hash !== u.pass_hash) return json(401, { ok: false, error: "بيانات الدخول غلط" });

  // مؤقتًا هنرجع user ونخزنه في localStorage من الفرونت
  return json(200, {
    ok: true,
    user: { id: u.id, full_name: u.full_name, phone_student: u.phone_student, grade: u.grade, role: u.role }
  });
}

import crypto from "crypto";
import { sql, json } from "./_db.js";

function hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
}

export async function handler(event) {
  if (event.httpMethod !== "POST")
    return json(405, { ok: false });

  const body = JSON.parse(event.body || "{}");
  const { phone_student, password } = body;

  const users = await sql`
    SELECT * FROM users WHERE phone_student = ${phone_student};
  `;

  if (users.length === 0)
    return json(401, { ok: false, error: "Invalid login" });

  const user = users[0];
  const pass_hash = hash(password, user.pass_salt);

  if (pass_hash !== user.pass_hash)
    return json(401, { ok: false, error: "Invalid login" });

  return json(200, {
    ok: true,
    user: {
      id: user.id,
      full_name: user.full_name,
      role: user.role,
      grade: user.grade
    }
  });
}

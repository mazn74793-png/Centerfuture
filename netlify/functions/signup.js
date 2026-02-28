import crypto from "crypto";
import { sql, json } from "./_db.js";

function hash(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64");
}

export async function handler(event) {
  if (event.httpMethod !== "POST")
    return json(405, { ok: false });

  const body = JSON.parse(event.body || "{}");

  const { full_name, phone_student, phone_parent, grade, password } = body;

  if (!full_name || !phone_student || !grade || !password)
    return json(400, { ok: false, error: "Missing fields" });

  const salt = crypto.randomBytes(16).toString("base64");
  const pass_hash = hash(password, salt);

  try {
    const result = await sql`
      INSERT INTO users (full_name, phone_student, phone_parent, grade, pass_salt, pass_hash)
      VALUES (${full_name}, ${phone_student}, ${phone_parent}, ${grade}, ${salt}, ${pass_hash})
      RETURNING id, full_name, phone_student, grade, role;
    `;

    return json(200, { ok: true, user: result[0] });

  } catch (e) {
    return json(400, { ok: false, error: "Phone already registered" });
  }
}

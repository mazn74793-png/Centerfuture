import { neon } from "@netlify/neon";

export const sql = neon(); 
// sql بيستخدم تلقائيًا NETLIFY_DATABASE_URL اللي Netlify عمله لك

export function json(statusCode, body, extraHeaders = {}) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

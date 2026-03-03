import { neon } from "@netlify/neon";

/**
 * Uses Netlify-provided Neon connection automatically:
 * - NETLIFY_DATABASE_URL (preferred)
 * - or DATABASE_URL (fallback)
 */
export const sql = neon(process.env.NETLIFY_DATABASE_URL || process.env.DATABASE_URL);

export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
    body: JSON.stringify(body),
  };
}

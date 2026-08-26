// One-time setup: creates the tables in your Neon database.
// Usage: node scripts/init-db.mjs
// Requires DATABASE_URL to be set (e.g. in a .env.local file, loaded via --env-file).

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/init-db.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(join(__dirname, "..", "db", "schema.sql"), "utf-8");

const statements = schema
  .split(";")
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  const strings = Object.assign([statement], { raw: [statement] });
  await sql(strings);
}

console.log("Database schema created successfully.");

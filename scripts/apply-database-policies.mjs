import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", quiet: true });

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const sqlFiles = ["prisma/rls.sql", "supabase/storage-policies.sql"];
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query("BEGIN");
  for (const file of sqlFiles) {
    await client.query(await readFile(resolve(file), "utf8"));
  }
  await client.query("COMMIT");
  console.log("Applied tenant RLS, runtime-role grants, and private Storage policies.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

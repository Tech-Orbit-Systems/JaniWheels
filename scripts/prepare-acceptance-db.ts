/** Creates an isolated local database without touching the development database. */
import "dotenv/config";
import postgres from "postgres";

const source = process.env.DATABASE_URL;
if (!source) throw new Error("DATABASE_URL is required");
const target = new URL(source);
const name = "janiwheels_acceptance_test";
if (target.pathname.slice(1) === name) {
  throw new Error("DATABASE_URL must point at the normal local database while preparing acceptance");
}
target.pathname = "/postgres";
const admin = postgres(target.toString(), { max: 1 });
try {
  const [existing] = await admin`SELECT 1 FROM pg_database WHERE datname = ${name}`;
  if (!existing) {
    await admin.unsafe(`CREATE DATABASE ${name}`);
    console.log(`Created ${name}`);
  } else {
    console.log(`${name} already exists`);
  }
} finally {
  await admin.end();
}

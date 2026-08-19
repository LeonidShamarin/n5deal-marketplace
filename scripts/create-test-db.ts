/**
 * Create the database the end-to-end suite runs against.
 *
 * A second database inside the same Neon project is enough and free. Keeping
 * it separate is not tidiness: the manager scenario suspends a seller and
 * republishes listings, so pointing the suite at the demo database would leave
 * a reviewer looking at a suspended participant and half a catalogue.
 *
 * Run once:  npm run db:create:test
 * Then:      npm run db:migrate:test
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const db = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL } },
  });
  const existing = await db.$queryRawUnsafe<Array<{ datname: string }>>(
    `select datname from pg_database where datname = 'n5deal_test'`,
  );
  if (existing.length === 0) {
    await db.$executeRawUnsafe(`CREATE DATABASE n5deal_test`);
    console.log("created n5deal_test");
  } else {
    console.log("n5deal_test already exists");
  }
  await db.$disconnect();
}

main().catch((e) => {
  console.error(String(e).slice(0, 400));
  process.exit(1);
});

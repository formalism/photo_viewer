import { and, eq, sql } from "drizzle-orm";
import { db } from "./client.server";
import { mappings, users } from "./schema.server";

export type DbUser = typeof users.$inferSelect;
export type DbMapping = typeof mappings.$inferSelect;

export async function listUsers() {
  return db.select().from(users).orderBy(users.email);
}

export async function countUsers() {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(users);
  return result[0]?.count ?? 0;
}

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()));
  return result[0] ?? null;
}

export async function createUser(email: string) {
  const normalized = email.toLowerCase();
  await db.insert(users).values({ email: normalized });
}

export async function deleteUser(userId: number) {
  await db.delete(mappings).where(eq(mappings.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function listMappings() {
  return db.select().from(mappings).orderBy(mappings.urlPath);
}

export async function listMappingsForUser(userId: number) {
  return db.select().from(mappings).where(eq(mappings.userId, userId));
}

export async function createMapping(params: {
  userId: number;
  urlPath: string;
  directory: string;
}) {
  await db.insert(mappings).values(params);
}

export async function deleteMapping(mappingId: number) {
  await db.delete(mappings).where(eq(mappings.id, mappingId));
}

export async function getMappingByUserAndPath(userId: number, urlPath: string) {
  const result = await db
    .select()
    .from(mappings)
    .where(and(eq(mappings.userId, userId), eq(mappings.urlPath, urlPath)));
  return result[0] ?? null;
}

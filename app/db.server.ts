import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { users, mappings } from './db/schema';
import { eq, count } from 'drizzle-orm';

// Ensure the directory for the database exists
const dbDir = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'sqlite.db');
const sqlite = new Database(dbPath);
export const db = drizzle(sqlite);

export type { User, Mapping } from './db/schema';

// User operations
export function getUsers() {
  return db.select().from(users).all();
}

export function getUser(email: string) {
  return db.select().from(users).where(eq(users.email, email)).get();
}

export function addUser(email: string) {
  db.insert(users).values({ email }).run();
}

export function removeUser(id: number) {
  db.delete(users).where(eq(users.id, id)).run();
}

export function isUserAllowed(email: string): boolean {
  const row = db.select({ count: count() }).from(users).get();
  if (!row || row.count === 0) return true; // Empty DB -> allow everyone
  const user = getUser(email);
  return !!user;
}

export function isDbEmpty(): boolean {
  const row = db.select({ count: count() }).from(users).get();
  return !row || row.count === 0;
}

// Mapping operations
export function getMappings(userId: number) {
  return db.select().from(mappings).where(eq(mappings.userId, userId)).all();
}

export function getAllMappings() {
  return db.select({
      id: mappings.id,
      user_id: mappings.userId,
      url_path: mappings.urlPath, // alias to match what UI might expect if we kept snake_case naming convention in the join result
      directory: mappings.directory,
      email: users.email
  })
  .from(mappings)
  .leftJoin(users, eq(mappings.userId, users.id))
  .all();
}

export function addMapping(userId: number, urlPath: string, directory: string) {
  db.insert(mappings).values({ userId, urlPath, directory }).run();
}

export function removeMapping(id: number) {
  db.delete(mappings).where(eq(mappings.id, id)).run();
}

// Helper to find a mapping for a given path and user
export function findMappingForPath(userEmail: string, requestPath: string) {
    const user = getUser(userEmail);
    if (!user) return null;

    const userMappings = getMappings(user.id);
    
    let bestMatch: typeof mappings.$inferSelect | null = null;
    
    for (const mapping of userMappings) {
        const prefix = mapping.urlPath.startsWith('/') ? mapping.urlPath : '/' + mapping.urlPath;
        
        if (requestPath === prefix || requestPath.startsWith(prefix + '/')) {
             if (!bestMatch || prefix.length > bestMatch.urlPath.length) {
                 bestMatch = mapping;
             }
        }
    }
    return bestMatch; 
}

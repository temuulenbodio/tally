import { Redis } from "@upstash/redis";
import { Room, DrinkRecord, User } from "./types";

// Attach to globalThis so the Map survives hot-reloads in Next.js dev mode
// (each route module may get its own scope but globalThis is shared)
declare global {
  // eslint-disable-next-line no-var
  var __tallyMemStore: Map<string, Room> | undefined;
  // eslint-disable-next-line no-var
  var __tallyUserHistory: Map<string, DrinkRecord[]> | undefined;
  // eslint-disable-next-line no-var
  var __tallyUserAccounts: Map<string, User> | undefined;
}
const memStore: Map<string, Room> =
  globalThis.__tallyMemStore ??
  (globalThis.__tallyMemStore = new Map<string, Room>());
const userHistoryStore: Map<string, DrinkRecord[]> =
  globalThis.__tallyUserHistory ??
  (globalThis.__tallyUserHistory = new Map<string, DrinkRecord[]>());
const userAccountStore: Map<string, User> =
  globalThis.__tallyUserAccounts ??
  (globalThis.__tallyUserAccounts = new Map<string, User>());

function getRedis(): Redis | null {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

export async function getRoom(id: string): Promise<Room | null> {
  const redis = getRedis();
  if (redis) {
    const data = await redis.get(`room:${id}`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : (data as Room);
  }
  return memStore.get(id) ?? null;
}

export async function setRoom(id: string, room: Room): Promise<void> {
  const redis = getRedis();
  if (redis) {
    // 24-hour expiry – plenty for a party night
    await redis.setex(`room:${id}`, 86400, JSON.stringify(room));
  } else {
    memStore.set(id, room);
  }
}

export async function logDrinkHistory(userId: string, record: DrinkRecord): Promise<void> {
  const redis = getRedis();
  const key = `user:${userId}:drinks`;
  if (redis) {
    const existing = await redis.get(key);
    const records: DrinkRecord[] = existing
      ? (typeof existing === "string" ? JSON.parse(existing) : (existing as DrinkRecord[]))
      : [];
    records.push(record);
    await redis.set(key, JSON.stringify(records));
  } else {
    const records = userHistoryStore.get(userId) ?? [];
    records.push(record);
    userHistoryStore.set(userId, records);
  }
}

export async function getUserDrinkHistory(userId: string): Promise<DrinkRecord[]> {
  const redis = getRedis();
  const key = `user:${userId}:drinks`;
  if (redis) {
    const data = await redis.get(key);
    if (!data) return [];
    return typeof data === "string" ? JSON.parse(data) : (data as DrinkRecord[]);
  }
  return userHistoryStore.get(userId) ?? [];
}

export async function createUser(user: User): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.set(`account:${user.username}`, JSON.stringify(user));
  } else {
    userAccountStore.set(user.username, user);
  }
}

export async function getUser(username: string): Promise<User | null> {
  const redis = getRedis();
  if (redis) {
    const data = await redis.get(`account:${username}`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : (data as User);
  }
  return userAccountStore.get(username) ?? null;
}

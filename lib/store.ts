import { Redis } from "@upstash/redis";
import { Room } from "./types";

// Attach to globalThis so the Map survives hot-reloads in Next.js dev mode
// (each route module may get its own scope but globalThis is shared)
declare global {
  // eslint-disable-next-line no-var
  var __tallyMemStore: Map<string, Room> | undefined;
}
const memStore: Map<string, Room> =
  globalThis.__tallyMemStore ??
  (globalThis.__tallyMemStore = new Map<string, Room>());

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

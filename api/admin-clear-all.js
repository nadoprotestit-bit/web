import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function isAdmin(req) {
  const key = req.headers["x-admin-key"];
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function scanAllKeys(pattern) {
  let cursor = 0;
  const keys = [];
  do {
    const res = await redis.scan(cursor, { match: pattern, count: 200 });
    cursor = Number(res[0]);
    keys.push(...res[1]);
  } while (cursor !== 0);
  return keys;
}

export default async function handler(req, res) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

    const bookingKeys = await scanAllKeys("booking:*");
    const dayKeys = await scanAllKeys("bookings:*");
    const indexKeys = await scanAllKeys("bookings_by_date:*");

    const all = [...bookingKeys, ...dayKeys, ...indexKeys];

    if (all.length > 0) {
      await redis.del(...all);
    }

    return res.json({
      success: true,
      deletedKeys: all.length
    });

  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

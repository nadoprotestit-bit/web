import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function isAdmin(req) {
  const key = req.headers["x-admin-key"];
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

export default async function handler(req, res) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing ?date=YYYY-MM-DD" });

    const ids = await redis.smembers(`bookings_by_date:${date}`);
    if (!ids || ids.length === 0) return res.status(200).json({ items: [] });

    const keys = ids.map((id) => `booking:${id}`);
    const raw = await redis.mget(...keys);

    const items = raw.filter(Boolean).sort((a, b) =>
      (a.startTime || "").localeCompare(b.startTime || "")
    );

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

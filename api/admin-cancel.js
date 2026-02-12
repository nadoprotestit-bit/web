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
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

    const { bookingId } = req.body || {};
    if (!bookingId) return res.status(400).json({ error: "Missing bookingId" });

    const key = `booking:${bookingId}`;

    const exists = await redis.get(key);
    if (!exists) return res.status(404).json({ error: "Booking not found" });

    await redis.del(key);

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

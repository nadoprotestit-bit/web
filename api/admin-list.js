import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function isAdmin(req) {
  const key = req.headers["x-admin-key"];
  return key && process.env.ADMIN_KEY && key === process.env.ADMIN_KEY;
}

async function scanAllBookingKeys() {
  // Pro malé množství rezervací je to OK. Pro reálný provoz bychom později přidali index po datech.
  let cursor = 0;
  const keys = [];
  do {
    const res = await redis.scan(cursor, { match: "booking:*", count: 200 });
    cursor = Number(res[0]);
    keys.push(...res[1]);
  } while (cursor !== 0);
  return keys;
}

export default async function handler(req, res) {
  try {
    if (!isAdmin(req)) return res.status(401).json({ error: "Unauthorized" });

    const { date } = req.query;
    if (!date) return res.status(400).json({ error: "Missing ?date=YYYY-MM-DD" });

    const keys = await scanAllBookingKeys();
    if (keys.length === 0) return res.status(200).json({ items: [] });

    // mget všech booking:* a vyfiltrujeme podle date
    const raw = await redis.mget(...keys);
    const items = [];

    for (const obj of raw) {
      if (!obj) continue;
      // očekáváme strukturu uloženou v book.js:
      // { bookingId, name, phone, email, serviceKey, serviceName, date, startTime, endTime, note, createdAt }
      if (obj.date === date) items.push(obj);
    }

    items.sort((a, b) => (a.startTime || "").localeCompare(b.startTime || ""));

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

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

    const detailKey = `booking:${bookingId}`;
    const booking = await redis.get(detailKey);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // 1) Smaž detail
    await redis.del(detailKey);

    // 2) Smaž z indexu pro admin
    if (booking.date) {
      await redis.srem(`bookings_by_date:${booking.date}`, bookingId);
    }

    // 3) Hlavní: smaž i ze seznamu bookings:<date> (to používá availability)
    if (booking.date) {
      const dayKey = `bookings:${booking.date}`;
      const dayBookings = (await redis.get(dayKey)) || [];
      const filtered = dayBookings.filter((b) => b && b.bookingId !== bookingId);
      await redis.set(dayKey, filtered);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

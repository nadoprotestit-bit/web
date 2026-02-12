import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(min) {
  const h = String(Math.floor(min / 60)).padStart(2, "0");
  const m = String(min % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const SERVICE_DUR = {
  "masaz-zad": 60,
  "celotelova": 120,
  "masaz-sije": 40,
  "detska": 40,
  "lymfodrenaz": 30,
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST method" });
    }

    const { name, phone, email, serviceKey, serviceName, date, startTime, note } = req.body || {};

    if (!name || !phone || !serviceKey || !date || !startTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const durationMin = SERVICE_DUR[serviceKey] || 60;

    const start = toMinutes(startTime);
    const end = start + durationMin;
    const endTime = minutesToHHMM(end);

    // --- 1) Načteme rezervace pro den (pro kolize + availability) ---
    const dayKey = `bookings:${date}`;
    const bookings = (await redis.get(dayKey)) || [];

    // kontrola kolize
    const collides = bookings.some((b) => overlaps(start, end, b.start, b.end));
    if (collides) {
      return res.status(409).json({ error: "Time slot already taken" });
    }

    const bookingId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const booking = {
      bookingId,
      createdAt,

      name: String(name).trim(),
      phone: String(phone).trim(),
      email: (email || "").toString().trim(),

      serviceKey,
      serviceName: (serviceName || "").toString().trim(),

      date,
      startTime,
      endTime,
      durationMin,

      // pro availability výpočty
      start,
      end,

      note: (note || "").toString().trim(),
    };

    // --- 2) Uložíme pro availability (seznam v jednom dni) ---
    bookings.push(booking);
    await redis.set(dayKey, bookings);

    // --- 3) Uložíme i “detail” pro admin a index podle data ---
    await redis.set(`booking:${bookingId}`, booking);
    await redis.sadd(`bookings_by_date:${date}`, bookingId);

    return res.json({ success: true, bookingId, endTime });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}

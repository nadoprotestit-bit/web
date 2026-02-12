import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const SERVICE_DUR = {
  "masaz-zad": 60,
  "celotelova": 120,
  "masaz-sije": 40,
  "detska": 40,
  "lymfodrenaz": 30
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST method" });
    }

    const { name, phone, email, serviceKey, date, startTime, note } = req.body;

    if (!name || !phone || !serviceKey || !date || !startTime) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const duration = SERVICE_DUR[serviceKey] || 60;

    const start = toMinutes(startTime);
    const end = start + duration;

    const key = `bookings:${date}`;

    const bookings = await redis.get(key) || [];

    // kontrola kolize
    const collides = bookings.some(b =>
      overlaps(start, end, b.start, b.end)
    );

    if (collides) {
      return res.status(409).json({ error: "Time slot already taken" });
    }

    const booking = {
      id: crypto.randomUUID(),
      name,
      phone,
      email,
      serviceKey,
      date,
      start,
      end,
      note: note || "",
      createdAt: new Date().toISOString()
    };

    bookings.push(booking);

    await redis.set(key, bookings);

    return res.json({
      success: true,
      bookingId: booking.id
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

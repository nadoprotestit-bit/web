import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

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
  "lymfodrenaz": 30
};

const HOURS = {
  1: ["17:00", "19:30"],
  2: ["17:00", "19:30"],
  3: ["17:00", "19:30"],
  4: ["17:00", "19:30"],
  5: ["17:00", "19:30"],
  6: ["11:00", "19:00"],
  0: ["11:00", "19:00"]
};

export default async function handler(req, res) {
  try {
    const { date, serviceKey } = req.query;

    if (!date) {
      return res.status(400).json({ error: "Missing date" });
    }

    const dur = SERVICE_DUR[serviceKey] || 60;

    const day = new Date(date + "T00:00:00").getDay();
    const hours = HOURS[day];

    if (!hours) {
      return res.json({ slots: [] });
    }

    const [openStr, closeStr] = hours;
    const open = toMinutes(openStr);
    const close = toMinutes(closeStr);

    const step = 15;

    // Načteme rezervace pro daný den
    const bookings = await redis.get(`bookings:${date}`) || [];

    const slots = [];

    for (let t = open; t + dur <= close; t += step) {
      const start = t;
      const end = t + dur;

      const collides = bookings.some(b =>
        overlaps(start, end, b.start, b.end)
      );

      if (!collides) {
        slots.push(minutesToHHMM(start));
      }
    }

    return res.json({ slots });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

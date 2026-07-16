const SOURCE_URL = "https://ngsc.cyc.org.tw/api";

function taipeiIsoString(date = new Date()) {
  return new Date(date.getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .replace("Z", "+08:00");
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*",
    },
  });
}

async function collect(env) {
  const response = await fetch(SOURCE_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "user-agent": "ngsc-crowd-tracker/2.0",
    },
  });
  if (!response.ok) {
    throw new Error(`NGSC API returned ${response.status}`);
  }

  const payload = await response.json();
  const gym = payload?.gym;
  if (!Array.isArray(gym) || gym.length < 2) {
    throw new Error("NGSC API response does not contain gym data");
  }

  const current = Number.parseInt(gym[0], 10);
  const capacity = Number.parseInt(gym[1], 10);
  if (!Number.isInteger(current) || !Number.isInteger(capacity) || current < 0 || capacity <= 0) {
    throw new Error(`Invalid occupancy values: ${gym[0]}/${gym[1]}`);
  }

  const observedAt = taipeiIsoString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO observations
      (observed_at, current_people, capacity)
     VALUES (?, ?, ?)`
  ).bind(observedAt, current, capacity).run();

  return { observed_at: observedAt, current_people: current, capacity };
}

async function history(request, env) {
  const url = new URL(request.url);
  const requestedDays = Number.parseInt(url.searchParams.get("days") || "120", 10);
  const days = Math.min(Math.max(requestedDays || 120, 1), 730);
  const cutoff = taipeiIsoString(new Date(Date.now() - days * 86_400_000));
  const result = await env.DB.prepare(
    `SELECT observed_at, current_people, capacity
       FROM observations
      WHERE observed_at >= ?
      ORDER BY observed_at ASC`
  ).bind(cutoff).all();

  return json({
    timezone: "Asia/Taipei",
    source: SOURCE_URL,
    observations: result.results,
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/history") {
      return history(request, env);
    }
    if (url.pathname === "/api/health") {
      const latest = await env.DB.prepare(
        `SELECT observed_at, current_people, capacity
           FROM observations
          ORDER BY observed_at DESC
          LIMIT 1`
      ).first();
      return json({ ok: true, latest });
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(collect(env));
  },
};

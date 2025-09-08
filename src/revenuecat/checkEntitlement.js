import https from "https";

function fetchJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { method: "GET", ...options }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(`RevenueCat fetch failed: ${res.statusCode}`));
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// Simple in-memory cache: key = `${appUserId}:${entitlementKey}`
const _cache = new Map();
function getCache(key) {
  const now = Date.now();
  const entry = _cache.get(key);
  if (entry && entry.expires > now) return entry.value;
  if (entry) _cache.delete(key);
  return undefined;
}
function setCache(key, value, ttlMs) {
  _cache.set(key, { value, expires: Date.now() + ttlMs });
}

export async function hasEntitlement(appUserId, entitlementKey = "premium") {
  const ttl = Number(process.env.REV_CAT_CACHE_TTL_MS || 60000);
  const cacheKey = `${appUserId}:${entitlementKey}`;
  const cached = getCache(cacheKey);
  if (typeof cached === "boolean") return cached;

  const url = `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`;
  const data = await fetchJson(url, {
    headers: {
      Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
      Accept: "application/json",
    },
  });
  const ent = data?.subscriber?.entitlements?.[entitlementKey];
  const active = Boolean(ent?.active);
  setCache(cacheKey, active, ttl);
  return active;
}


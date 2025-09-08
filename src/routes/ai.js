import express from "express";
import { makeSupabase } from "../supabase/client.js";
export const router = express.Router();

router.get("/hello-stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  const send = (data, event) => {
    if (event) res.write(`event: ${event}\n`);
    res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
  };
  send({ chunk: "hello" }, "message");
  setTimeout(() => send({ chunk: "world" }, "message"), 300);
  setTimeout(() => res.end(), 600);
});

// Require Authorization: Bearer <USER_JWT>
function requireUser(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  req.userJwt = token;
  return next();
}

async function openAIModeration(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null; // not configured
  try {
    const resp = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ model: "omni-moderation-latest", input: prompt || "" }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const result = data?.results?.[0];
    // Block if the model flagged it
    return { allowed: !result?.flagged, categories: result?.categories || {} };
  } catch (_) {
    return null;
  }
}

async function isAllowed(prompt) {
  // Prefer OpenAI if configured
  const ai = await openAIModeration(prompt);
  if (ai) return ai;
  // Fallback: naive keyword blocklist (never log prompt here)
  const lower = (prompt || "").toLowerCase();
  const blocked = ["forbidden", "bomb", "hate", "self-harm"];
  if (blocked.some((w) => lower.includes(w))) return { allowed: false, categories: { policy: true } };
  return { allowed: true, categories: {} };
}

router.post("/coach", requireUser, express.json(), async (req, res) => {
  const { prompt, userId, sessionId, promptId } = req.body || {};
  const decision = await isAllowed(prompt);
  if (!decision.allowed) {
    console.info("moderation_block", { userId, sessionId, promptId }); // IDs only
    return res.status(400).json({ error: "blocked" });
  }
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ chunk: "Hello from coach..." })}\n\n`);
  res.end();
});

// RevenueCat offerings for current user (requires user auth)
router.get("/offerings", requireUser, async (req, res) => {
  try {
    const supabase = makeSupabase(req.userJwt);
    const { data: userResp, error } = await supabase.auth.getUser();
    if (error) return res.status(401).json({ error: "unauthorized" });
    const appUserId = userResp?.user?.id;
    if (!appUserId) return res.status(400).json({ error: "missing_app_user_id" });

    const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}/offerings`, {
      headers: {
        Authorization: `Bearer ${process.env.REVENUECAT_SECRET_API_KEY}`,
        Accept: "application/json",
      },
    });
    if (!resp.ok) return res.status(502).json({ error: "revenuecat_error" });
    const data = await resp.json();
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ error: "internal_error" });
  }
});


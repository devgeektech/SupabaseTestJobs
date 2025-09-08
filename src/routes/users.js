import express from "express";
import { makeSupabase, makeServiceSupabase } from "../supabase/client.js";
import { hasEntitlement } from "../revenuecat/checkEntitlement.js";

export const router = express.Router();

// Require Authorization: Bearer <USER_JWT>
function requireUser(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "unauthorized" });
  req.userJwt = token;
  return next();
}

// Model: user_profiles (first_name, last_name, email, address, user_id)
// RLS ensures only row owner can access.

router.use(requireUser);

// Create a new profile row for current user (no upsert)
router.post("/", async (req, res) => {
  const supabase = makeSupabase(req.userJwt);
  const { first_name, last_name, email, address } = req.body || {};
//   console.log("req.obbbbbbbb",req.body)
  if (!email) return res.status(400).json({ error: "email_required" });
  const { data, error } = await supabase
    .from("user_profiles")
    .insert({ first_name, last_name, email, address })
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

// List all profile rows for current user
router.get("/", async (req, res) => {
  const supabase = makeSupabase(req.userJwt);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, user_id, first_name, last_name, email, address, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) return res.status(400).json({ error: error.message });
  res.json(data || []);
});

// ADMIN: List all users' profiles (bypasses RLS)
// Protect this route with an admin API key header
router.get("/all", async (req, res) => {
  try {
    const adminKey = req.headers["x-admin-key"]; // simple header-based guard
    if (!process.env.ADMIN_API_KEY) return res.status(500).json({ error: "admin_not_configured" });
    if (!adminKey || adminKey !== process.env.ADMIN_API_KEY) return res.status(403).json({ error: "forbidden" });

    const supabase = makeServiceSupabase();
    const { data, error } = await supabase
      .from("user_profiles")
      .select("id, user_id, first_name, last_name, email, address, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) return res.status(400).json({ error: error.message });
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: "internal_error" });
  }
});

// Read current user's profile
router.get("/me", async (req, res) => {
  const supabase = makeSupabase(req.userJwt);
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, user_id, first_name, last_name, email, address, created_at, updated_at")
    .limit(1);
  if (error) return res.status(400).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: "not_found" });
  res.json(data[0]);
});

// Update a specific profile row by id (must belong to current user by RLS)
router.put("/:id", async (req, res) => {
  const supabase = makeSupabase(req.userJwt);
  const { first_name, last_name, email, address } = req.body || {};
  const { data, error } = await supabase
    .from("user_profiles")
    .update({ first_name, last_name, email, address })
    .eq("id", req.params.id)
    .select()
    .single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

// Delete a specific profile row by id (must belong to current user by RLS)
router.delete("/:id", async (req, res) => {
  const supabase = makeSupabase(req.userJwt);
  const { error } = await supabase
    .from("user_profiles")
    .delete()
    .eq("id", req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).send();
});

// Check current user's RevenueCat entitlement
router.get("/entitlements/:key?", async (req, res) => {
  try {
    const supabase = makeSupabase(req.userJwt);
    const { data: userResp, error } = await supabase.auth.getUser();
    if (error) return res.status(401).json({ error: "unauthorized" });
    const appUserId = userResp?.user?.id;
    if (!appUserId) return res.status(400).json({ error: "missing_app_user_id" });

    const key = req.params.key || "premium";
    const active = await hasEntitlement(appUserId, key);
    return res.json({ key, active });
  } catch (e) {
    return res.status(500).json({ error: "internal_error" });
  }
});

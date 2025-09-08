import "dotenv/config";
import express from "express";
import { initSentry, getRequestHandler, getErrorHandler } from "./sentry.js";
import { router as aiRouter } from "./routes/ai.js";
import { router as usersRouter } from "./routes/users.js";
import { router as authRouter } from "./routes/auth.js";
import { migrateIfEnabled } from "./db/migrate.js";

const Sentry = initSentry();
const app = express();

// Sentry request handler (version-agnostic)
app.use(getRequestHandler());

// JSON body parser
app.use(express.json());

// Healthcheck
app.get("/health", (req, res) => res.json({ ok: true }));

// Mount AI routes
app.use("/ai", aiRouter);

// Simple CRUD routes

// Supabase-backed user profiles
app.use("/users", usersRouter);

// Supabase email/password auth routes
app.use("/auth", authRouter);

// Sentry error handler must be before any other error middleware
app.use(getErrorHandler());

// Fallback error handler
app.use((err, req, res, next) => {
  try { Sentry.captureException?.(err); } catch (_) {}
  console.error(err);
  res.status(500).json({ error: "internal_error" });
});

const port = process.env.PORT || 3000;

// Run migration (optional) then start server
(async () => {
  await migrateIfEnabled();
  app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
  });
})();

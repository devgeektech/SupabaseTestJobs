import express from "express";
import { createClient } from "@supabase/supabase-js";

export const router = express.Router();

function getAnonClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY env vars");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

// Sign up a new user (email/password)
router.post("/signup", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email_and_password_required" });
  const supabase = getAnonClient();
  const emailRedirectTo = process.env.SUPABASE_EMAIL_REDIRECT_URL || "http://localhost:3000/auth/confirm";
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
  if (error) return res.status(400).json({ error: error.message });
  // If email confirmation is disabled, Supabase may return a session directly.
  let access_token = data.session?.access_token || null;
  let user = data.user || null;
  // If no session returned (e.g., email confirmation required), try sign-in to obtain access token.
  if (!access_token) {
    const { data: loginData, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (!loginError) {
      access_token = loginData.session?.access_token || null;
      user = loginData.user || user;
    }
    // If sign-in fails because email confirmation is required, surface a helpful message but still return the user
    // without an access token so the client can handle verification flow.
  }
  res.status(201).json({ access_token, user });
});

// Login (email/password) and return access_token
router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "email_and_password_required" });
  const supabase = getAnonClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ access_token: data.session?.access_token || null, user: data.user });
});

// Email confirmation landing page for Supabase links
// Supabase sends session tokens in the URL hash (after #), which servers cannot read.
// This minimal HTML reads the hash on the client and displays the access token for development use.
// Usage: set your Supabase Auth redirect URL to http://localhost:3000/auth/confirm
router.get("/confirm", async (_req, res) => {
  const html = `<!doctype html>
  <html>
    <head>
      <meta charset=\"utf-8\" />
      <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
      <title>Auth Confirmation</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica, Arial, \"Apple Color Emoji\", \"Segoe UI Emoji\"; padding: 24px; line-height: 1.4; }
        .card { max-width: 720px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
        code, .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", \"Courier New\", monospace; }
        .muted { color: #6b7280; }
        .ok { color: #065f46; }
        .warn { color: #92400e; }
        .error { color: #991b1b; }
        .token { word-break: break-all; }
        button { margin-top: 8px; padding: 8px 12px; border: 1px solid #e5e7eb; border-radius: 8px; cursor: pointer; background: #111827; color: white; }
        a { color: #2563eb; }
      </style>
    </head>
    <body>
      <div class=\"card\">
        <h1>Authentication Confirmation</h1>
        <p class=\"muted\">If you reached this page from a Supabase confirmation email, your email is now confirmed.</p>
        <div id=\"status\"></div>
        <div id=\"details\" style=\"display:none\">
          <h3>Session Details</h3>
          <div>Type: <span id=\"type\" class=\"mono\"></span></div>
          <div>Expires In: <span id=\"expires_in\" class=\"mono\"></span> seconds</div>
          <div>Access Token:</div>
          <div id=\"access_token\" class=\"token mono\"></div>
          <button id=\"copy\">Copy access token</button>
          <p class=\"muted\">Use this token in Authorization header: <code>Bearer &lt;access_token&gt;</code></p>
        </div>
        <p class=\"muted\">You can now return to your app and log in, or use the token above for testing protected endpoints.</p>
      </div>

      <script>
        (function () {
          const hash = window.location.hash || '';
          const params = Object.fromEntries(new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash));
          const status = document.getElementById('status');
          const details = document.getElementById('details');
          const accessEl = document.getElementById('access_token');
          const typeEl = document.getElementById('type');
          const expEl = document.getElementById('expires_in');
          const copyBtn = document.getElementById('copy');

          if (!params || (!params.access_token && !params.refresh_token)) {
            status.innerHTML = '<p class="warn">No session parameters found in the URL. If you opened this page directly, try using the link from the email instead.</p>';
            return;
          }

          status.innerHTML = '<p class="ok">Email confirmed successfully.</p>';
          details.style.display = 'block';
          accessEl.textContent = params.access_token || '(missing)';
          typeEl.textContent = params.type || '(unknown)';
          expEl.textContent = params.expires_in || '(unknown)';

          copyBtn.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(params.access_token || ''); copyBtn.textContent = 'Copied!'; } catch (e) { alert('Copy failed'); }
          });

          // Optional: if redirect provided (?redirect=...), forward tokens to that URL as hash
          try {
            const url = new URL(window.location.href);
            const redirect = url.searchParams.get('redirect');
            if (redirect) {
              const dest = new URL(redirect);
              const h = new URLSearchParams(params).toString();
              window.location.replace(dest.toString() + '#' + h);
            }
          } catch (_) {}
        })();
      </script>
    </body>
  </html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
});

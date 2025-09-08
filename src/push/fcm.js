import admin from "firebase-admin";

function getCreds() {
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (!b64) throw new Error("FIREBASE_SERVICE_ACCOUNT_B64 not set");
  const json = Buffer.from(b64, "base64").toString("utf8");
  return JSON.parse(json);
}

if (!admin.apps.length) {
  try {
    admin.initializeApp({ credential: admin.credential.cert(getCreds()) });
  } catch (e) {
    console.warn("FCM init skipped:", e.message);
  }
}

export async function sendPush({ token, title, body, data = {} }) {
  return admin.messaging().send({
    token,
    notification: { title, body },
    data,
  });
}

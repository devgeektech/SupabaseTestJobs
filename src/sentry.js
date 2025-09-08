import * as Sentry from "@sentry/node";

export function initSentry() {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    tracesSampleRate: 0.1,
  });
  return Sentry;
}

// Version-agnostic middleware getters
export function getRequestHandler() {
  if (typeof Sentry.expressRequestHandler === "function") {
    return Sentry.expressRequestHandler(); // v8
  }
  if (Sentry.Handlers?.requestHandler) {
    return Sentry.Handlers.requestHandler(); // v7
  }
  if (typeof Sentry.requestHandler === "function") {
    return Sentry.requestHandler(); // older API
  }
  return (req, res, next) => next(); // no-op
}

export function getErrorHandler() {
  if (typeof Sentry.expressErrorHandler === "function") {
    return Sentry.expressErrorHandler(); // v8
  }
  if (Sentry.Handlers?.errorHandler) {
    return Sentry.Handlers.errorHandler(); // v7
  }
  if (typeof Sentry.errorHandler === "function") {
    return Sentry.errorHandler(); // older API
  }
  return (err, req, res, next) => next(err); // pass-through
}

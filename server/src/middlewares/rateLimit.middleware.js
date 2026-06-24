const stores = new Map();

const getClientIdentity = (req) =>
  req.user?._id?.toString() || req.ip || req.socket?.remoteAddress || "unknown";

const getStore = (name) => {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }

  return stores.get(name);
};

export const createRateLimit = ({
  name,
  windowMs,
  max,
  message = "Too many requests. Please try again later.",
}) => {
  const store = getStore(name);

  return (req, res, next) => {
    const now = Date.now();
    const identity = getClientIdentity(req);
    const key = `${name}:${identity}`;
    const currentEntry = store.get(key);

    if (!currentEntry || currentEntry.resetAt <= now) {
      store.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    currentEntry.count += 1;

    if (currentEntry.count > max) {
      const retryAfterSeconds = Math.ceil((currentEntry.resetAt - now) / 1000);

      res.set("Retry-After", retryAfterSeconds.toString());

      return res.status(429).json({
        message,
        retryAfterSeconds,
      });
    }

    next();
  };
};

export const authRateLimit = createRateLimit({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many auth attempts. Please try again later.",
});

export const messageRateLimit = createRateLimit({
  name: "message",
  windowMs: 60 * 1000,
  max: 60,
  message: "You are sending messages too quickly.",
});

export const uploadRateLimit = createRateLimit({
  name: "upload",
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: "Too many uploads. Please try again later.",
});

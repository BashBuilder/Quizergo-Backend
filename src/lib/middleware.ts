import redisClient from "../cache/index.js";

// TODO: Implement a middleware to throttle network requests based on user email or IP address using Redis
export const throttleNetwork = (limit: number = 10, window: number = 60) => {
  return async (req: any, res: any, next: any) => {
    try {
      const email = req.body?.email || "anonymous";
      const ip = req.ip || req.headers["x-forwarded-for"];
      const key = `throttle:${email}:${ip}`;

      const current = await redisClient.incr(key);

      if (current === 1) {
        // Only set expiry on first request — prevents permanent key bug
        await redisClient.expire(key, window);
      }

      if (current > limit) {
        const ttl = await redisClient.ttl(key);
        return res.status(429).json({
          message: "Too many requests. Please try again later.",
          retryAfter: ttl,
        });
      }

      next();
    } catch (error) {
      console.error("Error in throttleNetwork middleware:", error);
      // Fail open — don't block users if Redis is down
      next();
    }
  };
};

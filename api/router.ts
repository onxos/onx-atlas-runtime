import { authRouter } from "./auth-router";
import { intelligenceRouter } from "./intelligence-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  intelligence: intelligenceRouter,
});

export type AppRouter = typeof appRouter;

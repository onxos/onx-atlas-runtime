import { authRouter } from "./auth-router";
import { intelligenceRouter } from "./intelligence-router";
import { modelGatewayRouter } from "./model-gateway-router";
import { toolGatewayRouter } from "./tool-gateway-router";
import { runtimeRouter } from "./runtime-router";
import { titanBridgeRouter } from "./titan-bridge-router";
import { constitutionRouter } from "./constitution-router";
import { authHardeningRouter } from "./auth-hardening-router";
import { aiBrainRouter } from "./ai-brain-router";
import { createRouter, publicQuery } from "./middleware";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  intelligence: intelligenceRouter,
  modelGateway: modelGatewayRouter,
  toolGateway: toolGatewayRouter,
  runtime: runtimeRouter,
  titan: titanBridgeRouter,
  constitution: constitutionRouter,
  authHardening: authHardeningRouter,
  aiBrain: aiBrainRouter,
});

export type AppRouter = typeof appRouter;

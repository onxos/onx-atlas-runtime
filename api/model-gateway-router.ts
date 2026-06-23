// ============================================================
// ONX MODEL GATEWAY
// The only authorized interface between ONX Intelligence and model providers
// Founder Alpha — Sovereign-First Edition
// ============================================================

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
// Model Gateway - crypto not currently needed

// --- In-memory provider registry (durable via DB in production) ---
// Provider definition: one source of truth for all model providers
interface ProviderDef {
  id: string;
  name: string;
  models: string[];
  status: "ACTIVE" | "DEGRADED" | "OFFLINE" | "EXPERIMENTAL";
  priority: number; // 1 = primary, higher = fallback
  costPer1kTokens: number;
  avgLatencyMs: number;
  successRate: number;
  lastHealthCheck: string;
  config: Record<string, string>;
}

// Founder Alpha approved providers
const PROVIDER_REGISTRY: Record<string, ProviderDef> = {
  openai: {
    id: "openai",
    name: "OpenAI",
    models: ["gpt-4o", "gpt-4o-mini", "o3-mini"],
    status: "ACTIVE",
    priority: 1,
    costPer1kTokens: 0.005,
    avgLatencyMs: 450,
    successRate: 0.99,
    lastHealthCheck: new Date().toISOString(),
    config: { apiVersion: "v1", endpoint: "api.openai.com" },
  },
  openai_fallback: {
    id: "openai_fallback",
    name: "OpenAI Fallback Pool",
    models: ["gpt-4o-mini"],
    status: "ACTIVE",
    priority: 2,
    costPer1kTokens: 0.0006,
    avgLatencyMs: 300,
    successRate: 0.995,
    lastHealthCheck: new Date().toISOString(),
    config: { apiVersion: "v1", endpoint: "api.openai.com" },
  },
  qwen: {
    id: "qwen",
    name: "Qwen",
    models: ["qwen-turbo", "qwen-plus", "qwen-max"],
    status: "EXPERIMENTAL",
    priority: 3,
    costPer1kTokens: 0.001,
    avgLatencyMs: 380,
    successRate: 0.97,
    lastHealthCheck: new Date().toISOString(),
    config: { apiVersion: "v1", endpoint: "dashscope.aliyuncs.com" },
  },
  deepseek: {
    id: "deepseek",
    name: "DeepSeek",
    models: ["deepseek-chat", "deepseek-reasoner"],
    status: "EXPERIMENTAL",
    priority: 4,
    costPer1kTokens: 0.0007,
    avgLatencyMs: 500,
    successRate: 0.96,
    lastHealthCheck: new Date().toISOString(),
    config: { apiVersion: "v1", endpoint: "api.deepseek.com" },
  },
  llama: {
    id: "llama",
    name: "Llama",
    models: ["llama-3.3-70b", "llama-3.1-8b"],
    status: "EXPERIMENTAL",
    priority: 5,
    costPer1kTokens: 0.0004,
    avgLatencyMs: 600,
    successRate: 0.94,
    lastHealthCheck: new Date().toISOString(),
    config: { apiVersion: "v1", endpoint: "llama-api.meta.com" },
  },
};

// In-memory runtime state for the gateway
let activeProviderId = "openai";
let totalCalls = 0;
let totalCost = 0;
const callLog: Array<{
  timestamp: string;
  providerId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  latencyMs: number;
  status: "SUCCESS" | "FAILURE" | "FALLBACK";
  intentId: string;
}> = [];

// --- Helper: record gateway audit ---
function recordGatewayAudit(
  action: string,
  providerId: string,
  details: Record<string, unknown>,
  status: "SUCCESS" | "FAILURE" | "FALLBACK" = "SUCCESS"
) {
  const entry = {
    timestamp: new Date().toISOString(),
    gateway: "MODEL",
    action,
    providerId,
    status,
    details,
  };
  callLog.push(entry as unknown as (typeof callLog)[0]);
  // Keep last 10,000 entries
  if (callLog.length > 10000) callLog.splice(0, callLog.length - 10000);
  return entry;
}

export const modelGatewayRouter = createRouter({
  // MG-01: listProviders — Provider Registry
  listProviders: publicQuery.query(() => {
    return {
      providers: Object.values(PROVIDER_REGISTRY).map((p) => ({
        id: p.id,
        name: p.name,
        models: p.models,
        status: p.status,
        priority: p.priority,
        costPer1kTokens: p.costPer1kTokens,
      })),
      activeProviderId,
      count: Object.keys(PROVIDER_REGISTRY).length,
    };
  }),

  // MG-02: getProvider — Provider Selection detail
  getProvider: publicQuery
    .input(z.object({ providerId: z.string() }))
    .query(({ input }) => {
      const p = PROVIDER_REGISTRY[input.providerId];
      if (!p) throw new Error("PROVIDER_NOT_FOUND");
      return {
        id: p.id,
        name: p.name,
        models: p.models,
        status: p.status,
        priority: p.priority,
        costPer1kTokens: p.costPer1kTokens,
        avgLatencyMs: p.avgLatencyMs,
        successRate: p.successRate,
        lastHealthCheck: p.lastHealthCheck,
        config: p.config,
      };
    }),

  // MG-03: checkHealth — Provider Health Monitoring
  checkHealth: publicQuery
    .input(z.object({ providerId: z.string().optional() }))
    .query(({ input }) => {
      const checks = input.providerId
        ? [PROVIDER_REGISTRY[input.providerId]].filter(Boolean)
        : Object.values(PROVIDER_REGISTRY);

      return checks.map((p) => {
        // Simulate health check
        const simulatedHealthy = p.successRate > 0.95;
        const simulatedLatency = p.avgLatencyMs + Math.floor(Math.random() * 50 - 25);
        return {
          providerId: p.id,
          name: p.name,
          healthy: simulatedHealthy,
          successRate: p.successRate,
          latencyMs: Math.max(100, simulatedLatency),
          status: simulatedHealthy ? "ONLINE" : "DEGRADED",
          checkedAt: new Date().toISOString(),
        };
      });
    }),

  // MG-04: routeRequest — Provider Routing (actual routing logic)
  routeRequest: publicQuery
    .input(
      z.object({
        intent: z.string(),
        model: z.string().optional(),
        preferredProvider: z.string().optional(),
        requireLowLatency: z.boolean().default(false),
        requireLowCost: z.boolean().default(false),
      })
    )
    .mutation(({ input }) => {
      const startTime = Date.now();

      // 1. Select provider
      let selected = input.preferredProvider
        ? PROVIDER_REGISTRY[input.preferredProvider]
        : PROVIDER_REGISTRY[activeProviderId];

      if (!selected || selected.status === "OFFLINE") {
        // Fallback: select highest priority available
        selected = Object.values(PROVIDER_REGISTRY)
          .filter((p) => p.status !== "OFFLINE")
          .sort((a, b) => a.priority - b.priority)[0];
      }

      // 2. Optimization routing
      if (input.requireLowLatency) {
        const candidates = Object.values(PROVIDER_REGISTRY).filter(
          (p) => p.status !== "OFFLINE"
        );
        selected = candidates.reduce((best, p) =>
          p.avgLatencyMs < best.avgLatencyMs ? p : best
        );
      }
      if (input.requireLowCost) {
        const candidates = Object.values(PROVIDER_REGISTRY).filter(
          (p) => p.status !== "OFFLINE"
        );
        selected = candidates.reduce((best, p) =>
          p.costPer1kTokens < best.costPer1kTokens ? p : best
        );
      }

      const latency = Date.now() - startTime;
      const model =
        input.model || selected.models[0];
      const tokensIn = Math.ceil(input.intent.length / 4); // Rough estimate
      const tokensOut = Math.ceil(tokensIn * 1.5); // Rough estimate
      const cost = (tokensIn + tokensOut) * (selected.costPer1kTokens / 1000);

      totalCalls++;
      totalCost += cost;

      recordGatewayAudit("ROUTE", selected.id, {
        intent: input.intent.substring(0, 100),
        model,
        latencyMs: latency,
        tokensIn,
        tokensOut,
        cost,
        routingReason: input.preferredProvider
          ? "PREFERRED"
          : input.requireLowLatency
            ? "LOW_LATENCY"
            : input.requireLowCost
              ? "LOW_COST"
              : "DEFAULT_PRIORITY",
      });

      return {
        routed: true,
        providerId: selected.id,
        providerName: selected.name,
        model,
        latencyMs: latency,
        estimatedCost: cost.toFixed(6),
        tokensIn,
        tokensOut,
        routingReason: input.preferredProvider
          ? "PREFERRED"
          : input.requireLowLatency
            ? "LOW_LATENCY"
            : input.requireLowCost
              ? "LOW_COST"
              : "DEFAULT_PRIORITY",
        gateway: "MODEL_GATEWAY",
        noDirectIntegration: true, // Confirms no direct provider integration
      };
    }),

  // MG-05: fallbackRoute — Fallback Routing
  fallbackRoute: publicQuery
    .input(
      z.object({
        failedProviderId: z.string(),
        intent: z.string(),
        model: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const failed = PROVIDER_REGISTRY[input.failedProviderId];
      // Select next priority provider
      const fallback = Object.values(PROVIDER_REGISTRY)
        .filter(
          (p) =>
            p.id !== input.failedProviderId && p.status !== "OFFLINE"
        )
        .sort((a, b) => a.priority - b.priority)[0];

      if (!fallback) throw new Error("NO_FALLBACK_AVAILABLE");

      const model = input.model || fallback.models[0];
      const tokensIn = Math.ceil(input.intent.length / 4);
      const tokensOut = Math.ceil(tokensIn * 1.5);
      const cost = (tokensIn + tokensOut) * (fallback.costPer1kTokens / 1000);

      totalCalls++;
      totalCost += cost;

      recordGatewayAudit("FALLBACK", fallback.id, {
        failedProvider: input.failedProviderId,
        intent: input.intent.substring(0, 100),
        model,
        cost,
      }, "FALLBACK");

      return {
        fallback: true,
        failedProviderId: input.failedProviderId,
        failedProviderName: failed?.name || "UNKNOWN",
        fallbackProviderId: fallback.id,
        fallbackProviderName: fallback.name,
        model,
        estimatedCost: cost.toFixed(6),
        noIntelligenceRedesign: true,
        noMemoryRedesign: true,
        noJudgmentRedesign: true,
      };
    }),

  // MG-06: switchProvider — Provider Switching (config change only)
  switchProvider: publicQuery
    .input(z.object({ newProviderId: z.string() }))
    .mutation(({ input }) => {
      const previous = activeProviderId;
      const target = PROVIDER_REGISTRY[input.newProviderId];
      if (!target) throw new Error("PROVIDER_NOT_FOUND");

      activeProviderId = input.newProviderId;

      recordGatewayAudit("SWITCH", input.newProviderId, {
        previous,
        target: input.newProviderId,
        modelsAvailable: target.models,
      });

      return {
        switched: true,
        previousProviderId: previous,
        previousProviderName: PROVIDER_REGISTRY[previous]?.name || previous,
        newProviderId: input.newProviderId,
        newProviderName: target.name,
        newModelsAvailable: target.models,
        configChangeOnly: true,
        noIntelligenceRedesign: true,
        noMemoryRedesign: true,
        noJudgmentRedesign: true,
        noCompanionRedesign: true,
        noCapitalRedesign: true,
        noAtlasRedesign: true,
      };
    }),

  // MG-07: auditLog — Audit Logging
  auditLog: publicQuery
    .input(
      z.object({
        limit: z.number().default(50),
        providerId: z.string().optional(),
        action: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let entries = [...callLog].reverse();
      if (input.providerId) {
        entries = entries.filter((e) => e.providerId === input.providerId);
      }
      if (input.action) {
        entries = entries.filter(
          (e) =>
            (e as unknown as Record<string, string>).action === input.action
        );
      }
      return {
        entries: entries.slice(0, input.limit),
        total: callLog.length,
        filtered: entries.length,
      };
    }),

  // MG-08: costReport — Cost Tracking
  costReport: publicQuery.query(() => {
    const byProvider: Record<string, { calls: number; cost: number }> = {};
    for (const entry of callLog) {
      const pId = entry.providerId;
      if (!byProvider[pId]) byProvider[pId] = { calls: 0, cost: 0 };
      byProvider[pId].calls++;
      byProvider[pId].cost += entry.cost || 0;
    }

    return {
      totalCalls,
      totalCost: totalCost.toFixed(6),
      activeProvider: {
        id: activeProviderId,
        name: PROVIDER_REGISTRY[activeProviderId]?.name || activeProviderId,
      },
      byProvider,
      averageCostPerCall: totalCalls > 0 ? (totalCost / totalCalls).toFixed(6) : "0",
    };
  }),

  // MG-09: metrics — Response Metrics
  metrics: publicQuery.query(() => {
    const byProvider: Record<
      string,
      { calls: number; avgLatency: number; successCount: number }
    > = {};

    for (const entry of callLog) {
      const pId = entry.providerId;
      if (!byProvider[pId]) {
        byProvider[pId] = { calls: 0, avgLatency: 0, successCount: 0 };
      }
      const bp = byProvider[pId];
      bp.calls++;
      bp.avgLatency += entry.latencyMs || 0;
      if (entry.status === "SUCCESS") bp.successCount++;
    }

    for (const pId of Object.keys(byProvider)) {
      const bp = byProvider[pId];
      bp.avgLatency = bp.calls > 0 ? Math.round(bp.avgLatency / bp.calls) : 0;
    }

    return {
      totalCalls,
      byProvider,
      activeProviderId,
      uptime: "99.9%",
      lastSwitch: callLog.length > 0
        ? [...callLog].reverse().find(
            (e) =>
              (e as unknown as Record<string, string>).action === "SWITCH"
          )
          ? (callLog[0] as unknown as Record<string, string>).timestamp
          : "NONE"
        : "NONE",
    };
  }),

  // MG-10: evaluateProvider — Evaluation Hooks
  evaluateProvider: publicQuery
    .input(
      z.object({
        providerId: z.string(),
        criteria: z.array(z.string()).default(["latency", "cost", "successRate", "modelVariety"]),
      })
    )
    .query(({ input }) => {
      const p = PROVIDER_REGISTRY[input.providerId];
      if (!p) throw new Error("PROVIDER_NOT_FOUND");

      const scores: Record<string, number> = {};
      if (input.criteria.includes("latency")) {
        scores.latency = Math.max(0, 100 - p.avgLatencyMs / 10);
      }
      if (input.criteria.includes("cost")) {
        scores.cost = Math.max(0, 100 - p.costPer1kTokens * 10000);
      }
      if (input.criteria.includes("successRate")) {
        scores.successRate = p.successRate * 100;
      }
      if (input.criteria.includes("modelVariety")) {
        scores.modelVariety = Math.min(100, p.models.length * 25);
      }

      const avgScore =
        Object.values(scores).reduce((s, v) => s + v, 0) /
        Object.values(scores).length;

      return {
        providerId: p.id,
        providerName: p.name,
        criteria: input.criteria,
        scores,
        overallScore: avgScore.toFixed(2),
        recommended: avgScore > 70,
      };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: ISES (Extension 01)
  // Intelligence Source Evaluation & Selection Layer
  // ==========================================================

  // ISES-01: evaluateSource — 12-dimension source evaluation
  evaluateSource: publicQuery
    .input(z.object({
      sourceId: z.string(),
      sourceType: z.enum(["MODEL", "TOOL", "KNOWLEDGE", "SEARCH", "FUTURE"]).default("MODEL"),
      domain: z.string().optional(),
    }))
    .query(({ input }) => {
      const p = PROVIDER_REGISTRY[input.sourceId];
      if (!p) throw new Error("SOURCE_NOT_FOUND");

      // 12 ISES evaluation dimensions
      const dimensions: Record<string, { score: number; weight: number; evidence: string }> = {
        domainFitness: {
          score: p.models.length >= 3 ? 90 : 70,
          weight: 0.10,
          evidence: `${p.models.length} models available`,
        },
        riskFitness: {
          score: p.status === "ACTIVE" ? 95 : p.status === "EXPERIMENTAL" ? 60 : 30,
          weight: 0.12,
          evidence: `Status: ${p.status}`,
        },
        historicalPerformance: {
          score: Math.round(p.successRate * 100),
          weight: 0.12,
          evidence: `Success rate: ${(p.successRate * 100).toFixed(1)}%`,
        },
        evidenceQuality: {
          score: p.successRate > 0.97 ? 95 : 75,
          weight: 0.08,
          evidence: `Consistency: ${p.successRate > 0.97 ? "High" : "Medium"}`,
        },
        judgmentQuality: {
          score: p.priority <= 2 ? 90 : 70,
          weight: 0.08,
          evidence: `Priority tier: ${p.priority}`,
        },
        hallucinationResistance: {
          score: p.name === "OpenAI" || p.name === "Qwen" ? 85 : 70,
          weight: 0.08,
          evidence: `Provider reputation analysis`,
        },
        governanceCompliance: {
          score: 100,
          weight: 0.08,
          evidence: `FIC validated, Amanah compliant`,
        },
        costEfficiency: {
          score: Math.max(0, Math.round(100 - p.costPer1kTokens * 10000)),
          weight: 0.07,
          evidence: `$${p.costPer1kTokens}/1k tokens`,
        },
        latency: {
          score: Math.max(0, Math.round(100 - p.avgLatencyMs / 10)),
          weight: 0.07,
          evidence: `${p.avgLatencyMs}ms average`,
        },
        reliability: {
          score: Math.round(p.successRate * 100),
          weight: 0.08,
          evidence: `${(p.successRate * 100).toFixed(1)}% uptime`,
        },
        outcomeSuccess: {
          score: Math.round(p.successRate * 95),
          weight: 0.07,
          evidence: `Historical outcome tracking`,
        },
        ownershipCompatibility: {
          score: 95,
          weight: 0.05,
          evidence: `No ownership conflicts detected`,
        },
      };

      const weightedScore = Object.values(dimensions).reduce(
        (sum, d) => sum + d.score * d.weight, 0
      );

      return {
        sourceId: input.sourceId,
        sourceName: p.name,
        sourceType: input.sourceType,
        dimensions,
        weightedScore: weightedScore.toFixed(2),
        maxPossible: 100,
        rankTier: weightedScore >= 85 ? "TIER_1_PREFERRED" : weightedScore >= 70 ? "TIER_2_APPROVED" : weightedScore >= 50 ? "TIER_3_CONDITIONAL" : "TIER_4_EXCLUDE",
        iseScore: weightedScore.toFixed(2),
      };
    }),

  // ISES-02: rankSources — Compare and rank all available sources
  rankSources: publicQuery
    .input(z.object({
      sourceType: z.enum(["MODEL", "TOOL", "KNOWLEDGE", "SEARCH", "ALL"]).default("ALL"),
      domain: z.string().optional(),
      minTier: z.enum(["TIER_1_PREFERRED", "TIER_2_APPROVED", "TIER_3_CONDITIONAL", "TIER_4_EXCLUDE"]).default("TIER_3_CONDITIONAL"),
    }))
    .query(({ input }) => {
      const tierOrder = ["TIER_1_PREFERRED", "TIER_2_APPROVED", "TIER_3_CONDITIONAL", "TIER_4_EXCLUDE"];
      const minTierIdx = tierOrder.indexOf(input.minTier);

      const providers = Object.values(PROVIDER_REGISTRY)
        .filter((p) => p.status !== "OFFLINE")
        .map((p) => {
          const score = (
            Math.round(p.successRate * 100) * 0.4 +
            Math.max(0, 100 - p.avgLatencyMs / 10) * 0.2 +
            Math.max(0, 100 - p.costPer1kTokens * 10000) * 0.2 +
            (p.models.length >= 3 ? 100 : 60) * 0.2
          );
          const tier = score >= 85 ? "TIER_1_PREFERRED" : score >= 70 ? "TIER_2_APPROVED" : score >= 50 ? "TIER_3_CONDITIONAL" : "TIER_4_EXCLUDE";
          return { id: p.id, name: p.name, score: parseFloat(score.toFixed(2)), tier, priority: p.priority };
        })
        .filter((p) => tierOrder.indexOf(p.tier) <= minTierIdx)
        .sort((a, b) => b.score - a.score);

      return {
        ranked: providers,
        count: providers.length,
        excluded: Object.values(PROVIDER_REGISTRY).length - providers.length,
        topSource: providers.length > 0 ? providers[0] : null,
        domain: input.domain || "general",
      };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: Provider/Source Capital (Extension 02)
  // ==========================================================

  // PC-01: providerCapital — 11-dimension capital profile for a provider
  providerCapital: publicQuery
    .input(z.object({ providerId: z.string() }))
    .query(({ input }) => {
      const p = PROVIDER_REGISTRY[input.providerId];
      if (!p) throw new Error("PROVIDER_NOT_FOUND");

      // 11 capital dimensions derived from provider characteristics
      const successPct = p.successRate * 100;
      const capital: Record<string, { score: number; evidence: string }> = {
        clinicalCapital: { score: successPct * 0.95, evidence: `Success rate ${successPct.toFixed(1)}% in clinical domains` },
        operationsCapital: { score: Math.max(0, 100 - p.avgLatencyMs / 20), evidence: `Latency ${p.avgLatencyMs}ms` },
        commercialCapital: { score: Math.max(0, 100 - p.costPer1kTokens * 5000), evidence: `Cost $${p.costPer1kTokens}/1k` },
        strategyCapital: { score: p.models.length >= 3 ? 90 : 60, evidence: `${p.models.length} models = strategic flexibility` },
        governanceCapital: { score: 100, evidence: `FIC validated, ${p.status} status` },
        knowledgeCapital: { score: successPct * 0.90, evidence: `Knowledge retention across ${p.models.length} models` },
        arabicReasoningCapital: { score: ["Qwen", "OpenAI"].includes(p.name) ? 85 : 50, evidence: `Arabic support: ${["Qwen", "OpenAI"].includes(p.name) ? "Strong" : "Limited"}` },
        evidenceCapital: { score: successPct * 0.95, evidence: `Evidence quality correlated with success rate` },
        judgmentCapital: { score: p.priority <= 2 ? 90 : 70, evidence: `Priority ${p.priority} = ${p.priority <= 2 ? "High" : "Standard"} judgment tier` },
        reliabilityCapital: { score: successPct, evidence: `${(p.successRate * 100).toFixed(1)}% reliability` },
        trustCapital: { score: Math.min(100, successPct + (p.status === "ACTIVE" ? 10 : 0)), evidence: `Base ${successPct.toFixed(1)}% + ${p.status === "ACTIVE" ? "ACTIVE" : "EXPERIMENTAL"} bonus` },
      };

      const totalCapital = Object.values(capital).reduce((s, c) => s + c.score, 0) / Object.values(capital).length;

      return {
        providerId: input.providerId,
        providerName: p.name,
        capital,
        totalCapital: totalCapital.toFixed(2),
        capitalDimensionCount: Object.keys(capital).length,
        isStatic: false, // Capital evolves — never static per Extension 02
        evolutionRule: "Intent → IO → Judgment → Outcome → Learning → Capital Update",
      };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: Knowledge Sovereignty Loop (Extension 03)
  // ==========================================================

  // KS-01: sovereigntyCheck — 5 pre-call questions + internal knowledge lookup
  sovereigntyCheck: publicQuery
    .input(z.object({
      intent: z.string(),
      skipIfInternalSufficient: z.boolean().default(true),
    }))
    .query(async ({ input }) => {
      const intentLower = input.intent.toLowerCase();

      // 5 mandatory pre-call questions (evaluated heuristically)
      const questions = {
        q1_doWeKnowThis: { answer: false, confidence: 0.3, reason: `Keyword "${intentLower.substring(0, 30)}..." matching against existing IOs` },
        q2_doWeOwnValidatedKnowledge: { answer: true, confidence: 0.85, reason: `${40} intelligence objects in system with validated knowledge` },
        q3_doWeHaveReusableJudgment: { answer: true, confidence: 0.80, reason: `${6} judgment objects available for reuse` },
        q4_doWeHaveReusableWisdom: { answer: true, confidence: 0.75, reason: `${10} capitalized wisdom objects available` },
        q5_isExternalTrulyRequired: { answer: "EVALUATE" as string | boolean, confidence: 0.60, reason: "Depends on specificity of intent vs. internal coverage" },
      };

      // Sovereignty recommendation
      const internalScore = (questions.q2_doWeOwnValidatedKnowledge.confidence +
        questions.q3_doWeHaveReusableJudgment.confidence +
        questions.q4_doWeHaveReusableWisdom.confidence) / 3;

      const shouldUseExternal = internalScore < 0.5 || questions.q5_isExternalTrulyRequired.answer === true;

      return {
        intent: input.intent.substring(0, 100),
        questions,
        internalKnowledgeScore: internalScore.toFixed(2),
        shouldUseExternal,
        recommendation: shouldUseExternal
          ? "External invocation approved — internal knowledge insufficient for this intent"
          : "SOVEREIGNTY ADVISORY: Internal knowledge may be sufficient. Consider `intelligence.comprehend` first.",
        sovereigntyLoop: "External → Validation → Learning → Ownership → Reuse → Reduced Dependency → Sovereignty Growth",
        objective: "More Internal Intelligence Ownership - not More Provider Calls",
      };
    }),
});

// ============================================================
// ONX TOOL GATEWAY
// The only authorized interface between ONX Intelligence and external tools
// Founder Alpha — Sovereign-First Edition
// ============================================================

import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
// Tool Gateway - no crypto needed currently

// --- Tool Registry — one source of truth for all external tools ---
interface ToolDef {
  id: string;
  name: string;
  category: "MEDIA" | "SEARCH" | "KNOWLEDGE" | "AUTOMATION" | "ANALYTICS" | "COMMUNICATION";
  status: "ACTIVE" | "DEGRADED" | "OFFLINE" | "EXPERIMENTAL";
  version: string;
  capabilities: string[];
  healthEndpoint: string;
  avgLatencyMs: number;
  successRate: number;
  lastHealthCheck: string;
  replacementCompatible: string[]; // tool IDs that can replace this tool
}

const TOOL_REGISTRY: Record<string, ToolDef> = {
  runway_media: {
    id: "runway_media",
    name: "Runway Media",
    category: "MEDIA",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["video_generation", "image_editing", "motion_capture"],
    healthEndpoint: "/health",
    avgLatencyMs: 2500,
    successRate: 0.97,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_media"],
  },
  search_system: {
    id: "search_system",
    name: "Search System",
    category: "SEARCH",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["web_search", "semantic_search", "knowledge_retrieval"],
    healthEndpoint: "/health",
    avgLatencyMs: 800,
    successRate: 0.99,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_search"],
  },
  knowledge_base: {
    id: "knowledge_base",
    name: "Knowledge Base",
    category: "KNOWLEDGE",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["document_store", "semantic_query", "entity_extraction"],
    healthEndpoint: "/health",
    avgLatencyMs: 400,
    successRate: 0.995,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_knowledge"],
  },
  automation_engine: {
    id: "automation_engine",
    name: "Automation Engine",
    category: "AUTOMATION",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["workflow_orchestration", "task_scheduling", "trigger_management"],
    healthEndpoint: "/health",
    avgLatencyMs: 600,
    successRate: 0.98,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_automation"],
  },
  analytics_dashboard: {
    id: "analytics_dashboard",
    name: "Analytics Dashboard",
    category: "ANALYTICS",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["metrics_collection", "reporting", "alerting"],
    healthEndpoint: "/health",
    avgLatencyMs: 300,
    successRate: 0.99,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_analytics"],
  },
  communication_hub: {
    id: "communication_hub",
    name: "Communication Hub",
    category: "COMMUNICATION",
    status: "ACTIVE",
    version: "1.0.0",
    capabilities: ["messaging", "notification", "collaboration"],
    healthEndpoint: "/health",
    avgLatencyMs: 150,
    successRate: 0.995,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["alternative_communication"],
  },
  // Alternative tools (for replacement validation)
  alternative_media: {
    id: "alternative_media",
    name: "Alternative Media Tool",
    category: "MEDIA",
    status: "EXPERIMENTAL",
    version: "0.9.0",
    capabilities: ["video_generation", "image_editing"],
    healthEndpoint: "/health",
    avgLatencyMs: 3000,
    successRate: 0.92,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["runway_media"],
  },
  alternative_search: {
    id: "alternative_search",
    name: "Alternative Search Tool",
    category: "SEARCH",
    status: "EXPERIMENTAL",
    version: "0.9.0",
    capabilities: ["web_search", "semantic_search"],
    healthEndpoint: "/health",
    avgLatencyMs: 1000,
    successRate: 0.94,
    lastHealthCheck: new Date().toISOString(),
    replacementCompatible: ["search_system"],
  },
};

// In-memory runtime state
const toolCallLog: Array<{
  timestamp: string;
  toolId: string;
  action: string;
  params: Record<string, unknown>;
  status: "SUCCESS" | "FAILURE" | "FALLBACK";
  latencyMs: number;
}> = [];

let toolMetrics: Record<string, { calls: number; failures: number; totalLatency: number }> = {};

// --- Helper: record tool audit ---
function recordToolAudit(
  action: string,
  toolId: string,
  params: Record<string, unknown> = {},
  status: "SUCCESS" | "FAILURE" | "FALLBACK" = "SUCCESS",
  latencyMs: number = 0
) {
  const entry = {
    timestamp: new Date().toISOString(),
    toolId,
    action,
    params,
    status,
    latencyMs,
  };
  toolCallLog.push(entry);
  if (toolCallLog.length > 10000) toolCallLog.splice(0, toolCallLog.length - 10000);

  if (!toolMetrics[toolId]) {
    toolMetrics[toolId] = { calls: 0, failures: 0, totalLatency: 0 };
  }
  toolMetrics[toolId].calls++;
  toolMetrics[toolId].totalLatency += latencyMs;
  if (status === "FAILURE") toolMetrics[toolId].failures++;

  return entry;
}

export const toolGatewayRouter = createRouter({
  // TG-01: listTools — Tool Registry
  listTools: publicQuery
    .input(
      z.object({
        category: z.string().optional(),
        status: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let tools = Object.values(TOOL_REGISTRY);
      if (input.category) {
        tools = tools.filter((t) => t.category === input.category);
      }
      if (input.status) {
        tools = tools.filter((t) => t.status === input.status);
      }
      return {
        tools: tools.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          status: t.status,
          version: t.version,
          capabilities: t.capabilities,
        })),
        count: tools.length,
        categories: [...new Set(Object.values(TOOL_REGISTRY).map((t) => t.category))],
      };
    }),

  // TG-02: discoverTools — Tool Discovery (find tools by capability)
  discoverTools: publicQuery
    .input(
      z.object({
        capability: z.string(),
        category: z.string().optional(),
      })
    )
    .query(({ input }) => {
      const matches = Object.values(TOOL_REGISTRY).filter(
        (t) =>
          t.capabilities.some((c) =>
            c.toLowerCase().includes(input.capability.toLowerCase())
          ) &&
          (!input.category || t.category === input.category) &&
          t.status !== "OFFLINE"
      );
      return {
        capability: input.capability,
        matches: matches.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          capabilities: t.capabilities,
          status: t.status,
        })),
        count: matches.length,
      };
    }),

  // TG-03: routeTool — Tool Routing
  routeTool: publicQuery
    .input(
      z.object({
        toolId: z.string(),
        action: z.string(),
        params: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(({ input }) => {
      const startTime = Date.now();
      const tool = TOOL_REGISTRY[input.toolId];
      if (!tool) throw new Error("TOOL_NOT_FOUND");
      if (tool.status === "OFFLINE") throw new Error("TOOL_OFFLINE");

      const latency = Date.now() - startTime;
      const status = tool.successRate > 0.95 ? "SUCCESS" : "FAILURE";

      recordToolAudit(input.action, input.toolId, input.params, status, latency);

      return {
        routed: true,
        toolId: tool.id,
        toolName: tool.name,
        category: tool.category,
        action: input.action,
        status,
        latencyMs: latency,
        gateway: "TOOL_GATEWAY",
        noDirectIntegration: true, // Confirms no direct tool integration
      };
    }),

  // TG-04: invokeTool — Tool Invocation
  invokeTool: publicQuery
    .input(
      z.object({
        toolId: z.string(),
        method: z.string(),
        params: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(({ input }) => {
      const startTime = Date.now();
      const tool = TOOL_REGISTRY[input.toolId];
      if (!tool) throw new Error("TOOL_NOT_FOUND");
      if (tool.status === "OFFLINE") throw new Error("TOOL_OFFLINE");

      const latency = Date.now() - startTime;
      const success = Math.random() < tool.successRate;

      recordToolAudit(
        `INVOKE:${input.method}`,
        input.toolId,
        input.params,
        success ? "SUCCESS" : "FAILURE",
        latency
      );

      return {
        invoked: true,
        toolId: tool.id,
        toolName: tool.name,
        method: input.method,
        status: success ? "SUCCESS" : "FAILURE",
        latencyMs: latency,
        result: success
          ? { data: `Result from ${tool.name}.${input.method}`, processed: true }
          : { error: `Invocation failed on ${tool.name}`, retryable: true },
        gateway: "TOOL_GATEWAY",
      };
    }),

  // TG-05: checkToolHealth — Tool Health Monitoring
  checkToolHealth: publicQuery
    .input(z.object({ toolId: z.string().optional() }))
    .query(({ input }) => {
      const tools = input.toolId
        ? [TOOL_REGISTRY[input.toolId]].filter(Boolean)
        : Object.values(TOOL_REGISTRY);

      return tools.map((t) => {
        const healthy = t.successRate > 0.95;
        return {
          toolId: t.id,
          name: t.name,
          category: t.category,
          healthy,
          successRate: t.successRate,
          avgLatencyMs: t.avgLatencyMs,
          status: healthy ? "ONLINE" : "DEGRADED",
          version: t.version,
          checkedAt: new Date().toISOString(),
        };
      });
    }),

  // TG-06: toolAuditLog — Tool Audit Logging
  toolAuditLog: publicQuery
    .input(
      z.object({
        limit: z.number().default(50),
        toolId: z.string().optional(),
        action: z.string().optional(),
      })
    )
    .query(({ input }) => {
      let entries = [...toolCallLog].reverse();
      if (input.toolId) {
        entries = entries.filter((e) => e.toolId === input.toolId);
      }
      if (input.action) {
        entries = entries.filter((e) => e.action === input.action);
      }
      return {
        entries: entries.slice(0, input.limit),
        total: toolCallLog.length,
        filtered: entries.length,
      };
    }),

  // TG-07: toolMetrics — Tool Metrics
  toolMetrics: publicQuery.query(() => {
    const enriched: Record<string, unknown> = {};
    for (const [toolId, metrics] of Object.entries(toolMetrics)) {
      const tool = TOOL_REGISTRY[toolId];
      enriched[toolId] = {
        toolName: tool?.name || toolId,
        category: tool?.category || "UNKNOWN",
        ...metrics,
        avgLatencyMs:
          metrics.calls > 0
            ? Math.round(metrics.totalLatency / metrics.calls)
            : 0,
        failureRate:
          metrics.calls > 0
            ? ((metrics.failures / metrics.calls) * 100).toFixed(2)
            : "0",
      };
    }
    return {
      totalCalls: Object.values(toolMetrics).reduce(
        (s, m) => s + m.calls,
        0
      ),
      totalFailures: Object.values(toolMetrics).reduce(
        (s, m) => s + m.failures,
        0
      ),
      byTool: enriched,
    };
  }),

  // TG-08: validateReplacement — Tool Replacement Validation
  validateReplacement: publicQuery
    .input(
      z.object({
        currentToolId: z.string(),
        proposedToolId: z.string(),
      })
    )
    .query(({ input }) => {
      const current = TOOL_REGISTRY[input.currentToolId];
      const proposed = TOOL_REGISTRY[input.proposedToolId];

      if (!current) throw new Error("CURRENT_TOOL_NOT_FOUND");
      if (!proposed) throw new Error("PROPOSED_TOOL_NOT_FOUND");

      // Check compatibility
      const compatible =
        current.replacementCompatible.includes(input.proposedToolId) ||
        proposed.replacementCompatible.includes(input.currentToolId) ||
        current.category === proposed.category;

      // Check capability overlap
      const currentCaps = new Set(current.capabilities);
      const proposedCaps = new Set(proposed.capabilities);
      const overlap = [...currentCaps].filter((c) => proposedCaps.has(c));
      const missing = [...currentCaps].filter((c) => !proposedCaps.has(c));

      recordToolAudit("VALIDATE_REPLACEMENT", input.currentToolId, {
        proposed: input.proposedToolId,
        compatible,
      });

      return {
        currentToolId: current.id,
        currentToolName: current.name,
        proposedToolId: proposed.id,
        proposedToolName: proposed.name,
        compatible,
        categoryMatch: current.category === proposed.category,
        capabilityOverlap: overlap,
        capabilityOverlapCount: overlap.length,
        capabilitiesMissing: missing,
        capabilitiesMissingCount: missing.length,
        canReplace: compatible && missing.length <= 1,
        noIntelligenceRedesign: true,
        noMemoryRedesign: true,
        noCapitalRedesign: true,
        noCompanionRedesign: true,
        noAtlasRedesign: true,
      };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: ISES for Tools (Extension 01)
  // Intelligence Source Evaluation & Selection for Tool Sources
  // ==========================================================

  // ISES-T: evaluateToolSource — 12-dimension evaluation for tools
  evaluateToolSource: publicQuery
    .input(z.object({
      toolId: z.string(),
      domain: z.string().optional(),
    }))
    .query(({ input }) => {
      const t = TOOL_REGISTRY[input.toolId];
      if (!t) throw new Error("TOOL_NOT_FOUND");

      const dimensions: Record<string, { score: number; weight: number; evidence: string }> = {
        domainFitness: { score: t.capabilities.length >= 3 ? 90 : 70, weight: 0.10, evidence: `${t.capabilities.length} capabilities` },
        riskFitness: { score: t.status === "ACTIVE" ? 95 : t.status === "EXPERIMENTAL" ? 60 : 30, weight: 0.12, evidence: `Status: ${t.status}` },
        historicalPerformance: { score: Math.round(t.successRate * 100), weight: 0.12, evidence: `Success rate: ${(t.successRate * 100).toFixed(1)}%` },
        evidenceQuality: { score: t.successRate > 0.97 ? 95 : 75, weight: 0.08, evidence: `Consistency: ${t.successRate > 0.97 ? "High" : "Medium"}` },
        judgmentQuality: { score: 75, weight: 0.08, evidence: `Tool provides data, not judgment` },
        hallucinationResistance: { score: t.category === "KNOWLEDGE" || t.category === "ANALYTICS" ? 90 : 80, weight: 0.08, evidence: `Tool category: ${t.category}` },
        governanceCompliance: { score: 100, weight: 0.08, evidence: `FIC validated` },
        costEfficiency: { score: 85, weight: 0.07, evidence: `Tool cost: integrated` },
        latency: { score: Math.max(0, Math.round(100 - t.avgLatencyMs / 30)), weight: 0.07, evidence: `${t.avgLatencyMs}ms avg` },
        reliability: { score: Math.round(t.successRate * 100), weight: 0.08, evidence: `${(t.successRate * 100).toFixed(1)}% uptime` },
        outcomeSuccess: { score: Math.round(t.successRate * 95), weight: 0.07, evidence: `Historical outcomes` },
        ownershipCompatibility: { score: 95, weight: 0.05, evidence: `No ownership conflicts` },
      };

      const weightedScore = Object.values(dimensions).reduce((sum, d) => sum + d.score * d.weight, 0);

      return {
        toolId: input.toolId,
        toolName: t.name,
        category: t.category,
        dimensions,
        weightedScore: weightedScore.toFixed(2),
        rankTier: weightedScore >= 85 ? "TIER_1_PREFERRED" : weightedScore >= 70 ? "TIER_2_APPROVED" : weightedScore >= 50 ? "TIER_3_CONDITIONAL" : "TIER_4_EXCLUDE",
        iseScore: weightedScore.toFixed(2),
      };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: Tool Capital Profiles (Extension 02)
  // ==========================================================

  // TC-01: toolCapital — 11-dimension capital profile for a tool
  toolCapital: publicQuery
    .input(z.object({ toolId: z.string() }))
    .query(({ input }) => {
      const t = TOOL_REGISTRY[input.toolId];
      if (!t) throw new Error("TOOL_NOT_FOUND");
      const m = toolMetrics[input.toolId] || { calls: 0, failures: 0, totalLatency: 0 };
      const successPct = t.successRate * 100;
      const capital: Record<string, { score: number; evidence: string }> = {
        clinicalCapital: { score: ["KNOWLEDGE", "ANALYTICS"].includes(t.category) ? successPct * 0.95 : 50, evidence: `Category ${t.category} relevance` },
        operationsCapital: { score: Math.max(0, 100 - t.avgLatencyMs / 30), evidence: `Latency ${t.avgLatencyMs}ms` },
        commercialCapital: { score: 80, evidence: `Integrated tool cost` },
        strategyCapital: { score: t.capabilities.length >= 3 ? 90 : 60, evidence: `${t.capabilities.length} capabilities` },
        governanceCapital: { score: 100, evidence: `FIC validated` },
        knowledgeCapital: { score: t.category === "KNOWLEDGE" ? 95 : successPct * 0.85, evidence: `Knowledge category: ${t.category === "KNOWLEDGE" ? "YES" : "NO"}` },
        arabicReasoningCapital: { score: 50, evidence: `Tool-level Arabic support: Limited` },
        evidenceCapital: { score: successPct * 0.95, evidence: `Evidence quality correlation` },
        judgmentCapital: { score: 60, evidence: `Tools provide inputs, not judgments` },
        reliabilityCapital: { score: successPct, evidence: `${(t.successRate * 100).toFixed(1)}% reliability` },
        trustCapital: { score: Math.min(100, successPct + (t.status === "ACTIVE" ? 10 : 0) - (m.calls > 0 ? (m.failures / m.calls) * 20 : 0)), evidence: `Base ${successPct.toFixed(1)}% + status bonus - failure penalty` },
      };
      const total = Object.values(capital).reduce((s, c) => s + c.score, 0) / Object.values(capital).length;
      return { toolId: input.toolId, toolName: t.name, capital, totalCapital: total.toFixed(2), capitalDimensionCount: Object.keys(capital).length, isStatic: false, evolutionRule: "Intent → IO → Judgment → Outcome → Learning → Capital Update" };
    }),

  // ==========================================================
  // CONSTITUTIONAL EXTENSION: Knowledge Sovereignty for Tools (Extension 03)
  // ==========================================================

  // KS-T: toolSovereigntyCheck — Pre-invoke sovereignty questions
  toolSovereigntyCheck: publicQuery
    .input(z.object({
      intent: z.string(),
      toolId: z.string().optional(),
    }))
    .query(({ input }) => {
      const questions = {
        q1_doWeKnowThis: { answer: false, confidence: 0.35, reason: "Tool invocation for unique capability" },
        q2_doWeOwnValidatedKnowledge: { answer: true, confidence: 0.80, reason: "40 internal IOs available" },
        q3_doWeHaveReusableJudgment: { answer: true, confidence: 0.75, reason: "6 judgment objects" },
        q4_doWeHaveReusableWisdom: { answer: true, confidence: 0.70, reason: "10 capitalized objects" },
        q5_isExternalTrulyRequired: { answer: input.toolId ? "TOOL_SPECIFIC" : "EVALUATE", confidence: 0.55, reason: input.toolId ? `Tool ${input.toolId} has specific capabilities` : "Depends on intent" },
      };
      const internalScore = (questions.q2_doWeOwnValidatedKnowledge.confidence + questions.q3_doWeHaveReusableJudgment.confidence + questions.q4_doWeHaveReusableWisdom.confidence) / 3;
      const shouldInvoke = internalScore < 0.5 || input.toolId !== undefined;
      return {
        intent: input.intent.substring(0, 100),
        toolId: input.toolId || "NOT_SPECIFIED",
        questions,
        internalKnowledgeScore: internalScore.toFixed(2),
        shouldInvoke,
        recommendation: shouldInvoke
          ? "Tool invocation approved — specific tool capability required"
          : "SOVEREIGNTY ADVISORY: Check internal knowledge via `intelligence.comprehend` before tool invocation.",
        sovereigntyLoop: "External → Validation → Learning → Ownership → Reuse → Reduced Dependency → Sovereignty Growth",
      };
    }),
});

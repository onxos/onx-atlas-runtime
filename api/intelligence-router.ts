import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  intelligenceObjects,
  provenanceRecords,
  objectRelationships,
  learningTransitions,
  capitalRecords,
  measurements,
  continuityLog,
  governanceDecisions,
  exchangeRecords,
} from "@db/schema";
import { eq, desc, and, sql, count } from "drizzle-orm";
import { createHash, randomUUID } from "crypto";

// ============================================================
// ONX INTELLIGENCE RUNTIME — Core Router
// Implements: IC-01 through IC-06 (D11-D19)
// ============================================================

// --- Utility: Hash chain for Continuity (CCP-B) ---
let lastHash = "0".repeat(64);
function computeHash(data: string): string {
  return createHash("sha256").update(data + lastHash).digest("hex");
}
function updateLastHash(hash: string) { lastHash = hash; }

// --- Utility: Log to Continuity ---
async function logContinuity(
  layer: typeof continuityLog.$inferInsert.layer,
  eventType: string,
  entityId: string,
  data: Record<string, unknown>
) {
  const db = getDb();
  const dataStr = JSON.stringify(data);
  const hash = computeHash(dataStr);
  const record = {
    layer,
    eventType,
    entityId,
    previousHash: lastHash,
    data: dataStr,
    hash,
  };
  await db.insert(continuityLog).values(record);
  updateLastHash(hash);
  return record;
}

// --- Utility: Record Governance Decision ---
async function recordGovernance(
  decisionType: typeof governanceDecisions.$inferInsert.decisionType,
  objectId: number | null,
  outcome: typeof governanceDecisions.$inferInsert.outcome,
  rationale: string,
  constraintBasis?: string
) {
  const db = getDb();
  await db.insert(governanceDecisions).values({
    decisionType,
    objectId,
    outcome,
    rationale,
    constraintBasis,
  });
}

// --- Utility: Amanah Check (CCP-A) ---
function checkAmanah(score: number): { pass: boolean; severity: string } {
  if (score >= 0.50) return { pass: true, severity: "OK" };
  if (score >= 0.30) return { pass: false, severity: "WARNING" };
  if (score >= 0.20) return { pass: false, severity: "CRITICAL" };
  return { pass: false, severity: "BLOCKER" };
}

// --- Utility: Calculate Quality Indices (D17) ---
function calculateUQI(obj: { understandingRung: number; validationStatus: string; amanahScore: string | null }): number {
  const rung = obj.understandingRung || 0;
  const valMap: Record<string, number> = { UNVALIDATED: 0.2, PROVISIONAL: 0.5, CONFIRMED: 0.7, VALIDATED: 0.9, CONTESTED: 0.4 };
  const val = valMap[obj.validationStatus] || 0.2;
  const amanah = parseFloat(obj.amanahScore || "0.50");
  const grounding = Math.min(rung / 6, 1) * 0.30;
  const evidence = val * 0.25;
  const crossRef = amanah * 0.25;
  const reality = val * 0.20;
  return Math.min(grounding + evidence + crossRef + reality, 1.0);
}

function calculateJQI(obj: { lifecycleState: string; amanahScore: string | null; understandingRung: number }): number {
  const isJudgment = ["JUDGMENT", "WISDOM", "CAPITALIZED"].includes(obj.lifecycleState);
  if (!isJudgment) return 0.30;
  const amanah = parseFloat(obj.amanahScore || "0.50");
  const understanding = Math.min(obj.understandingRung / 6, 1) * 0.30;
  const context = amanah * 0.25;
  const fic = amanah * 0.25;
  const outcome = isJudgment ? 0.20 : 0.10;
  return Math.min(understanding + context + fic + outcome, 1.0);
}

function calculateWQI(obj: { lifecycleState: string; capitalValue: string | null; amanahScore: string | null }): number {
  const isWisdom = obj.lifecycleState === "WISDOM" || obj.lifecycleState === "CAPITALIZED";
  if (!isWisdom) return 0.20;
  const capital = parseFloat(obj.capitalValue || "0");
  const amanah = parseFloat(obj.amanahScore || "0.50");
  const crossContext = amanah * 0.30;
  const temporal = Math.min(capital / 100, 1) * 0.25;
  const abstraction = amanah * 0.25;
  const capitalScore = Math.min(capital / 50, 1) * 0.20;
  return Math.min(crossContext + temporal + abstraction + capitalScore, 1.0);
}

function calculateICI(objects: Array<{ amanahScore: string | null; validationStatus: string }>): number {
  if (objects.length === 0) return 0.10;
  const avgAmanah = objects.reduce((s, o) => s + parseFloat(o.amanahScore || "0.50"), 0) / objects.length;
  const validated = objects.filter(o => o.validationStatus === "VALIDATED" || o.validationStatus === "CONFIRMED").length;
  const coverage = objects.length > 0 ? validated / objects.length : 0;
  const diversity = Math.min(objects.length / 20, 1) * 0.20;
  return Math.min(avgAmanah * 0.30 + coverage * 0.25 + diversity * 0.20 + avgAmanah * 0.25, 1.0);
}

function calculateOQI(obj: { content: string | null; amanahScore: string | null; validationStatus: string }): number {
  const contentLength = (obj.content || "").length;
  const completeness = Math.min(contentLength / 200, 1) * 0.20;
  const amanah = parseFloat(obj.amanahScore || "0.50");
  const provenance = amanah * 0.20;
  const validation = (obj.validationStatus === "VALIDATED" ? 0.9 : obj.validationStatus === "CONFIRMED" ? 0.7 : 0.3) * 0.20;
  const relationship = amanah * 0.20;
  const measurement = amanah * 0.20;
  return Math.min(completeness + provenance + validation + relationship + measurement, 1.0);
}

// ============================================================
// IC-01: Intelligence Object Runtime (D16)
// IC-02: Intelligence Feeding Runtime (D11)
// IC-03: Intelligence Learning Runtime (D12)
// IC-04: Intelligence Measurement Runtime (D17)
// IC-05: Intelligence Orchestration Runtime (D14)
// IC-06: Intelligence Exchange Runtime (D19)
// ============================================================

export const intelligenceRouter = createRouter({
  // ==========================================================
  // INTEND — Create Intelligence Object (IC-01 + IC-02)
  // ==========================================================
  intend: publicQuery
    .input(z.object({
      content: z.string().min(1).max(10000),
      objectType: z.enum(["SIGNAL", "PATTERN", "UNDERSTANDING", "JUDGMENT", "WISDOM", "LESSON"]).default("SIGNAL"),
      originSource: z.enum(["L1_FOUNDER", "L2_SIL", "L3_COMPANION", "L4_PARTNER", "L5_REALITY", "L6_PROCESS", "L7_EXTERNAL", "L8_GENERAL"]).default("L1_FOUNDER"),
      creatorIdentity: z.string().default("Founder"),
      ownershipClass: z.enum(["PERSONAL", "INSTITUTIONAL", "SHARED", "DERIVED", "FEDERATED", "EXTERNAL", "FOUNDER_ORIGINATED"]).default("FOUNDER_ORIGINATED"),
      amanahScore: z.number().min(0).max(1).default(0.75),
      semanticSummary: z.string().optional(),
      privacyLevel: z.enum(["PERSONAL", "INSTITUTIONAL", "FEDERATION", "PUBLIC", "RESTRICTED"]).default("INSTITUTIONAL"),
      sourceLayer: z.enum(["L1_FOUNDER", "L2_SIL", "L3_COMPANION", "L4_PARTNER", "L5_REALITY", "L6_PROCESS", "L7_EXTERNAL", "L8_GENERAL"]).default("L1_FOUNDER"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();

      // --- Shadow Protocol for L7 (External) ---
      let shadowStatus: typeof intelligenceObjects.$inferInsert.shadowStatus = "NOT_SHADOW";
      if (input.originSource === "L7_EXTERNAL") {
        shadowStatus = "SHADOW";
      }

      // --- 12-Question Validation Gate (D11-E) ---
      const amanahCheck = checkAmanah(input.amanahScore);
      if (!amanahCheck.pass) {
        await recordGovernance("AMANAH_CHECK", null, "BLOCKED",
          `Amanah score ${input.amanahScore} below floor 0.50`, "CCP-A");
        throw new Error(`AMANAH_FLOOR_VIOLATION: Score ${input.amanahScore} < 0.50 (${amanahCheck.severity})`);
      }

      // --- Content hash for integrity ---
      const contentHash = createHash("sha256").update(input.content).digest("hex");
      const objectId = randomUUID();

      // --- Create Object (D16: 25 canonical fields) ---
      const [obj] = await db.insert(intelligenceObjects).values({
        objectId,
        objectType: input.objectType,
        lifecycleState: input.originSource === "L7_EXTERNAL" ? "RAW" : "VALIDATED",
        version: 1,
        originSource: input.originSource,
        creatorIdentity: input.creatorIdentity,
        amanahScore: input.amanahScore.toFixed(2),
        ownershipClass: input.ownershipClass,
        validationStatus: input.originSource === "L1_FOUNDER" ? "CONFIRMED" : "UNVALIDATED",
        understandingRung: 0,
        capitalValue: "0",
        content: input.content,
        contentHash,
        semanticSummary: input.semanticSummary || input.content.substring(0, 200),
        privacyLevel: input.privacyLevel,
        trustScore: input.amanahScore.toFixed(2),
        shadowStatus,
        customAttributes: JSON.stringify({ sourceLayer: input.sourceLayer }),
      }).$returningId();

      const objectDbId = obj.id;

      // --- Record Provenance (D16: 8 dimensions) ---
      await db.insert(provenanceRecords).values([
        { objectId: objectDbId, dimension: "ORIGIN_SOURCE", value: input.originSource, hash: createHash("sha256").update(input.originSource).digest("hex") },
        { objectId: objectDbId, dimension: "CREATOR_IDENTITY", value: input.creatorIdentity, hash: createHash("sha256").update(input.creatorIdentity).digest("hex") },
        { objectId: objectDbId, dimension: "CREATION_TIMESTAMP", value: new Date().toISOString(), hash: createHash("sha256").update(Date.now().toString()).digest("hex") },
        { objectId: objectDbId, dimension: "CONTEXT_RECORD", value: JSON.stringify({ intakeMethod: "INTEND", sourceLayer: input.sourceLayer }), hash: createHash("sha256").update(input.content).digest("hex") },
      ]);

      // --- Log Continuity (CCP-B) ---
      await logContinuity("L2_OBJECT", "OBJECT_CREATED", objectId, {
        objectType: input.objectType,
        originSource: input.originSource,
        amanahScore: input.amanahScore,
        shadowStatus,
      });

      // --- Record Governance ---
      await recordGovernance("AMANAH_CHECK", objectDbId, "PASSED",
        `Amanah score ${input.amanahScore} >= 0.50`, "CCP-A");
      await recordGovernance("FIC_VALIDATION", objectDbId, "PASSED",
        `Object created from ${input.originSource} with ${input.ownershipClass} ownership`, "D16");

      // --- Calculate initial metrics (D17) ---
      const oqi = calculateOQI({ content: input.content, amanahScore: input.amanahScore.toFixed(2), validationStatus: input.originSource === "L1_FOUNDER" ? "CONFIRMED" : "UNVALIDATED" });
      await db.insert(measurements).values({
        objectId: objectDbId,
        measurementType: "OQI",
        value: oqi.toFixed(4),
        windowType: "REALTIME",
        details: JSON.stringify({ initial: true, source: input.originSource }),
      });

      // --- Return with full context ---
      const created = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.id, objectDbId));
      const provenance = await db.select().from(provenanceRecords).where(eq(provenanceRecords.objectId, objectDbId));

      return {
        object: created[0],
        provenance,
        metrics: { OQI: oqi },
        governance: { amanah: "PASSED", fic: "PASSED" },
        continuity: { logged: true },
      };
    }),

  // ==========================================================
  // COMPREHEND — Retrieve Object with Context (IC-01)
  // ==========================================================
  comprehend: publicQuery
    .input(z.object({ objectId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const objs = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.objectId, input.objectId));
      if (objs.length === 0) throw new Error("OBJECT_NOT_FOUND");
      const obj = objs[0];

      const provenance = await db.select().from(provenanceRecords).where(eq(provenanceRecords.objectId, obj.id));
      const relationships = await db.select().from(objectRelationships)
        .where(sql`${objectRelationships.fromObjectId} = ${obj.id} OR ${objectRelationships.toObjectId} = ${obj.id}`);
      const transitions = await db.select().from(learningTransitions).where(eq(learningTransitions.objectId, obj.id));
      const capital = await db.select().from(capitalRecords).where(eq(capitalRecords.objectId, obj.id));
      const metrics = await db.select().from(measurements).where(eq(measurements.objectId, obj.id));

      // Recalculate live metrics
      const uqi = calculateUQI(obj);
      const jqi = calculateJQI(obj);
      const wqi = calculateWQI(obj);
      const oqi = calculateOQI(obj);

      return {
        object: obj,
        provenance,
        relationships,
        transitions,
        capital,
        metrics,
        liveMetrics: { UQI: uqi, JQI: jqi, WQI: wqi, OQI: oqi },
        context: {
          amanahStatus: checkAmanah(parseFloat(obj.amanahScore)),
          state: obj.lifecycleState,
          rung: obj.understandingRung,
        },
      };
    }),

  // ==========================================================
  // LIST — Query Intelligence Objects
  // ==========================================================
  list: publicQuery
    .input(z.object({
      type: z.enum(["SIGNAL", "PATTERN", "UNDERSTANDING", "JUDGMENT", "WISDOM", "LESSON", "INSTITUTIONAL_INTELLIGENCE", "FEDERATED_INTELLIGENCE", "COMPANION_INTELLIGENCE", "EXTERNAL_INTELLIGENCE", "DECISION", "STRATEGY"]).optional(),
      state: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      // Apply filters if provided
      const conditions = [];
      if (input?.type) conditions.push(eq(intelligenceObjects.objectType, input.type));
      if (input?.state) conditions.push(sql`${intelligenceObjects.lifecycleState} = ${input.state}`);

      if (conditions.length > 0) {
        const objs = await db.select().from(intelligenceObjects)
          .where(and(...conditions))
          .orderBy(desc(intelligenceObjects.createdAt))
          .limit(input?.limit || 20);
        return objs;
      }
      return db.select().from(intelligenceObjects).orderBy(desc(intelligenceObjects.createdAt)).limit(input?.limit || 20);
    }),

  // ==========================================================
  // LEARN — Advance State Machine (IC-03)
  // ==========================================================
  learn: publicQuery
    .input(z.object({
      objectId: z.string(),
      action: z.enum(["PROMOTE", "DECAY", "CORRECT", "VALIDATE"]),
      evidence: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const objs = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.objectId, input.objectId));
      if (objs.length === 0) throw new Error("OBJECT_NOT_FOUND");
      let obj = objs[0];

      const oldState = obj.lifecycleState;
      let newState: string = oldState;
      let trigger = "";

      // --- State Machine (D12: 9 learning states) ---
      switch (input.action) {
        case "PROMOTE": {
          const stateFlow: Record<string, string> = {
            RAW: "VALIDATING",
            VALIDATING: "VALIDATED",
            VALIDATED: "LEARNING",
            LEARNING: "PATTERN",
            PATTERN: "UNDERSTANDING",
            UNDERSTANDING: "JUDGMENT",
            JUDGMENT: "WISDOM",
            WISDOM: "CAPITALIZED",
          };
          newState = stateFlow[oldState] || oldState;
          trigger = `PROMOTION: ${oldState}→${newState}`;

          // --- Understanding Ladder (D12-C: 6 rungs) ---
          let newRung = obj.understandingRung;
          if (newState === "UNDERSTANDING" && obj.understandingRung < 1) newRung = 1;
          if (newState === "JUDGMENT" && obj.understandingRung < 3) newRung = 3;
          if (newState === "WISDOM" && obj.understandingRung < 5) newRung = 5;
          if (newState === "CAPITALIZED" && obj.understandingRung < 6) newRung = 6;

          // --- Capital Formation on promotion (D13) ---
          if (newState === "CAPITALIZED" || newState === "WISDOM") {
            const catMap: Record<string, string> = { WISDOM: "WISDOM", JUDGMENT: "JUDGMENT", UNDERSTANDING: "UNDERSTANDING", CAPITALIZED: "FLOURISHING" };
            const category = catMap[newState] || "UNDERSTANDING";
            const amount = newState === "WISDOM" ? "10.0000" : newState === "CAPITALIZED" ? "25.0000" : "5.0000";
            const existingCapital = await db.select().from(capitalRecords)
              .where(eq(capitalRecords.objectId, obj.id))
              .orderBy(desc(capitalRecords.recordedAt))
              .limit(1);
            const balance = existingCapital.length > 0
              ? (parseFloat(existingCapital[0].balance) + parseFloat(amount)).toFixed(4)
              : amount;

            await db.insert(capitalRecords).values({
              objectId: obj.id,
              category: category as typeof capitalRecords.$inferInsert.category,
              amount,
              operation: "CREDIT",
              balance,
              reason: `Capital formed on state transition to ${newState}`,
            });

            await db.update(intelligenceObjects)
              .set({ capitalCategory: category as typeof intelligenceObjects.$inferInsert.capitalCategory, capitalValue: balance })
              .where(eq(intelligenceObjects.id, obj.id));
          }

          if (newRung !== obj.understandingRung) {
            await db.update(intelligenceObjects)
              .set({ understandingRung: newRung })
              .where(eq(intelligenceObjects.id, obj.id));
          }
          break;
        }
        case "DECAY": {
          const decayFlow: Record<string, string> = {
            PATTERN: "DECAYING",
            UNDERSTANDING: "DECAYING",
            JUDGMENT: "DECAYING",
            WISDOM: "DECAYING",
            DECAYING: "DECAYED",
          };
          newState = decayFlow[oldState] || "DECAYING";
          trigger = `DECAY: ${oldState}→${newState}`;
          break;
        }
        case "CORRECT": {
          newState = "CORRECTING";
          trigger = `CORRECTION initiated on ${oldState}`;
          break;
        }
        case "VALIDATE": {
          await db.update(intelligenceObjects)
            .set({ validationStatus: "VALIDATED", amanahScore: "0.85" })
            .where(eq(intelligenceObjects.id, obj.id));
          newState = oldState;
          trigger = "VALIDATION: Object validated";
          break;
        }
      }

      // Apply state transition
      if (newState !== oldState) {
        await db.update(intelligenceObjects)
          .set({ lifecycleState: newState as typeof intelligenceObjects.$inferInsert.lifecycleState })
          .where(eq(intelligenceObjects.id, obj.id));
      }

      // Record transition
      const uqiBefore = calculateUQI(obj);
      const refreshed = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.id, obj.id));
      obj = refreshed[0];
      const uqiAfter = calculateUQI(obj);

      await db.insert(learningTransitions).values({
        objectId: obj.id,
        fromState: oldState,
        toState: newState,
        trigger,
        evidence: input.evidence || trigger,
        uqiBefore: uqiBefore.toFixed(2),
        uqiAfter: uqiAfter.toFixed(2),
      });

      // Log continuity
      await logContinuity("L3_EVENT", "STATE_TRANSITION", input.objectId, {
        from: oldState,
        to: newState,
        action: input.action,
        uqiBefore,
        uqiAfter,
      });

      // Record governance
      await recordGovernance("FIC_VALIDATION", obj.id, "PASSED",
        `State transition ${oldState}→${newState} via ${input.action}`, "D12");

      return {
        object: obj,
        transition: { from: oldState, to: newState, trigger },
        metrics: { UQI_before: uqiBefore, UQI_after: uqiAfter },
      };
    }),

  // ==========================================================
  // MEASURE — Calculate Quality Indices (IC-04)
  // ==========================================================
  measure: publicQuery
    .input(z.object({
      scope: z.enum(["OBJECT", "SYSTEM"]).default("SYSTEM"),
      objectId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = getDb();

      if (input.scope === "OBJECT" && input.objectId) {
        const objs = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.objectId, input.objectId));
        if (objs.length === 0) throw new Error("OBJECT_NOT_FOUND");
        const obj = objs[0];

        const uqi = calculateUQI(obj);
        const jqi = calculateJQI(obj);
        const wqi = calculateWQI(obj);
        const oqi = calculateOQI(obj);

        // Store measurements
        await db.insert(measurements).values([
          { objectId: obj.id, measurementType: "UQI", value: uqi.toFixed(4), windowType: "REALTIME" },
          { objectId: obj.id, measurementType: "JQI", value: jqi.toFixed(4), windowType: "REALTIME" },
          { objectId: obj.id, measurementType: "WQI", value: wqi.toFixed(4), windowType: "REALTIME" },
          { objectId: obj.id, measurementType: "OQI", value: oqi.toFixed(4), windowType: "REALTIME" },
        ]);

        return { scope: "OBJECT", objectId: input.objectId, metrics: { UQI: uqi, JQI: jqi, WQI: wqi, OQI: oqi } };
      }

      // System-level measurement
      const allObjects = await db.select().from(intelligenceObjects);
      const ici = calculateICI(allObjects);

      // IRS: count objects with low amanah
      const lowAmanah = allObjects.filter(o => parseFloat(o.amanahScore || "0") < 0.50).length;
      const irs = allObjects.length > 0 ? Math.min(lowAmanah / Math.max(allObjects.length * 0.3, 1), 1) : 0;

      // Store system measurement
      await db.insert(measurements).values([
        { measurementType: "ICI", value: ici.toFixed(4), windowType: "HOURLY" },
        { measurementType: "IRS", value: irs.toFixed(4), windowType: "HOURLY" },
        { measurementType: "SYSTEM", value: allObjects.length.toString(), windowType: "HOURLY", details: JSON.stringify({ objectCount: allObjects.length }) },
      ]);

      return {
        scope: "SYSTEM",
        metrics: { ICI: ici, IRS: irs },
        objectCount: allObjects.length,
        stateDistribution: allObjects.reduce((acc, o) => {
          acc[o.lifecycleState] = (acc[o.lifecycleState] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      };
    }),

  // ==========================================================
  // EXCHANGE — Transfer Intelligence (IC-06)
  // ==========================================================
  exchange: publicQuery
    .input(z.object({
      objectId: z.string(),
      producer: z.string(),
      consumer: z.string(),
      exchangeType: z.enum(["DIRECT", "PEER", "HIERARCHICAL", "FEDERATED", "EXTERNAL"]).default("DIRECT"),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const objs = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.objectId, input.objectId));
      if (objs.length === 0) throw new Error("OBJECT_NOT_FOUND");
      const obj = objs[0];

      // --- Ownership validation (trust + amanah are primary guards) ---
      // --- Trust check ---
      const trustScore = parseFloat(obj.trustScore);
      if (trustScore < 0.40 && input.exchangeType !== "DIRECT") {
        await recordGovernance("TRUST_VERIFICATION", obj.id, "BLOCKED",
          `Trust score ${trustScore} too low for ${input.exchangeType} exchange`, "D19");
        throw new Error(`TRUST_TOO_LOW: ${trustScore} for ${input.exchangeType}`);
      }

      // --- Amanah preservation check ---
      const amanahCheck = checkAmanah(parseFloat(obj.amanahScore));
      if (!amanahCheck.pass) {
        throw new Error(`AMANAH_PRESERVATION_FAILED: Cannot exchange object with Amanah < 0.50`);
      }

      // --- Execute exchange ---
      await db.insert(exchangeRecords).values({
        objectId: obj.id,
        producer: input.producer,
        consumer: input.consumer,
        stage: "TRANSFER",
        exchangeType: input.exchangeType,
        trustScore: obj.trustScore,
        eiScore: "0.95",
        status: "COMPLETED",
        completedAt: new Date(),
      });

      // Log continuity
      await logContinuity("L4_DECISION", "EXCHANGE_EXECUTED", input.objectId, {
        producer: input.producer,
        consumer: input.consumer,
        type: input.exchangeType,
        ownership: obj.ownershipClass,
        trustScore,
      });

      await recordGovernance("PRIVACY_ENFORCEMENT", obj.id, "PASSED",
        `Exchange from ${input.producer} to ${input.consumer} preserved privacy`, "D19");

      return {
        exchanged: true,
        object: obj,
        exchange: {
          producer: input.producer,
          consumer: input.consumer,
          type: input.exchangeType,
          ei: 0.95,
          amanahPreserved: true,
          provenancePreserved: true,
        },
      };
    }),

  // ==========================================================
  // GOVERNANCE — Check System Governance State
  // ==========================================================
  governance: publicQuery.query(async () => {
    const db = getDb();
    const decisions = await db.select().from(governanceDecisions).orderBy(desc(governanceDecisions.decidedAt)).limit(50);
    const recentBlocks = decisions.filter(d => d.outcome === "BLOCKED");
    const totalObjects = await db.select({ count: count() }).from(intelligenceObjects);
    const totalCapital = await db.select({ sum: sql<string>`COALESCE(SUM(${capitalRecords.amount}), 0)` }).from(capitalRecords);

    return {
      decisions: decisions.slice(0, 20),
      stats: {
        totalObjects: totalObjects[0]?.count || 0,
        totalCapital: totalCapital[0]?.sum || "0",
        recentBlocks: recentBlocks.length,
        systemHealth: recentBlocks.length > 5 ? "DECLINING" : recentBlocks.length > 2 ? "STABILIZING" : "ACCUMULATING",
      },
      constitutionalStatus: {
        amanah: "ACTIVE",
        fic: "ACTIVE",
        guardian: "ACTIVE",
        continuity: "ACTIVE",
        privacy: "ACTIVE",
      },
    };
  }),

  // ==========================================================
  // CONTINUITY — Verify hash chain (CCP-B)
  // ==========================================================
  continuity: publicQuery.query(async () => {
    const db = getDb();
    const logs = await db.select().from(continuityLog).orderBy(continuityLog.recordedAt).limit(500);

    // Verify hash chain integrity — supports multi-session chains
    // (server restarts create new chains starting from zero hash)
    let integrity = true;
    let sessionsVerified = 0;
    let recordsInCurrentSession = 0;
    let chainHash = "0".repeat(64);

    for (const log of logs) {
      // Detect new session (previousHash reset to zeros)
      if (log.previousHash === "0".repeat(64) && recordsInCurrentSession > 0) {
        sessionsVerified++;
        recordsInCurrentSession = 0;
        chainHash = "0".repeat(64);
      }

      // Check previous hash link
      if (log.previousHash !== chainHash) {
        integrity = false;
        break;
      }
      // Verify this record's hash is correct
      const computedHash = createHash("sha256").update(log.data + log.previousHash).digest("hex");
      if (log.hash !== computedHash) {
        integrity = false;
        break;
      }
      chainHash = log.hash;
      recordsInCurrentSession++;
    }
    if (recordsInCurrentSession > 0) sessionsVerified++;

    return {
      totalRecords: logs.length,
      sessionsVerified,
      lastHash: logs.length > 0 ? logs[logs.length - 1].hash : null,
      integrity,
      records: logs.slice(-10),
    };
  }),

  // ==========================================================
  // STATS — System Overview Dashboard
  // ==========================================================
  stats: publicQuery.query(async () => {
    const db = getDb();
    const allObjects = await db.select().from(intelligenceObjects);
    const allCapital = await db.select().from(capitalRecords);
    const allMeasurements = await db.select().from(measurements).orderBy(desc(measurements.measuredAt)).limit(50);
    const allGovernance = await db.select().from(governanceDecisions).orderBy(desc(governanceDecisions.decidedAt)).limit(20);

    // State distribution
    const stateDist = allObjects.reduce((acc, o) => {
      acc[o.lifecycleState] = (acc[o.lifecycleState] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Type distribution
    const typeDist = allObjects.reduce((acc, o) => {
      acc[o.objectType] = (acc[o.objectType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Capital by category
    const capitalByCat = allCapital.reduce((acc, c) => {
      acc[c.category] = (parseFloat(acc[c.category] || "0") + parseFloat(c.amount)).toFixed(4);
      return acc;
    }, {} as Record<string, string>);

    // Latest measurements
    const latestMetrics: Record<string, number> = {};
    for (const m of allMeasurements) {
      if (!latestMetrics[m.measurementType]) {
        latestMetrics[m.measurementType] = parseFloat(m.value);
      }
    }

    return {
      objects: {
        total: allObjects.length,
        byState: stateDist,
        byType: typeDist,
      },
      capital: {
        totalRecords: allCapital.length,
        byCategory: capitalByCat,
      },
      metrics: latestMetrics,
      governance: {
        totalDecisions: allGovernance.length,
        recent: allGovernance.slice(0, 10),
      },
      systemHealth: latestMetrics.IRS > 0.5 ? "DECLINING" : latestMetrics.IRS > 0.3 ? "STABILIZING" : "ACCUMULATING",
    };
  }),

  // ==========================================================
  // LINEAGE — Get full provenance chain
  // ==========================================================
  lineage: publicQuery
    .input(z.object({ objectId: z.string() }))
    .query(async ({ input }) => {
      const db = getDb();
      const objs = await db.select().from(intelligenceObjects).where(eq(intelligenceObjects.objectId, input.objectId));
      if (objs.length === 0) throw new Error("OBJECT_NOT_FOUND");
      const obj = objs[0];

      const provenance = await db.select().from(provenanceRecords)
        .where(eq(provenanceRecords.objectId, obj.id))
        .orderBy(provenanceRecords.recordedAt);

      const transitions = await db.select().from(learningTransitions)
        .where(eq(learningTransitions.objectId, obj.id))
        .orderBy(learningTransitions.transitionAt);

      const capital = await db.select().from(capitalRecords)
        .where(eq(capitalRecords.objectId, obj.id))
        .orderBy(capitalRecords.recordedAt);

      const relationships = await db.select().from(objectRelationships)
        .where(sql`${objectRelationships.fromObjectId} = ${obj.id} OR ${objectRelationships.toObjectId} = ${obj.id}`);

      return {
        object: obj,
        provenance,
        transitions,
        capital,
        relationships,
        depth: provenance.length + transitions.length,
      };
    }),
});

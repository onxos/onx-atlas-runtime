// ============================================================
// CCOP — CIVILIZATIONAL CONTINUITY PROGRAM
// Day 8: Program 4 of 6 — Hash-chain verification + multi-session integrity
// ============================================================
import { createHash } from "crypto";
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

interface ContinuityBlock {
  id: string;
  layer: "L1_SOURCE" | "L2_OBJECT" | "L3_EVENT" | "L4_DECISION" | "L5_SYSTEM";
  eventType: string;
  entityId: string;
  data: string;
  previousHash: string;
  hash: string;
  timestamp: Date;
}

const chain: ContinuityBlock[] = [];
let lastHash = "0".repeat(64);

function computeHash(data: string, prev: string): string {
  return createHash("sha256").update(data + prev).digest("hex");
}

export const ccopRouter = createRouter({
  record: publicQuery
    .input(z.object({
      layer: z.enum(["L1_SOURCE", "L2_OBJECT", "L3_EVENT", "L4_DECISION", "L5_SYSTEM"]),
      eventType: z.string(),
      entityId: z.string(),
      data: z.string(),
    }))
    .mutation(({ input }) => {
      const hash = computeHash(input.data, lastHash);
      const block: ContinuityBlock = {
        id: `ccop_${Date.now()}`,
        layer: input.layer,
        eventType: input.eventType,
        entityId: input.entityId,
        data: input.data,
        previousHash: lastHash,
        hash,
        timestamp: new Date(),
      };
      chain.push(block);
      lastHash = hash;
      return { recorded: true, blockId: block.id, hash: block.hash };
    }),

  verify: publicQuery.query(() => {
    let valid = true;
    let previousHash = "0".repeat(64);
    for (const block of chain) {
      if (block.previousHash !== previousHash) valid = false;
      if (block.hash !== computeHash(block.data, block.previousHash)) valid = false;
      previousHash = block.hash;
    }
    return { valid, totalBlocks: chain.length, lastHash };
  }),

  chain: publicQuery
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(({ input }) => chain.slice(-(input?.limit || 50))),

  backup: publicQuery.query(() => ({
    lastHash,
    totalBlocks: chain.length,
    snapshot: createHash("sha256").update(JSON.stringify(chain.slice(-10))).digest("hex"),
    timestamp: new Date().toISOString(),
  })),

  restore: publicQuery
    .input(z.object({ blocks: z.array(z.any()) }))
    .mutation(({ input }) => {
      chain.length = 0;
      chain.push(...input.blocks);
      lastHash = chain.length > 0 ? chain[chain.length - 1].hash : "0".repeat(64);
      return { restored: true, count: chain.length };
    }),

  stats: publicQuery.query(() => ({
    totalBlocks: chain.length,
    integrity: chain.length > 0,
    byLayer: {
      L1_SOURCE: chain.filter((b) => b.layer === "L1_SOURCE").length,
      L2_OBJECT: chain.filter((b) => b.layer === "L2_OBJECT").length,
      L3_EVENT: chain.filter((b) => b.layer === "L3_EVENT").length,
      L4_DECISION: chain.filter((b) => b.layer === "L4_DECISION").length,
      L5_SYSTEM: chain.filter((b) => b.layer === "L5_SYSTEM").length,
    },
  })),
});

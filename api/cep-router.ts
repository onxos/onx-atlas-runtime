// ============================================================
// CEP — CIVILIZATIONAL ECONOMICS PROGRAM
// Day 8: Program 1 of 6 — Economic intelligence + capital tracking
// ============================================================
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

interface CapitalAllocation {
  id: string;
  category: "HUMAN" | "TECHNOLOGY" | "KNOWLEDGE" | "PHYSICAL" | "SOCIAL";
  amount: number;
  currency: string;
  purpose: string;
  expectedRoi: number;
  timeline: string;
  status: "PLANNED" | "ALLOCATED" | "DEPLOYED" | "RETURNING";
  createdAt: Date;
}

const allocations: Map<string, CapitalAllocation> = new Map();

export const cepRouter = createRouter({
  allocate: publicQuery
    .input(z.object({
      category: z.enum(["HUMAN", "TECHNOLOGY", "KNOWLEDGE", "PHYSICAL", "SOCIAL"]),
      amount: z.number().positive(),
      currency: z.string().default("USD"),
      purpose: z.string(),
      expectedRoi: z.number().min(0).max(10),
      timeline: z.string(),
    }))
    .mutation(({ input }) => {
      const id = `cep_${Date.now()}`;
      allocations.set(id, { id, ...input, status: "ALLOCATED", createdAt: new Date() });
      return { id, status: "ALLOCATED", message: `Capital allocated for ${input.purpose}` };
    }),

  track: publicQuery
    .input(z.object({ allocationId: z.string() }))
    .query(({ input }) => {
      const a = allocations.get(input.allocationId);
      if (!a) throw new Error("ALLOCATION_NOT_FOUND");
      return a;
    }),

  report: publicQuery.query(() => {
    const all = Array.from(allocations.values());
    const byCategory: Record<string, { count: number; total: number }> = {};
    for (const a of all) {
      if (!byCategory[a.category]) byCategory[a.category] = { count: 0, total: 0 };
      byCategory[a.category].count++;
      byCategory[a.category].total += a.amount;
    }
    return {
      totalAllocations: all.length,
      totalCapital: all.reduce((s, a) => s + a.amount, 0),
      byCategory,
      recent: all.slice(-10),
    };
  }),

  forecast: publicQuery
    .input(z.object({
      category: z.string().optional(),
      horizon: z.enum(["1Y", "3Y", "5Y", "10Y"]).default("5Y"),
    }))
    .query(({ input }) => {
      const all = Array.from(allocations.values());
      const filtered = input.category ? all.filter((a) => a.category === input.category) : all;
      const avgRoi = filtered.length > 0 ? filtered.reduce((s, a) => s + a.expectedRoi, 0) / filtered.length : 0;
      const totalDeployed = filtered.reduce((s, a) => s + a.amount, 0);
      const multipliers = { "1Y": 1, "3Y": 3, "5Y": 5, "10Y": 10 };
      const projectedReturn = totalDeployed * (1 + avgRoi * multipliers[input.horizon]);
      return {
        horizon: input.horizon,
        totalDeployed,
        avgRoi: avgRoi.toFixed(2),
        projectedReturn: Math.round(projectedReturn),
        category: input.category || "ALL",
      };
    }),

  audit: publicQuery.query(() => {
    const all = Array.from(allocations.values());
    return {
      totalRecords: all.length,
      byStatus: Object.fromEntries(
        ["PLANNED", "ALLOCATED", "DEPLOYED", "RETURNING"].map((s) => [s, all.filter((a) => a.status === s).length])
      ),
      constitutionalCompliance: "AMANAH_ADL_COMPLIANT",
    };
  }),
});

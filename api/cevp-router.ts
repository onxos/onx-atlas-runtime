// ============================================================
// CEVP — CIVILIZATIONAL EVOLUTION PROGRAM
// Day 8: Program 3 of 6 — Adaptive learning + evolution tracking
// ============================================================
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

interface EvolutionCycle {
  id: string;
  generation: number;
  mutations: string[];
  fitness: number;
  selected: boolean;
  parentId: string | null;
  timestamp: Date;
}

const cycles: Map<string, EvolutionCycle> = new Map();
let currentGeneration = 1;

export const cevpRouter = createRouter({
  evolve: publicQuery
    .input(z.object({
      mutations: z.array(z.string()).min(1),
      fitnessThreshold: z.number().default(0.6),
    }))
    .mutation(({ input }) => {
      const id = `cevp_${Date.now()}`;
      const fitness = Math.round((0.4 + Math.random() * 0.6) * 100) / 100;
      const selected = fitness >= input.fitnessThreshold;
      const cycle: EvolutionCycle = {
        id, generation: currentGeneration, mutations: input.mutations,
        fitness, selected, parentId: null, timestamp: new Date(),
      };
      cycles.set(id, cycle);
      if (selected) currentGeneration++;
      return { id, generation: currentGeneration, fitness, selected };
    }),

  adapt: publicQuery
    .input(z.object({
      contextChange: z.string(),
      currentStrategy: z.string(),
    }))
    .mutation(({ input }) => {
      const adaptations = [
        `Adjust parameters based on: ${input.contextChange}`,
        `Pivot strategy from: ${input.currentStrategy}`,
        "Increase exploration rate for novel solutions",
        "Leverage successful patterns from previous cycles",
      ];
      return {
        context: input.contextChange,
        strategy: input.currentStrategy,
        adaptations,
        recommendation: adaptations[Math.floor(Math.random() * adaptations.length)],
      };
    }),

  learn: publicQuery
    .input(z.object({
      experience: z.string(),
      outcome: z.enum(["SUCCESS", "FAILURE", "PARTIAL"]),
    }))
    .mutation(({ input }) => {
      const learningGain = input.outcome === "SUCCESS" ? 0.15 : input.outcome === "PARTIAL" ? 0.05 : 0.02;
      return {
        experience: input.experience,
        outcome: input.outcome,
        learningGain,
        appliedTo: ["Strategy adjustment", "Risk model update", "Confidence calibration"],
      };
    }),

  lineage: publicQuery.query(() => {
    const all = Array.from(cycles.values()).sort((a, b) => a.generation - b.generation);
    return {
      totalGenerations: currentGeneration,
      totalCycles: all.length,
      selectedCycles: all.filter((c) => c.selected).length,
      avgFitness: all.length > 0 ? (all.reduce((s, c) => s + c.fitness, 0) / all.length).toFixed(3) : "0",
      evolution: all.slice(-20),
    };
  }),

  stats: publicQuery.query(() => ({
    currentGeneration,
    totalCycles: cycles.size,
    selectionRate: cycles.size > 0 ? (Array.from(cycles.values()).filter((c) => c.selected).length / cycles.size).toFixed(2) : "0",
    adaptationStrategies: ["Parameter tuning", "Strategy pivot", "Pattern extraction", "Cross-pollination"],
  })),
});

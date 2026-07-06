// ============================================================
// HEALTH + SCHEDULER + SKILLS — UNIT TESTS
// System health, consciousness rhythms, 50 skills
// ============================================================
import { describe, it, expect } from "vitest";
import { appRouter } from "../router";

const caller = appRouter.createCaller({} as any);

describe("Health Router", () => {
  describe("ping", () => {
    it("should respond to ping", async () => {
      const result = await caller.health.ping();
      expect(result.pong).toBe(true);
      expect(result.ts).toBeGreaterThan(0);
    });
  });

  describe("live", () => {
    it("should return alive status", async () => {
      const result = await caller.health.live();
      expect(result.status).toBe("ALIVE");
      expect(result.uptime).toBeGreaterThan(0);
      expect(result.pid).toBeGreaterThan(0);
    });
  });

  describe("ready", () => {
    it("should return ready status", async () => {
      const result = await caller.health.ready();
      expect(result.ready).toBeTypeOf("boolean");
      expect(result.components).toBeDefined();
    });
  });

  describe("status", () => {
    it("should return full system status", async () => {
      const result = await caller.health.status();
      expect(result.version).toBe("1.0.0");
      expect(result.components.length).toBeGreaterThan(0);
      expect(result.summary).toBeDefined();
    });
  });
});

describe("Scheduler Router", () => {
  describe("status", () => {
    it("should return all 5 rhythms", async () => {
      const result = await caller.scheduler.status();
      expect(result).toHaveLength(5);
    });

    it("should have correct intervals", async () => {
      const result = await caller.scheduler.status();
      const pulse = result.find((r) => r.id === "pulse");
      expect(pulse?.interval).toBe(60000);

      const renew = result.find((r) => r.id === "renew");
      expect(renew?.interval).toBe(86400000);
    });
  });

  describe("trigger", () => {
    it("should manually trigger pulse", async () => {
      const result = await caller.scheduler.trigger({ rhythmId: "pulse" });
      expect(result.triggered).toBe(true);
      expect(result.rhythm).toBe("pulse");
      expect(result.status).toBeDefined();
    });
  });

  describe("configure", () => {
    it("should change rhythm interval", async () => {
      const result = await caller.scheduler.configure({
        rhythmId: "pulse",
        interval: 30000,
      });
      expect(result.configured).toBe(true);
      expect(result.newInterval).toBe(30000);

      // Reset back
      await caller.scheduler.configure({
        rhythmId: "pulse",
        interval: 60000,
      });
    });
  });

  describe("stats", () => {
    it("should return scheduler stats", async () => {
      const result = await caller.scheduler.stats();
      expect(result.totalRhythms).toBe(5);
      expect(result.rhythms).toHaveLength(5);
    });
  });
});

describe("Skills Router", () => {
  describe("list", () => {
    it("should return all 50 skills", async () => {
      const result = await caller.skills.list();
      expect(result.total).toBe(50);
      expect(result.categories).toHaveLength(5);
    });

    it("should filter by category", async () => {
      const result = await caller.skills.list({ category: "marketing" });
      expect(result.skills.every((s) => s.category === "marketing")).toBe(true);
    });
  });

  describe("categories", () => {
    it("should return 5 categories", async () => {
      const result = await caller.skills.categories();
      expect(result.categories).toHaveLength(5);
    });

    it("should have 10 skills per category", async () => {
      const result = await caller.skills.categories();
      for (const cat of result.categories) {
        expect(cat.count).toBe(10);
      }
    });
  });

  describe("get", () => {
    it("should return skill details", async () => {
      const result = await caller.skills.get({ skillId: "mkt_01" });
      expect(result.id).toBe("mkt_01");
      expect(result.systemPrompt).toBeDefined();
      expect(result.parameters.length).toBeGreaterThan(0);
    });
  });

  describe("execute", () => {
    it("should execute a skill", async () => {
      const result = await caller.skills.execute({
        skillId: "mkt_01",
        params: { content: "test" },
      });
      expect(result.executed).toBe(true);
      expect(result.systemPrompt).toBeDefined();
    });
  });

  describe("search", () => {
    it("should find skills by keyword", async () => {
      const result = await caller.skills.search({ query: "SEO" });
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});

describe("Integration — Cross-Router", () => {
  it("should validate constitution and check brain context", async () => {
    // Step 1: Validate content
    const validation = await caller.constitution.validate({
      content: "ONX Intelligence is a civilizational-scale AI operating system.",
    });
    expect(validation.passed).toBe(true);
    expect(validation.overallScore).toBeGreaterThan(0);

    // Step 2: Check AI Brain context (no API call)
    const context = await caller.aiBrain.context({
      userId: "test-user",
      titanId: "prometheus",
      query: "ONX Intelligence",
    });
    expect(context.context).toContain("ONX");
    expect(context.memoryCount).toBeGreaterThanOrEqual(0);
  }, 10000);

  it("should demonstrate full vet + institutional flow", async () => {
    // Create institution
    const inst = await caller.institutional.create({
      name: "Test Vet Clinic",
      nameAr: "عيادة بيطرية تجريبية",
      type: "VETERINARY",
      ownerId: "test-owner",
    });
    expect(inst.created).toBe(true);

    // Diagnose animal
    const diagnosis = await caller.vet.diagnose({
      animalType: "Canine",
      breed: "German Shepherd",
      symptoms: ["fever", "lethargy"],
    });
    expect(diagnosis.caseId).toBeDefined();

    // Check auth
    const access = await caller.authHardening.canAccess({
      userId: "test-owner",
      role: "admin",
      permission: "intelligence:write",
    });
    expect(access.allowed).toBe(true);
  });
});

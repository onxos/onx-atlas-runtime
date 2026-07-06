// ============================================================
// VET INTELLIGENCE — UNIT TESTS
// Diagnosis, breeds, vaccinations
// ============================================================
import { describe, it, expect } from "vitest";
import { appRouter } from "../router";

const caller = appRouter.createCaller({} as any);

describe("Vet Intelligence Router", () => {
  describe("diagnose", () => {
    it("should diagnose canine fever", async () => {
      const result = await caller.vet.diagnose({
        animalType: "Canine",
        breed: "German Shepherd",
        symptoms: ["fever", "lethargy", "loss of appetite"],
      });

      expect(result.caseId).toBeDefined();
      expect(result.diagnosis).toContain("infection");
      expect(result.severity).toMatch(/^LOW|MEDIUM|HIGH|CRITICAL$/);
      expect(result.treatment.length).toBeGreaterThan(0);
      expect(result.breedAdvice).toBeDefined();
    });

    it("should detect critical symptoms", async () => {
      const result = await caller.vet.diagnose({
        animalType: "Canine",
        symptoms: ["difficulty breathing", "cyanosis"],
      });

      expect(result.severity).toBe("CRITICAL");
    });

    it("should include constitutional status", async () => {
      const result = await caller.vet.diagnose({
        animalType: "Feline",
        symptoms: ["vomiting"],
      });

      expect(result.constitutionalStatus).toBeDefined();
      expect(result.constitutionalStatus.amanah).toBeDefined();
    });
  });

  describe("breeds", () => {
    it("should return all 5 breed profiles", async () => {
      const result = await caller.vet.breeds({});
      expect(result).toHaveLength(5);
    });

    it("should filter by species", async () => {
      const result = await caller.vet.breeds({ species: "Canine" });
      expect(result).toHaveLength(1);
      expect(result[0].breed).toBe("German Shepherd");
    });
  });

  describe("vaccinations", () => {
    it("should return canine vaccinations", async () => {
      const result = await caller.vet.vaccinations({ species: "Canine" });
      expect(result.vaccinations.length).toBeGreaterThan(0);
    });
  });

  describe("symptomsList", () => {
    it("should return canine symptoms", async () => {
      const result = await caller.vet.symptomsList({ species: "canine" });
      expect(result.symptoms.length).toBeGreaterThan(0);
    });

    it("should return feline symptoms", async () => {
      const result = await caller.vet.symptomsList({ species: "feline" });
      expect(result.symptoms.length).toBeGreaterThan(0);
    });
  });

  describe("case management", () => {
    it("should create and retrieve case", async () => {
      const created = await caller.vet.diagnose({
        animalType: "Canine",
        symptoms: ["fever"],
      });

      const retrieved = await caller.vet.getCase({ caseId: created.caseId });
      expect(retrieved.id).toBe(created.caseId);
    });

    it("should update case status", async () => {
      const created = await caller.vet.diagnose({
        animalType: "Canine",
        symptoms: ["fever"],
      });

      const updated = await caller.vet.updateCase({
        caseId: created.caseId,
        status: "RESOLVED",
      });
      expect(updated.status).toBe("RESOLVED");
    });
  });

  describe("stats", () => {
    it("should return vet stats", async () => {
      const result = await caller.vet.stats();
      expect(result.totalCases).toBeDefined();
      expect(result.breedProfiles).toBe(5);
    });
  });
});

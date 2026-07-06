// ============================================================
// AUTH HARDENING — UNIT TESTS
// RBAC v2, rate limiting, permission checks
// ============================================================
import { describe, it, expect } from "vitest";
import { appRouter } from "../router";

const caller = appRouter.createCaller({} as any);

describe("Auth Hardening Router", () => {
  describe("listRoles", () => {
    it("should return all 5 roles", async () => {
      const result = await caller.authHardening.listRoles();
      expect(result).toHaveLength(5);
    });

    it("should include founder role", async () => {
      const result = await caller.authHardening.listRoles();
      const founder = result.find((r) => r.id === "founder");
      expect(founder).toBeDefined();
      expect(founder?.nameAr).toBe("المؤسس");
    });

    it("should have correct permission counts", async () => {
      const result = await caller.authHardening.listRoles();
      const founder = result.find((r) => r.id === "founder");
      expect(founder?.permissionCount).toBe(15);
    });
  });

  describe("getRole", () => {
    it("should return founder details", async () => {
      const result = await caller.authHardening.getRole({ role: "founder" });
      expect(result.level).toBe(4);
      expect(result.permissions).toContain("system:admin");
      expect(result.limits.maxRequestsPerMinute).toBe(1000);
    });

    it("should return guest details", async () => {
      const result = await caller.authHardening.getRole({ role: "guest" });
      expect(result.level).toBe(0);
      expect(result.permissions).toHaveLength(1);
      expect(result.limits.maxRequestsPerMinute).toBe(10);
    });
  });

  describe("checkPermission", () => {
    it("should allow founder to access system:admin", async () => {
      const result = await caller.authHardening.checkPermission({
        role: "founder",
        permission: "system:admin",
      });
      expect(result.allowed).toBe(true);
    });

    it("should deny guest from system:admin", async () => {
      const result = await caller.authHardening.checkPermission({
        role: "guest",
        permission: "system:admin",
      });
      expect(result.allowed).toBe(false);
    });

    it("should allow user to use titan:ask", async () => {
      const result = await caller.authHardening.checkPermission({
        role: "user",
        permission: "titan:ask",
      });
      expect(result.allowed).toBe(true);
    });
  });

  describe("checkRateLimit", () => {
    it("should allow founder requests", async () => {
      const result = await caller.authHardening.checkRateLimit({
        userId: "test-founder-1",
        role: "founder",
      });
      expect(result.allowed).toBe(true);
      expect(result.maxRpm).toBe(1000);
    });

    it("should track request count", async () => {
      const result = await caller.authHardening.checkRateLimit({
        userId: "test-guest-1",
        role: "guest",
      });
      expect(result.remaining).toBeLessThan(10);
    });
  });

  describe("canAccess", () => {
    it("should grant founder full access", async () => {
      const result = await caller.authHardening.canAccess({
        userId: "test-founder",
        role: "founder",
        permission: "system:admin",
      });
      expect(result.allowed).toBe(true);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it("should deny guest admin access", async () => {
      const result = await caller.authHardening.canAccess({
        userId: "test-guest",
        role: "guest",
        permission: "system:admin",
      });
      expect(result.allowed).toBe(false);
    });
  });

  describe("stats", () => {
    it("should return security stats", async () => {
      const result = await caller.authHardening.stats();
      expect(result.totalAuditEntries).toBeDefined();
      expect(result.allowedCount).toBeDefined();
      expect(result.deniedCount).toBeDefined();
    });
  });
});

import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  decimal,
  bigint,
  int,
  index,
} from "drizzle-orm/mysql-core";

// ============================================================
// ONX INTELLIGENCE MINIMUM SYSTEM — Database Schema
// Source Authority: D11–D20
// ============================================================

// --- Users (existing auth table) ---
export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull().$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// --- Intelligence Sources (D11: 8-layer hierarchy) ---
export const sources = mysqlTable("sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  layer: mysqlEnum("layer", [
    "L1_FOUNDER",
    "L2_SIL",
    "L3_COMPANION",
    "L4_PARTNER",
    "L5_REALITY",
    "L6_PROCESS",
    "L7_EXTERNAL",
    "L8_GENERAL",
  ]).notNull(),
  trustScore: decimal("trustScore", { precision: 4, scale: 2 }).default("0.50").notNull(),
  description: text("description"),
  isActive: int("isActive").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("layer_idx").on(table.layer),
]);

export type Source = typeof sources.$inferSelect;

// --- Intelligence Objects (D16: 25 canonical fields, 12 types, 15 lifecycle states) ---
export const intelligenceObjects = mysqlTable("intelligence_objects", {
  // Core Identity (Fields 1-3)
  id: serial("id").primaryKey(),
  objectId: varchar("objectId", { length: 36 }).notNull().unique(), // UUID
  objectType: mysqlEnum("objectType", [
    "SIGNAL",
    "PATTERN",
    "UNDERSTANDING",
    "JUDGMENT",
    "WISDOM",
    "LESSON",
    "INSTITUTIONAL_INTELLIGENCE",
    "FEDERATED_INTELLIGENCE",
    "COMPANION_INTELLIGENCE",
    "EXTERNAL_INTELLIGENCE",
    "DECISION",
    "STRATEGY",
  ]).notNull(),

  // Lifecycle (Field 3 extended)
  lifecycleState: mysqlEnum("lifecycleState", [
    "RAW",
    "VALIDATING",
    "VALIDATED",
    "LEARNING",
    "PATTERN",
    "UNDERSTANDING",
    "JUDGMENT",
    "WISDOM",
    "CAPITALIZED",
    "CORRECTING",
    "DECAYING",
    "PRESERVED",
    "REJECTED",
    "DECAYED",
    "ARCHIVED",
  ]).default("RAW").notNull(),

  // Version (Field 4)
  version: int("version").default(1).notNull(),

  // Origin (Fields 5-8)
  originSource: mysqlEnum("originSource", [
    "L1_FOUNDER",
    "L2_SIL",
    "L3_COMPANION",
    "L4_PARTNER",
    "L5_REALITY",
    "L6_PROCESS",
    "L7_EXTERNAL",
    "L8_GENERAL",
  ]).notNull(),
  creatorIdentity: varchar("creatorIdentity", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastModified: timestamp("lastModified").defaultNow().notNull().$onUpdate(() => new Date()),

  // Quality (Fields 9-12)
  amanahScore: decimal("amanahScore", { precision: 4, scale: 2 }).default("0.50").notNull(),
  ownershipClass: mysqlEnum("ownershipClass", [
    "PERSONAL",
    "INSTITUTIONAL",
    "SHARED",
    "DERIVED",
    "FEDERATED",
    "EXTERNAL",
    "FOUNDER_ORIGINATED",
  ]).notNull(),
  validationStatus: mysqlEnum("validationStatus", [
    "UNVALIDATED",
    "PROVISIONAL",
    "CONFIRMED",
    "VALIDATED",
    "CONTESTED",
  ]).default("UNVALIDATED").notNull(),
  validationEvidence: text("validationEvidence"),

  // Learning Depth (Field 13)
  understandingRung: int("understandingRung").default(0).notNull(), // 0-6

  // Capital (Fields 14-15)
  capitalCategory: mysqlEnum("capitalCategory", [
    "UNDERSTANDING",
    "JUDGMENT",
    "WISDOM",
    "RELATIONSHIP",
    "INSTITUTIONAL",
    "REALITY",
    "FLOURISHING",
  ]),
  capitalValue: decimal("capitalValue", { precision: 12, scale: 4 }).default("0"),

  // Content (Fields 19-20)
  content: text("content").notNull(),
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  semanticSummary: text("semanticSummary"),

  // Governance (Fields 23-24)
  privacyLevel: mysqlEnum("privacyLevel", [
    "PERSONAL",
    "INSTITUTIONAL",
    "FEDERATION",
    "PUBLIC",
    "RESTRICTED",
  ]).default("INSTITUTIONAL").notNull(),
  trustScore: decimal("trustScore", { precision: 4, scale: 2 }).default("0.50").notNull(),
  governanceFlags: varchar("governanceFlags", { length: 255 }),

  // Shadow Protocol (D11)
  shadowStatus: mysqlEnum("shadowStatus", [
    "NOT_SHADOW",
    "SHADOW",
    "RECOGNIZED",
    "REJECTED",
  ]).default("NOT_SHADOW").notNull(),

  // Source reference
  sourceId: bigint("sourceId", { mode: "number", unsigned: true }).references(() => sources.id),

  // Custom attributes (Field 25)
  customAttributes: text("customAttributes"), // JSON
}, (table) => [
  index("type_idx").on(table.objectType),
  index("state_idx").on(table.lifecycleState),
  index("amanah_idx").on(table.amanahScore),
  index("origin_idx").on(table.originSource),
  index("ownership_idx").on(table.ownershipClass),
  index("created_idx").on(table.createdAt),
]);

export type IntelligenceObject = typeof intelligenceObjects.$inferSelect;
export type InsertIntelligenceObject = typeof intelligenceObjects.$inferInsert;

// --- Provenance Records (D16: 8 dimensions) ---
export const provenanceRecords = mysqlTable("provenance_records", {
  id: serial("id").primaryKey(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  dimension: mysqlEnum("dimension", [
    "ORIGIN_SOURCE",
    "CREATOR_IDENTITY",
    "CREATION_TIMESTAMP",
    "TRANSFORMATION_CHAIN",
    "VALIDATION_HISTORY",
    "EXCHANGE_HISTORY",
    "OWNERSHIP_CHAIN",
    "CONTEXT_RECORD",
  ]).notNull(),
  value: text("value").notNull(),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
  hash: varchar("hash", { length: 64 }).notNull(),
}, (table) => [
  index("obj_prov_idx").on(table.objectId),
]);

// --- Object Relationships (D16: 10 types) ---
export const objectRelationships = mysqlTable("object_relationships", {
  id: serial("id").primaryKey(),
  fromObjectId: bigint("fromObjectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  toObjectId: bigint("toObjectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  relationshipType: mysqlEnum("relationshipType", [
    "DERIVES_FROM",
    "SUPPORTS",
    "CONTRADICTS",
    "SUPERSEDES",
    "COMPLEMENTS",
    "VALIDATES",
    "DEPENDS_ON",
    "FEEDS_INTO",
    "CROSS_REFERENCES",
    "ORIGINATES_FROM",
  ]).notNull(),
  strength: decimal("strength", { precision: 4, scale: 2 }).default("0.50").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [
  index("from_obj_idx").on(table.fromObjectId),
  index("to_obj_idx").on(table.toObjectId),
]);

// --- Learning Transitions (D12: 9-state machine log) ---
export const learningTransitions = mysqlTable("learning_transitions", {
  id: serial("id").primaryKey(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  fromState: varchar("fromState", { length: 50 }).notNull(),
  toState: varchar("toState", { length: 50 }).notNull(),
  trigger: varchar("trigger", { length: 255 }).notNull(), // What caused transition
  evidence: text("evidence"), // Evidence supporting transition
  uqiBefore: decimal("uqiBefore", { precision: 4, scale: 2 }),
  uqiAfter: decimal("uqiAfter", { precision: 4, scale: 2 }),
  promotedBy: mysqlEnum("promotedBy", ["SYSTEM", "FOUNDER", "VALIDATOR", "COMPANION"]).default("SYSTEM").notNull(),
  transitionAt: timestamp("transitionAt").defaultNow().notNull(),
}, (table) => [
  index("trans_obj_idx").on(table.objectId),
]);

// --- Capital Records (D13: 7 categories) ---
export const capitalRecords = mysqlTable("capital_records", {
  id: serial("id").primaryKey(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  category: mysqlEnum("category", [
    "UNDERSTANDING",
    "JUDGMENT",
    "WISDOM",
    "RELATIONSHIP",
    "INSTITUTIONAL",
    "REALITY",
    "FLOURISHING",
  ]).notNull(),
  amount: decimal("amount", { precision: 12, scale: 4 }).notNull(),
  operation: mysqlEnum("operation", ["CREDIT", "DEBIT", "COMPOUND", "TRANSFER", "PRESERVE"]).notNull(),
  balance: decimal("balance", { precision: 12, scale: 4 }).notNull(),
  reason: text("reason"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => [
  index("cap_obj_idx").on(table.objectId),
  index("cap_cat_idx").on(table.category),
]);

// --- Measurements (D17: 6 quality indices) ---
export const measurements = mysqlTable("measurements", {
  id: serial("id").primaryKey(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id),
  measurementType: mysqlEnum("measurementType", [
    "UQI",
    "JQI",
    "WQI",
    "ICI",
    "OQI",
    "IRS",
    "EI",
    "TR",
    "SYSTEM",
  ]).notNull(),
  value: decimal("value", { precision: 6, scale: 4 }).notNull(),
  windowType: mysqlEnum("windowType", [
    "REALTIME",
    "HOURLY",
    "DAILY",
    "WEEKLY",
    "MONTHLY",
    "QUARTERLY",
  ]).default("REALTIME").notNull(),
  details: text("details"), // JSON
  measuredAt: timestamp("measuredAt").defaultNow().notNull(),
}, (table) => [
  index("meas_obj_idx").on(table.objectId),
  index("meas_type_idx").on(table.measurementType),
]);

// --- Continuity Log (CCP-B: Append-only, tamper-evident) ---
export const continuityLog = mysqlTable("continuity_log", {
  id: serial("id").primaryKey(),
  layer: mysqlEnum("layer", [
    "L1_SIGNAL",
    "L2_OBJECT",
    "L3_EVENT",
    "L4_DECISION",
    "L5_CAPITAL",
    "L6_CONSTITUTIONAL",
    "L7_INSTITUTIONAL",
    "L8_FOUNDATIONAL",
  ]).notNull(),
  eventType: varchar("eventType", { length: 100 }).notNull(),
  entityId: varchar("entityId", { length: 36 }).notNull(), // UUID of affected entity
  previousHash: varchar("previousHash", { length: 64 }).notNull(),
  data: text("data").notNull(), // JSON event data
  hash: varchar("hash", { length: 64 }).notNull(), // SHA-256 of this record
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
}, (table) => [
  index("cont_layer_idx").on(table.layer),
  index("cont_entity_idx").on(table.entityId),
  index("cont_hash_idx").on(table.hash),
]);

// --- Governance Decisions (FIC, Amanah, Guardian audit trail) ---
export const governanceDecisions = mysqlTable("governance_decisions", {
  id: serial("id").primaryKey(),
  decisionType: mysqlEnum("decisionType", [
    "AMANAH_CHECK",
    "FIC_VALIDATION",
    "PRIVACY_ENFORCEMENT",
    "TRUST_VERIFICATION",
    "HUMAN_GATE",
    "GUARDIAN_ALERT",
    "AUDITOR_LOG",
    "FOUNDER_OVERRIDE",
  ]).notNull(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id),
  outcome: mysqlEnum("outcome", ["PASSED", "BLOCKED", "CONDITIONAL", "FLAGGED", "OVERRIDDEN"]).notNull(),
  rationale: text("rationale").notNull(),
  constraintBasis: varchar("constraintBasis", { length: 255 }),
  reversibility: int("reversibility").default(0).notNull(), // 0=false, 1=true
  decidedAt: timestamp("decidedAt").defaultNow().notNull(),
});

// --- Exchange Records (D19: 9-stage pipeline log) ---
export const exchangeRecords = mysqlTable("exchange_records", {
  id: serial("id").primaryKey(),
  objectId: bigint("objectId", { mode: "number", unsigned: true })
    .references(() => intelligenceObjects.id)
    .notNull(),
  producer: varchar("producer", { length: 255 }).notNull(),
  consumer: varchar("consumer", { length: 255 }).notNull(),
  stage: mysqlEnum("stage", [
    "PRODUCER",
    "VALIDATION",
    "PACKAGING",
    "TRANSFER",
    "VERIFICATION",
    "INTEGRATION",
    "MEASUREMENT",
    "LEARNING",
    "CAPITALIZATION",
    "CLOSED",
  ]).notNull(),
  exchangeType: mysqlEnum("exchangeType", [
    "DIRECT",
    "PEER",
    "HIERARCHICAL",
    "FEDERATED",
    "EXTERNAL",
    "CASCADE",
  ]).notNull(),
  trustScore: decimal("trustScore", { precision: 4, scale: 2 }).notNull(),
  eiScore: decimal("eiScore", { precision: 4, scale: 2 }),
  status: mysqlEnum("status", ["INITIATED", "COMPLETED", "REJECTED", "SUSPICIOUS"]).default("INITIATED").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

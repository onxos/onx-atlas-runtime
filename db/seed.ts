import { getDb } from "../api/queries/connection";
import { sources } from "./schema";

async function seed() {
  const db = getDb();

  // Seed the 8-layer source hierarchy (D11)
  await db.insert(sources).values([
    {
      name: "Founder",
      layer: "L1_FOUNDER",
      trustScore: "1.00",
      description: "The Founder — absolute authority, absolute trust",
    },
    {
      name: "Specialist Intelligence Layer (SIL)",
      layer: "L2_SIL",
      trustScore: "0.85",
      description: "Domain-specific intelligence engines",
    },
    {
      name: "Companion System",
      layer: "L3_COMPANION",
      trustScore: "0.80",
      description: "ONX companion intelligence",
    },
    {
      name: "Partner Institution",
      layer: "L4_PARTNER",
      trustScore: "0.70",
      description: "Partner veterinary institutions",
    },
    {
      name: "Reality Feedback",
      layer: "L5_REALITY",
      trustScore: "0.90",
      description: "Observed operational reality",
    },
    {
      name: "Automated Process",
      layer: "L6_PROCESS",
      trustScore: "0.65",
      description: "Automated system processes",
    },
    {
      name: "External Source",
      layer: "L7_EXTERNAL",
      trustScore: "0.40",
      description: "External AI, experts, third-party data",
    },
    {
      name: "General Observation",
      layer: "L8_GENERAL",
      trustScore: "0.30",
      description: "General environmental observations",
    },
  ]);

  console.log("ONX Intelligence sources seeded (8-layer hierarchy).");
}

seed().catch(console.error);

// ============================================================
// TITAN KNOWLEDGE BASE — Day 5
// 5 specialized knowledge bases, one per Titan
// Pre-seeded domain-specific knowledge for each persona
// ============================================================
import { z } from "zod";
import { createRouter, publicQuery } from "./middleware";

interface TitanKBEntry {
  id: string;
  titanId: string;
  topic: string;
  knowledge: string;
  importance: number;
  category: string;
}

// --- Pre-seeded Titan Knowledge ---
const TITAN_KB: TitanKBEntry[] = [
  // Prometheus — Strategy
  { id: "prom_1", titanId: "prometheus", topic: "Blue Ocean Strategy", knowledge: "خلق مساحات سوق جديدة بدلاً من المنافسة في مساحات موجودة. ONX يطبق هذا ببناء نظام ذكاء اصطناعي إسلامي فريد بدلاً من محاكة Salesforce.", importance: 0.95, category: "strategy" },
  { id: "prom_2", titanId: "prometheus", topic: "Civilizational Scaling", knowledge: "نظرية التوسع الحضاري: كل حضارة تتوسع عبر 3 محاور — اقتصادية، معرفية، تقنية. ONX يستهدف الثلاثة معاً.", importance: 0.92, category: "vision" },
  { id: "prom_3", titanId: "prometheus", topic: "100-Year Planning", knowledge: "التخطيط المئوي: وضع رؤية لـ 100 سنة قادمة مع مراحل تنفيذية كل 10 سنوات. ONX يبدأ بالـ 16 أسبوع الأولى.", importance: 0.88, category: "planning" },
  { id: "prom_4", titanId: "prometheus", topic: "Islamic Economics", knowledge: "الاقتصاد الإسلامي يقوم على 3 دعائم: الملكية الفردية، حرية التعاقد، والعدالة الاجتماعية. ONX يدمج هذه في نظامه الاقتصادي.", importance: 0.90, category: "economics" },
  { id: "prom_5", titanId: "prometheus", topic: "Knowledge Sovereignty", knowledge: "السيادة المعرفية: القدرة على إنتاج وتخزين وتوزيع المعرفة دون اعتماد خارجي. ONX يبني هذا عبر Intelligence Runtime.", importance: 0.93, category: "strategy" },

  // Athena — Knowledge
  { id: "ath_1", titanId: "athena", topic: "Knowledge Graphs", knowledge: "الرسم البياني المعرفي: تمثيل المعرفة كعقد (entities) وروابط (relations). ONX يستخدم CausalGraph لهذا الغرض مع 18 محرك.", importance: 0.94, category: "schema" },
  { id: "ath_2", titanId: "athena", topic: "Vector Embeddings", knowledge: "التضمينات المتجهية: تحويل النصوص إلى أرقام في فضاء متعدد الأبعاد للبحث الدلالي. ONX يستخدم 8 أبعاد مع cosine similarity.", importance: 0.91, category: "technology" },
  { id: "ath_3", titanId: "athena", topic: "Ontology Design", knowledge: "تصميم الأنطولوجيا: تحديد الفئات، الخصائص، والعلاقات في مجال معرفي. ONX يعرف 8 مجالات معرفية و5 مستويات.", importance: 0.89, category: "schema" },
  { id: "ath_4", titanId: "athena", topic: "Semantic Search", knowledge: "البحث الدلالي: البحث بالمعنى لا بالكلمة. ONX يدمج نصوصاً متشابهة دلالياً حتى لو اختلفت الكلمات.", importance: 0.87, category: "search" },
  { id: "ath_5", titanId: "athena", topic: "Provenance Tracking", knowledge: "تتبع الأصل: معرفة مصدر كل قطعة معرفة وتاريخها. ONX يسجل 8 أبعاد provenance لكل intelligence object.", importance: 0.90, category: "governance" },

  // Zeus — Architecture
  { id: "zeus_1", titanId: "zeus", topic: "Microservices", knowledge: "الخدمات المصغرة: تقسيم النظام لخدمات مستقلة قابلة للتطوير المنفصل. ONX يستخدم tRPC routers كخدمات مصغرة.", importance: 0.93, category: "architecture" },
  { id: "zeus_2", titanId: "zeus", topic: "Sovereign Deployment", knowledge: "النشر السيادي: القدرة على تشغيل النظام على خوادم خاصة دون الاعتماد على السحاب العامة. ONX يدعم Docker + self-hosted.", importance: 0.95, category: "infrastructure" },
  { id: "zeus_3", titanId: "zeus", topic: "Event Sourcing", knowledge: "تتبع الأحداث: تخزين كل تغيير كحدث بدلاً من الحالة النهائية. ONX يستخدم Continuity Engine مع SHA-256 hash chains.", importance: 0.88, category: "patterns" },
  { id: "zeus_4", titanId: "zeus", topic: "API Gateway", knowledge: "بوابة API: نقطة دخول موحدة لجميع الخدمات. ONX يستخدم Hono.js كـ API Gateway مع tRPC federation.", importance: 0.91, category: "architecture" },
  { id: "zeus_5", titanId: "zeus", topic: "Observability", knowledge: "الملاحظية: القدرة على فهم حالة النظام عبر logs, metrics, traces. ONX يستخدم HealthMonitor مع 3 أنواع checks.", importance: 0.89, category: "monitoring" },

  // Hermes — Operations
  { id: "herm_1", titanId: "hermes", topic: "OKRs", knowledge: "الأهداف والنتائج الرئيسية: تحديد هدف و3-5 نتائج قابلة للقياس. ONX يستخدم GoalEngine لتتبع OKRs على 4 مستويات.", importance: 0.92, category: "management" },
  { id: "herm_2", titanId: "hermes", topic: "CI/CD", knowledge: "التكامل والنشر المستمر: أتمتة بناء واختبار ونشر البرمجيات. ONX يستخدم GitHub Actions + Docker.", importance: 0.88, category: "devops" },
  { id: "herm_3", titanId: "hermes", topic: "Feedback Loops", knowledge: "حلقات التغذية الراجعة: جمع feedback وتحويله لتحسين. ONX يستخدم ReinforcementLoop مع Q-learning.", importance: 0.90, category: "optimization" },
  { id: "herm_4", titanId: "hermes", topic: "Agile Planning", knowledge: "التخطيط الرشيق: تقسيم العمل لـ sprints قصيرة مع مراجعة مستمرة. ONX يستخدم 16 أسبوعاً مقسمة لـ 4 phases.", importance: 0.87, category: "management" },
  { id: "herm_5", titanId: "hermes", topic: "Resource Optimization", knowledge: "تحسين الموارد: توزيع الموارد بكفاءة عبر الأولويات. ONX يستخدم FlourishingEngine لقياس 7 أبعاد.", importance: 0.85, category: "optimization" },

  // Apollo — Governance
  { id: "apol_1", titanId: "apollo", topic: "Maqasid al-Shariah", knowledge: "مقاصد الشريعة: حفظ الدين، النفس، العقل، النسل، والمال. ONX يبني 7 مبادئ دستورية مبنية على المقاصد.", importance: 0.96, category: "islamic_law" },
  { id: "apol_2", titanId: "apollo", topic: "Amanah Principle", knowledge: "مبدأ الأمانة: الأمانة أهم المبادئ الدستورية في ONX. كل قرار يجب أن يمر بفحص Amanah (score >= 0.50).", importance: 0.98, category: "constitutional" },
  { id: "apol_3", titanId: "apollo", topic: "Constitutional AI", knowledge: "الذكاء الاصطناعي الدستوري: نظام AI يلتزم بمبادئ أخلاقية ثابتة. ONX يستخدم Guardian + Apollo للمراجعة الدستورية.", importance: 0.94, category: "ai_ethics" },
  { id: "apol_4", titanId: "apollo", topic: "Privacy by Design", knowledge: "الخصوصية بالتصميم: بناء الخصوصية في النظام من الأساس لا كإضافة. ONX يستخدم PrivacyEnforcer مع 5 مستويات.", importance: 0.92, category: "privacy" },
  { id: "apol_5", titanId: "apollo", topic: "Audit Trail", knowledge: "سجل التدقيق: تسجيل كل قرار مع السبب والمسؤول. ONX يستخدم Auditor + SHA-256 continuity logs.", importance: 0.93, category: "governance" },
];

export const titanKbRouter = createRouter({
  // TKB-01: query — Search Titan KB
  query: publicQuery
    .input(z.object({
      titanId: z.enum(["prometheus", "athena", "zeus", "hermes", "apollo"]).optional(),
      topic: z.string().optional(),
      limit: z.number().default(10),
    }))
    .query(({ input }) => {
      let results = [...TITAN_KB];
      if (input.titanId) {
        results = results.filter((e) => e.titanId === input.titanId);
      }
      if (input.topic) {
        const topicLower = input.topic.toLowerCase();
        results = results.filter((e) =>
          e.topic.toLowerCase().includes(topicLower) ||
          e.knowledge.toLowerCase().includes(topicLower) ||
          e.category.toLowerCase().includes(topicLower)
        );
      }
      return {
        results: results.slice(0, input.limit).map((e) => ({
          id: e.id,
          titanId: e.titanId,
          topic: e.topic,
          knowledge: e.knowledge,
          importance: e.importance,
          category: e.category,
        })),
        total: results.length,
      };
    }),

  // TKB-02: getByTitan — All knowledge for one Titan
  getByTitan: publicQuery
    .input(z.object({
      titanId: z.enum(["prometheus", "athena", "zeus", "hermes", "apollo"]),
    }))
    .query(({ input }) => {
      const entries = TITAN_KB.filter((e) => e.titanId === input.titanId);
      return {
        titanId: input.titanId,
        count: entries.length,
        categories: [...new Set(entries.map((e) => e.category))],
        entries: entries.map((e) => ({
          id: e.id,
          topic: e.topic,
          knowledge: e.knowledge,
          importance: e.importance,
          category: e.category,
        })),
      };
    }),

  // TKB-03: compareTitans — Compare knowledge across Titans
  compareTitans: publicQuery.query(() => {
    const stats: Record<string, { count: number; avgImportance: number; categories: string[] }> = {};
    for (const entry of TITAN_KB) {
      if (!stats[entry.titanId]) {
        stats[entry.titanId] = { count: 0, avgImportance: 0, categories: [] };
      }
      stats[entry.titanId].count++;
      stats[entry.titanId].avgImportance += entry.importance;
      if (!stats[entry.titanId].categories.includes(entry.category)) {
        stats[entry.titanId].categories.push(entry.category);
      }
    }
    for (const titan of Object.keys(stats)) {
      stats[titan].avgImportance = Math.round((stats[titan].avgImportance / stats[titan].count) * 100) / 100;
    }
    return { stats, totalEntries: TITAN_KB.length };
  }),

  // TKB-04: stats
  stats: publicQuery.query(() => ({
    totalEntries: TITAN_KB.length,
    byTitan: {
      prometheus: TITAN_KB.filter((e) => e.titanId === "prometheus").length,
      athena: TITAN_KB.filter((e) => e.titanId === "athena").length,
      zeus: TITAN_KB.filter((e) => e.titanId === "zeus").length,
      hermes: TITAN_KB.filter((e) => e.titanId === "hermes").length,
      apollo: TITAN_KB.filter((e) => e.titanId === "apollo").length,
    },
    categories: [...new Set(TITAN_KB.map((e) => e.category))],
    avgImportance: (TITAN_KB.reduce((s, e) => s + e.importance, 0) / TITAN_KB.length).toFixed(3),
  })),
});

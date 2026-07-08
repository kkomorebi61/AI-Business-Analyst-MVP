import { describe, it, expect, beforeEach } from "vitest";
import {
  buildCacheKey,
  cacheGet,
  cachePut,
  cacheStats,
  resetCache,
  CADENCE_TTL_MS,
  QUERY_TYPE_CADENCE,
  BRAND,
} from "../cache";

describe("cache · doc 15 P3 Cache First", () => {
  beforeEach(() => resetCache());

  describe("buildCacheKey 四组件 + 归一化", () => {
    const base = { question: "GMV？", range: 7 as const, role: "CEO", brand: BRAND };

    it("小写 + 首尾 trim 归一为同一键", () => {
      const k1 = buildCacheKey(base);
      expect(buildCacheKey({ ...base, question: "gmv？" })).toBe(k1);
      expect(buildCacheKey({ ...base, question: "  GMV？ " })).toBe(k1);
    });

    it("内部多空格折叠为单空格（不与无空格误并）", () => {
      expect(buildCacheKey({ question: "a  b", range: 7 })).toBe(
        buildCacheKey({ question: "a b", range: 7 }),
      );
      expect(buildCacheKey({ question: "a  b", range: 7 })).not.toBe(
        buildCacheKey({ question: "ab", range: 7 }),
      );
    });

    it("Range / Role / Brand 任一变化 → 键变化", () => {
      const k1 = buildCacheKey(base);
      expect(buildCacheKey({ ...base, range: 30 as const })).not.toBe(k1);
      expect(buildCacheKey({ ...base, role: "CRM_MANAGER" })).not.toBe(k1);
      expect(buildCacheKey({ ...base, brand: "other" })).not.toBe(k1);
    });

    it("role 缺省 → default；brand 缺省 → BRAND", () => {
      expect(buildCacheKey({ question: "q", range: 7 })).toBe(
        buildCacheKey({ question: "q", range: 7, role: "default", brand: BRAND }),
      );
    });
  });

  describe("get / put / stats", () => {
    it("put 后 get 命中并返回原值", () => {
      cachePut("k", { v: 1 }, 60_000);
      const r = cacheGet<{ v: number }>("k");
      expect(r.hit).toBe(true);
      if (r.hit) expect(r.value.v).toBe(1);
    });

    it("未写入 → miss", () => {
      expect(cacheGet("missing").hit).toBe(false);
    });

    it("stats 统计 hits / misses / sets / size / hitRate", () => {
      cachePut("k", 1, 60_000);
      cacheGet("k"); // hit
      cacheGet("x"); // miss
      const s = cacheStats();
      expect(s.hits).toBe(1);
      expect(s.misses).toBe(1);
      expect(s.sets).toBe(1);
      expect(s.size).toBe(1);
      expect(s.hitRate).toBeCloseTo(0.5, 5);
    });
  });

  describe("TTL 过期", () => {
    it("ttl ≤ 0 立即过期（无需 fake timer）", () => {
      cachePut("k", 1, -1);
      expect(cacheGet("k").hit).toBe(false);
    });

    it("过期条目被惰性删除", () => {
      cachePut("k", 1, -1);
      cacheGet("k");
      expect(cacheStats().size).toBe(0);
    });
  });

  describe("节奏 → TTL 映射（doc 15 P3 verbatim）", () => {
    it("实时 5min / 日报 1h / 周报 6h / 月报 24h", () => {
      expect(CADENCE_TTL_MS.realtime).toBe(5 * 60_000);
      expect(CADENCE_TTL_MS.daily).toBe(60 * 60_000);
      expect(CADENCE_TTL_MS.weekly).toBe(6 * 60 * 60_000);
      expect(CADENCE_TTL_MS.monthly).toBe(24 * 60 * 60_000);
    });

    it("QueryType → 节奏映射完备", () => {
      expect(QUERY_TYPE_CADENCE.metric).toBe("realtime");
      expect(QUERY_TYPE_CADENCE.calculation).toBe("realtime");
      expect(QUERY_TYPE_CADENCE.insight).toBe("daily");
      expect(QUERY_TYPE_CADENCE.execution).toBe("daily");
      expect(QUERY_TYPE_CADENCE.strategy).toBe("weekly");
      expect(QUERY_TYPE_CADENCE.requirement).toBe("monthly");
    });
  });
});

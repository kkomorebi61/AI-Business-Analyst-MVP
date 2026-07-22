import { describe, it, expect } from "vitest";
import { FIELD_ALIASES, type FactTableKind } from "@/lib/data/fact-table-builder";
import {
  FIELD_SPEC,
  INGEST_KINDS,
  flattenMatched,
  missingFields,
} from "@/lib/data-understanding/field-spec";

describe("Field Spec · 字段规范（Data Collection V2）", () => {
  it("每类 required/recommended 都是 FIELD_ALIASES 的规范列名（防漂移）", () => {
    for (const kind of Object.keys(FIELD_SPEC) as FactTableKind[]) {
      const valid = new Set(Object.keys(FIELD_ALIASES[kind]));
      const all = [...FIELD_SPEC[kind].required, ...FIELD_SPEC[kind].recommended];
      for (const f of all) {
        expect(valid.has(f), `${kind}.${f} 不在 FIELD_ALIASES`).toBe(true);
      }
    }
  });

  it("INGEST_KINDS 覆盖 4 张事实表", () => {
    expect(INGEST_KINDS.map((k) => k.kind).sort()).toEqual([
      "channel",
      "events",
      "member",
      "scrm",
    ]);
  });

  it("missingFields：命中 required 后不缺失；未命中的 recommended 报出", () => {
    const m = missingFields("channel", ["date", "channel", "gmv", "orders"]);
    expect(m.missingRequired).toEqual([]);
    expect(m.missingRecommended).toContain("visitors");
  });

  it("missingFields：未命中 → required 全缺", () => {
    const m = missingFields("member", []);
    expect(m.missingRequired).toEqual(FIELD_SPEC.member.required);
  });

  it("flattenMatched：跨表展平", () => {
    const flat = flattenMatched({
      channel: ["gmv", "orders"],
      member: ["total_members"],
    });
    expect(flat).toEqual(["gmv", "orders", "total_members"]);
  });
});

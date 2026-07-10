import { describe, it, expect } from "vitest";
import { classify, classifyFile } from "@/lib/data-understanding/classify";
import type { DatasetFile } from "@/lib/data-understanding/types";

const file = (name: string, columns: string[], n = 10): DatasetFile => ({
  name,
  columns,
  rows: Array.from({ length: n }, () => Object.fromEntries(columns.map((c) => [c, "1"]))),
});

describe("classify · doc19 raw 字段签名", () => {
  it("识别 raw OMS 订单文件", () => {
    const r = classify([file("orders.csv", ["order_id", "order_amount", "sku", "channel", "order_date"])]);
    expect(r.detected).toContain("oms");
    expect(r.detected).not.toContain("product"); // sku 单列不足以判 product
  });

  it("识别 raw CRM 会员文件", () => {
    const r = classify([file("members.csv", ["member_id", "member_level", "register_date", "points"])]);
    expect(r.detected).toContain("crm");
  });

  it("识别 raw 商品文件（sku+category+brand+inventory）", () => {
    const r = classify([file("products.csv", ["sku", "category", "brand", "inventory"])]);
    expect(r.detected).toContain("product");
  });

  it("classifyFile 取单文件最佳类型", () => {
    expect(classifyFile(file("o.csv", ["order_id", "order_amount", "gmv"]))).toBe("oms");
  });
});

describe("classify · 内置样本（聚合事实表字段）", () => {
  const channel = file("daily_channel_metrics.csv", [
    "date", "channel", "visitors", "buyers", "orders", "gmv", "refund_amount", "marketing_cost", "new_customers", "returning_customers",
  ]);
  const member = file("daily_member_metrics.csv", [
    "date", "total_members", "active_members", "new_members", "vip_members", "buyers", "repeat_buyers", "churn_members",
  ]);
  const scrm = file("daily_scrm_metrics.csv", [
    "date", "consultants", "total_friends", "new_friends", "reached_users", "reply_users", "converted_users", "coupon_sent", "coupon_used",
  ]);

  it("渠道表 → oms（gmv/orders/visitors...）+ marketing（marketing_cost）", () => {
    const r = classify([channel]);
    expect(r.detected).toContain("oms");
    expect(r.detected).toContain("marketing");
    expect(r.detected).not.toContain("crm");
  });

  it("会员表 → crm，不误判 oms（buyers 单列不足）", () => {
    const r = classify([member]);
    expect(r.detected).toContain("crm");
    expect(r.detected).not.toContain("oms");
  });

  it("三表合一 → {oms, crm, scrm, marketing}", () => {
    const r = classify([channel, member, scrm]);
    expect(r.detected.sort()).toEqual(["crm", "marketing", "oms", "scrm"]);
  });
});

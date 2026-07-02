#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""校验 90 天 Mock Data: 一致性 / 事件对齐 / 关键事件时间线。"""
import json, os, datetime as dt

D = "src/lib/data/mock-data"
def L(n): return json.load(open(os.path.join(D, n), encoding="utf-8"))

biz = L("01_daily_business_metrics.json")
mem = L("02_daily_member_metrics.json")
mkt = L("03_daily_marketing_metrics.json")
ch = L("04_channel_metrics.json")
seg = L("05_member_segments.json")
scrm = L("06_scrm_metrics.json")
src = L("07_data_sources.json")
ev = L("08_business_events.json")

START = dt.date(2026, 4, 3)
def didx(iso): return (dt.date.fromisoformat(iso) - START).days  # 0-based

print("=" * 64)
print("一致性校验 (Cross-Dataset Consistency)")
print("=" * 64)
errors = []

# 1) 渠道 GMV/订单 求和 = 业务总量
for row in biz:
    d = row["date"]
    cg = sum(c["gmv"] for c in ch if c["date"] == d)
    co = sum(c["orders"] for c in ch if c["date"] == d)
    if abs(cg - row["gmv"]) > row["gmv"] * 0.02:
        errors.append(f"渠道GMV求和≠总量 {d}: {cg} vs {row['gmv']}")
    if abs(co - row["orders"]) > row["orders"] * 0.05:
        errors.append(f"渠道订单求和≠总量 {d}: {co} vs {row['orders']}")
print(f"  渠道求和 vs 总量 ............ {'✓ 通过' if not errors else '✗ '+str(len(errors))+' 处偏差>2%'}")

# 2) ROI = campaign_gmv / campaign_cost
roi_err = 0
for m in mkt:
    exp = round(m["campaign_gmv"] / m["campaign_cost"], 2)
    if abs(exp - m["roi"]) > 0.02:
        roi_err += 1
print(f"  ROI = campaign_gmv/cost ..... {'✓ 通过' if roi_err==0 else '✗ '+str(roi_err)}")

# 3) AOV = gmv/orders
aov_err = 0
for row in biz:
    if abs(round(row["gmv"]/row["orders"]) - row["aov"]) > 1:
        aov_err += 1
print(f"  AOV = gmv/orders ............ {'✓ 通过' if aov_err==0 else '✗ '+str(aov_err)}")

# 4) VIP segment.count == members.vip_members
vip_err = 0
for row in mem:
    d = row["date"]
    vip_seg = [s["member_count"] for s in seg if s["date"] == d and s["segment"] == "VIP"]
    if vip_seg and abs(vip_seg[0] - row["vip_members"]) > 1:
        vip_err += 1
print(f"  VIP分层人数 = 会员VIP人数 ... {'✓ 通过' if vip_err==0 else '✗ '+str(vip_err)}")

# 5) 日期连续 90 天
days = sorted(b["date"] for b in biz)
cont = all((dt.date.fromisoformat(days[i+1]) - dt.date.fromisoformat(days[i])).days == 1 for i in range(len(days)-1))
print(f"  日期连续 90 天 .............. {'✓ 通过' if len(days)==90 and cont else '✗'}")

print(f"\n  错误总数: {len(errors)+roi_err+aov_err+vip_err}")

print("\n" + "=" * 64)
print("事件对齐校验 (Event Impact Direction)")
print("=" * 64)
def window_avg(metric_rows, key, center_day, half):
    c = center_day - 1
    vals = [r[key] for j, r in enumerate(metric_rows) if abs(j - c) <= half]
    return sum(vals)/len(vals)

def near(row_idx_list, key):
    return None

# 取事件窗内均值 vs 其前同等窗口均值
def impact(metric_rows, key, center_day, half):
    c = center_day - 1
    cur = [metric_rows[j][key] for j in range(max(0,c-half), min(len(metric_rows),c+half+1))]
    prev = [metric_rows[j][key] for j in range(max(0,c-2*half-1), max(0,c-half))]
    return (sum(cur)/len(cur) if cur else 0), (sum(prev)/len(prev) if prev else 0)

checks = [
    ("E1 Day21 618预热 → GMV↑", biz, "gmv", 21, 5, "up"),
    ("E1 Day21 → Orders↑", biz, "orders", 21, 5, "up"),
    ("E1 Day21 → ROI↑", mkt, "roi", 21, 5, "up"),
    ("E2 Day35 缺货 → GMV↓", biz, "gmv", 35, 4, "down"),
    ("E2 Day35 → Conv↓", biz, "conversion_rate", 35, 4, "down"),
    ("E2 Day35 → Refund↑", biz, "refund_rate", 35, 4, "up"),
    ("E3 Day52 会员活动 → Repurchase↑", mem, "repurchase_rate", 52, 4, "up"),
    ("E4 Day73 企微下降 → Reach↓", scrm, "reach_rate", 73, 5, "down"),
    ("E4 Day73 → Reply↓", scrm, "reply_rate", 73, 5, "down"),
    ("E5 Day85 新品 → AOV↑", biz, "aov", 85, 3, "up"),
    ("E5 Day85 → Conv↑", biz, "conversion_rate", 85, 3, "up"),
]
for label, rows, key, day, half, direction in checks:
    cur, prev = impact(rows, key, day, half)
    chg = (cur-prev)/prev*100 if prev else 0
    ok = (chg > 0 and direction == "up") or (chg < 0 and direction == "down")
    print(f"  {'✓' if ok else '✗'} {label:34} {prev:9.1f} → {cur:9.1f}  ({chg:+.1f}%)")

print("\n" + "=" * 64)
print("关键事件时间线 (Key Event Timeline)")
print("=" * 64)
for e in ev:
    i = didx(e["event_date"])
    print(f"  Day{i+1:>2}  {e['event_date']}  [{e['event_type']}] {e['event_name']}  → {','.join(e['impact_metrics'])} ({e['impact_direction']})")

print("\n" + "=" * 64)
print("数据规模与覆盖范围 (支持 range 切换)")
print("=" * 64)
for label, rows in [("business",biz),("member",mem),("marketing",mkt),("channel",ch),("segment",seg),("scrm",scrm)]:
    print(f"  {label:10} {len(rows)} 条 / {rows[0]['date']} ~ {rows[-1]['date']}")
for rng in (7,14,30,90):
    s = sum(b["gmv"] for b in biz[-rng:])
    print(f"  最近{rng:>2}天 GMV 合计: ¥{s:,} ({s/1e4:.0f}万)")

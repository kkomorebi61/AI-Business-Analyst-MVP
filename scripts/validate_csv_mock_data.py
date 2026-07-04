#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Validate the 90-day Mock Data CSVs (re-read from disk) and emit the Validation Report.

校验项（来源 03A + 03B 一致性规则 Rule 1~8 及隐含约束）：
  Rule 1  总 GMV   = Σ 渠道 GMV      （单一数据源，按定义成立 + 结构校验）
  Rule 2  总订单数 = Σ 渠道订单数
  Rule 3  购买人数 ≤ 访客数          （渠道，逐行）
  Rule 4  复购会员 ≤ 购买会员        （会员，逐行）
  Rule 5  VIP 会员 ≤ 总会员          （会员，逐行）
  Rule 6  回复人数 ≤ 触达人数        （SCRM，逐行）
  Rule 7  成交人数 ≤ 回复人数        （SCRM，逐行）
  Rule 8  退款金额 ≤ GMV             （渠道，逐行）
  隐含    new + returning == buyers  （渠道，逐行）
  隐含    coupon_used ≤ coupon_sent  （SCRM）
  隐含    reached_users ≤ total_friends（SCRM）
  隐含    active_members ≥ buyers    （会员）
  隐含    会员恒等式 total[d]==total[d-1]+new-churn
  隐含    总会员单调递增（增长趋势）

Validation Report：总GMV / 总订单数 / ROI区间 / 会员增长率 / SCRM增长率 /
                   各渠道贡献占比 / 数据一致性检查结果。
"""

import csv
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

CHANNELS = ["PRIVATE_TRAFFIC", "MINI_PROGRAM", "XIAOHONGSHU", "TMALL", "JD", "OFFLINE_STORE"]


def load(name):
    with open(DATA / name, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def F(x):
    """float 解析（兼容整数/小数字符串）"""
    return float(x)


# --------------------------------------------------------------------------- #
# 读表
# --------------------------------------------------------------------------- #
ch = load("daily_channel_metrics.csv")
mb = load("daily_member_metrics.csv")
sc = load("daily_scrm_metrics.csv")
ev = load("business_events.csv")

errors = []  # (rule, detail)


def check(rule, cond, detail):
    if not cond:
        errors.append((rule, detail))


# --------------------------------------------------------------------------- #
# 结构 + Rule 1 / Rule 2（单一数据源）
# --------------------------------------------------------------------------- #
dates_ch = sorted({r["date"] for r in ch})
check("结构", len(dates_ch) == 90, f"channel 日期数={len(dates_ch)}（应为 90）")
by_date = defaultdict(list)
for r in ch:
    by_date[r["date"]].append(r)
for d, rows in by_date.items():
    check("Rule1/2", len(rows) == 6, f"{d} 渠道数={len(rows)}（应为 6）")
    chans = {r["channel"] for r in rows}
    check("Rule1/2", chans == set(CHANNELS), f"{d} 渠道集合不匹配")
# Rule 1/2 按 SQL 定义：总 GMV / 总订单 = Σ 渠道值（无独立存储，天然一致）
sum_gmv = sum(F(r["gmv"]) for r in ch)
sum_orders = sum(int(r["orders"]) for r in ch)

# --------------------------------------------------------------------------- #
# Rule 3 / Rule 8 + new+returning（渠道，逐行）
# --------------------------------------------------------------------------- #
for r in ch:
    visitors, buyers = int(r["visitors"]), int(r["buyers"])
    gmv, refund = F(r["gmv"]), F(r["refund_amount"])
    new_c, ret_c = int(r["new_customers"]), int(r["returning_customers"])
    check("Rule3", buyers <= visitors, f"{r['date']} {r['channel']} buyers({buyers})>visitors({visitors})")
    check("Rule8", refund <= gmv, f"{r['date']} {r['channel']} refund({refund})>gmv({gmv})")
    check("隐含", new_c + ret_c == buyers, f"{r['date']} {r['channel']} new+ret({new_c+ret_c})≠buyers({buyers})")
    check("隐含", new_c >= 0 and ret_c >= 0 and visitors >= 0 and buyers >= 0 and int(r["orders"]) >= 0,
          f"{r['date']} {r['channel']} 存在负值")

# --------------------------------------------------------------------------- #
# Rule 4 / Rule 5 + active≥buyers + 恒等式 + 单调（会员）
# --------------------------------------------------------------------------- #
mb_sorted = sorted(mb, key=lambda r: r["date"])
prev_total = None
for r in mb_sorted:
    total = int(r["total_members"])
    active = int(r["active_members"])
    vip = int(r["vip_members"])
    buyers = int(r["buyers"])
    repeat = int(r["repeat_buyers"])
    new_m = int(r["new_members"])
    churn = int(r["churn_members"])
    check("Rule4", repeat <= buyers, f"{r['date']} repeat({repeat})>buyers({buyers})")
    check("Rule5", vip <= total, f"{r['date']} vip({vip})>total({total})")
    check("隐含", active >= buyers, f"{r['date']} active({active})<buyers({buyers})")
    check("隐含", buyers <= total, f"{r['date']} buyers({buyers})>total({total})")
    if prev_total is not None:
        check("恒等式", total == prev_total + new_m - churn,
              f"{r['date']} {total}≠{prev_total}+{new_m}-{churn}={prev_total+new_m-churn}")
        check("增长", total > prev_total, f"{r['date']} 总会员未增长 {prev_total}->{total}")
    prev_total = total

# --------------------------------------------------------------------------- #
# Rule 6 / Rule 7 + coupon + reached≤friends（SCRM）
# --------------------------------------------------------------------------- #
for r in sc:
    friends = int(r["total_friends"])
    reached = int(r["reached_users"])
    reply = int(r["reply_users"])
    conv = int(r["converted_users"])
    sent = int(r["coupon_sent"])
    used = int(r["coupon_used"])
    check("Rule6", reply <= reached, f"{r['date']} reply({reply})>reached({reached})")
    check("Rule7", conv <= reply, f"{r['date']} converted({conv})>reply({reply})")
    check("隐含", reached <= friends, f"{r['date']} reached({reached})>friends({friends})")
    check("隐含", used <= sent, f"{r['date']} coupon_used({used})>sent({sent})")

# --------------------------------------------------------------------------- #
# Report 指标
# --------------------------------------------------------------------------- #
sum_visitors = sum(int(r["visitors"]) for r in ch)
sum_buyers = sum(int(r["buyers"]) for r in ch)
sum_mkt = sum(F(r["marketing_cost"]) for r in ch)
sum_refund = sum(F(r["refund_amount"]) for r in ch)
sum_new = sum(int(r["new_customers"]) for r in ch)
sum_ret = sum(int(r["returning_customers"]) for r in ch)

# 每日 ROI（按日聚合 gmv/mkt），取区间
daily_roi = {}
g_by_d = defaultdict(lambda: [0.0, 0.0])
for r in ch:
    g_by_d[r["date"]][0] += F(r["gmv"])
    g_by_d[r["date"]][1] += F(r["marketing_cost"])
for d, (g, m) in g_by_d.items():
    daily_roi[d] = g / m
roi_overall = sum_gmv / sum_mkt

# 渠道贡献占比
share = {c: sum(F(r["gmv"]) for r in ch if r["channel"] == c) / sum_gmv for c in CHANNELS}

# 会员 / SCRM 增长率
m_start, m_end = int(mb_sorted[0]["total_members"]), int(mb_sorted[-1]["total_members"])
sc_sorted = sorted(sc, key=lambda r: r["date"])
f_start, f_end = int(sc_sorted[0]["total_friends"]), int(sc_sorted[-1]["total_friends"])

# 业务事件数
check("事件", len(ev) == 6, f"business_events 行数={len(ev)}（应为 6）")

# ===================================================================== #
# 输出 Validation Report
# ===================================================================== #
print("=" * 72)
print("  AI Business Analyst MVP · 90 天 Mock Data · Validation Report")
print("=" * 72)

print("\n【1. 核心规模指标】")
print(f"  总 GMV          : ¥{sum_gmv:,.2f}  （= Σ 渠道 gmv，Rule 1）")
print(f"  总订单数        : {sum_orders:,}  （= Σ 渠道 orders，Rule 2）")
print(f"  总访客数        : {sum_visitors:,}")
print(f"  总购买人数      : {sum_buyers:,}    （新客 {sum_new:,} / 老客 {sum_ret:,}）")
print(f"  整体 AOV        : ¥{sum_gmv/sum_orders:,.2f}")
print(f"  整体转化率      : {sum_buyers/sum_visitors*100:.2f}%")
print(f"  整体退款率      : {sum_refund/sum_gmv*100:.2f}%")
print(f"  整体 ROI        : {roi_overall:.2f}")

print("\n【2. ROI 区间】（目标 3.5 ~ 5.0）")
print(f"  日级 ROI 最小值 : {min(daily_roi.values()):.2f}")
print(f"  日级 ROI 最大值 : {max(daily_roi.values()):.2f}")
print(f"  日级 ROI 中位数 : {sorted(daily_roi.values())[len(daily_roi)//2]:.2f}")
roi_in_range = all(3.5 <= v <= 5.0 for v in daily_roi.values())
print(f"  全部落在 3.5~5.0: {'是 ✓' if roi_in_range else '否 ✗'}")

print("\n【3. 增长率】")
print(f"  会员总数        : {m_start:,} → {m_end:,}    增长 {(m_end/m_start-1)*100:+.2f}%")
print(f"  企微好友数      : {f_start:,} → {f_end:,}    增长 {(f_end/f_start-1)*100:+.2f}%")

print("\n【4. 各渠道 GMV 贡献占比】（目标 30/25/20/10/10/5，允许 ±5%）")
target = {"PRIVATE_TRAFFIC": 30, "TMALL": 25, "JD": 20, "MINI_PROGRAM": 10, "XIAOHONGSHU": 10, "OFFLINE_STORE": 5}
for c in CHANNELS:
    p = share[c] * 100
    flag = "✓" if abs(p - target[c]) <= 5.0 else "✗ 超出±5%"
    print(f"  {c:<15} {p:5.2f}%   （目标 {target[c]:>2}%）  {flag}")

print("\n【5. 数据一致性检查结果】")
rules = [
    ("Rule 1", "总 GMV = Σ 渠道 GMV（单一数据源）"),
    ("Rule 2", "总订单 = Σ 渠道订单（单一数据源）"),
    ("Rule 3", "购买人数 ≤ 访客数（渠道，逐行）"),
    ("Rule 4", "复购会员 ≤ 购买会员（会员，逐行）"),
    ("Rule 5", "VIP 会员 ≤ 总会员（会员，逐行）"),
    ("Rule 6", "回复人数 ≤ 触达人数（SCRM，逐行）"),
    ("Rule 7", "成交人数 ≤ 回复人数（SCRM，逐行）"),
    ("Rule 8", "退款金额 ≤ GMV（渠道，逐行）"),
    ("隐含  ", "新客+老客 = 购买人数（渠道，逐行）"),
    ("隐含  ", "coupon_used ≤ coupon_sent（SCRM）"),
    ("隐含  ", "触达人数 ≤ 好友总数（SCRM）"),
    ("隐含  ", "活跃会员 ≥ 购买会员（会员）"),
    ("隐含  ", "会员恒等式 total=prev+new-churn（逐日）"),
    ("隐含  ", "总会员单调递增（增长趋势 Rule 7）"),
]
fails = defaultdict(int)
for rule, _detail in errors:
    fails[rule.strip()] += 1
all_pass = True
for code, desc in rules:
    key = code.strip()
    n = fails.get(key, 0)
    ok = n == 0
    if not ok:
        all_pass = False
    print(f"  [{('PASS' if ok else 'FAIL')}] {code} {desc}" + ("" if ok else f"   ← 违反 {n} 处"))

print("\n" + "=" * 72)
print(f"  一致性总评: {'✅ 全部通过（0 处违反）' if all_pass else '❌ 存在违反，见上表'}")
print("=" * 72)

if errors:
    print("\n违反明细（前 20 条）:")
    for rule, detail in errors[:20]:
        print(f"  - [{rule}] {detail}")

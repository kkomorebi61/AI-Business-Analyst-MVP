#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generate 90-day Mock Data (CSV) for AI Business Analyst MVP.

权威规格：
  - 03A_Daily_Fact_Table_Schema.md   → 4 张事实表的字段与类型
  - 03B_90_Days_Mock_Data_Generation_Rules.md → 业务规则（增长/周末/事件/一致性）

设计原则（遵循 03A）：
  - Single Source of Truth：结果指标（GMV/ROI/LTV/复购率…）一律不落盘，
    由 SQL 聚合 daily_channel_metrics 等事实表计算得到。
  - Day-Level Granularity：最小粒度为天。
  - 所有一致性规则（Rule 1~8）由本生成器在构造时强制成立，
    并由 validate_csv_mock_data.py 重新读回 CSV 独立校验。

输出（项目根 data/ 目录）：
  daily_channel_metrics.csv  540 行（90 天 × 6 渠道）
  daily_member_metrics.csv    90 行
  daily_scrm_metrics.csv      90 行
  business_events.csv          6 行

可复现：固定随机种子 SEED。
"""

import csv
import os
import random
from datetime import date, timedelta
from pathlib import Path

# --------------------------------------------------------------------------- #
# 常量
# --------------------------------------------------------------------------- #
SEED = 20260401
rnd = random.Random(SEED)

START = date(2026, 4, 1)
DAYS = 90
DATES = [START + timedelta(days=i) for i in range(DAYS)]

CHANNELS = ["PRIVATE_TRAFFIC", "MINI_PROGRAM", "XIAOHONGSHU", "TMALL", "JD", "OFFLINE_STORE"]
BASE_SHARE = {  # 03B 渠道占比
    "PRIVATE_TRAFFIC": 0.30,
    "TMALL": 0.25,
    "JD": 0.20,
    "MINI_PROGRAM": 0.10,
    "XIAOHONGSHU": 0.10,
    "OFFLINE_STORE": 0.05,
}
# 各渠道 ROI 目标（整体落在 03B 要求的 3.5~5.0 区间）
CH_ROI = {
    "PRIVATE_TRAFFIC": 4.5,
    "MINI_PROGRAM": 4.8,
    "XIAOHONGSHU": 3.8,
    "TMALL": 4.0,
    "JD": 4.2,
    "OFFLINE_STORE": 4.0,
}

# Day1 基准（03B Initial Business Scale）
BASE_GMV = 100_000.0
BASE_ORDERS = 500.0          # → AOV 基线 = 200
BASE_VISITORS = 10_000.0     # → 基线转化率 = 5%
BASE_TOTAL_MEMBERS = 12_000
BASE_VIP_MEMBERS = 2_000
BASE_FRIENDS = 18_000


# --------------------------------------------------------------------------- #
# 增长率（按天序 dayno ∈ 1..90）
# --------------------------------------------------------------------------- #
def gmv_growth(dayno: int) -> float:
    if dayno <= 30:
        return 0.003  # 稳定增长
    if dayno <= 60:
        return 0.005  # 活动驱动
    return 0.010      # 618 大促


def mem_growth(dayno: int) -> float:
    if dayno <= 30:
        return 0.002
    if dayno <= 60:
        return 0.004
    return 0.005


# --------------------------------------------------------------------------- #
# 经营事件（03B Business Event Timeline，精确日期 + Duration）
# 元组: (name, type, start, duration_days, gmv_mult, orders_mult, visitors_mult, member_only, scrm_only)
# --------------------------------------------------------------------------- #
def _ev(name, typ, start, dur, gm=1.0, om=1.0, vm=1.0, member=False, scrm=False):
    return dict(name=name, type=typ, start=start, dur=dur,
                gm=gm, om=om, vm=vm, member=member, scrm=scrm)


EFFECT_EVENTS = [
    _ev("618预热活动", "MARKETING", date(2026, 4, 21), 7, gm=1.15, vm=1.20),
    _ev("核心商品缺货", "INVENTORY", date(2026, 5, 5), 5, gm=0.80, om=0.85),
    _ev("VIP专属活动", "CRM", date(2026, 5, 18), 7, member=True),
    _ev("企微触达异常", "SCRM", date(2026, 6, 1), 3, scrm=True),
    _ev("新品上市", "PRODUCT", date(2026, 6, 10), 10, gm=1.10, vm=1.15),
    _ev("618大促", "PROMOTION", date(2026, 6, 18), 5, gm=1.50, om=1.40, vm=1.60),
]

# business_events 表（impact_level 按影响幅度分级）
BIZ_EVENTS = [
    dict(event_id="EVT001", event_date=date(2026, 4, 21), event_name="618预热活动",
         event_type="MARKETING", impact_direction="POSITIVE", impact_level="MEDIUM",
         description="618 预热活动启动，GMV +15%、访客 +20%，持续 7 天"),
    dict(event_id="EVT002", event_date=date(2026, 5, 5), event_name="核心商品缺货",
         event_type="INVENTORY", impact_direction="NEGATIVE", impact_level="HIGH",
         description="核心商品（空气炸锅/电饭煲）缺货，GMV -20%、订单 -15%，持续 5 天"),
    dict(event_id="EVT003", event_date=date(2026, 5, 18), event_name="VIP专属活动",
         event_type="CRM", impact_direction="POSITIVE", impact_level="MEDIUM",
         description="VIP 专属营销活动，复购率 +10%、VIP GMV +15%，持续 7 天"),
    dict(event_id="EVT004", event_date=date(2026, 6, 1), event_name="企微触达异常",
         event_type="SCRM", impact_direction="NEGATIVE", impact_level="MEDIUM",
         description="企业微信触达系统异常，触达率 -30%、回复率 -20%，持续 3 天"),
    dict(event_id="EVT005", event_date=date(2026, 6, 10), event_name="新品上市",
         event_type="PRODUCT", impact_direction="POSITIVE", impact_level="MEDIUM",
         description="新品（净水器）上市，GMV +10%、访客 +15%，持续 10 天"),
    dict(event_id="EVT006", event_date=date(2026, 6, 18), event_name="618大促",
         event_type="PROMOTION", impact_direction="POSITIVE", impact_level="HIGH",
         description="618 大促正式爆发，GMV +50%、订单 +40%、访客 +60%，持续 5 天"),
]


def active_events(d: date):
    return [e for e in EFFECT_EVENTS if 0 <= (d - e["start"]).days < e["dur"]]


def vip_event_active(d: date) -> bool:
    return any(e["member"] and 0 <= (d - e["start"]).days < e["dur"] for e in EFFECT_EVENTS)


def scrm_event_active(d: date) -> bool:
    return any(e["scrm"] and 0 <= (d - e["start"]).days < e["dur"] for e in EFFECT_EVENTS)


# --------------------------------------------------------------------------- #
# 工具：按权重把一个总量精确分配到各渠道（余数补到最大权重渠道，保证 Σ == total）
# --------------------------------------------------------------------------- #
def alloc(total: float, weights: dict, decimals: int = 0) -> dict:
    w_sum = sum(weights.values())
    vals = {c: round(total * weights[c] / w_sum, decimals) for c in weights}
    diff = round(total - sum(vals.values()), decimals)
    big = max(weights, key=lambda c: weights[c])
    vals[big] = round(vals[big] + diff, decimals)
    return vals


# --------------------------------------------------------------------------- #
# 1) daily_channel_metrics
# --------------------------------------------------------------------------- #
def gen_channel_metrics():
    rows = []
    gmv_trend = BASE_GMV  # 仅含趋势的日 GMV（事件/周末倍数另行叠加）

    for i, d in enumerate(DATES):
        dayno = i + 1
        if i > 0:
            gmv_trend *= (1 + gmv_growth(dayno))

        # 事件倍数（可叠加：新品×618 在 6/18-6/19 重叠）
        gm = om = vm = 1.0
        for e in active_events(d):
            gm *= e["gm"]
            om *= e["om"]
            vm *= e["vm"]
        # 周末季节性（仅影响订单与访客；GMV 经 orders×AOV 自然联动）
        wd = d.weekday()  # 5=周六 6=周日
        if wd == 5:
            om *= 1.10
            vm *= 1.15
        elif wd == 6:
            om *= 1.15
            vm *= 1.20

        # 日总量（所有渠道合计）——结果指标，不落盘，仅用于分配
        total_gmv = gmv_trend * gm
        total_orders = (gmv_trend / 200.0) * om
        total_visitors = (gmv_trend / 10.0) * vm
        total_buyers = total_orders * rnd.uniform(0.88, 0.93)  # 人均 ~1.1 单

        # 当日渠道权重（占比 ±5% 波动），所有指标共用同一权重向量
        w = {c: BASE_SHARE[c] * rnd.uniform(0.95, 1.05) for c in CHANNELS}

        gmv_c = alloc(total_gmv, w, 2)
        orders_c = alloc(total_orders, w, 0)
        visitors_c = alloc(total_visitors, w, 0)
        buyers_c = alloc(total_buyers, w, 0)

        # VIP 活动期间老客占比上升（new 60%→52%）
        new_share = 0.52 if vip_event_active(d) else 0.60

        for c in CHANNELS:
            gmv = gmv_c[c]
            orders = int(orders_c[c])
            visitors = int(visitors_c[c])
            buyers = int(buyers_c[c])
            if buyers > visitors:
                buyers = visitors  # 守卫 Rule 3（购买人数 ≤ 访客数）

            new_c = round(buyers * new_share)
            ret_c = buyers - new_c  # 保证 new + returning == buyers

            refund_rate = rnd.uniform(0.02, 0.05)          # 03B 退款率 2%~5%
            refund_amount = round(gmv * refund_rate, 2)     # ≤ gmv（Rule 8）

            roi = CH_ROI[c] * rnd.uniform(0.97, 1.03)
            roi = min(max(roi, 3.5), 5.0)                   # 钳制进 [3.5, 5.0]
            marketing_cost = round(gmv / roi, 2)            # 03B: cost = GMV / ROI

            rows.append({
                "date": d.isoformat(),
                "channel": c,
                "visitors": visitors,
                "buyers": buyers,
                "orders": orders,
                "gmv": f"{gmv:.2f}",
                "refund_amount": f"{refund_amount:.2f}",
                "marketing_cost": f"{marketing_cost:.2f}",
                "new_customers": new_c,
                "returning_customers": ret_c,
            })
    return rows


# --------------------------------------------------------------------------- #
# 2) daily_member_metrics
# --------------------------------------------------------------------------- #
def gen_member_metrics(channel_rows):
    # 预算每日渠道 buyers 合计，用于推导会员购买人数（去重）
    daily_channel_buyers = {}
    for r in channel_rows:
        daily_channel_buyers.setdefault(r["date"], 0)
        daily_channel_buyers[r["date"]] += r["buyers"]

    rows = []
    total_members = BASE_TOTAL_MEMBERS
    for i, d in enumerate(DATES):
        dayno = i + 1
        ds = d.isoformat()

        prev = total_members
        churn = round(prev * rnd.uniform(0.003, 0.006))              # 流失
        net_target = prev * mem_growth(dayno)                        # 净增目标
        new_members = round(net_target + churn)                      # 毛新增 = 净增 + 流失
        total_members = prev + new_members - churn                   # 恒等式（Rule 7 趋势一致）

        vip_members = round(total_members * rnd.uniform(0.165, 0.180))
        ch_buyers = daily_channel_buyers.get(ds, 0)
        buyers = round(ch_buyers * rnd.uniform(0.80, 0.88))          # 跨渠道去重后的购买会员
        active_members = max(round(total_members * rnd.uniform(0.30, 0.34)), buyers + rnd.randint(40, 120))

        rep_rate = rnd.uniform(0.20, 0.35)
        if vip_event_active(d):
            rep_rate = min(rep_rate * 1.10, 0.45)                    # VIP 活动复购 +10%
        repeat_buyers = round(buyers * rep_rate)

        rows.append({
            "date": ds,
            "total_members": total_members,
            "active_members": active_members,
            "new_members": new_members,
            "vip_members": vip_members,
            "buyers": buyers,
            "repeat_buyers": repeat_buyers,
            "churn_members": churn,
        })
    return rows


# --------------------------------------------------------------------------- #
# 3) daily_scrm_metrics
# --------------------------------------------------------------------------- #
def gen_scrm_metrics():
    rows = []
    total_friends = BASE_FRIENDS
    for d in DATES:
        ds = d.isoformat()
        new_friends = rnd.randint(80, 150)                          # 03B 每日新增好友 80~150
        total_friends = total_friends + new_friends                 # 好友单调递增

        consultants = rnd.randint(42, 48)

        reach_rate = rnd.uniform(0.15, 0.25)
        reply_rate = rnd.uniform(0.20, 0.35)
        if scrm_event_active(d):                                    # 企微异常：触达 -30% / 回复 -20%
            reach_rate *= 0.70
            reply_rate *= 0.80
        reached_users = round(total_friends * reach_rate)
        reply_users = round(reached_users * reply_rate)
        converted_users = round(reply_users * rnd.uniform(0.10, 0.20))

        coupon_sent = rnd.randint(500, 700)
        coupon_used = round(coupon_sent * rnd.uniform(0.25, 0.35))

        rows.append({
            "date": ds,
            "consultants": consultants,
            "total_friends": total_friends,
            "new_friends": new_friends,
            "reached_users": reached_users,
            "reply_users": reply_users,
            "converted_users": converted_users,
            "coupon_sent": coupon_sent,
            "coupon_used": coupon_used,
        })
    return rows


# --------------------------------------------------------------------------- #
# 4) business_events
# --------------------------------------------------------------------------- #
def gen_business_events():
    return [{
        "event_id": e["event_id"],
        "event_date": e["event_date"].isoformat(),
        "event_name": e["event_name"],
        "event_type": e["event_type"],
        "impact_direction": e["impact_direction"],
        "impact_level": e["impact_level"],
        "description": e["description"],
    } for e in BIZ_EVENTS]


# --------------------------------------------------------------------------- #
# 写 CSV
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

FIELDNAMES = {
    "daily_channel_metrics.csv":
        ["date", "channel", "visitors", "buyers", "orders", "gmv",
         "refund_amount", "marketing_cost", "new_customers", "returning_customers"],
    "daily_member_metrics.csv":
        ["date", "total_members", "active_members", "new_members",
         "vip_members", "buyers", "repeat_buyers", "churn_members"],
    "daily_scrm_metrics.csv":
        ["date", "consultants", "total_friends", "new_friends", "reached_users",
         "reply_users", "converted_users", "coupon_sent", "coupon_used"],
    "business_events.csv":
        ["event_id", "event_date", "event_name", "event_type",
         "impact_direction", "impact_level", "description"],
}


def write_csv(name: str, rows: list):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / name
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDNAMES[name])
        w.writeheader()
        w.writerows(rows)
    return path, len(rows)


def main():
    ch = gen_channel_metrics()
    mb = gen_member_metrics(ch)
    sc = gen_scrm_metrics()
    ev = gen_business_events()

    print(f"输出目录: {DATA_DIR}\n")
    for name, rows in [
        ("daily_channel_metrics.csv", ch),
        ("daily_member_metrics.csv", mb),
        ("daily_scrm_metrics.csv", sc),
        ("business_events.csv", ev),
    ]:
        path, n = write_csv(name, rows)
        print(f"  ✓ {name:<30} {n:>4} 行  → {path}")

    print(f"\n随机种子 SEED={SEED}（可复现）")
    print("请运行: python3 scripts/validate_csv_mock_data.py")


if __name__ == "__main__":
    main()

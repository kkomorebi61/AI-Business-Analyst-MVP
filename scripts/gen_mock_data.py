#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AI Business Analyst —— 90 天 Mock Data 生成器
依据: 05_Mock_Data_Design_V2.md

设计原则:
  - Day1 = 2026-04-03, Day90 = 2026-07-01 (共 90 天, 截止今天, 保证 range 切换取最新数据)
  - 严格围绕 5 个 Business Event 构造数据 (禁止无原因异常)
  - 长期增长趋势 (月增 ~8%) + 周末周期 (周末 GMV 高) + 小幅噪声 (±2%)
  - 跨数据集一致: 渠道求和=总量 / VIP 人数一致 / ROI=产出/成本 / AOV=GMV/订单

输出: src/lib/data/mock-data/01..08_*.json
"""
import json
import os
import datetime as dt
import random

random.seed(42)

START = dt.date(2026, 4, 3)
N = 90
OUT = os.path.join("src", "lib", "data", "mock-data")
os.makedirs(OUT, exist_ok=True)

DATES = [START + dt.timedelta(days=i) for i in range(N)]
ISO = [d.isoformat() for d in DATES]


# ──────────────────────────────────────────────────────────────
# 事件模型: 每个事件在 day index(0-based) 上对若干指标施加乘子
# 形状: triangle(峰在中心, 边缘渐变) 或 sustain(持续到序列末尾)
# ──────────────────────────────────────────────────────────────
def triangle(idx, center_day, half, peak_mult):
    """center_day 为 1-based; 在 [c-half, c+half] 内三角形渐变到 peak_mult。"""
    c = center_day - 1
    lo, hi = c - half, c + half
    if idx < lo or idx > hi:
        return 1.0
    w = 1.0 - abs(idx - c) / (half + 1)  # 中心=1, 边缘→0
    return 1.0 + (peak_mult - 1.0) * w


def sustain(idx, start_day, ramp, peak_mult):
    """从 start_day 开始, ramp 天内线性升到 peak_mult 并持续到末尾。"""
    s = start_day - 1
    if idx < s:
        return 1.0
    if idx < s + ramp:
        w = (idx - s + 1) / ramp
        return 1.0 + (peak_mult - 1.0) * w
    return peak_mult


def weekend_lift(d):
    """周末 GMV/订单上浮 ~22%。"""
    return 1.22 if d.weekday() >= 5 else 1.0


# 长期增长: 月增 ~8% → 90 天累计 ~+26%
def growth(i):
    return 1.0 + 0.0029 * i  # i=89 → ~1.258


def noise(i, amp=0.02):
    # 确定性"噪声": 用正弦+固定随机, 幅度小, 不构成异常
    return 1.0 + amp * (0.6 * random.random() - 0.3 + 0.4 * (
        __import__("math").sin(i * 1.7) / 2))


# ──────────────────────────────────────────────────────────────
# 事件定义 (1-based Day)
#   E1 Day21 618预热  : GMV+30% Orders+25% ROI+20%
#   E2 Day35 库存缺货 : GMV-20% Conv-15% Refund+80% Repurchase-8%
#   E3 Day52 会员专属 : Repurchase+12% VIP_GMV+25% LTV↑ GMV+5%
#   E4 Day73 企微触达下降: Reach-22% Reply-25% Repurchase-8% (持续到末尾)
#   E5 Day85 爆款新品 : GMV+18% AOV+10% Conv+15%
# ──────────────────────────────────────────────────────────────
def ev_gmv(i):
    m = triangle(i, 21, 5, 1.30)      # 618
    m *= triangle(i, 35, 4, 0.80)     # 缺货
    m *= triangle(i, 52, 4, 1.05)     # 会员活动(总量小幅)
    m *= triangle(i, 85, 3, 1.18)     # 新品
    return m


def ev_orders(i):
    m = triangle(i, 21, 5, 1.25)
    m *= triangle(i, 35, 4, 0.82)
    m *= triangle(i, 85, 3, 1.05)
    return m


def ev_aov(i):
    return triangle(i, 85, 3, 1.10)   # 新品拉高客单


def ev_conv(i):
    m = triangle(i, 35, 4, 0.85)      # 缺货转化下降
    m *= triangle(i, 85, 3, 1.15)     # 新品转化上升
    return m


def ev_refund(i):
    return triangle(i, 35, 4, 1.80)   # 缺货退款飙升


def ev_repurchase(i):
    m = triangle(i, 35, 4, 0.92)      # 缺货复购降
    m *= triangle(i, 52, 4, 1.12)     # 会员活动复购升
    m *= sustain(i, 73, 3, 0.92)      # 企微下降复购降
    return m


def ev_roi(i):
    return triangle(i, 21, 5, 1.20)   # 618 ROI 升


def ev_reach(i):
    return sustain(i, 73, 3, 0.78)    # 企微触达下降


def ev_reply(i):
    return sustain(i, 73, 3, 0.75)


# ──────────────────────────────────────────────────────────────
# Dataset 01 · Daily Business Metrics
# ──────────────────────────────────────────────────────────────
BASE_GMV = 98_000      # 对齐文档示例 Day1 ~98000
BASE_ORDERS = 420
BASE_CONV = 3.2
BASE_REFUND = 1.8

business = []
for i, d in enumerate(DATES):
    gmv = BASE_GMV * growth(i) * weekend_lift(d) * ev_gmv(i) * noise(i)
    orders = BASE_ORDERS * growth(i) * weekend_lift(d) * ev_orders(i) * noise(i)
    orders = max(120, round(orders))
    aov = round(gmv / orders)
    revenue = round(gmv)  # 文档示例 revenue==gmv
    conv = round(BASE_CONV * ev_conv(i) * (1 + 0.002 * i) * noise(i, 0.03), 1)
    refund = round(max(0.5, BASE_REFUND * ev_refund(i) * noise(i, 0.05)), 1)
    business.append({
        "date": ISO[i],
        "gmv": round(gmv),
        "orders": orders,
        "revenue": revenue,
        "aov": aov,
        "conversion_rate": conv,
        "refund_rate": refund,
    })


# ──────────────────────────────────────────────────────────────
# Dataset 04 · Channel Metrics (由总量按权重拆分, 保证求和一致)
# ──────────────────────────────────────────────────────────────
# 基础权重; 618/缺货/新品时权重漂移
CH_BASE = {
    "Private Traffic": 0.34,
    "Tmall": 0.27,
    "JD": 0.19,
    "Xiaohongshu": 0.11,
    "Mini Program": 0.09,
}
CH_CONV = {"Private Traffic": 4.5, "Tmall": 3.4, "JD": 3.1, "Xiaohongshu": 2.0, "Mini Program": 3.8}
CH_ROI = {"Private Traffic": 3.2, "Tmall": 2.6, "JD": 2.4, "Xiaohongshu": 1.4, "Mini Program": 2.9}


def channel_weights(i):
    w = dict(CH_BASE)
    # 618: Tmall/JD 权重升
    f1 = max(0, 1 - abs(i - 20) / 6)
    w["Tmall"] += 0.06 * f1
    w["JD"] += 0.04 * f1
    w["Private Traffic"] -= 0.06 * f1
    w["Xiaohongshu"] -= 0.04 * f1
    # 新品: 小程序/私域升 (新品首发私域)
    f5 = max(0, 1 - abs(i - 84) / 4)
    w["Mini Program"] += 0.05 * f5
    w["Private Traffic"] += 0.03 * f5
    w["Tmall"] -= 0.05 * f5
    w["JD"] -= 0.03 * f5
    s = sum(w.values())
    return {k: v / s for k, v in w.items()}


channels = []
for i, d in enumerate(DATES):
    total_gmv = business[i]["gmv"]
    total_orders = business[i]["orders"]
    w = channel_weights(i)
    for ch, wt in w.items():
        g = round(total_gmv * wt)
        o = round(total_orders * wt)
        roi = round(CH_ROI[ch] * ev_roi(i) * (1 + 0.001 * i), 1)
        conv = round(CH_CONV[ch] * ev_conv(i) * noise(i, 0.04), 1)
        channels.append({
            "date": ISO[i],
            "channel": ch,
            "gmv": g,
            "orders": o,
            "conversion_rate": conv,
            "roi": roi,
        })


# ──────────────────────────────────────────────────────────────
# Dataset 03 · Daily Marketing Metrics
#   roi = campaign_gmv / campaign_cost
# ──────────────────────────────────────────────────────────────
marketing = []
for i, d in enumerate(DATES):
    # ROI 由 storyline 驱动: 618 期间 +20%; 用 cost = gmv/roi 反推成本, 保证 ROI 走势正确
    base_roi = 2.3 * (1 + 0.0008 * i)
    target_roi = base_roi * ev_roi(i)
    # 活动期归因 GMV 占比升高 (618/会员活动)
    attr = 0.55 * triangle(i, 21, 5, 1.25) * triangle(i, 52, 4, 1.12)
    campaign_gmv = round(business[i]["gmv"] * attr)
    campaign_cost = round(campaign_gmv / target_roi)
    # 子项成本仍随活动波动 (不参与 ROI 公式, 仅作明细)
    cost_lift = triangle(i, 21, 5, 1.8) * triangle(i, 52, 4, 1.4)
    sms = round(8000 * growth(i) * (0.9 + 0.2 * random.random()))
    push = round(5000 * growth(i) * (0.9 + 0.2 * random.random()))
    coupon = round(12000 * growth(i) * cost_lift * (0.9 + 0.2 * random.random()))
    roi = round(campaign_gmv / campaign_cost, 2)
    marketing.append({
        "date": ISO[i],
        "campaign_cost": campaign_cost,
        "campaign_gmv": campaign_gmv,
        "roi": roi,
        "sms_cost": sms,
        "push_cost": push,
        "coupon_cost": coupon,
    })


# ──────────────────────────────────────────────────────────────
# Dataset 02 · Daily Member Metrics
# ──────────────────────────────────────────────────────────────
members = []
for i, d in enumerate(DATES):
    active = round(18_000 * (1 + 0.0016 * i) * noise(i, 0.01))
    new_m = round(260 * growth(i) * weekend_lift(d) ** 0.5 * noise(i, 0.05))
    rep = round(24.5 * ev_repurchase(i) * (1 + 0.001 * i) * noise(i, 0.02), 1)
    ltv = round(1120 * (1 + 0.0018 * i) * (triangle(i, 52, 4, 1.05)) * noise(i, 0.01))
    churn = round(3.1 * (1 + 0.0008 * i) * (1 / max(0.8, ev_repurchase(i)) ** 0.3) * noise(i, 0.03), 1)
    vip = round(3200 * (1 + 0.0012 * i) * noise(i, 0.005))
    members.append({
        "date": ISO[i],
        "active_members": active,
        "new_members": new_m,
        "repurchase_rate": rep,
        "ltv": ltv,
        "churn_rate": churn,
        "vip_members": vip,
    })


# ──────────────────────────────────────────────────────────────
# Dataset 05 · Member Segments  (VIP.count == members.vip_members)
# ──────────────────────────────────────────────────────────────
SEG_BASE = {
    # segment: (count, gmv, repurchase, ltv)
    "VIP":         (3200,   980_000, 45.2, 5200),
    "Loyal":       (6200,   520_000, 32.1, 2600),
    "Potential":   (5400,   210_000, 16.4, 1100),
    "Churn Risk":  (2100,    80_000,  8.5,  640),
    "New Member":  (2800,   120_000,  6.2,  320),
}
segments = []
for i, d in enumerate(DATES):
    vip_mult = triangle(i, 52, 4, 1.25)            # 会员活动 VIP GMV 升
    churn_risk_mult = sustain(i, 73, 3, 1.30)      # 企微下降 → 流失风险人群升
    for seg, (cnt, gmv, rep, ltv) in SEG_BASE.items():
        m_cnt = 1 + 0.0012 * i
        if seg == "VIP":
            mc, mg, mr, ml = m_cnt, vip_mult * (1 + 0.0014 * i), triangle(i, 52, 4, 1.10), triangle(i, 52, 4, 1.05)
            count = members[i]["vip_members"]       # 强一致
        elif seg == "Churn Risk":
            mc, mg, mr, ml = m_cnt * churn_risk_mult, 0.95, 0.9, 0.98
            count = round(cnt * mc)
        elif seg == "New Member":
            mc = weekend_lift(d) ** 0.3 * (1 + 0.001 * i)
            mg, mr, ml = 1 + 0.001 * i, 1.0, 1 + 0.0008 * i
            count = round(cnt * mc)
        else:
            mc, mg, mr, ml = m_cnt, 1 + 0.0014 * i, ev_repurchase(i) ** 0.5, 1 + 0.0018 * i
            count = round(cnt * mc)
        g = round(gmv * mg * growth(i) * noise(i, 0.02))
        segments.append({
            "date": ISO[i],
            "segment": seg,
            "member_count": count,
            "gmv": g,
            "repurchase_rate": round(rep * mr * noise(i, 0.02), 1),
            "ltv": round(ltv * ml * noise(i, 0.01)),
        })


# ──────────────────────────────────────────────────────────────
# Dataset 06 · SCRM Metrics (企微, Day73 起触达下降)
# ──────────────────────────────────────────────────────────────
scrm = []
for i, d in enumerate(DATES):
    scrm.append({
        "date": ISO[i],
        "new_friends": round(120 * growth(i) * ev_reach(i) ** 0.5 * noise(i, 0.04)),
        "reach_rate": round(82 * ev_reach(i) * (1 + 0.0005 * i) * noise(i, 0.02), 1),
        "reply_rate": round(38 * ev_reply(i) * (1 + 0.0005 * i) * noise(i, 0.03), 1),
        "group_activity_rate": round(45 * ev_reach(i) ** 0.6 * noise(i, 0.03), 1),
        "consultation_count": round(540 * growth(i) * ev_reach(i) ** 0.5 * noise(i, 0.04)),
    })


# ──────────────────────────────────────────────────────────────
# Dataset 07 · Data Source Registry  (Data Trust Layer)
#   故意制造 OMS 轻度 Warning 以演示健康态
# ──────────────────────────────────────────────────────────────
sources = [
    {"source_system": "OMS", "update_time": "2026-07-01 07:30", "health_status": "Warning", "coverage": 95, "owner": "Commerce Team"},
    {"source_system": "CRM", "update_time": "2026-07-01 10:05", "health_status": "Healthy", "coverage": 92, "owner": "CRM Team"},
    {"source_system": "CDP", "update_time": "2026-07-01 09:58", "health_status": "Healthy", "coverage": 88, "owner": "Data Team"},
    {"source_system": "Marketing Platform", "update_time": "2026-07-01 08:40", "health_status": "Healthy", "coverage": 90, "owner": "Marketing Team"},
    {"source_system": "Enterprise WeChat", "update_time": "2026-06-30 23:10", "health_status": "Delayed", "coverage": 76, "owner": "SCRM Team"},
]


# ──────────────────────────────────────────────────────────────
# Dataset 08 · Business Events (Root Cause 锚点)
# ──────────────────────────────────────────────────────────────
def edate(day):
    return (START + dt.timedelta(days=day - 1)).isoformat()

events = [
    {"event_date": edate(21), "event_name": "618预热活动", "event_type": "Marketing",
     "impact_metrics": ["GMV", "Orders", "ROI"], "impact_direction": "Positive",
     "description": "618 预热启动, 主会场+跨店满减带动 GMV 环比 +30%、订单 +25%、营销 ROI +20%。"},
    {"event_date": edate(35), "event_name": "库存缺货", "event_type": "Supply Chain",
     "impact_metrics": ["GMV", "Conversion Rate", "Refund Rate", "Repurchase Rate"], "impact_direction": "Negative",
     "description": "畅销品断货, GMV -20%、转化率下降、退款率飙升 80%、复购被动走弱。"},
    {"event_date": edate(52), "event_name": "会员专属活动", "event_type": "Member",
     "impact_metrics": ["Repurchase Rate", "VIP GMV", "LTV"], "impact_direction": "Positive",
     "description": "VIP 专享日, 复购率 +12%、VIP 贡献 GMV +25%、LTV 抬升。"},
    {"event_date": edate(73), "event_name": "企微触达下降", "event_type": "Channel",
     "impact_metrics": ["Reach Rate", "Reply Rate", "Repurchase Rate"], "impact_direction": "Negative",
     "description": "企微触达率/回复率持续下降, 拉低私域复购与社群活跃, 流失风险人群扩大。"},
    {"event_date": edate(85), "event_name": "爆款新品上线", "event_type": "Product",
     "impact_metrics": ["GMV", "AOV", "Conversion Rate"], "impact_direction": "Positive",
     "description": "新品首发私域+小程序, GMV +18%、客单价 +10%、转化率 +15%。"},
]


# ──────────────────────────────────────────────────────────────
# 写出
# ──────────────────────────────────────────────────────────────
datasets = [
    ("01_daily_business_metrics.json", business),
    ("02_daily_member_metrics.json", members),
    ("03_daily_marketing_metrics.json", marketing),
    ("04_channel_metrics.json", channels),
    ("05_member_segments.json", segments),
    ("06_scrm_metrics.json", scrm),
    ("07_data_sources.json", sources),
    ("08_business_events.json", events),
]
for name, data in datasets:
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

print("✓ 生成完成:", OUT)
for name, data in datasets:
    print(f"  {name}: {len(data)} 条")

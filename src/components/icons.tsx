/**
 * 统一图标映射：数据层只存 string key，UI 层在这里映射为 lucide 图标。
 * 这样 AnalysisResult 可安全序列化（不含 React 组件）。
 */
import {
  Activity,
  BarChart3,
  Clock,
  Crown,
  Database,
  FileText,
  Gem,
  GitBranch,
  Lightbulb,
  Link,
  Megaphone,
  MousePointerClick,
  Package,
  Percent,
  Repeat,
  RotateCcw,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
  TriangleAlert,
  Truck,
  UserMinus,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  // KPI
  gmv: BarChart3,
  orders: ShoppingBag,
  profit: Wallet,
  aov: Tag,
  conversion: Percent,
  refund: RotateCcw,
  vip: Crown,
  repurchase: Repeat,
  ltv: Gem,
  members: Users,
  churn: UserMinus,
  traffic: MousePointerClick,
  cvr: Target,
  roi: TrendingUp,
  // findings
  package: Package,
  truck: Truck,
  users: Users,
  // recommendations
  target: Target,
  lightbulb: Lightbulb,
  megaphone: Megaphone,
  // risk / misc
  warning: TriangleAlert,
  shield: ShieldAlert,
  star: Sparkles,
  activity: Activity,
  // evidence / trust / drawer
  database: Database,
  gitBranch: GitBranch,
  clock: Clock,
  fileText: FileText,
  link: Link,
  x: X,
};

export function Icon({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Cmp = MAP[name] ?? BarChart3;
  return <Cmp className={className} />;
}

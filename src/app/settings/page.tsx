import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-[1100px] px-6 py-8">
      <h1 className="text-[22px] font-semibold">设置</h1>
      <p className="mt-1 text-sm text-muted-foreground">账户、团队、模型与系统集成。</p>
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white/60 px-6 py-16 text-center">
        <Settings className="h-8 w-8 text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">设置中心即将上线</p>
      </div>
    </main>
  );
}

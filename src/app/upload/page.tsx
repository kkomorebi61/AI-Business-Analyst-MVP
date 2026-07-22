import UploadClient from "@/components/upload/upload-client";

/**
 * /upload —— 上传业务数据 + 数据理解结果（doc 19 §Upload + Data Understanding Engine）。
 * Data First 流程入口：上传 → 理解（分类/场景/推荐/缺口）→ 驱动动态驾驶舱与问答。
 */
export default function UploadPage() {
  return (
    <div className="min-h-screen bg-[#F8F9FA]">
      <main className="mx-auto max-w-[1280px] px-6 py-8">
        <UploadClient />
      </main>
    </div>
  );
}

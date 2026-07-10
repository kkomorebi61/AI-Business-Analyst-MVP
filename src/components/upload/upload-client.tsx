"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FlaskConical, Loader2, RefreshCw } from "lucide-react";
import type { UnderstandingResult } from "@/lib/data-understanding/types";
import UnderstandingResultView from "./understanding-result";

/**
 * 上传业务数据 + 数据理解（doc 19 §Upload Data + Data Understanding Engine）。
 * 挂载即拉取当前理解（默认样本）；支持上传 CSV / 重置回样本。
 */
export default function UploadClient() {
  const [understanding, setUnderstanding] = useState<UnderstandingResult | null>(null);
  const [isSample, setIsSample] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/understanding", { cache: "no-store" });
      if (!res.ok) throw new Error("读取理解结果失败");
      const data = await res.json();
      setUnderstanding(data.understanding);
      setIsSample(data.isSample);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => /\.csv$/i.test(f.name));
      if (!list.length) {
        setError("请选择 .csv 文件（可多选，如订单、会员、营销、企微）");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const form = new FormData();
        for (const f of list) form.append("files", f);
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "上传失败");
        setUnderstanding(data);
        setIsSample(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "上传失败");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const loadSample = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("action", "sample");
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "加载失败");
      setUnderstanding(data);
      setIsSample(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">上传业务数据</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Data First：上传即理解 —— 系统自动识别数据类型、业务场景、可分析与缺失项，
          并据此生成经营驾驶舱。缺数据时明确告知、禁止推测。
        </p>
      </header>

      {/* 上传区 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) void uploadFiles(e.dataTransfer.files);
        }}
        className={`rounded-lg border-2 border-dashed bg-white p-8 text-center transition-colors ${
          dragging ? "border-blue-400 bg-blue-50/50" : "border-border"
        }`}
      >
        <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm text-foreground">拖拽 CSV 到此处，或</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1E3A8A] px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            选择文件上传
          </button>
          <button
            type="button"
            onClick={loadSample}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-foreground disabled:opacity-50"
          >
            <FlaskConical className="h-4 w-4" />
            {isSample ? "重新加载内置样本" : "加载内置样本（90 天演示数据）"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          支持 OMS 订单 / CRM 会员 / 营销投放 / 企微私域 / 商品 等 CSV，可多文件一起上传
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading && !understanding && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在理解数据…
        </div>
      )}

      {understanding && (
        <>
          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" /> 重新理解中…
            </div>
          )}
          <UnderstandingResultView u={understanding} />
        </>
      )}
    </div>
  );
}

/** 报告章节标题：第 0X 节（灰） + 标题（黑/粗） + 副标题（灰） */
export default function SectionHeading({
  index,
  title,
  subtitle,
}: {
  index?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-4">
      {index && (
        <div className="text-xs font-medium tracking-wide text-muted-foreground">
          第 {index} 节
        </div>
      )}
      <h2 className="mt-0.5 text-[17px] font-semibold">{title}</h2>
      {subtitle && (
        <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
      )}
    </div>
  );
}

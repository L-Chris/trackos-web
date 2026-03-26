import type { UsageRankingItem } from '../lib/types';

type UsageRankingChartProps = {
  items: UsageRankingItem[];
};

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} 分钟`;
  }

  return `${hours} 小时 ${minutes} 分钟`;
}

export function UsageRankingChart({ items }: UsageRankingChartProps) {
  const maxValue = items[0]?.totalForegroundTimeMs ?? 0;

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">应用使用排行榜</h2>
          <p className="mt-1 text-sm text-slate-400">按当前筛选范围内的总前台时长排序</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
          TOP {items.length}
        </span>
      </div>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
            当前范围没有可展示的应用统计。
          </div>
        ) : null}
        {items.map((item, index) => {
          const width = maxValue === 0 ? 0 : (item.totalForegroundTimeMs / maxValue) * 100;

          return (
            <article key={item.packageName} className="rounded-2xl border border-white/8 bg-slate-950/45 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    #{index + 1} {item.appName}
                  </p>
                  <p className="mt-1 truncate font-mono text-[11px] text-slate-500">{item.packageName}</p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <p className="font-semibold text-emerald-200">{formatDuration(item.totalForegroundTimeMs)}</p>
                  <p className="mt-1 text-slate-500">{item.recordCount} 个窗口</p>
                </div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-900/90">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,_rgba(16,185,129,0.95)_0%,_rgba(56,189,248,0.95)_100%)]"
                  style={{ width: `${Math.max(8, width)}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  {item.deviceCount} 台设备
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1">
                  最近活跃 {item.lastUsedAt ? new Date(item.lastUsedAt).toLocaleString('zh-CN') : '--'}
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
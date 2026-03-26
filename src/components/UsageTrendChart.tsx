import type { UsageTrendBucket } from '../lib/types';

type UsageTrendChartProps = {
  buckets: UsageTrendBucket[];
};

function formatMinutes(ms: number) {
  return Math.round(ms / 60000);
}

export function UsageTrendChart({ buckets }: UsageTrendChartProps) {
  const maxValue = Math.max(...buckets.map((bucket) => bucket.totalForegroundTimeMs), 0);

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">使用趋势</h2>
          <p className="mt-1 text-sm text-slate-400">按时间桶聚合的总前台时长</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
          {buckets.length} 个时间桶
        </span>
      </div>
      <div className="mt-5">
        {buckets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
            当前范围没有趋势数据。
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
            {buckets.map((bucket) => {
              const height = maxValue === 0 ? 0 : Math.max(12, (bucket.totalForegroundTimeMs / maxValue) * 100);

              return (
                <article
                  key={bucket.bucketStartAt}
                  className="rounded-2xl border border-white/8 bg-slate-950/45 p-4"
                >
                  <div className="flex h-28 items-end">
                    <div
                      className="w-full rounded-t-2xl bg-[linear-gradient(180deg,_rgba(14,165,233,0.9)_0%,_rgba(16,185,129,0.85)_100%)]"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs font-medium text-white">
                    {new Intl.DateTimeFormat('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    }).format(new Date(bucket.bucketStartAt))}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatMinutes(bucket.totalForegroundTimeMs)} 分钟</p>
                  <p className="mt-1 text-[11px] text-slate-500">{bucket.activeAppCount} 个活跃应用</p>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
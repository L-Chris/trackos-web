import type { UsageEvent } from '../lib/types';

type UsageEventsTimelineProps = {
  events: UsageEvent[];
};

const eventToneMap: Record<string, string> = {
  ACTIVITY_RESUMED: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
  MOVE_TO_FOREGROUND: 'bg-emerald-400/15 text-emerald-200 border-emerald-400/30',
  ACTIVITY_PAUSED: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
  MOVE_TO_BACKGROUND: 'bg-amber-400/15 text-amber-200 border-amber-400/30',
  SCREEN_INTERACTIVE: 'bg-sky-400/15 text-sky-200 border-sky-400/30',
  SCREEN_NON_INTERACTIVE: 'bg-slate-400/15 text-slate-200 border-slate-400/30',
  KEYGUARD_SHOWN: 'bg-rose-400/15 text-rose-200 border-rose-400/30',
  KEYGUARD_HIDDEN: 'bg-fuchsia-400/15 text-fuchsia-200 border-fuchsia-400/30',
};

export function UsageEventsTimeline({ events }: UsageEventsTimelineProps) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">事件时间线</h2>
          <p className="mt-1 text-sm text-slate-400">前台切换与屏幕/锁屏事件</p>
        </div>
        <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
          {events.length} 条
        </span>
      </div>

      <div className="mt-5 max-h-[920px] space-y-3 overflow-auto pr-1">
        {events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-center text-sm text-slate-400">
            当前筛选条件下没有事件。
          </div>
        ) : null}

        {events.map((event) => {
          const tone = eventToneMap[event.eventType] ?? 'bg-white/5 text-slate-200 border-white/10';

          return (
            <article
              key={event.id}
              className="rounded-2xl border border-white/8 bg-slate-950/45 p-4 transition hover:border-sky-400/30 hover:bg-slate-950/70"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-white">
                    {new Intl.DateTimeFormat('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    }).format(new Date(event.occurredAt))}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{event.deviceId}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[11px] ${tone}`}>{event.eventType}</span>
              </div>

              <div className="mt-3 grid gap-3 text-xs text-slate-300 md:grid-cols-[1.1fr_1fr_0.8fr]">
                <div>
                  <p className="text-slate-500">应用</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{event.packageName ?? '--'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Class</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{event.className ?? '--'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Source</p>
                  <p className="mt-1 font-medium text-slate-100">{event.source}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
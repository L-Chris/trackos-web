import { useEffect, useMemo, useRef, useState, type WheelEvent } from 'react';
import { scaleTime } from 'd3-scale';
import type { MoveEvent, StayPoint, UsageEvent } from '../lib/types';

type UsageEventsTimelineProps = {
  events: UsageEvent[];
  moveEvents: MoveEvent[];
  stayPoints: StayPoint[];
  queryRange: {
    startAt: string;
    endAt: string;
  };
};

type VisibleRange = {
  startMs: number;
  endMs: number;
};

type TimelineLane = {
  id: string;
  label: string;
  packageName: string | null;
  color: string;
  segments: TimelineSegment[];
  totalDurationMs: number;
};

type TimelineSegment = {
  id: string;
  packageName: string;
  label: string;
  deviceId: string;
  startMs: number;
  endMs: number;
  durationMs: number;
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

const lanePalette = [
  'rgba(16, 185, 129, 0.72)',
  'rgba(14, 165, 233, 0.72)',
  'rgba(245, 158, 11, 0.72)',
  'rgba(244, 114, 182, 0.72)',
  'rgba(168, 85, 247, 0.72)',
  'rgba(249, 115, 22, 0.72)',
  'rgba(34, 197, 94, 0.72)',
  'rgba(99, 102, 241, 0.72)',
];
const systemEventTypes = new Set([
  'SCREEN_INTERACTIVE',
  'SCREEN_NON_INTERACTIVE',
  'KEYGUARD_SHOWN',
  'KEYGUARD_HIDDEN',
]);
const laneHeight = 48;
const maxTimelineLanes = 8;
const systemLaneId = '__system__';
const sessionStartEvents = new Set(['ACTIVITY_RESUMED', 'MOVE_TO_FOREGROUND']);
const sessionEndEvents = new Set(['ACTIVITY_PAUSED', 'MOVE_TO_BACKGROUND']);
const laneLabelWidth = 180;
const minChartWidth = 720;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

function formatShortDateTime(value: Date) {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(value);
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes} 分钟`;
  }

  return `${hours} 小时 ${minutes} 分钟`;
}

function hashOffset(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return ((Math.abs(hash) % 3) - 1) * 8;
}

function formatPackageLabel(packageName: string) {
  if (packageName === 'com.miui.home') {
    return '系统桌面';
  }

  const segments = packageName.split('.');
  return segments[segments.length - 1] || packageName;
}

function deriveTimelineSegments(events: UsageEvent[], queryEndMs: number) {
  const activeSessions = new Map<string, { event: UsageEvent; startMs: number }>();
  const sessions: TimelineSegment[] = [];

  for (const event of events) {
    const occurredAtMs = new Date(event.occurredAt).getTime();
    const packageName = event.packageName?.trim();

    if (!packageName) {
      continue;
    }

    const sessionKey = `${event.deviceId}::${packageName}`;

    if (sessionStartEvents.has(event.eventType)) {
      for (const [activeKey, activeSession] of activeSessions.entries()) {
        if (activeSession.event.deviceId !== event.deviceId || activeKey === sessionKey) {
          continue;
        }

        if (activeSession.startMs < occurredAtMs) {
          sessions.push({
            id: `${activeKey}:${activeSession.startMs}`,
            packageName: activeSession.event.packageName ?? '',
            label: formatPackageLabel(activeSession.event.packageName ?? ''),
            deviceId: activeSession.event.deviceId,
            startMs: activeSession.startMs,
            endMs: occurredAtMs,
            durationMs: occurredAtMs - activeSession.startMs,
          });
        }
        activeSessions.delete(activeKey);
      }

      const currentSession = activeSessions.get(sessionKey);
      if (currentSession && currentSession.startMs < occurredAtMs) {
        sessions.push({
          id: `${sessionKey}:${currentSession.startMs}`,
          packageName,
          label: formatPackageLabel(packageName),
          deviceId: event.deviceId,
          startMs: currentSession.startMs,
          endMs: occurredAtMs,
          durationMs: occurredAtMs - currentSession.startMs,
        });
      }

      activeSessions.set(sessionKey, { event, startMs: occurredAtMs });
      continue;
    }

    if (sessionEndEvents.has(event.eventType)) {
      const currentSession = activeSessions.get(sessionKey);
      if (!currentSession) {
        continue;
      }

      if (currentSession.startMs < occurredAtMs) {
        sessions.push({
          id: `${sessionKey}:${currentSession.startMs}`,
          packageName,
          label: formatPackageLabel(packageName),
          deviceId: event.deviceId,
          startMs: currentSession.startMs,
          endMs: occurredAtMs,
          durationMs: occurredAtMs - currentSession.startMs,
        });
      }
      activeSessions.delete(sessionKey);
    }
  }

  for (const [sessionKey, activeSession] of activeSessions.entries()) {
    if (activeSession.startMs >= queryEndMs) {
      continue;
    }

    sessions.push({
      id: `${sessionKey}:${activeSession.startMs}`,
      packageName: activeSession.event.packageName ?? '',
      label: formatPackageLabel(activeSession.event.packageName ?? ''),
      deviceId: activeSession.event.deviceId,
      startMs: activeSession.startMs,
      endMs: queryEndMs,
      durationMs: queryEndMs - activeSession.startMs,
    });
  }

  return sessions.sort((left, right) => left.startMs - right.startMs);
}

export function UsageEventsTimeline({ events, moveEvents, stayPoints, queryRange }: UsageEventsTimelineProps) {
  const queryStartMs = new Date(queryRange.startAt).getTime();
  const queryEndMs = new Date(queryRange.endAt).getTime();
  const totalRangeMs = Math.max(60 * 1000, queryEndMs - queryStartMs);
  const minWindowMs = Math.min(totalRangeMs, Math.max(5 * 60 * 1000, totalRangeMs * 0.05));
  const overviewRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [overviewWidth, setOverviewWidth] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(minChartWidth);
  const [visibleRange, setVisibleRange] = useState<VisibleRange>({
    startMs: queryStartMs,
    endMs: queryEndMs,
  });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedStayPointId, setSelectedStayPointId] = useState<number | null>(null);

  useEffect(() => {
    setVisibleRange({ startMs: queryStartMs, endMs: queryEndMs });
    setSelectedEventId(null);
    setSelectedStayPointId(null);
  }, [queryEndMs, queryStartMs]);

  useEffect(() => {
    const element = overviewRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      setOverviewWidth(entry.contentRect.width);
    });

    observer.observe(element);
    setOverviewWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateViewportWidth = (nextWidth: number) => {
      setViewportWidth(Math.max(minChartWidth, nextWidth - laneLabelWidth - 16));
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      updateViewportWidth(entry.contentRect.width);
    });

    observer.observe(element);
    updateViewportWidth(element.getBoundingClientRect().width);

    return () => observer.disconnect();
  }, []);

  const sortedEventsAsc = useMemo(
    () => [...events].sort((left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime()),
    [events],
  );

  const visibleEvents = useMemo(
    () => sortedEventsAsc.filter((event) => {
      const occurredAtMs = new Date(event.occurredAt).getTime();
      return occurredAtMs >= visibleRange.startMs && occurredAtMs <= visibleRange.endMs;
    }),
    [sortedEventsAsc, visibleRange.endMs, visibleRange.startMs],
  );

  const systemEvents = useMemo(
    () => visibleEvents.filter((event) => systemEventTypes.has(event.eventType)),
    [visibleEvents],
  );

  const visibleEventList = useMemo(
    () => [...visibleEvents].sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime()),
    [visibleEvents],
  );

  const timelineSegments = useMemo(
    () => deriveTimelineSegments(sortedEventsAsc, queryEndMs).filter((segment) => segment.endMs >= queryStartMs),
    [queryEndMs, queryStartMs, sortedEventsAsc],
  );

  const laneSource = useMemo(() => {
    const grouped = new Map<string, TimelineLane>();

    for (const segment of timelineSegments) {
      const lane = grouped.get(segment.packageName);
      if (lane) {
        lane.segments.push(segment);
        lane.totalDurationMs += segment.durationMs;
        continue;
      }

      grouped.set(segment.packageName, {
        id: segment.packageName,
        label: segment.label,
        packageName: segment.packageName,
        color: lanePalette[grouped.size % lanePalette.length],
        segments: [segment],
        totalDurationMs: segment.durationMs,
      });
    }

    return [...grouped.values()].sort(
      (left, right) => right.totalDurationMs - left.totalDurationMs,
    );
  }, [timelineSegments]);

  const topLanes = laneSource.slice(0, maxTimelineLanes).map((lane, index) => ({
    ...lane,
    color: lanePalette[index % lanePalette.length],
  }));
  const hiddenLaneCount = Math.max(0, laneSource.length - topLanes.length);
  const hasSystemEvents = systemEvents.length > 0;
  const lanes = hasSystemEvents
    ? [
        ...topLanes,
        {
          id: systemLaneId,
          label: hiddenLaneCount > 0 ? `系统 / 其他应用 (${hiddenLaneCount})` : '系统事件',
          packageName: null,
          color: 'rgba(148, 163, 184, 0.72)',
          segments: [],
          totalDurationMs: 0,
        },
      ]
    : topLanes;

  const visibleSegmentCount = useMemo(
    () => timelineSegments.filter((segment) => {
      return segment.endMs >= visibleRange.startMs && segment.startMs <= visibleRange.endMs;
    }).length,
    [timelineSegments, visibleRange.endMs, visibleRange.startMs],
  );

  const visibleActiveAppCount = useMemo(
    () => new Set(
      timelineSegments
        .filter((segment) => {
          return segment.endMs >= visibleRange.startMs && segment.startMs <= visibleRange.endMs;
        })
        .map((segment) => segment.packageName),
    ).size,
    [timelineSegments, visibleRange.endMs, visibleRange.startMs],
  );

  const selectedEvent = useMemo(() => {
    if (!selectedEventId) {
      return visibleEventList[0] ?? null;
    }

    return visibleEventList.find((event) => event.id === selectedEventId) ?? visibleEventList[0] ?? null;
  }, [selectedEventId, visibleEventList]);

  const mainScale = useMemo(
    () => scaleTime<number, number>()
      .domain([new Date(visibleRange.startMs), new Date(visibleRange.endMs)])
      .range([0, viewportWidth]),
    [viewportWidth, visibleRange.endMs, visibleRange.startMs],
  );

  const mainTicks = useMemo<Date[]>(() => mainScale.ticks(7), [mainScale]);

  const selectionLeftPercent = ((visibleRange.startMs - queryStartMs) / totalRangeMs) * 100;
  const selectionWidthPercent = ((visibleRange.endMs - visibleRange.startMs) / totalRangeMs) * 100;

  function updateVisibleRange(nextRange: VisibleRange) {
    const span = clamp(nextRange.endMs - nextRange.startMs, minWindowMs, totalRangeMs);
    let nextStartMs = clamp(nextRange.startMs, queryStartMs, queryEndMs - span);
    let nextEndMs = nextStartMs + span;

    if (nextEndMs > queryEndMs) {
      nextEndMs = queryEndMs;
      nextStartMs = nextEndMs - span;
    }

    setVisibleRange({
      startMs: nextStartMs,
      endMs: nextEndMs,
    });
  }

  function beginOverviewDrag(mode: 'move' | 'resize-start' | 'resize-end', pointerX: number) {
    if (!overviewWidth) {
      return;
    }

    const initialRange = visibleRange;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaRatio = (moveEvent.clientX - pointerX) / overviewWidth;
      const deltaMs = deltaRatio * totalRangeMs;

      if (mode === 'move') {
        const span = initialRange.endMs - initialRange.startMs;
        let nextStartMs = initialRange.startMs + deltaMs;
        nextStartMs = clamp(nextStartMs, queryStartMs, queryEndMs - span);
        updateVisibleRange({ startMs: nextStartMs, endMs: nextStartMs + span });
        return;
      }

      if (mode === 'resize-start') {
        updateVisibleRange({
          startMs: clamp(initialRange.startMs + deltaMs, queryStartMs, initialRange.endMs - minWindowMs),
          endMs: initialRange.endMs,
        });
        return;
      }

      updateVisibleRange({
        startMs: initialRange.startMs,
        endMs: clamp(initialRange.endMs + deltaMs, initialRange.startMs + minWindowMs, queryEndMs),
      });
    };

    const handleUp = () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp, { once: true });
  }

  function handleWheelZoom(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const currentSpan = visibleRange.endMs - visibleRange.startMs;
    const nextSpan = clamp(
      Math.round(currentSpan * (event.deltaY < 0 ? 0.85 : 1.15)),
      minWindowMs,
      totalRangeMs,
    );
    const anchorMs = visibleRange.startMs + currentSpan * ratio;
    let nextStartMs = anchorMs - nextSpan * ratio;
    nextStartMs = clamp(nextStartMs, queryStartMs, queryEndMs - nextSpan);
    updateVisibleRange({ startMs: nextStartMs, endMs: nextStartMs + nextSpan });
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">事件时间线</h2>
          <p className="mt-1 text-sm text-slate-400">横向时间轴支持滚轮缩放，底部窗口支持拖动与拉伸</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1">
            当前窗口 {formatDuration(visibleRange.endMs - visibleRange.startMs)}
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1">
            {visibleEvents.length} 条事件
          </span>
          <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1">
            {visibleActiveAppCount} 个活跃应用
          </span>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">总览窗口</p>
              <p className="mt-1 text-xs text-slate-400">拖动中间区域平移，拖动两侧把手放大或缩小当前窗口</p>
            </div>
            <div className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              <span>{visibleSegmentCount} 段前台会话</span>
              <span>{systemEvents.length} 条系统事件</span>
            </div>
          </div>

          <div ref={overviewRef} className="relative mt-4 h-20 rounded-2xl border border-white/8 bg-slate-900/80">
                {sortedEventsAsc.map((event) => {
                  const occurredAtMs = new Date(event.occurredAt).getTime();
                  const left = ((occurredAtMs - queryStartMs) / totalRangeMs) * 100;
                  return (
                    <span
                      key={`overview-${event.id}`}
                      className="absolute top-3 h-8 w-px bg-sky-300/50"
                      style={{ left: `${left}%` }}
                    />
                  );
                })}

                {laneSource.slice(0, maxTimelineLanes).map((lane, laneIndex) => (
                  lane.segments.map((segment) => {
                    const startMs = Math.max(segment.startMs, queryStartMs);
                    const endMs = Math.min(segment.endMs, queryEndMs);
                    const left = ((startMs - queryStartMs) / totalRangeMs) * 100;
                    const width = Math.max(0.4, ((endMs - startMs) / totalRangeMs) * 100);

                    return (
                      <span
                        key={`overview-session-${segment.id}`}
                        className="absolute rounded-full opacity-70"
                        style={{
                          left: `${left}%`,
                          top: `${46 + laneIndex * 3}px`,
                          width: `${width}%`,
                          height: '3px',
                          background: lane.color,
                        }}
                      />
                    );
                  })
                ))}

                <div
                  className="absolute inset-y-1 rounded-xl border border-sky-300/50 bg-sky-300/10 shadow-lg shadow-sky-950/20"
                  style={{
                    left: `${selectionLeftPercent}%`,
                    width: `${selectionWidthPercent}%`,
                  }}
                >
                  <button
                    type="button"
                    onPointerDown={(event) => beginOverviewDrag('resize-start', event.clientX)}
                    className="absolute left-0 top-0 h-full w-4 -translate-x-1/2 rounded-full border border-sky-200/50 bg-sky-200/30"
                    aria-label="调整开始时间"
                  />
                  <button
                    type="button"
                    onPointerDown={(event) => beginOverviewDrag('move', event.clientX)}
                    className="absolute inset-0 cursor-grab rounded-xl active:cursor-grabbing"
                    aria-label="拖动当前窗口"
                  />
                  <button
                    type="button"
                    onPointerDown={(event) => beginOverviewDrag('resize-end', event.clientX)}
                    className="absolute right-0 top-0 h-full w-4 translate-x-1/2 rounded-full border border-sky-200/50 bg-sky-200/30"
                    aria-label="调整结束时间"
                  />
                </div>
              </div>
        </section>

        {stayPoints.length > 0 ? (
          <section className="rounded-[24px] border border-violet-400/20 bg-slate-950/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-white">停留点分析</p>
                <p className="mt-1 text-xs text-slate-400">ST-DBSCAN 聚类识别的停留位置，点击查看详情</p>
              </div>
              <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-[11px] text-violet-200">
                {stayPoints.length} 处停留
              </span>
            </div>

            {/* Timeline strip */}
            <div className="relative mt-4 h-9 rounded-2xl border border-white/8 bg-slate-900/80">
              {stayPoints.map((sp) => {
                const spStartMs = new Date(sp.startTime).getTime();
                const spEndMs = new Date(sp.endTime).getTime();
                const clampedStart = Math.max(spStartMs, queryStartMs);
                const clampedEnd = Math.min(spEndMs, queryEndMs);
                if (clampedEnd <= clampedStart) return null;
                const left = ((clampedStart - queryStartMs) / totalRangeMs) * 100;
                const width = Math.max(0.5, ((clampedEnd - clampedStart) / totalRangeMs) * 100);
                const isSelected = selectedStayPointId === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelectedStayPointId(isSelected ? null : sp.id)}
                    className="absolute top-1 h-7 rounded-lg border transition"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      minWidth: '6px',
                      background: isSelected
                        ? 'rgba(139,92,246,0.55)'
                        : 'rgba(139,92,246,0.25)',
                      borderColor: isSelected
                        ? 'rgba(167,139,250,0.8)'
                        : 'rgba(139,92,246,0.4)',
                      boxShadow: isSelected ? '0 0 0 3px rgba(139,92,246,0.2)' : undefined,
                    }}
                    title={`${sp.poiName ?? sp.address ?? '停留点'} · ${Math.round(sp.durationSec / 60)} 分钟`}
                  />
                );
              })}
            </div>

            {/* Selected stay point detail card */}
            {selectedStayPointId !== null ? (() => {
              const sp = stayPoints.find((s) => s.id === selectedStayPointId);
              if (!sp) return null;
              const placeLabelNames: Record<string, string> = {
                home: '住宅', work: '办公', food: '餐饮', shop: '购物',
                leisure: '休闲', education: '教育', medical: '医疗',
                finance: '金融', transport: '交通', other: '其他',
              };
              const labelName = sp.placeLabel ? placeLabelNames[sp.placeLabel] ?? sp.placeLabel : null;
              const start = new Date(sp.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
              const end = new Date(sp.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
              const durationMin = Math.round(sp.durationSec / 60);
              return (
                <div className="mt-3 rounded-2xl border border-violet-400/20 bg-violet-400/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{sp.poiName ?? sp.address ?? `停留点 #${sp.id + 1}`}</p>
                      {sp.address && sp.poiName ? (
                        <p className="mt-1 text-xs text-slate-400">{sp.address}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {labelName ? (
                        <span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-2.5 py-1 text-violet-200">
                          {labelName}
                        </span>
                      ) : null}
                      {sp.poiType ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
                          {sp.poiType.split(';')[0]}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300 sm:grid-cols-4">
                    <div>
                      <p className="text-slate-500">时段</p>
                      <p className="mt-1 font-medium text-slate-100">{start} – {end}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">停留时长</p>
                      <p className="mt-1 font-medium text-emerald-300">{durationMin} 分钟</p>
                    </div>
                    <div>
                      <p className="text-slate-500">聚类半径</p>
                      <p className="mt-1 font-medium text-slate-100">{sp.radiusM} m</p>
                    </div>
                    <div>
                      <p className="text-slate-500">GPS 点数</p>
                      <p className="mt-1 font-medium text-slate-100">{sp.pointCount}</p>
                    </div>
                  </div>
                </div>
              );
            })() : null}

            {/* List of all stay points */}
            <div className="mt-3 space-y-2">
              {stayPoints.map((sp) => {
                const isSelected = selectedStayPointId === sp.id;
                const start = new Date(sp.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                const end = new Date(sp.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
                const durationMin = Math.round(sp.durationSec / 60);
                const name = sp.poiName ?? sp.address ?? `停留 #${sp.id + 1}`;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSelectedStayPointId(isSelected ? null : sp.id)}
                    className={`block w-full rounded-2xl border p-3 text-left text-xs transition ${
                      isSelected
                        ? 'border-violet-400/40 bg-violet-400/10'
                        : 'border-white/8 bg-slate-900/60 hover:border-violet-400/20 hover:bg-slate-900/90'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate font-medium text-slate-100">{name}</p>
                      <span className="shrink-0 text-emerald-300">{durationMin} min</span>
                    </div>
                    <p className="mt-1 text-slate-500">{start} – {end}</p>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="rounded-[24px] border border-white/10 bg-slate-950/60 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">活动状态总览</p>
              <p className="mt-1 text-xs text-slate-400">全时段活动状态分布，颜色对应不同运动类型</p>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-400" />STILL</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />WALKING</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-400" />RUNNING</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-sky-400" />IN_VEHICLE</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-purple-400" />ON_BICYCLE</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-slate-600" />UNKNOWN</span>
            </div>
          </div>

          <div className="relative mt-4 h-12 rounded-2xl border border-white/8 bg-slate-900/80">
            {moveEvents.map((event, index) => {
              const startMs = new Date(event.occurredAt).getTime();
              const endMs = index + 1 < moveEvents.length
                ? new Date(moveEvents[index + 1].occurredAt).getTime()
                : queryEndMs;
              const clampedStart = Math.max(startMs, queryStartMs);
              const clampedEnd = Math.min(endMs, queryEndMs);
              if (clampedEnd <= clampedStart) return null;
              const left = ((clampedStart - queryStartMs) / totalRangeMs) * 100;
              const width = Math.max(0.2, ((clampedEnd - clampedStart) / totalRangeMs) * 100);
              const colorMap: Record<string, string> = {
                STILL: '#94a3b8',
                WALKING: '#34d399',
                RUNNING: '#fbbf24',
                IN_VEHICLE: '#38bdf8',
                ON_BICYCLE: '#c084fc',
                UNKNOWN: '#475569',
              };
              const color = colorMap[event.moveType] ?? '#475569';
              return (
                <span
                  key={event.id}
                  className="absolute top-2 h-8 rounded-sm opacity-80"
                  style={{ left: `${left}%`, width: `${width}%`, background: color }}
                  title={`${event.moveType}${event.confidence != null ? ` (${event.confidence.toFixed(0)}%)` : ''}`}
                />
              );
            })}
            {moveEvents.length === 0 && (
              <span className="absolute inset-0 flex items-center justify-center text-[11px] text-slate-500">
                当前范围没有活动状态数据
              </span>
            )}
          </div>
        </section>

        <section ref={viewportRef} className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-300">
            <div>
              <p className="font-medium text-white">可视窗口</p>
              <p className="mt-1 text-xs text-slate-400">
                {formatDateTime(new Date(visibleRange.startMs))} 至 {formatDateTime(new Date(visibleRange.endMs))}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => updateVisibleRange({
                  startMs: visibleRange.startMs + (visibleRange.endMs - visibleRange.startMs) * 0.1,
                  endMs: visibleRange.endMs - (visibleRange.endMs - visibleRange.startMs) * 0.1,
                })}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10"
              >
                放大
              </button>
              <button
                type="button"
                onClick={() => updateVisibleRange({
                  startMs: visibleRange.startMs - (visibleRange.endMs - visibleRange.startMs) * 0.12,
                  endMs: visibleRange.endMs + (visibleRange.endMs - visibleRange.startMs) * 0.12,
                })}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-slate-200 transition hover:bg-white/10"
              >
                缩小
              </button>
              <button
                type="button"
                onClick={() => updateVisibleRange({ startMs: queryStartMs, endMs: queryEndMs })}
                className="rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1.5 text-sky-100 transition hover:bg-sky-400/15"
              >
                重置视图
              </button>
            </div>
          </div>

          <div className="mt-4 pb-2" onWheel={handleWheelZoom}>
            <div className="w-full">
              <div className="grid grid-cols-[180px_1fr] gap-4">
                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">应用泳道</div>
                <div className="relative h-10 rounded-2xl border border-white/10 bg-slate-900/80">
                  {mainTicks.map((tick) => (
                    <div
                      key={tick.toISOString()}
                      className="absolute top-0 h-full border-l border-white/10"
                      style={{ left: `${mainScale(tick)}px` }}
                    >
                      <span className="absolute left-2 top-2 text-[11px] text-slate-400">
                        {formatShortDateTime(tick)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {lanes.map((lane) => (
                  <div key={lane.id} className="grid grid-cols-[180px_1fr] gap-4">
                    <div className="rounded-2xl border border-white/8 bg-slate-900/70 px-4 py-3">
                      <p className="truncate text-sm font-medium text-white">{lane.label}</p>
                      <p className="mt-1 text-[11px] text-slate-500">
                        {lane.packageName ?? 'SCREEN / KEYGUARD / 其他应用'}
                      </p>
                    </div>
                    <div
                      className="relative overflow-hidden rounded-2xl border border-white/8 bg-slate-950/60"
                      style={{ height: `${laneHeight}px` }}
                    >
                      {mainTicks.map((tick) => (
                        <div
                          key={`${lane.id}-${tick.toISOString()}`}
                          className="absolute top-0 h-full border-l border-white/6"
                          style={{ left: `${mainScale(tick)}px` }}
                        />
                      ))}
                      {lane.segments.map((segment) => {
                        const startMs = Math.max(segment.startMs, visibleRange.startMs);
                        const endMs = Math.min(segment.endMs, visibleRange.endMs);

                        if (endMs <= startMs) {
                          return null;
                        }

                        const left = mainScale(new Date(startMs));
                        const width = Math.max(4, mainScale(new Date(endMs)) - left);

                        return (
                          <button
                            key={segment.id}
                            type="button"
                            title={`${segment.label} ${formatDateTime(new Date(segment.startMs))} - ${formatDateTime(new Date(segment.endMs))}`}
                            className="absolute top-1/2 h-6 -translate-y-1/2 rounded-full border border-white/10 px-2 text-left text-[11px] text-white shadow-lg shadow-black/20"
                            style={{
                              left: `${left}px`,
                              width: `${width}px`,
                              background: `linear-gradient(90deg, ${lane.color}, rgba(15, 23, 42, 0.92))`,
                            }}
                          />
                        );
                      })}

                      {systemEvents.map((event) => {
                        const occurredAtMs = new Date(event.occurredAt).getTime();
                        const x = mainScale(new Date(occurredAtMs));
                        const laneId = systemLaneId;

                        if (lane.id !== laneId) {
                          return null;
                        }

                        const isSelected = selectedEvent?.id === event.id;
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={() => setSelectedEventId(event.id)}
                            className="absolute h-3.5 w-3.5 rounded-full border-2 border-slate-950 transition hover:scale-110 focus:outline-none focus:ring-2 focus:ring-sky-300"
                            style={{
                              left: `${x - 7}px`,
                              top: `${laneHeight / 2 - 7 + hashOffset(event.eventType)}px`,
                              background: isSelected ? 'rgba(250, 204, 21, 1)' : 'rgba(226, 232, 240, 0.95)',
                              boxShadow: isSelected ? '0 0 0 6px rgba(250, 204, 21, 0.18)' : '0 0 0 4px rgba(148, 163, 184, 0.12)',
                            }}
                            aria-label={`${event.eventType} ${formatDateTime(event.occurredAt)}`}
                            title={`${event.eventType} ${formatDateTime(event.occurredAt)}`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">当前时间详情</h3>
              <p className="mt-1 text-xs text-slate-400">点击时间轴上的事件点查看详情</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
              {selectedEvent ? selectedEvent.eventType : '未选中'}
            </span>
          </div>

          {selectedEvent ? (
            <div className="mt-4 space-y-3 text-sm text-slate-300">
              <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-500">发生时间</p>
                <p className="mt-1 font-medium text-white">{formatDateTime(selectedEvent.occurredAt)}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-3">
                  <p className="text-xs text-slate-500">设备</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{selectedEvent.deviceId}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-3">
                  <p className="text-xs text-slate-500">Source</p>
                  <p className="mt-1 font-medium text-slate-100">{selectedEvent.source}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-3">
                  <p className="text-xs text-slate-500">应用</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{selectedEvent.packageName ?? '--'}</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-slate-900/80 p-3">
                  <p className="text-xs text-slate-500">Class</p>
                  <p className="mt-1 break-all font-medium text-slate-100">{selectedEvent.className ?? '--'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-white/10 bg-slate-900/60 px-4 py-10 text-center text-sm text-slate-400">
              当前窗口没有事件可展示。
            </div>
          )}
        </section>

        <section className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">当前窗口时间明细</h3>
              <p className="mt-1 text-xs text-slate-400">保留原始列表，便于和横向时间轴逐条核对</p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300">
              {visibleEventList.length} 条
            </span>
          </div>

          <div className="mt-4 max-h-[760px] space-y-3 overflow-auto pr-1">
            {visibleEventList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/60 px-4 py-8 text-center text-sm text-slate-400">
                当前可视窗口没有事件。
              </div>
            ) : null}

            {visibleEventList.map((event) => {
              const tone = eventToneMap[event.eventType] ?? 'bg-white/5 text-slate-200 border-white/10';
              const isSelected = selectedEvent?.id === event.id;

              return (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => setSelectedEventId(event.id)}
                  className={`block w-full rounded-2xl border p-4 text-left transition ${
                    isSelected
                      ? 'border-sky-300/40 bg-sky-400/10'
                      : 'border-white/8 bg-slate-900/70 hover:border-sky-400/20 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">{formatDateTime(event.occurredAt)}</p>
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
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </section>
  );
}
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  Clock3,
  Gauge,
  MapPinned,
  RefreshCcw,
  Route,
  Smartphone,
} from 'lucide-react';
import { TrackMap } from './components/TrackMap';
import { fetchLocations } from './lib/api';
import type { LocationPoint, TrackStats } from './lib/types';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatDateInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toLocalInputDateTime(date: Date) {
  return `${formatDateInput(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toRange(date: string, startTime: string, endTime: string) {
  return {
    startAt: new Date(`${date}T${startTime}:00`).toISOString(),
    endAt: new Date(`${date}T${endTime}:59`).toISOString(),
  };
}

function formatDateTime(value: string | null) {
  if (!value) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCoordinate(value: number | null) {
  return value === null ? '--' : value.toFixed(5);
}

function calculateStats(points: LocationPoint[]): TrackStats {
  if (points.length === 0) {
    return {
      totalPoints: 0,
      startedAt: null,
      endedAt: null,
      durationMinutes: 0,
      deviceCount: 0,
      minLatitude: null,
      maxLatitude: null,
      minLongitude: null,
      maxLongitude: null,
    };
  }

  const startedAt = points[0].recordedAt;
  const endedAt = points[points.length - 1].recordedAt;
  const durationMinutes = Math.max(
    0,
    Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000),
  );

  let minLatitude: number | null = null;
  let maxLatitude: number | null = null;
  let minLongitude: number | null = null;
  let maxLongitude: number | null = null;

  for (const point of points) {
    minLatitude = minLatitude === null ? point.latitude : Math.min(minLatitude, point.latitude);
    maxLatitude = maxLatitude === null ? point.latitude : Math.max(maxLatitude, point.latitude);
    minLongitude = minLongitude === null ? point.longitude : Math.min(minLongitude, point.longitude);
    maxLongitude = maxLongitude === null ? point.longitude : Math.max(maxLongitude, point.longitude);
  }

  return {
    totalPoints: points.length,
    startedAt,
    endedAt,
    durationMinutes,
    deviceCount: new Set(points.map((point) => point.deviceId)).size,
    minLatitude,
    maxLatitude,
    minLongitude,
    maxLongitude,
  };
}

const now = new Date();

export default function App() {
  const [selectedDate, setSelectedDate] = useState(formatDateInput(now));
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState(toLocalInputDateTime(now).slice(11, 16));
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQueryLabel, setLastQueryLabel] = useState('');

  const stats = useMemo(() => calculateStats(points), [points]);

  async function loadTrack() {
    const { startAt, endAt } = toRange(selectedDate, startTime, endTime);
    if (new Date(startAt).getTime() > new Date(endAt).getTime()) {
      setError('开始时间不能晚于结束时间');
      setPoints([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await fetchLocations(startAt, endAt);
      setPoints(result);
      setLastQueryLabel(`${selectedDate} ${startTime} - ${endTime}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : '轨迹查询失败');
      setPoints([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadTrack();
  }, []);

  const statCards = [
    {
      icon: Route,
      label: '轨迹点数量',
      value: String(stats.totalPoints),
      hint: lastQueryLabel || '默认加载当天数据',
    },
    {
      icon: Clock3,
      label: '开始 / 结束',
      value: `${formatDateTime(stats.startedAt)} / ${formatDateTime(stats.endedAt)}`,
      hint: `${stats.durationMinutes} 分钟跨度`,
    },
    {
      icon: Smartphone,
      label: '设备数量',
      value: String(stats.deviceCount),
      hint: '首版按 userId=1 固定查询',
    },
    {
      icon: MapPinned,
      label: '经纬度包围盒',
      value: `${formatCoordinate(stats.minLatitude)}, ${formatCoordinate(stats.minLongitude)}`,
      hint: `${formatCoordinate(stats.maxLatitude)}, ${formatCoordinate(stats.maxLongitude)}`,
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.12),_transparent_22%),linear-gradient(180deg,_#020617_0%,_#0f172a_42%,_#111827_100%)] text-slate-50">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-8 px-4 py-6 md:px-8 md:py-10">
        <section className="grid gap-4 rounded-[32px] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 backdrop-blur-xl md:grid-cols-[1.2fr_0.8fr] md:p-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-emerald-200">
              <Gauge className="h-3.5 w-3.5" />
              TrackOS Dashboard
            </div>
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white md:text-5xl">
                用户 1 的轨迹主视图
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 md:text-base">
                以日期为主入口，支持细化到任意时间范围。地图显示当天轨迹线、起终点位置和明细点位，数据直接来自现有后端 /api/locations 接口。
              </p>
            </div>
          </div>
          <div className="rounded-[28px] border border-white/10 bg-slate-950/60 p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-300">
                <span className="flex items-center gap-2 text-slate-200">
                  <CalendarDays className="h-4 w-4 text-emerald-300" />
                  查询日期
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-50 outline-none transition focus:border-emerald-400/50"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="text-slate-200">开始时间</span>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-50 outline-none transition focus:border-emerald-400/50"
                  />
                </label>
                <label className="space-y-2 text-sm text-slate-300">
                  <span className="text-slate-200">结束时间</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/90 px-4 py-3 text-slate-50 outline-none transition focus:border-emerald-400/50"
                  />
                </label>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadTrack()}
                disabled={isLoading}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-medium text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                {isLoading ? '查询中' : '刷新轨迹'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const current = new Date();
                  setSelectedDate(formatDateInput(current));
                  setStartTime('00:00');
                  setEndTime('23:59');
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-slate-200 transition hover:bg-white/10"
              >
                切回整天视图
              </button>
            </div>
            {error ? (
              <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </p>
            ) : null}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">{card.label}</span>
                  <Icon className="h-5 w-5 text-emerald-300" />
                </div>
                <p className="mt-4 text-lg font-semibold tracking-tight text-white">{card.value}</p>
                <p className="mt-2 text-xs text-slate-400">{card.hint}</p>
              </article>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
          <div className="space-y-4">
            <TrackMap points={points} />
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-slate-300 backdrop-blur-lg">
              <div className="flex items-center gap-2 text-slate-100">
                <MapPinned className="h-4 w-4 text-emerald-300" />
                地图说明
              </div>
              <p className="mt-3 leading-6">
                绿色圆点表示起点，橙色圆点表示终点，轨迹线按 recordedAt 时间升序连接。若未配置 VITE_AMAP_KEY，地图区域会提示配置缺失。
              </p>
            </div>
          </div>

          <aside className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/10 backdrop-blur-lg">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">轨迹明细</h2>
              <span className="rounded-full border border-white/10 bg-slate-950/50 px-3 py-1 text-xs text-slate-300">
                {points.length} 条
              </span>
            </div>
            <div className="mt-4 max-h-[720px] space-y-3 overflow-auto pr-1">
              {points.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-6 text-center text-sm text-slate-400">
                  当前范围没有可展示的轨迹点。
                </div>
              ) : null}
              {points.map((point, index) => (
                <article
                  key={point.id}
                  className="rounded-2xl border border-white/8 bg-slate-950/45 p-4 transition hover:border-emerald-400/30 hover:bg-slate-950/70"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-white">#{index + 1}</p>
                      <p className="mt-1 text-xs text-slate-400">{formatDateTime(point.recordedAt)}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300">
                      {point.deviceId}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-300">
                    <div>
                      <p className="text-slate-500">纬度</p>
                      <p className="mt-1 font-medium text-slate-100">{point.latitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">经度</p>
                      <p className="mt-1 font-medium text-slate-100">{point.longitude.toFixed(6)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">精度</p>
                      <p className="mt-1 font-medium text-slate-100">
                        {point.accuracy !== undefined ? `${point.accuracy} m` : '--'}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">速度</p>
                      <p className="mt-1 font-medium text-slate-100">
                        {point.speed !== undefined ? `${point.speed} m/s` : '--'}
                      </p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
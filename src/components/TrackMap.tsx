import { useEffect, useRef, useState } from 'react';
import { loadAmap } from '../lib/amap';
import type { LocationPoint, StayPoint } from '../lib/types';

type TrackMapProps = {
  points: LocationPoint[];
  stayPoints: StayPoint[];
};

// Emoji for each place label — shown in the marker bubble
const placeLabelEmoji: Record<string, string> = {
  home: '🏠',
  work: '🏢',
  food: '🍜',
  shop: '🛍',
  leisure: '🎭',
  education: '🏫',
  medical: '🏥',
  finance: '🏦',
  transport: '🚇',
  other: '📍',
};

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h === 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分钟`;
}

function buildInfoWindowContent(sp: StayPoint) {
  const emoji = placeLabelEmoji[sp.placeLabel ?? 'other'] ?? '📍';
  const name = sp.poiName ?? sp.address ?? '未知地点';
  const type = sp.poiType ? sp.poiType.split(';')[0] : '';
  const duration = formatDuration(sp.durationSec);
  const start = new Date(sp.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  const end = new Date(sp.endTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

  return `
    <div style="font-family:system-ui,sans-serif;min-width:180px;max-width:260px;padding:12px 14px;background:#0f172a;border-radius:14px;border:1px solid rgba(255,255,255,0.1);color:#e2e8f0">
      <div style="font-size:18px;margin-bottom:6px">${emoji} <span style="font-size:14px;font-weight:600;color:#fff">${name}</span></div>
      ${type ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:8px">${type}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
        <div><span style="color:#64748b">时段</span><br/><span style="color:#cbd5e1">${start} – ${end}</span></div>
        <div><span style="color:#64748b">停留</span><br/><span style="color:#34d399">${duration}</span></div>
        <div><span style="color:#64748b">半径</span><br/><span style="color:#cbd5e1">${sp.radiusM} m</span></div>
        <div><span style="color:#64748b">点数</span><br/><span style="color:#cbd5e1">${sp.pointCount}</span></div>
      </div>
      ${sp.address ? `<div style="margin-top:8px;font-size:11px;color:#64748b;border-top:1px solid rgba(255,255,255,0.07);padding-top:8px">${sp.address}</div>` : ''}
    </div>`;
}

export function TrackMap({ points, stayPoints }: TrackMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (!containerRef.current || mapRef.current) {
        return;
      }

      try {
        const AMap = await loadAmap();
        if (!isMounted || !containerRef.current) {
          return;
        }

        const map = new AMap.Map(containerRef.current, {
          viewMode: '3D',
          zoom: 11,
          mapStyle: 'amap://styles/darkblue',
        });

        map.addControl(new AMap.Scale());
        map.addControl(new AMap.ToolBar({ position: 'RB' }));
        mapRef.current = map;
        setMapError(null);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setMapError(error instanceof Error ? error.message : '地图初始化失败');
      }
    }

    void initMap();

    return () => {
      isMounted = false;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function renderTrack() {
      if (!mapRef.current) {
        return;
      }

      const map = mapRef.current;
      const AMap = window.AMap;

      overlaysRef.current.forEach((overlay) => map.remove(overlay));
      overlaysRef.current = [];

      if (!AMap || points.length === 0) {
        map.setZoomAndCenter(11, [116.397428, 39.90923]);
        return;
      }

      const path = points.map((point) => [point.longitude, point.latitude]);
      const polyline = new AMap.Polyline({
        path,
        strokeColor: '#22c55e',
        strokeWeight: 6,
        strokeOpacity: 0.85,
        lineJoin: 'round',
        lineCap: 'round',
      });

      const startMarker = new AMap.Marker({
        position: path[0],
        content:
          '<div style="width:16px;height:16px;border-radius:999px;background:#22c55e;border:3px solid #dcfce7;box-shadow:0 0 0 6px rgba(34,197,94,0.18)"></div>',
        anchor: 'center',
      });

      const endMarker = new AMap.Marker({
        position: path[path.length - 1],
        content:
          '<div style="width:16px;height:16px;border-radius:999px;background:#f97316;border:3px solid #ffedd5;box-shadow:0 0 0 6px rgba(249,115,22,0.2)"></div>',
        anchor: 'center',
      });

      // Stay point markers — one circle per cluster
      const stayOverlays: any[] = stayPoints.map((sp) => {
        const emoji = placeLabelEmoji[sp.placeLabel ?? 'other'] ?? '📍';
        const durationMin = Math.round(sp.durationSec / 60);
        // Marker icon: emoji badge
        const markerContent = `
          <div style="
            display:flex;align-items:center;gap:4px;
            padding:4px 8px 4px 6px;
            background:rgba(15,23,42,0.92);
            border:1.5px solid rgba(139,92,246,0.5);
            border-radius:999px;
            font-size:12px;color:#e2e8f0;
            box-shadow:0 2px 12px rgba(0,0,0,0.5),0 0 0 4px rgba(139,92,246,0.12);
            white-space:nowrap;
          ">
            <span style="font-size:14px">${emoji}</span>
            <span style="font-weight:600;color:#c4b5fd">${durationMin}min</span>
          </div>`;

        const marker = new AMap.Marker({
          position: [sp.centerLon, sp.centerLat],
          content: markerContent,
          anchor: 'bottom-center',
          zIndex: 120,
        });

        // Radius circle
        const circle = new AMap.Circle({
          center: [sp.centerLon, sp.centerLat],
          radius: Math.max(50, sp.radiusM),
          strokeColor: 'rgba(139,92,246,0.6)',
          strokeWeight: 1.5,
          strokeOpacity: 0.8,
          fillColor: 'rgba(139,92,246,0.08)',
          fillOpacity: 1,
        });

        // Info window (shown on marker click)
        const infoWindow = new AMap.InfoWindow({
          content: buildInfoWindowContent(sp),
          anchor: 'bottom-center',
          offset: new AMap.Pixel(0, -32),
          closeWhenClickMap: true,
        });

        marker.on('click', () => {
          infoWindow.open(map, marker.getPosition());
        });

        return [marker, circle];
      }).flat();

      map.add([polyline, startMarker, endMarker, ...stayOverlays]);
      overlaysRef.current = [polyline, startMarker, endMarker, ...stayOverlays];
      map.setFitView(overlaysRef.current, false, [72, 72, 72, 72]);
    }

    void renderTrack();
  }, [points, stayPoints]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 md:h-[560px]">
      <div ref={containerRef} className="h-full w-full" />
      {stayPoints.length > 0 ? (
        <div className="absolute left-4 top-4 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-slate-950/80 p-3 text-xs text-slate-300 backdrop-blur-sm">
          <p className="font-medium text-slate-100">停留点 {stayPoints.length} 处</p>
          {stayPoints.map((sp) => {
            const emoji = placeLabelEmoji[sp.placeLabel ?? 'other'] ?? '📍';
            const name = sp.poiName ?? sp.address?.slice(0, 16) ?? `停留 #${sp.id + 1}`;
            return (
              <p key={sp.id} className="text-slate-400">{emoji} {name}</p>
            );
          })}
        </div>
      ) : null}
      {mapError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 p-6 text-center text-sm text-amber-200">
          {mapError}
        </div>
      ) : null}
      {!mapError && points.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55 p-6 text-center text-sm text-slate-300 backdrop-blur-sm">
          当前时间范围内没有轨迹点，调整日期或时间后重新查询。
        </div>
      ) : null}
    </div>
  );
}

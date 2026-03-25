import { useEffect, useRef, useState } from 'react';
import { loadAmap } from '../lib/amap';
import type { LocationPoint } from '../lib/types';

type TrackMapProps = {
  points: LocationPoint[];
};

export function TrackMap({ points }: TrackMapProps) {
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

      map.add([polyline, startMarker, endMarker]);
      overlaysRef.current = [polyline, startMarker, endMarker];
      map.setFitView(overlaysRef.current, false, [72, 72, 72, 72]);
    }

    void renderTrack();
  }, [points]);

  return (
    <div className="relative h-[420px] overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/70 shadow-2xl shadow-black/30 md:h-[560px]">
      <div ref={containerRef} className="h-full w-full" />
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
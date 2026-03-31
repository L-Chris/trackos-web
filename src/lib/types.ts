export const TRACK_USER_ID = '1';

export type LocationPoint = {
  id: string;
  deviceId: string;
  latitude: number;
  longitude: number;
  rawLatitude?: number;
  rawLongitude?: number;
  coordinateSystem?: 'GCJ-02';
  recordedAt: string;
  accuracy?: number;
  speed?: number;
  heading?: number;
  altitude?: number;
};

export type LocationResponse = {
  userId: string;
  points: LocationPoint[];
};

export type LocationApiEnvelope = {
  success: boolean;
  data: LocationResponse;
};

export type TrackStats = {
  totalPoints: number;
  startedAt: string | null;
  endedAt: string | null;
  durationMinutes: number;
  deviceCount: number;
  minLatitude: number | null;
  maxLatitude: number | null;
  minLongitude: number | null;
  maxLongitude: number | null;
};

export type AppUsageSummary = {
  id: string;
  deviceId: string;
  packageName: string;
  appName: string;
  windowStartAt: string;
  windowEndAt: string;
  foregroundTimeMs: number;
  lastUsedAt: string | null;
};

export type AppUsageSummaryResponse = {
  userId: string;
  summaries: AppUsageSummary[];
};

export type AppUsageSummaryApiEnvelope = {
  success: boolean;
  data: AppUsageSummaryResponse;
};

export type UsageRankingItem = {
  packageName: string;
  appName: string;
  totalForegroundTimeMs: number;
  lastUsedAt: string | null;
  deviceCount: number;
  recordCount: number;
};

export type UsageRankingResponse = {
  userId: string;
  rankings: UsageRankingItem[];
};

export type UsageRankingApiEnvelope = {
  success: boolean;
  data: UsageRankingResponse;
};

export type UsageTrendBucket = {
  bucketStartAt: string;
  bucketEndAt: string;
  totalForegroundTimeMs: number;
  activeAppCount: number;
};

export type UsageTrendResponse = {
  userId: string;
  bucket: string;
  buckets: UsageTrendBucket[];
};

export type UsageTrendApiEnvelope = {
  success: boolean;
  data: UsageTrendResponse;
};

export type UsageEvent = {
  id: string;
  deviceId: string;
  recordKey: string;
  eventType: string;
  packageName: string | null;
  className: string | null;
  occurredAt: string;
  source: string;
  metadata: string | null;
};

export type UsageEventResponse = {
  userId: string;
  events: UsageEvent[];
};

export type UsageEventApiEnvelope = {
  success: boolean;
  data: UsageEventResponse;
};

export type MoveEvent = {
  id: string;
  deviceId: string;
  recordKey: string;
  moveType: string;
  confidence: number | null;
  occurredAt: string;
};

export type MoveEventResponse = {
  userId: string;
  events: MoveEvent[];
};

export type MoveEventApiEnvelope = {
  success: boolean;
  data: MoveEventResponse;
};

export type PlaceLabel =
  | 'home'
  | 'work'
  | 'food'
  | 'shop'
  | 'leisure'
  | 'education'
  | 'medical'
  | 'finance'
  | 'transport'
  | 'other';

export type StayPoint = {
  id: number;
  centerLat: number;
  centerLon: number;
  startTime: string;
  endTime: string;
  durationSec: number;
  pointCount: number;
  radiusM: number;
  address: string | null;
  poiName: string | null;
  poiType: string | null;
  placeLabel: PlaceLabel | null;
};

export type StayPointResponse = {
  userId: string;
  stayPoints: StayPoint[];
  noisePointCount: number;
};

export type StayPointApiEnvelope = {
  success: boolean;
  data: StayPointResponse;
};
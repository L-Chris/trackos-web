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
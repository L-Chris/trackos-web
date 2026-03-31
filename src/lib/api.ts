import axios from 'axios';
import {
  TRACK_USER_ID,
  type AppUsageSummaryApiEnvelope,
  type LocationApiEnvelope,
  type LocationPoint,
  type MoveEventApiEnvelope,
  type StayPointApiEnvelope,
  type UsageEventApiEnvelope,
  type UsageRankingApiEnvelope,
  type UsageTrendApiEnvelope,
} from './types';

function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:6000/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:6000/api`;
}

function normalizeApiBaseUrl(rawBaseUrl: string) {
  const trimmedBaseUrl = rawBaseUrl.trim().replace(/\/$/, '');

  if (!trimmedBaseUrl) {
    return getDefaultApiBaseUrl();
  }

  try {
    const parsedUrl = new URL(trimmedBaseUrl);
    parsedUrl.pathname = parsedUrl.pathname.endsWith('/api')
      ? parsedUrl.pathname.replace(/\/$/, '')
      : `${parsedUrl.pathname.replace(/\/$/, '')}/api`;

    return parsedUrl.toString().replace(/\/$/, '');
  } catch {
    return trimmedBaseUrl.endsWith('/api') ? trimmedBaseUrl : `${trimmedBaseUrl}/api`;
  }
}

export const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()),
  timeout: 15000,
});

export async function fetchLocations(startAt: string, endAt: string) {
  const response = await api.get<LocationApiEnvelope>('/locations', {
    params: {
      userId: TRACK_USER_ID,
      startAt,
      endAt,
    },
  });

  return response.data.data.points.sort(
    (left: LocationPoint, right: LocationPoint) =>
      new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime(),
  );
}

type UsageSummaryQuery = {
  startAt: string;
  endAt: string;
  deviceId?: string;
  packageName?: string;
};

type UsageEventQuery = UsageSummaryQuery & {
  eventType?: string;
  limit?: number;
  offset?: number;
};

export async function fetchAppUsageSummaries(query: UsageSummaryQuery) {
  const response = await api.get<AppUsageSummaryApiEnvelope>('/app-usage-summaries', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      deviceId: query.deviceId || undefined,
      packageName: query.packageName || undefined,
    },
  });

  return response.data.data.summaries.sort(
    (left, right) => new Date(left.windowStartAt).getTime() - new Date(right.windowStartAt).getTime(),
  );
}

export async function fetchUsageRanking(query: UsageSummaryQuery & { limit?: number }) {
  const response = await api.get<UsageRankingApiEnvelope>('/app-usage-summaries/ranking', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      deviceId: query.deviceId || undefined,
      packageName: query.packageName || undefined,
      limit: query.limit,
    },
  });

  return response.data.data.rankings;
}

export async function fetchUsageTrend(query: UsageSummaryQuery & { bucket?: string }) {
  const response = await api.get<UsageTrendApiEnvelope>('/app-usage-summaries/trend', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      deviceId: query.deviceId || undefined,
      packageName: query.packageName || undefined,
      bucket: query.bucket || undefined,
    },
  });

  return response.data.data.buckets;
}

export async function fetchUsageEvents(query: UsageEventQuery) {
  const response = await api.get<UsageEventApiEnvelope>('/usage-events', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      deviceId: query.deviceId || undefined,
      packageName: query.packageName || undefined,
      eventType: query.eventType || undefined,
      limit: query.limit,
      offset: query.offset,
    },
  });

  return response.data.data.events.sort(
    (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );
}

type MoveEventQuery = {
  startAt: string;
  endAt: string;
  deviceId?: string;
  moveType?: string;
  limit?: number;
};

export async function fetchMoveEvents(query: MoveEventQuery) {
  const response = await api.get<MoveEventApiEnvelope>('/move-events', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      deviceId: query.deviceId || undefined,
      moveType: query.moveType || undefined,
      limit: query.limit,
    },
  });

  return response.data.data.events.sort(
    (left, right) => new Date(left.occurredAt).getTime() - new Date(right.occurredAt).getTime(),
  );
}

type StayPointQuery = {
  startAt: string;
  endAt: string;
  eps1?: number;
  eps2?: number;
  minPts?: number;
};

export async function fetchStayPoints(query: StayPointQuery) {
  const response = await api.get<StayPointApiEnvelope>('/stay-points', {
    params: {
      userId: TRACK_USER_ID,
      startAt: query.startAt,
      endAt: query.endAt,
      eps1: query.eps1,
      eps2: query.eps2,
      minPts: query.minPts,
    },
  });

  return response.data.data;
}
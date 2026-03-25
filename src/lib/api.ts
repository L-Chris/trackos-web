import axios from 'axios';
import { TRACK_USER_ID, type LocationApiEnvelope, type LocationPoint } from './types';

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
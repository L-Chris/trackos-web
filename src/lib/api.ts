import axios from 'axios';
import { TRACK_USER_ID, type LocationApiEnvelope, type LocationPoint } from './types';

function getDefaultApiBaseUrl() {
  if (typeof window === 'undefined') {
    return 'http://localhost:6000/api';
  }

  return `${window.location.protocol}//${window.location.hostname}:6000/api`;
}

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl(),
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
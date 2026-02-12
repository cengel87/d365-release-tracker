import type { ChangeLogItem, Note, ReleaseFeature, WatchlistItem } from './types'

export async function j<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    // IMPORTANT: spread init AFTER defaults? No — we want init to win for method, body, etc.
    // But we also want to merge headers safely.
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      (data && typeof data === "object" && (data.error || data.message)) ||
      `Request failed: ${res.status}`;
    throw new Error(`${msg}${data?.detail ? ` — ${data.detail}` : ""}`);
  }

  return data as T;
}


export const api = {
  fetchReleasePlans: async (): Promise<{ fetchedAt: string; results: ReleaseFeature[]; sourceUrl: string }> =>
    j('/.netlify/functions/releaseplans'),

  getWatchlist: async (): Promise<WatchlistItem[]> => j('/.netlify/functions/watchlist', { method: 'GET' }),

  addWatchlist: async (payload: { release_plan_id: string; feature_name: string; product_name: string }) =>
    j('/.netlify/functions/watchlist', { method: 'POST', body: JSON.stringify(payload) }),

  removeWatchlist: async (release_plan_id: string) =>
    j('/.netlify/functions/watchlist', { method: 'DELETE', body: JSON.stringify({ release_plan_id }) }),

  setImpact: async (payload: { release_plan_id: string; impact: WatchlistItem['impact'] }) =>
    j('/.netlify/functions/watchlist-impact', { method: 'POST', body: JSON.stringify(payload) }),

  listNotes: async (release_plan_id: string): Promise<Note[]> =>
    j(`/.netlify/functions/notes?release_plan_id=${encodeURIComponent(release_plan_id)}`),

  addNote: async (payload: { release_plan_id: string; author_name: string; content: string }) =>
    j('/.netlify/functions/notes', { method: 'POST', body: JSON.stringify(payload) }),

  listChanges: async (days: number): Promise<ChangeLogItem[]> =>
    j(`/.netlify/functions/changes?days=${days}`),

  refreshChangesNow: async (): Promise<{ total: number; newCount: number; changedCount: number }> =>
    j('/.netlify/functions/refresh', { method: 'POST' }),
}

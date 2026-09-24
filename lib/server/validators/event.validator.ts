/**
 * Validate body cua POST /api/events — dung bang o api-endpoints.md muc 1.
 *
 * Whitelist 8 field: moi field la khac bi loai bo IM LANG (khong tra loi).
 * `platform` va `created_at` do server tu gan, client gui len cung bi bo qua.
 *
 * `isEventName` / `isScreenName` nhap tu @gsm/shared — cung mot danh sach ma
 * apps/web dung de goi, nen hai ben khong the lech nhau.
 */
import {
  isEventName,
  isFlowValue,
  isScreenName,
  type EventPayload,
} from '@gsm/shared';

export type ValidationResult =
  | { ok: true; value: EventPayload }
  | { ok: false; error: string };

function invalid(error: string): ValidationResult {
  return { ok: false, error };
}

export function validateEventPayload(body: unknown): ValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return invalid('Request body must be a JSON object');
  }

  const raw = body as Record<string, unknown>;

  // ── session_id, user_id: string khac rong ──
  for (const field of ['session_id', 'user_id'] as const) {
    const value = raw[field];
    if (value === undefined || value === null) {
      return invalid(`Missing required field: ${field}`);
    }
    if (typeof value !== 'string' || value.trim() === '') {
      return invalid(`Invalid value for ${field}: expected a non-empty string`);
    }
  }

  // ── flow ──
  if (raw.flow === undefined || raw.flow === null) {
    return invalid('Missing required field: flow');
  }
  if (!isFlowValue(raw.flow)) {
    return invalid('Invalid value for flow: expected "ride" | "food" | "none"');
  }

  // ── event_name ──
  if (raw.event_name === undefined || raw.event_name === null) {
    return invalid('Missing required field: event_name');
  }
  if (!isEventName(raw.event_name)) {
    return invalid(`Invalid value for event_name: unknown event "${String(raw.event_name)}"`);
  }

  // ── screen_name ──
  if (raw.screen_name === undefined || raw.screen_name === null) {
    return invalid('Missing required field: screen_name');
  }
  if (!isScreenName(raw.screen_name)) {
    return invalid(`Invalid value for screen_name: unknown screen "${String(raw.screen_name)}"`);
  }

  // ── step_index: so nguyen >= 0 ──
  if (raw.step_index === undefined || raw.step_index === null) {
    return invalid('Missing required field: step_index');
  }
  if (
    typeof raw.step_index !== 'number' ||
    !Number.isInteger(raw.step_index) ||
    raw.step_index < 0
  ) {
    return invalid('Invalid value for step_index: expected an integer >= 0');
  }

  // ── previous_screen: optional, mac dinh null ──
  let previousScreen: EventPayload['previous_screen'] = null;
  if (raw.previous_screen !== undefined && raw.previous_screen !== null) {
    if (!isScreenName(raw.previous_screen)) {
      return invalid(
        `Invalid value for previous_screen: unknown screen "${String(raw.previous_screen)}"`,
      );
    }
    previousScreen = raw.previous_screen;
  }

  // ── properties: optional, mac dinh {} ──
  let properties: Record<string, unknown> = {};
  if (raw.properties !== undefined && raw.properties !== null) {
    if (
      typeof raw.properties !== 'object' ||
      Array.isArray(raw.properties)
    ) {
      return invalid('Invalid value for properties: expected an object');
    }
    properties = raw.properties as Record<string, unknown>;
  }

  return {
    ok: true,
    value: {
      session_id: (raw.session_id as string).trim(),
      user_id: (raw.user_id as string).trim(),
      flow: raw.flow,
      event_name: raw.event_name,
      screen_name: raw.screen_name,
      previous_screen: previousScreen,
      step_index: raw.step_index,
      properties,
    },
  };
}

// ─────────────────────────────────────────────────────────────
// Query cua GET /api/events — api-endpoints.md muc 2 & 3
// ─────────────────────────────────────────────────────────────

export interface EventQuery {
  sessionId?: string;
  /** Ben qua nhieu phien — nguon du lieu cho man /history. */
  userId?: string;
  flow?: 'ride' | 'food';
  from?: Date;
  to?: Date;
  /**
   * Trai `properties` thanh cot `prop_<ten>` o cap cao nhat.
   *
   * Cho cong cu BI doc JSON truc tiep: `properties` la map long nhau va MOI LOAI
   * EVENT CO BO KHOA KHAC NHAU, nen Power BI dung mot cot kieu Record ma nguoi
   * dung phai tu bam Expand, va expand ra khong deu giua cac dong.
   *
   * Tien to `prop_` co y TRUNG voi analysis/fetch_events.py — hai duong doc du
   * lieu cho ra cung ten cot, nen bieu do Power BI va bieu do matplotlib noi ve
   * cung mot thu.
   */
  flat?: boolean;
  /** Chan so document tra ve. Vang = tra het, y nhu truoc. */
  limit?: number;
}

export type QueryValidationResult =
  | { ok: true; value: EventQuery }
  | { ok: false; error: string };

export function validateEventQuery(params: URLSearchParams): QueryValidationResult {
  const query: EventQuery = {};

  const sessionId = params.get('session_id');
  if (sessionId !== null) {
    if (sessionId.trim() === '') {
      return { ok: false, error: 'Invalid value for session_id: expected a non-empty string' };
    }
    query.sessionId = sessionId.trim();
  }

  const userId = params.get('user_id');
  if (userId !== null) {
    if (userId.trim() === '') {
      return { ok: false, error: 'Invalid value for user_id: expected a non-empty string' };
    }
    query.userId = userId.trim();
  }

  const flow = params.get('flow');
  if (flow !== null) {
    if (flow !== 'ride' && flow !== 'food') {
      return { ok: false, error: 'Invalid value for flow: expected "ride" | "food"' };
    }
    query.flow = flow;
  }

  for (const key of ['from', 'to'] as const) {
    const value = params.get(key);
    if (value === null) continue;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: `Invalid value for ${key}: expected an ISO date (e.g. 2026-09-01)` };
    }
    query[key] = parsed;
  }

  // `flat=1` / `flat=true`. Bat ky gia tri nao khac deu bi tu choi thay vi coi
  // nhu false: `flat=0` ma lang le tra ve dang long nhau thi nguoi dung ngoi do
  // tim xem minh go sai o dau.
  const flat = params.get('flat');
  if (flat !== null) {
    if (flat !== '1' && flat !== 'true') {
      return { ok: false, error: 'Invalid value for flat: expected "1" or "true"' };
    }
    query.flat = true;
  }

  const limit = params.get('limit');
  if (limit !== null) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1) {
      return { ok: false, error: 'Invalid value for limit: expected a positive integer' };
    }
    query.limit = parsed;
  }

  return { ok: true, value: query };
}

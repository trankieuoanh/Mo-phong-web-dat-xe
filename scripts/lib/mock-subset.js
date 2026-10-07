/**
 * Tap con cua du lieu MOCK (powerBI/*.csv) can nap vao D1 — chi de co vai dong hien ra man hinh / Power BI.
 *
 * Quyet dinh cua chu du an (2026-10-02): khong can nap du 137k dong. Cac bang nho (dim_*, fact_promo_budget) va
 * `fact_ride` nap DU; hai bang lon con lai chi nap MOT PHAN:
 *   - fact_food       : LIMITS.fact_food dong DAU cua file (khong doi so voi luc da nap ngay 1).
 *   - fact_promo_burn : toi da LIMITS.fact_promo_burn dong DAU trong so cac dong ma `session_id` co that trong D1
 *                       (fact_ride day du + fact_food phan da nap) — de khong co dong "mo coi".
 * Moi cong cu (migrate, --verify, --deep, cutover-check) dung CHUNG file nay nen "so dong ky vong" luon khop nhau.
 * Muon nap het: `node scripts/migrate-firebase-to-d1.js --all-rows`.
 */
'use strict';

const LIMITS = { fact_food: 7232, fact_promo_burn: 3000 };

/**
 * @param {string} table
 * @param {unknown[][]} rows  dong CSV theo thu tu cot cua bang
 * @param {string[]} names    ten cot (cung thu tu)
 * @param {() => Set<string>} loadedSessions  tra ve session_id dang co (hoac se co) trong D1
 */
function subset(table, rows, names, loadedSessions) {
  if (table === 'fact_food') return rows.slice(0, LIMITS.fact_food);
  if (table === 'fact_promo_burn') {
    const at = names.indexOf('session_id');
    const sessions = loadedSessions();
    return rows.filter((r) => sessions.has(r[at])).slice(0, LIMITS.fact_promo_burn);
  }
  return rows;
}

module.exports = { LIMITS, subset };

-- View phang hoa cho Power BI. CREATE OR REPLACE VIEW: chay lai an toan, khong dong den du lieu.
-- Chi lay khoa `properties` CO THAT trong event-taxonomy.md. Khoa vang o event nao thi NULL.
-- Cot kieu so dung SAFE_CAST: mot gia tri hong khong lam vo ca truy van.
CREATE OR REPLACE VIEW `{{PROJECT}}.{{DATASET}}.vw_events_powerbi` AS
SELECT
  event_id,
  session_id,
  user_id,
  STARTS_WITH(user_id, 'anon-') AS is_anonymous_user,
  flow,
  event_name,
  screen_name,
  previous_screen,
  step_index,
  platform,
  created_at,
  DATE(created_at, 'Asia/Ho_Chi_Minh') AS created_date_vn,
  seed_batch,
  seed_batch IS NOT NULL AS is_seed,
  -- ride
  JSON_VALUE(properties, '$.vehicle_type')   AS vehicle_type,
  JSON_VALUE(properties, '$.payment_method') AS payment_method,
  JSON_VALUE(properties, '$.address_label')  AS address_label,
  JSON_VALUE(properties, '$.address_source') AS address_source,
  JSON_VALUE(properties, '$.pickup_label')   AS pickup_label,
  JSON_VALUE(properties, '$.route_source')   AS route_source,
  JSON_VALUE(properties, '$.promo_id')       AS promo_id,
  JSON_VALUE(properties, '$.cancel_reason')  AS cancel_reason,
  SAFE_CAST(JSON_VALUE(properties, '$.distance_km')      AS FLOAT64) AS distance_km,
  SAFE_CAST(JSON_VALUE(properties, '$.duration_min')     AS INT64)   AS duration_min,
  SAFE_CAST(JSON_VALUE(properties, '$.base_price')       AS INT64)   AS base_price,
  SAFE_CAST(JSON_VALUE(properties, '$.discount_amount')  AS INT64)   AS discount_amount,
  SAFE_CAST(JSON_VALUE(properties, '$.final_price')      AS INT64)   AS final_price,
  -- food
  JSON_VALUE(properties, '$.offer_id')       AS offer_id,
  JSON_VALUE(properties, '$.restaurant_id')  AS restaurant_id,
  JSON_VALUE(properties, '$.cuisine')        AS cuisine,
  SAFE_CAST(JSON_VALUE(properties, '$.item_count')       AS INT64) AS item_count,
  SAFE_CAST(JSON_VALUE(properties, '$.cart_total')       AS INT64) AS cart_total,
  SAFE_CAST(JSON_VALUE(properties, '$.shipping_fee')     AS INT64) AS shipping_fee,
  SAFE_CAST(JSON_VALUE(properties, '$.final_total')      AS INT64) AS final_total,
  properties
FROM `{{PROJECT}}.{{DATASET}}.{{TABLE}}`;

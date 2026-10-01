-- Bang su kien tho. Moi dong = 1 document cua collection Firestore `events`.
-- Khong pha huy: IF NOT EXISTS. Doi schema sau nay phai bang ALTER TABLE ADD COLUMN.
CREATE TABLE IF NOT EXISTS `{{PROJECT}}.{{DATASET}}.{{TABLE}}` (
  event_id        STRING    NOT NULL OPTIONS (description = 'Firestore document ID — khoa chong trung'),
  session_id      STRING,
  user_id         STRING    OPTIONS (description = 'So dien thoai E.164 (event that) hoac mock-user-* (event cu). La du lieu ca nhan.'),
  flow            STRING    OPTIONS (description = 'ride | food | none'),
  event_name      STRING,
  screen_name     STRING,
  previous_screen STRING,
  step_index      INT64,
  properties      JSON      OPTIONS (description = 'Map dac thu theo loai event, giu nguyen cau truc'),
  platform        STRING,
  created_at      TIMESTAMP OPTIONS (description = 'Firestore server timestamp. NULL neu document chua co created_at — KHONG bi thay bang gio hien tai'),
  seed_batch      STRING    OPTIONS (description = 'Chi co o event do scripts/seed-events.js sinh. NULL = event nguoi that click'),
  synced_at       TIMESTAMP OPTIONS (description = 'Lan MERGE gan nhat vao BigQuery')
)
PARTITION BY DATE(created_at)
CLUSTER BY flow, event_name, session_id;

-- Tao dataset. Khong pha huy: IF NOT EXISTS.
-- Cac {{...}} duoc `sync-events.js --init` thay bang bien moi truong BIGQUERY_*.
-- Location KHONG doi duoc sau khi tao; phai khop voi location cua Power BI/cac dataset khac.
CREATE SCHEMA IF NOT EXISTS `{{PROJECT}}.{{DATASET}}`
OPTIONS (location = '{{LOCATION}}');

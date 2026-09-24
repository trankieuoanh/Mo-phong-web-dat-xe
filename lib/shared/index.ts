/**
 * lib/shared — hop dong du lieu dung chung cho giao dien va route handler.
 *
 * Ca hai phia nhap tu day, nen danh sach `event_name` / `screen_name` hop le
 * KHONG THE lech nhau. Truoc day day la mot workspace rieng (`@gsm/shared`) vi
 * FE va BE la hai package khac nhau; gio chi con mot project nen no la mot thu
 * muc thuong — rang buoc "mot nguon su that duy nhat" thi khong doi.
 *
 * KHONG import gi tu `lib/server/` vao day: thu muc nay duoc code chay trong
 * trinh duyet nhap, nen no phai sach hoan toan phia client.
 */
export * from './types';
export * from './screens';
export * from './mock-data';
export * from './food';
export * from './pricing';
export * from './places';
export * from './route';
export * from './tiles';

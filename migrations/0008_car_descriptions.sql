-- migrations/0008_car_descriptions.sql
-- Adds car metadata columns for SEO description rendering.
-- All columns nullable so existing 67 rows remain valid.

ALTER TABLE cars ADD COLUMN chassis_code TEXT;
ALTER TABLE cars ADD COLUMN body_style TEXT;
ALTER TABLE cars ADD COLUMN country TEXT;
ALTER TABLE cars ADD COLUMN era TEXT;
ALTER TABLE cars ADD COLUMN notable_for TEXT;
ALTER TABLE cars ADD COLUMN description_zh TEXT;

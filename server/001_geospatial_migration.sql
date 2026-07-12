-- Migration to add Geospatial attributes for Live Fraud Heatmap

-- Add latitude and longitude columns
ALTER TABLE Complaints
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC;

ALTER TABLE PWA_Complaints
ADD COLUMN district VARCHAR(50) DEFAULT 'Kampala' NOT NULL,
ADD COLUMN latitude NUMERIC,
ADD COLUMN longitude NUMERIC;

-- Add check constraint for district compliance on Complaints
ALTER TABLE Complaints
ADD CONSTRAINT chk_complaints_district 
CHECK (district IN ('Kampala', 'Wakiso', 'Mbarara', 'Gulu', 'Masaka', 'Jinja', 'Other'));

-- Add check constraint for district compliance on PWA_Complaints
ALTER TABLE PWA_Complaints
ADD CONSTRAINT chk_pwa_complaints_district 
CHECK (district IN ('Kampala', 'Wakiso', 'Mbarara', 'Gulu', 'Masaka', 'Jinja', 'Other'));

-- Create fast database index on (district, created_at) for heavy aggregations
CREATE INDEX idx_complaints_district_time ON Complaints(district, created_at);
CREATE INDEX idx_pwa_complaints_district_time ON PWA_Complaints(district, created_at);

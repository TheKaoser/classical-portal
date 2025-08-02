-- Add start_year and end_year columns to periods table
ALTER TABLE periods 
ADD COLUMN start_year INTEGER,
ADD COLUMN end_year INTEGER;

-- Update existing periods with their historical years
UPDATE periods SET start_year = 1400, end_year = 1600 WHERE name = 'Renaissance';
UPDATE periods SET start_year = 1600, end_year = 1750 WHERE name = 'Baroque';
UPDATE periods SET start_year = 1750, end_year = 1820 WHERE name = 'Classical';
UPDATE periods SET start_year = 1820, end_year = 1910 WHERE name = 'Romantic';
UPDATE periods SET start_year = 1910, end_year = 2024 WHERE name = 'Modern & Contemporary';

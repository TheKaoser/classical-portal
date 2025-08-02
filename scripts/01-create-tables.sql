-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create periods table
CREATE TABLE periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT,
  pattern TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create authors table
CREATE TABLE authors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  period_id UUID REFERENCES periods(id) ON DELETE CASCADE,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  group_name TEXT NOT NULL CHECK (group_name IN ('Orchestral', 'Chamber', 'Solo', 'Opera', 'Vocal', 'Ballet')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pieces table
CREATE TABLE pieces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  author_id UUID REFERENCES authors(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  video_url TEXT,
  popularity INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_authors_period_id ON authors(period_id);
CREATE INDEX idx_pieces_author_id ON pieces(author_id);
CREATE INDEX idx_pieces_category_id ON pieces(category_id);
CREATE INDEX idx_pieces_popularity ON pieces(popularity DESC);

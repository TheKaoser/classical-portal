-- Insert periods
INSERT INTO periods (name, description, color, pattern) VALUES
('Renaissance', 'The rebirth of classical learning and wisdom (1400-1600)', '#8B4513', 'bg-gradient-to-br from-amber-100 to-orange-200'),
('Baroque', 'Ornate and complex musical forms (1600-1750)', '#4A0E4E', 'bg-gradient-to-br from-purple-100 to-indigo-200'),
('Classical', 'Balance, clarity, and formal structure (1750-1820)', '#2E8B57', 'bg-gradient-to-br from-green-100 to-emerald-200'),
('Romantic', 'Emotional expression and individualism (1820-1910)', '#DC143C', 'bg-gradient-to-br from-rose-100 to-red-200'),
('Modern & Contemporary', 'Innovation and experimentation (1910-present)', '#4169E1', 'bg-gradient-to-br from-blue-100 to-cyan-200');

-- Insert categories
INSERT INTO categories (name, group_name) VALUES
-- Orchestral
('Symphonies', 'Orchestral'),
('Concertos', 'Orchestral'),
('Overtures', 'Orchestral'),
('Symphonic Poems', 'Orchestral'),
('Orchestral Suites', 'Orchestral'),
-- Chamber
('Duos', 'Chamber'),
('Trios', 'Chamber'),
('Quartets', 'Chamber'),
('Quintets+', 'Chamber'),
('Sonatas w/ Accompaniment', 'Chamber'),
-- Solo
('Solo Piano', 'Solo'),
('Solo Strings', 'Solo'),
('Solo Organ', 'Solo'),
('Other Solo Instruments', 'Solo'),
-- Opera & Sacred
('Operas', 'Opera'),
('Oratorios', 'Opera'),
('Requiems & Masses', 'Opera'),
-- Vocal & Choral
('Lieder', 'Vocal'),
('Cantatas', 'Vocal'),
('Choral Music', 'Vocal'),
-- Ballet
('Full Ballets', 'Ballet');

-- Insert some sample authors
INSERT INTO authors (name, period_id, bio) 
SELECT 
  'Johannes Brahms',
  p.id,
  'German composer and pianist of the Romantic period, known for his symphonies, concertos, and chamber music.'
FROM periods p WHERE p.name = 'Romantic';

INSERT INTO authors (name, period_id, bio)
SELECT 
  'Franz Liszt',
  p.id,
  'Hungarian composer, virtuoso pianist, and teacher of the Romantic period, known for his technical innovations and expressive performances.'
FROM periods p WHERE p.name = 'Romantic';

INSERT INTO authors (name, period_id, bio)
SELECT 
  'Wolfgang Amadeus Mozart',
  p.id,
  'Austrian composer of the Classical period, widely recognized as one of the greatest composers in the history of Western music.'
FROM periods p WHERE p.name = 'Classical';

INSERT INTO authors (name, period_id, bio)
SELECT 
  'Johann Sebastian Bach',
  p.id,
  'German composer and musician of the Baroque period, known for his technical command, artistic beauty, and intellectual depth.'
FROM periods p WHERE p.name = 'Baroque';

-- Insert some sample pieces
INSERT INTO pieces (title, author_id, category_id, video_url, popularity)
SELECT 
  'Piano Concerto No. 2 in B-flat major',
  a.id,
  c.id,
  'https://www.youtube.com/watch?v=d0KdPTmBtdA',
  95
FROM authors a, categories c 
WHERE a.name = 'Johannes Brahms' AND c.name = 'Concertos';

INSERT INTO pieces (title, author_id, category_id, video_url, popularity)
SELECT 
  'Symphony No. 4 in E minor',
  a.id,
  c.id,
  'https://www.youtube.com/watch?v=pGXn3UcWZJk',
  90
FROM authors a, categories c 
WHERE a.name = 'Johannes Brahms' AND c.name = 'Symphonies';

INSERT INTO pieces (title, author_id, category_id, video_url, popularity)
SELECT 
  'Hungarian Rhapsody No. 2',
  a.id,
  c.id,
  'https://www.youtube.com/watch?v=LdH1hSWGFGU',
  98
FROM authors a, categories c 
WHERE a.name = 'Franz Liszt' AND c.name = 'Solo Piano';

INSERT INTO pieces (title, author_id, category_id, video_url, popularity)
SELECT 
  'Piano Sonata No. 11 in A major',
  a.id,
  c.id,
  'https://www.youtube.com/watch?v=Rb0UmrCXxVA',
  92
FROM authors a, categories c 
WHERE a.name = 'Wolfgang Amadeus Mozart' AND c.name = 'Solo Piano';

INSERT INTO pieces (title, author_id, category_id, video_url, popularity)
SELECT 
  'Brandenburg Concerto No. 3',
  a.id,
  c.id,
  'https://www.youtube.com/watch?v=GRxofEmo3HA',
  88
FROM authors a, categories c 
WHERE a.name = 'Johann Sebastian Bach' AND c.name = 'Concertos';

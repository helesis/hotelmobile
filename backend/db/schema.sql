-- =============================================
-- SPA BOOKING SYSTEM - DATABASE SCHEMA
-- =============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Kullanıcılar (admin + müşteri)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'customer')),
  phone VARCHAR(20),
  room_number VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Masaj türleri
CREATE TABLE massage_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  duration_minutes INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terapistler
CREATE TABLE therapists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL,
  photo_url VARCHAR(500),
  bio TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Terapist ↔ Masaj türü ilişkisi
CREATE TABLE therapist_massage_types (
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  massage_type_id UUID REFERENCES massage_types(id) ON DELETE CASCADE,
  PRIMARY KEY (therapist_id, massage_type_id)
);

-- Terapist çalışma programı (gün + saat)
CREATE TABLE therapist_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  therapist_id UUID REFERENCES therapists(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Pazar, 1=Pazartesi...
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

-- Kabinler
CREATE TABLE cabins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE
);

-- Kabin çalışma saatleri
CREATE TABLE cabin_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cabin_id UUID REFERENCES cabins(id) ON DELETE CASCADE,
  day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

-- Rezervasyonlar
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  therapist_id UUID REFERENCES therapists(id) ON DELETE SET NULL,
  cabin_id UUID REFERENCES cabins(id) ON DELETE SET NULL,
  massage_type_id UUID REFERENCES massage_types(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SEED DATA
-- =============================================

-- Admin kullanıcı (şifre: admin123)
INSERT INTO users (name, email, password_hash, role) VALUES
('Spa Admin', 'admin@voyagesorgun.com', '$2a$10$rOzJqSaB5e6N1P.NzV5G6.9kq3hW2iZqE8mXvLdT1A7cGYnHOyHpC', 'admin');

-- Demo müşteri (şifre: demo123)
INSERT INTO users (name, email, password_hash, role, room_number) VALUES
('Ahmet Yılmaz', 'ahmet@demo.com', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWFiLwIu', 'customer', '412');

-- Masaj türleri
INSERT INTO massage_types (name, description, duration_minutes, price) VALUES
('İsveç Masajı', 'Kas gerginliğini gideren klasik rahatlama masajı. Uzun ve akıcı hareketlerle tüm vücuda uygulanır.', 60, 1200),
('Derin Doku Masajı', 'Kronik kas ağrıları ve gerginlik için yoğun baskı tekniği. Derin doku katmanlarına ulaşır.', 90, 1600),
('Aromaterapi Masajı', 'Esansiyel yağlar eşliğinde uygulanan bütünsel rahatlama masajı.', 60, 1400),
('Taş Terapisi', 'Sıcak volkanik taşlarla uygulanan derin rahatlama ve enerji dengesi masajı.', 75, 1800),
('Türk Hamam Masajı', 'Geleneksel köpük masajı ve kese ile uygulanan otantik Türk deneyimi.', 90, 2000),
('Refleksoloji', 'Ayak tabanındaki enerji noktalarına baskı uygulayarak vücudu dengeye getiren teknik.', 45, 900),
('Gebelik Masajı', 'Hamile bireyler için özel olarak tasarlanmış nazik ve destekleyici masaj.', 60, 1300);

-- Terapistler
INSERT INTO therapists (name, bio) VALUES
('Elif Demir', 'İsveç ve aromaterapi konusunda 8 yıllık deneyime sahip. Müşteri odaklı yaklaşımıyla tanınır.'),
('Mehmet Çelik', 'Derin doku ve spor masajı uzmanı. Eski profesyonel atlet, 6 yıldır spa sektöründe.'),
('Zeynep Arslan', 'Taş terapisi ve geleneksel Türk masajı sertifikalı. Bütünsel iyileşme yaklaşımı benimser.'),
('Can Yıldız', 'Refleksoloji ve gebelik masajı uzmanı. 5 yıllık deneyim, sakin ve güven verici yaklaşım.'),
('Selin Kaya', 'Aromaterapi ve derin doku masajı konusunda uzmanlaşmış. Aroma bilimi sertifikalı.'),
('Burak Şahin', 'İsveç masajı ve taş terapisi uzmanı. 4 yıllık deneyim, güçlü ve etkili teknik.'),
('Ayşe Koç', 'Türk hamam kültürü ve geleneksel masaj konusunda 10 yıllık deneyim. Kıdemli terapist.');

-- Terapist masaj uzmanlıkları
-- Elif: İsveç, Aromaterapi
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Elif Demir' AND m.name IN ('İsveç Masajı', 'Aromaterapi Masajı');

-- Mehmet: Derin Doku, İsveç
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Mehmet Çelik' AND m.name IN ('Derin Doku Masajı', 'İsveç Masajı');

-- Zeynep: Taş Terapisi, Türk Hamam
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Zeynep Arslan' AND m.name IN ('Taş Terapisi', 'Türk Hamam Masajı');

-- Can: Refleksoloji, Gebelik
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Can Yıldız' AND m.name IN ('Refleksoloji', 'Gebelik Masajı');

-- Selin: Aromaterapi, Derin Doku
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Selin Kaya' AND m.name IN ('Aromaterapi Masajı', 'Derin Doku Masajı');

-- Burak: İsveç, Taş Terapisi
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Burak Şahin' AND m.name IN ('İsveç Masajı', 'Taş Terapisi');

-- Ayşe: Türk Hamam, Aromaterapi, Refleksoloji
INSERT INTO therapist_massage_types (therapist_id, massage_type_id)
SELECT t.id, m.id FROM therapists t, massage_types m
WHERE t.name = 'Ayşe Koç' AND m.name IN ('Türk Hamam Masajı', 'Aromaterapi Masajı', 'Refleksoloji');

-- Terapist çalışma programları (tümü Pzt-Cmt, 09:00-19:00)
INSERT INTO therapist_schedules (therapist_id, day_of_week, start_time, end_time)
SELECT t.id, d.day, '09:00', '19:00'
FROM therapists t, (VALUES (1),(2),(3),(4),(5),(6)) AS d(day);

-- 7 kabin
INSERT INTO cabins (name) VALUES
('Kabin 1'), ('Kabin 2'), ('Kabin 3'), ('Kabin 4'),
('Kabin 5'), ('Kabin 6'), ('Kabin 7');

-- Kabin çalışma saatleri (tümü Pzt-Pzr, 09:00-20:00)
INSERT INTO cabin_schedules (cabin_id, day_of_week, start_time, end_time)
SELECT c.id, d.day, '09:00', '20:00'
FROM cabins c, (VALUES (0),(1),(2),(3),(4),(5),(6)) AS d(day);

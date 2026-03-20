const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'spa.db');

let db;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    initSchema();
    saveDb();
  }
  migrateSchema();
  return db;
}

function migrateSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS time_slot_discounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    discount_percent REAL NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS availability_discount_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    max_percent REAL NOT NULL DEFAULT 15,
    step_percent REAL NOT NULL DEFAULT 3
  )`);
  db.run(`INSERT OR IGNORE INTO availability_discount_settings (id, max_percent, step_percent) VALUES (1, 15, 3)`);
  try { db.run('ALTER TABLE reservations ADD COLUMN price REAL'); } catch (e) { /* column exists */ }
  migrateSeedMassagesAndTherapistSkills();
  saveDb();
}

/** Yeni masaj türleri + terapist atamaları (yoksa ekler; mevcut kurulumları bozmaz) */
function migrateSeedMassagesAndTherapistSkills() {
  const newMassages = [
    ['Hamam Köpük & Kese', 'Geleneksel tellak ile kese ve köpük masajı; cilt yenilenmesi ve hafif rahatlama.', 30, 480],
    ['Hamam Sabunlama & Peeling', 'Özel sabun ve doğal peeling ile hamam ritüeli.', 45, 550],
    ['Refleksoloji (Ayak)', 'Ayak tabanı baskı noktalarına yönelik dengeleyici seans.', 45, 680],
    ['Thai Masajı', 'Yer minderinde esnetme ve baskı teknikleri; giysi üzerinden uygulanır.', 90, 1180],
    ['Spor Masajı', 'Kas toparlanması ve esneklik için yoğun tempo.', 60, 920],
    ['Baş–Boyun Rahatlatma', 'Migren ve gerginlik için odaklı kısa seans.', 30, 420],
    ['Lüks Spa Ritüeli', 'Peeling, masaj ve nemlendirme adımlarını birleştiren uzun ritüel.', 120, 1950],
    ['Bölgesel Sırt/Bel Masajı', 'Sırt veya bel bölgesine odaklı derin çalışma.', 30, 490],
    ['Bali / Sıcak Yağ Masajı', 'Sıcak bitkisel yağlarla uzun süreli akışkan masaj.', 75, 1020]
  ];
  let added = 0;
  for (const row of newMassages) {
    const [name, desc, dur, price] = row;
    const ex = query('SELECT id FROM massage_types WHERE name=?', [name]);
    if (!ex.length) {
      /* db.run + tek saveDb yerine run(): her INSERT diske yazılır (sql.js bellek senkronu) */
      run('INSERT INTO massage_types (name,description,duration_minutes,price) VALUES (?,?,?,?)', [name, desc, dur, price]);
      added += 1;
    }
  }

  function mid(name) {
    const r = query('SELECT id FROM massage_types WHERE name=?', [name]);
    return r[0]?.id;
  }
  const names = {
    isvec: 'İsveç Masajı',
    derin: 'Derin Doku Masajı',
    aroma: 'Aromaterapi Masajı',
    tas: 'Taş Masajı',
    kuplama: 'Kuplama Terapisi',
    hamamKopuk: 'Hamam Köpük & Kese',
    hamamSabun: 'Hamam Sabunlama & Peeling',
    refleks: 'Refleksoloji (Ayak)',
    thai: 'Thai Masajı',
    spor: 'Spor Masajı',
    basBoyun: 'Baş–Boyun Rahatlatma',
    luks: 'Lüks Spa Ritüeli',
    bolgesel: 'Bölgesel Sırt/Bel Masajı',
    bali: 'Bali / Sıcak Yağ Masajı'
  };
  const assignments = [
    [1, [names.isvec, names.derin, names.aroma, names.hamamKopuk, names.hamamSabun, names.basBoyun, names.bolgesel]],
    [2, [names.derin, names.tas, names.thai, names.spor, names.luks]],
    [3, [names.aroma, names.kuplama, names.refleks, names.bali]],
    [4, [names.derin, names.tas, names.kuplama, names.luks]],
    [5, [names.isvec, names.derin, names.kuplama, names.hamamKopuk, names.hamamSabun, names.spor, names.basBoyun, names.bolgesel]],
    [6, [names.isvec, names.kuplama, names.refleks, names.basBoyun]],
    [7, [names.aroma, names.tas, names.hamamKopuk, names.hamamSabun, names.thai, names.bali]]
  ];
  for (const [tid, mnames] of assignments) {
    for (const n of mnames) {
      const massageId = mid(n);
      if (!massageId) continue;
      try {
        run('INSERT OR IGNORE INTO therapist_massage_types (therapist_id,massage_type_id) VALUES (?,?)', [tid, massageId]);
      } catch (e) { /* ignore */ }
    }
  }
  const total = query('SELECT COUNT(*) as c FROM massage_types')[0]?.c;
  console.log(`[spa-booking] Masaj türü sayısı: ${total}${added ? ` (${added} yeni kayıt eklendi)` : ''}`);
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS massage_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration_minutes INTEGER NOT NULL,
      price REAL NOT NULL
    );
    CREATE TABLE IF NOT EXISTS therapists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      photo_url TEXT,
      is_active INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS therapist_massage_types (
      therapist_id INTEGER,
      massage_type_id INTEGER,
      PRIMARY KEY (therapist_id, massage_type_id)
    );
    CREATE TABLE IF NOT EXISTS work_schedule (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      therapist_id INTEGER,
      day_of_week INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      open_time TEXT DEFAULT '09:00',
      close_time TEXT DEFAULT '21:00'
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guest_name TEXT NOT NULL,
      therapist_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      massage_type_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT DEFAULT 'confirmed',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.run(`INSERT INTO rooms (name,open_time,close_time) VALUES
    ('Kabin 1','09:00','21:00'),('Kabin 2','09:00','21:00'),
    ('Kabin 3','09:00','21:00'),('Kabin 4','09:00','21:00'),
    ('Kabin 5','09:00','21:00'),('Kabin 6','09:00','21:00'),
    ('Kabin 7','09:00','21:00')`);

  db.run(`INSERT INTO massage_types (name,description,duration_minutes,price) VALUES
    ('İsveç Masajı','Klasik rahatlama masajı. Derin doku gerginliğini giderir.',60,850),
    ('Derin Doku Masajı','Kas katmanlarına yönelik yoğun baskı teknikleri.',75,1050),
    ('Aromaterapi Masajı','Uçucu yağlarla zenginleştirilmiş rahatlatıcı masaj.',60,950),
    ('Taş Masajı','Sıcak volkanik taşlarla yapılan geleneksel masaj.',90,1250),
    ('Kuplama Terapisi','Vakum kupalar ile derin doku desteği.',45,750),
    ('Hamam Köpük & Kese','Geleneksel tellak ile kese ve köpük masajı; cilt yenilenmesi ve hafif rahatlama.',30,480),
    ('Hamam Sabunlama & Peeling','Özel sabun ve doğal peeling ile hamam ritüeli.',45,550),
    ('Refleksoloji (Ayak)','Ayak tabanı baskı noktalarına yönelik dengeleyici seans.',45,680),
    ('Thai Masajı','Yer minderinde esnetme ve baskı teknikleri; giysi üzerinden uygulanır.',90,1180),
    ('Spor Masajı','Kas toparlanması ve esneklik için yoğun tempo.',60,920),
    ('Baş–Boyun Rahatlatma','Migren ve gerginlik için odaklı kısa seans.',30,420),
    ('Lüks Spa Ritüeli','Peeling, masaj ve nemlendirme adımlarını birleştiren uzun ritüel.',120,1950),
    ('Bölgesel Sırt/Bel Masajı','Sırt veya bel bölgesine odaklı derin çalışma.',30,490),
    ('Bali / Sıcak Yağ Masajı','Sıcak bitkisel yağlarla uzun süreli akışkan masaj.',75,1020)`);

  db.run(`INSERT INTO therapists (name) VALUES
    ('Ayşe Kaya'),('Mehmet Demir'),('Fatma Yıldız'),
    ('Ali Çelik'),('Zeynep Arslan'),('Hasan Şahin'),('Merve Doğan')`);

  /* t1: klasik + hamam; t2: derin/taş/thai/spor/lüks; t3: aroma/kupla/refleks/bali; t4: derin/taş/kupla/lüks;
     t5: geniş + hamam + spor; t6: hafif + refleks; t7: aroma/taş/hamam/thai/bali */
  db.run(`INSERT INTO therapist_massage_types (therapist_id,massage_type_id) VALUES
    (1,1),(1,2),(1,3),(1,6),(1,7),(1,11),(1,13),
    (2,2),(2,4),(2,9),(2,10),(2,12),
    (3,3),(3,5),(3,8),(3,14),
    (4,2),(4,4),(4,5),(4,12),
    (5,1),(5,2),(5,5),(5,6),(5,7),(5,10),(5,11),(5,13),
    (6,1),(6,5),(6,8),(6,11),
    (7,3),(7,4),(7,6),(7,7),(7,9),(7,14)`);

  for (let t = 1; t <= 7; t++) {
    for (let d = 0; d <= 6; d++) {
      db.run(`INSERT INTO work_schedule (therapist_id,day_of_week,start_time,end_time) VALUES (${t},${d},'09:00','21:00')`);
    }
  }
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

function getLastInsertId() {
  const r = query('SELECT last_insert_rowid() as id');
  return r[0]?.id;
}

module.exports = { getDb, query, run, saveDb, getLastInsertId };

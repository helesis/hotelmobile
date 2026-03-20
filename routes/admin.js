const express = require('express');
const router = express.Router();
const { query, run } = require('../db/database');

// ── MASSAGE TYPES ──────────────────────────────────────────

router.get('/massage-types', (req, res) => {
  res.json(query(`SELECT * FROM massage_types ORDER BY name`));
});

router.post('/massage-types', (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  if (!name || !duration_minutes || !price) return res.status(400).json({ error: 'Zorunlu alanlar eksik' });
  const result = run(`INSERT INTO massage_types (name, description, duration_minutes, price) VALUES (?, ?, ?, ?)`,
    [name, description || '', duration_minutes, price]);
  res.json({ id: result.lastInsertRowid, name, description, duration_minutes, price });
});

router.put('/massage-types/:id', (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  run(`UPDATE massage_types SET name=?, description=?, duration_minutes=?, price=? WHERE id=?`,
    [name, description, duration_minutes, price, req.params.id]);
  res.json({ success: true });
});

router.delete('/massage-types/:id', (req, res) => {
  run(`DELETE FROM massage_types WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ── THERAPISTS ─────────────────────────────────────────────

router.get('/therapists', (req, res) => {
  const therapists = query(`SELECT * FROM therapists ORDER BY name`);
  const result = therapists.map(t => {
    const massages = query(`
      SELECT mt.id, mt.name FROM massage_types mt
      JOIN therapist_massages tm ON tm.massage_type_id = mt.id
      WHERE tm.therapist_id = ?`, [t.id]);
    const schedule = query(`SELECT * FROM work_schedules WHERE therapist_id = ? ORDER BY day_of_week`, [t.id]);
    return { ...t, massages, schedule };
  });
  res.json(result);
});

router.post('/therapists', (req, res) => {
  const { name, photo, massage_type_ids, schedule } = req.body;
  if (!name) return res.status(400).json({ error: 'İsim gerekli' });
  const result = run(`INSERT INTO therapists (name, photo) VALUES (?, ?)`, [name, photo || '']);
  const tid = result.lastInsertRowid;
  if (massage_type_ids?.length) {
    for (const mid of massage_type_ids) {
      run(`INSERT OR IGNORE INTO therapist_massages VALUES (?, ?)`, [tid, mid]);
    }
  }
  if (schedule?.length) {
    for (const s of schedule) {
      run(`INSERT INTO work_schedules (therapist_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`,
        [tid, s.day_of_week, s.start_time, s.end_time]);
    }
  }
  res.json({ id: tid, name });
});

router.put('/therapists/:id', (req, res) => {
  const { name, photo, massage_type_ids, schedule } = req.body;
  run(`UPDATE therapists SET name=?, photo=? WHERE id=?`, [name, photo || '', req.params.id]);
  run(`DELETE FROM therapist_massages WHERE therapist_id = ?`, [req.params.id]);
  if (massage_type_ids?.length) {
    for (const mid of massage_type_ids) {
      run(`INSERT OR IGNORE INTO therapist_massages VALUES (?, ?)`, [req.params.id, mid]);
    }
  }
  run(`DELETE FROM work_schedules WHERE therapist_id = ?`, [req.params.id]);
  if (schedule?.length) {
    for (const s of schedule) {
      run(`INSERT INTO work_schedules (therapist_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?)`,
        [req.params.id, s.day_of_week, s.start_time, s.end_time]);
    }
  }
  res.json({ success: true });
});

router.delete('/therapists/:id', (req, res) => {
  run(`DELETE FROM therapists WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ── ROOMS ──────────────────────────────────────────────────

router.get('/rooms', (req, res) => {
  res.json(query(`SELECT * FROM rooms ORDER BY id`));
});

router.post('/rooms', (req, res) => {
  const { name, open_time, close_time } = req.body;
  const result = run(`INSERT INTO rooms (name, open_time, close_time) VALUES (?, ?, ?)`,
    [name, open_time || '09:00', close_time || '21:00']);
  res.json({ id: result.lastInsertRowid });
});

router.put('/rooms/:id', (req, res) => {
  const { name, open_time, close_time, is_active } = req.body;
  run(`UPDATE rooms SET name=?, open_time=?, close_time=?, is_active=? WHERE id=?`,
    [name, open_time, close_time, is_active ? 1 : 0, req.params.id]);
  res.json({ success: true });
});

router.delete('/rooms/:id', (req, res) => {
  run(`DELETE FROM rooms WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

// ── STATS ──────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const todayRes = query(`SELECT COUNT(*) as c FROM reservations WHERE date = ? AND status != 'cancelled'`, [today])[0]?.c || 0;
  const totalRes = query(`SELECT COUNT(*) as c FROM reservations WHERE status != 'cancelled'`)[0]?.c || 0;
  const therapistCount = query(`SELECT COUNT(*) as c FROM therapists`)[0]?.c || 0;
  const roomCount = query(`SELECT COUNT(*) as c FROM rooms WHERE is_active = 1`)[0]?.c || 0;
  res.json({ todayRes, totalRes, therapistCount, roomCount });
});

module.exports = router;

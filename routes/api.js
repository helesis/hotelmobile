const express = require('express');
const router = express.Router();
const { query, run, getLastInsertId } = require('../db/database');

function getAvailabilityDiscountConfig() {
  const rows = query('SELECT max_percent, step_percent FROM availability_discount_settings WHERE id=1');
  if (!rows.length) return { max_percent: 15, step_percent: 3 };
  let maxp = Number(rows[0].max_percent);
  let stepp = Number(rows[0].step_percent);
  if (!Number.isFinite(maxp)) maxp = 15;
  if (!Number.isFinite(stepp)) stepp = 3;
  maxp = Math.min(100, Math.max(0, maxp));
  stepp = Math.min(100, Math.max(0, stepp));
  return { max_percent: maxp, step_percent: stepp };
}

// ── Massage Types ────────────────────────────────────────────────────────────

router.get('/massage-types', (req, res) => {
  const rows = query('SELECT * FROM massage_types ORDER BY name');
  res.json(rows);
});

router.post('/massage-types', (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  if (!name || !duration_minutes || !price) return res.status(400).json({ error: 'Eksik alan' });
  run('INSERT INTO massage_types (name,description,duration_minutes,price) VALUES (?,?,?,?)',
    [name, description || '', duration_minutes, price]);
  const id = getLastInsertId();
  res.json({ id, name, description, duration_minutes, price });
});

router.put('/massage-types/:id', (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  run('UPDATE massage_types SET name=?,description=?,duration_minutes=?,price=? WHERE id=?',
    [name, description, duration_minutes, price, req.params.id]);
  res.json({ ok: true });
});

router.delete('/massage-types/:id', (req, res) => {
  run('DELETE FROM therapist_massage_types WHERE massage_type_id=?', [req.params.id]);
  run('DELETE FROM massage_types WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Therapists ───────────────────────────────────────────────────────────────

router.get('/therapists', (req, res) => {
  const therapists = query('SELECT * FROM therapists ORDER BY name');
  const massageTypes = query(`
    SELECT tmt.therapist_id, mt.id, mt.name
    FROM therapist_massage_types tmt
    JOIN massage_types mt ON mt.id = tmt.massage_type_id
  `);
  const schedules = query('SELECT * FROM work_schedule ORDER BY therapist_id, day_of_week');

  const result = therapists.map(t => ({
    ...t,
    massage_types: massageTypes.filter(m => m.therapist_id === t.id),
    schedule: schedules.filter(s => s.therapist_id === t.id)
  }));
  res.json(result);
});

router.post('/therapists', (req, res) => {
  const { name, photo_url, massage_type_ids, schedule } = req.body;
  if (!name) return res.status(400).json({ error: 'İsim zorunlu' });
  run('INSERT INTO therapists (name,photo_url) VALUES (?,?)', [name, photo_url || null]);
  const id = getLastInsertId();

  if (massage_type_ids?.length) {
    for (const mid of massage_type_ids) {
      run('INSERT OR IGNORE INTO therapist_massage_types VALUES (?,?)', [id, mid]);
    }
  }
  if (schedule?.length) {
    for (const s of schedule) {
      run('INSERT INTO work_schedule (therapist_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)',
        [id, s.day_of_week, s.start_time, s.end_time]);
    }
  }
  res.json({ id, name, photo_url });
});

router.put('/therapists/:id', (req, res) => {
  const { name, photo_url, is_active, massage_type_ids, schedule } = req.body;
  run('UPDATE therapists SET name=?,photo_url=?,is_active=? WHERE id=?',
    [name, photo_url || null, is_active ?? 1, req.params.id]);

  if (massage_type_ids !== undefined) {
    run('DELETE FROM therapist_massage_types WHERE therapist_id=?', [req.params.id]);
    for (const mid of massage_type_ids) {
      run('INSERT OR IGNORE INTO therapist_massage_types VALUES (?,?)', [req.params.id, mid]);
    }
  }
  if (schedule !== undefined) {
    run('DELETE FROM work_schedule WHERE therapist_id=?', [req.params.id]);
    for (const s of schedule) {
      run('INSERT INTO work_schedule (therapist_id,day_of_week,start_time,end_time) VALUES (?,?,?,?)',
        [req.params.id, s.day_of_week, s.start_time, s.end_time]);
    }
  }
  res.json({ ok: true });
});

router.delete('/therapists/:id', (req, res) => {
  run('DELETE FROM therapist_massage_types WHERE therapist_id=?', [req.params.id]);
  run('DELETE FROM work_schedule WHERE therapist_id=?', [req.params.id]);
  run('DELETE FROM therapists WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Rooms ────────────────────────────────────────────────────────────────────

router.get('/rooms', (req, res) => {
  res.json(query('SELECT * FROM rooms ORDER BY name'));
});

router.post('/rooms', (req, res) => {
  const { name, open_time, close_time } = req.body;
  run('INSERT INTO rooms (name,open_time,close_time) VALUES (?,?,?)',
    [name, open_time || '09:00', close_time || '21:00']);
  res.json({ id: getLastInsertId(), name, open_time, close_time });
});

router.put('/rooms/:id', (req, res) => {
  const { name, is_active, open_time, close_time } = req.body;
  run('UPDATE rooms SET name=?,is_active=?,open_time=?,close_time=? WHERE id=?',
    [name, is_active ?? 1, open_time, close_time, req.params.id]);
  res.json({ ok: true });
});

router.delete('/rooms/:id', (req, res) => {
  run('DELETE FROM rooms WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Time Slot Discounts ─────────────────────────────────────────────────────

router.get('/time-slot-discounts', (req, res) => {
  res.json(query('SELECT * FROM time_slot_discounts ORDER BY start_time'));
});

router.post('/time-slot-discounts', (req, res) => {
  const { label, start_time, end_time, discount_percent } = req.body;
  if (!start_time || !end_time || discount_percent == null)
    return res.status(400).json({ error: 'Başlangıç, bitiş saati ve indirim oranı zorunlu' });
  run('INSERT INTO time_slot_discounts (label,start_time,end_time,discount_percent) VALUES (?,?,?,?)',
    [label || '', start_time, end_time, discount_percent]);
  res.json({ id: getLastInsertId(), label, start_time, end_time, discount_percent });
});

router.put('/time-slot-discounts/:id', (req, res) => {
  const { label, start_time, end_time, discount_percent } = req.body;
  run('UPDATE time_slot_discounts SET label=?,start_time=?,end_time=?,discount_percent=? WHERE id=?',
    [label ?? '', start_time ?? '', end_time ?? '', discount_percent ?? 0, req.params.id]);
  res.json({ ok: true });
});

router.delete('/time-slot-discounts/:id', (req, res) => {
  run('DELETE FROM time_slot_discounts WHERE id=?', [req.params.id]);
  res.json({ ok: true });
});

// ── Müsaitlik indirimi (kaydırıcıdan yönetilir) ───────────────────────────────

router.get('/availability-discount-settings', (req, res) => {
  res.json(getAvailabilityDiscountConfig());
});

router.put('/availability-discount-settings', (req, res) => {
  let max_percent = Number(req.body.max_percent);
  let step_percent = Number(req.body.step_percent);
  if (!Number.isFinite(max_percent) || !Number.isFinite(step_percent))
    return res.status(400).json({ error: 'Geçerli sayısal değerler gerekli' });
  max_percent = Math.min(100, Math.max(0, max_percent));
  step_percent = Math.min(100, Math.max(0, step_percent));
  run('UPDATE availability_discount_settings SET max_percent=?, step_percent=? WHERE id=1', [max_percent, step_percent]);
  res.json({ max_percent, step_percent });
});

// ── Availability ─────────────────────────────────────────────────────────────

router.get('/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Tarih gerekli' });

  // Parse date parts to get day-of-week reliably (avoids timezone/UTC edge cases)
  const [y, mo, da] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, (mo || 1) - 1, da || 1).getDay(); // 0=Sun ... 6=Sat

  // Active rooms
  const rooms = query("SELECT * FROM rooms WHERE is_active=1");
  const totalRooms = rooms.length;
  if (totalRooms === 0) return res.json([]);

  // Room open/close (use first room's times as representative, all same)
  const openTime = rooms[0].open_time;   // e.g. "09:00"
  const closeTime = rooms[0].close_time; // e.g. "21:00"

  // Therapists working this day (may be empty — we still return all slots)
  const workingTherapists = query(`
    SELECT DISTINCT t.id, t.name, t.photo_url, ws.start_time, ws.end_time
    FROM therapists t
    JOIN work_schedule ws ON ws.therapist_id = t.id
    WHERE t.is_active=1 AND ws.day_of_week=?
  `, [dayOfWeek]);

  // All reservations for this date
  const existing = query(`
    SELECT r.*, mt.duration_minutes
    FROM reservations r
    JOIN massage_types mt ON mt.id = r.massage_type_id
    WHERE r.date=? AND r.status != 'cancelled'
  `, [date]);

  // Max massage duration - therapist must be free for entire period
  const maxDurationRow = query('SELECT MAX(duration_minutes) as max_dur FROM massage_types');
  const maxDuration = (maxDurationRow[0]?.max_dur || 60) || 60;
  const { max_percent: availMax, step_percent: availStep } = getAvailabilityDiscountConfig();

  // Generate 30-min slots
  const slots = [];
  const [openH, openM] = openTime.split(':').map(Number);
  const [closeH, closeM] = closeTime.split(':').map(Number);
  const openMins = openH * 60 + openM;
  const closeMins = closeH * 60 + closeM;

  for (let m = openMins; m < closeMins; m += 30) {
    const slotStart = `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;

    // Count rooms occupied at this slot start
    const occupiedRooms = existing.filter(r => {
      const [sh, sm] = r.start_time.split(':').map(Number);
      const [eh, em] = r.end_time.split(':').map(Number);
      const rStart = sh * 60 + sm;
      const rEnd = eh * 60 + em;
      return rStart <= m && m < rEnd;
    });

    const freeRooms = totalRooms - occupiedRooms.length;

    // Therapists who work at this slot (in work hours)
    const therapistsAtSlot = workingTherapists.filter(t => {
      const [wsh, wsm] = t.start_time.split(':').map(Number);
      const [weh, wem] = t.end_time.split(':').map(Number);
      return m >= wsh*60+wsm && m < weh*60+wem;
    });
    // Available = those not booked
    const availableTherapists = therapistsAtSlot.filter(t => {
      const slotEnd = m + maxDuration;
      const busy = existing.some(r => {
        if (r.therapist_id !== t.id) return false;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const rStart = sh * 60 + sm;
        const rEnd = eh * 60 + em;
        return rStart < slotEnd && rEnd > m;
      });
      return !busy;
    });

    const totalAtSlot = therapistsAtSlot.length;
    // soldCount = o slottaki dolu rezervasyon sayısı (her masaj = 1 oda)
    const soldCount = occupiedRooms.length;
    const availabilityDiscount = Math.max(0, availMax - soldCount * availStep);

    const available = freeRooms > 0 && availableTherapists.length > 0;
    let available_therapists = [];
    if (available) {
      available_therapists = availableTherapists.map(t => {
        const massages = query(`
          SELECT mt.* FROM massage_types mt
          JOIN therapist_massage_types tmt ON tmt.massage_type_id = mt.id
          WHERE tmt.therapist_id=?
        `, [t.id]);
        return { ...t, massage_types: massages };
      });
    }

    slots.push({
      time: slotStart,
      available,
      available_therapists,
      total_therapists_at_slot: totalAtSlot,
      availability_discount: availabilityDiscount
    });
  }

  res.json(slots);
});

// ── Reservations ─────────────────────────────────────────────────────────────

router.get('/reservations', (req, res) => {
  const { date } = req.query;
  const where = date ? `WHERE r.date='${date}'` : '';
  /* r.* içindeki price ile COALESCE(...) as price çakışınca sql.js tek alan döndürebilir; list_price kaybolabiliyor */
  const rows = query(`
    SELECT r.id, r.guest_name, r.therapist_id, r.room_id, r.massage_type_id,
           r.date, r.start_time, r.end_time, r.status, r.created_at,
           t.name as therapist_name, mt.name as massage_name, mt.duration_minutes,
           CAST(mt.price AS REAL) as list_price,
           CAST(COALESCE(r.price, mt.price) AS REAL) as price,
           rm.name as room_name
    FROM reservations r
    JOIN therapists t ON t.id=r.therapist_id
    JOIN massage_types mt ON mt.id=r.massage_type_id
    JOIN rooms rm ON rm.id=r.room_id
    ${where}
    ORDER BY r.date, r.start_time
  `);
  res.json(rows);
});

router.post('/reservations', (req, res) => {
  const { guest_name, therapist_id, massage_type_id, date, start_time } = req.body;
  if (!guest_name || !therapist_id || !massage_type_id || !date || !start_time)
    return res.status(400).json({ error: 'Eksik alan' });

  // Get massage duration
  const mt = query('SELECT * FROM massage_types WHERE id=?', [massage_type_id]);
  if (!mt.length) return res.status(400).json({ error: 'Masaj türü bulunamadı' });
  const duration = mt[0].duration_minutes;

  // Calculate end time
  const [sh, sm] = start_time.split(':').map(Number);
  const endMins = sh * 60 + sm + duration;
  const end_time = `${String(Math.floor(endMins/60)).padStart(2,'0')}:${String(endMins%60).padStart(2,'0')}`;

  // Check therapist not double booked
  const conflict = query(`
    SELECT id FROM reservations
    WHERE therapist_id=? AND date=? AND status!='cancelled'
    AND NOT (end_time <= ? OR start_time >= ?)
  `, [therapist_id, date, start_time, end_time]);
  if (conflict.length) return res.status(409).json({ error: 'Terapist bu saatte meşgul' });

  // Find a free room
  const rooms = query("SELECT id FROM rooms WHERE is_active=1");
  let room_id = null;
  for (const room of rooms) {
    const roomConflict = query(`
      SELECT id FROM reservations
      WHERE room_id=? AND date=? AND status!='cancelled'
      AND NOT (end_time <= ? OR start_time >= ?)
    `, [room.id, date, start_time, end_time]);
    if (!roomConflict.length) { room_id = room.id; break; }
  }
  if (!room_id) return res.status(409).json({ error: 'Boş kabin bulunamadı' });

  // Time-slot discount
  const basePrice = mt[0].price;
  const discounts = query('SELECT * FROM time_slot_discounts');
  const slotMins = sh * 60 + sm;
  let timeDiscount = 0;
  for (const d of discounts) {
    const [dsH, dsM] = (d.start_time || '00:00').split(':').map(Number);
    const [deH, deM] = (d.end_time || '23:59').split(':').map(Number);
    const dStart = dsH * 60 + dsM;
    const dEnd = deH * 60 + deM;
    if (slotMins >= dStart && slotMins < dEnd) timeDiscount = Math.max(timeDiscount, Number(d.discount_percent) || 0);
  }

  // Availability discount: max %15 when all free, −%3 per sold slot
  const [y, mo, da] = date.split('-').map(Number);
  const dayOfWeek = new Date(y, (mo || 1) - 1, da || 1).getDay();
  const maxDurationRow = query('SELECT MAX(duration_minutes) as max_dur FROM massage_types');
  const maxDuration = (maxDurationRow[0]?.max_dur || 60) || 60;
  const workingTherapists = query(`
    SELECT DISTINCT t.id, ws.start_time, ws.end_time
    FROM therapists t
    JOIN work_schedule ws ON ws.therapist_id = t.id
    WHERE t.is_active=1 AND ws.day_of_week=?
  `, [dayOfWeek]);
  const existingAtDate = query(`
    SELECT r.*, mt.duration_minutes
    FROM reservations r
    JOIN massage_types mt ON mt.id = r.massage_type_id
    WHERE r.date=? AND r.status != 'cancelled'
  `, [date]);
  // soldCount = o slottaki dolu rezervasyon/kabin sayısı (her masaj satıldıkça −%3)
  const occupiedAtSlot = existingAtDate.filter(r => {
    const [rsh, rsm] = r.start_time.split(':').map(Number);
    const [reh, rem] = r.end_time.split(':').map(Number);
    const rStart = rsh * 60 + rsm;
    const rEnd = reh * 60 + rem;
    return rStart <= slotMins && slotMins < rEnd;
  });
  const soldCount = occupiedAtSlot.length;
  const { max_percent: availMaxR, step_percent: availStepR } = getAvailabilityDiscountConfig();
  const availabilityDiscount = Math.max(0, availMaxR - soldCount * availStepR);

  const bestDiscount = Math.max(timeDiscount, availabilityDiscount);
  const price = Math.round(basePrice * (1 - bestDiscount / 100));

  run(`INSERT INTO reservations (guest_name,therapist_id,room_id,massage_type_id,date,start_time,end_time,price)
       VALUES (?,?,?,?,?,?,?,?)`,
    [guest_name, therapist_id, room_id, massage_type_id, date, start_time, end_time, price]);

  res.json({ id: getLastInsertId(), room_id, start_time, end_time, status: 'confirmed', price });
});

router.put('/reservations/:id/cancel', (req, res) => {
  run("UPDATE reservations SET status='cancelled' WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { query, run } = require('../db/database');

// GET available slots for a date
router.get('/availability', (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'Tarih gerekli' });

  const dateObj = new Date(date);
  const dayOfWeek = dateObj.getDay(); // 0=Sun, 6=Sat

  // Active rooms
  const rooms = query(`SELECT * FROM rooms WHERE is_active = 1`);
  const totalRooms = rooms.length;

  // Get room open/close (use first room as reference — all same)
  const roomOpen = rooms[0]?.open_time || '09:00';
  const roomClose = rooms[0]?.close_time || '21:00';

  // Available therapists for this day
  const therapists = query(`
    SELECT DISTINCT t.id, t.name, t.photo,
      ws.start_time, ws.end_time
    FROM therapists t
    JOIN work_schedules ws ON ws.therapist_id = t.id
    WHERE ws.day_of_week = ?
  `, [dayOfWeek]);

  // Existing reservations for this date
  const existingReservations = query(`
    SELECT r.*, mt.duration_minutes
    FROM reservations r
    JOIN massage_types mt ON mt.id = r.massage_type_id
    WHERE r.date = ? AND r.status != 'cancelled'
  `, [date]);

  // Generate 30-min slots
  const slots = [];
  const [openH, openM] = roomOpen.split(':').map(Number);
  const [closeH, closeM] = roomClose.split(':').map(Number);
  let current = openH * 60 + openM;
  const closeTotal = closeH * 60 + closeM;

  while (current < closeTotal - 30) {
    const slotTime = `${String(Math.floor(current / 60)).padStart(2, '0')}:${String(current % 60).padStart(2, '0')}`;

    // Count occupied rooms at this slot
    const occupiedRooms = existingReservations.filter(r => {
      const [sh, sm] = r.start_time.split(':').map(Number);
      const [eh, em] = r.end_time.split(':').map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;
      return startMin < current + 30 && endMin > current;
    });

    const freeRooms = totalRooms - occupiedRooms.length;

    // Find available therapists at this slot
    const availableTherapists = therapists.filter(t => {
      const [tsh, tsm] = t.start_time.split(':').map(Number);
      const [teh, tem] = t.end_time.split(':').map(Number);
      const tStart = tsh * 60 + tsm;
      const tEnd = teh * 60 + tem;
      if (current < tStart || current >= tEnd) return false;

      // Check if therapist is busy
      const busy = existingReservations.some(r => {
        if (r.therapist_id !== t.id) return false;
        const [sh, sm] = r.start_time.split(':').map(Number);
        const [eh, em] = r.end_time.split(':').map(Number);
        const startMin = sh * 60 + sm;
        const endMin = eh * 60 + em;
        return startMin < current + 30 && endMin > current;
      });
      return !busy;
    });

    if (freeRooms > 0 && availableTherapists.length > 0) {
      slots.push({
        time: slotTime,
        freeRooms,
        availableTherapists: availableTherapists.map(t => t.id)
      });
    }

    current += 30;
  }

  res.json({ slots, therapists });
});

// GET therapist details with massage types
router.get('/therapists/:id/massages', (req, res) => {
  const massages = query(`
    SELECT mt.* FROM massage_types mt
    JOIN therapist_massages tm ON tm.massage_type_id = mt.id
    WHERE tm.therapist_id = ?
  `, [req.params.id]);
  res.json(massages);
});

// POST create reservation
router.post('/', (req, res) => {
  const { date, time, therapist_id, massage_type_id, guest_name } = req.body;
  if (!date || !time || !therapist_id || !massage_type_id || !guest_name) {
    return res.status(400).json({ error: 'Tüm alanlar gerekli' });
  }

  const massage = query(`SELECT * FROM massage_types WHERE id = ?`, [massage_type_id])[0];
  if (!massage) return res.status(404).json({ error: 'Masaj türü bulunamadı' });

  const [sh, sm] = time.split(':').map(Number);
  const startMin = sh * 60 + sm;
  const endMin = startMin + massage.duration_minutes;
  const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;

  // Find a free room
  const rooms = query(`SELECT * FROM rooms WHERE is_active = 1`);
  const existingReservations = query(`
    SELECT r.*, mt.duration_minutes FROM reservations r
    JOIN massage_types mt ON mt.id = r.massage_type_id
    WHERE r.date = ? AND r.status != 'cancelled'
  `, [date]);

  const occupiedRoomIds = existingReservations
    .filter(r => {
      const [rsh, rsm] = r.start_time.split(':').map(Number);
      const [reh, rem] = r.end_time.split(':').map(Number);
      const rStart = rsh * 60 + rsm;
      const rEnd = reh * 60 + rem;
      return rStart < endMin && rEnd > startMin;
    })
    .map(r => r.room_id);

  const freeRoom = rooms.find(r => !occupiedRoomIds.includes(r.id));
  if (!freeRoom) return res.status(409).json({ error: 'Uygun kabin bulunamadı' });

  // Check therapist not double-booked
  const therapistBusy = existingReservations.some(r => {
    if (r.therapist_id !== parseInt(therapist_id)) return false;
    const [rsh, rsm] = r.start_time.split(':').map(Number);
    const [reh, rem] = r.end_time.split(':').map(Number);
    const rStart = rsh * 60 + rsm;
    const rEnd = reh * 60 + rem;
    return rStart < endMin && rEnd > startMin;
  });
  if (therapistBusy) return res.status(409).json({ error: 'Terapist bu saatte müsait değil' });

  const result = run(`
    INSERT INTO reservations (guest_name, therapist_id, massage_type_id, room_id, date, start_time, end_time)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [guest_name, therapist_id, massage_type_id, freeRoom.id, date, time, endTime]);

  res.json({ 
    success: true, 
    reservation_id: result.lastInsertRowid,
    room: freeRoom.name,
    end_time: endTime
  });
});

// GET all reservations (admin)
router.get('/', (req, res) => {
  const { date } = req.query;
  let sql = `
    SELECT r.*, t.name as therapist_name, mt.name as massage_name, mt.duration_minutes, mt.price, rm.name as room_name
    FROM reservations r
    JOIN therapists t ON t.id = r.therapist_id
    JOIN massage_types mt ON mt.id = r.massage_type_id
    JOIN rooms rm ON rm.id = r.room_id
  `;
  const params = [];
  if (date) { sql += ` WHERE r.date = ?`; params.push(date); }
  sql += ` ORDER BY r.date, r.start_time`;
  res.json(query(sql, params));
});

// DELETE reservation
router.delete('/:id', (req, res) => {
  run(`UPDATE reservations SET status = 'cancelled' WHERE id = ?`, [req.params.id]);
  res.json({ success: true });
});

module.exports = router;

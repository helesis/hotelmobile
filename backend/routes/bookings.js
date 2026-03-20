const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// GET /api/bookings/availability?date=YYYY-MM-DD
// Verilen gün için: boş kabin sayısı + müsait terapistler + yapabilecekleri masajlar
router.get('/availability', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date parametresi gerekli' });

  try {
    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0=Pazar

    // Toplam aktif kabin sayısı ve o gün açık olan kabinler
    const cabinResult = await pool.query(`
      SELECT c.id
      FROM cabins c
      JOIN cabin_schedules cs ON cs.cabin_id = c.id
      WHERE c.is_active = TRUE AND cs.day_of_week = $1
    `, [dayOfWeek]);

    const totalCabins = cabinResult.rows.length;
    if (totalCabins === 0) {
      return res.json({ date, slots: [] });
    }

    // O gün çalışan terapistler ve yapabilecekleri masajlar
    const therapistResult = await pool.query(`
      SELECT 
        t.id, t.name, t.photo_url, t.bio,
        ts.start_time, ts.end_time,
        json_agg(json_build_object(
          'id', mt.id,
          'name', mt.name,
          'duration_minutes', mt.duration_minutes,
          'price', mt.price,
          'description', mt.description
        )) AS massage_types
      FROM therapists t
      JOIN therapist_schedules ts ON ts.therapist_id = t.id
      JOIN therapist_massage_types tmt ON tmt.therapist_id = t.id
      JOIN massage_types mt ON mt.id = tmt.massage_type_id
      WHERE t.is_active = TRUE AND ts.day_of_week = $1 AND mt.is_active = TRUE
      GROUP BY t.id, t.name, t.photo_url, t.bio, ts.start_time, ts.end_time
    `, [dayOfWeek]);

    // O günkü mevcut rezervasyonlar
    const bookingsResult = await pool.query(`
      SELECT therapist_id, cabin_id, start_time, end_time
      FROM bookings
      WHERE booking_date = $1 AND status != 'cancelled'
    `, [date]);

    const existingBookings = bookingsResult.rows;

    // Her terapist için 30 dakikalık slotlar oluştur
    const slots = [];
    const slotDuration = 30; // dakika aralığı

    for (const therapist of therapistResult.rows) {
      const [sh, sm] = therapist.start_time.split(':').map(Number);
      const [eh, em] = therapist.end_time.split(':').map(Number);
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;

      for (let minute = startMinutes; minute < endMinutes; minute += slotDuration) {
        const slotStartH = Math.floor(minute / 60).toString().padStart(2, '0');
        const slotStartM = (minute % 60).toString().padStart(2, '0');
        const slotStart = `${slotStartH}:${slotStartM}`;

        // Her masaj türü için bu slotun uygun olup olmadığını kontrol et
        const availableMassages = therapist.massage_types.filter(mt => {
          const slotEndMinute = minute + mt.duration_minutes;
          if (slotEndMinute > endMinutes) return false; // Terapist mesai dışı

          const slotEndH = Math.floor(slotEndMinute / 60).toString().padStart(2, '0');
          const slotEndM = (slotEndMinute % 60).toString().padStart(2, '0');
          const slotEnd = `${slotEndH}:${slotEndM}`;

          // Terapist bu slot aralığında müsait mi?
          const therapistBusy = existingBookings.some(b =>
            b.therapist_id === therapist.id &&
            timesOverlap(slotStart, slotEnd, b.start_time.slice(0,5), b.end_time.slice(0,5))
          );
          if (therapistBusy) return false;

          // Bu slot aralığında kaç kabin dolu?
          const busyCabins = new Set(
            existingBookings
              .filter(b => timesOverlap(slotStart, slotEnd, b.start_time.slice(0,5), b.end_time.slice(0,5)))
              .map(b => b.cabin_id)
          ).size;

          return busyCabins < totalCabins;
        });

        if (availableMassages.length > 0) {
          const existingSlot = slots.find(s => s.time === slotStart);
          if (existingSlot) {
            existingSlot.therapists.push({
              id: therapist.id,
              name: therapist.name,
              photo_url: therapist.photo_url,
              bio: therapist.bio,
              available_massages: availableMassages
            });
          } else {
            slots.push({
              time: slotStart,
              therapists: [{
                id: therapist.id,
                name: therapist.name,
                photo_url: therapist.photo_url,
                bio: therapist.bio,
                available_massages: availableMassages
              }]
            });
          }
        }
      }
    }

    slots.sort((a, b) => a.time.localeCompare(b.time));
    res.json({ date, total_cabins: totalCabins, slots });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// POST /api/bookings - Rezervasyon oluştur
router.post('/', authMiddleware, async (req, res) => {
  const { therapist_id, massage_type_id, booking_date, start_time, notes } = req.body;

  if (!therapist_id || !massage_type_id || !booking_date || !start_time) {
    return res.status(400).json({ error: 'Eksik alan' });
  }

  try {
    // Masaj süresini al
    const massageResult = await pool.query('SELECT duration_minutes FROM massage_types WHERE id=$1', [massage_type_id]);
    if (!massageResult.rows.length) return res.status(404).json({ error: 'Masaj türü bulunamadı' });

    const duration = massageResult.rows[0].duration_minutes;
    const [sh, sm] = start_time.split(':').map(Number);
    const endMinute = sh * 60 + sm + duration;
    const end_time = `${Math.floor(endMinute/60).toString().padStart(2,'0')}:${(endMinute%60).toString().padStart(2,'0')}`;

    const dateObj = new Date(booking_date);
    const dayOfWeek = dateObj.getDay();

    // Kabin müsaitliğini kontrol et
    const cabinResult = await pool.query(`
      SELECT c.id FROM cabins c
      JOIN cabin_schedules cs ON cs.cabin_id = c.id
      WHERE c.is_active = TRUE AND cs.day_of_week = $1
    `, [dayOfWeek]);

    const totalCabins = cabinResult.rows.length;

    const existingBookings = await pool.query(`
      SELECT cabin_id FROM bookings
      WHERE booking_date=$1 AND status!='cancelled'
      AND (start_time < $3 AND end_time > $2)
    `, [booking_date, start_time, end_time]);

    const busyCabins = new Set(existingBookings.rows.map(r => r.cabin_id)).size;
    if (busyCabins >= totalCabins) {
      return res.status(409).json({ error: 'Bu saatte uygun kabin yok' });
    }

    // Terapist müsait mi?
    const therapistBusy = await pool.query(`
      SELECT id FROM bookings
      WHERE therapist_id=$1 AND booking_date=$2 AND status!='cancelled'
      AND (start_time < $4 AND end_time > $3)
    `, [therapist_id, booking_date, start_time, end_time]);

    if (therapistBusy.rows.length > 0) {
      return res.status(409).json({ error: 'Terapist bu saatte müsait değil' });
    }

    // Boş kabin bul
    const busyCabinIds = existingBookings.rows.map(r => r.cabin_id);
    const availableCabin = cabinResult.rows.find(c => !busyCabinIds.includes(c.id));

    const result = await pool.query(`
      INSERT INTO bookings (user_id, therapist_id, cabin_id, massage_type_id, booking_date, start_time, end_time, status, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'confirmed',$8)
      RETURNING *
    `, [req.user.id, therapist_id, availableCabin.id, massage_type_id, booking_date, start_time, end_time, notes || null]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/bookings/my - Kullanıcının kendi rezervasyonları
router.get('/my', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT b.*, 
        t.name AS therapist_name, t.photo_url AS therapist_photo,
        mt.name AS massage_name, mt.duration_minutes, mt.price,
        c.name AS cabin_name
      FROM bookings b
      LEFT JOIN therapists t ON t.id = b.therapist_id
      LEFT JOIN massage_types mt ON mt.id = b.massage_type_id
      LEFT JOIN cabins c ON c.id = b.cabin_id
      WHERE b.user_id = $1
      ORDER BY b.booking_date DESC, b.start_time DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// DELETE /api/bookings/:id - İptal et
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const check = await pool.query('SELECT * FROM bookings WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Rezervasyon bulunamadı' });

    const booking = check.rows[0];
    if (booking.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Yetki yok' });
    }

    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// GET /api/bookings/admin/all - Admin: tüm rezervasyonlar
router.get('/admin/all', adminMiddleware, async (req, res) => {
  try {
    const { date } = req.query;
    let query = `
      SELECT b.*, 
        u.name AS user_name, u.room_number,
        t.name AS therapist_name,
        mt.name AS massage_name, mt.duration_minutes, mt.price,
        c.name AS cabin_name
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN therapists t ON t.id = b.therapist_id
      LEFT JOIN massage_types mt ON mt.id = b.massage_type_id
      LEFT JOIN cabins c ON c.id = b.cabin_id
    `;
    const params = [];
    if (date) {
      query += ' WHERE b.booking_date = $1';
      params.push(date);
    }
    query += ' ORDER BY b.booking_date DESC, b.start_time ASC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

// Yardımcı: iki zaman aralığı çakışıyor mu?
function timesOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

module.exports = router;

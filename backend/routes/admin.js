const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { adminMiddleware } = require('../middleware/auth');

// Tüm admin route'ları admin yetkisi gerektirir
router.use(adminMiddleware);

// ==================== MASAJ TÜRLERİ ====================

router.get('/massage-types', async (req, res) => {
  const result = await pool.query('SELECT * FROM massage_types ORDER BY name');
  res.json(result.rows);
});

router.post('/massage-types', async (req, res) => {
  const { name, description, duration_minutes, price } = req.body;
  if (!name || !duration_minutes || !price) {
    return res.status(400).json({ error: 'Ad, süre ve ücret gerekli' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO massage_types (name, description, duration_minutes, price) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description || null, duration_minutes, price]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.put('/massage-types/:id', async (req, res) => {
  const { name, description, duration_minutes, price, is_active } = req.body;
  try {
    const result = await pool.query(
      'UPDATE massage_types SET name=$1, description=$2, duration_minutes=$3, price=$4, is_active=$5 WHERE id=$6 RETURNING *',
      [name, description, duration_minutes, price, is_active, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.delete('/massage-types/:id', async (req, res) => {
  await pool.query('UPDATE massage_types SET is_active=FALSE WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// ==================== TERAPİSTLER ====================

router.get('/therapists', async (req, res) => {
  try {
    const therapists = await pool.query(`
      SELECT t.*, 
        json_agg(json_build_object('id', mt.id, 'name', mt.name)) FILTER (WHERE mt.id IS NOT NULL) AS massage_types,
        json_agg(json_build_object('day', ts.day_of_week, 'start', ts.start_time, 'end', ts.end_time)) FILTER (WHERE ts.id IS NOT NULL) AS schedules
      FROM therapists t
      LEFT JOIN therapist_massage_types tmt ON tmt.therapist_id = t.id
      LEFT JOIN massage_types mt ON mt.id = tmt.massage_type_id AND mt.is_active = TRUE
      LEFT JOIN therapist_schedules ts ON ts.therapist_id = t.id
      GROUP BY t.id
      ORDER BY t.name
    `);
    res.json(therapists.rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/therapists', async (req, res) => {
  const { name, bio, photo_url, massage_type_ids, schedules } = req.body;
  if (!name) return res.status(400).json({ error: 'Ad gerekli' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const t = await client.query(
      'INSERT INTO therapists (name, bio, photo_url) VALUES ($1,$2,$3) RETURNING *',
      [name, bio || null, photo_url || null]
    );
    const therapist = t.rows[0];

    if (massage_type_ids?.length) {
      for (const mid of massage_type_ids) {
        await client.query(
          'INSERT INTO therapist_massage_types (therapist_id, massage_type_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
          [therapist.id, mid]
        );
      }
    }

    if (schedules?.length) {
      for (const s of schedules) {
        await client.query(
          'INSERT INTO therapist_schedules (therapist_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4)',
          [therapist.id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(therapist);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

router.put('/therapists/:id', async (req, res) => {
  const { name, bio, photo_url, is_active, massage_type_ids, schedules } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      'UPDATE therapists SET name=$1, bio=$2, photo_url=$3, is_active=$4 WHERE id=$5',
      [name, bio, photo_url, is_active, req.params.id]
    );

    if (massage_type_ids !== undefined) {
      await client.query('DELETE FROM therapist_massage_types WHERE therapist_id=$1', [req.params.id]);
      for (const mid of massage_type_ids) {
        await client.query(
          'INSERT INTO therapist_massage_types (therapist_id, massage_type_id) VALUES ($1,$2)',
          [req.params.id, mid]
        );
      }
    }

    if (schedules !== undefined) {
      await client.query('DELETE FROM therapist_schedules WHERE therapist_id=$1', [req.params.id]);
      for (const s of schedules) {
        await client.query(
          'INSERT INTO therapist_schedules (therapist_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4)',
          [req.params.id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

router.delete('/therapists/:id', async (req, res) => {
  await pool.query('UPDATE therapists SET is_active=FALSE WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

// ==================== KABİNLER ====================

router.get('/cabins', async (req, res) => {
  try {
    const cabins = await pool.query(`
      SELECT c.*,
        json_agg(json_build_object('day', cs.day_of_week, 'start', cs.start_time, 'end', cs.end_time)) 
          FILTER (WHERE cs.id IS NOT NULL) AS schedules
      FROM cabins c
      LEFT JOIN cabin_schedules cs ON cs.cabin_id = c.id
      GROUP BY c.id ORDER BY c.name
    `);
    res.json(cabins.rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

router.post('/cabins', async (req, res) => {
  const { name, schedules } = req.body;
  if (!name) return res.status(400).json({ error: 'Ad gerekli' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const c = await client.query('INSERT INTO cabins (name) VALUES ($1) RETURNING *', [name]);
    const cabin = c.rows[0];

    if (schedules?.length) {
      for (const s of schedules) {
        await client.query(
          'INSERT INTO cabin_schedules (cabin_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4)',
          [cabin.id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    await client.query('COMMIT');
    res.status(201).json(cabin);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

router.put('/cabins/:id', async (req, res) => {
  const { name, is_active, schedules } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE cabins SET name=$1, is_active=$2 WHERE id=$3', [name, is_active, req.params.id]);

    if (schedules !== undefined) {
      await client.query('DELETE FROM cabin_schedules WHERE cabin_id=$1', [req.params.id]);
      for (const s of schedules) {
        await client.query(
          'INSERT INTO cabin_schedules (cabin_id, day_of_week, start_time, end_time) VALUES ($1,$2,$3,$4)',
          [req.params.id, s.day_of_week, s.start_time, s.end_time]
        );
      }
    }

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Sunucu hatası' });
  } finally {
    client.release();
  }
});

// ==================== DASHBOARD ====================

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [todayBookings, weekBookings, totalTherapists, totalMassages] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM bookings WHERE booking_date=$1 AND status='confirmed'", [today]),
      pool.query("SELECT COUNT(*) FROM bookings WHERE booking_date >= $1 AND booking_date < $1::date + 7 AND status='confirmed'", [today]),
      pool.query("SELECT COUNT(*) FROM therapists WHERE is_active=TRUE"),
      pool.query("SELECT COUNT(*) FROM massage_types WHERE is_active=TRUE"),
    ]);

    const recentBookings = await pool.query(`
      SELECT b.booking_date, b.start_time, b.end_time, b.status,
        u.name AS user_name, u.room_number,
        t.name AS therapist_name,
        mt.name AS massage_name, mt.price
      FROM bookings b
      LEFT JOIN users u ON u.id = b.user_id
      LEFT JOIN therapists t ON t.id = b.therapist_id
      LEFT JOIN massage_types mt ON mt.id = b.massage_type_id
      ORDER BY b.created_at DESC LIMIT 10
    `);

    res.json({
      stats: {
        today_bookings: parseInt(todayBookings.rows[0].count),
        week_bookings: parseInt(weekBookings.rows[0].count),
        total_therapists: parseInt(totalTherapists.rows[0].count),
        total_massages: parseInt(totalMassages.rows[0].count),
      },
      recent_bookings: recentBookings.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
});

module.exports = router;

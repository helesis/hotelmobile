process.env.TZ = 'Europe/Istanbul';
const express = require('express');
const cors = require('cors');
const path = require('path');
const { getDb } = require('./db/database');

const app = express();
app.use(cors());
// Terapist fotoğrafı base64 (data URL) gövdesi için
app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));

getDb().then(() => {
  const apiRouter = require('./routes/api');
  app.use('/api', apiRouter);
  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  const PORT = process.env.PORT || 3500;
  app.listen(PORT, () => console.log(`Spa Booking running on http://localhost:${PORT}`));
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });

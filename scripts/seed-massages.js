#!/usr/bin/env node
/**
 * Eksik masaj türlerini ve terapist eşlemelerini spa.db'ye uygular.
 * Sunucu kapalıyken veya açıkken çalıştırılabilir (sunucu açıksa yeniden başlatın).
 *
 * Kullanım (proje kökünden): npm run seed-massages
 */
const path = require('path');
const root = path.join(__dirname, '..');
process.chdir(root);

const { getDb, query } = require(path.join(root, 'db', 'database'));

getDb()
  .then(() => {
    const n = query('SELECT COUNT(*) as c FROM massage_types')[0]?.c;
    const names = query('SELECT name FROM massage_types ORDER BY name').map((r) => r.name);
    console.log('Tamam. Toplam masaj türü:', n);
    console.log(names.join(', '));
    process.exit(0);
  })
  .catch((e) => {
    console.error('Hata:', e.message || e);
    process.exit(1);
  });

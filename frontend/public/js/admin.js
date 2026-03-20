// ================================================
// Admin Module
// ================================================

let adminSection = 'dashboard';
let allMassageTypes = [];
let allTherapists = [];

function renderAdminPage() {
  return `
    <div class="page">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-sidebar-title">Yönetim Paneli</div>
          ${[
            { id: 'dashboard', icon: '◈', label: 'Dashboard' },
            { id: 'bookings', icon: '📅', label: 'Rezervasyonlar' },
            { id: 'therapists', icon: '👤', label: 'Terapistler' },
            { id: 'massage-types', icon: '✦', label: 'Masaj Türleri' },
            { id: 'cabins', icon: '🚪', label: 'Kabinler' },
          ].map(item => `
            <div class="admin-nav-item ${adminSection === item.id ? 'active' : ''}" data-section="${item.id}">
              <span class="icon">${item.icon}</span> ${item.label}
            </div>
          `).join('')}
        </aside>
        <main class="admin-content" id="admin-main">
          <div class="loading"><div class="spinner"></div>Yükleniyor...</div>
        </main>
      </div>
    </div>
  `;
}

function bindAdminNavEvents() {
  document.querySelectorAll('.admin-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      adminSection = item.dataset.section;
      document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      loadAdminSection(adminSection);
    });
  });
}

async function loadAdminSection(section) {
  const main = document.getElementById('admin-main');
  if (!main) return;
  main.innerHTML = '<div class="loading"><div class="spinner"></div>Yükleniyor...</div>';

  try {
    switch (section) {
      case 'dashboard': await renderDashboard(main); break;
      case 'bookings': await renderAdminBookings(main); break;
      case 'therapists': await renderTherapistsAdmin(main); break;
      case 'massage-types': await renderMassageTypesAdmin(main); break;
      case 'cabins': await renderCabinsAdmin(main); break;
    }
  } catch (err) {
    main.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

// ==================== DASHBOARD ====================
async function renderDashboard(main) {
  const data = await API.getDashboard();
  const s = data.stats;

  main.innerHTML = `
    <div class="admin-section-title">Dashboard</div>
    <div class="admin-section-sub">Genel bakış ve son aktivite</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Bugünkü Rezervasyon</div>
        <div class="stat-value">${s.today_bookings}</div>
        <div class="stat-desc">Bugün onaylanan seans</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Bu Hafta</div>
        <div class="stat-value">${s.week_bookings}</div>
        <div class="stat-desc">7 günlük rezervasyon</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Aktif Terapist</div>
        <div class="stat-value">${s.total_therapists}</div>
        <div class="stat-desc">Çalışan personel</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Masaj Türü</div>
        <div class="stat-value">${s.total_massages}</div>
        <div class="stat-desc">Aktif hizmet</div>
      </div>
    </div>
    <div class="admin-section-title" style="font-size:1.2rem;margin-bottom:16px">Son Rezervasyonlar</div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Misafir</th><th>Oda</th><th>Masaj</th><th>Terapist</th><th>Tarih</th><th>Saat</th><th>Ücret</th><th>Durum</th>
        </tr></thead>
        <tbody>
          ${data.recent_bookings.map(b => `
            <tr>
              <td>${b.user_name || '—'}</td>
              <td>${b.room_number || '—'}</td>
              <td>${b.massage_name || '—'}</td>
              <td>${b.therapist_name || '—'}</td>
              <td>${formatDate(b.booking_date)}</td>
              <td>${b.start_time?.slice(0,5)}</td>
              <td>${formatPrice(b.price)}</td>
              <td><span class="status-badge status-${b.status}">${b.status === 'confirmed' ? 'Onaylandı' : b.status === 'cancelled' ? 'İptal' : 'Tamamlandı'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ==================== BOOKINGS ====================
async function renderAdminBookings(main) {
  const today = new Date().toISOString().split('T')[0];
  main.innerHTML = `
    <div class="admin-header-bar">
      <div>
        <div class="admin-section-title">Rezervasyonlar</div>
        <div class="admin-section-sub">Tüm seans kayıtları</div>
      </div>
      <div style="display:flex;gap:10px;align-items:center">
        <input type="date" class="form-input" id="booking-date-filter" value="${today}" style="width:auto">
        <button class="btn btn-outline btn-sm" id="clear-date-filter">Tümü</button>
      </div>
    </div>
    <div id="admin-bookings-table"><div class="loading"><div class="spinner"></div></div></div>
  `;

  async function loadBookings(date) {
    const tableEl = document.getElementById('admin-bookings-table');
    try {
      const bookings = await API.getAdminBookings(date);
      if (!bookings.length) {
        tableEl.innerHTML = `<div class="empty-state"><p>Rezervasyon bulunamadı</p></div>`;
        return;
      }
      tableEl.innerHTML = `
        <div class="data-table-wrap">
          <table class="data-table">
            <thead><tr>
              <th>Misafir</th><th>Oda</th><th>Masaj</th><th>Terapist</th><th>Kabin</th><th>Tarih</th><th>Saat</th><th>Ücret</th><th>Durum</th>
            </tr></thead>
            <tbody>
              ${bookings.map(b => `
                <tr>
                  <td>${b.user_name || '—'}</td>
                  <td>${b.room_number || '—'}</td>
                  <td>${b.massage_name}</td>
                  <td>${b.therapist_name}</td>
                  <td>${b.cabin_name || '—'}</td>
                  <td>${formatDate(b.booking_date)}</td>
                  <td>${b.start_time?.slice(0,5)} – ${b.end_time?.slice(0,5)}</td>
                  <td>${formatPrice(b.price)}</td>
                  <td><span class="status-badge status-${b.status}">${b.status === 'confirmed' ? 'Onaylandı' : b.status === 'cancelled' ? 'İptal' : 'Tamamlandı'}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (err) {
      tableEl.innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
    }
  }

  loadBookings(today);

  document.getElementById('booking-date-filter').addEventListener('change', e => loadBookings(e.target.value));
  document.getElementById('clear-date-filter').addEventListener('click', () => {
    document.getElementById('booking-date-filter').value = '';
    loadBookings(null);
  });
}

// ==================== MASSAGE TYPES ====================
async function renderMassageTypesAdmin(main) {
  allMassageTypes = await API.getMassageTypes();

  main.innerHTML = `
    <div class="admin-header-bar">
      <div>
        <div class="admin-section-title">Masaj Türleri</div>
        <div class="admin-section-sub">${allMassageTypes.length} hizmet tanımlı</div>
      </div>
      <button class="btn btn-gold btn-sm" id="add-massage-btn">+ Yeni Ekle</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Ad</th><th>Süre</th><th>Ücret</th><th>Durum</th><th>İşlem</th>
        </tr></thead>
        <tbody>
          ${allMassageTypes.map(m => `
            <tr>
              <td>
                <div style="font-weight:500">${m.name}</div>
                <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px">${m.description?.slice(0,60) || ''}${m.description?.length > 60 ? '...' : ''}</div>
              </td>
              <td>${m.duration_minutes} dk</td>
              <td>${formatPrice(m.price)}</td>
              <td><span class="status-badge ${m.is_active ? 'status-confirmed' : 'status-cancelled'}">${m.is_active ? 'Aktif' : 'Pasif'}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm edit-massage-btn" data-id="${m.id}">Düzenle</button>
                <button class="btn btn-danger btn-sm delete-massage-btn" data-id="${m.id}">${m.is_active ? 'Devre Dışı' : 'Aktif Et'}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${renderMassageModal()}
  `;

  document.getElementById('add-massage-btn').addEventListener('click', () => openMassageModal());
  document.querySelectorAll('.edit-massage-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = allMassageTypes.find(x => x.id === btn.dataset.id);
      if (m) openMassageModal(m);
    });
  });
  document.querySelectorAll('.delete-massage-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const m = allMassageTypes.find(x => x.id === btn.dataset.id);
      if (!m) return;
      if (!confirm(`"${m.name}" masajını ${m.is_active ? 'devre dışı' : 'aktif'} etmek istiyor musunuz?`)) return;
      try {
        await API.updateMassageType(m.id, { ...m, is_active: !m.is_active });
        showToast('Güncellendi');
        renderMassageTypesAdmin(main);
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
  bindMassageModalEvents(main);
}

function renderMassageModal(m = null) {
  return `
    <div class="modal-overlay" id="massage-modal">
      <div class="modal">
        <div class="modal-title">${m ? 'Masaj Türü Düzenle' : 'Yeni Masaj Türü'}</div>
        <div class="modal-sub">Hizmet bilgilerini girin</div>
        <div class="form-group">
          <label class="form-label">Ad</label>
          <input type="text" class="form-input" id="mt-name" value="${m?.name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Açıklama</label>
          <textarea class="form-textarea" id="mt-desc">${m?.description || ''}</textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Süre (dakika)</label>
            <input type="number" class="form-input" id="mt-duration" value="${m?.duration_minutes || 60}" min="15" step="15">
          </div>
          <div class="form-group">
            <label class="form-label">Ücret (₺)</label>
            <input type="number" class="form-input" id="mt-price" value="${m?.price || ''}" min="0">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="massage-modal-cancel">Vazgeç</button>
          <button class="btn btn-gold" id="massage-modal-save" data-id="${m?.id || ''}">Kaydet</button>
        </div>
      </div>
    </div>
  `;
}

function openMassageModal(m = null) {
  const modal = document.getElementById('massage-modal');
  if (!modal) return;
  if (m) {
    document.getElementById('mt-name').value = m.name;
    document.getElementById('mt-desc').value = m.description || '';
    document.getElementById('mt-duration').value = m.duration_minutes;
    document.getElementById('mt-price').value = m.price;
    document.getElementById('massage-modal-save').dataset.id = m.id;
  } else {
    document.getElementById('massage-modal-save').dataset.id = '';
  }
  modal.classList.add('open');
}

function bindMassageModalEvents(main) {
  document.getElementById('massage-modal-cancel')?.addEventListener('click', () => {
    document.getElementById('massage-modal').classList.remove('open');
  });
  document.getElementById('massage-modal-save')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const body = {
      name: document.getElementById('mt-name').value.trim(),
      description: document.getElementById('mt-desc').value.trim(),
      duration_minutes: parseInt(document.getElementById('mt-duration').value),
      price: parseFloat(document.getElementById('mt-price').value),
      is_active: true
    };
    if (!body.name || !body.duration_minutes || !body.price) { showToast('Ad, süre ve ücret gerekli', 'error'); return; }
    try {
      if (id) { await API.updateMassageType(id, body); } else { await API.createMassageType(body); }
      showToast(id ? 'Güncellendi' : 'Eklendi');
      document.getElementById('massage-modal').classList.remove('open');
      renderMassageTypesAdmin(main);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ==================== TERAPİSTLER ====================
async function renderTherapistsAdmin(main) {
  [allTherapists, allMassageTypes] = await Promise.all([API.getTherapists(), API.getMassageTypes()]);

  main.innerHTML = `
    <div class="admin-header-bar">
      <div>
        <div class="admin-section-title">Terapistler</div>
        <div class="admin-section-sub">${allTherapists.filter(t=>t.is_active).length} aktif personel</div>
      </div>
      <button class="btn btn-gold btn-sm" id="add-therapist-btn">+ Yeni Ekle</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr>
          <th>Terapist</th><th>Uzmanlık Alanları</th><th>Çalışma Günleri</th><th>Durum</th><th>İşlem</th>
        </tr></thead>
        <tbody>
          ${allTherapists.map(t => `
            <tr>
              <td>
                <div style="display:flex;align-items:center;gap:10px">
                  <div class="therapist-avatar" style="width:36px;height:36px;font-size:0.8rem">
                    ${t.photo_url ? `<img src="${t.photo_url}" alt="${t.name}">` : initials(t.name)}
                  </div>
                  <div>
                    <div style="font-weight:500">${t.name}</div>
                    ${t.bio ? `<div style="font-size:0.7rem;color:var(--text-muted)">${t.bio.slice(0,50)}...</div>` : ''}
                  </div>
                </div>
              </td>
              <td>
                <div class="tag-list">
                  ${(t.massage_types || []).filter(Boolean).map(m => `<span class="tag">${m.name}</span>`).join('') || '<span class="muted" style="font-size:0.75rem">—</span>'}
                </div>
              </td>
              <td>
                <div style="font-size:0.75rem;color:var(--text-secondary)">
                  ${(t.schedules || []).filter(Boolean).map(s => DAYS_SHORT[s.day]).join(', ') || '—'}
                </div>
              </td>
              <td><span class="status-badge ${t.is_active ? 'status-confirmed' : 'status-cancelled'}">${t.is_active ? 'Aktif' : 'Pasif'}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm edit-therapist-btn" data-id="${t.id}">Düzenle</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${renderTherapistModal()}
  `;

  document.getElementById('add-therapist-btn').addEventListener('click', () => populateAndOpenTherapistModal());
  document.querySelectorAll('.edit-therapist-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = allTherapists.find(x => x.id === btn.dataset.id);
      if (t) populateAndOpenTherapistModal(t);
    });
  });
  bindTherapistModalEvents(main);
}

function renderTherapistModal() {
  const dayNames = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];
  return `
    <div class="modal-overlay" id="therapist-modal">
      <div class="modal">
        <div class="modal-title" id="therapist-modal-title">Yeni Terapist</div>
        <div class="modal-sub">Terapist bilgilerini girin</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Ad Soyad</label>
            <input type="text" class="form-input" id="th-name">
          </div>
          <div class="form-group">
            <label class="form-label">Fotoğraf URL</label>
            <input type="url" class="form-input" id="th-photo" placeholder="https://...">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Biyografi</label>
          <textarea class="form-textarea" id="th-bio" placeholder="Kısa açıklama..."></textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Masaj Uzmanlıkları <span class="muted" style="font-size:0.75rem;font-weight:400">(tıklayarak seçin)</span></label>
          <div class="schedule-grid massage-skill-grid" id="th-massages"></div>
        </div>
        <div class="form-group">
          <label class="form-label">Çalışma Günleri</label>
          <div class="schedule-grid" id="th-days">
            ${dayNames.map((d,i) => `
              <div class="schedule-day" data-day="${i}">
                <div class="day-abbr">${DAYS_SHORT[i]}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="form-row" id="th-time-row">
          <div class="form-group">
            <label class="form-label">Başlangıç</label>
            <input type="time" class="form-input" id="th-start" value="09:00">
          </div>
          <div class="form-group">
            <label class="form-label">Bitiş</label>
            <input type="time" class="form-input" id="th-end" value="19:00">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="therapist-modal-cancel">Vazgeç</button>
          <button class="btn btn-gold" id="therapist-modal-save" data-id="">Kaydet</button>
        </div>
      </div>
    </div>
  `;
}

function populateAndOpenTherapistModal(t = null) {
  document.getElementById('therapist-modal-title').textContent = t ? 'Terapist Düzenle' : 'Yeni Terapist';
  document.getElementById('th-name').value = t?.name || '';
  document.getElementById('th-photo').value = t?.photo_url || '';
  document.getElementById('th-bio').value = t?.bio || '';
  document.getElementById('therapist-modal-save').dataset.id = t?.id || '';

  // Masajlar — çalışma günleri gibi kutucuklara tıklayarak seçim
  const massageWrap = document.getElementById('th-massages');
  const selectedMassageIds = new Set(
    (t?.massage_types || []).filter(Boolean).map(m => String(m.id))
  );
  const escAttr = (s) => String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const escText = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  massageWrap.innerHTML = allMassageTypes.filter(m => m.is_active !== false).map(m => {
    const on = selectedMassageIds.has(String(m.id));
    return `
    <div class="schedule-day massage-skill-cell ${on ? 'active' : ''}" data-id="${m.id}" title="${escAttr(m.name)}">
      <div class="massage-skill-name">${escText(m.name)}</div>
    </div>`;
  }).join('');
  massageWrap.querySelectorAll('.massage-skill-cell').forEach(cell => {
    cell.onclick = () => cell.classList.toggle('active');
  });

  // Günler
  const selectedDays = new Set((t?.schedules || []).filter(Boolean).map(s => s.day));
  document.querySelectorAll('#th-days .schedule-day').forEach(day => {
    day.classList.toggle('active', selectedDays.has(parseInt(day.dataset.day, 10)));
    day.onclick = () => day.classList.toggle('active');
  });

  document.getElementById('therapist-modal').classList.add('open');
}

function bindTherapistModalEvents(main) {
  document.getElementById('therapist-modal-cancel')?.addEventListener('click', () => {
    document.getElementById('therapist-modal').classList.remove('open');
  });
  document.getElementById('therapist-modal-save')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const massage_type_ids = [...document.querySelectorAll('#th-massages .massage-skill-cell.active')].map(i => i.dataset.id);
    const activeDays = [...document.querySelectorAll('#th-days .schedule-day.active')].map(d => parseInt(d.dataset.day));
    const start = document.getElementById('th-start').value;
    const end = document.getElementById('th-end').value;
    const schedules = activeDays.map(day => ({ day_of_week: day, start_time: start, end_time: end }));

    const body = {
      name: document.getElementById('th-name').value.trim(),
      bio: document.getElementById('th-bio').value.trim(),
      photo_url: document.getElementById('th-photo').value.trim() || null,
      is_active: true,
      massage_type_ids,
      schedules
    };
    if (!body.name) { showToast('Ad gerekli', 'error'); return; }

    try {
      if (id) { await API.updateTherapist(id, body); } else { await API.createTherapist(body); }
      showToast(id ? 'Terapist güncellendi' : 'Terapist eklendi');
      document.getElementById('therapist-modal').classList.remove('open');
      renderTherapistsAdmin(main);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ==================== KABİNLER ====================
async function renderCabinsAdmin(main) {
  const cabins = await API.getCabins();

  main.innerHTML = `
    <div class="admin-header-bar">
      <div>
        <div class="admin-section-title">Kabinler</div>
        <div class="admin-section-sub">${cabins.filter(c=>c.is_active).length} aktif kabin</div>
      </div>
      <button class="btn btn-gold btn-sm" id="add-cabin-btn">+ Yeni Ekle</button>
    </div>
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Ad</th><th>Çalışma Günleri</th><th>Çalışma Saatleri</th><th>Durum</th><th>İşlem</th></tr></thead>
        <tbody>
          ${cabins.map(c => `
            <tr>
              <td style="font-weight:500">${c.name}</td>
              <td style="font-size:0.75rem;color:var(--text-secondary)">
                ${(c.schedules||[]).filter(Boolean).map(s=>DAYS_SHORT[s.day]).join(', ')||'—'}
              </td>
              <td style="font-size:0.75rem;color:var(--text-secondary)">
                ${(c.schedules||[]).filter(Boolean).length ? `${c.schedules.filter(Boolean)[0]?.start?.slice(0,5)} – ${c.schedules.filter(Boolean)[0]?.end?.slice(0,5)}` : '—'}
              </td>
              <td><span class="status-badge ${c.is_active?'status-confirmed':'status-cancelled'}">${c.is_active?'Aktif':'Pasif'}</span></td>
              <td>
                <button class="btn btn-ghost btn-sm edit-cabin-btn" data-cabin='${JSON.stringify(c)}'>Düzenle</button>
                <button class="btn btn-danger btn-sm toggle-cabin-btn" data-id="${c.id}" data-active="${c.is_active}">${c.is_active?'Kapat':'Aç'}</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    ${renderCabinModal()}
  `;

  document.getElementById('add-cabin-btn').addEventListener('click', () => openCabinModal());
  document.querySelectorAll('.edit-cabin-btn').forEach(btn => {
    btn.addEventListener('click', () => openCabinModal(JSON.parse(btn.dataset.cabin)));
  });
  document.querySelectorAll('.toggle-cabin-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isActive = btn.dataset.active === 'true';
      await API.updateCabin(btn.dataset.id, { is_active: !isActive });
      showToast('Kabin güncellendi');
      renderCabinsAdmin(main);
    });
  });
  bindCabinModalEvents(main);
}

function renderCabinModal() {
  return `
    <div class="modal-overlay" id="cabin-modal">
      <div class="modal">
        <div class="modal-title" id="cabin-modal-title">Yeni Kabin</div>
        <div class="modal-sub">Kabin bilgilerini girin</div>
        <div class="form-group">
          <label class="form-label">Kabin Adı</label>
          <input type="text" class="form-input" id="cab-name" placeholder="Kabin 1">
        </div>
        <div class="form-group">
          <label class="form-label">Açık Günler</label>
          <div class="schedule-grid" id="cab-days">
            ${DAYS_SHORT.map((d,i) => `<div class="schedule-day active" data-day="${i}"><div class="day-abbr">${d}</div></div>`).join('')}
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Açılış</label>
            <input type="time" class="form-input" id="cab-start" value="09:00">
          </div>
          <div class="form-group">
            <label class="form-label">Kapanış</label>
            <input type="time" class="form-input" id="cab-end" value="20:00">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" id="cabin-modal-cancel">Vazgeç</button>
          <button class="btn btn-gold" id="cabin-modal-save" data-id="">Kaydet</button>
        </div>
      </div>
    </div>
  `;
}

function openCabinModal(c = null) {
  document.getElementById('cabin-modal-title').textContent = c ? 'Kabin Düzenle' : 'Yeni Kabin';
  document.getElementById('cab-name').value = c?.name || '';
  document.getElementById('cabin-modal-save').dataset.id = c?.id || '';

  const activeDays = new Set((c?.schedules || []).filter(Boolean).map(s => s.day));
  document.querySelectorAll('#cab-days .schedule-day').forEach(day => {
    const d = parseInt(day.dataset.day);
    day.classList.toggle('active', c ? activeDays.has(d) : true);
    day.onclick = () => day.classList.toggle('active');
  });

  if (c?.schedules?.length) {
    const s = c.schedules.filter(Boolean)[0];
    if (s) {
      document.getElementById('cab-start').value = s.start?.slice(0,5) || '09:00';
      document.getElementById('cab-end').value = s.end?.slice(0,5) || '20:00';
    }
  }
  document.getElementById('cabin-modal').classList.add('open');
}

function bindCabinModalEvents(main) {
  document.getElementById('cabin-modal-cancel')?.addEventListener('click', () => {
    document.getElementById('cabin-modal').classList.remove('open');
  });
  document.getElementById('cabin-modal-save')?.addEventListener('click', async (e) => {
    const id = e.target.dataset.id;
    const name = document.getElementById('cab-name').value.trim();
    const start = document.getElementById('cab-start').value;
    const end = document.getElementById('cab-end').value;
    const activeDays = [...document.querySelectorAll('#cab-days .schedule-day.active')].map(d => parseInt(d.dataset.day));
    const schedules = activeDays.map(day => ({ day_of_week: day, start_time: start, end_time: end }));

    if (!name) { showToast('Ad gerekli', 'error'); return; }
    try {
      if (id) { await API.updateCabin(id, { name, is_active: true, schedules }); }
      else { await API.createCabin({ name, schedules }); }
      showToast(id ? 'Kabin güncellendi' : 'Kabin eklendi');
      document.getElementById('cabin-modal').classList.remove('open');
      renderCabinsAdmin(main);
    } catch (err) { showToast(err.message, 'error'); }
  });
}

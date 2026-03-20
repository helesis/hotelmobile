// ================================================
// Booking Module
// ================================================

let bookingState = {
  selectedDate: null,
  availabilityCache: {},
  selectedSlotTime: null,
  selectedTherapist: null,
  selectedMassage: null,
  panelOpen: false,
};

function renderBookingPage() {
  const days = next7Days();
  bookingState.selectedDate = bookingState.selectedDate || days[0];

  return `
    <div class="page">
      <div class="booking-hero">
        <div class="container">
          <h1>Spa Rezervasyonu</h1>
          <p>Önümüzdeki 7 gün için uygun seans ve terapistinizi seçin</p>
        </div>
      </div>
      <div class="booking-layout container" style="padding-left:24px;padding-right:24px;margin-top:0;max-width:100%">
        <aside class="date-sidebar">
          <div class="sidebar-title">Tarih Seçin</div>
          <div id="date-list">
            ${days.map(d => renderDateItem(d)).join('')}
          </div>
        </aside>
        <div class="slots-panel" id="slots-panel">
          <div class="loading"><div class="spinner"></div>Yükleniyor...</div>
        </div>
      </div>
    </div>
    ${renderBookingPanel()}
  `;
}

function renderDateItem(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const isSelected = dateStr === bookingState.selectedDate;
  return `
    <div class="date-item ${isSelected ? 'active' : ''}" data-date="${dateStr}">
      <div class="day-num">${d.getDate()}</div>
      <div class="day-info">
        <div class="day-name">${DAYS_TR[d.getDay()]}</div>
        <div class="day-month">${MONTHS_TR[d.getMonth()]}</div>
      </div>
    </div>
  `;
}

function renderBookingPanel() {
  return `
    <div class="booking-panel" id="booking-panel">
      <button class="panel-close" id="panel-close">✕</button>
      <div id="panel-content"></div>
    </div>
  `;
}

function openBookingPanel() {
  const panel = document.getElementById('booking-panel');
  if (panel) { panel.classList.add('open'); bookingState.panelOpen = true; }
}

function closeBookingPanel() {
  const panel = document.getElementById('booking-panel');
  if (panel) { panel.classList.remove('open'); bookingState.panelOpen = false; }
  bookingState.selectedSlotTime = null;
  bookingState.selectedTherapist = null;
  bookingState.selectedMassage = null;
}

function updatePanelContent() {
  const { selectedSlotTime, selectedTherapist, selectedMassage, selectedDate } = bookingState;
  if (!selectedTherapist) return;

  const massageList = selectedTherapist.available_massages.map(m => `
    <div class="massage-card ${selectedMassage?.id === m.id ? 'selected' : ''}" data-massage='${JSON.stringify(m)}'>
      <div class="massage-card-top">
        <span class="massage-name">${m.name}</span>
        <span class="massage-price">${formatPrice(m.price)}</span>
      </div>
      <div class="massage-meta">⏱ ${m.duration_minutes} dakika</div>
      ${m.description ? `<div class="massage-desc">${m.description}</div>` : ''}
    </div>
  `).join('');

  let summaryHtml = '';
  if (selectedMassage) {
    const [h, min] = selectedSlotTime.split(':').map(Number);
    const endMin = h * 60 + min + selectedMassage.duration_minutes;
    const endTime = `${Math.floor(endMin/60).toString().padStart(2,'0')}:${(endMin%60).toString().padStart(2,'0')}`;

    summaryHtml = `
      <div class="booking-summary">
        <div class="summary-row">
          <span class="summary-key">Tarih</span>
          <span class="summary-val">${formatDate(selectedDate)}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Saat</span>
          <span class="summary-val">${selectedSlotTime} – ${endTime}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Terapist</span>
          <span class="summary-val">${selectedTherapist.name}</span>
        </div>
        <div class="summary-row">
          <span class="summary-key">Masaj</span>
          <span class="summary-val">${selectedMassage.name}</span>
        </div>
        <div class="summary-row summary-total">
          <span class="summary-key">Toplam Ücret</span>
          <span class="summary-val">${formatPrice(selectedMassage.price)}</span>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Not (İsteğe Bağlı)</label>
        <textarea class="form-textarea" id="booking-notes" placeholder="Tercihleriniz, sağlık durumu vb..."></textarea>
      </div>
      <button class="btn btn-gold btn-full" id="confirm-booking-btn">Rezervasyonu Onayla</button>
    `;
  }

  document.getElementById('panel-content').innerHTML = `
    <p class="panel-title">${selectedTherapist.name}</p>
    <p class="muted" style="font-size:0.78rem;margin-bottom:6px">${selectedSlotTime} başlangıçlı seans</p>
    ${selectedTherapist.bio ? `<p style="font-size:0.78rem;color:var(--text-secondary);margin-bottom:20px">${selectedTherapist.bio}</p>` : ''}
    <hr class="panel-divider">
    <p style="font-size:0.72rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-muted);margin-bottom:12px">Masaj Türü Seçin</p>
    <div class="massage-grid">${massageList}</div>
    ${summaryHtml}
  `;

  // Bind massage card clicks
  document.querySelectorAll('.massage-card').forEach(card => {
    card.addEventListener('click', () => {
      bookingState.selectedMassage = JSON.parse(card.dataset.massage);
      updatePanelContent();
    });
  });

  // Bind confirm
  const confirmBtn = document.getElementById('confirm-booking-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      const notes = document.getElementById('booking-notes')?.value || '';
      confirmBtn.disabled = true; confirmBtn.textContent = 'Onaylanıyor...';
      try {
        await API.createBooking({
          therapist_id: bookingState.selectedTherapist.id,
          massage_type_id: bookingState.selectedMassage.id,
          booking_date: bookingState.selectedDate,
          start_time: bookingState.selectedSlotTime,
          notes
        });
        showToast('Rezervasyonunuz oluşturuldu!', 'success');
        closeBookingPanel();
        // Invalidate cache for this date
        delete bookingState.availabilityCache[bookingState.selectedDate];
        loadSlotsForDate(bookingState.selectedDate);
      } catch (err) {
        showToast(err.message, 'error');
        confirmBtn.disabled = false; confirmBtn.textContent = 'Rezervasyonu Onayla';
      }
    });
  }
}

async function loadSlotsForDate(date) {
  const panel = document.getElementById('slots-panel');
  if (!panel) return;

  panel.innerHTML = '<div class="loading"><div class="spinner"></div>Uygun saatler yükleniyor...</div>';

  try {
    let data = bookingState.availabilityCache[date];
    if (!data) {
      data = await API.getAvailability(date);
      bookingState.availabilityCache[date] = data;
    }

    if (!data.slots || data.slots.length === 0) {
      panel.innerHTML = `
        <div class="empty-state">
          <div class="icon">🧘</div>
          <p>Bu tarih için uygun seans bulunmuyor.<br>Başka bir tarih deneyin.</p>
        </div>
      `;
      return;
    }

    const d = new Date(date + 'T00:00:00');
    panel.innerHTML = `
      <div class="slots-header">
        <h3>${DAYS_TR[d.getDay()]}, ${d.getDate()} ${MONTHS_TR[d.getMonth()]}</h3>
        <p>${data.slots.length} uygun saat · ${data.total_cabins} kabin</p>
      </div>
      <div class="slots-grid" id="slots-grid">
        ${renderSlots(data.slots)}
      </div>
    `;

    bindSlotEvents();
  } catch (err) {
    panel.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
  }
}

function groupSlotsByHour(slots) {
  const groups = {};
  slots.forEach(s => {
    const h = s.time.split(':')[0] + ':00';
    if (!groups[h]) groups[h] = [];
    groups[h].push(s);
  });
  return groups;
}

function renderSlots(slots) {
  const groups = groupSlotsByHour(slots);
  let html = '';
  for (const [hour, slotList] of Object.entries(groups)) {
    html += `<div class="time-label">${hour} – ${String(parseInt(hour)+1).padStart(2,'0')}:00</div>`;
    slotList.forEach(slot => {
      html += `
        <div class="slot-card" data-time="${slot.time}">
          <div class="slot-time">${slot.time}</div>
          <div class="slot-therapists">
            ${slot.therapists.map(t => `
              <div class="therapist-chip" data-time="${slot.time}" data-therapist='${JSON.stringify(t)}'>
                <div class="therapist-avatar">
                  ${t.photo_url ? `<img src="${t.photo_url}" alt="${t.name}">` : initials(t.name)}
                </div>
                ${t.name}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });
  }
  return html;
}

function bindSlotEvents() {
  document.querySelectorAll('.therapist-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      bookingState.selectedSlotTime = chip.dataset.time;
      bookingState.selectedTherapist = JSON.parse(chip.dataset.therapist);
      bookingState.selectedMassage = null;
      openBookingPanel();
      updatePanelContent();

      // Visual feedback
      document.querySelectorAll('.therapist-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
    });
  });
}

function bindBookingPageEvents() {
  // Date selection
  document.querySelectorAll('.date-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.date-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      bookingState.selectedDate = item.dataset.date;
      closeBookingPanel();
      loadSlotsForDate(bookingState.selectedDate);
    });
  });

  // Panel close
  document.getElementById('panel-close')?.addEventListener('click', closeBookingPanel);
}

// My Bookings
async function renderMyBookingsPage() {
  const container = document.getElementById('app');
  container.innerHTML = `
    ${renderHeader()}
    <div class="page">
      <div class="container my-bookings-page">
        <div class="page-header">
          <h2>Rezervasyonlarım</h2>
          <p class="muted">Geçmiş ve gelecek seans geçmişiniz</p>
        </div>
        <div id="my-bookings-list"><div class="loading"><div class="spinner"></div>Yükleniyor...</div></div>
      </div>
    </div>
  `;
  bindHeaderEvents();

  try {
    const bookings = await API.getMyBookings();
    const listEl = document.getElementById('my-bookings-list');
    if (!bookings.length) {
      listEl.innerHTML = `<div class="empty-state"><div class="icon">📅</div><p>Henüz rezervasyonunuz yok.</p></div>`;
      return;
    }
    listEl.innerHTML = `<div class="booking-list">${bookings.map(b => renderBookingItem(b)).join('')}</div>`;
    bindMyBookingEvents();
  } catch (err) {
    document.getElementById('my-bookings-list').innerHTML = `<div class="empty-state"><p>${err.message}</p></div>`;
  }
}

function renderBookingItem(b) {
  const d = new Date(b.booking_date + 'T00:00:00');
  return `
    <div class="booking-item" data-id="${b.id}">
      <div class="booking-date-badge">
        <div class="bday">${d.getDate()}</div>
        <div class="bmon">${MONTHS_TR[d.getMonth()].slice(0,3)}</div>
      </div>
      <div class="booking-info">
        <h4>${b.massage_name || '—'}</h4>
        <div class="meta">
          <span>${b.therapist_name || '—'}</span>
          <span>${b.start_time?.slice(0,5)} – ${b.end_time?.slice(0,5)}</span>
          ${b.room_number ? `<span>Oda ${b.room_number}</span>` : ''}
          <span>${formatPrice(b.price)}</span>
        </div>
        <div style="margin-top:6px">
          <span class="status-badge status-${b.status}">${b.status === 'confirmed' ? 'Onaylandı' : b.status === 'cancelled' ? 'İptal' : 'Tamamlandı'}</span>
        </div>
      </div>
      <div class="booking-actions">
        ${b.status === 'confirmed' ? `<button class="btn btn-danger btn-sm cancel-booking-btn" data-id="${b.id}">İptal</button>` : ''}
      </div>
    </div>
  `;
}

function bindMyBookingEvents() {
  document.querySelectorAll('.cancel-booking-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Rezervasyonu iptal etmek istediğinize emin misiniz?')) return;
      try {
        await API.cancelBooking(btn.dataset.id);
        showToast('Rezervasyon iptal edildi');
        renderMyBookingsPage();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });
}

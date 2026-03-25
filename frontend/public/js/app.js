// ================================================
// App Router & Header
// ================================================

let currentPage = 'booking'; // booking | my-bookings | admin

function renderHeader() {
  const isAdmin = currentUser?.role === 'admin';
  return `
    <header class="site-header">
      <div class="container header-inner">
        <a class="logo" href="#" onclick="navigateTo('booking');return false">
          Some Lucky Resort
          <span>Spa &amp; Wellness</span>
        </a>
        <nav class="nav">
          <button class="nav-btn ${currentPage === 'booking' ? 'active' : ''}" onclick="navigateTo('booking')">Rezervasyon</button>
          ${currentUser ? `<button class="nav-btn ${currentPage === 'my-bookings' ? 'active' : ''}" onclick="navigateTo('my-bookings')">Rezervasyonlarım</button>` : ''}
          ${isAdmin ? `<button class="nav-btn ${currentPage === 'admin' ? 'active' : ''}" onclick="navigateTo('admin')">Yönetim</button>` : ''}
          ${currentUser
            ? `<div class="user-chip">
                <span>${currentUser.name}</span>
                ${currentUser.room_number ? `<span class="room">Oda ${currentUser.room_number}</span>` : ''}
                <button class="nav-btn" onclick="logout()">Çıkış</button>
               </div>`
            : `<button class="nav-btn primary" onclick="navigateTo('auth')">Giriş Yap</button>`
          }
        </nav>
      </div>
    </header>
  `;
}

function bindHeaderEvents() {
  // Header events are inline for simplicity
}

function navigateTo(page) {
  currentPage = page;
  renderApp();
}

async function renderApp() {
  loadUser();
  const app = document.getElementById('app');

  // Auth sayfası
  if (!currentUser && currentPage !== 'booking') {
    app.innerHTML = renderAuthPage();
    bindAuthEvents();
    return;
  }

  // Admin kontrolü
  if (currentPage === 'admin' && currentUser?.role !== 'admin') {
    currentPage = 'booking';
  }

  switch (currentPage) {
    case 'auth':
      app.innerHTML = renderAuthPage();
      bindAuthEvents();
      break;

    case 'booking':
      app.innerHTML = `${renderHeader()}${renderBookingPage()}`;
      bindHeaderEvents();
      bindBookingPageEvents();
      loadSlotsForDate(bookingState.selectedDate);
      break;

    case 'my-bookings':
      if (!currentUser) {
        app.innerHTML = renderAuthPage();
        bindAuthEvents();
      } else {
        await renderMyBookingsPage();
      }
      break;

    case 'admin':
      if (currentUser?.role !== 'admin') {
        currentPage = 'booking';
        renderApp();
        return;
      }
      app.innerHTML = `${renderHeader()}${renderAdminPage()}`;
      bindHeaderEvents();
      bindAdminNavEvents();
      loadAdminSection(adminSection);
      break;
  }
}

// Boot
document.addEventListener('DOMContentLoaded', () => {
  loadUser();
  // Eğer admin ise direkt admin sayfasına git
  if (currentUser?.role === 'admin') {
    currentPage = 'admin';
  }
  renderApp();
});

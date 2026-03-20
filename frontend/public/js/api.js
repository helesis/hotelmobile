// ================================================
// API Helper
// ================================================

const API_BASE = '/api';

async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('spa_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

const API = {
  // Auth
  login: (email, password) => apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (body) => apiFetch('/auth/register', { method: 'POST', body: JSON.stringify(body) }),

  // Bookings
  getAvailability: (date) => apiFetch(`/bookings/availability?date=${date}`),
  createBooking: (body) => apiFetch('/bookings', { method: 'POST', body: JSON.stringify(body) }),
  getMyBookings: () => apiFetch('/bookings/my'),
  cancelBooking: (id) => apiFetch(`/bookings/${id}`, { method: 'DELETE' }),
  getAdminBookings: (date) => apiFetch(`/bookings/admin/all${date ? '?date=' + date : ''}`),

  // Admin
  getDashboard: () => apiFetch('/admin/dashboard'),

  getMassageTypes: () => apiFetch('/admin/massage-types'),
  createMassageType: (body) => apiFetch('/admin/massage-types', { method: 'POST', body: JSON.stringify(body) }),
  updateMassageType: (id, body) => apiFetch(`/admin/massage-types/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteMassageType: (id) => apiFetch(`/admin/massage-types/${id}`, { method: 'DELETE' }),

  getTherapists: () => apiFetch('/admin/therapists'),
  createTherapist: (body) => apiFetch('/admin/therapists', { method: 'POST', body: JSON.stringify(body) }),
  updateTherapist: (id, body) => apiFetch(`/admin/therapists/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTherapist: (id) => apiFetch(`/admin/therapists/${id}`, { method: 'DELETE' }),

  getCabins: () => apiFetch('/admin/cabins'),
  createCabin: (body) => apiFetch('/admin/cabins', { method: 'POST', body: JSON.stringify(body) }),
  updateCabin: (id, body) => apiFetch(`/admin/cabins/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

// Toast
function showToast(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Helpers
const DAYS_TR = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAYS_SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_TR[d.getMonth()]} ${d.getFullYear()}`;
}

function formatPrice(price) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 0 }).format(price);
}

function initials(name) {
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
}

function next7Days() {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}

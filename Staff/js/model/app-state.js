const INITIAL_ROOMS = [];

function normalizeRoomTypeName(roomType) {

 const value =
 String(roomType || "")
 .trim();


 return value;

}

function buildRoomTypeKey(roomType) {
  return String(normalizeRoomTypeName(roomType) || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isSameRoomType(roomTypeA, roomTypeB) {
  return buildRoomTypeKey(roomTypeA) === buildRoomTypeKey(roomTypeB);
}

function getRoomTypePrice(roomType) {
  const normalizedType = normalizeRoomTypeName(roomType);
  const roomWithPrice = rooms.find(room =>
    isSameRoomType(room.type, normalizedType) && Number(room.pricePerNight || room.price || 0) > 0
  );

  return Number(roomWithPrice?.pricePerNight || roomWithPrice?.price || 850000);
}

function getAvailableRoomTypeOptions() {

  return [
    ...new Set(
      rooms
      .map(room =>
        normalizeRoomTypeName(
          room.type
        )
      )
      .filter(Boolean)
    )
  ];

}

function getAutoAssignedRoomForType(roomType) {
  const normalizedType = normalizeRoomTypeName(roomType);
  return rooms.find(room => isSameRoomType(room.type, normalizedType) && room.status === 'Available') ||
    rooms.find(room => room.status === 'Available');
}

const INITIAL_RESERVATIONS = [];
const INITIAL_TRANSACTIONS = [];

const INITIAL_USERS = [
  { id: 'usr_1', fullname: 'Zea Aldrian', username: 'receptionist', password: 'recep123', role: 'Receptionist' },
  { id: 'usr_2', fullname: 'Karen Freon', username: 'admin', password: 'admin123', role: 'Admin' }
];

const INITIAL_CULINARY_ORDERS = [
  { id: 'food_1', name: 'Ramen Soto Piturooms Specials', type: 'Main course', ordersCount: 52, rating: '4.9', price: '45.000', tagColor: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
  { id: 'food_2', name: 'Original Shoyu Ramen (Noodle)', type: 'Main course', ordersCount: 41, rating: '4.8', price: '48.000', tagColor: 'bg-emerald-50 border-emerald-250 text-emerald-700' },
  { id: 'food_3', name: 'Piturooms Roasted Salada Bowl', type: 'Salad Class', ordersCount: 33, rating: '4.7', price: '32.000', tagColor: 'bg-amber-50 border-amber-250 text-amber-700' },
  { id: 'food_4', name: 'Lumina Matcha Milkshake Creamy', type: 'Drinks', ordersCount: 29, rating: '4.9', price: '25.000', tagColor: 'bg-cyan-50 border-cyan-200 text-cyan-700' }
];

const DEFAULT_RECEIPT_DESIGN_SETTINGS = {
  hotelName: 'PituRooms',
  hotelAddress: 'Jl. Sukowati No.33, Kalicacing, Kecamatan Sidomukti, Kota Salatiga, Jawa Tengah',
  hotelPhone: '+62 878-8252-5777',
  logoUrl: '/image/Logo Piturooms.png'
};


let rooms = [];
let reservations = [];
let onlineBookings = [];
let transactions = [];
let users = [];
let activeUser = JSON.parse(sessionStorage.getItem('Piturooms_active_user') || 'null');
let receiptDesignSettings = { ...DEFAULT_RECEIPT_DESIGN_SETTINGS };


let currentMenu = 'dashboard';
let currentRoomsFilter = 'all'; 
let currentAdminRoomsFilter = 'all';
let currentReservationsTab = 'all';
let currentGuestsTab = 'all';
let activeHistoryMethod = 'All';
let searchFilterStr = '';
let checkinAvailableRooms = [];

function syncToLocalStorage() {
}

function formatIDR(num) {
  return 'Rp ' + Number(num || 0).toLocaleString('id-ID');
}

function parseIDRCurrencyInput(value) {
  const digitsOnly = String(value || '').replace(/[^0-9]/g, '');
  return Number(digitsOnly || 0);
}

function formatIDRInputValue(value) {
  const amount = parseIDRCurrencyInput(value);
  if (!amount) return '';
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// Live-formats a text input's raw digits into "Rp 900.000" style as the user types,
// while keeping the underlying value fully parseable by parseIDRCurrencyInput().
function formatRupiahLiveInput(inputEl) {
  if (!inputEl) return;

  const digitsOnly = String(inputEl.value || '').replace(/[^0-9]/g, '');
  if (!digitsOnly) {
    inputEl.value = '';
    return;
  }

  const numericValue = Number(digitsOnly);
  inputEl.value = `Rp ${numericValue.toLocaleString('id-ID')}`;

  // Keep caret at the end since grouping separators shift character positions.
  if (typeof inputEl.setSelectionRange === 'function') {
    const endPos = inputEl.value.length;
    inputEl.setSelectionRange(endPos, endPos);
  }
}

function applyRupiahFormattingToInputById(inputId) {
  formatRupiahLiveInput(document.getElementById(inputId));
}

function applyRupiahFormattingToCashInput() {
  applyRupiahFormattingToInputById('payment-amount-paid');
}

function applyRupiahFormattingToRoomPriceInput() {
  applyRupiahFormattingToInputById('add-room-price');
}

function calculateStayDurationDays(checkInDate, checkOutDate) {
  const checkIn = new Date(`${checkInDate || ''}T00:00:00`);
  const checkOut = new Date(`${checkOutDate || ''}T00:00:00`);

  if (Number.isNaN(checkIn.getTime()) || Number.isNaN(checkOut.getTime())) {
    return 0;
  }

  const diffMs = checkOut.getTime() - checkIn.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const duration = Math.round(diffMs / oneDayMs);
  return duration > 0 ? duration : 0;
}

function formatRoomRateToK(num) {
  const value = Number(num || 0);
  if (!value) return '0k';
  return `${Math.round(value / 1000)}k`;
}

function setCheckinAvailableRooms(list) {
  if (!Array.isArray(list)) {
    checkinAvailableRooms = [];
    return;
  }

  checkinAvailableRooms = list
    .map(room => ({
      ...room,
      id: String(room.id || '').trim(),
      type: normalizeRoomTypeName(room.type || room.roomType || room.name || room.number || 'Kamar')
    }))
    .filter(room => room.id && String(room.status || '').toLowerCase() === 'available');
}

function getCheckinAvailableRooms() {
  return checkinAvailableRooms;
}

function getCheckinAvailableRoomById(roomId) {
  const id = String(roomId || '').trim();
  if (!id) return null;
  return checkinAvailableRooms.find(room => room.id === id) || null;
}

function getSelectedWalkinRoomType() {
  const select = document.getElementById('walkin-room-type');
  const selectedRoom = getCheckinAvailableRoomById(select?.value);
  if (selectedRoom) return normalizeRoomTypeName(selectedRoom.type);

  const fallback = String(select?.value || '').trim();
  return normalizeRoomTypeName(fallback || 'JI-Careless Whisper');
}

function getSelectedWalkinRoomPrice() {
  const select = document.getElementById('walkin-room-type');
  const selectedRoom = getCheckinAvailableRoomById(select?.value);
  if (selectedRoom) {
    const rawPrice = selectedRoom.pricePerNight || selectedRoom.price || getRoomTypePrice(selectedRoom.type);
    const numericPrice = Number(rawPrice);
    if (Number.isFinite(numericPrice) && numericPrice > 0) return numericPrice;

    const parsedPrice = parseIDRCurrencyInput(rawPrice);
    if (parsedPrice > 0) return parsedPrice;

    return getRoomTypePrice(selectedRoom.type);
  }

  return getRoomTypePrice(getSelectedWalkinRoomType());
}

function normalizePhoneDigits(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function isActiveCheckInStatus(status) {
  const normalized = String(status || '').trim().toLowerCase();
  return normalized === 'checkedin' || normalized === 'checked in' || normalized === 'inhouse' || normalized === 'in house' || normalized === 'occupied';
}

async function findActiveCheckInByIdentityOrPhone(identityNo, phone, excludeBookingId = '') {
  const targetIdentity = String(identityNo || '').trim();
  const targetPhone = normalizePhoneDigits(phone);
  const excludedId = String(excludeBookingId || '').trim();

  if (!targetIdentity && !targetPhone) {
    return { success: true, booking: null };
  }

  const matchesIdentityOrPhone = (booking) => {
    const bookingIdentity = String(booking.identityNo || booking.identity || booking.nik || '').trim();
    const bookingPhone = normalizePhoneDigits(
      booking.customerPhone || booking.phone || booking.phoneNumber || booking.whatsapp || ''
    );

    return isActiveCheckInStatus(booking.status) &&
      (!excludedId || String(booking.id || booking.bookingId || booking.code || '').trim() !== excludedId) &&
      ((targetIdentity && bookingIdentity === targetIdentity) || (targetPhone && bookingPhone === targetPhone));
  };

  if (typeof database !== 'undefined' && database && typeof database.ref === 'function') {
    try {
      const snapshot = await database.ref('bookings').once('value');
      let foundBooking = null;

      snapshot.forEach(childSnapshot => {
        const booking = { id: childSnapshot.key, ...childSnapshot.val() };
        if (matchesIdentityOrPhone(booking)) {
          foundBooking = booking;
        }
      });

      return { success: true, booking: foundBooking };
    } catch (error) {
      console.warn('Validasi identitas/kontak ke Firebase gagal, fallback ke data lokal:', error);
    }
  }

  const localBooking = Array.isArray(reservations)
    ? reservations.find(matchesIdentityOrPhone)
    : null;

  return { success: true, booking: localBooking || null };
}

function withTimeout(promise, ms = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Waktu koneksi habis (Timeout)')), ms);
    promise.then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}
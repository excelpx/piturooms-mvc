// CONTROLLER: login, event listener, validasi aksi, check-in/out, CRUD
// --- 6. CORE LOGIC WORKFLOW ACTIONS ---

// Active Login submit handler
function handleLogin(e) {
  e.preventDefault();
  const userNameVal = document.getElementById('login-username').value.trim();
  const passWordVal = document.getElementById('login-password').value.trim();

  // Search profiles matching
  const matchingUser = users.find(u => u.username === userNameVal && u.password === passWordVal);

  if (matchingUser) {
    activeUser = matchingUser;
    sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(activeUser));
    
    // Clear form and display screen transitions
    document.getElementById('login-form').reset();
    document.getElementById('login-error').classList.add('hidden');
    
    launchSystemSession();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
}

let stopCashierRealtimeListener = null;
let unsubscribeRoomsListener = null;
let unsubscribeFacilitiesListener = null;
let unsubscribeReservationsListener = null;
let unsubscribeStaffAccountsListener = null;
let unsubscribeRefundPolicyListener = null;
let facilitiesMasterData = [];
// Sesi/preferensi UI murni per-perangkat (bukan data operasional bersama), aman disimpan di memori saja.
let sidebarCollapsedState = false;
// Kebijakan refund kini 100% realtime dari Firestore (system_config/refund_settings), tidak ada cache localStorage.
let currentRefundPolicyPercentage = 50;
const ACTIVE_USER_SESSION_KEY = 'Piturooms_active_user';
const ACTIVE_CASHIER_SESSION_KEY = 'Piturooms_active_cashier_name';
const STAFF_ACCOUNTS_DB_PATH = 'staff_accounts';
const RESERVATIONS_DB_PATH = 'reservations';

function isAdminRoleActive() {
  return String(activeUser?.role || '').trim().toLowerCase() === 'admin';
}

function normalizeFacilityLabel(name) {
  return String(name || '').trim();
}

function renderDynamicFacilitiesOptions() {
  const container = document.getElementById('container-fasilitas-dinamis');
  const controls = document.getElementById('fasilitas-admin-controls');
  const deleteControls = document.getElementById('fasilitas-admin-delete-controls');
  const deleteSelect = document.getElementById('select-fasilitas-hapus');
  if (!container) return;

  const checkedNames = new Set(
    Array.from(container.querySelectorAll('input[name="room-facility"]:checked')).map(el => String(el.value || '').trim())
  );

  container.innerHTML = '';

  const shouldShowAdminControls = isAdminRoleActive();
  if (controls) {
    controls.classList.toggle('hidden', !shouldShowAdminControls);
    controls.classList.toggle('flex', shouldShowAdminControls);
  }
  if (deleteControls) {
    deleteControls.classList.toggle('hidden', !shouldShowAdminControls);
    deleteControls.classList.toggle('flex', shouldShowAdminControls);
  }

  const normalizedFacilities = (Array.isArray(facilitiesMasterData) ? facilitiesMasterData : [])
    .map(item => ({
      id: String(item?.id || '').trim(),
      name: normalizeFacilityLabel(item?.name)
    }))
    .filter(item => item.id && item.name);

  if (!normalizedFacilities.length) {
    container.innerHTML = '<p class="col-span-full text-[10px] text-slate-400 font-semibold">Belum ada fasilitas tersimpan. Tambahkan fasilitas baru untuk mulai.</p>';
    if (deleteSelect) {
      deleteSelect.innerHTML = '<option value="">Belum ada fasilitas untuk dihapus</option>';
    }
    return;
  }

  if (deleteSelect) {
    const previousValue = deleteSelect.value;
    deleteSelect.innerHTML = '<option value="">Pilih fasilitas yang ingin dihapus</option>';
    normalizedFacilities.forEach(facility => {
      const opt = document.createElement('option');
      opt.value = facility.id;
      opt.textContent = facility.name;
      deleteSelect.appendChild(opt);
    });
    if (previousValue && normalizedFacilities.some(item => item.id === previousValue)) {
      deleteSelect.value = previousValue;
    }
  }

  normalizedFacilities.forEach(facility => {
    const optionLabel = document.createElement('label');
    optionLabel.className = 'flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-semibold text-slate-700 leading-none cursor-pointer hover:border-indigo-200 hover:bg-indigo-50/30 transition-all';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = 'room-facility';
    input.value = facility.name;
    input.className = 'w-3.5 h-3.5 shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500';
    input.checked = checkedNames.has(facility.name);

    const text = document.createElement('span');
    text.className = 'flex-1 truncate';
    text.textContent = facility.name;

    optionLabel.appendChild(input);
    optionLabel.appendChild(text);
    container.appendChild(optionLabel);
  });
}

function stopFacilitiesRealtimeListener() {
  if (typeof unsubscribeFacilitiesListener === 'function') {
    try {
      unsubscribeFacilitiesListener();
    } catch (err) {
      console.warn('Gagal menghentikan listener fasilitas:', err);
    }
  }
  unsubscribeFacilitiesListener = null;
}

function startFacilitiesRealtimeListener() {
  if (typeof listenFacilitiesRealtime !== 'function') {
    console.warn('listenFacilitiesRealtime() belum tersedia.');
    return;
  }

  stopFacilitiesRealtimeListener();

  unsubscribeFacilitiesListener = listenFacilitiesRealtime((rows) => {
    // Firestore adalah satu-satunya sumber kebenaran untuk fasilitas. Jika snapshot kosong padahal
    // sebelumnya sudah pernah memuat data di sesi ini, tetap tampilkan cache in-memory sementara
    // (bukan localStorage) supaya UI tidak berkedip kosong saat listener baru pertama kali nyambung.
    if ((!rows || rows.length === 0) && facilitiesMasterData.length > 0) {
      if (typeof renderMasterFacilitiesTable === 'function') {
        renderMasterFacilitiesTable(facilitiesMasterData);
      }
    } else {
      facilitiesMasterData = Array.isArray(rows) ? rows : [];
    }

    // Render ulang checkbox/pilihan fasilitas di layar
    renderDynamicFacilitiesOptions();
  }, (err) => {
    console.warn('Realtime fasilitas gagal, beralih ke lokal:', err);
    loadFacilitiesAsFallback();
  });

  setTimeout(() => {
    if (!facilitiesMasterData.length && typeof getFacilities === 'function') {
      loadFacilitiesAsFallback();
    }
  }, 2000);
}

async function loadFacilitiesAsFallback() {
  if (typeof getFacilities !== 'function') {
    console.warn('getFacilities() belum tersedia.');
    return;
  }

  const result = await getFacilities();
  if (result?.success && Array.isArray(result.facilities)) {
    facilitiesMasterData = result.facilities;
    renderDynamicFacilitiesOptions();
  }
}

async function tambahFasilitasKeDatabase() {
  if (!isAdminRoleActive()) {
    alert('Hanya admin yang dapat menambah fasilitas kamar.');
    return;
  }

  const input = document.getElementById('input-fasilitas-baru');
  const name = String(input?.value || '').trim();
  if (!name) {
    alert('Nama fasilitas baru tidak boleh kosong.');
    return;
  }

  // Cek duplikat data
  const isDuplicate = facilitiesMasterData.some(f => {
    const fName = typeof f === 'string' ? f : (f.name || '');
    return fName.trim().toLowerCase() === name.toLowerCase();
  });

  if (isDuplicate) {
    alert('Fasilitas dengan nama tersebut sudah ada.');
    return;
  }

  // Masukkan data baru berbentuk objek standar sesuai struktur database Anda
  const newFacilityObj = { id: 'fac-' + Date.now(), name: name };
  facilitiesMasterData.push(newFacilityObj);
  renderDynamicFacilitiesOptions();

  if (input) input.value = '';

  // Kirim data permanen ke Firebase (Realtime Database). Kalau gagal, batalkan lagi (rollback)
  // perubahan optimistic di atas supaya tampilan tidak berbohong "sudah tersimpan" padahal
  // sebenarnya gagal — inilah penyebab fasilitas terlihat hilang lagi setelah refresh.
  if (typeof addFacility !== 'function') {
    alert('Fungsi addFacility() belum tersedia pada Firebase config. Fasilitas belum tersimpan permanen.');
    facilitiesMasterData = facilitiesMasterData.filter(item => item.id !== newFacilityObj.id);
    renderDynamicFacilitiesOptions();
    return;
  }

  const result = await addFacility(name);
  if (!result?.success) {
    alert(`Gagal menyimpan fasilitas ke database: ${result?.error || 'Unknown error'}. Silakan coba lagi.`);
    facilitiesMasterData = facilitiesMasterData.filter(item => item.id !== newFacilityObj.id);
    renderDynamicFacilitiesOptions();
  }
}

async function hapusFasilitasDariDatabase(facilityId, facilityName) {
  if (!isAdminRoleActive()) {
    alert('Hanya admin yang dapat menghapus fasilitas kamar.');
    return;
  }

  if (!confirm(`Hapus fasilitas "${facilityName}" dari sistem?`)) return;

  if (typeof deleteFacility !== 'function') {
    alert('Fungsi deleteFacility() belum tersedia pada Firebase config.');
    return;
  }

  // UPDATE INSTAN DI MEMORI (bukan localStorage) supaya UI langsung responsif; Firestore tetap sumber kebenaran.
  facilitiesMasterData = facilitiesMasterData.filter(item => String(item.id).trim() !== String(facilityId).trim());
  renderDynamicFacilitiesOptions();

  const result = await deleteFacility(facilityId);
  if (!result?.success) {
    alert(`Gagal menghapus fasilitas dari Cloud: ${result?.error || 'Unknown error'}`);
    loadFacilitiesAsFallback();
  }
}

async function handleDeleteSelectedFacility() {
  if (!isAdminRoleActive()) {
    alert('Hanya admin yang dapat menghapus fasilitas kamar.');
    return;
  }

  const select = document.getElementById('select-fasilitas-hapus');
  const facilityId = String(select?.value || '').trim();
  if (!facilityId) {
    alert('Pilih fasilitas yang ingin dihapus terlebih dahulu.');
    return;
  }

  const matched = (Array.isArray(facilitiesMasterData) ? facilitiesMasterData : []).find(item => String(item?.id || '').trim() === facilityId);
  const facilityName = String(matched?.name || 'fasilitas terpilih').trim();

  await hapusFasilitasDariDatabase(facilityId, facilityName);
}

function applySidebarCollapseState(isCollapsed) {
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);

  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (!toggleBtn) return;

  const iconName = isCollapsed ? 'panel-left-open' : 'panel-left-close';
  toggleBtn.setAttribute('aria-expanded', String(!isCollapsed));
  toggleBtn.setAttribute('aria-label', isCollapsed ? 'Besarkan sidebar' : 'Kecilkan sidebar');
  toggleBtn.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4"></i>`;

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function getSavedSidebarCollapseState() {
  return sidebarCollapsedState;
}

function toggleSidebarCollapse() {
  const nextState = !document.body.classList.contains('sidebar-collapsed');
  applySidebarCollapseState(nextState);
  sidebarCollapsedState = nextState;
}

function stopRealtimeCashierTransactionsListener() {
  if (typeof stopCashierRealtimeListener === 'function') {
    try {
      stopCashierRealtimeListener();
    } catch (err) {
      console.warn('Gagal menghentikan listener transaksi kasir:', err);
    }
  }

  stopCashierRealtimeListener = null;
}

function stopRealtimeRoomsListener() {
  if (typeof unsubscribeRoomsListener === 'function') {
    try {
      unsubscribeRoomsListener();
    } catch (err) {
      console.warn('Gagal menghentikan listener room:', err);
    }
  }

  unsubscribeRoomsListener = null;
}

function startRealtimeRoomsListener() {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') return;

  if (typeof unsubscribeRoomsListener === 'function') {
    try {
      unsubscribeRoomsListener();
    } catch (err) {
      console.warn('Gagal menutup listener room lama:', err);
    }
  }

  const roomsRef = database.ref('rooms');
  const onRoomsValue = (snapshot) => {
    const adminRoomsContainer = document.getElementById('admin-rooms-list');
    if (adminRoomsContainer) adminRoomsContainer.innerHTML = '';

    // Clear state before injecting fresh snapshot to avoid duplicate accumulation.
    rooms = [];

    const incomingRooms = [];
    snapshot.forEach(childSnapshot => {
      const value = childSnapshot.val() || {};
      incomingRooms.push({
        id: String(childSnapshot.key || '').trim(),
        number: String(value.number || '').trim(),
        floor: Number(value.floor || 1),
        type: normalizeRoomTypeName(value.type || value.roomType || value.name || ''),
        status: value.status || 'Available',
        pricePerNight: Number(value.pricePerNight || value.price || 850000),
        lateCheckoutPenalty: Number(value.lateCheckoutPenalty || 0),
        miniBarPenalty: Number(value.miniBarPenalty || 0),
        damagePenalty: Number(value.damagePenalty || 0),
        facilities: Array.isArray(value.facilities) ? value.facilities : []
      });
    });

    rooms = incomingRooms;

    if (currentMenu === 'adminRooms') renderAdminRooms();
    if (currentMenu === 'dashboard') renderDashboard();
    if (currentMenu === 'checkOut') setupCheckoutUnitSelects();
    if (currentMenu === 'checkIn') {
      loadAvailableRoomsForWalkinDropdown();
    }
  };

  roomsRef.on('value', onRoomsValue, err => {
    console.warn('Realtime room listener gagal:', err);
  });

  unsubscribeRoomsListener = () => {
    roomsRef.off('value', onRoomsValue);
  };
}

function getActiveCashierName() {
  const localUser = activeUser || JSON.parse(sessionStorage.getItem(ACTIVE_USER_SESSION_KEY) || 'null');
  if (!localUser) return '';

  const primary = String(localUser.username || localUser.fullname || '').trim();
  if (primary) return primary;

  const fromSession = sessionStorage.getItem(ACTIVE_CASHIER_SESSION_KEY)
    || sessionStorage.getItem('active_cashier_name')
    || sessionStorage.getItem('active_username');
  if (fromSession && String(fromSession).trim()) return String(fromSession).trim();

  return '';
}

function startRealtimeCashierTransactionsListener() {
  const isAdmin = activeUser && activeUser.role === 'Admin';
  if (isAdmin) return;

  const cashierName = getActiveCashierName();
  if (!cashierName || typeof listenActiveTransactionsByCashier !== 'function') return;

  stopRealtimeCashierTransactionsListener();
  stopCashierRealtimeListener = listenActiveTransactionsByCashier(cashierName, rows => {
    const incomingRows = rows.map(normalizeActiveTransactionPayload);
    transactions = applySequentialTransactionCodes(
      incomingRows.sort((a, b) => {
        const aTime = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
        const bTime = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
        return bTime - aTime;
      })
    );

    syncToLocalStorage();

    if (currentMenu === 'history') {
      renderHistory();
    }
  }, err => {
    console.warn('Realtime transaksi kasir gagal:', err);
  });
}

function parseTransactionCodeSequence(value) {
  const raw = String(value || '').trim().toUpperCase();
  const match = raw.match(/^TRX(\d{3,})$/);
  if (!match) return null;

  const numeric = Number.parseInt(match[1], 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function formatTransactionCode(sequence) {
  const safeSequence = Math.max(1, Number(sequence) || 1);
  return `TRX${String(safeSequence).padStart(3, '0')}`;
}

function getNextTransactionCode(sourceRows) {
  const rows = Array.isArray(sourceRows) ? sourceRows : [];
  let maxSequence = 0;

  rows.forEach(row => {
    const sequence = parseTransactionCodeSequence(row?.transactionCode) || parseTransactionCodeSequence(row?.id);
    if (sequence && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  return formatTransactionCode(maxSequence + 1);
}

function applySequentialTransactionCodes(sourceRows) {
  const rows = (Array.isArray(sourceRows) ? sourceRows : []).map(row => ({ ...row }));
  let maxSequence = 0;

  rows.forEach(row => {
    const currentSeq = parseTransactionCodeSequence(row.transactionCode);
    if (currentSeq && currentSeq > maxSequence) {
      maxSequence = currentSeq;
    }
  });

  const missingRows = rows.filter(row => !parseTransactionCodeSequence(row.transactionCode));
  missingRows.sort((a, b) => {
    const aTime = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
    const bTime = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
    return aTime - bTime;
  });

  missingRows.forEach(row => {
    maxSequence += 1;
    row.transactionCode = formatTransactionCode(maxSequence);
  });

  return rows;
}

// System boots up
function launchSystemSession() {
  document.getElementById('login-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');

  // Trigger role visibility constraints
  const isAdmin = String(activeUser?.role || '').toLowerCase() === 'admin';
  const adminNav = document.getElementById('admin-nav-group');
  const receptionistNav = document.getElementById('receptionist-nav-group');
  if (adminNav) {
    if (isAdmin) adminNav.classList.remove('hidden');
    else adminNav.classList.add('hidden');
  }
  if (receptionistNav) {
    if (isAdmin) receptionistNav.classList.add('hidden');
    else receptionistNav.classList.remove('hidden');
  }

  // Populate profiles labels at top headers and sidebar bases
  document.getElementById('user-initials').textContent = activeUser.fullname.charAt(0);
  document.getElementById('user-name').textContent = activeUser.fullname;
  document.getElementById('user-role').textContent = activeUser.role === 'Admin' ? 'Admin Eksekutif' : 'Staf Resepsionis';
  
  document.getElementById('header-avatar').textContent = activeUser.fullname.charAt(0);
  document.getElementById('header-user-name').textContent = activeUser.fullname;
  document.getElementById('header-user-role').textContent = activeUser.role === 'Admin' ? 'ADMIN OS' : 'RESEPTIONSIT';

  // Simpan identitas kasir aktif untuk query realtime Firestore.
  sessionStorage.setItem(ACTIVE_CASHIER_SESSION_KEY, getActiveCashierName());
  startRealtimeCashierTransactionsListener();
  startRealtimeRoomsListener();
  startRealtimeReservationsListener();
  startFacilitiesRealtimeListener();
  renderDynamicFacilitiesOptions();
  [
  "walkin-checkin-date",
  "walkin-checkout-date",
  "modal-add-res-ci",
  "modal-add-res-co"
  ]
  .forEach(id=>{
  const input =
  document.getElementById(id);
  if(input){
  input.addEventListener(
  "change",
  ()=>{
  if(
  id.includes("modal")
  ){
  loadReservationRoomDropdown();
  }else{
  loadAvailableRoomsForWalkinDropdown();
  }
  });
  }
  });

  // Open default menu
  if (isAdmin) {
    if (typeof switchAdminView === 'function') {
      switchAdminView('kamar-inventory');
    } else {
      navigate('adminRooms');
    }
  } else {
    navigate('dashboard');
  }
}

function handleLogout() {
  stopRealtimeCashierTransactionsListener();
  stopRealtimeRoomsListener();
  stopRealtimeReservationsListener();
  stopFacilitiesRealtimeListener();
  activeUser = null;
  sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
  sessionStorage.removeItem(ACTIVE_CASHIER_SESSION_KEY);
  sessionStorage.removeItem('active_cashier_name');
  
  document.getElementById('app-container').classList.add('hidden');
  document.getElementById('login-container').classList.remove('hidden');
}

async function deleteRoomById(roomId) {
  const targetId = String(roomId || '').trim();
  if (!targetId) return;

  const room = rooms.find(r => String(r.id || '').trim() === targetId);
  if (!room) {
    alert('Data kamar tidak ditemukan. Muat ulang halaman lalu coba lagi.');
    return;
  }

  const confirmed = confirm(`Hapus kamar ${room.number} (${room.type}) dari inventaris?`);
  if (!confirmed) return;

  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    alert('Koneksi database Firebase tidak tersedia. Hapus permanen dibatalkan.');
    return;
  }

  try {
    await database.ref(`rooms/${targetId}`).remove();

    rooms = rooms.filter(r => String(r.id || '').trim() !== targetId);
    const linkedReservations = reservations.filter(reservation => reservation.roomNumber === room.number);
    reservations = reservations.filter(reservation => reservation.roomNumber !== room.number);
    transactions = transactions.filter(transaction => transaction.roomNumber !== room.number);
    linkedReservations.forEach(reservation => {
      deleteReservationFromFirebase(reservation.id).catch(err => console.warn('Gagal hapus reservasi terkait kamar dari Firebase:', err));
    });

    triggerSubRenderers();
    alert(`Kamar ${room.number} berhasil dihapus permanen.`);
  } catch (error) {
    console.error('Gagal menghapus kamar permanen:', error);
    alert(`Gagal menghapus kamar: ${error?.message || error}`);
  }
}

function isRoomAvailableByDate(
 roomNumber,
 checkIn,
 checkOut
){

const start =
new Date(checkIn);


const end =
new Date(checkOut);


return !reservations.some(res=>{


const bookedRoom =
res.roomNumber ||
res.room ||
res.assignedRoom;


if(
String(bookedRoom) !==
String(roomNumber)
){

return false;

}


// booking selesai tidak dihitung
if(
[
"CheckedOut",
"Cancelled",
"Canceled"
]
.includes(res.status)
){

return false;

}


const bookedStart =
new Date(
res.checkIn ||
res.checkInDate
);


const bookedEnd =
new Date(
res.checkOut ||
res.checkOutDate
);



return (

start < bookedEnd &&
end > bookedStart

);


});


}

async function loadAvailableRoomsForWalkinDropdown(){
  const select =
  document.getElementById(
    'walkin-room-type'
  );

  if(!select){
    return;
  }

  const checkIn =
  document.getElementById(
    "walkin-checkin-date"
  )?.value;

  const checkOut =
  document.getElementById(
    "walkin-checkout-date"
  )?.value;

  let databaseRooms = [];

  if(typeof getRooms === 'function'){
    try{
      const result =
      await withTimeout(
        getRooms(),
        8000
      );
      if(
        result &&
        result.success &&
        Array.isArray(result.rooms)
      ){
        databaseRooms =
        result.rooms.map(room=>({
          ...room,
          id:
          String(
            room.id || ''
          ).trim(),
          number:
          String(
            room.number || ''
          ).trim(),
          type:
          normalizeRoomTypeName(

            room.type ||
            room.roomType ||
            room.name ||
            room.number ||
            'Kamar'
          ),
          status:
          room.status ||
          'Available',
          pricePerNight:
          Number(
            room.pricePerNight ||
            room.price ||
            850000
          ),
          lateCheckoutPenalty:
          Number(
            room.lateCheckoutPenalty ||
            0
          ),
          miniBarPenalty:
          Number(
            room.miniBarPenalty ||
            0
          ),
          damagePenalty:
          Number(
            room.damagePenalty ||
            0
          )
        }));
      }
    }catch(err){
      console.warn(
        'Gagal mengambil kamar dari database:',
        err
      );
    }
  }
  const availableRooms =
  databaseRooms.filter(room=>{
    if(
      !checkIn ||
      !checkOut
    ){
      return true;
    }
    return isRoomAvailableByDate(
      room.number,
      checkIn,
      checkOut
    );
  });

  rooms = databaseRooms;
  setCheckinAvailableRooms(
    availableRooms
  );

  renderWalkinRoomTypeOptions(
    availableRooms
  );

  setupCheckinUnitSelects();
  calculateWalkinTotalPrice();
}

function getRoomCanonicalKey(room) {
  const roomNumber = String(room?.number || '').trim().toUpperCase();
  if (roomNumber) return `number:${roomNumber}`;

  const roomId = String(room?.id || '').trim();
  if (roomId) return `id:${roomId}`;

  return '';
}

function dedupeRoomsByCanonicalKey(sourceRooms) {
  const uniqueMap = new Map();

  (Array.isArray(sourceRooms) ? sourceRooms : []).forEach(room => {
    const key = getRoomCanonicalKey(room);
    if (!key) return;

    const prev = uniqueMap.get(key) || {};
    uniqueMap.set(key, {
      ...prev,
      ...room,
      id: String(room?.id || prev.id || '').trim(),
      number: String(room?.number || prev.number || '').trim(),
      type: normalizeRoomTypeName(room?.type || prev.type || '')
    });
  });

  return Array.from(uniqueMap.values());
}

function getRoomFreshnessScore(room) {
  const dateValue = room?.lastUpdated || room?.createdAt || '';
  const millis = new Date(dateValue).getTime();
  return Number.isFinite(millis) ? millis : 0;
}

async function cleanupDuplicateRoomsInFirebase(localRoomsSnapshot = rooms) {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true, removed: 0, message: 'Firebase database tidak tersedia' };
  }

  try {
    const snapshot = await database.ref('rooms').once('value');
    const backendRooms = [];

    snapshot.forEach(child => {
      const value = child.val() || {};
      backendRooms.push({
        id: String(child.key || '').trim(),
        number: String(value.number || '').trim(),
        ...value
      });
    });

    const preferredIdByNumber = new Map();
    dedupeRoomsByCanonicalKey(localRoomsSnapshot).forEach(room => {
      const numberKey = String(room?.number || '').trim().toUpperCase();
      const roomId = String(room?.id || '').trim();
      if (numberKey && roomId) preferredIdByNumber.set(numberKey, roomId);
    });

    const grouped = new Map();
    backendRooms.forEach(room => {
      const numberKey = String(room?.number || '').trim().toUpperCase();
      if (!numberKey) return;

      if (!grouped.has(numberKey)) grouped.set(numberKey, []);
      grouped.get(numberKey).push(room);
    });

    const removedRoomIds = [];
    for (const [numberKey, group] of grouped.entries()) {
      if (!Array.isArray(group) || group.length < 2) continue;

      const preferredLocalId = preferredIdByNumber.get(numberKey) || '';
      let keeper = group.find(room => String(room.id || '').trim() === preferredLocalId) || null;

      if (!keeper) {
        keeper = [...group].sort((a, b) => getRoomFreshnessScore(b) - getRoomFreshnessScore(a))[0] || null;
      }

      const keeperId = String(keeper?.id || '').trim();
      const duplicates = group.filter(room => String(room.id || '').trim() && String(room.id || '').trim() !== keeperId);

      for (const duplicate of duplicates) {
        const duplicateId = String(duplicate.id || '').trim();
        if (!duplicateId) continue;
        await database.ref(`rooms/${duplicateId}`).remove();
        removedRoomIds.push(duplicateId);
      }
    }

    return {
      success: true,
      removed: removedRoomIds.length,
      removedRoomIds
    };
  } catch (err) {
    return {
      success: false,
      removed: 0,
      error: err?.message || String(err)
    };
  }
}

async function upsertRoomToFirebase(room) {
  if (!room || !room.id) return { success: false, skipped: true };
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true, error: 'Firebase database tidak tersedia' };
  }

  const roomId = String(room.id || '').trim();
  if (!roomId) return { success: false, skipped: true };

  const payload = {
    number: room.number || '',
    type: normalizeRoomTypeName(room.type || ''),
    price: Number(room.pricePerNight || room.price || 850000),
    floor: Number(room.floor || 1),
    status: room.status || 'Available',
    lateCheckoutPenalty: Number(room.lateCheckoutPenalty || 0),
    miniBarPenalty: Number(room.miniBarPenalty || 0),
    damagePenalty: Number(room.damagePenalty || 0),
    facilities: Array.isArray(room.facilities) ? room.facilities : [],
    lastUpdated: new Date().toISOString()
  };

  try {
    const roomRef = database.ref(`rooms/${roomId}`);
    const snapshot = await roomRef.once('value');
    if (!snapshot.exists()) {
      payload.createdAt = new Date().toISOString();
      await roomRef.set(payload);
    } else {
      await roomRef.update(payload);
    }

    return { success: true, roomId };
  } catch (err) {
    return { success: false, roomId, error: err?.message || String(err) };
  }
}

async function syncAllLocalRoomsToFirebase() {
  if (!Array.isArray(rooms) || !rooms.length) {
    return { success: false, synced: 0, failed: 0, message: 'Tidak ada data room lokal untuk disinkronkan' };
  }

  const uniqueRooms = dedupeRoomsByCanonicalKey(rooms);
  if (uniqueRooms.length !== rooms.length) {
    rooms = uniqueRooms;
    syncToLocalStorage();
  }

  const results = await Promise.allSettled(uniqueRooms.map(room => upsertRoomToFirebase(room)));
  let synced = 0;
  let failed = 0;

  results.forEach(item => {
    if (item.status === 'fulfilled' && item.value && item.value.success) synced += 1;
    else failed += 1;
  });

  const cleanupResult = await cleanupDuplicateRoomsInFirebase(uniqueRooms);
  if (!cleanupResult.success) {
    console.warn('Pembersihan duplikat room di Firebase gagal:', cleanupResult.error || cleanupResult.message || cleanupResult);
  }

  return {
    success: failed === 0,
    synced,
    failed,
    removedDuplicates: cleanupResult.success ? cleanupResult.removed : 0
  };
}

// Rekonsiliasi aman saat aplikasi baru dimuat di sebuah browser/perangkat.
// PENTING: Jangan pernah "push" seluruh cache room lokal (localStorage) ke Firebase secara buta di sini,
// karena cache lokal bisa saja berisi kamar yang SUDAH DIHAPUS oleh resepsionis lain dari browser lain.
// Kalau di-push mentah-mentah, kamar yang sudah dihapus akan muncul lagi (auto-resurrect) begitu browser
// lain dibuka. Firebase selalu dianggap sumber kebenaran untuk kamar yang sudah pernah ada di sana;
// hanya kamar yang benar-benar baru dan belum pernah ada di Firebase yang boleh di-push ke atas.
async function reconcileLocalRoomsWithFirebaseOnLoad() {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true };
  }

  try {
    const snapshot = await database.ref('rooms').once('value');
    const backendRooms = [];

    snapshot.forEach(childSnapshot => {
      const value = childSnapshot.val() || {};
      backendRooms.push({
        id: String(childSnapshot.key || '').trim(),
        number: String(value.number || '').trim(),
        floor: Number(value.floor || 1),
        type: normalizeRoomTypeName(value.type || value.roomType || value.name || ''),
        status: value.status || 'Available',
        pricePerNight: Number(value.pricePerNight || value.price || 850000),
        lateCheckoutPenalty: Number(value.lateCheckoutPenalty || 0),
        miniBarPenalty: Number(value.miniBarPenalty || 0),
        damagePenalty: Number(value.damagePenalty || 0),
        facilities: Array.isArray(value.facilities) ? value.facilities : []
      });
    });

    const backendKeys = new Set(backendRooms.map(getRoomCanonicalKey).filter(Boolean));

    // Kamar lokal yang benar-benar belum pernah ada di Firebase (baru dibuat saat offline, dsb).
    const localOnlyRooms = dedupeRoomsByCanonicalKey(Array.isArray(rooms) ? rooms : [])
      .filter(room => {
        const key = getRoomCanonicalKey(room);
        return key && !backendKeys.has(key);
      });

    // First-run bootstrap: kalau node 'rooms' di Firebase benar-benar masih kosong (belum pernah
    // dipakai sama sekali) DAN tidak ada kamar lokal apa pun, isi dengan data awal (INITIAL_ROOMS)
    // satu kali saja supaya hotel punya inventaris awal untuk diedit oleh admin. Ini TIDAK akan
    // pernah menimpa data asli yang sudah ada di Firebase.
if (!backendRooms.length) {
rooms = [];
}

    rooms = dedupeRoomsByCanonicalKey([...backendRooms, ...localOnlyRooms]);

    let pushed = 0;
    if (localOnlyRooms.length) {
      const pushResults = await Promise.allSettled(localOnlyRooms.map(room => upsertRoomToFirebase(room)));
      pushed = pushResults.filter(item => item.status === 'fulfilled' && item.value && item.value.success).length;
    }

    return { success: true, pulled: backendRooms.length, pushed };
  } catch (err) {
    console.warn('Gagal rekonsiliasi rooms dengan Firebase:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

// --- 6b. RESERVATIONS REALTIME SYNC (Firebase Realtime Database) ---
// Semua reservasi (walk-in, dibuat manual oleh admin/resepsionis, maupun OTA yang sudah
// diverifikasi/di-check-in) disimpan permanen di node 'reservations' agar terlihat realtime
// di semua komputer, bukan hanya di memori/localStorage browser yang sedang dipakai.

function stopRealtimeReservationsListener() {
  if (typeof unsubscribeReservationsListener === 'function') {
    try {
      unsubscribeReservationsListener();
    } catch (err) {
      console.warn('Gagal menghentikan listener reservasi:', err);
    }
  }
  unsubscribeReservationsListener = null;
}

function startRealtimeReservationsListener() {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') return;

  stopRealtimeReservationsListener();

  const reservationsRef = database.ref(RESERVATIONS_DB_PATH);
  const onReservationsValue = (snapshot) => {
    const incoming = [];
    snapshot.forEach(childSnapshot => {
      incoming.push({ id: String(childSnapshot.key || '').trim(), ...(childSnapshot.val() || {}) });
    });

    reservations = incoming.sort((a, b) => {
      const aTime = new Date(a.createdAt || a.checkInDate || 0).getTime();
      const bTime = new Date(b.createdAt || b.checkInDate || 0).getTime();
      return bTime - aTime;
    });

    triggerSubRenderers();
  };

  reservationsRef.on('value', onReservationsValue, err => {
    console.warn('Realtime reservasi gagal:', err);
  });

  unsubscribeReservationsListener = () => {
    reservationsRef.off('value', onReservationsValue);
  };
}

async function upsertReservationToFirebase(reservation) {
  const resId = String(reservation?.id || '').trim();
  if (!resId) return { success: false, skipped: true };

  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true, error: 'Firebase database tidak tersedia' };
  }

  const payload = {
    ...reservation,
    id: resId,
    updatedAt: new Date().toISOString()
  };
  if (!payload.createdAt) payload.createdAt = payload.updatedAt;

  try {
    await database.ref(`${RESERVATIONS_DB_PATH}/${resId}`).update(payload);
    return { success: true };
  } catch (err) {
    console.warn(`Gagal sinkron reservasi ${resId} ke Firebase:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

async function deleteReservationFromFirebase(reservationId) {
  const resId = String(reservationId || '').trim();
  if (!resId) return { success: false, skipped: true };

  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true };
  }

  try {
    await database.ref(`${RESERVATIONS_DB_PATH}/${resId}`).remove();
    return { success: true };
  } catch (err) {
    console.warn(`Gagal hapus reservasi ${resId} dari Firebase:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

// --- 6c. STAFF ACCOUNTS REALTIME SYNC (Firebase Realtime Database) ---
// Akun login Admin/Resepsionis sebelumnya HANYA ada di localStorage per-browser (usr array lokal).
// Sekarang disimpan di node 'staff_accounts' dan realtime, supaya akun yang dibuat/diedit/dihapus
// oleh Admin di satu komputer langsung berlaku juga untuk login di komputer lain.
//
// CATATAN KEAMANAN PENTING: pastikan Firebase Security Rules membatasi akses baca/tulis node
// 'staff_accounts' (jangan pernah pakai rules publik ".read": true / ".write": true untuk path ini),
// karena konfigurasi Firebase client selalu terlihat publik di source code front-end. Password di
// sini masih tersimpan sebagai teks biasa mengikuti desain login sebelumnya; untuk produksi jangka
// panjang sebaiknya dimigrasikan ke Firebase Authentication yang sesungguhnya.
function stopStaffAccountsRealtimeListener() {
  if (typeof unsubscribeStaffAccountsListener === 'function') {
    try {
      unsubscribeStaffAccountsListener();
    } catch (err) {
      console.warn('Gagal menghentikan listener akun staf:', err);
    }
  }
  unsubscribeStaffAccountsListener = null;
}

async function seedStaffAccountsIfEmpty() {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') return;

  try {
    const snapshot = await database.ref(STAFF_ACCOUNTS_DB_PATH).once('value');
    if (snapshot.exists()) return;

    const updates = {};
    INITIAL_USERS.forEach(user => {
      updates[`${STAFF_ACCOUNTS_DB_PATH}/${user.id}`] = user;
    });
    await database.ref().update(updates);
  } catch (err) {
    console.warn('Gagal seed akun staf awal ke Firebase:', err);
  }
}

function startStaffAccountsRealtimeListener() {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') return;

  stopStaffAccountsRealtimeListener();

  const staffRef = database.ref(STAFF_ACCOUNTS_DB_PATH);
  const onStaffValue = (snapshot) => {
    const incoming = [];
    snapshot.forEach(childSnapshot => {
      incoming.push({ id: String(childSnapshot.key || '').trim(), ...(childSnapshot.val() || {}) });
    });

    if (!incoming.length) {
      // First-run bootstrap: node masih benar-benar kosong, isi dengan akun default sekali saja
      // supaya sistem tidak terkunci total (tidak ada siapa pun yang bisa login).
      seedStaffAccountsIfEmpty();
      return;
    }

    users = incoming;

    // Sinkronkan sesi yang sedang login jika datanya baru saja diedit dari komputer lain.
    if (activeUser) {
      const refreshedActiveUser = users.find(u => u.id === activeUser.id);
      if (refreshedActiveUser) {
        activeUser = refreshedActiveUser;
        sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(activeUser));
      }
    }

    if (typeof renderAdminUsers === 'function' && currentMenu === 'adminUsers') {
      renderAdminUsers();
    }
  };

  staffRef.on('value', onStaffValue, err => {
    console.warn('Realtime akun staf gagal:', err);
  });

  unsubscribeStaffAccountsListener = () => {
    staffRef.off('value', onStaffValue);
  };
}

async function upsertStaffAccountToFirebase(user) {
  const userId = String(user?.id || '').trim();
  if (!userId) return { success: false, skipped: true };

  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true, error: 'Firebase database tidak tersedia' };
  }

  try {
    await database.ref(`${STAFF_ACCOUNTS_DB_PATH}/${userId}`).set({
      fullname: user.fullname || '',
      username: user.username || '',
      password: user.password || '',
      role: user.role || 'Receptionist'
    });
    return { success: true };
  } catch (err) {
    console.warn(`Gagal sinkron akun staf ${userId} ke Firebase:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

async function deleteStaffAccountFromFirebase(userId) {
  const id = String(userId || '').trim();
  if (!id) return { success: false, skipped: true };

  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return { success: false, skipped: true };
  }

  try {
    await database.ref(`${STAFF_ACCOUNTS_DB_PATH}/${id}`).remove();
    return { success: true };
  } catch (err) {
    console.warn(`Gagal hapus akun staf ${id} dari Firebase:`, err);
    return { success: false, error: err?.message || String(err) };
  }
}

// --- 7. COMPLETE DYNAMIC ACTIONS SUBMISSION & HANDLERS ---

// A. Walk-in or Reservation Check-In processing submit
async function executeCompleteCheckin() {
  const currentTabWalk = document.getElementById('tab-checkin-walkin');
  const isWalkinTab = currentTabWalk && currentTabWalk.classList.contains('border-indigo-600');
  const selectedPaymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value;
  
  if (isWalkinTab) {
    const guestN = document.getElementById('walkin-name').value.trim();
    const identity = document.getElementById('walkin-identity').value.trim();
    const phone = document.getElementById('walkin-phone').value.trim();
    const email = document.getElementById('walkin-email').value.trim();
    const selectedRoomId = document.getElementById('walkin-room-type').value;
    const selectedRoom = getCheckinAvailableRoomById(selectedRoomId) || rooms.find(room => room.id === selectedRoomId) || null;
    const rType = normalizeRoomTypeName(selectedRoom?.type || '');
    const checkin = document.getElementById('walkin-checkin-date').value;
    const checkout = document.getElementById('walkin-checkout-date').value;
    const duration = calculateStayDurationDays(checkin, checkout);
    
    // Standarkan nilai payment method menjadi huruf kecil semua
    const payMethod = (selectedPaymentMethod || 'cash').toLowerCase();

    if (!guestN || !identity || !phone || !checkin || !checkout) {
      alert('Mohon isi seluruh bidang formulir walk-in berstatus wajib (*) terlebih dahulu!');
      return;
    }

    if (duration <= 0) {
      alert('Tanggal check-out harus setelah tanggal check-in.');
      return;
    }

    const activeGuestLookup = await findActiveCheckInByIdentityOrPhone(identity, phone);
    if (activeGuestLookup && activeGuestLookup.booking) {
      alert('Tamu dengan KTP / NID / Paspor atau No. Kontak ini sudah check-in di kamar lain dan belum melakukan Check-Out!');
      return;
    }

    if (!selectedRoomId || !selectedRoom || String(selectedRoom.status || '').toLowerCase() !== 'available') {
      alert('Pilih kamar yang tersedia terlebih dahulu dari daftar dinamis.');
      return;
    }

    const assignedRoom = rooms.find(room => room.id === selectedRoomId) || selectedRoom || getAutoAssignedRoomForType(rType);
    const roomN = assignedRoom ? assignedRoom.number : '';
    if (!roomN) {
      alert('Tidak ada kamar kosong yang tersedia untuk tipe kamar yang dipilih saat ini.');
      return;
    }

    const roomPrice = getSelectedWalkinRoomPrice();
    const computedTotalCharge = roomPrice * duration;
    const subtotalText = document.getElementById('payment-calc-subtotal')?.textContent || '';
    const subtotalFromUi = parseIDRCurrencyInput(subtotalText);
    const totalCharge = subtotalFromUi > 0 ? subtotalFromUi : computedTotalCharge;

    let payAmt = totalCharge;
    let changeAmt = 0;
    
    // Perbaikan: Cek menggunakan huruf kecil 'cash'
    if (payMethod === 'cash') {
      payAmt = parseIDRCurrencyInput(document.getElementById('payment-amount-paid').value);
      if (payAmt <= 0) {
        alert('Nominal tunai tidak valid. Masukkan angka pembayaran yang benar.');
        return;
      }
      if (payAmt < totalCharge) {
        alert(`Nominal tunai kurang. Total tagihan: ${formatIDR(totalCharge)}, diterima: ${formatIDR(payAmt)}.`);
        return;
      }
      changeAmt = payAmt - totalCharge;
    }

    let activeRoom = null;
    if (assignedRoom?.id) {
      activeRoom = rooms.find(room => room.id === assignedRoom.id) || null;
    }
    if (!activeRoom && roomN) {
      activeRoom = rooms.find(room => room.number === roomN) || null;
    }

    const resId = 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Memastikan penulisan ke database tetap rapi (Kapital di awal untuk disimpan)
   const displayPayMethod = payMethod === 'cash'? 'Cash': 'Cashless';
    const newRes = {
      id: resId,
      guestName: guestN,
      identityNo: identity,
      phone: phone,
      email: email,
      roomType: rType,
      roomNumber: roomN,
      checkInDate: checkin,
      checkOutDate: checkout,
      durationDays: duration,
      totalCharge: totalCharge,
      isOnlineBooking: false,
      // Perbaikan: Cek kondisi dengan huruf kecil
      status: (payMethod === 'cashless' || payMethod === 'midtrans') ? 'PENDING_PAYMENT' : 'CheckedIn',
      paymentMethod: displayPayMethod,
      amountPaid: payAmt,
      changeAmount: changeAmt
    };

    const trxCode = getNextTransactionCode(transactions);
    const cashierName = getActiveCashierName();
    const newTrx = {
      id: trxCode,
      transactionCode: trxCode,
      date: new Date().toISOString(),
      guestName: guestN,
      roomType: rType,
      roomNumber: roomN,
      cashierName,
      cashier_name: cashierName,
      type: 'Check In',
      amount: totalCharge,
      paymentMethod: displayPayMethod,
      resepsionis: activeUser?.fullname || 'Resepsionis',
      isArchived: false
    };

    if (
    payMethod === 'cashless' ||
    payMethod === 'midtrans' ||
    payMethod === 'qris' ||
    payMethod === 'transfer' ||
    payMethod === 'debit'
    ){
        if (typeof window.handleMidtransPayment === 'function') {
            window.handleMidtransPayment(
                newRes,
                newTrx,
                assignedRoom,
                activeRoom,
                roomN,
                rType
            );
            return;
        } else {
            alert(
            "Sistem Error: Fungsi handleMidtransPayment tidak ditemukan!");
            return;
        }
    }
    newRes.status = "CheckedIn";
    await processFinalDatabaseInsertion(
        newRes,
        newTrx,
        assignedRoom,
        activeRoom,
        roomN,
        rType
    );
    alert(
    `Sukses Walk-in Tunai! Tamu ${guestN} ditempatkan di Kamar #${roomN}.`
    );
    triggerSubRenderers();
    clearInput('walkin-name');
    clearInput('walkin-identity');
    clearInput('walkin-phone');
    clearInput('walkin-email');
    clearInput('payment-amount-paid');
    loadAvailableRoomsForWalkinDropdown();
    navigate('dashboard');

  } else {
    const bookCode = document.getElementById('online-booking-code').value.trim();
    if (!bookCode) {
      alert('Verifikasi kode Booking terlebih dahulu sebelum memproses check-in OTA.');
      return;
    }
    const resObj = reservations.find(r => r.id === bookCode && r.status === 'Confirmed');
    if (!resObj) {
      alert('Pencarian database gagal atau status tamu bukan Confirmed!');
      return;
    }
    const activeGuestLookup =
await findActiveCheckInByIdentityOrPhone(
 resObj.identityNo,
 resObj.phone
);

if (
 activeGuestLookup &&
 activeGuestLookup.booking
) {
 const oldBooking =
 activeGuestLookup.booking;
 const sameBooking =
 normalizeOTACode(
  oldBooking.id ||
  oldBooking.bookingCode ||
  oldBooking.code
 )
 ===
 normalizeOTACode(
  resObj.id ||
  resObj.bookingCode ||
  resObj.code
 );
 const alreadyInRoom =
 oldBooking.status === "CheckedIn";
 if(
  alreadyInRoom &&
  !sameBooking
 ){
  alert(
   "Tamu masih aktif di kamar lain dan belum Check-Out!"
  );
  return;
 }
}
    const assignedRoom = getAutoAssignedRoomForType(resObj.roomType || resObj.roomName);
    const roomN = assignedRoom ? assignedRoom.number : '';
    if (!roomN) {
      alert('Tidak ada kamar kosong yang tersedia untuk booking OTA ini.');
      return;
    }
    if (assignedRoom) assignedRoom.status = 'Occupied';
    if (assignedRoom?.id && typeof updateRoomStatus === 'function') {
      updateRoomStatus(assignedRoom.id, 'Occupied').catch(err => console.warn('Gagal update status kamar ke backend:', err));
    }
      resObj.roomNumber = roomN;
    const otaRadio =
    document.querySelector(
    '#payment-options-block input[name="payment-method"]:checked'
    );
    const otaPayMethod =
    otaRadio
    ?
    otaRadio.value.toLowerCase()
    :
    "cash";
    console.log(
    "METODE OTA DIPILIH:",
    otaPayMethod
    );
    const needPayment =
    String(resObj.paymentStatus || "")
    .toLowerCase()
    .includes("belum");

    if(
    needPayment &&
    otaPayMethod === "midtrans"
    ){
    const trxCode =
    getNextTransactionCode(
      transactions
    );
    const cashierName =
    getActiveCashierName();
    const newTrx = {
    id: trxCode,
    transactionCode: trxCode,
    date:new Date().toISOString(),
    guestName:resObj.guestName,
    roomType:resObj.roomType,
    roomNumber:roomN,
    cashierName,
    cashier_name:cashierName,
    type:"Check In",
    amount:resObj.totalCharge,
    paymentMethod:"Cashless",
    resepsionis: activeUser?.fullname || 'Resepsionis',
    isArchived:false
    };
    if(
    typeof window.handleMidtransPayment
    === "function"
    ){
    resObj.status =
    "PENDING_PAYMENT";
    resObj.paymentMethod =
    "Cashless";
    resObj.paymentStatus =
    "Belum Lunas";
    resObj.amountPaid =
    0;
    window.handleMidtransPayment(
      resObj,
      newTrx,
      assignedRoom,
      assignedRoom,
      roomN,
      resObj.roomType
    );
    return;
    }else{
    alert(
    "Midtrans tidak ditemukan"
    );
    return;
      }
    }
    resObj.status = "CheckedIn";
    resObj.roomNumber = roomN;
    if (needPayment) {
      resObj.paymentMethod = "Cash";
    } else {
      resObj.paymentMethod = "Online Paid";
    }
    resObj.paymentStatus = "Lunas";
    resObj.amountPaid = resObj.totalCharge;
    resObj.checkedInAt =
    new Date().toISOString();
    resObj.updatedAt =
    new Date().toISOString();
    const index =
    reservations.findIndex(r =>
    normalizeOTACode(
      r.id ||
      r.bookingCode
    )
    ===
    normalizeOTACode(
      resObj.id ||
      resObj.bookingCode
    )
    );
    if(index >= 0){
    reservations[index] = {
      ...reservations[index],
      ...resObj
    };
    }
    if (
    resObj.firebaseId &&
    typeof database !== "undefined" &&
    database &&
    database.ref
    ){
    await database
    .ref(`bookings/${resObj.firebaseId}`)
    .update({
      status:"CheckedIn",
      roomNumber:roomN,
      paymentStatus:"Lunas",
      paymentMethod: resObj.paymentMethod,
      checkedInAt:
      resObj.checkedInAt,
      updatedAt:
      resObj.updatedAt
    });
    }
    await upsertReservationToFirebase(
    resObj
    );
    triggerSubRenderers();
    const trxCode = getNextTransactionCode(transactions);
    const cashierName = getActiveCashierName();
    const newTrx = {
    id: trxCode,
    transactionCode: trxCode,
    date: new Date().toISOString(),
    guestName: resObj.guestName,
    roomType: resObj.roomType,
    roomNumber: roomN,
    cashierName,
    cashier_name: cashierName,
    type: 'Check In',
    amount: resObj.totalCharge,
    paymentMethod: resObj.paymentMethod,
    resepsionis:
    activeUser?.fullname|| 'Resepsionis',
    isArchived: false
  };

    transactions.unshift(newTrx);
    saveTransactionToBackend(newTrx);
    syncToLocalStorage();

    alert(`Sukses Pelunasan OTA! Tamu ${resObj.guestName} check-in ke Kamar #${roomN}.`);
    
    document.getElementById('online-booking-code').value = '';
    document.getElementById('online-verified-card').classList.add('hidden');
    
    navigate('dashboard');
  }
}

function processFinalDatabaseInsertion(newRes, newTrx, assignedRoom, activeRoom, roomN, rType) {
  if (activeRoom) {
    activeRoom.status = 'Occupied';
    activeRoom.type = normalizeRoomTypeName(activeRoom.type || rType);
    activeRoom.pricePerNight = Number(activeRoom.pricePerNight || assignedRoom?.pricePerNight || getRoomTypePrice(rType));
  } else if (assignedRoom) {
    activeRoom = {
      id: String(assignedRoom.id || `room-${String(roomN || '').toLowerCase()}`),
      number: roomN,
      floor: Number(assignedRoom.floor || 1),
      type: normalizeRoomTypeName(assignedRoom.type || rType),
      status: 'Occupied',
      pricePerNight: Number(assignedRoom.pricePerNight || assignedRoom.price || getRoomTypePrice(rType)),
      facilities: Array.isArray(assignedRoom.facilities) ? assignedRoom.facilities : []
    };
    rooms.push(activeRoom);
  }

  if (activeRoom?.id && typeof updateRoomStatus === 'function') {
    updateRoomStatus(activeRoom.id, 'Occupied').catch(err => console.warn('Gagal update status kamar ke backend:', err));
  }

  reservations.unshift(newRes);
  transactions.unshift(newTrx);
  saveTransactionToBackend(newTrx);
  upsertReservationToFirebase(newRes).catch(err => console.warn('Gagal sinkron reservasi baru ke Firebase:', err));
}

function normalizeReservationRoomType(roomType){
  if(!roomType){
    return "Standard";
  }
  const value = String(roomType).trim().toLowerCase();
  const match = rooms.find(room => {
  const type =String(room.type || room.name || "").trim() .toLowerCase();
      return (type === value || type.includes(value) || value.includes(type));
    });
  if(match){
    return (
      match.type ||
      match.name
    );

  }
  return roomType;
}

function mapFirebaseBookingToReservation(booking) {
  console.log(
  "🔥 RAW FIREBASE BOOKING:",
  booking
);
  const code = booking.code || booking.bookingCode || booking.otaCode || booking.reservationCode || booking.invoiceCode || booking.id;
  const checkIn = booking.checkIn || booking.checkin || booking.checkInDate || '';
  const checkOut = booking.checkOut || booking.checkout || booking.checkOutDate || '';
  const duration = Number(booking.duration || booking.durationDays || 1) || 1;
  const total = Number(booking.total || booking.totalCharge || booking.subtotal || 0) || 0;
  const roomTypeRaw = booking.roomType || booking.roomName || 'Deluxe';
  const roomType = normalizeReservationRoomType(roomTypeRaw);
  console.log(
 "PAYMENT DIBACA:",
 booking.paymentMethod,
 booking.paymentStatus
);

  return {
    id: normalizeOTACode(code),
    firebaseId: booking.id || booking.bookingId || '',
    bookingCode: normalizeOTACode(code),
    guestName: booking.guestName || booking.customerName || booking.name || '-',
    identityNo: booking.identity || booking.identityNo || '-',
    phone: booking.customerPhone || booking.phone || '-',
    email: booking.customerEmail || booking.email || '-',
    roomType,
    roomNumber: booking.roomNumber || '',
    checkInDate: checkIn,
    checkOutDate: checkOut,
    durationDays: duration,
    totalCharge: total,
    isOnlineBooking: true,
    status: booking.status || 'Confirmed',
    paymentMethod: booking.paymentMethod || booking.paymentSubMethod || 'Online Paid',
    paymentStatus:
  booking.paymentStatus ||
  (
    String(booking.paymentMethod || "")
    .toLowerCase() === "cash"
      ? "Belum Lunas"
      : "Lunas"
  ),
    amountPaid: String(booking.paymentStatus || "" ) .toLowerCase() .includes("belum") ? 0 : total,
    changeAmount: 0
  };
}

async function findBookingInFirebaseOrLocal(code) {
  const cleanCode = normalizeOTACode(code);

  // 1) Firebase langsung dari path bookings
  if (typeof getBookingByCode === 'function') {
    try {
      const result = await withTimeout(getBookingByCode(cleanCode), 8000);
      if (result && result.success && result.booking) {
        return mapFirebaseBookingToReservation(result.booking);
      }
    } catch (err) {
      console.warn('Firebase search gagal / timeout:', err);
    }
  }

  // 2) Fallback manual Firebase, kalau fungsi global tidak terbaca
  if (typeof database !== 'undefined' && database && database.ref) {
    try {
      const snapshot = await withTimeout(database.ref('bookings').once('value'), 8000);
      let found = null;
      snapshot.forEach(child => {
        const booking = { id: child.key, ...child.val() };
        const firebaseCode = normalizeOTACode(
          booking.code || booking.bookingCode || booking.otaCode || booking.reservationCode || booking.invoiceCode
        );
        if (firebaseCode === cleanCode) found = booking;
      });
      if (found) return mapFirebaseBookingToReservation(found);
    } catch (err) {
      console.warn('Manual Firebase search gagal / timeout:', err);
    }
  }

  // 3) Fallback lokal dummy/localStorage
  return reservations.find(r => {
    const localCode = normalizeOTACode(r.id || r.bookingCode || r.code);
    return localCode === cleanCode;
  }) || null;
}

async function handleVerifyOTABooking(event) {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }

  const btn = document.getElementById('verify-booking-btn');
  const input = document.getElementById('online-booking-code');
  const card = document.getElementById('online-verified-card');
  const selectUnit = document.getElementById('online-room-number');
  const originalText = btn ? btn.textContent : 'Verifikasi & Cari Kode';
  const code = normalizeOTACode(input ? input.value : '');

  if (!code) {
    alert('Masukkan kode booking terlebih dahulu!');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Mencari...';
      btn.classList.add('opacity-70', 'cursor-not-allowed');
    }
    if (card) card.classList.add('hidden');

    let res = await findBookingInFirebaseOrLocal(code);

    if (!res) {
      alert('Kode booking tidak ditemukan di Firebase atau data lokal. Pastikan kode sama persis dengan invoice customer.');
      return;
    }

    if (res.status === 'CheckedIn') {
      alert('Kode booking ditemukan, tetapi statusnya sudah Checked-In.');
      return;
    }

    const idx =
    reservations.findIndex(
    r =>
    normalizeOTACode(
      r.id ||
      r.bookingCode ||
      r.code
    )
    === code
    );


    const finalStatus =
    res.status ||
    "Confirmed";


    if(idx >= 0){


    reservations[idx] = {

      ...reservations[idx],
      ...res,
      status:
      finalStatus

    };


    }else{


    reservations.unshift({

      ...res,
      status:
      finalStatus

    });


}

    const activeRes = reservations.find(r => normalizeOTACode(r.id || r.bookingCode || r.code) === code);
    if (!activeRes) {
      alert('Kode booking berhasil dibaca, tetapi gagal dimuat ke data resepsionis.');
      return;
    }

    upsertReservationToFirebase(activeRes).catch(err => console.warn('Gagal sinkron reservasi terverifikasi ke Firebase:', err));

    if (card) card.classList.remove('hidden');
    document.getElementById('verified-guest-name').textContent = activeRes.guestName || '-';
    document.getElementById('verified-guest-phone').textContent = activeRes.phone || '-';
    document.getElementById('verified-room-type').textContent = `${normalizeRoomTypeName(activeRes.roomType) || '-'} Type`;
    document.getElementById('verified-ci-date').textContent = activeRes.checkInDate || '-';
    document.getElementById('verified-co-date').textContent = activeRes.checkOutDate || '-';
    document.getElementById('verified-duration').textContent = activeRes.durationDays || 1;

    if (selectUnit) {
      selectUnit.innerHTML = '';
      const normalizedType = normalizeReservationRoomType(activeRes.roomType || activeRes.roomName);
      const available = rooms.filter(r => r.status === 'Available' && (
        String(r.type).toLowerCase() === normalizedType.toLowerCase() ||
        String(r.type).toLowerCase().includes(normalizedType.toLowerCase()) ||
        normalizedType.toLowerCase().includes(String(r.type).toLowerCase())
      ));
      if (available.length > 0) {
        const opt = document.createElement('option');
        opt.value = available[0].number;
        opt.textContent = `Alokasi otomatis: Lantai ${available[0].number}`;
        selectUnit.appendChild(opt);
      } else {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Kamar penuh untuk kategori ini!';
        selectUnit.appendChild(opt);
      }
    }
      const statusBayar = String(activeRes.paymentStatus || "") .toLowerCase();
      const isPaid = statusBayar === "lunas";
      const paymentDisplay = document.getElementById("payment-calc-subtotal");
      if (paymentDisplay) {
        paymentDisplay.textContent =
          isPaid
            ? "LUNAS DI OTA"
            : formatCurrency(
                activeRes.totalCharge
              );
      }
      const paymentMethodLabel = document.getElementById( "online-payment-status");
      if (paymentMethodLabel) {
    paymentMethodLabel.value =
      isPaid
        ? "Lunas (OTA Paid)"
        : "Cash (Bayar di Resepsionis)";
      }
    // ambil UI dari index.html
const paymentOption =
  document.getElementById(
    "payment-options-block"
  );


// kalau OTA sudah dibayar midtrans
if(isPaid){

  // sembunyikan pilihan cash/cashless
  if(paymentOption){
    paymentOption.classList.add(
      "hidden"
    );
  }


}else{


  // OTA cash belum bayar
  // munculkan pilihan pembayaran resepsionis
  if(paymentOption){
    paymentOption.classList.remove(
      "hidden"
    );
  }


}
    alert('Kode booking ditemukan. Kamar akan dialokasikan otomatis dari inventaris admin saat tombol diproses.');
  } catch (error) {
    console.error('Error verifikasi kode booking:', error);
    alert('Gagal mencari kode booking: ' + (error.message || error));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalText || 'Verifikasi & Cari Kode';
      btn.classList.remove('opacity-70', 'cursor-not-allowed');
    }
  }
}

// C. Settle checkout and penalty releases
function executeCompleteCheckout() {
  const roomN = document.getElementById('checkout-room-select').value;
  if (!roomN) {
    alert('Pilih nomor kamar terlebih dahulu!');
    return;
  }

  // Find active occupier
  const activeRes = reservations.find(r => r.roomNumber === roomN && r.status === 'CheckedIn');
  if (!activeRes) return;

  const lateInput = document.getElementById('checkout-surcharge-late');
  const damageInput = document.getElementById('checkout-surcharge-damage');
  const latePenalty = parseInt(lateInput?.dataset?.penaltyAmount || '0', 10) || 0;
  const damagePenalty = parseInt(damageInput?.dataset?.penaltyAmount || '0', 10) || 0;
  const late = lateInput?.checked ? latePenalty : 0;
  const mini = parseInt(document.getElementById('checkout-surcharge-minibar').value) || 0;
  const dmg = damageInput?.checked ? damagePenalty : 0;
  const remarks = document.getElementById('checkout-remarks').value.trim();
  const payMethod = document.querySelector('input[name="checkout-payment-method"]:checked').value;

  const extrasSum = late + mini + dmg;

  // Settle room to Available
  const roomObj = rooms.find(r => r.number === roomN);
  if (roomObj) roomObj.status = 'Available';
  if (roomObj?.id && typeof updateRoomStatus === 'function') {
    updateRoomStatus(roomObj.id, 'Available').catch(err => console.warn('Gagal update status checkout ke backend:', err));
  }

  // Set reservation to CheckedOut
  activeRes.status = 'CheckedOut';
  upsertReservationToFirebase(activeRes).catch(err => console.warn('Gagal sinkron status checkout ke Firebase:', err));

  // Push new transaction financial log if surcharges are present, otherwise log exit zero
  const trxCode = getNextTransactionCode(transactions);
  const cashierName = getActiveCashierName();
  const newTrx = {
    id: trxCode,
    transactionCode: trxCode,
    date: new Date().toISOString(),
    guestName: activeRes.guestName,
    roomType: activeRes.roomType,
    roomNumber: roomN,
    cashierName,
    cashier_name: cashierName,
    type: 'Check Out',
    amount: extrasSum,
    paymentMethod: payMethod,
    resepsionis: activeUser.fullname,
    isArchived: false
  };

  transactions.unshift(newTrx);
  saveTransactionToBackend(newTrx);
  triggerSubRenderers();

  alert(`Checkout berhasil! Kamar ${roomN} dikembalikan statusnya ke Tersedia.`);
  
  // Clear forms
  if (lateInput) lateInput.checked = false;
  document.getElementById('checkout-surcharge-minibar').value = '0';
  if (damageInput) damageInput.checked = false;
  document.getElementById('checkout-remarks').value = '';

  // Show thermal receipt in transaction view after auto navigation
  navigate('history');
  showThermalReceiptSimulator(newTrx.id);
}

// D. Add dynamic reservations from receptionist
async function handleAddReservationSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('modal-add-res-name').value.trim();
  const identity = document.getElementById('modal-add-res-identity').value.trim();
  const phone = document.getElementById('modal-add-res-phone').value.trim();
  const email = document.getElementById('modal-add-res-email').value.trim();
  const roomType = document.getElementById('modal-add-res-room-type').value;
  const ci = document.getElementById('modal-add-res-ci').value;
  const co = document.getElementById('modal-add-res-co').value;
  const duration = calculateStayDurationDays(ci, co);
  const isOnline = document.querySelector('input[name="modal-add-res-cat"]:checked').value === 'Online';

  if (duration <= 0) {
    alert('Tanggal check-out harus setelah tanggal check-in.');
    return;
  }

  const activeGuestLookup = await findActiveCheckInByIdentityOrPhone(identity, phone);
  if (activeGuestLookup && activeGuestLookup.booking) {
    alert('Tamu dengan KTP / NID / Paspor atau No. Kontak ini sudah check-in di kamar lain dan belum melakukan Check-Out!');
    return;
  }

  const rate = getRoomTypePrice(roomType);
  const total = rate * duration;

  // Online code starts with PITU-, walkin with RES-
  const bookId = isOnline ? 'PITU-' + Math.floor(1000 + Math.random() * 9000) : 'RES-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  const newRes = {
    id: bookId,
    guestName: name,
    identityNo: identity,
    phone: phone,
    email: email,
    roomType: roomType,
    roomNumber: '',
    checkInDate: ci,
    checkOutDate: co,
    durationDays: duration,
    totalCharge: total,
    isOnlineBooking: isOnline,
    status: 'Confirmed'
  };

  reservations.unshift(newRes);
  upsertReservationToFirebase(newRes).catch(err => console.warn('Gagal sinkron reservasi baru ke Firebase:', err));

  alert(`Reservasi Baru Terbentuk! ID Booking: ${bookId}`);
  document.getElementById('modal-add-res-form').reset();
  document.getElementById('modal-add-reservation').classList.add('hidden');

  triggerSubRenderers();
}

// E. Edit reservations from Admin
async function handleEditReservationSubmit(e) {
  e.preventDefault();

  const resId = document.getElementById('modal-edit-id-field').value;
  const targetRes = reservations.find(r => r.id === resId);
  if (!targetRes) return;

  const oNo = targetRes.roomNumber;
  const nextGuestName = document.getElementById('modal-edit-res-name').value.trim();
  const nextIdentity = document.getElementById('modal-edit-res-identity').value.trim();
  const nextPhone = document.getElementById('modal-edit-res-phone').value.trim();
  const nextEmail = document.getElementById('modal-edit-res-email').value.trim();
  const nextRoomType = document.getElementById('modal-edit-res-room-type').value;
  const nextCheckIn = document.getElementById('modal-edit-res-ci').value;
  const nextCheckOut = document.getElementById('modal-edit-res-co').value;
  const nextDuration = calculateStayDurationDays(nextCheckIn, nextCheckOut);

  if (nextDuration <= 0) {
    alert('Tanggal check-out harus setelah tanggal check-in.');
    return;
  }

  const nextStatus = document.getElementById('modal-edit-res-status').value;
  if (nextStatus === 'CheckedIn') {
    const activeGuestLookup = await findActiveCheckInByIdentityOrPhone(nextIdentity, nextPhone, targetRes.id);
    if (activeGuestLookup && activeGuestLookup.booking) {
      alert('Tamu dengan KTP / NID / Paspor atau No. Kontak ini sudah check-in di kamar lain dan belum melakukan Check-Out!');
      return;
    }
  }
  
  const nNo = document.getElementById('modal-edit-res-room-number').value.trim();
  targetRes.guestName = nextGuestName;
  targetRes.identityNo = nextIdentity;
  targetRes.phone = nextPhone;
  targetRes.email = nextEmail;
  targetRes.roomType = nextRoomType;
  targetRes.checkInDate = nextCheckIn;
  targetRes.checkOutDate = nextCheckOut;
  targetRes.durationDays = nextDuration;
  targetRes.roomNumber = nNo;
  targetRes.status = nextStatus;

  const rate = getRoomTypePrice(targetRes.roomType);
  targetRes.totalCharge = rate * targetRes.durationDays;

  // Synchronize room occupancy states if room assignment changes or status turns CheckedIn
  if (targetRes.status === 'CheckedIn' && nNo) {
    const roomObj = rooms.find(r => r.number === nNo);
    if (roomObj) roomObj.status = 'Occupied';
  } else if (targetRes.status === 'CheckedOut' && nNo) {
    const roomObj = rooms.find(r => r.number === nNo);
    if (roomObj) roomObj.status = 'Available';
  }

  // Free older room if updated
  if (oNo && oNo !== nNo) {
    const oldRm = rooms.find(r => r.number === oNo);
    if (oldRm) oldRm.status = 'Available';
  }

  syncToLocalStorage();
  upsertReservationToFirebase(targetRes).catch(err => console.warn('Gagal sinkron perubahan reservasi ke Firebase:', err));
  alert(`Booking rincian #${resId} berhasil diperbarui!`);
  
  document.getElementById('modal-edit-reservation').classList.add('hidden');
  triggerSubRenderers();
}

async function getRefundPolicyPercentage() {
  return Number.isFinite(currentRefundPolicyPercentage) && currentRefundPolicyPercentage >= 0 && currentRefundPolicyPercentage <= 100
    ? currentRefundPolicyPercentage
    : 50;
}

function getReservationRefundBaseAmount(reservation) {
  const amountPaid = Number(reservation?.amountPaid || 0);
  if (Number.isFinite(amountPaid) && amountPaid > 0) return amountPaid;

  const totalCharge = Number(reservation?.totalCharge || 0);
  if (Number.isFinite(totalCharge) && totalCharge > 0) return totalCharge;

  const bookingId = String(reservation?.id || '').trim();
  const roomNumber = String(reservation?.roomNumber || '').trim();
  const guestName = String(reservation?.guestName || '').trim().toLowerCase();

  const match = (Array.isArray(transactions) ? transactions : []).find(trx => {
    const type = String(trx?.type || '').trim().toLowerCase();
    const isIncomeLike = type.includes('check in') || type.includes('check-in') || type.includes('pelunasan');
    if (!isIncomeLike) return false;

    const trxBookingId = String(trx?.bookingId || '').trim();
    if (bookingId && trxBookingId && trxBookingId === bookingId) return true;

    const sameGuest = String(trx?.guestName || '').trim().toLowerCase() === guestName;
    const sameRoom = roomNumber && String(trx?.roomNumber || '').trim() === roomNumber;
    return sameGuest && Boolean(sameRoom);
  });

  const trxAmount = Number(match?.amount || 0);
  if (Number.isFinite(trxAmount) && trxAmount > 0) return trxAmount;

  return 0;
}

async function setReservationCancelledInFirestore(reservation, refundPercent, refundAmount) {
  if (typeof firestore === 'undefined' || !firestore || typeof firestore.collection !== 'function') {
    return;
  }

  const docId = String(reservation?.id || '').trim();
  if (!docId) return;

  const payload = {
    status: 'CANCELLED',
    refundPercent,
    refundAmount,
    cancelledAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const docRef = firestore.collection('reservations').doc(docId);
  try {
    await docRef.update(payload);
  } catch (error) {
    await docRef.set(payload, { merge: true });
  }
}

async function setReservationCancelledInRealtimeDatabase(reservation, refundPercent, refundAmount) {
  if (typeof database === 'undefined' || !database || typeof database.ref !== 'function') {
    return;
  }

  const bookingId = String(reservation?.firebaseId || reservation?.id || '').trim();
  if (!bookingId) return;

  try {
    await database.ref(`bookings/${bookingId}`).update({
      status: 'CANCELLED',
      refundPercent,
      refundAmount,
      cancelledAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Gagal update status CANCELLED ke Realtime Database:', error);
  }
}

async function addRefundLedgerLog(reservation, refundPercent, refundAmount) {
  const trxCode = getNextTransactionCode(transactions);
  const cashierName = getActiveCashierName();
  const negativeRefund = -Math.abs(Number(refundAmount) || 0);

  const refundTransaction = {
    id: trxCode,
    bookingId: reservation.id,
    transactionCode: trxCode,
    date: new Date().toISOString(),
    guestName: reservation.guestName,
    roomType: reservation.roomType,
    roomNumber: reservation.roomNumber || '-',
    cashierName,
    cashier_name: cashierName,
    type: 'REFUND CANCEL',
    amount: negativeRefund,
    paymentMethod: 'Refund',
    resepsionis: activeUser?.fullname || cashierName || 'Sistem',
    notes: `Pembatalan reservasi ${reservation.id} (refund ${refundPercent}%)`,
    isArchived: false
  };

  transactions.unshift(refundTransaction);
  syncToLocalStorage();
  saveTransactionToBackend(refundTransaction);

  if (typeof firestore !== 'undefined' && firestore && typeof firestore.collection === 'function') {
    try {
      await firestore.collection('ledger_logs').add({
        ...refundTransaction,
        id: undefined,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.warn('Gagal menambah addDoc ledger_logs refund:', error);
    }
  }
}

async function handleCancelReservation(resId) {
  const reservation = reservations.find(r => r.id === resId);
  if (!reservation) {
    alert('Reservasi tidak ditemukan atau sudah berubah.');
    return;
  }

  if (String(reservation.status || '').toUpperCase() === 'CANCELLED') {
    alert('Reservasi ini sudah berstatus CANCELLED.');
    return;
  }

  const refundPercent = await getRefundPolicyPercentage();
  const paidAmountBase = getReservationRefundBaseAmount(reservation);

  if (paidAmountBase <= 0 && refundPercent > 0) {
    alert('Data pembayaran reservasi tidak ditemukan, refund tidak dapat dihitung otomatis.');
    return;
  }

  const refundAmount = Math.round((refundPercent / 100) * paidAmountBase);
  const confirmationText = `Apakah Anda yakin ingin membatalkan reservasi ini? Berdasarkan kebijakan Admin (Kembali ${refundPercent}%), dana cash yang wajib dikembalikan ke tamu adalah: ${formatIDR(refundAmount)}`;
  const approved = confirm(confirmationText);
  if (!approved) return;

  try {
    reservation.status = 'CANCELLED';

    if (reservation && reservation.roomNumber) {
      const room = rooms.find(r => r.number === reservation.roomNumber);
      if (room) {
        room.status = 'Available';
        if (room.id && typeof updateRoomStatus === 'function') {
          await updateRoomStatus(room.id, 'Available');
        }
      }
    }

    await setReservationCancelledInFirestore(reservation, refundPercent, refundAmount);
    await setReservationCancelledInRealtimeDatabase(reservation, refundPercent, refundAmount);
    await upsertReservationToFirebase(reservation);
    await addRefundLedgerLog(reservation, refundPercent, refundAmount);

    triggerSubRenderers();

    if (typeof syncFinanceTransactionsFromBackend === 'function') {
      syncFinanceTransactionsFromBackend();
    }

    alert('Reservasi berhasil dibatalkan. Log REFUND CANCEL telah tercatat di ledger.');
  } catch (error) {
    console.error('Gagal membatalkan reservasi:', error);
    alert(`Pembatalan reservasi gagal: ${error?.message || error}`);
  }
}

function handleResetCheckOutData() {
  const confirmationPhrase = 'HAPUS DATA CHECKOUT PERMANEN';
  const userInput = prompt(`Ketik "${confirmationPhrase}" untuk mengkonfirmasi penghapusan semua data checkout.\n\nPerhatian: Tindakan ini TIDAK BISA DIBATALKAN!`);

  if (userInput === null) {
    return;
  }

  if (userInput !== confirmationPhrase) {
    alert('Verifikasi gagal. Teks yang Anda ketik tidak sesuai. Proses penghapusan dibatalkan.');
    return;
  }

  // Identify reservations to delete (normalize status: uppercase + remove spaces)
  const toDelete = reservations.filter(res => {
    const normalizedStatus = String(res.status || '').toUpperCase().replace(/\s/g, '');
    return normalizedStatus === 'CHECKEDOUT' || normalizedStatus === 'CHECKED_OUT' || normalizedStatus === 'CHECKOUT' || normalizedStatus === 'CANCELLED';
  });

  // Delete from Firebase Cloud Database
  if (toDelete.length > 0) {
    toDelete.forEach(res => {
      const resId = String(res.id || '').trim();
      if (!resId) return;

      // Delete from Realtime Database
      if (typeof database !== 'undefined' && database && typeof database.ref === 'function') {
        database.ref(`reservations/${resId}`).remove()
          .catch(err => console.warn(`Gagal hapus reservasi ${resId} dari Realtime DB:`, err));
      }

      // Delete from Firestore
      if (typeof firestore !== 'undefined' && firestore && typeof firestore.collection === 'function') {
        firestore.collection('reservations').doc(resId).delete()
          .catch(err => console.warn(`Gagal hapus reservasi ${resId} dari Firestore:`, err));
      }

      // Delete from bookings collection (if exists)
      if (typeof firestore !== 'undefined' && firestore && typeof firestore.collection === 'function') {
        firestore.collection('bookings').doc(resId).delete()
          .catch(err => console.warn(`Gagal hapus booking ${resId} dari Firestore:`, err));
      }
    });
  }

  // Update local state
  const initialCount = reservations.length;
  reservations = reservations.filter(res => {
    const normalizedStatus = String(res.status || '').toUpperCase().replace(/\s/g, '');
    return normalizedStatus !== 'CHECKEDOUT' && normalizedStatus !== 'CHECKED_OUT' && normalizedStatus !== 'CHECKOUT' && normalizedStatus !== 'CANCELLED';
  });
  const deletedCount = initialCount - reservations.length;

  // Sync to local storage and trigger re-render
  syncToLocalStorage();
  triggerSubRenderers();

  alert(`Data checkout berhasil dibersihkan! Total data yang dihapus: ${deletedCount} reservasi.`);
}



function populateAddRoomForm(room) {
  const typeInput = document.getElementById('add-room-type');
  const floorCountInput = document.getElementById('add-room-floor-count');
  const roomsPerFloorInput = document.getElementById('add-room-per-floor');
  const prefixInput = document.getElementById('add-room-prefix');
  const roomNumberInput = document.getElementById('add-room-number');
  const numberStepInput = document.getElementById('add-room-number-step');
  const statusInput = document.getElementById('add-room-status');
  const priceInput = document.getElementById('add-room-price');
  const lateFeeInput = document.getElementById('add-room-late-fee');
  const minibarFeeInput = document.getElementById('add-room-minibar-fee');
  const damageFeeInput = document.getElementById('add-room-damage-fee');
  const editIdInput = document.getElementById('add-room-edit-id');
  const heading = document.getElementById('add-room-form-heading');
  const submitLabel = document.getElementById('add-room-submit-label');
  const cancelButton = document.getElementById('cancel-room-edit');
  const runModeDesc = document.getElementById('add-room-form-description');

  const selectedFacilities = Array.isArray(room?.facilities) ? room.facilities.map(f => String(f || '').trim()) : [];
  renderDynamicFacilitiesOptions();

  if (room) {
    editIdInput.value = room.id;
    typeInput.value = room.type || 'JI-Careless Whisper';
    floorCountInput.value = room.floor || 1;
    roomsPerFloorInput.value = 1;
    prefixInput.value = room.number ? room.number.charAt(0).toUpperCase() : 'D';
    roomNumberInput.value = room.number ? parseInt(room.number.slice(1), 10) || 101 : 101;
    numberStepInput.value = 1;
    statusInput.value = room.status || 'Available';
    priceInput.value = formatIDRInputValue(room.pricePerNight || 850000);
    if (lateFeeInput) lateFeeInput.value = formatIDRInputValue(room.lateCheckoutPenalty || 0) || 'Rp 0';
    if (minibarFeeInput) minibarFeeInput.value = formatIDRInputValue(room.miniBarPenalty || 0) || 'Rp 0';
    if (damageFeeInput) damageFeeInput.value = formatIDRInputValue(room.damagePenalty || 0) || 'Rp 0';
    document.querySelectorAll('input[name="room-facility"]').forEach(cb => {
      cb.checked = selectedFacilities.includes(String(cb.value || '').trim());
    });
    heading.textContent = 'Edit Kamar';
    runModeDesc.textContent = 'Perbarui detail kamar di inventory ini menggunakan formulir yang sama.';
    submitLabel.textContent = 'Simpan Perubahan Kamar';
    cancelButton.classList.remove('hidden');
  } else {
    editIdInput.value = '';
    typeInput.value = 'JI-Careless Whisper';
    floorCountInput.value = 1;
    roomsPerFloorInput.value = 1;
    prefixInput.value = 'D';
    roomNumberInput.value = 101;
    numberStepInput.value = 1;
    statusInput.value = 'Available';
    priceInput.value = formatIDRInputValue(850000);
    if (lateFeeInput) lateFeeInput.value = 'Rp 0';
    if (minibarFeeInput) minibarFeeInput.value = 'Rp 0';
    if (damageFeeInput) damageFeeInput.value = 'Rp 0';
    document.querySelectorAll('input[name="room-facility"]').forEach(cb => cb.checked = false);
    heading.textContent = 'Buat Kamar Baru';
    runModeDesc.textContent = 'Bulk, custom prefix, dan fasilitas kamar bisa diatur dari sini.';
    submitLabel.textContent = 'Daftarkan Unit Kamar →';
    cancelButton.classList.add('hidden');
  }
}

function resetAddRoomForm() {
  populateAddRoomForm(null);
}

// F. Admin Room Creation form
function handleAddRoom(e) {
  e.preventDefault();

  if (activeUser?.role !== 'Admin') {
    alert('Hanya admin yang dapat mengatur inventaris kamar dan fasilitas.');
    return;
  }

  const editId = document.getElementById('add-room-edit-id')?.value;
  const type = document.getElementById('add-room-type')?.value.trim() || 'JI-Careless Whisper';
  const price = parseIDRCurrencyInput(document.getElementById('add-room-price').value);
  const lateCheckoutPenalty = parseIDRCurrencyInput(document.getElementById('add-room-late-fee')?.value || '0');
  const miniBarPenalty = parseIDRCurrencyInput(document.getElementById('add-room-minibar-fee')?.value || '0');
  const damagePenalty = parseIDRCurrencyInput(document.getElementById('add-room-damage-fee')?.value || '0');
  const status = document.getElementById('add-room-status').value;
  const floorCount = parseInt(document.getElementById('add-room-floor-count')?.value) || 1;
  const roomsPerFloor = parseInt(document.getElementById('add-room-per-floor')?.value) || 1;
  const prefix = (document.getElementById('add-room-prefix')?.value || 'D').trim().toUpperCase();
  const startNumber = parseInt(document.getElementById('add-room-number')?.value) || 101;
  const step = parseInt(document.getElementById('add-room-number-step')?.value) || 1;
  const facilities = Array.from(document.querySelectorAll('input[name="room-facility"]:checked')).map(cb => cb.value);

  if (price <= 0) {
    alert('Tarif kamar harus lebih dari 0 dan dalam format Rupiah yang valid.');
    return;
  }

  const roomCode = `${prefix}${startNumber}`;

  if (editId) {
    const room = rooms.find(r => r.id === editId);
    if (!room) {
      alert('Data kamar tidak ditemukan. Silakan muat ulang halaman.');
      resetAddRoomForm();
      return;
    }

    if (rooms.some(r => r.number === roomCode && r.id !== editId)) {
      alert('Nomor kamar sudah digunakan oleh unit lain. Silakan pilih nomor berbeda.');
      return;
    }

    const oldNumber = room.number;
    const oldType = room.type;

    room.number = roomCode;
    room.type = normalizeRoomTypeName(type);
    room.floor = floorCount;
    room.status = status;
    room.pricePerNight = price;
    room.lateCheckoutPenalty = lateCheckoutPenalty;
    room.miniBarPenalty = miniBarPenalty;
    room.damagePenalty = damagePenalty;
    room.facilities = facilities;

    reservations.forEach(reservation => {
      if (reservation.roomNumber === oldNumber) {
        reservation.roomNumber = room.number;
      }
      if (reservation.roomType === oldType) {
        reservation.roomType = room.type;
      }
    });

    transactions.forEach(transaction => {
      if (transaction.roomNumber === oldNumber) {
        transaction.roomNumber = room.number;
      }
      if (transaction.roomType === oldType) {
        transaction.roomType = room.type;
      }
    });

    syncToLocalStorage();
    upsertRoomToFirebase(room).catch(err => console.warn('Gagal sinkron edit room ke Firebase:', err));
    alert(`Perubahan kamar ${room.number} berhasil disimpan.`);
    resetAddRoomForm();
    triggerSubRenderers();
    return;
  }

  let createdCount = 0;
  let currentNumber = startNumber;
  const shouldBulkCreate = roomsPerFloor > 1;
  const targetFloorCount = shouldBulkCreate ? floorCount : 1;

  for (let floor = 1; floor <= targetFloorCount; floor++) {
    for (let index = 1; index <= roomsPerFloor; index++) {
      const roomCode = `${prefix}${currentNumber}`;
      const cleanType = String(type || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const newId = `${cleanType || 'room'}-${roomCode.toLowerCase()}`;

      if (rooms.some(r => r.number === roomCode)) {
        currentNumber += step;
        continue;
      }

      rooms.push({
        id: newId,
        number: roomCode,
        floor: shouldBulkCreate ? floor : floorCount,
        type: type,
        status: status,
        pricePerNight: price,
        lateCheckoutPenalty,
        miniBarPenalty,
        damagePenalty,
        facilities: facilities
      });
      createdCount += 1;
      currentNumber += step;
    }
  }

  if (!createdCount) {
    alert('Tidak ada unit kamar baru yang bisa dibuat. Coba ubah prefix atau nomor awal.');
    return;
  }

  syncToLocalStorage();
  syncAllLocalRoomsToFirebase().catch(err => console.warn('Gagal sinkron room baru ke Firebase:', err));
  alert(`${createdCount} unit kamar (${type}) berhasil ditambahkan ke inventaris hotel.`);
  resetAddRoomForm();
  triggerSubRenderers();
}

// G. Admin Users accounts additions or edits CRUD
function handleAdminUserSubmit(e) {
  e.preventDefault();

  const editId = document.getElementById('admin-user-edit-id').value;
  const fullname = document.getElementById('admin-user-fullname').value.trim();
  const username = document.getElementById('admin-user-username').value.trim();
  const password = document.getElementById('admin-user-password').value.trim();
  const role = document.querySelector('input[name="admin-user-role"]:checked').value;

  let savedUser = null;

  if (editId) {
    // Edit flow
    const user = users.find(u => u.id === editId);
    if (user) {
      user.fullname = fullname;
      user.username = username;
      user.password = password;
      user.role = role;
      savedUser = user;
    }
  } else {
    // Add flow
    if (users.some(u => u.username === username)) {
      alert('Username tersebut sudah digunakan oleh akun karyawan lain!');
      return;
    }
    const newId = 'usr_' + Math.random().toString(36).substring(2, 6);
    savedUser = {
      id: newId,
      fullname: fullname,
      username: username,
      password: password,
      role: role
    };
    users.push(savedUser);
  }

  if (savedUser) {
    upsertStaffAccountToFirebase(savedUser).catch(err => console.warn('Gagal sinkron akun staf ke Firebase:', err));
  }

  alert('Data pengguna berhasil didaftarkan / disinkronkan.');
  document.getElementById('admin-user-form').reset();
  cleanUserForms();
  triggerSubRenderers();
}

function deleteAdminUser(id) {
  if (id === activeUser.id) {
    alert('Anda dilarang menghapus akun log-In Anda sendiri yang sedang aktif di loket!');
    return;
  }
  if (confirm('Apakah Anda yakin ingin meluncurkan penghapusan permanen akun staf?')) {
    users = users.filter(u => u.id !== id);
    deleteStaffAccountFromFirebase(id).catch(err => console.warn('Gagal hapus akun staf dari Firebase:', err));
    triggerSubRenderers();
  }
}

function formatTransactionDateTimeForExport(trx) {
  const raw = trx?.date || trx?.timestamp || trx?.createdAt;
  if (!raw) return '-';

  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return String(raw);

  return dt.toLocaleString('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function sanitizeExcelNumericText(value) {
  const plain = String(value || '').trim();
  if (!plain) return '';
  return `'${plain.replace(/^'+/, '')}`;
}

function formatRupiahText(amount) {
  return Number(amount || 0).toLocaleString('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  });
}

function escapeCsvCell(value) {
  const stringValue = String(value ?? '').replace(/"/g, '""');
  return `"${stringValue}"`;
}

function downloadFinanceCsvBackup(rows) {
  const headers = ['Kode TRX', 'Waktu/Tanggal', 'Nama Tamu', 'Kamar', 'Aktivitas', 'User', 'Nominal', 'Metode Pembayaran'];
  const csvRows = [headers.map(escapeCsvCell).join(',')];

  rows.forEach(trx => {
    const csvRow = [
      trx.transactionCode || trx.id || '-',
      formatTransactionDateTimeForExport(trx),
      trx.guestName || '-',
      trx.roomNumber ? `Kamar ${trx.roomNumber}` : '-',
      trx.type || '-',
      trx.cashierName || trx.cashier_name || trx.resepsionis || '-',
      Number(trx.amount || 0),
      trx.paymentMethod || '-'
    ];

    csvRows.push(csvRow.map(escapeCsvCell).join(','));
  });

  const csvContent = `\uFEFF${csvRows.join('\n')}`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const fileName = `Piturooms_Backup_Transaksi_${new Date().toISOString().slice(0, 10)}.csv`;
  const downloadUrl = URL.createObjectURL(blob);

  const tempLink = document.createElement('a');
  tempLink.href = downloadUrl;
  tempLink.download = fileName;
  document.body.appendChild(tempLink);
  tempLink.click();
  tempLink.remove();

  URL.revokeObjectURL(downloadUrl);
}

function openFinanceResetModal() {
  const modal = document.getElementById('modal-reset-finance');
  const challengeInput = document.getElementById('input-challenge');
  const passwordInput = document.getElementById('input-admin-password');
  const submitBtn = document.getElementById('btn-submit-reset');

  if (!modal || !challengeInput || !passwordInput || !submitBtn) return;

  challengeInput.value = '';
  passwordInput.value = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Unduh Backup & Reset';

  modal.classList.remove('hidden');
  challengeInput.focus();
}

function closeFinanceResetModal() {
  const modal = document.getElementById('modal-reset-finance');
  if (!modal) return;
  modal.classList.add('hidden');
}

function updateResetChallengeValidation() {
  const challengeInput = document.getElementById('input-challenge');
  const submitBtn = document.getElementById('btn-submit-reset');
  if (!challengeInput || !submitBtn) return;

  submitBtn.disabled = challengeInput.value !== 'RESET DATA PITUROOMS';
}

function findReservationForTransaction(trx) {
  return reservations.find(res => {
    const sameGuest = String(res.guestName || '').trim().toLowerCase() === String(trx.guestName || '').trim().toLowerCase();
    const sameRoom = String(res.roomNumber || '').trim() && String(res.roomNumber || '').trim() === String(trx.roomNumber || '').trim();
    return sameGuest || sameRoom;
  }) || null;
}

function normalizeActiveTransactionPayload(rawTransaction) {
  const internalCode = String(
    rawTransaction.transactionCode
      || rawTransaction.kodeTrx
      || rawTransaction.code
      || ''
  ).trim();

  const fallbackFromId = /^TRX\d{3,}$/i.test(String(rawTransaction.id || '').trim())
    ? String(rawTransaction.id).trim().toUpperCase()
    : '';

  return {
    ...rawTransaction,
    id: rawTransaction.id || rawTransaction.transactionId || '-',
    transactionCode: internalCode || fallbackFromId,
    date: rawTransaction.date || rawTransaction.timestamp || rawTransaction.createdAt || new Date().toISOString(),
    guestName: rawTransaction.guestName || rawTransaction.customerName || '-',
    roomNumber: rawTransaction.roomNumber || rawTransaction.room || '-',
    cashierName: rawTransaction.cashierName || rawTransaction.cashier_name || rawTransaction.resepsionis || rawTransaction.processedBy || '-',
    type: rawTransaction.type || rawTransaction.activity || '-',
    amount: Number(rawTransaction.amount || rawTransaction.total || 0),
    paymentMethod: rawTransaction.paymentMethod || rawTransaction.method || '-'
  };
}

async function saveTransactionToBackend(trx) {
  if (typeof recordTransaction !== 'function') return;

  try {
    const cashierName = trx.cashierName || trx.cashier_name || getActiveCashierName();

    await recordTransaction({
      bookingId: trx.bookingId || trx.id || '',
      transactionCode: trx.transactionCode || trx.id || '',
      guestName: trx.guestName || '',
      roomType: trx.roomType || '',
      roomNumber: trx.roomNumber || '',
      cashierName,
      cashier_name: cashierName,
      type: trx.type || '',
      amount: Number(trx.amount || 0),
      paymentMethod: trx.paymentMethod || '',
      processedBy: trx.resepsionis || cashierName || activeUser?.fullname || 'Sistem',
      date: trx.date || new Date().toISOString(),
      notes: trx.notes || '',
      isArchived: false
    });
  } catch (err) {
    console.warn('Gagal sinkronkan transaksi ke backend:', err);
  }
}

async function getActiveTransactionsForFinance() {
  let backendTransactions = [];

  if (typeof fetchActiveTransactions === 'function') {
    try {
      const result = await fetchActiveTransactions();
      if (result && result.success && Array.isArray(result.transactions)) {
        backendTransactions = applySequentialTransactionCodes(result.transactions.map(normalizeActiveTransactionPayload));
      }
    } catch (err) {
      console.warn('fetchActiveTransactions gagal, fallback ke state lokal:', err);
    }
  }

  if (backendTransactions.length > 0) {
    return backendTransactions;
  }

  return transactions
    .filter(trx => trx && trx.isArchived !== true)
    .map(normalizeActiveTransactionPayload)
    .map(trx => ({
      ...trx,
      transactionCode: trx.transactionCode || ''
    }));
}

async function syncFinanceTransactionsFromBackend() {
  if (typeof fetchActiveTransactions !== 'function') return;

  try {
    const result = await fetchActiveTransactions();
    if (!result || !result.success || !Array.isArray(result.transactions)) return;

    const backendRows = result.transactions.map(normalizeActiveTransactionPayload);
    if (!backendRows.length) {
      transactions = [];

      if (currentMenu === 'adminGuests') {
        renderAdminGuests();
      } else if (currentMenu === 'history') {
        renderHistory();
      }
      return;
    }

    const mergedMap = new Map();
    transactions.forEach(trx => {
      if (!trx || !trx.id) return;
      mergedMap.set(String(trx.id), { ...trx });
    });

    backendRows.forEach(trx => {
      const key = String(trx.id || '').trim();
      if (!key) return;
      const previous = mergedMap.get(key) || {};

      mergedMap.set(key, {
        ...previous,
        ...trx,
        id: key,
        isArchived: false
      });
    });

    transactions = Array.from(mergedMap.values()).sort((a, b) => {
      const aTime = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
      const bTime = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    transactions = applySequentialTransactionCodes(transactions);

    syncToLocalStorage();

    if (currentMenu === 'adminGuests') {
      renderAdminGuests();
    } else if (currentMenu === 'history') {
      renderHistory();
    }
  } catch (err) {
    console.warn('Sinkronisasi transaksi backend gagal:', err);
  }
}

async function handleExportFinanceXlsx() {
  if (typeof XLSX === 'undefined') {
    alert('Library SheetJS (XLSX) belum termuat. Periksa koneksi internet lalu coba lagi.');
    return;
  }

  const activeTransactions = await getActiveTransactionsForFinance();
  if (!activeTransactions.length) {
    alert('Tidak ada transaksi aktif untuk diunduh.');
    return;
  }

  const exportRows = activeTransactions.map((trx, index) => {
    const relatedReservation = findReservationForTransaction(trx);
    const identityNo = sanitizeExcelNumericText(relatedReservation?.identityNo || relatedReservation?.identity || relatedReservation?.nik || '-');
    const phoneNo = sanitizeExcelNumericText(relatedReservation?.phone || relatedReservation?.customerPhone || relatedReservation?.phoneNumber || '-');

    return {
      'No': index + 1,
      'Kode TRX': trx.transactionCode || trx.id,
      'Waktu/Tanggal': formatTransactionDateTimeForExport(trx),
      'Nama Tamu': trx.guestName,
      'NIK': identityNo,
      'No.HP': phoneNo,
      'Kamar': trx.roomNumber ? `Kamar ${trx.roomNumber}` : '-',
      'Aktivitas': trx.type,
      'Nominal': formatRupiahText(trx.amount),
      'Metode Pembayaran': trx.paymentMethod
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Riwayat Keuangan');

  const currentDate = new Date();
  const monthName = currentDate.toLocaleString('id-ID', { month: 'long' });
  const year = currentDate.getFullYear();
  const monthCapitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const filename = `Piturooms_Backup_${monthCapitalized}_${year}.xlsx`;

  XLSX.writeFile(workbook, filename);
  alert(`Laporan transaksi berhasil diunduh: ${filename}`);
}

async function simpanKebijakanRefund() {
  const input = document.getElementById('input-refund-percentage');
  if (!input) return;

  const rawValue = String(input.value || '').trim();
  if (rawValue === '') {
    alert('Persentase refund tidak boleh kosong.');
    return;
  }

  const percentage = Number(rawValue);
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    alert('Persentase refund harus angka antara 0 sampai 100.');
    return;
  }

  if (typeof firestore === 'undefined' || !firestore || typeof firestore.collection !== 'function') {
    alert('Koneksi Firestore tidak tersedia.');
    return;
  }

  try {
    await firestore.collection('system_config').doc('refund_settings').set({
      refund_value: percentage,
      updatedAt: new Date()
    }, { merge: true });

    // Tidak perlu cache manual: nilai ini akan otomatis tersebar realtime ke semua komputer lain
    // lewat startRefundPolicyRealtimeListener() (onSnapshot). Perbarui juga variabel in-memory
    // lokal supaya UI di komputer ini langsung update tanpa menunggu echo dari Firestore.
    currentRefundPolicyPercentage = percentage;
    input.value = String(percentage);
    alert('Kebijakan refund berhasil disimpan.');
  } catch (error) {
    console.error('Gagal menyimpan kebijakan refund:', error);
    alert(`Gagal menyimpan kebijakan refund: ${error?.message || error}`);
  }
}

// Realtime listener: kebijakan refund langsung ter-update di semua komputer begitu Admin menyimpan
// perubahan di komputer manapun, tanpa perlu refresh halaman atau cache localStorage.
function startRefundPolicyRealtimeListener() {
  const input = document.getElementById('input-refund-percentage');
  if (input) input.value = String(currentRefundPolicyPercentage);

  if (typeof firestore === 'undefined' || !firestore || typeof firestore.collection !== 'function') return;

  if (typeof unsubscribeRefundPolicyListener === 'function') {
    try { unsubscribeRefundPolicyListener(); } catch (err) { console.warn('Gagal menghentikan listener kebijakan refund:', err); }
  }

  unsubscribeRefundPolicyListener = firestore.collection('system_config').doc('refund_settings')
    .onSnapshot(snapshot => {
      const data = snapshot.exists ? (snapshot.data() || {}) : {};
      const value = Number(data.refund_value);
      if (Number.isFinite(value) && value >= 0 && value <= 100) {
        currentRefundPolicyPercentage = value;
      }

      const refundInputEl = document.getElementById('input-refund-percentage');
      // Jangan timpa input saat Admin sedang mengetik nilai baru di komputer ini.
      if (refundInputEl && document.activeElement !== refundInputEl) {
        refundInputEl.value = String(currentRefundPolicyPercentage);
      }
    }, error => {
      console.warn('Gagal memuat kebijakan refund realtime:', error);
    });
}


async function handleTutupBukuAndReset() {
  const submitBtn = document.getElementById('btn-submit-reset');
  const passwordInput = document.getElementById('input-admin-password');
  const sessionUser = JSON.parse(sessionStorage.getItem(ACTIVE_USER_SESSION_KEY) || 'null');
  const adminPassword = passwordInput ? passwordInput.value : '';

  if (!sessionUser || adminPassword !== String(sessionUser.password || '')) {
    alert('Password Admin Salah!');
    return;
  }

  const activeTransactions = transactions
    .filter(trx => trx && trx.isArchived !== true)
    .map(normalizeActiveTransactionPayload);

  downloadFinanceCsvBackup(activeTransactions);

  if (typeof executeTutupBukuBatch !== 'function') {
    alert('Fungsi executeTutupBukuBatch() belum tersedia pada model Firebase.');
    return;
  }

  try {
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses Reset...';
    }

    const result = await executeTutupBukuBatch();
    if (!result || !result.success) {
      alert(`Tutup buku gagal: ${result?.error || 'Unknown error'}`);
      return;
    }

    // Pastikan state transaksi lokal langsung kosong setelah reset backend berhasil.
    transactions = [];

    rooms = rooms.map(room => ({
      ...room,
      status: room.status === 'Occupied' ? 'Available' : room.status
    }));

    // Re-render UI ledger/keuangan tanpa perlu refresh manual.
    renderHistory();
    renderAdminGuests();
    triggerSubRenderers();

    // Tarik ulang state dari backend pasca reset agar sinkron penuh lintas role/view.
    await syncFinanceTransactionsFromBackend();

    closeFinanceResetModal();

    alert('Tutup buku selesai. Data transaksi telah dibersihkan dari layar.');
  } catch (error) {
    alert(`Terjadi kendala saat tutup buku: ${error?.message || error}`);
  } finally {
    if (submitBtn) {
      submitBtn.textContent = 'Unduh Backup & Reset';
      updateResetChallengeValidation();
    }
  }
}


// --- 8. GLOBAL EVENT LISTENERS ATTACHMENTS ---

window.addEventListener('DOMContentLoaded', () => {
  renderDynamicFacilitiesOptions();

  transactions = applySequentialTransactionCodes(
    (Array.isArray(transactions) ? transactions : []).map(normalizeActiveTransactionPayload)
  );

  reconcileLocalRoomsWithFirebaseOnLoad()
    .catch(err => console.warn('Sinkronisasi awal rooms ke Firebase gagal:', err))
    .finally(() => loadAvailableRoomsForWalkinDropdown());

  // Akun staf (login) harus tersedia SEBELUM login terjadi, jadi listener-nya dimulai
  // tanpa syarat di sini (sama seperti listener fasilitas), bukan hanya setelah login.
  startStaffAccountsRealtimeListener();

  // Muat pengaturan desain struk dari Firestore (menggantikan cache localStorage lama).
  if (typeof loadReceiptSettings === 'function') {
    loadReceiptSettings()
      .then(result => {
        if (result?.success && result.settings) {
          receiptDesignSettings = { ...receiptDesignSettings, ...result.settings };
        }
      })
      .catch(err => console.warn('Gagal memuat pengaturan struk dari Firestore:', err));
  }

  if (!activeUser || activeUser.role === 'Admin') {
    syncFinanceTransactionsFromBackend();
  }

  // A. Checking if already logged in via Session storage
  const persistedSessionUser = JSON.parse(sessionStorage.getItem(ACTIVE_USER_SESSION_KEY) || 'null');
  if (persistedSessionUser) {
    activeUser = persistedSessionUser;
  }

  if (activeUser) {
    launchSystemSession();
  } else {
    document.getElementById('login-container').classList.remove('hidden');
    document.getElementById('app-container').classList.add('hidden');
  }

  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }

  if (typeof renderDynamicFacilitiesOptions === 'function') {
    renderDynamicFacilitiesOptions();
  }
  startFacilitiesRealtimeListener();
  startOnlineBookingListener();

  
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', toggleSidebarCollapse);
    applySidebarCollapseState(getSavedSidebarCollapseState());
  }

  // D. Sidebar Menu router switching hooks binding
  const menuBtnIds = [
    'dashboard', 'checkIn', 'checkOut', 'reservations', 'history',
    'adminDashboard', 'adminRooms', 'adminUsers', 'adminGuests'
  ];
  menuBtnIds.forEach(id => {
    const el = document.getElementById(`menu-btn-${id}`);
    if (el) {
      el.addEventListener('click', () => navigate(id));
    }
  });

  // E. Master Header Search Box listener filtering active panels on keyup
  const hSearch = document.getElementById('header-search-input');
  if (hSearch) {
    hSearch.addEventListener('input', (e) => {
      searchFilterStr = e.target.value.trim();
      
      // Instantly rerender appropriate lists
      if (currentMenu === 'reservations') renderReservations();
      else if (currentMenu === 'history') renderHistory();
      else if (currentMenu === 'adminGuests') renderAdminGuests();
    });
  }

  // F. View-specific listeners configurations:
  // F1. Room category filter highlights in Dashboard
  document.getElementById('dash-rooms-all').addEventListener('click', (e) => {
    currentRoomsFilter = 'all';
    document.querySelectorAll('[id^="dash-rooms-"]').forEach(btn => btn.className = 'px-3 py-1.5 font-bold rounded-lg transition-all text-slate-500 cursor-pointer');
    e.target.className = 'px-3.5 py-1.5 font-bold rounded-lg transition-all bg-white text-slate-900 shadow-sm cursor-pointer';
    renderDashboard();
  });
  document.getElementById('dash-rooms-booked').addEventListener('click', (e) => {
    currentRoomsFilter = 'booked';
    document.querySelectorAll('[id^="dash-rooms-"]').forEach(btn => btn.className = 'px-3 py-1.5 font-bold rounded-lg transition-all text-slate-500 cursor-pointer');
    e.target.className = 'px-3.5 py-1.5 font-bold rounded-lg transition-all bg-indigo-50 text-indigo-700 shadow-sm cursor-pointer';
    renderDashboard();
  });

  // F2. Checkin Tab options bindings
  const tabWalk = document.getElementById('tab-checkin-walkin');
  const tabOnline = document.getElementById('tab-checkin-online');
  const panelWalk = document.getElementById('panel-checkin-walkin');
  const panelOnline = document.getElementById('panel-checkin-online');
  const completeCheckinBtn = document.getElementById('complete-checkin-btn');

  tabWalk.addEventListener('click', () => {
    tabWalk.className = 'px-5 py-3 border-b-2 border-indigo-600 text-indigo-600 font-extrabold cursor-pointer';
    tabOnline.className = 'px-5 py-3 border-b-2 border-transparent text-slate-400 hover:text-slate-800 cursor-pointer';
    panelWalk.classList.remove('hidden');
    panelOnline.classList.add('hidden');
    document.getElementById('payment-options-block').classList.remove('hidden');
    document.getElementById('cash-change-container').classList.remove('hidden');
    completeCheckinBtn.textContent = 'Proses & Aktifkan Kunci Kamar ➔';
    calculateWalkinTotalPrice();
  });

  tabOnline.addEventListener('click', () => {
    tabOnline.className = 'px-5 py-3 border-b-2 border-indigo-600 text-indigo-600 font-extrabold cursor-pointer';
    tabWalk.className = 'px-5 py-3 border-b-2 border-transparent text-slate-400 hover:text-slate-800 cursor-pointer';
    panelOnline.classList.remove('hidden');
    panelWalk.classList.add('hidden');
    document.getElementById('payment-options-block').classList.add('hidden');
    document.getElementById('cash-change-container').classList.add('hidden');
    completeCheckinBtn.textContent = 'Konfirmasi Pelunasan OTA & Check-In ➔';
    
    // Total price becomes Lunas
    document.getElementById('payment-calc-subtotal').textContent = 'LUNAS DI OTA';
  });

  // Dynamic calculations inputs
  const walkinRoomTypeInput = document.getElementById('walkin-room-type');

  if (walkinRoomTypeInput) {
    walkinRoomTypeInput.addEventListener('change', () => {
      setupCheckinUnitSelects();
      calculateWalkinTotalPrice();
    });
  }

  document.getElementById('walkin-duration').addEventListener('input', calculateWalkinTotalPrice);
  document.getElementById('payment-amount-paid').addEventListener('input', () => {
    applyRupiahFormattingToCashInput();
    calculateWalkinTotalPrice();
  });
  document.getElementById('walkin-checkin-date').addEventListener('change', calculateWalkinTotalPrice);
  document.getElementById('walkin-checkout-date').addEventListener('change', calculateWalkinTotalPrice);
 document.addEventListener(
'change',
function(e){
    if(
        e.target.name !== 'payment-method'
    ){

        return;

    }
    document
    .querySelectorAll(
        'input[name="payment-method"]'
    )
    .forEach(r=>{
        r.parentElement.className =
        'border border-slate-200 rounded-xl p-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:bg-slate-50 group';
    });
    e.target.parentElement.className =
    'border-2 border-indigo-650 rounded-xl p-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:bg-slate-50 group';
    const method =
    e.target.value.toLowerCase();
    console.log(
        "PAYMENT CHANGE:",
        method
    );
    const cashBox =
    document.getElementById(
        'cash-change-container'
    );
    const cashInput =
    document.getElementById(
        'payment-amount-paid');
    if(
        method === 'cash'
    ){
        cashBox?.classList.remove(
            'hidden'
        );
        if(cashInput){
            cashInput.disabled=false;
        }
    }else{
        cashBox?.classList.add(
            'hidden'
        );
        if(cashInput){
            cashInput.value='';
            cashInput.disabled=true;
        }
    }
});

  // QRIS or Debit selection visual highlight checkouts
  document.querySelectorAll('input[name="checkout-payment-method"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      document.querySelectorAll('input[name="checkout-payment-method"]').forEach(r => {
        r.parentElement.className = 'border border-slate-200 rounded-xl p-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:bg-slate-50 select-none';
      });
      e.target.parentElement.className = 'border-2 border-indigo-650 rounded-xl p-2.5 flex flex-col items-center gap-1 cursor-pointer transition-all hover:bg-slate-50 select-none';
    });
  });

  // Process checkout button hook
  document.getElementById('complete-checkin-btn').addEventListener('click', executeCompleteCheckin);
  document.getElementById('verify-booking-btn').addEventListener('click', handleVerifyOTABooking);

  // F3. Checkout selections room details updates binding
  document.getElementById('checkout-room-select').addEventListener('change', triggerCheckoutFormDetails);
  document.getElementById('checkout-surcharge-late').addEventListener('change', calculateCheckoutBill);
  document.getElementById('checkout-surcharge-minibar').addEventListener('input', calculateCheckoutBill);
  document.getElementById('checkout-surcharge-damage').addEventListener('change', calculateCheckoutBill);
  document.getElementById('complete-checkout-btn').addEventListener('click', executeCompleteCheckout);

  // F4. Reservations tabs listeners bindings
  document.getElementById('res-tab-all').addEventListener('click', (e) => {
    currentReservationsTab = 'all';
    document.querySelectorAll('[id^="res-tab-"]').forEach(b => b.className = 'px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer');
    e.target.className = 'px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer';
    renderReservations();
  });
  document.getElementById('res-tab-confirmed').addEventListener('click', (e) => {
    currentReservationsTab = 'confirmed';
    document.querySelectorAll('[id^="res-tab-"]').forEach(b => b.className = 'px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer');
    e.target.className = 'px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer';
    renderReservations();
  });
  document.getElementById('res-tab-checkedin').addEventListener('click', (e) => {
    currentReservationsTab = 'checkedin';
    document.querySelectorAll('[id^="res-tab-"]').forEach(b => b.className = 'px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer');
    e.target.className = 'px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer';
    renderReservations();
  });
  document.getElementById('res-tab-checkedout').addEventListener('click', (e) => {
    currentReservationsTab = 'checkedout';
    document.querySelectorAll('[id^="res-tab-"]').forEach(b => b.className = 'px-4 py-2 rounded-lg text-slate-500 hover:bg-slate-50 cursor-pointer');
    e.target.className = 'px-4 py-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100 cursor-pointer';
    renderReservations();
  });

  // F5. Jurnal history filtration
  document.getElementById('history-method-select').addEventListener('change', (e) => {
    activeHistoryMethod = e.target.value;
    renderHistory();
  });

  // F6. Admin Rooms filter classifications
  document.getElementById('filter-admrooms-all').addEventListener('click', (e) => {
    currentAdminRoomsFilter = 'all';
    document.querySelectorAll('[id^="filter-admrooms-"]').forEach(b => b.className = 'px-3.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg';
    renderAdminRooms();
  });
  document.getElementById('filter-admrooms-available').addEventListener('click', (e) => {
    currentAdminRoomsFilter = 'available';
    document.querySelectorAll('[id^="filter-admrooms-"]').forEach(b => b.className = 'px-3.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg';
    renderAdminRooms();
  });
  document.getElementById('filter-admrooms-occupied').addEventListener('click', (e) => {
    currentAdminRoomsFilter = 'occupied';
    document.querySelectorAll('[id^="filter-admrooms-"]').forEach(b => b.className = 'px-3.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg';
    renderAdminRooms();
  });
  document.getElementById('filter-admrooms-outoforder').addEventListener('click', (e) => {
    currentAdminRoomsFilter = 'outoforder';
    document.querySelectorAll('[id^="filter-admrooms-"]').forEach(b => b.className = 'px-3.5 py-1.5 bg-white border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg';
    renderAdminRooms();
  });

  // Add room submit registration form
  document.getElementById('add-room-form').addEventListener('submit', handleAddRoom);
  document.getElementById('add-room-price').addEventListener('input', applyRupiahFormattingToRoomPriceInput);
  document.getElementById('add-room-late-fee').addEventListener('input', () => applyRupiahFormattingToInputById('add-room-late-fee'));
  document.getElementById('add-room-minibar-fee').addEventListener('input', () => applyRupiahFormattingToInputById('add-room-minibar-fee'));
  document.getElementById('add-room-damage-fee').addEventListener('input', () => applyRupiahFormattingToInputById('add-room-damage-fee'));
  applyRupiahFormattingToRoomPriceInput();
  applyRupiahFormattingToInputById('add-room-late-fee');
  applyRupiahFormattingToInputById('add-room-minibar-fee');
  applyRupiahFormattingToInputById('add-room-damage-fee');
  document.getElementById('cancel-room-edit').addEventListener('click', (e) => {
    e.preventDefault();
    resetAddRoomForm();
  });

  const addFacilityBtn = document.getElementById('btn-tambah-fasilitas');
  if (addFacilityBtn) {
    addFacilityBtn.addEventListener('click', tambahFasilitasKeDatabase);
  }

  const addFacilityInput = document.getElementById('input-fasilitas-baru');
  if (addFacilityInput) {
    addFacilityInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        tambahFasilitasKeDatabase();
      }
    });
  }

  const deleteFacilityBtn = document.getElementById('btn-hapus-fasilitas');
  if (deleteFacilityBtn) {
    deleteFacilityBtn.addEventListener('click', handleDeleteSelectedFacility);
  }

  // F7. Admin Users form CRUD controls
  document.getElementById('admin-user-form').addEventListener('submit', handleAdminUserSubmit);
  document.getElementById('admin-user-btn-cancel').addEventListener('click', cleanUserForms);

  // F8. Admin Guests roster segmentation filters tabs
  document.getElementById('filter-guests-all').addEventListener('click', (e) => {
    currentGuestsTab = 'all';
    document.querySelectorAll('[id^="filter-guests-"]').forEach(b => b.className = 'px-3.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700';
    renderAdminGuests();
  });
  document.getElementById('filter-guests-inhouse').addEventListener('click', (e) => {
    currentGuestsTab = 'inhouse';
    document.querySelectorAll('[id^="filter-guests-"]').forEach(b => b.className = 'px-3.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700';
    renderAdminGuests();
  });
  document.getElementById('filter-guests-pending').addEventListener('click', (e) => {
    currentGuestsTab = 'pending';
    document.querySelectorAll('[id^="filter-guests-"]').forEach(b => b.className = 'px-3.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700';
    renderAdminGuests();
  });
  document.getElementById('filter-guests-out').addEventListener('click', (e) => {
    currentGuestsTab = 'out';
    document.querySelectorAll('[id^="filter-guests-"]').forEach(b => b.className = 'px-3.5 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 text-[11px]');
    e.target.className = 'px-3.5 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700';
    renderAdminGuests();
  });

  const exportFinanceBtn = document.getElementById('btn-export-xlsx');
  if (exportFinanceBtn) {
    exportFinanceBtn.addEventListener('click', handleExportFinanceXlsx);
  }

  const saveRefundPolicyBtn = document.getElementById('btn-simpan-kebijakan-refund');
  if (saveRefundPolicyBtn) {
    saveRefundPolicyBtn.addEventListener('click', simpanKebijakanRefund);
  }

  startRefundPolicyRealtimeListener();

  const tutupBukuBtn = document.getElementById('btn-tutup-buku');
  if (tutupBukuBtn) {
    tutupBukuBtn.addEventListener('click', openFinanceResetModal);
  }

  const closeResetBtn = document.getElementById('btn-close-reset-modal');
  if (closeResetBtn) {
    closeResetBtn.addEventListener('click', closeFinanceResetModal);
  }

  const cancelResetBtn = document.getElementById('btn-cancel-reset');
  if (cancelResetBtn) {
    cancelResetBtn.addEventListener('click', closeFinanceResetModal);
  }

  const challengeInput = document.getElementById('input-challenge');
  if (challengeInput) {
    challengeInput.addEventListener('input', updateResetChallengeValidation);
  }

  const submitResetBtn = document.getElementById('btn-submit-reset');
  if (submitResetBtn) {
    submitResetBtn.addEventListener('click', handleTutupBukuAndReset);
  }

  // CORES. Popups modal triggers closures
  document.getElementById('create-reservation-btn-trigger').addEventListener('click', openAddReservationModal);

  const resetCheckOutBtn = document.getElementById('btn-reset-checkout');
  if (resetCheckOutBtn) {
    resetCheckOutBtn.addEventListener('click', handleResetCheckOutData);
  }

  // Close x Add modal
  document.getElementById('modal-add-res-close-x').addEventListener('click', () => {
    document.getElementById('modal-add-reservation').classList.add('hidden');
  });
  document.getElementById('modal-add-res-btn-cancel').addEventListener('click', () => {
    document.getElementById('modal-add-reservation').classList.add('hidden');
  });
  
  // Close x edit modal
  document.getElementById('modal-edit-res-close-x').addEventListener('click', () => {
    document.getElementById('modal-edit-reservation').classList.add('hidden');
  });
  document.getElementById('modal-edit-res-btn-cancel').addEventListener('click', () => {
    document.getElementById('modal-edit-reservation').classList.add('hidden');
  });

  document.getElementById('modal-add-res-room-type').addEventListener('change', calculateModalTotalPrice);
  document.getElementById('modal-add-res-duration').addEventListener('input', calculateModalTotalPrice);
  document.getElementById('modal-add-res-ci').addEventListener('change', calculateModalTotalPrice);
  document.getElementById('modal-add-res-co').addEventListener('change', calculateModalTotalPrice);
  
  document.getElementById('modal-edit-res-room-type').addEventListener('change', calculateModalEditTotalPrice);
  document.getElementById('modal-edit-res-duration').addEventListener('input', calculateModalEditTotalPrice);
  document.getElementById('modal-edit-res-ci').addEventListener('change', calculateModalEditTotalPrice);
  document.getElementById('modal-edit-res-co').addEventListener('change', calculateModalEditTotalPrice);

  // Forms submissions handles
  document.getElementById('modal-add-res-form').addEventListener('submit', handleAddReservationSubmit);
  document.getElementById('modal-edit-res-form').addEventListener('submit', handleEditReservationSubmit);

  // --- G. REAL TIME DATE/TIME COUNTERS DISPLAY ---
  function updateTimeCounter() {
    const clockLabel = document.getElementById('header-time');
    const dateLabel = document.getElementById('header-date');
    if (!clockLabel || !dateLabel) return;

    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const date = new Date();
    const dayName = days[date.getDay()];
    const dateNum = date.getDate();
    const monthName = months[date.getMonth()];
    const year = date.getFullYear();

    dateLabel.textContent = `${dayName}, ${dateNum} ${monthName} ${year}`;
    
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    clockLabel.textContent = `Pukul ${h}:${m}:${s} WIB`;
  }

  // Set real active date updates
  updateTimeCounter();
  setInterval(updateTimeCounter, 1000);

});

// Fungsi pembantu untuk mengosongkan form dan mengarahkan kembali ke dashboard
function executePostCheckinNavigation() {
  document.getElementById('walkin-name').value = '';
  document.getElementById('walkin-identity').value = '';
  document.getElementById('walkin-phone').value = '';
  document.getElementById('walkin-email').value = '';
  const amtPaidInput = document.getElementById('payment-amount-paid');
  if (amtPaidInput) amtPaidInput.value = '';

  if (typeof loadAvailableRoomsForWalkinDropdown === 'function') {
    loadAvailableRoomsForWalkinDropdown();
  }
  
  if (typeof navigate === 'function') {
    navigate('dashboard');
  }
}

// =========================================================================
// TARUH DI BARIS PALING BAWAH FILE app-controller.js (JANGAN DI DALAM FUNGSI LAIN)
// =========================================================================
let isMidtransOpen = false;
window.handleMidtransPayment = async function(
  newRes,
  newTrx,
  assignedRoom,
  activeRoom,
  roomN,
  rType
) {
  if (isMidtransOpen) {
    console.log(
      "Midtrans masih berjalan, request kedua dibatalkan"
    );
    return;
  }

  isMidtransOpen = true;
  try {
    const midtransOrderId =
    `STAFF-${Date.now()}`;

    const cleanAmount =
    Number(
    String(newRes.totalCharge)
    .replace(/[^0-9]/g,"")
    );

    console.log(
    "KIRIM MIDTRANS STAFF",
    {
      order:midtransOrderId,
      totalAsli:newRes.totalCharge,
      totalFix:cleanAmount,
      tipe:typeof cleanAmount
    }
    );

    if(
    !cleanAmount ||
    isNaN(cleanAmount)
    ){
    alert(
      "Total pembayaran tidak valid"
    );
    isMidtransOpen=false;
    return;
    }

    const response =
    await fetch(
    'https://piturooms-api.vercel.app/api/get-token',
    {
    method:'POST',
    headers:{
    'Content-Type':'application/json'
    },

    body:JSON.stringify({
    order_id:
    midtransOrderId,
    gross_amount:
    cleanAmount,
    customer_details:{
    first_name:
    newRes.guestName || "Guest",
    phone:
    newRes.phone || "08123456789",
    email:
    newRes.email || 
    "guest@piturooms.com"
    }
  })
});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || 'Gagal berkomunikasi dengan Server Jembatan Vercel.');
    const snapToken = data.snap_token;
    if (!snapToken) throw new Error('Respon server Vercel tidak menyertakan Snap Token.');
    if (!window.snap) {
    alert('Midtrans Snap belum dimuat. Cek koneksi atau Client Key.');
    return;
    }

    console.log(
    "MIDTRANS TOKEN:",
    snapToken
    );

    console.log(
    "TOTAL:",
    newRes.totalCharge
    );


    window.snap.pay(snapToken, {
      onSuccess: async function(result) {
        isMidtransOpen = false;
        console.log("MIDTRANS SUCCESS",result);
        newRes.status = 'CheckedIn';

        // 2. Masukkan data ke memori lokal browser agar antarmuka terupdate
        if (typeof processFinalDatabaseInsertion === 'function') {
        await processFinalDatabaseInsertion(newRes,newTrx,assignedRoom,activeRoom,roomN,rType);
      }
        
        alert(`Pembayaran QRIS Berhasil! Tamu ${newRes.guestName} resmi check-in ke Kamar #${roomN}.`);
        if (typeof triggerSubRenderers === 'function') triggerSubRenderers();

        // 4. Kosongkan kembali form input walk-in di layar
        clearInput('walkin-name');
        clearInput('walkin-identity');
        clearInput('walkin-phone');
        clearInput('walkin-email');
        clearInput('payment-amount-paid');
        const amtPaidInput = document.getElementById('payment-amount-paid');
        if (amtPaidInput) amtPaidInput.value = '';

        // 5. Muat ulang daftar kamar kosong dan kembali ke dashboard secara otomatis
        if (typeof loadAvailableRoomsForWalkinDropdown === 'function') loadAvailableRoomsForWalkinDropdown();
        if (typeof navigate === 'function') navigate('dashboard');
      },
      onPending: function(result) {
        isMidtransOpen = false;
        console.log(
        "MIDTRANS PENDING",result);
        alert(
          'Pembayaran Pending. Silakan selesaikan proses scan QRIS atau Virtual Account pada layar.'
        );
      },
      onError: function(result) {
        isMidtransOpen = false;
        console.error("MIDTRANS ERROR",result);
        alert(
          'Transaksi Gagal! Silakan gunakan metode pembayaran lain atau ulangi proses.'
        );
      },
        onClose: function() {
        isMidtransOpen = false;console.log("MIDTRANS POPUP CLOSED");
        alert(
          'Jendela pembayaran Midtrans ditutup oleh Resepsionis.'
        );
        }
    });

  } catch (error) {
    isMidtransOpen = false;
    console.error('Midtrans Gateway Error:',error);
    alert('Sistem Gagal Memanggil Midtrans: ' + error.message);
    }
  }

function clearInput(id){
 const el=document.getElementById(id);
 if(el){
  el.value='';
 }

}
function normalizeOTACode(code){
  return String(code || "")
    .trim()
    .toUpperCase();
}

function startOnlineBookingListener(){
  if(typeof database === "undefined" ||!database){
    return;
  }

  database
  .ref("bookings")
  .on("value", snap=>{
    onlineBookings = [];
    snap.forEach(child=>{
      onlineBookings.push({
        firebaseId: child.key,
        ...child.val()
      });
    });
    console.log(
      "OTA BOOKINGS:",
      onlineBookings
    );
    if(
      typeof renderDashboard === "function"
    ){

      renderDashboard();
    }
  });
}

async function loadReservationRoomDropdown(){

const select =
document.getElementById(
"modal-add-res-room-type"
);


if(!select){
return;
}


const checkIn =
document.getElementById(
"modal-add-res-ci"
)?.value;


const checkOut =
document.getElementById(
"modal-add-res-co"
)?.value;



select.innerHTML="";


const result =
await getRooms();


if(
!result ||
!result.success
){
return;
}



let rooms =
result.rooms;



// FILTER TANGGAL RESERVASI
rooms =
rooms.filter(room=>{


if(
!checkIn ||
!checkOut
){

return true;

}



return isRoomAvailableByDate(

room.number,

checkIn,

checkOut

);


});




rooms.forEach(room=>{


const option =
document.createElement(
"option"
);


option.value =
room.id;


option.textContent =
`${room.number} - ${room.type}`;


select.appendChild(option);


});



if(!rooms.length){


const option =
document.createElement(
"option"
);


option.value="";


option.textContent=
"Tidak ada kamar tersedia";


select.appendChild(option);


}


}
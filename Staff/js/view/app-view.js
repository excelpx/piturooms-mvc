// VIEW: router tampilan, render dashboard, render tabel, dan modal view
// --- 3. TEMPLATE RENDER ENGINE CONSTRUCTORS ---

const SEARCH_VISIBLE_MENU_IDS = new Set(['reservations', 'history', 'adminGuests']);

function updateHeaderSearchVisibility(menuId) {
  const searchInput = document.getElementById('header-search-input');
  if (!searchInput) return;

  const searchWrapper = document.getElementById('topbar-search-slot')
    || searchInput.closest('.relative')?.parentElement
    || searchInput;
  const shouldShowSearch = SEARCH_VISIBLE_MENU_IDS.has(menuId);

  if (shouldShowSearch) {
    searchWrapper.style.display = 'block';
  } else {
    searchWrapper.style.display = 'none';
  }
}

// Navigation Tab switcher router
function navigate(menuId) {
  currentMenu = menuId;
  
  // Update sidebar buttons highlighted states
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600', 'text-white', 'shadow-md');
    btn.classList.add('text-slate-450', 'hover:bg-slate-800/50', 'hover:text-white');
  });
  
  const activeBtn = document.getElementById(`menu-btn-${menuId}`);
  if (activeBtn) {
    activeBtn.classList.remove('text-slate-450', 'hover:bg-slate-800/50', 'hover:text-white');
    activeBtn.classList.add('bg-indigo-600', 'text-white', 'shadow-md');
  }

  // Toggle active views
  document.querySelectorAll('.view-content').forEach(view => {
    view.classList.add('hidden');
  });
  
  const activeView = document.getElementById(`view-${menuId}`);
  if (activeView) {
    activeView.classList.remove('hidden');
  }

  updateHeaderSearchVisibility(menuId);

  // Clear master search input on tab change except custom scopes
  if (!SEARCH_VISIBLE_MENU_IDS.has(menuId)) {
    const searchInput = document.getElementById('header-search-input');
    if (searchInput) searchInput.value = '';
    searchFilterStr = '';
  }

  // Trigger sub-render engines depending on target view scope
  triggerSubRenderers();
}

function triggerSubRenderers() {
  if (!activeUser) return;
  
  switch(currentMenu) {
    case 'dashboard':
      renderDashboard();
      break;
    case 'checkIn':
      if (typeof loadAvailableRoomsForWalkinDropdown === 'function') {
        loadAvailableRoomsForWalkinDropdown();
      } else {
        setupCheckinUnitSelects();
        calculateWalkinTotalPrice();
      }
      break;
    case 'checkOut':
      setupCheckoutUnitSelects();
      break;
    case 'reservations':
      renderReservations();
      break;
    case 'history':
      renderHistory();
      break;
    case 'adminDashboard':
      renderAdminDashboard();
      break;
    case 'adminRooms':
      renderAdminRooms();
      break;
    case 'adminUsers':
      renderAdminUsers();
      break;
    case 'adminGuests':
      renderAdminGuests();
      break;
  }

  // Automatically refresh icons
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }
}

function renderDashboard() {
  const gridContainer = document.getElementById('dashboard-rooms-grid');
  if (!gridContainer) return;
  gridContainer.innerHTML = '';

  const totalCount = rooms.length;
  const occupiedCount = rooms.filter(r => r.status === 'Occupied').length;
  const bookingsPending = onlineBookings.filter(b => { const status = String(b.status || "").toLowerCase();
      return (status !== "checkedin" && status !== "checkedout");
  }).length;



const availableCount =
  rooms.filter(
    r => r.status === 'Available'
  ).length;

  // Update DOM metrics boxes
  document.getElementById('stat-occupied-kamar').textContent = occupiedCount;
  document.getElementById('stat-booking-code-pending').textContent = bookingsPending;
  document.getElementById('stat-available-kamar').textContent = availableCount;
  document.querySelectorAll('.stat-total-kamar').forEach(el => el.textContent = totalCount);

  // Standard room cards filtering items
  const filtered = rooms.filter(room => {
    const roomTypeName = normalizeRoomTypeName(room.type);
    const matchesCategory = currentRoomsFilter === 'all' || (currentRoomsFilter === 'booked' && room.status === 'Occupied');
    const matchesSearch = !searchFilterStr || 
      room.number.includes(searchFilterStr) || 
      roomTypeName.toLowerCase().includes(searchFilterStr.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  filtered.forEach(room => {
    const isOccupied = room.status === 'Occupied';
    const isMaintenance = room.status === 'OutofOrder';
    
    // Find active guest occupying the room unit
    const activeRes = reservations.find(res => res.roomNumber === room.number && res.status === 'CheckedIn');
    const guestName = activeRes ? activeRes.guestName : '';

    let cardBg = 'bg-white border-slate-200 hover:border-indigo-500 hover:shadow-sm';
    let statusBadge = `<span class="px-2 py-0.5 bg-emerald-50 border border-emerald-100 text-emerald-700 text-[8.5px] font-black rounded uppercase tracking-wider">Tersedia</span>`;
    let detailSection = `<span class="text-[9.5px] text-indigo-600 font-extrabold block mt-2.5 opacity-0 group-hover:opacity-100 transition-opacity">Check In &rarr;</span>`;
    let dotColor = 'bg-emerald-500';

    if (isOccupied) {
      cardBg = 'bg-slate-50/70 border-slate-200 hover:bg-slate-50';
      statusBadge = `<span class="px-2 py-0.5 bg-amber-50 border border-amber-100 text-amber-700 text-[8.5px] font-black rounded uppercase tracking-wider">Terisi</span>`;
      dotColor = 'bg-amber-400';
      detailSection = `
        <p class="text-[8.5px] uppercase font-black text-slate-400 leading-none">Tamu Aktif</p>
        <p class="text-xs font-black text-slate-800 truncate max-w-[130px] mt-0.5">${guestName || 'Umum / Inactive'}</p>
        <span class="text-[9px] text-amber-600 font-extrabold block mt-1 hover:underline">Check Out &rarr;</span>
      `;
    } else if (isMaintenance) {
      cardBg = 'bg-rose-50/30 border-rose-100/50 hover:bg-rose-50/50';
      statusBadge = `<span class="px-2 py-0.5 bg-rose-50 border border-rose-100 text-rose-700 text-[8.5px] font-black rounded uppercase tracking-wider">Perbaikan</span>`;
      dotColor = 'bg-rose-500';
      detailSection = `
        <p class="text-[8.5px] uppercase font-black text-slate-400 leading-none">Status</p>
        <p class="text-xs font-black text-rose-800 truncate mt-0.5">Out of Order</p>
      `;
    }

    const card = document.createElement('div');
    card.className = `group border rounded-2xl p-4.5 transition-all duration-200 cursor-pointer min-h-[124px] flex flex-col justify-between ${cardBg}`;
    card.innerHTML = `
      <div class="flex justify-between items-start text-center">
        <div class="flex-1">
          <span class="text-[9px] font-black uppercase text-slate-400 tracking-wider">UNIT ${room.number}</span>
          <h4 class="text-sm font-black text-slate-900 leading-tight">${normalizeRoomTypeName(room.type)}</h4>
          <p class="text-[10px] text-slate-500 mt-1">Lantai ${room.floor || 1}</p>
        </div>
        <span class="w-2 h-2 rounded-full ${dotColor}"></span>
      </div>
      <div class="mt-4">
        ${detailSection}
      </div>
    `;

    // Action routers clicking on simple cards
    card.addEventListener('click', () => {
      if (isMaintenance) {
        alert(`Kamar #${room.number} sedang dalam rehabilitasi. Silakan ubah status melalui menu Kamar di panel admin.`);
        return;
      }
      if (isOccupied) {
        // Redirection with pre-selected room
        navigate('checkOut');
        const select = document.getElementById('checkout-room-select');
        if (select) {
          select.value = room.number;
          select.dispatchEvent(new Event('change'));
        }
      } else {
        navigate('checkIn');
        const rType = document.getElementById('walkin-room-type');
        if (rType) {
          setTimeout(() => {
            const roomOption = Array.from(rType.options).find(opt => opt.value === room.id);
            if (roomOption) {
              rType.value = room.id;
            }
            rType.dispatchEvent(new Event('change'));
          }, 150);
        }
      }
    });

    gridContainer.appendChild(card);
  });

  if (filtered.length === 0) {
    gridContainer.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-450 text-xs font-semibold">
        <i data-lucide="info" class="w-8 h-8 mx-auto text-slate-300 mb-2"></i>
        Tidak ada unit kamar yang sesuai dengan konfigurasi filter pencarian saat ini.
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

// === VIEW B: CHECK-IN DESK ===
function renderWalkinRoomTypeOptions(availableRooms){

const select =
document.getElementById(
"walkin-room-type"
);


if(!select){
return;
}


const list =
Array.isArray(availableRooms)
?
availableRooms
:
[];


select.innerHTML = "";


if(!list.length){


const opt =
document.createElement(
"option"
);


opt.value = "";


opt.textContent =
"Tidak ada kamar tersedia";


select.appendChild(opt);


return;


}



list.forEach((room,index)=>{


const opt =
document.createElement(
"option"
);



const nomor =
room.number ||
room.id ||
"-";


const tipe =
normalizeRoomTypeName(

room.type ||
room.roomType ||
"Kamar"

);



opt.value =
room.id;



opt.textContent =
`${nomor} - ${tipe}`;



if(index === 0){

opt.selected = true;

}



select.appendChild(opt);



});


}

function setupCheckinUnitSelects() {

const walkinType =
getSelectedWalkinRoomType();


const databaseRooms =
getCheckinAvailableRooms();


const availableFiltered =
databaseRooms.filter(room =>

normalizeRoomTypeName(room.type)
===
normalizeRoomTypeName(walkinType)

);



const roomCountEl =
document.getElementById(
"walkin-room-count"
);



if(roomCountEl){

roomCountEl.textContent =
`${availableFiltered.length} kamar tersedia`;

}


renderWalkinRoomButtons();

}

function renderWalkinRoomButtons() {
  const buttonsContainer = document.getElementById('walkin-room-buttons');
  const roomCountEl = document.getElementById('walkin-room-count');
  if (!buttonsContainer || !roomCountEl) return;

  const walkinType = getSelectedWalkinRoomType();
  const availableRooms =
getCheckinAvailableRooms()
.filter(r =>

normalizeRoomTypeName(r.type)
===
normalizeRoomTypeName(walkinType)

);
  buttonsContainer.innerHTML = '';
  roomCountEl.textContent = `${availableRooms.length} kamar tersedia`;

  if (availableRooms.length === 0) {
    buttonsContainer.innerHTML = `
      <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700 text-sm font-semibold">
        Tidak ada kamar tersedia untuk tipe ${walkinType || 'terpilih'} saat ini.
      </div>
    `;
    return;
  }

  const sampleRooms = availableRooms.slice(0, 3).map(room => `Lantai ${room.number}`).join(', ');
  buttonsContainer.innerHTML = `
    <div class="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-700 text-sm font-semibold">
      Sistem akan mengalokasikan kamar kosong otomatis dari inventaris admin untuk tipe <span class="font-black">${walkinType}</span>.<br>
      <span class="text-[11px] font-medium text-emerald-700/80">Contoh unit tersedia: ${sampleRooms}</span>
    </div>
  `;
}

function calculateWalkinTotalPrice() {
  const walkinType = getSelectedWalkinRoomType();
  const checkInDate = document.getElementById('walkin-checkin-date')?.value;
  const checkOutDate = document.getElementById('walkin-checkout-date')?.value;
  const autoDuration = calculateStayDurationDays(checkInDate, checkOutDate);
  const durationInput = document.getElementById('walkin-duration');

  if (durationInput && autoDuration > 0) {
    durationInput.value = String(autoDuration);
  }

  const duration = autoDuration > 0 ? autoDuration : (parseInt(durationInput?.value, 10) || 1);
  const rate = getSelectedWalkinRoomPrice();
  const total = rate * duration;

  document.getElementById('payment-calc-subtotal').textContent = formatIDR(total);
  
  // Real-time cash changes
  const pPaid = parseIDRCurrencyInput(document.getElementById('payment-amount-paid').value);
  const change = pPaid - total;
  const changeEl = document.getElementById('payment-calc-change');
  if (changeEl) {
    if (change >= 0) {
      changeEl.textContent = formatIDR(change);
      changeEl.classList.remove('text-rose-600');
      changeEl.classList.add('text-indigo-900');
    } else {
      changeEl.textContent = 'Dana Kurang!';
      changeEl.classList.remove('text-indigo-900');
      changeEl.classList.add('text-rose-600');
    }
  }
}

// === VIEW C: CHECK-OUT DESK ===
function setupCheckoutUnitSelects() {
  const selectCheckout = document.getElementById('checkout-room-select');
  if (!selectCheckout) return;
  selectCheckout.innerHTML = '<option value="">-- Pilih Kamar Terisi --</option>';

  const occupiedRooms = rooms.filter(r => r.status === 'Occupied');
  occupiedRooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room.number;
    opt.textContent = `KAMAR ${room.number} (${room.type})`;
    selectCheckout.appendChild(opt);
  });

  // Re-run current calculations or reset details
  triggerCheckoutFormDetails();
}

function triggerCheckoutFormDetails() {
  const rmNo = document.getElementById('checkout-room-select').value;
  const emptyState = document.getElementById('checkout-empty-state');
  const detailsCard = document.getElementById('checkout-details-card');

  if (!rmNo) {
    emptyState.classList.remove('hidden');
    detailsCard.classList.add('hidden');
    const lateBox = document.getElementById('checkout-surcharge-late');
    const dmgBox = document.getElementById('checkout-surcharge-damage');
    if (lateBox) {
      lateBox.checked = false;
      lateBox.dataset.penaltyAmount = '0';
    }
    if (dmgBox) {
      dmgBox.checked = false;
      dmgBox.dataset.penaltyAmount = '0';
    }
    const lateLabel = document.getElementById('checkout-surcharge-late-label');
    const dmgLabel = document.getElementById('checkout-surcharge-damage-label');
    if (lateLabel) lateLabel.textContent = 'Terapkan denda (Rp 0)';
    if (dmgLabel) dmgLabel.textContent = 'Terapkan denda (Rp 0)';
    document.getElementById('checkout-surcharge-minibar').value = '0';
    document.getElementById('checkout-calc-grandtotal').textContent = formatIDR(0);
    document.getElementById('checkout-calc-surcharges-sum').textContent = formatIDR(0);
    return;
  }

  emptyState.classList.add('hidden');
  detailsCard.classList.remove('hidden');

  // Load occupant details
  const activeRes = reservations.find(r => r.roomNumber === rmNo && r.status === 'CheckedIn');
  if (activeRes) {
    document.getElementById('checkout-guest-name').textContent = activeRes.guestName;
    document.getElementById('checkout-guest-identity').textContent = `KTP / NID / Paspor: ${activeRes.identityNo || 'Tidak Terdaftar'}`;
    document.getElementById('checkout-room-badge').textContent = `Kamar ${activeRes.roomNumber}`;
    document.getElementById('checkout-room-type').textContent = activeRes.roomType;
    document.getElementById('checkout-ci-date').textContent = activeRes.checkInDate;
    document.getElementById('checkout-co-date').textContent = activeRes.checkOutDate;
    document.getElementById('checkout-duration').textContent = activeRes.durationDays;
    document.getElementById('checkout-is-online').textContent = activeRes.isOnlineBooking ? 'Online Booking OTA' : 'Walk-in Offline';
  }

  const roomConfig = rooms.find(room => room.number === rmNo);
  if (roomConfig) {
    const latePenalty = Number(roomConfig.lateCheckoutPenalty || 0);
    const damagePenalty = Number(roomConfig.damagePenalty || 0);
    const lateBox = document.getElementById('checkout-surcharge-late');
    const dmgBox = document.getElementById('checkout-surcharge-damage');
    if (lateBox) {
      lateBox.checked = false;
      lateBox.dataset.penaltyAmount = String(latePenalty);
    }
    if (dmgBox) {
      dmgBox.checked = false;
      dmgBox.dataset.penaltyAmount = String(damagePenalty);
    }
    const lateLabel = document.getElementById('checkout-surcharge-late-label');
    const dmgLabel = document.getElementById('checkout-surcharge-damage-label');
    if (lateLabel) lateLabel.textContent = `Terapkan denda (${formatIDR(latePenalty)})`;
    if (dmgLabel) dmgLabel.textContent = `Terapkan denda (${formatIDR(damagePenalty)})`;
    document.getElementById('checkout-surcharge-minibar').value = Number(roomConfig.miniBarPenalty || 0);
  } else {
    const lateBox = document.getElementById('checkout-surcharge-late');
    const dmgBox = document.getElementById('checkout-surcharge-damage');
    if (lateBox) {
      lateBox.checked = false;
      lateBox.dataset.penaltyAmount = '0';
    }
    if (dmgBox) {
      dmgBox.checked = false;
      dmgBox.dataset.penaltyAmount = '0';
    }
    const lateLabel = document.getElementById('checkout-surcharge-late-label');
    const dmgLabel = document.getElementById('checkout-surcharge-damage-label');
    if (lateLabel) lateLabel.textContent = 'Terapkan denda (Rp 0)';
    if (dmgLabel) dmgLabel.textContent = 'Terapkan denda (Rp 0)';
    document.getElementById('checkout-surcharge-minibar').value = '0';
  }

  calculateCheckoutBill();
}

function calculateCheckoutBill() {
  const lateInput = document.getElementById('checkout-surcharge-late');
  const damageInput = document.getElementById('checkout-surcharge-damage');
  const latePenalty = parseInt(lateInput?.dataset?.penaltyAmount || '0', 10) || 0;
  const damagePenalty = parseInt(damageInput?.dataset?.penaltyAmount || '0', 10) || 0;
  const late = lateInput?.checked ? latePenalty : 0;
  const mini = parseInt(document.getElementById('checkout-surcharge-minibar').value) || 0;
  const dmg = damageInput?.checked ? damagePenalty : 0;

  const surchargesSum = late + mini + dmg;
  document.getElementById('checkout-calc-surcharges-sum').textContent = formatIDR(surchargesSum);
  document.getElementById('checkout-calc-grandtotal').textContent = formatIDR(surchargesSum);
}

// === VIEW D: RESERVATIONS MASTER LIST ===
function renderReservations() {
  const tbody = document.getElementById('reservations-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  // Tab counters update
  const tabAll = document.getElementById('res-tab-all');
  const tabConf = document.getElementById('res-tab-confirmed');
  const tabIn = document.getElementById('res-tab-checkedin');
  const tabOut = document.getElementById('res-tab-checkedout');

  tabAll.textContent = `Semua (${reservations.length})`;
  tabConf.textContent = `Confirmed (${reservations.filter(r => r.status === 'Confirmed').length})`;
  tabIn.textContent = `Checked In (${reservations.filter(r => r.status === 'CheckedIn').length})`;
  tabOut.textContent = `Checked Out (${reservations.filter(r => r.status === 'CheckedOut').length})`;

  const filtered = reservations.filter(r => {
    // Current tab match status
    let matchTab = true;
    if (currentReservationsTab === 'confirmed') matchTab = (r.status === 'Confirmed');
    else if (currentReservationsTab === 'checkedin') matchTab = (r.status === 'CheckedIn');
    else if (currentReservationsTab === 'all') {matchTab = true;}
    // For 'all' tab: exclude CheckedOut unless specifically viewing that tab
    else if (currentReservationsTab === 'all') matchTab = (r.status !== 'CheckedOut' && r.status !== 'CHECKED_OUT');

    // Search bar matching criteria
    const matchSearch = !searchFilterStr ||
      r.guestName.toLowerCase().includes(searchFilterStr.toLowerCase()) ||
      r.id.toLowerCase().includes(searchFilterStr.toLowerCase()) ||
      (r.roomNumber && r.roomNumber.includes(searchFilterStr));

    return matchTab && matchSearch;
  });

  filtered.forEach(res => {
    let statusClass = 'bg-blue-50 text-blue-700 border-blue-150 border';
    if (res.status === 'CheckedIn') statusClass = 'bg-amber-50 text-amber-700 border-amber-100 border';
    else if (res.status === 'CheckedOut') statusClass = 'bg-emerald-50 text-emerald-700 border-emerald-100 border';
    else if (res.status === 'Cancelled' || res.status === 'CANCELLED') statusClass = 'bg-slate-100 text-slate-400';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50 transition-all';
    
    // Actions are accessible to both Admin and Receptionist users
    const actBtn = (activeUser.role === 'Admin' || activeUser.role === 'Receptionist') ? `
      <div class="flex items-center justify-center gap-1.5">
        <button class="res-edit-btn px-2.5 py-1.5 bg-slate-50 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 border border-slate-200 hover:border-indigo-100 rounded-lg font-black transition cursor-pointer" data-id="${res.id}">
          Ubah
        </button>
        <button class="res-del-btn px-2 py-1.5 bg-slate-50 text-rose-500 hover:bg-rose-50 border border-slate-200 hover:border-rose-100 rounded-lg font-black transition cursor-pointer" data-id="${res.id}">
          Batalkan
        </button>
      </div>
    ` : `
      <span class="text-[10px] text-slate-400 font-bold block text-center">N/A</span>
    `;

    tr.innerHTML = `
      <td class="py-4.5 px-4 font-mono font-black text-indigo-650 text-indigo-600 leading-tight">${res.id}</td>
      <td class="py-4.5 px-4 block truncate max-w-[130px] font-black leading-tight text-slate-900">${res.guestName}</td>
      <td class="py-4.5 px-4 font-semibold text-slate-500 leading-none">${res.phone}</td>
      <td class="py-4.5 px-4 leading-none"><span class="px-2.5 py-1 text-[10px] bg-slate-100 rounded-lg font-black font-semibold text-slate-700 border border-slate-200/50">${res.roomType}</span></td>
      <td class="py-4.5 px-4 font-mono font-extrabold text-slate-800 text-center">${res.roomNumber || '-'}</td>
      <td class="py-4.5 px-4 leading-normal text-[11px] text-slate-500">
        <div>In: ${res.checkInDate}</div>
        <div class="text-[10px] text-slate-400">Out: ${res.checkOutDate} (${res.durationDays} Malam)</div>
      </td>
      <td class="py-4.5 px-4 font-mono font-black text-right text-slate-800">${formatIDR(res.totalCharge)}</td>
      <td class="py-4.5 px-4 text-center">
        <span class="px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${statusClass}">${res.status}</span>
      </td>
      <td class="py-4.5 px-4 text-center">${actBtn}</td>
    `;

    // Hook listeners
    const editBtn = tr.querySelector('.res-edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => openEditReservationModal(res.id));
    }
    const delBtn = tr.querySelector('.res-del-btn');
    if (delBtn) {
      delBtn.addEventListener('click', () => handleCancelReservation(res.id));
    }

    tbody.appendChild(tr);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" class="py-16 text-center text-slate-400 font-semibold text-xs">
          Tidak ada data booking / reservasi terdaftar yang cocok dengan kriteria pencarian ini.
        </td>
      </tr>
    `;
  }
}

// === VIEW E: RIWAYAT TRANSAKSI kasir ===
function renderHistory() {
  const tbody = document.getElementById('history-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const filteredRaw = transactions.filter(t => {
    return activeHistoryMethod === 'All' || t.paymentMethod === activeHistoryMethod;
  });

  // Dedupe rows so one customer transaction appears once in the ledger.
  const dedupedMap = new Map();
  filteredRaw.forEach(t => {
    const transactionCode = String(t?.transactionCode || '').trim().toUpperCase();
    const idAsCode = /^TRX\d{3,}$/i.test(String(t?.id || '').trim())
      ? String(t.id).trim().toUpperCase()
      : '';

    const rawDateValue = t?.date || t?.timestamp || t?.createdAt || '';
    const parsedTime = new Date(rawDateValue).getTime();
    const minuteBucket = Number.isNaN(parsedTime)
      ? String(rawDateValue || '').trim()
      : Math.floor(parsedTime / 60000);

    const semanticKey = [
      String(t?.type || '').trim().toUpperCase(),
      String(t?.guestName || '').trim().toUpperCase(),
      String(t?.roomNumber || '').trim().toUpperCase(),
      String(t?.paymentMethod || '').trim().toUpperCase(),
      String(Number(t?.amount || 0)),
      String(minuteBucket)
    ].join('|');

    const key = transactionCode
      ? `CODE:${transactionCode}`
      : (idAsCode ? `CODE:${idAsCode}` : `SEM:${semanticKey}`);

    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, t);
      return;
    }

    const existingTime = new Date(existing.date || existing.timestamp || existing.createdAt || 0).getTime();
    const currentTime = new Date(t.date || t.timestamp || t.createdAt || 0).getTime();

    // Keep the most complete/newest row when duplicates are detected.
    const existingScore = Number(Boolean(existing.transactionCode)) + Number(Boolean(existing.resepsionis)) + Number(Boolean(existing.roomType));
    const currentScore = Number(Boolean(t.transactionCode)) + Number(Boolean(t.resepsionis)) + Number(Boolean(t.roomType));
    if (currentScore > existingScore || currentTime > existingTime) {
      dedupedMap.set(key, t);
    }
  });

  const filtered = Array.from(dedupedMap.values()).sort((a, b) => {
    const aTime = new Date(a.date || a.timestamp || a.createdAt || 0).getTime();
    const bTime = new Date(b.date || b.timestamp || b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  // Calculate KPIs stats dynamically
  let totalRevenue = 0;
  let checkInsCount = 0;
  let checkOutsCount = 0;

  filtered.forEach(t => {
    totalRevenue += t.amount || 0;
    if (t.type === 'Check In') checkInsCount++;
    else if (t.type === 'Check Out') checkOutsCount++;

    const cashierName = String(t.cashierName || t.cashier_name || t.resepsionis || '').trim() || '-';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50 font-semibold text-[11.5px]';
    
    // Status colors format
    const isCI = t.type === 'Check In';
    const actBadge = isCI 
      ? '<span class="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-[8.5px] font-black uppercase tracking-wider border border-amber-100">Check-In</span>'
      : '<span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[8.5px] font-black uppercase tracking-wider border border-emerald-100">Check-Out</span>';

    tr.innerHTML = `
      <td class="px-3 py-3.5 font-mono font-black text-indigo-600">${t.transactionCode || t.id}</td>
      <td class="px-3 py-3.5 text-slate-400 font-medium leading-none">${new Date(t.date).toLocaleTimeString('id-ID', {hour: '2-digit', minute: '2-digit'})} WIB</td>
      <td class="px-3 py-3.5 font-black text-slate-800 truncate max-w-[120px] leading-tight">${t.guestName}</td>
      <td class="px-3 py-3.5 font-mono text-center text-slate-600">Kamar ${t.roomNumber}</td>
      <td class="px-3 py-3.5 text-center">${actBadge}</td>
      <td class="px-3 py-3.5 text-slate-700 font-bold">${cashierName}</td>
      <td class="px-3 py-3.5 text-right font-mono font-extrabold text-slate-900">${formatIDR(t.amount)}</td>
      <td class="px-3 py-3.5 text-center">
        <button class="print-receipt-btn px-2 py-1 bg-slate-100 border border-slate-205 hover:bg-indigo-50 border-slate-200 text-[10px] text-indigo-650 text-indigo-600 rounded-lg transition-all font-black hover:border-indigo-150 cursor-pointer" data-id="${t.id}">Cetak</button>
      </td>
    `;

    // Keep the log list visible: clicking a row button only updates the preview panel.
    tr.querySelector('.print-receipt-btn').addEventListener('click', () => {
      showThermalReceiptSimulator(t.id);
    });

    tbody.appendChild(tr);
  });

  // Write stats KPI
  document.getElementById('hist-total-revenue').textContent = formatIDR(totalRevenue);
  document.getElementById('hist-checkin-count').textContent = `${checkInsCount} trx`;
  document.getElementById('hist-checkout-count').textContent = `${checkOutsCount} trx`;

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="py-12 text-center text-slate-400 font-semibold">
          Tidak ada data transaksi finansial kasir tercatat untuk kriteria pembayaran terpilih.
        </td>
      </tr>
    `;
  }
}

function buildReceiptViewModel(trx, design) {
  const logoUrl = getReceiptLogoUrl(design);

  return {
    logoUrl,
    hotelName: design.hotelName || 'PituRooms',
    hotelAddress: design.hotelAddress || 'Jl. Sukowati No.33, Kalicacing, Kecamatan Sidomukti, Kota Salatiga, Jawa Tengah',
    hotelPhone: design.hotelPhone || '+62 878-8252-5777',
    transactionCode: trx.transactionCode || trx.id,
    formattedDate: new Date(trx.date).toLocaleString('id-ID'),
    guestName: trx.guestName || '-',
    roomLine: `${trx.roomType || '-'} (${trx.roomNumber || '-'})`,
    transactionType: trx.type || '-',
    paymentMethod: trx.paymentMethod || '-',
    totalAmount: formatIDR(trx.amount),
    cashierName: trx.resepsionis || 'Sistem HOS'
  };
}

function buildReceiptCardMarkup(model) {
  const logoBlock = model.logoUrl
    ? `<img src="${escapeReceiptHtml(model.logoUrl)}" alt="Logo Hotel" class="w-16 h-16 object-contain mx-auto mb-2" />`
    : '';

  return `
    <div class="text-center space-y-1">
      ${logoBlock}
      <h4 class="font-extrabold text-slate-900 text-xs tracking-tight uppercase">${escapeReceiptHtml(model.hotelName)}</h4>
      <p class="text-[9px] text-slate-400 leading-tight">Terima kasih telah berkunjung</p>
      <p class="text-[9px] text-slate-400 leading-none">${escapeReceiptHtml(model.hotelAddress)}</p>
      <p class="text-[8.5px] text-slate-400">Telp: ${escapeReceiptHtml(model.hotelPhone)}</p>
    </div>

    <div class="border-b border-dashed border-slate-300 py-1 flex justify-between text-[9px] text-slate-400 leading-none">
      <span>No: ${escapeReceiptHtml(model.transactionCode)}</span>
      <span>${escapeReceiptHtml(model.formattedDate)}</span>
    </div>

    <div class="space-y-1.5 py-1">
      <div class="flex justify-between gap-2">
        <span class="font-bold text-slate-400 uppercase">Tamu:</span>
        <span class="font-bold text-slate-800 text-right break-words max-w-[160px]">${escapeReceiptHtml(model.guestName)}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="font-bold text-slate-400 uppercase">Kamar:</span>
        <span class="font-bold text-slate-800 text-right break-words max-w-[160px]">${escapeReceiptHtml(model.roomLine)}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="font-bold text-slate-400 uppercase">Transaksi:</span>
        <span class="font-bold text-[#10b981] text-right uppercase">${escapeReceiptHtml(model.transactionType)}</span>
      </div>
      <div class="flex justify-between gap-2">
        <span class="font-bold text-slate-400 uppercase">Kanal Transaksi:</span>
        <span class="font-bold text-slate-800 text-right">${escapeReceiptHtml(model.paymentMethod)}</span>
      </div>
    </div>

    <div class="border-t border-b border-dashed border-slate-350 border-slate-300 py-3.5 flex justify-between text-xs my-2 font-black text-slate-900 leading-none bg-slate-50/50 px-2 rounded">
      <span>TOTAL :</span>
      <span>${escapeReceiptHtml(model.totalAmount)}</span>
    </div>

    <div class="text-center space-y-1 text-[8.5px] text-slate-400 pt-3">
      <p>Kasir/Penerima: ${escapeReceiptHtml(model.cashierName)}</p>
      <p class="font-bold uppercase tracking-widest text-[7px] mt-1 text-slate-350">*** TERIMA KASIH ATAS KUNJUNGAN KELUARGA ANDA ***</p>
    </div>
  `;
}

function getReceiptPrintStyles() {
  return `
    @page {
      size: 58mm auto;
      margin: 0;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 58mm;
      background: #fff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body{
        width:58mm;
        margin:0 auto;
        padding:0;
        font-family:Arial,Helvetica,sans-serif;
        font-size:9px;
        line-height:1.2;
        font-weight:600;
        color:#000;
    }

    .invoice-container {
        width: 54mm;
        max-width: 54mm;
        margin: 0 auto;
        padding: 2mm;
        box-sizing: border-box;
    }

    .invoice-card {
      background: #fcfcfc;
      border: 1px solid #d7def2;
      border-radius: 12px;
      padding: 14px;
      box-sizing: border-box;
    }

    .invoice-center {
      text-align: center;
    }

    .invoice-title {
      margin: 0;
      font-size:15px;
      font-weight:900;
      text-transform: uppercase;
      color: #000;
      letter-spacing: 0.2px;
    }

    .invoice-sub {
      margin: 0;
      font-size: 8px;
      color: #000000;
      line-height: 1.25;
      font-weight: 700;
    }

    .invoice-sub.small {
      font-size: 8.5px;
    }

    .invoice-meta {
      margin-top: 8px;
      padding: 6px 0;
      border-bottom: 1px dashed #d2d9e8;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
      font-size: 10px;
      color: #000000;
      font-weight: 700;
    }

    .invoice-section {
      margin-top: 10px;
      display: grid;
      gap: 7px;
    }

    .invoice-row{
        display:grid;
        grid-template-columns:70px 1fr;
        gap:4px;
        align-items:start;
    }

    .invoice-label {
      color: #000000;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      flex: 0 0 auto;
    }

    .invoice-value {
      color: #1f2937;
      font-size: 10px;
      font-weight: 700;
      text-align: right;
      max-width:120px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      flex: 1 1 auto;
    }

    .invoice-value.success {
      color: #10b981;
      text-transform: uppercase;
    }

    .invoice-total{
        margin-top:5px;
        border-top:1px dashed #000;
        border-bottom:1px dashed #000;
        padding:20px 0;

        display:grid;
        grid-template-columns:1fr auto;
        align-items:center;
        column-gap:20px;
    }

    .invoice-total-label{
        font-size:12px;
        font-weight:900;
    }

    .invoice-total-value{
        font-size:12px;
        font-weight:900;
        white-space:nowrap;
        text-align:right;
    }

    .invoice-footer {
      margin-top: 12px;
      text-align: center;
      color: #000;
      font-size: 8px;
      font-weight: 700;
    }

    .invoice-footer-note {
      margin-top: 4px;
      font-size: 8px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
    }

    *{
    color:#000 !important;
    text-shadow:none !important;
    box-shadow:none !important;
    filter:none !important;
    }
    
    img{
        image-rendering: crisp-edges;
    }

    .invoice-card{
        width:100%;
        padding:4px;
        border:none;
        border-radius:0;
        background:#fff;
    }

    @media print {
      .no-print,
      .dashboard-sidebar,
      #main-sidebar,
      #app-container > aside,
      header,
      nav,
      .navbar,
      .sidebar,
      .btn-print,
      button {
        display: none !important;
      }

    .invoice-container{
        width:54mm !important;
        max-width:54mm !important;
        margin:0 auto !important;
        padding:2mm !important;
    }

      .invoice-card {
        border-radius: 0 !important;
        border: 0 !important;
      }
    }
  `;
}

function buildReceiptPrintMarkup(model) {
  const logoBlock = model.logoUrl
    ? `<img src="${escapeReceiptHtml(model.logoUrl)}" alt="Logo Hotel" style="width:64px;height:64px;object-fit:contain;display:block;margin:0 auto 6px;" />`
    : '';

  return `
    <div class="invoice-container">
      <div class="invoice-card">
        <div class="invoice-center">
          ${logoBlock}
          <h1 class="invoice-title">${escapeReceiptHtml(model.hotelName)}</h1>
          <p class="invoice-sub">Terima kasih telah berkunjung</p>
          <p class="invoice-sub">${escapeReceiptHtml(model.hotelAddress)}</p>
          <p class="invoice-sub small">Telp: ${escapeReceiptHtml(model.hotelPhone)}</p>
        </div>

        <div class="invoice-meta">
          <span>No: ${escapeReceiptHtml(model.transactionCode)}</span>
          <span>${escapeReceiptHtml(model.formattedDate)}</span>
        </div>

        <div class="invoice-section">
          <div class="invoice-row">
            <span class="invoice-label">Tamu:</span>
            <span class="invoice-value">${escapeReceiptHtml(model.guestName)}</span>
          </div>
          <div class="invoice-row">
            <span class="invoice-label">Kamar:</span>
            <span class="invoice-value">${escapeReceiptHtml(model.roomLine)}</span>
          </div>
          <div class="invoice-row">
            <span class="invoice-label">Transaksi:</span>
            <span class="invoice-value success">${escapeReceiptHtml(model.transactionType)}</span>
          </div>
          <div class="invoice-row">
            <span class="invoice-label">Kanal Transaksi:</span>
            <span class="invoice-value">${escapeReceiptHtml(model.paymentMethod)}</span>
          </div>
        </div>

        <div class="invoice-total">
          <span class="invoice-total-label">TOTAL :</span>
          <span class="invoice-total-value">${escapeReceiptHtml(model.totalAmount)}</span>
        </div>

        <div class="invoice-footer">
          <div>Kasir/Penerima: ${escapeReceiptHtml(model.cashierName)}</div>
          <div class="invoice-footer-note">*** TERIMA KASIH ATAS KUNJUNGAN KELUARGA ANDA ***</div>
        </div>
      </div>
    </div>
  `;
}

function buildReceiptPrintDocument(model) {
  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Thermal Receipt - ${escapeReceiptHtml(model.transactionCode)}</title>
        <style>${getReceiptPrintStyles()}</style>
      </head>
      <body>
        ${buildReceiptPrintMarkup(model)}
      </body>
    </html>
  `;
}

function showThermalReceiptSimulator(trxId) {
  const prtBox = document.getElementById('receipt-printer-box');
  if (!prtBox) return;

  const trx = transactions.find(t => t.id === trxId);
  if (!trx) return;

  activeReceiptPreviewTrxId = trxId;
  const design = receiptDesignSettings || {};
  const model = buildReceiptViewModel(trx, design);

  prtBox.innerHTML = `
    <div class="bg-[#FCFCFC] border border-slate-250 border-indigo-100 p-5 rounded-xl shadow-inner text-left font-mono text-slate-700 text-[11px] animate-fadeIn leading-relaxed space-y-4">
      ${buildReceiptCardMarkup(model)}

      <div class="pt-3 border-t border-dashed border-slate-150 space-y-2">
        <div class="flex gap-2">
          <button onclick="printReceiptById('${trx.id}')" class="w-full bg-slate-950/90 hover:bg-slate-900 border text-white rounded-lg text-[9px] font-black px-2.5 py-2 uppercase select-none cursor-pointer text-center leading-none">Print Receipt</button>
        </div>
      </div>
    </div>
  `;
}

let activeReceiptPreviewTrxId = null;

function escapeReceiptHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReceiptLogoUrl(design) {
  const customLogoUrl = String(design?.logoUrl || '').trim();
  if (customLogoUrl) {
    return customLogoUrl;
  }

  try {
    return new URL('/image/Logo Piturooms.png', window.location.href).href;
  } catch (error) {
    return 'image/Logo Piturooms.png';
  }
}

function printReceiptById(transactionId) {
  const trx = transactions.find(item => item.id === transactionId || item.transactionCode === transactionId);
  if (!trx) {
    alert('Data transaksi tidak ditemukan untuk dicetak.');
    return;
  }

  const design = receiptDesignSettings || {};
  const model = buildReceiptViewModel(trx, design);

  const popup = window.open('', '_blank', 'width=320,height=560');
  if (!popup) {
    alert('Popup diblokir browser. Izinkan popup agar struk dapat dicetak otomatis.');
    return;
  }

  const receiptHtml = buildReceiptPrintDocument(model);

  popup.document.open();
  popup.document.write(receiptHtml);
  popup.document.close();

  popup.onload = () => {
    popup.focus();
    popup.print();
  };

  setTimeout(() => {
    try {
      popup.close();
    } catch (error) {
      console.warn('Gagal menutup popup print:', error);
    }
  }, 5000);
}

function triggerThermalPrint(trxId) {
  printReceiptById(trxId);
}

// === VIEW F: ADMIN EXECUTIVE DASHBOARD ===
function renderAdminDashboard() {
  const cFoodList = document.getElementById('culinary-food-list');
  if (!cFoodList) return;
  cFoodList.innerHTML = '';

  INITIAL_CULINARY_ORDERS.forEach(food => {
    const d = document.createElement('div');
    d.className = 'p-3 hover:bg-slate-50 transition border border-dashed border-slate-100 rounded-xl flex justify-between items-center';
    d.innerHTML = `
      <div class="leading-tight">
        <h5 class="font-extrabold text-slate-900 text-xs">${food.name}</h5>
        <p class="text-[9.5px] text-slate-400 font-bold mt-0.5 uppercase tracking-wide">${food.type}</p>
      </div>
      <div class="text-right flex items-center gap-3">
        <div class="leading-none text-right">
          <span class="text-xs font-black text-slate-850 text-slate-800 block">${food.ordersCount}x</span>
          <p class="text-[7.5px] text-slate-400 font-black tracking-wider uppercase mt-0.5 block leading-none">Kuantitas</p>
        </div>
        <span class="px-2 py-1 rounded text-[8.5px] font-black ${food.tagColor} border leading-none">${food.rating} ★</span>
      </div>
    `;
    cFoodList.appendChild(d);
  });
}

function handleEditRoom(roomId) {
  const room = rooms.find(r => r.id === roomId);
  if (!room) return;
  populateAddRoomForm(room);
  navigate('adminRooms');
}

function handleDeleteRoom(roomId) {
  if (typeof deleteRoomById === 'function') {
    deleteRoomById(roomId);
    return;
  }

  alert('Fungsi deleteRoomById belum tersedia. Muat ulang halaman terlebih dahulu.');
}

// === VIEW G: ADMIN ROOMS MANAGER ===
function renderAdminRooms() {
  const grid = document.getElementById('admin-rooms-list');
  if (!grid) return;
  grid.innerHTML = '';

  const filtered = rooms.filter(r => {
    if (currentAdminRoomsFilter === 'available') return r.status === 'Available';
    if (currentAdminRoomsFilter === 'occupied') return r.status === 'Occupied';
    if (currentAdminRoomsFilter === 'outoforder') return r.status === 'OutofOrder';
    return true;
  });

  filtered.forEach(room => {
    const isAvailable = room.status === 'Available';
    const isOccupied = room.status === 'Occupied';
    const isRepair = room.status === 'OutofOrder';
    const facilities = Array.isArray(room.facilities) ? room.facilities : [];
    const latePenalty = Number(room.lateCheckoutPenalty || 0);
    const miniBarPenalty = Number(room.miniBarPenalty || 0);
    const damagePenalty = Number(room.damagePenalty || 0);
    const hasPenaltyDefaults = (latePenalty + miniBarPenalty + damagePenalty) > 0;

    let selectBorder = 'border-slate-200 hover:border-indigo-300';
    let statusClass = 'text-slate-800';
    if (isAvailable) statusClass = 'text-emerald-700 bg-emerald-50 border-emerald-100 border';
    else if (isOccupied) statusClass = 'text-amber-700 bg-amber-50 border-amber-100 border';
    else if (isRepair) statusClass = 'text-rose-700 bg-rose-50 border-rose-100 border';

    const card = document.createElement('div');
    card.className = `p-4.5 bg-white border rounded-2xl shadow-sm transition-all ${selectBorder} text-xs font-semibold flex flex-col justify-between min-h-[220px] animate-fadeIn`;
    card.innerHTML = `
      <div class="flex flex-col items-center text-center gap-2">
        <div class="flex items-center justify-between w-full gap-3">
          <span class="text-[8.5px] text-slate-400 font-black uppercase tracking-[0.2em]">Unit ${room.number}</span>
          <span class="px-2.5 py-1 rounded-full text-[8.5px] font-black uppercase tracking-wider ${statusClass}">${room.status}</span>
        </div>
        <div class="w-full text-center">
          <h4 class="text-sm font-black text-slate-900 leading-tight">${room.type}</h4>
          <p class="text-[10px] text-slate-500 mt-1">Lantai ${room.floor || 1} • ${formatIDR(room.pricePerNight)} / malam</p>
          <div class="mt-2 flex items-center justify-center gap-1.5">
            <span class="px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wider ${hasPenaltyDefaults ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-500 border border-slate-200'}">
              ${hasPenaltyDefaults ? 'Denda Default Aktif' : 'Tanpa Denda Default'}
            </span>
          </div>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-100/70 leading-tight space-y-3">
        <div class="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[9px] text-slate-600 font-semibold grid grid-cols-1 gap-1">
          <div>Over Checkout: <span class="font-black text-slate-800">${formatIDR(latePenalty)}</span></div>
          <div>Mini Bar: <span class="font-black text-slate-800">${formatIDR(miniBarPenalty)}</span></div>
          <div>Kerusakan/Hilang: <span class="font-black text-slate-800">${formatIDR(damagePenalty)}</span></div>
        </div>

        <div class="flex flex-wrap justify-center gap-1.5">
          ${facilities.length ? facilities.map(f => `<span class="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">${f}</span>`).join('') : '<span class="px-2 py-1 rounded-full bg-slate-100 text-[9px] font-bold text-slate-600">Tanpa fasilitas</span>'}
        </div>
        
        <div class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
          <span class="text-[9px] uppercase font-bold tracking-[0.2em] text-slate-400">Set Status</span>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <select class="admin-room-status-select min-w-[132px] px-2.5 py-1.5 text-[10px] font-black border border-slate-200 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400" data-id="${room.id}">
              <option value="Available" ${isAvailable ? 'selected' : ''}>Available</option>
              <option value="Occupied" ${isOccupied ? 'selected' : ''}>Occupied</option>
              <option value="OutofOrder" ${isRepair ? 'selected' : ''}>Out of Order</option>
            </select>
            <button type="button" class="admin-room-edit-btn inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-600 px-2.5 py-1.5 text-[9px] font-black text-white shadow-sm transition hover:bg-indigo-700">
              <i data-lucide="pencil" class="w-3 h-3"></i>
              <span>Edit Room</span>
            </button>
            <button type="button" class="admin-room-delete-btn inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-600 px-2.5 py-1.5 text-[9px] font-black text-white shadow-sm transition hover:bg-rose-700">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
              <span>Delete Room</span>
            </button>
          </div>
        </div>
      </div>
    `;

    card.querySelector('.admin-room-status-select').addEventListener('change', (e) => {
      const targetRoom = rooms.find(rm => rm.id === room.id);
      if (targetRoom) {
        targetRoom.status = e.target.value;
        // PENTING: sebelumnya status hanya berubah di memori lokal browser ini saja (tidak pernah
        // ditulis ke Firebase), sehingga balik lagi ke status lama begitu ada snapshot realtime baru
        // atau dibuka di komputer lain. Sekarang didorong ke database agar konsisten di semua komputer.
        if (targetRoom.id && typeof updateRoomStatus === 'function') {
          updateRoomStatus(targetRoom.id, targetRoom.status).catch(err => console.warn('Gagal update status kamar ke Firebase:', err));
        }
        triggerSubRenderers();
      }
    });

    card.querySelector('.admin-room-edit-btn').addEventListener('click', () => {
      handleEditRoom(room.id);
    });

    card.querySelector('.admin-room-delete-btn').addEventListener('click', () => {
      handleDeleteRoom(room.id);
    });

    grid.appendChild(card);
  });

  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400 font-semibold">
        Tidak ada kamar terdaftar yang sesuai.
      </div>
    `;
  }
}

// === VIEW H: ADMIN USERS MANAGER ===
function renderAdminUsers() {
  const tbody = document.getElementById('admin-users-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  document.getElementById('admin-user-count').textContent = users.length;

  users.forEach(u => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50';

    const roleColor = u.role === 'Admin' ? 'text-emerald-700 bg-emerald-50 border-emerald-100 border' : 'text-blue-700 bg-blue-50 border-blue-100 border';

    tr.innerHTML = `
      <td class="px-6 py-4 font-black text-slate-800 tracking-tight leading-none">${u.fullname}</td>
      <td class="px-6 py-4 font-mono font-bold text-slate-500 text-xs">${u.username}</td>
      <td class="px-6 py-4 leading-none">
        <span class="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider ${roleColor}">${u.role}</span>
      </td>
      <td class="px-6 py-4 text-right">
        <div class="flex items-center justify-end gap-1.5 select-none">
          <button class="user-edit-btn px-2 py-1 bg-slate-50 border border-slate-200 text-indigo-600 font-black hover:bg-slate-100 rounded-lg text-[10px] cursor-pointer" data-id="${u.id}">Edit</button>
          <button class="user-del-btn px-2 py-1 bg-slate-50 border border-slate-205 text-rose-500 font-black hover:bg-rose-50 rounded-lg text-[10px] cursor-pointer" data-id="${u.id}">Hapus</button>
        </div>
      </td>
    `;

    tr.querySelector('.user-edit-btn').addEventListener('click', () => openAdminUserEdit(u.id));
    tr.querySelector('.user-del-btn').addEventListener('click', () => deleteAdminUser(u.id));

    tbody.appendChild(tr);
  });
}

function openAdminUserEdit(userId) {
  const user = users.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('admin-user-form-title').textContent = 'Ubah Akun Karyawan';
  document.getElementById('admin-user-form-sub').textContent = `Menyunting data akun #${user.username}`;
  document.getElementById('admin-user-edit-id').value = user.id;
  document.getElementById('admin-user-fullname').value = user.fullname;
  document.getElementById('admin-user-username').value = user.username;
  document.getElementById('admin-user-password').value = user.password;
  
  // Set role radio options
  document.querySelectorAll('input[name="admin-user-role"]').forEach(radio => {
    radio.checked = (radio.value === user.role);
  });

  // Display cancel option
  document.getElementById('admin-user-btn-cancel').classList.remove('hidden');
}

function cleanUserForms() {
  document.getElementById('admin-user-form-title').textContent = 'Registrasi Pengguna Baru';
  document.getElementById('admin-user-form-sub').textContent = 'Buat kredensial login unik HOS.';
  document.getElementById('admin-user-edit-id').value = '';
  document.getElementById('admin-user-fullname').value = '';
  document.getElementById('admin-user-username').value = '';
  document.getElementById('admin-user-password').value = '';
  document.getElementById('admin-user-btn-cancel').classList.add('hidden');
}

// === VIEW I: GUEST DATABASE CHEETS ===
function renderAdminGuests() {
  const tbody = document.getElementById('admin-guest-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const activeTransactions = transactions.filter(trx => trx && trx.isArchived !== true);

  // Dedupe rows so duplicated sync sources (Firestore + RTDB/local) only appear once.
  const dedupedMap = new Map();
  activeTransactions.forEach(trx => {
    const transactionCode = String(trx?.transactionCode || trx?.kodeTrx || '').trim().toUpperCase();
    const idAsCode = /^TRX\d{3,}$/i.test(String(trx?.id || '').trim())
      ? String(trx.id).trim().toUpperCase()
      : '';

    const rawDateValue = trx?.date || trx?.timestamp || trx?.createdAt || '';
    const parsedTime = new Date(rawDateValue).getTime();
    const minuteBucket = Number.isNaN(parsedTime)
      ? String(rawDateValue || '').trim()
      : Math.floor(parsedTime / 60000);

    const semanticKey = [
      String(trx?.type || trx?.activity || '').trim().toUpperCase(),
      String(trx?.guestName || '').trim().toUpperCase(),
      String(trx?.roomNumber || '').trim().toUpperCase(),
      String(trx?.paymentMethod || '').trim().toUpperCase(),
      String(Number(trx?.amount || 0)),
      String(minuteBucket)
    ].join('|');

    const key = transactionCode
      ? `CODE:${transactionCode}`
      : (idAsCode ? `CODE:${idAsCode}` : `SEM:${semanticKey}`);

    const existing = dedupedMap.get(key);
    if (!existing) {
      dedupedMap.set(key, trx);
      return;
    }

    const existingTime = new Date(existing.date || existing.timestamp || existing.createdAt || 0).getTime();
    const currentTime = new Date(trx.date || trx.timestamp || trx.createdAt || 0).getTime();
    const existingScore = Number(Boolean(existing.transactionCode)) + Number(Boolean(existing.cashierName)) + Number(Boolean(existing.roomType));
    const currentScore = Number(Boolean(trx.transactionCode)) + Number(Boolean(trx.cashierName)) + Number(Boolean(trx.roomType));

    if (currentScore > existingScore || currentTime > existingTime) {
      dedupedMap.set(key, trx);
    }
  });

  const dedupedTransactions = Array.from(dedupedMap.values());
  const methodCounts = {};
  let totalRevenue = 0;

  dedupedTransactions.forEach(trx => {
    totalRevenue += Number(trx.amount || 0);
    const method = String(trx.paymentMethod || 'Unknown').trim() || 'Unknown';
    methodCounts[method] = (methodCounts[method] || 0) + 1;
  });

  const popularMethod = Object.keys(methodCounts).length
    ? Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0][0]
    : '-';

  const kpiRevenue = document.getElementById('kpi-finance-revenue');
  const kpiCount = document.getElementById('kpi-finance-active-trx');
  const kpiMethod = document.getElementById('kpi-finance-method');
  if (kpiRevenue) kpiRevenue.textContent = formatIDR(totalRevenue);
  if (kpiCount) kpiCount.textContent = `${dedupedTransactions.length} trx`;
  if (kpiMethod) kpiMethod.textContent = popularMethod;

  const filtered = dedupedTransactions.filter(trx => {
    const activity = String(trx.type || trx.activity || '').trim().toLowerCase();
    let matchTab = true;
    if (currentGuestsTab === 'inhouse') matchTab = activity.includes('check in');
    else if (currentGuestsTab === 'pending') matchTab = activity.includes('check out');
    else if (currentGuestsTab === 'out') matchTab = !activity.includes('check in') && !activity.includes('check out');

    const whenRaw = trx.date || trx.timestamp || trx.createdAt || '';
    const searchTarget = [
      trx.id,
      trx.guestName,
      trx.roomNumber,
      trx.paymentMethod,
      trx.type,
      whenRaw
    ].join(' ').toLowerCase();
    const matchSearch = !searchFilterStr || searchTarget.includes(searchFilterStr.toLowerCase());

    return matchTab && matchSearch;
  });

  filtered.forEach(trx => {
    const displayTransactionCode = String(
      trx.kodeTrx || trx.transactionCode || trx.id || '-'
    ).trim() || '-';

    const activity = trx.type || trx.activity || '-';
    const isCheckIn = String(activity).toLowerCase().includes('check in');
    const isCheckOut = String(activity).toLowerCase().includes('check out');
    const activityBadge = isCheckIn
      ? '<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-50 border border-amber-100 text-amber-700">Check-In</span>'
      : isCheckOut
        ? '<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-emerald-50 border border-emerald-100 text-emerald-700">Check-Out</span>'
        : `<span class="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-slate-100 border border-slate-200 text-slate-700">${activity}</span>`;

    const whenRaw = trx.date || trx.timestamp || trx.createdAt;
    const dateObj = whenRaw ? new Date(whenRaw) : null;
    const whenText = dateObj && !Number.isNaN(dateObj.getTime())
      ? dateObj.toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      : '-';

    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50/50 leading-tight';
    tr.innerHTML = `
      <td class="px-6 py-4.5 font-mono font-black text-indigo-600">${displayTransactionCode}</td>
      <td class="px-6 py-4.5 text-slate-600 font-semibold">${whenText}</td>
      <td class="px-6 py-4.5 font-black text-slate-800">${trx.guestName || '-'}</td>
      <td class="px-6 py-4.5 text-slate-700 font-semibold">${trx.roomNumber ? `Kamar ${trx.roomNumber}` : '-'}</td>
      <td class="px-6 py-4.5">${activityBadge}</td>
      <td class="px-6 py-4.5 text-right font-mono font-extrabold text-slate-900">${formatIDR(Number(trx.amount || 0))}</td>
      <td class="px-6 py-4.5 text-center text-slate-700 font-bold">${trx.paymentMethod || '-'}</td>
    `;
    tbody.appendChild(tr);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="py-12 text-center text-slate-400 font-bold">
          Tidak ada data transaksi aktif yang cocok dengan filter saat ini.
        </td>
      </tr>
    `;
  }
}


// --- 5. MODAL FORM OVERLAYS ACTIONS ---

// Open add Form
function openAddReservationModal() {

loadReservationRoomDropdown();


const m =
document.getElementById(
'modal-add-reservation'
);


if(m){

m.classList.remove(
'hidden'
);


}


}

function calculateModalTotalPrice() {
  const type = document.getElementById('modal-add-res-room-type').value;
  const checkInDate = document.getElementById('modal-add-res-ci').value;
  const checkOutDate = document.getElementById('modal-add-res-co').value;
  const autoDays = calculateStayDurationDays(checkInDate, checkOutDate);
  const durationInput = document.getElementById('modal-add-res-duration');
  const days = autoDays > 0 ? autoDays : 1;
  const rate = getRoomTypePrice(type);

  if (durationInput) {
    durationInput.value = String(days);
  }
  
  document.getElementById('modal-add-res-total-price').textContent = formatIDR(rate * days);
}

// Open edit form in Admin reserves
function openEditReservationModal(resId) {
  const modal = document.getElementById('modal-edit-reservation');
  const res = reservations.find(r => r.id === resId);
  if (!modal || !res) return;

  modal.classList.remove('hidden');
  document.getElementById('modal-edit-id-label').textContent = `#${res.id}`;
  document.getElementById('modal-edit-id-field').value = res.id;
  document.getElementById('modal-edit-res-name').value = res.guestName;
  document.getElementById('modal-edit-res-identity').value = res.identityNo || '';
  document.getElementById('modal-edit-res-phone').value = res.phone;
  document.getElementById('modal-edit-res-email').value = res.email || '';
  document.getElementById('modal-edit-res-room-type').value = res.roomType;
  document.getElementById('modal-edit-res-ci').value = res.checkInDate;
  document.getElementById('modal-edit-res-co').value = res.checkOutDate;
  const editDuration = calculateStayDurationDays(res.checkInDate, res.checkOutDate) || res.durationDays || 1;
  document.getElementById('modal-edit-res-duration').value = editDuration;
  document.getElementById('modal-edit-res-room-number').value = res.roomNumber || '';
  document.getElementById('modal-edit-res-status').value = res.status;

  calculateModalEditTotalPrice();
}

function calculateModalEditTotalPrice() {
  const type = document.getElementById('modal-edit-res-room-type').value;
  const checkInDate = document.getElementById('modal-edit-res-ci').value;
  const checkOutDate = document.getElementById('modal-edit-res-co').value;
  const autoDays = calculateStayDurationDays(checkInDate, checkOutDate);
  const durationInput = document.getElementById('modal-edit-res-duration');
  const days = autoDays > 0 ? autoDays : 1;
  const rate = getRoomTypePrice(type);

  if (durationInput) {
    durationInput.value = String(days);
  }
  
  document.getElementById('modal-edit-res-total-price').textContent = formatIDR(rate * days);
}



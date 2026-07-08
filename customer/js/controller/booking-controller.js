// CONTROLLER: inisialisasi aplikasi, event binding, submit booking, Firebase, dan pencarian invoice
window.addEventListener("DOMContentLoaded", initApp, { once: true });

let mergedRoomCatalog = [];

async function initApp() {

  initFirebase();


  await loadRoomsFromDatabase();


  bindRoomCatalog();


  renderRoomOptions();


  setMinDates();


  bindEvents();



  setTimeout(() => {


    const params =
      new URLSearchParams(
        window.location.search
      );


    const selectedRoom =
      params.get("room");


    console.log(
      "ROOM DARI URL:",
      selectedRoom
    );


    if(selectedRoom){


      const select =
        $("booking-room-type");


      if(select){


        console.log(
          "OPTION:",
          [...select.options].map(
            o => o.value
          )
        );


        select.value =
          selectedRoom;


        // paksa trigger pilihan kamar
        select.dispatchEvent(
          new Event("change")
        );


        console.log(
          "KAMAR TERPILIH:",
          select.value
        );


      }


      updateSummary();


      renderSelectedRoomFacilities();


    }
  },800);
  if(
    document.getElementById("room-list")
  ){

    renderRoomCards();
  }
}


function initFirebase() {
  try {
    if (typeof firebase === "undefined") {
      console.warn("Firebase SDK belum dimuat.");
      return;
    }

    // firebase-config.js sudah dipanggil di HTML dan sudah menjalankan firebase.initializeApp().
    // Jadi di sini kita hanya mengambil database/auth yang sudah aktif.
    if (!firebase.apps.length) {
      console.error("Firebase belum diinisialisasi. Cek path ../firebase-config.js di Customer/index.html.");
      return;
    }

    firebaseDb = firebase.database();
    firebaseFirestore = firebase.firestore ? firebase.firestore() : null;
    firebaseAuth = firebase.auth ? firebase.auth() : null;

    console.log("Firebase customer aktif:", firebase.app().options.databaseURL);
  } catch (error) {
    firebaseDb = null;
    console.warn("Firebase tidak aktif:", error.message);
  }
}

async function loadRoomsFromDatabase() {
  if (!firebaseDb) {
    console.warn("Database belum siap");
    return;
  }

  try {
    const snapshot = await firebaseDb.ref("rooms").once("value");
    const rooms = [];
    snapshot.forEach(child => {
      const room = child.val();
      rooms.push({
        id: child.key,
        name:
          room.name ||
          room.type ||
          "Tanpa Nama",
        subtitle:
          room.description ||
          "Kamar nyaman untuk menginap.",
        price:
          Number(
            room.price ||
            room.pricePerNight ||
            0
          ),
        status:
          room.status ||
          "Available",
        facilities:
          Array.isArray(room.facilities)
          ? room.facilities
          : [],
        image:
          room.image ||
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200"
      });
    });


    console.log("ROOM CUSTOMER:", rooms);


    mergedRoomCatalog = rooms;

    setRoomCatalog(rooms);


  } catch(error) {

    console.error(
      "Gagal load kamar:",
      error
    );

  }

}

function bindEvents() {
  const form = $("booking-form");
  if (form) {
    form.addEventListener("submit", handleFormSubmit);
  }

  ["booking-room-type", "booking-quantity", "booking-checkin", "booking-checkout"].forEach(id => {
    const el = $(id);
    if (el) {
      el.addEventListener("input", updateSummary);
      el.addEventListener("change", updateSummary);
    }
  });

  const roomTypeSelect = $("booking-room-type");
  if (roomTypeSelect) {
    roomTypeSelect.addEventListener("change", handleRoomTypeChange);
  }

  document.querySelectorAll('input[name="payment-method"]').forEach(input => {
    input.addEventListener("change", updateSummary);
  });

  onClick("cancel-confirm-btn", closeConfirmModal);
  onClick("submit-confirm-btn", submitBooking);
  onClick("download-invoice-btn", downloadCurrentInvoice);
  onClick("close-success-btn", closeSuccessModal);
  onClick("search-invoice-btn", searchInvoiceByCode);
}



function onClick(id, handler) {
  const el = $(id);
  if (!el) return;

  el.addEventListener("click", function (event) {
    event.preventDefault();
    event.stopPropagation();
    handler(event);
  });
}



function setMinDates() {
  const today = new Date().toISOString().split("T")[0];
  const checkin = $("booking-checkin");
  const checkout = $("booking-checkout");

  if (checkin) checkin.min = today;
  if (checkout) checkout.min = today;

  if (checkin) {
    checkin.addEventListener("change", () => {
      if (checkout) checkout.min = checkin.value || today;
      updateSummary();
    });
  }
}

function bindRoomCatalog() {
  if (!firebaseDb) {
    console.warn('Firebase Database belum siap saat bindRoomCatalog dijalankan.');
    return;
  }

  const normalizeRoomEntry = (childSnapshot) => {
    const room = childSnapshot.val() || {};
    const rawFacilities = room.facilities || room.features || room.amenities || [];
    const facilities = Array.isArray(rawFacilities)
      ? rawFacilities
      : rawFacilities && typeof rawFacilities === 'object'
        ? Object.values(rawFacilities).filter(item => item)
        : String(rawFacilities || '').split(',').map(item => item.trim()).filter(Boolean);

    return {
      id: String(childSnapshot.key || '').trim(),
      name: String(room.name || room.type || room.roomType || room.title || room.titleRoom || room.label || '').trim() || 'Kamar',
      subtitle: String(room.subtitle || room.description || room.notes || room.typeDescription || room.summary || '').trim() || 'Kamar nyaman untuk menginap.',
      price: Number(room.pricePerNight || room.price || room.rate || 0),
      status: String(room.status || room.state || room.roomStatus || 'Available').trim(),
      facilities,
      image: String(room.image || room.photo || room.cover || room.thumbnail || '').trim() || 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200&h=800&fit=crop'
    };
  };

  const mergeRoomCatalog = (snapshot, sourceName) => {
    const rooms = [];
    snapshot.forEach(child => rooms.push(normalizeRoomEntry(child)));

    if (!rooms.length) {
      console.info(`Snapshot ${sourceName} kosong. Memeriksa tempat lain...`);
      return;
    }

    const merged = [...mergedRoomCatalog];
    rooms.forEach(room => {
      const key = String(room.id || room.name || '').trim().toLowerCase();
      if (!key) return;

      const existingIndex = merged.findIndex(item => String(item.id || item.name || '').trim().toLowerCase() === key);
      if (existingIndex >= 0) {
        merged[existingIndex] = { ...merged[existingIndex], ...room };
      } else {
        merged.push(room);
      }
    });

    mergedRoomCatalog = merged;
    setRoomCatalog(mergedRoomCatalog);
    renderRoomOptions();
    renderRoomCards();
    renderSelectedRoomFacilities();
    updateSummary();
  };

  const roomsRef = firebaseDb.ref('rooms');
  roomsRef.on('value', snapshot => mergeRoomCatalog(snapshot, '/rooms'), error => {
    console.warn('Gagal memuat data /rooms realtime:', error.message);
  });

  firebaseDb.ref('system_config/room_types').on('value', snapshot => mergeRoomCatalog(snapshot, '/system_config/room_types'), error => {
    console.warn('Gagal memuat data /system_config/room_types realtime:', error.message);
  });
}

function handleRoomTypeChange() {
  updateSummary();
  renderSelectedRoomFacilities();
}

function renderSelectedRoomFacilities() {
  const room = getRoom($("booking-room-type")?.value);
  const container = $("room-facilities");
  if (!container) return;

  if (!room || !room.facilities?.length) {
    container.innerHTML = `<div class="text-sm text-slate-600">Pilih tipe kamar untuk melihat fasilitas lengkap.</div>`;
    return;
  }

  container.innerHTML = room.facilities.map(item => `
    <div class="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
      ${escapeHtml(item)}
    </div>
  `).join("");
}

// function setSelectedRoom(roomId) {
//   const select = $("booking-room-type");
//   if (!select) return;
//   select.value = roomId;
//   updateSummary();
//   renderSelectedRoomFacilities();
//   const bookingSection = $("booking-section");
//   if (bookingSection) {
//     bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
//   }
// }

function setSelectedRoom(roomId){
  window.location.href =
    `booking.html?room=${roomId}`;

}
function renderRoomCards() {
  const container = $("room-list");
  if (!container) return;
  const rooms = typeof getAllRooms === "function"
    ? getAllRooms()
    : ROOMS;
  container.innerHTML = rooms.map(room => {
    const status =
      String(room.status || "")
      .toLowerCase();
    const isAvailable =
      status === "available";
    const isOccupied =
      status === "occupied";
    return `

    <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div class="relative overflow-hidden rounded-3xl bg-slate-100">
        <img 
        src="${escapeHtml(room.image)}" 
        alt="${escapeHtml(room.name)}" 
        class="h-44 w-full object-cover" />
      </div>
      <div class="mt-5">
        <div class="flex items-center justify-between gap-3">
          <div>
            <h3 class="text-xl font-semibold text-slate-900">
              ${escapeHtml(room.name)}
            </h3>
            <p class="mt-1 text-sm text-slate-500">
              ${escapeHtml(room.subtitle)}
            </p>
          </div>
          <span class="rounded-full px-3 py-1 text-xs font-semibold
          ${
            isAvailable
            ? "bg-emerald-100 text-emerald-700"
            : "bg-red-100 text-red-700"
          }">
          ${
            isAvailable
            ? "Available"
            : "Terisi"
          }
          </span>
        </div>
        <div class="mt-4">
          <p class="text-sm text-slate-500">
          Harga per malam
          </p>
          <p class="text-xl font-semibold text-slate-900">
          ${formatCurrency(room.price)}
          <span class="text-sm text-slate-500">
          / malam
          </span>
          </p>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${(room.facilities || [])
          .map(item => `
          <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
          ${escapeHtml(item)}
          </span>
          `).join("")}
        </div>
        <button
        type="button"
        class="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white transition
        ${
          isAvailable
          ? "bg-blue-600 hover:bg-blue-700"
          : "bg-red-500 cursor-not-allowed"
        }"
        data-room-id="${escapeHtml(room.id)}"
        ${isAvailable ? "" : "disabled"} >
        ${
          isAvailable
          ? "Pilih Kamar Ini"
          : "Terisi"
        }
        </button>
      </div>
    </article>
    `;
  }).join("");

  container
  .querySelectorAll(
    "button[data-room-id]"
  )
  .forEach(button => {


    button.addEventListener(
      "click",
      function(){

        const roomId =
        this.dataset.roomId;


        setSelectedRoom(
          roomId
        );

      }
    );


  });


}


function handleFormSubmit(event) {

  console.log("🔥 TOMBOL LANJUT DIKLIK");

  event.preventDefault();


  const data =
    collectBookingData();


  console.log(
    "DATA BOOKING:",
    data
  );


  const validation =
    validateBooking(data);


  console.log(
    "HASIL VALIDASI:",
    validation
  );



  if (!validation.valid) {


    console.warn(
      "VALIDASI GAGAL:",
      validation.message
    );


    showToast(
      validation.message
    );


    return;

  }



  pendingBookingData =
    data;


  console.log(
    "BUKA MODAL"
  );


  openConfirmModal(
    data
  );

}

async function sendInvoiceEmail(
 bookingData
){


 try{


  console.log(
   "KIRIM EMAIL INVOICE:",
   bookingData.email
  );



  const response =
  await fetch(
   "https://piturooms-api.vercel.app/api/send-invoice",
   {

    method:
    "POST",


    headers:{

     "Content-Type":
     "application/json"

    },


    body:
    JSON.stringify({


     email:
     bookingData.email,


     bookingCode:
     bookingData.bookingCode,


     invoiceHTML:
     bookingData.invoiceHTML


    })


   }
  );



  const result =
  await response.json();



  console.log(
   "HASIL EMAIL:",
   result
  );



  if(
   result.success
  ){


   console.log(
    "Invoice berhasil dikirim email"
   );


  }else{


   console.warn(
    "Invoice gagal:",
    result
   );


  }




 }catch(error){


  console.error(
   "ERROR SEND EMAIL:",
   error
  );


 }


}

async function submitBooking() {

  if (!pendingBookingData) return;


  const button =
  $("submit-confirm-btn");


  setButtonLoading(
    button,
    true,
    "Memproses..."
  );


  const bookingData = {

    ...pendingBookingData,

    bookingCode:
    generateBookingCode(),

    createdAt:
    new Date().toISOString(),

    updatedAt:
    new Date().toISOString()

  };


  bookingData.code =
  bookingData.bookingCode;


  bookingData.invoiceHTML =
  generateInvoiceHTML(
    bookingData
  );


  currentBookingData =
  bookingData;


  closeConfirmModal();


  openSuccessModal(
    bookingData,
    "Memproses booking..."
  );



  // =========================
  // CUSTOMER CASHLESS MIDTRANS
  // =========================

  if(
    bookingData.paymentMethod
    ?.toLowerCase()
    === "cashless"
  ){


    const response =
    await fetch(
      "https://piturooms-api.vercel.app/api/get-token",
      {

        method:"POST",

        headers:{
          "Content-Type":
          "application/json"
        },


        body:JSON.stringify({

          order_id:
          bookingData.bookingCode,


          gross_amount:
          bookingData.total ||
          bookingData.totalCharge ||
          bookingData.grandTotal,


          customer_details:{

            first_name:
            bookingData.name,

            email:
            bookingData.email,

            phone:
            bookingData.phone

          }

        })

      }
    );


    const result =
    await response.json();


    console.log(
      "MIDTRANS RESULT:",
      result
    );


    const snapToken =
    result.token ||
    result.snapToken ||
    result.snap_token;


    if(!snapToken){


      updateSuccessStatus(
        "Gagal membuat pembayaran Midtrans",
        "warn"
      );


      console.error(
        result
      );


      return;

    }
// ==========================
// SAVE BOOKING PENDING DULU
// ==========================

bookingData.paymentMethod =
"Cashless";

bookingData.paymentStatus =
"Pending Payment";

bookingData.status =
"Pending Payment";

bookingData.amountPaid =
0;


const pendingResult =
await saveBookingToFirebase(
 bookingData
);


if(
 pendingResult.success
){

 bookingData.id =
 pendingResult.id;


 bookingData.firebaseSaved =
 true;

}


    window.snap.pay(
      snapToken,
      {


        onSuccess:
async function(result){

 console.log(
  "MIDTRANS SUCCESS:",
  result
 );

 bookingData.status =
 "Confirmed";

 bookingData.paymentStatus =
 "Lunas";

 bookingData.amountPaid =
 bookingData.total ||
 bookingData.totalCharge ||
 bookingData.grandTotal;

 await firebaseDb
 .ref(
  "bookings/" +
  bookingData.id
 )
 .update({

  status:
  "Confirmed",

  paymentMethod: "Cashless",
  paymentStatus: "Lunas",
  amountPaid:bookingData.amountPaid,

  midtransOrderId:result.order_id,
  midtransTransactionId: result.transaction_id,
  midtransPaymentType:result.payment_type,

  paidAt:
  new Date()
  .toISOString(),

  updatedAt:
  new Date()
  .toISOString()

 });

pendingBookingData =
null;


updateSuccessStatus(
 "Pembayaran berhasil & Booking tersimpan",
 "ok"
);


// ==========================
// KIRIM INVOICE EMAIL RESEND
// ==========================

await sendInvoiceEmail(
 bookingData
);



// ==========================
// AKTIFKAN TOMBOL INVOICE
// ==========================

const invoiceBtn =
document.getElementById(
 "download-invoice-btn"
);


if(invoiceBtn){


 invoiceBtn.disabled =
 false;


 invoiceBtn.classList.remove(
  "opacity-50",
  "cursor-not-allowed"
 );


}


},
onPending:
function(result){


 console.log(
  "MIDTRANS PENDING:",
  result
 );


 updateSuccessStatus(
  "Menunggu pembayaran Midtrans",
  "warn"
 );


},


        onClose:function(){


  console.log(
    "CUSTOMER CLOSE MIDTRANS"
  );


  updateSuccessStatus(
    "Booking tersimpan. Menunggu pembayaran.",
    "warn"
  );


}


}
);



setButtonLoading(
 button,
 false,
 "Konfirmasi & Pesan"
);


return;


}

  const firebaseResult =
  await saveBookingToFirebase(
    bookingData
  );


  if(
    firebaseResult.success
  ){

    bookingData.id =
    firebaseResult.id;


    bookingData.firebaseSaved =
    true;


updateSuccessStatus(
 "Pembayaran berhasil & Booking tersimpan",
 "ok"
);


// KIRIM EMAIL INVOICE
await sendInvoiceEmail(
 bookingData
);


const invoiceBtn =
document.getElementById(
 "download-invoice-btn"

);

  }else{


    bookingData.firebaseSaved =
    false;


    updateSuccessStatus(
      "Eror. Cek Rules / koneksi.",
      "warn"
    );


    console.warn(
      firebaseResult.error
    );


  }



  setButtonLoading(
    button,
    false,
    "Konfirmasi & Pesan"
  );


  pendingBookingData =
  null;

}


async function saveBookingToFirebase(data) {
  const ready = await ensureFirebaseReady();

  if (!ready || !firebaseDb) {
    return { success: false, error: "Eror" };
  }

  try {
    const bookingRef = firebaseDb.ref("bookings").push();
    const record = buildFirebaseRecord(data);
    const safeCode = normalizeCode(data.bookingCode || data.code).replace(/[.#$\[\]\/]/g, "_");

    const updates = {};
    updates[`bookings/${bookingRef.key}`] = record;
    updates[`bookingCodes/${safeCode}`] = {
      bookingId: bookingRef.key,
      code: record.code,
      bookingCode: record.bookingCode,
      customerName: record.customerName,
      customerPhone: record.customerPhone,
      roomType: record.roomType,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt
    };

    await withTimeout(firebaseDb.ref().update(updates), FIREBASE_TIMEOUT_MS);

    if (firebaseFirestore) {
      const transactionId = `TRANS-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const transactionData = {
        transactionId,
        bookingId: bookingRef.key,
        bookingCode: record.bookingCode,
        customerName: record.customerName,
        customerPhone: record.customerPhone,
        roomName: record.roomName,
        paymentMethod: record.paymentMethod,
        paymentStatus: record.paymentStatus,
        subtotal: record.subtotal,
        tax: record.tax,
        total: record.total,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        source: "WEB_CUSTOMER"
      };
      await withTimeout(firebaseFirestore.collection("transactions").doc(transactionId).set(transactionData), FIREBASE_TIMEOUT_MS);
    }

    return { success: true, id: bookingRef.key };
  } catch (error) {
    return { success: false, error: error.message };
  }
}



async function ensureFirebaseReady() {
  try {
    if (!firebaseDb) initFirebase();
    if (!firebaseDb) return false;

    if (firebaseAuth && !firebaseAuth.currentUser) {
      try {
        await withTimeout(firebaseAuth.signInAnonymously(), 12000);
      } catch (authError) {
        console.warn("Anonymous auth tidak aktif / gagal:", authError.message);
      }
    }

    return true;
  } catch (error) {
    console.warn("Firebase belum siap:", error.message);
    return false;
  }
}



function downloadCurrentInvoice() {
  const data = currentBookingData;
  if (!data) {
    showToast("Data invoice belum tersedia.");
    return;
  }

  downloadInvoice(data);
}



async function searchInvoiceByCode() {
  const code = normalizeCode(val("invoice-code-input"));
  if (!code) {
    showToast("Masukkan kode booking terlebih dahulu.");
    return;
  }

  showToast("Mencari invoice...");

  const booking = await findBookingInFirebase(code);

  if (!booking) {
    showToast("Kode booking tidak ditemukan.");
    return;
  }

  currentBookingData = normalizeBookingForInvoice(booking);
  downloadInvoice(currentBookingData);
}



async function findBookingInFirebase(code) {
  if (!firebaseDb) return null;

  try {
    const snapshot = await withTimeout(firebaseDb.ref("bookings").once("value"), FIREBASE_TIMEOUT_MS);
    let found = null;

    snapshot.forEach(child => {
      const booking = { id: child.key, ...child.val() };
      const firebaseCode = normalizeCode(booking.bookingCode || booking.code);
      if (firebaseCode === code) found = booking;
    });

    return found;
  } catch (error) {
    console.warn("Firebase search failed:", error.message);
    return null;
  }
}

function resetFormAfterBooking(){
 const form =
 $("booking-form");
 if(form)
 form.reset();
 const section =
 $("booking-section");
 if(section){
 section.classList.add(
 "hidden"
 );
}
 renderRoomOptions();
 updateSummary();
}


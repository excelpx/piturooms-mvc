const firebaseConfig = {
  apiKey: "AIzaSyBFJvXh7FRHHzCSEDoI6sHE3KEfzruzQ1E",
  authDomain: "hotel-piturooms.firebaseapp.com",
  databaseURL: "https://hotel-piturooms-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hotel-piturooms",
  storageBucket: "hotel-piturooms.firebasestorage.app",
  messagingSenderId: "389991891524",
  appId: "1:389991891524:web:2ddcc165a1327c1d69f211",
  measurementId: "G-H720W6G44W"
};

// ============ INITIALIZE FIREBASE ============

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} else {
  console.error("Firebase SDK belum dimuat. Pastikan script firebase compat sudah dipanggil di HTML.");
}

const auth = firebase.auth();
const database = firebase.database();
const firestore = typeof firebase.firestore === "function" ? firebase.firestore() : null;

// ============ GLOBAL STATE ============

let currentUser = null;
let userRole = null;

// ============ AUTHENTICATION FUNCTIONS ============

async function firebaseLogin(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    currentUser = result.user;

    const userRef = database.ref(`users/${currentUser.uid}`);
    const snapshot = await userRef.once("value");
    const userData = snapshot.val();

    if (userData) {
      userRole = userData.role;

      await userRef.update({
        lastLogin: new Date().toISOString()
      });

      return {
        success: true,
        user: currentUser,
        role: userData.role,
        userData
      };
    }

    return {
      success: false,
      error: "User role not found"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function firebaseRegister(email, password, userData) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    const uid = result.user.uid;

    await database.ref(`users/${uid}`).set({
      email: email,
      name: userData.name || "Customer",
      phone: userData.phone || "",
      role: "customer",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString()
    });

    currentUser = result.user;
    userRole = "customer";

    return {
      success: true,
      uid
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function firebaseLogout() {
  try {
    await auth.signOut();
    currentUser = null;
    userRole = null;

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function getCurrentUser() {
  return new Promise((resolve) => {
    auth.onAuthStateChanged(user => {
      currentUser = user;

      if (user) {
        database.ref(`users/${user.uid}`).once("value", snapshot => {
          const userData = snapshot.val();
          userRole = userData ? userData.role : null;

          resolve({
            user,
            role: userRole,
            userData
          });
        });
      } else {
        resolve(null);
      }
    });
  });
}

// ============ ROOMS FUNCTIONS ============

async function getRooms(filterStatus = null) {
  try {
    const snapshot = await database.ref("rooms").once("value");
    const rooms = [];

    snapshot.forEach(childSnapshot => {
      const room = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };

      if (!filterStatus || room.status === filterStatus) {
        rooms.push(room);
      }
    });

    return {
      success: true,
      rooms
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getRoom(roomId) {
  try {
    const snapshot = await database.ref(`rooms/${roomId}`).once("value");
    const room = snapshot.val();

    if (room) {
      return {
        success: true,
        room: {
          id: roomId,
          ...room
        }
      };
    }

    return {
      success: false,
      error: "Room not found"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function updateRoomStatus(roomId, status) {
  try {
    await database.ref(`rooms/${roomId}`).update({
      status: status,
      lastUpdated: new Date().toISOString()
    });

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function addRoom(roomData) {
  try {
    const newRoomRef = database.ref("rooms").push();

    await newRoomRef.set({
      number: roomData.number,
      type: roomData.type,
      price: roomData.price,
      capacity: roomData.capacity || 2,
      floor: roomData.floor || 1,
      status: roomData.status || "Available",
      facilities: roomData.facilities || [],
      images: roomData.images || [],
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    });

    return {
      success: true,
      roomId: newRoomRef.key
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============ BOOKINGS FUNCTIONS ============

async function getBookings(filterStatus = null, customerId = null) {
  try {
    const snapshot = await database.ref("bookings").once("value");
    const bookings = [];

    snapshot.forEach(childSnapshot => {
      const booking = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };

      let include = true;

      if (filterStatus && booking.status !== filterStatus) include = false;
      if (customerId && booking.customerId !== customerId) include = false;

      if (include) bookings.push(booking);
    });

    return {
      success: true,
      bookings
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getBookingByCode(code) {
  try {
    const cleanCode = normalizeBookingCode(code);
    const snapshot = await database.ref("bookings").once("value");

    let foundBooking = null;

    snapshot.forEach(childSnapshot => {
      const booking = {
        id: childSnapshot.key,
        ...childSnapshot.val()
      };

      const firebaseCode = normalizeBookingCode(
        booking.code ||
        booking.bookingCode ||
        booking.otaCode ||
        booking.reservationCode ||
        booking.invoiceCode
      );

      if (firebaseCode === cleanCode) {
        foundBooking = booking;
      }
    });

    if (foundBooking) {
      return {
        success: true,
        booking: foundBooking
      };
    }

    return {
      success: false,
      error: "Kode booking tidak ditemukan"
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function createBooking(bookingData) {
  try {
    const bookingCode = bookingData.bookingCode || bookingData.code || generateBookingCode();
    const newBookingRef = database.ref("bookings").push();
    const customerId = bookingData.customerId || (currentUser ? currentUser.uid : "guest");

    const paymentStatus = bookingData.paymentMethod === "Cash" ? "Belum Dibayar" : "Lunas";

    const bookingRecord = {
      code: bookingCode,
      bookingCode: bookingCode,

      customerId: customerId,
      customerName: bookingData.customerName || bookingData.name || "",
      customerEmail: bookingData.customerEmail || bookingData.email || "",
      customerPhone: bookingData.customerPhone || bookingData.phone || "",

      guestName: bookingData.guestName || bookingData.customerName || bookingData.name || "",

      roomId: bookingData.roomId || "",
      roomType: bookingData.roomType || "",
      roomName: bookingData.roomName || "",
      roomNumber: bookingData.roomNumber || "",

      checkIn: bookingData.checkIn || bookingData.checkin || "",
      checkOut: bookingData.checkOut || bookingData.checkout || "",
      duration: bookingData.duration || 1,
      quantity: bookingData.quantity || 1,

      pricePerNight: bookingData.pricePerNight || 0,
      subtotal: bookingData.subtotal || 0,
      tax: bookingData.tax || 0,
      total: bookingData.total || 0,

      paymentMethod: bookingData.paymentMethod || "",
      paymentSubMethod: bookingData.paymentSubMethod || bookingData.paymentMethod || "",
      paymentStatus: bookingData.paymentStatus || paymentStatus,

      status: bookingData.status || "Confirmed",
      source: bookingData.source || "ONLINE_OTA",

      notes: bookingData.notes || "",
      specialRequests: bookingData.specialRequests || "",
      invoiceHTML: bookingData.invoiceHTML || bookingData.html || "",

      createdAt: bookingData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await newBookingRef.set(bookingRecord);

    return {
      success: true,
      bookingId: newBookingRef.key,
      bookingCode: bookingCode,
      booking: {
        id: newBookingRef.key,
        ...bookingRecord
      }
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function updateBookingStatus(bookingId, status) {
  try {
    await database.ref(`bookings/${bookingId}`).update({
      status: status,
      updatedAt: new Date().toISOString()
    });

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkInGuest(bookingId, roomNumber) {
  try {
    const updateData = {
      status: "CheckedIn",
      roomNumber: roomNumber || "",
      checkedInAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (currentUser && currentUser.uid) {
      updateData.checkInBy = currentUser.uid;
    }

    await database.ref(`bookings/${bookingId}`).update(updateData);

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function checkOutGuest(bookingId, surcharges = 0) {
  try {
    await database.ref(`bookings/${bookingId}`).update({
      status: "CheckedOut",
      surcharges: surcharges || 0,
      checkedOutAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return {
      success: true
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============ TRANSACTIONS FUNCTIONS ============

async function recordTransaction(transactionData) {
  try {
    const newTransRef = database.ref("transactions").push();
    const readableCode = String(transactionData.transactionCode || transactionData.code || "").trim();
    const cashierName = transactionData.cashierName || transactionData.cashier_name || transactionData.processedBy || "";
    const payload = {
      id: newTransRef.key,
      transactionCode: readableCode,
      bookingId: transactionData.bookingId || "",
      guestName: transactionData.guestName || "",
      roomType: transactionData.roomType || "",
      roomNumber: transactionData.roomNumber || "",
      cashierName: cashierName,
      cashier_name: cashierName,
      type: transactionData.type || "",
      amount: transactionData.amount || 0,
      paymentMethod: transactionData.paymentMethod || "",
      processedBy: transactionData.processedBy || "",
      date: transactionData.date || new Date().toISOString(),
      timestamp: new Date().toISOString(),
      notes: transactionData.notes || "",
      isArchived: false
    };

    await newTransRef.set(payload);

    if (firestore) {
      await firestore.collection("transactions").doc(newTransRef.key).set(payload, { merge: true });
    }

    return {
      success: true,
      transactionId: newTransRef.key
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function getTransactions(limit = 50) {
  try {
    const snapshot = await database.ref("transactions")
      .orderByChild("timestamp")
      .limitToLast(limit)
      .once("value");

    const transactions = [];

    snapshot.forEach(childSnapshot => {
      transactions.unshift({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    return {
      success: true,
      transactions
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// ============ REAL-TIME LISTENERS ============

function listenToRooms(callback) {
  database.ref("rooms").on("value", snapshot => {
    const rooms = [];

    snapshot.forEach(childSnapshot => {
      rooms.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    callback(rooms);
  });

  return () => database.ref("rooms").off();
}

function listenToBookings(callback) {
  database.ref("bookings").on("value", snapshot => {
    const bookings = [];

    snapshot.forEach(childSnapshot => {
      bookings.push({
        id: childSnapshot.key,
        ...childSnapshot.val()
      });
    });

    callback(bookings);
  });

  return () => database.ref("bookings").off();
}

function listenActiveTransactionsByCashier(cashierName, callback, onError) {
  if (!firestore) {
    if (typeof onError === "function") {
      onError(new Error("Firestore tidak tersedia"));
    }
    return () => {};
  }

  const normalizedCashier = String(cashierName || "").trim();
  if (!normalizedCashier) {
    if (typeof callback === "function") callback([]);
    return () => {};
  }

  const query = firestore
    .collection("transactions")
    .where("cashier_name", "==", normalizedCashier)
    .where("isArchived", "==", false);

  const unsubscribe = query.onSnapshot(snapshot => {
    const rows = [];
    snapshot.forEach(doc => {
      rows.push({
        id: doc.id,
        sourceCollection: "transactions",
        ...doc.data()
      });
    });

    rows.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.date || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.date || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    if (typeof callback === "function") callback(rows);
  }, err => {
    if (typeof onError === "function") onError(err);
  });

  return unsubscribe;
}

function listenToBooking(bookingId, callback) {
  database.ref(`bookings/${bookingId}`).on("value", snapshot => {
    const booking = snapshot.val();

    if (booking) {
      callback({
        id: bookingId,
        ...booking
      });
    }
  });

  return () => database.ref(`bookings/${bookingId}`).off();
}

// CATATAN PENTING: Fasilitas kamar sengaja memakai Realtime Database (`database`), BUKAN Firestore.
// Sebelumnya fitur ini pakai Firestore ("facilities" collection), tapi Firestore secara default
// (project baru / "start in production mode") menolak semua read/write kalau Security Rules belum
// dikonfigurasi eksplisit — sementara Realtime Database di project ini SUDAH terbukti bekerja untuk
// rooms/reservations/staff_accounts/transactions. Akibatnya data fasilitas yang ditambahkan admin
// tampak berhasil sesaat (optimistic UI) tapi sebenarnya gagal tersimpan, sehingga hilang lagi
// begitu halaman di-refresh atau dibuka di komputer lain. Memakai `database` yang sama menghilangkan
// masalah ini tanpa perlu admin mengatur Security Rules Firestore secara terpisah.
const FACILITIES_DB_PATH = "facilities";

async function getFacilities() {
  if (typeof database === "undefined" || !database || typeof database.ref !== "function") {
    return { success: false, error: "Realtime Database tidak tersedia" };
  }

  try {
    const snapshot = await database.ref(FACILITIES_DB_PATH).once("value");
    const facilities = [];
    snapshot.forEach(child => {
      facilities.push({ id: child.key, ...(child.val() || {}) });
    });

    facilities.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    return { success: true, facilities };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function listenFacilitiesRealtime(callback, onError) {
  if (typeof database === "undefined" || !database || typeof database.ref !== "function") {
    if (typeof onError === "function") onError(new Error("Realtime Database tidak tersedia"));
    return () => {};
  }

  const facilitiesRef = database.ref(FACILITIES_DB_PATH);
  const onValue = snapshot => {
    const facilities = [];
    snapshot.forEach(child => {
      facilities.push({ id: child.key, ...(child.val() || {}) });
    });

    facilities.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    if (typeof callback === "function") callback(facilities);
  };

  facilitiesRef.on("value", onValue, err => {
    if (typeof onError === "function") onError(err);
  });

  return () => facilitiesRef.off("value", onValue);
}

async function addFacility(facilityName) {
  if (typeof database === "undefined" || !database || typeof database.ref !== "function") {
    return { success: false, error: "Realtime Database tidak tersedia" };
  }

  try {
    const name = String(facilityName || "").trim();
    if (!name) {
      return { success: false, error: "Nama fasilitas tidak boleh kosong" };
    }

    const nameLower = name.toLowerCase();
    const snapshot = await database.ref(FACILITIES_DB_PATH).once("value");
    let isDuplicate = false;
    snapshot.forEach(child => {
      const value = child.val() || {};
      if (String(value.nameLower || value.name || "").toLowerCase() === nameLower) {
        isDuplicate = true;
      }
    });

    if (isDuplicate) {
      return { success: false, error: "Fasilitas sudah ada" };
    }

    const newRef = database.ref(FACILITIES_DB_PATH).push();
    await newRef.set({
      name,
      nameLower,
      createdAt: new Date().toISOString()
    });

    return { success: true, id: newRef.key };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFacility(facilityId) {
  if (typeof database === "undefined" || !database || typeof database.ref !== "function") {
    return { success: false, error: "Realtime Database tidak tersedia" };
  }

  try {
    const id = String(facilityId || "").trim();
    if (!id) {
      return { success: false, error: "ID fasilitas tidak valid" };
    }

    await database.ref(`${FACILITIES_DB_PATH}/${id}`).remove();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============ HELPER FUNCTIONS ============

function generateBookingCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PITU-";

  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return code;
}

function normalizeBookingCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(Number(amount) || 0);
}

function formatDate(date) {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(new Date(date));
}

function isAuthenticated() {
  return currentUser !== null;
}

function hasRole(roles) {
  if (typeof roles === "string") roles = [roles];
  return roles.includes(userRole);
}

async function saveReceiptSettings(configData) {
  if (!firestore) {
    return {
      success: false,
      error: "Firestore tidak tersedia"
    };
  }

  try {
    const payload = {
      cloudinaryCloudName: configData.cloudinaryCloudName || "[CLOUD_NAME]",
      cloudinaryUploadPreset: configData.cloudinaryUploadPreset || "[UPLOAD_PRESET]",
      thermalPrinterName: configData.thermalPrinterName || "",
      hotelName: configData.hotelName || "",
      hotelAddress: configData.hotelAddress || "",
      hotelPhone: configData.hotelPhone || "",
      logoUrl: configData.logoUrl || "",
      updatedAt: new Date().toISOString()
    };

    await firestore.collection("settings").doc("receipt_design").set(payload, { merge: true });

    return {
      success: true,
      settings: payload
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function loadReceiptSettings() {
  if (!firestore) {
    return {
      success: false,
      error: "Firestore tidak tersedia"
    };
  }

  try {
    const snapshot = await firestore.collection("settings").doc("receipt_design").get();
    const settings = snapshot.exists ? (snapshot.data() || {}) : {};

    return {
      success: true,
      settings
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function fetchActiveTransactions() {
  try {
    const collections = ["transactions", "payments"];
    const mergedTransactions = [];
    const seenIds = new Set();

    if (firestore) {
      for (const collectionName of collections) {
        const snapshot = await firestore
          .collection(collectionName)
          .where("isArchived", "==", false)
          .get();

        snapshot.forEach(doc => {
          const key = `${collectionName}:${doc.id}`;
          if (seenIds.has(key)) return;
          seenIds.add(key);

          mergedTransactions.push({
            id: doc.id,
            sourceCollection: collectionName,
            ...doc.data()
          });
        });
      }
    }

    for (const collectionName of collections) {
      const snapshot = await database.ref(collectionName).once("value");
      snapshot.forEach(childSnapshot => {
        const value = childSnapshot.val() || {};
        if (value.isArchived === true) return;

        const key = `${collectionName}:${childSnapshot.key}`;
        if (seenIds.has(key)) return;
        seenIds.add(key);

        mergedTransactions.push({
          id: childSnapshot.key,
          sourceCollection: collectionName,
          ...value
        });
      });
    }

    mergedTransactions.sort((a, b) => {
      const aTime = new Date(a.timestamp || a.date || a.createdAt || 0).getTime();
      const bTime = new Date(b.timestamp || b.date || b.createdAt || 0).getTime();
      return bTime - aTime;
    });

    return {
      success: true,
      transactions: mergedTransactions
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function executeTutupBukuBatch() {
  try {
    const txnCollections = ["transactions", "payments"];
    const nowIso = new Date().toISOString();
    let archivedTransactions = 0;
    let resetRooms = 0;

    // 1) Firestore batch (jika tersedia)
    if (firestore) {
      const fsBatch = firestore.batch();
      const serverTs = firebase.firestore.FieldValue.serverTimestamp();

      for (const collectionName of txnCollections) {
        const activeSnap = await firestore
          .collection(collectionName)
          .where("isArchived", "==", false)
          .get();

        activeSnap.forEach(doc => {
          fsBatch.update(doc.ref, {
            isArchived: true,
            archivedAt: serverTs,
            updatedAt: serverTs
          });
          archivedTransactions += 1;
        });
      }

      const occupiedRoomsSnap = await firestore
        .collection("rooms")
        .where("status", "==", "Occupied")
        .get();

      occupiedRoomsSnap.forEach(doc => {
        fsBatch.update(doc.ref, {
          status: "Available",
          lastUpdated: serverTs,
          updatedAt: serverTs
        });
        resetRooms += 1;
      });

      if (archivedTransactions > 0 || resetRooms > 0) {
        await fsBatch.commit();
      }
    }

    // 2) Realtime Database multi-location update (selalu dijalankan)
    const rtdbUpdates = {};
    let rtdbArchivedTransactions = 0;
    let rtdbResetRooms = 0;

    for (const collectionName of txnCollections) {
      const activeSnap = await database.ref(collectionName).once("value");
      activeSnap.forEach(childSnapshot => {
        const value = childSnapshot.val() || {};
        if (value.isArchived === true) return;

        const basePath = `${collectionName}/${childSnapshot.key}`;
        rtdbUpdates[`${basePath}/isArchived`] = true;
        rtdbUpdates[`${basePath}/archivedAt`] = nowIso;
        rtdbUpdates[`${basePath}/updatedAt`] = nowIso;
        rtdbArchivedTransactions += 1;
      });
    }

    const occupiedRoomsSnap = await database.ref("rooms").once("value");
    occupiedRoomsSnap.forEach(childSnapshot => {
      const value = childSnapshot.val() || {};
      if (String(value.status || "") !== "Occupied") return;

      const basePath = `rooms/${childSnapshot.key}`;
      rtdbUpdates[`${basePath}/status`] = "Available";
      rtdbUpdates[`${basePath}/lastUpdated`] = nowIso;
      rtdbUpdates[`${basePath}/updatedAt`] = nowIso;
      rtdbResetRooms += 1;
    });

    if (Object.keys(rtdbUpdates).length > 0) {
      await database.ref().update(rtdbUpdates);
    }

    // Ambil jumlah terbesar agar tidak double count ketika data tersimpan di dua backend.
    archivedTransactions = Math.max(archivedTransactions, rtdbArchivedTransactions);
    resetRooms = Math.max(resetRooms, rtdbResetRooms);

    if (archivedTransactions === 0 && resetRooms === 0) {
      return {
        success: true,
        archivedTransactions: 0,
        resetRooms: 0,
        message: "Tidak ada data aktif yang perlu ditutup buku"
      };
    }

    return {
      success: true,
      archivedTransactions,
      resetRooms
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
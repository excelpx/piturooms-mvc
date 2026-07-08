const TAX_RATE = 0.10;
const FIREBASE_TIMEOUT_MS = 25000;
let ROOMS = [];

async function loadRoomsFromDatabase(){
  if (!firebaseDb && typeof database === "undefined") {
    console.warn(
      "Firebase database tidak tersedia saat loadRoomsFromDatabase dijalankan."
    );
    return;
  }
  try {
    const dbRef =
      firebaseDb
        ? firebaseDb.ref("rooms")
        : database.ref("rooms");
    const snapshot =
      await dbRef.once("value");
    const data =
      snapshot.val();

    ROOMS =
      Object.entries(data || {})
      .map(([id, room]) => ({
        id: id,
        number:
          room.number || "",
        name:
          room.name ||
          room.type ||
          "Kamar",
        type:
          room.type ||
          room.name ||
          "Kamar",
        price:
          Number(
            room.price ||
            room.pricePerNight ||
            0
          ),
        pricePerNight:
          Number(
            room.pricePerNight ||
            room.price ||
            0
          ),
        facilities:
          room.facilities || [],
        status:
          String(
            room.status ||
            "Available"
          ).trim(),
        image:
          room.image ||
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1200"
      }));
    setRoomCatalog(ROOMS);
    if(typeof mergedRoomCatalog !== "undefined"){

      mergedRoomCatalog = [...ROOMS];

    }
    console.log(
      "ROOM DATABASE FIX:",
      ROOMS
    );
  } catch(error){
    console.error(
      "Gagal load kamar:",
      error
    );
  }
}

let ROOM_CATALOG = [...ROOMS];
let firebaseDb = null;
let firebaseAuth = null;
let currentBookingData = null;
let pendingBookingData = null;
let toastTimer = null;


// ===== MODEL FUNCTIONS =====
function collectBookingData() {
  const roomId = normalizeRoomType(
    val("booking-room-type")
  );
  const room = getRoom(roomId) || {};
  const quantity =
    Math.max(
      1,
      Number(val("booking-quantity")) || 1
    );
  const checkIn =
    val("booking-checkin");
  const checkOut =
    val("booking-checkout");
  const duration =
    calculateDuration(
      checkIn,
      checkOut
    );
  const price =
    Number(
      room.price ||
      room.pricePerNight ||
      0
    );
  const subtotal =
    duration > 0
      ? price * duration * quantity
      : 0;
  const tax =
    Math.round(
      subtotal * TAX_RATE
    );
  const total =
    subtotal + tax;
  const paymentMethod =
  String(getPaymentMethod())
  .toLowerCase();
  const paymentStatus =
  paymentMethod === "cash"
    ? "Belum Lunas"
    : "Lunas";

  return {
    bookingCode: "",
    name:
      val("booking-name"),
    email:
      val("booking-email"),
    phone:
      val("booking-phone"),
    identity:
      val("booking-identity"),
    guestName:
      val("booking-guest-name") ||
      val("booking-name"),

    roomType:
      room.id || "",

    roomName:
      room.name ||
      room.type ||
      "",
    pricePerNight:
      price,
    quantity,
    checkIn,
    checkOut,
    duration,
    subtotal,
    tax,
    total,
    paymentMethod,
    paymentStatus,
    notes: val("booking-notes"),
    status:"Confirmed",
    source: "ONLINE_OTA"
  };
}



function validateBooking(data) {
  if (!data.name || !data.email || !data.phone || !data.identity || !data.checkIn || !data.checkOut) {
    return { valid: false, message: "Lengkapi semua data yang bertanda *." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
    return { valid: false, message: "Format email belum benar." };
  }

  if (data.duration <= 0) {
    return { valid: false, message: "Tanggal check-out harus setelah check-in." };
  }

  return { valid: true };
}



function buildFirebaseRecord(data) {
  const roomType = normalizeRoomType(data.roomType);
  const room = getRoom(roomType);

  return {
    code: data.bookingCode,
    bookingCode: data.bookingCode,
    customerId: "guest",
    customerName: data.name,
    customerEmail: data.email,
    customerPhone: data.phone,
    identity: data.identity,
    guestName: data.guestName,
    roomId: roomType,
    roomType,
    roomName: data.roomName || room.name,
    roomNumber: "",
    checkIn: data.checkIn,
    checkOut: data.checkOut,
    duration: data.duration,
    quantity: data.quantity,
    pricePerNight: data.pricePerNight,
    subtotal: data.subtotal,
    tax: data.tax,
    total: data.total,
    paymentMethod: data.paymentMethod,
    paymentSubMethod: data.paymentMethod,
    paymentStatus: data.paymentStatus,
    status: data.status,
    source: data.source,
    notes: data.notes || "",
    invoiceHTML: data.invoiceHTML,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt
  };
}



function normalizeBookingForInvoice(booking) {
  const roomType = normalizeRoomType(booking.roomType || booking.roomName);
  const room = getRoom(roomType);

  return {
    bookingCode: booking.bookingCode || booking.code,
    code: booking.bookingCode || booking.code,
    name: booking.name || booking.customerName,
    email: booking.email || booking.customerEmail,
    phone: booking.phone || booking.customerPhone,
    identity: booking.identity || "-",
    guestName: booking.guestName || booking.customerName || booking.name,
    roomType,
    roomName: booking.roomName || room.name,
    pricePerNight: Number(booking.pricePerNight || room.price || 0),
    quantity: Number(booking.quantity || 1),
    checkIn: booking.checkIn || booking.checkin,
    checkOut: booking.checkOut || booking.checkout,
    duration: Number(booking.duration || 0),
    subtotal: Number(booking.subtotal || 0),
    tax: Number(booking.tax || 0),
    total: Number(booking.total || 0),
    paymentMethod: booking.paymentMethod || "-",
    paymentStatus: booking.paymentStatus || "-",
    notes: booking.notes || "",
    invoiceHTML: booking.invoiceHTML || ""
  };
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("Firebase timeout")), ms))
  ]);
}




function normalizeRoomType(roomType) {
  const value =
    String(roomType || "")
      .trim()
      .toLowerCase();
  if (!value) {
    return "";
  }
  const rooms = getAllRooms();
  const exactMatch =
    rooms.find(room =>
      String(room.id || "")
        .toLowerCase() === value
    );
  if (exactMatch) {
    return exactMatch.id;
  }
  const nameMatch =
    rooms.find(room =>
      String(
        room.name ||
        room.type ||
        ""
      )
      .toLowerCase()
      .includes(value)
    );
  if (nameMatch) {
    return nameMatch.id;
  }
  return roomType;
}

function getRoom(roomId) {
  const key = String(roomId || "").trim().toLowerCase();
  const collection = ROOM_CATALOG.length ? ROOM_CATALOG : ROOMS;
  const matchById = collection.find(room => String(room.id || "").toLowerCase() === key);
  if (matchById) return matchById;

  const matchByName = collection.find(room => String(room.name || "").toLowerCase() === key || String(room.name || "").toLowerCase().includes(key));
  if (matchByName) return matchByName;

  const matchByContains = collection.find(room => key.includes(String(room.id || "").toLowerCase()) || String(room.id || "").toLowerCase().includes(key));
  return matchByContains || collection[0] || ROOMS[0];
}

function setRoomCatalog(rooms = []) {
  ROOM_CATALOG = Array.isArray(rooms) && rooms.length ? rooms : [...ROOMS];
}

function getAllRooms() {
  return Array.isArray(ROOM_CATALOG) && ROOM_CATALOG.length ? ROOM_CATALOG : ROOMS;
}

function getAvailableRooms() {
  return getAllRooms().filter(room => String(room.status || "").toLowerCase() === "available" || !room.status);
}



function getPaymentMethod() {
  return document.querySelector('input[name="payment-method"]:checked')?.value || "QRIS";
}



function calculateDuration(start, end) {
  if (!start || !end) {
    return 0;
  }
  const checkIn =
    new Date(start);
  const checkOut =
    new Date(end);
  const diff =
    checkOut - checkIn;
  const nights =
    Math.ceil(
      diff / 86400000
    );
  return Math.max(
    1,
    nights
  );
}



function generateBookingCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "PITU-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}



function formatCurrency(amount) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0
  }).format(Number(amount || 0));
}



function formatDate(dateValue) {
  if (!dateValue) return "-";
  const date = new Date(dateValue + (String(dateValue).includes("T") ? "" : "T00:00:00"));
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  }).format(date);
}



function normalizeCode(code) {
  return String(code || "").trim().toUpperCase();
}




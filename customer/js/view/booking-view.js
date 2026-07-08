function escapeHtml(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

}
function formatCurrency(value) {

  return new Intl.NumberFormat(
    "id-ID",
    {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }
  ).format(value || 0);

}
console.log("🔥 renderRoomCards dipanggil");
function renderRoomCards() {
  const container = $("room-list");
  if (!container) return;

  const rooms = typeof getAllRooms === "function" ? getAllRooms() : ROOMS;
  if (!rooms.length) {
    container.innerHTML = `<div class="col-span-full rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-slate-500">Tidak ada kamar tersedia saat ini.</div>`;
    return;
  }

  container.innerHTML = rooms.map(room => {
    const status = String(room.status || "").toLowerCase();
    const isAvailable = status === "available";
    const isOccupied = status === "occupied";
    const statusClasses = isAvailable ? "bg-emerald-100 text-emerald-700" : isOccupied ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500";

    return `
      <article class="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <div class="relative overflow-hidden rounded-3xl bg-slate-100">
          <img src="${escapeHtml(room.image)}" alt="${escapeHtml(room.type)}" class="h-44 w-full object-cover" />
        </div>
        <div class="mt-5">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-xl font-semibold text-slate-900">${escapeHtml(room.name)}</h3>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(room.subtitle)}</p>
            </div>
            <span class="rounded-full px-3 py-1 text-xs font-semibold ${statusClasses}">${escapeHtml(room.status || "Available")}</span>
          </div>
          <div class="mt-4 flex items-end justify-between gap-4">
            <div>
              <p class="text-sm text-slate-500">Harga per malam</p>
              <p class="text-xl font-semibold text-slate-900">${formatCurrency(room.pricePerNight)}<span class="text-sm font-medium text-slate-500"> / malam</span></p>
            </div>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            ${(room.facilities || []).map(item => `<span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">${escapeHtml(item)}</span>`).join("")}
          </div>
          <button
            type="button"
            class="mt-6 inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold text-white transition
            ${ isAvailable 
              ? "bg-blue-600 hover:bg-blue-700"
              : "bg-red-500 cursor-not-allowed"
            }"

            data-room-id="${escapeHtml(room.id)}"

            ${
              isAvailable 
              ? "" 
              : "disabled"
            }
          >

            ${
              isAvailable
              ? "Pilih Kamar Ini"
              : "Occupied"
            }

          </button>
        </div>
      </article>
    `;
  }).join("");

  container.querySelectorAll("button[data-room-id]").forEach(button => {
    if (button.disabled) return;

    button.addEventListener("click", function () {
      const roomId = this.dataset.roomId;
      const select = $("booking-room-type");
      if (select) {
        select.value = roomId;
        updateSummary();
      }
      const bookingSection = $("booking-section");
      if (bookingSection) bookingSection.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}



function renderRoomOptions() {

  const select = $("booking-room-type");
  if (!select) return;


  const rooms =
    typeof getAllRooms === "function"
      ? getAllRooms()
      : [];


  console.log("DATA DROPDOWN:", rooms);


  if (!rooms.length) {

    select.innerHTML = `
      <option value="">
        Tidak ada kamar tersedia
      </option>
    `;

    return;
  }


  select.innerHTML =
    `
    <option value="">
      Pilih Tipe Kamar
    </option>
    `
    +
    rooms.map(room => {


      const statusLabel =
        room.status || "Available";


      return `
        <option value="${room.id}">

          ${escapeHtml(
            room.name ||
            room.type ||
            "Kamar"
          )}

          ${
            room.number
            ? "- No " + escapeHtml(room.number)
            : ""
          }

          (${escapeHtml(statusLabel)})

          -

          ${formatCurrency(
            room.price ||
            room.pricePerNight ||
            0
          )}

        </option>
      `;

    }).join("");


  renderSelectedRoomFacilities();

}



function updateSummary() {

  const data = collectBookingData();


  setText(
    "sum-room",
    data.roomName || "-"
  );


  setText(
    "sum-price",
    formatCurrency(
      data.pricePerNight
    )
  );


  setText(
    "sum-duration",
    `${Math.max(
      0,
      data.duration
    )} malam`
  );


  setText(
    "sum-quantity",
    `${data.quantity} kamar`
  );


  setText(
    "sum-subtotal",
    formatCurrency(
      data.subtotal
    )
  );


  setText(
    "sum-tax",
    formatCurrency(
      data.tax
    )
  );


  setText(
    "sum-total",
    formatCurrency(
      data.total
    )
  );

}



function openConfirmModal(data) {
  const detail = $("confirm-detail");
  if (!detail) return;

  detail.innerHTML = `
    <div class="modal-row"><span>Nama</span><strong>${escapeHtml(data.name)}</strong></div>
    <div class="modal-row"><span>Email</span><strong>${escapeHtml(data.email)}</strong></div>
    <div class="modal-row"><span>Telepon</span><strong>${escapeHtml(data.phone)}</strong></div>
    <div class="modal-row"><span>Kamar</span><strong>${escapeHtml(data.roomName)}</strong></div>
    <div class="modal-row"><span>Tanggal</span><strong>${formatDate(data.checkIn)} - ${formatDate(data.checkOut)}</strong></div>
    <div class="modal-row"><span>Durasi</span><strong>${data.duration} malam • ${data.quantity} kamar</strong></div>
    <div class="modal-row"><span>Pembayaran</span><strong>${escapeHtml(data.paymentMethod)} • ${escapeHtml(data.paymentStatus)}</strong></div>
    <div class="modal-row modal-total"><span>Total</span><strong>${formatCurrency(data.total)}</strong></div>
  `;

  showModal("confirm-modal");
}



function closeConfirmModal() {
  hideModal("confirm-modal");
}



function openSuccessModal(data, statusText) {


  setText(
    "success-code",
    data.bookingCode
  );


  updateSuccessStatus(
    statusText,
    ""
  );


  const invoiceBtn =
  document.getElementById(
    "download-invoice-btn"
  );



  if(invoiceBtn){


    if(
      data.paymentStatus ===
      "Pending Payment"
    ){


      invoiceBtn.disabled =
      true;


      invoiceBtn.classList.add(
        "opacity-50",
        "cursor-not-allowed"
      );


    }else{


      invoiceBtn.disabled =
      false;


      invoiceBtn.classList.remove(
        "opacity-50",
        "cursor-not-allowed"
      );


    }


  }



  showModal(
    "success-modal"
  );


  if(
    typeof refreshIcons ===
    "function"
  ){

    refreshIcons();

  }


}


function closeSuccessModal() {
  hideModal("success-modal");
  resetFormAfterBooking();
}



function updateSuccessStatus(text, type) {
  const el = $("success-status");
  if (!el) return;
  el.textContent = text;
  el.className = `success-status ${type || ""}`.trim();
}



function downloadInvoice(data) {
  const html = data.invoiceHTML || generateInvoiceHTML(data);
  const code = data.bookingCode || data.code ||"INVOICE";
  const invoice = document.createElement("div");
  invoice.innerHTML = html;
  invoice.style.width = "210mm";
  invoice.style.minHeight = "auto";
  invoice.style.transform = "scale(0.85)";
  invoice.style.transformOrigin = "top center";
  const option = {
    margin: 0,
    filename:`Invoice-${code}.pdf`,
    image: {type: "jpeg",quality: 0.98},
    html2canvas: {scale: 2},
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait"}

  };
  html2pdf()
    .set(option)
    .from(invoice)
    .save();
  showToast("Invoice PDF berhasil diunduh.");
}



function generateInvoiceHTML(data) {
  const code = data.bookingCode || data.code || "-";
  const checkIn = data.checkIn || data.checkin;
  const checkOut = data.checkOut || data.checkout;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Invoice ${escapeHtml(code)}</title>
  <style>
    body { margin: 0; padding: 32px; background: #f5f7fb; font-family: Arial, sans-serif; color: #0f172a; }
    .invoice { max-width: 820px; margin: auto; background: white; border-radius: 28px; overflow: hidden; box-shadow: 0 22px 65px rgba(15,23,42,.14); }
    .head { padding: 34px; color: white; background: linear-gradient(135deg, #4f46e5, #3730a3); }
    .head h1 { margin: 0; font-size: 34px; }
    .head p { margin: 8px 0 0; color: #e0e7ff; }
    .body { padding: 34px; }
    .code { display: inline-block; padding: 14px 18px; border-radius: 16px; background: #eef2ff; color: #4f46e5; font-size: 24px; font-weight: 900; margin-bottom: 26px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
    .box { border: 1px solid #e2e8f0; border-radius: 20px; padding: 20px; }
    .box h2 { margin: 0 0 14px; font-size: 18px; }
    .row { display: flex; justify-content: space-between; gap: 18px; padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
    .row:last-child { border-bottom: 0; }
    .row span { color: #64748b; }
    .row strong { text-align: right; }
    .total { margin-top: 20px; padding: 20px; border-radius: 18px; background: #eef2ff; color: #4f46e5; display: flex; justify-content: space-between; font-size: 26px; font-weight: 900; }
    .footer { padding: 22px 34px; background: #f8fafc; color: #64748b; text-align: center; font-size: 13px; }
    @media print { body { background: white; padding: 0; } .invoice { box-shadow: none; } }
    @media (max-width: 720px) { .grid { grid-template-columns: 1fr; } body { padding: 14px; } }
  </style>
</head>
<body>
  <div class="invoice">
    <div class="head">
      <h1>Invoice Pemesanan Kamar</h1>
      <p>Piturooms Hotels</p>
    </div>
    <div class="body">
      <div class="code">Kode Booking: ${escapeHtml(code)}</div>
      <div class="grid">
        <div class="box">
          <h2>Data Pemesan</h2>
          <div class="row"><span>Nama</span><strong>${escapeHtml(data.name || "-")}</strong></div>
          <div class="row"><span>Nama Tamu</span><strong>${escapeHtml(data.guestName || data.name || "-")}</strong></div>
          <div class="row"><span>Email</span><strong>${escapeHtml(data.email || "-")}</strong></div>
          <div class="row"><span>Telepon</span><strong>${escapeHtml(data.phone || "-")}</strong></div>
        </div>
        <div class="box">
          <h2>Detail Reservasi</h2>
          <div class="row"><span>Kamar</span><strong>${escapeHtml(data.roomName || "-")}</strong></div>
          <div class="row"><span>Check-In</span><strong>${formatDate(checkIn)}</strong></div>
          <div class="row"><span>Check-Out</span><strong>${formatDate(checkOut)}</strong></div>
          <div class="row"><span>Durasi</span><strong>${data.duration || 0} malam</strong></div>
          <div class="row"><span>Jumlah</span><strong>${data.quantity || 1} kamar</strong></div>
        </div>
      </div>
      <div class="box" style="margin-top:18px">
        <h2>Pembayaran</h2>
        <div class="row"><span>Metode</span><strong>${escapeHtml(data.paymentMethod || "-")}</strong></div>
        <div class="row"><span>Status</span><strong>${escapeHtml(data.paymentStatus || "-")}</strong></div>
        <div class="row"><span>Harga/Malam</span><strong>${formatCurrency(data.pricePerNight || 0)}</strong></div>
        <div class="row"><span>Subtotal</span><strong>${formatCurrency(data.subtotal || 0)}</strong></div>
        <div class="row"><span>Pajak 10%</span><strong>${formatCurrency(data.tax || 0)}</strong></div>
        <div class="total"><span>Total</span><strong>${formatCurrency(data.total || 0)}</strong></div>
      </div>
    </div>
    <div class="footer">Simpan invoice dan tunjukkan kode booking saat check-in.</div>
  </div>
</body>
</html>`;
}



function showModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}



function hideModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  if (!document.querySelector(".modal:not(.hidden)")) {
    document.body.style.overflow = "";
  }
}



function setButtonLoading(button, isLoading, text) {
  if (!button) return;
  button.disabled = isLoading;
  button.textContent = text;
}



function showToast(message) {
  const toast = $("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.classList.remove("hidden");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 3200);
}



function setText(id, text) {
  const el = $(id);
  if (el) el.textContent = text;
}



function val(id) {
  return ($(id)?.value || "").trim();
}



function $(id) {
  return document.getElementById(id);
}


function loadRoomTypeOptions(){


    const select =
    document.getElementById(
        "booking-room-type"
    );


    if(!select) return;



    select.innerHTML =
    `<option value="">
        Pilih tipe kamar
     </option>`;



    const types = [
        ...new Set(
            ROOMS.map(
                r => r.type
            )
        )
    ];



    types.forEach(type=>{
        const option =
        document.createElement(
            "option"
          );
        option.value = type;
        option.textContent = type;
        select.appendChild(option);
    });

}
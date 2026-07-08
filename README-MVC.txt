PituRooms MVC Version

Struktur:
- shared/ : firebase-config.js dan tailwind.config.js yang dipakai bersama.
- receptionist/ : aplikasi HOS resepsionis/admin.
  - js/model/app-state.js : data awal, state global, helper LocalStorage.
  - js/view/app-view.js : render tampilan, router view, modal/tabel.
  - js/controller/app-controller.js : event listener, login, check-in/out, CRUD.
- customer/ : website reservasi customer.
  - js/model/booking-model.js : data kamar, kalkulasi, validasi, format, LocalStorage.
  - js/view/booking-view.js : render kartu kamar, ringkasan, modal, invoice, toast.
  - js/controller/booking-controller.js : inisialisasi, event form, Firebase, download/cari invoice.

Cara run:
1. Buka folder piturooms-mvc di VS Code.
2. Pakai Live Server.
3. Untuk admin/resepsionis buka: receptionist/index.html
4. Untuk customer buka: customer/index.html

Catatan:
- UI/UX tidak diubah; hanya path script/css dan struktur file yang dipisah.
- Firebase config tetap satu di shared/firebase-config.js.

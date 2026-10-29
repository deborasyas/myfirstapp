# 🛒 Smart Grocery & Budget Safety Tracker (PWA)
> **Aplikasi Web Mobile Berstandar PWA untuk Siswa Rantau Belanja Bulanan sambil Mendorong Troli Supermarket**

---

## 📱 Standar Arsitektur & Tampilan Mobile

1. **Format Layar Khusus Smartphone (Mobile UI)**:
   - Lebar maksimal `430px` (centered di layar desktop dengan mockup frame smartphone, status bar 5G/baterai, dan dynamic island).
   - Di perangkat smartphone asli: berjalan otomatis layar penuh (*full edge-to-edge*) mengikuti *safe area insets*.
2. **Header Sesi Belanja Terstruktur**:
   - Selector Lokasi Supermarket (Default: **"Lotte Mart Grocery - Puri Indah"**, dengan opsi toko lain: Super Indo, Grand Lucky, Hypermart, serta opsi tambah toko baru).
   - Selector Tanggal Transaksi (`<input type="date">`) agar histori harga memiliki konteks toko dan waktu yang valid.
3. **Navigasi Bawah (Floating Bottom Navigation Bar)**:
   - Dock menu melayang dengan efek kaca (*glassmorphism*) dan ikon Lucide:
     - 🛒 **Belanja** (Troli Aktif, Stepper Qty, Quick Chips, Safety Cap Gauge)
     - 🧾 **Riwayat Toko** (Database Multi-Toko, Komparasi Harga Lintas Toko, Rekap Sesi Lampau)
     - 🛡️ **Anggaran** (Pengendali Limit Dompet, Distribusi Kategori Belanja, Status Validasi SRS)
4. **Ergonomi Mobile Ramah Jempol (Thumb-Friendly)**:
   - Tombol aksi utama (*Call-To-Action*) berada di zona jangkauan jempol bawah.
   - Stepper angka besar (`+` dan `−`) dengan area sentuh > 48px.
   - Otomatis memicu keyboard numerik (`inputmode="numeric"`) untuk input harga dan kuantitas.
   - Menggunakan kartu belanja (*mobile cards*) responsif tanpa tabel horizontal desktop yang melebar.
5. **Dukungan Progressive Web App (PWA)**:
   - Struktur meta viewport mobile (`viewport-fit=cover`, `theme-color`).
   - `manifest.json` (`display: standalone`, ikon maskable HD).
   - `sw.js` (Service Worker) untuk penyimpanan cache offline saat berada di basement supermarket tanpa sinyal.
   - Banner tombol **"Pasang di Layar HP"** (*Add to Home Screen*).

---

## 📋 Checklist Kebutuhan Fungsional (SRS Compliance)

| Kode | Nama Fitur | Spesifikasi & Perilaku yang Diterapkan | Status Validasi |
| :--- | :--- | :--- | :---: |
| **F-01** | **Pencatatan Sesi & Item Belanja Lengkap** | Memilih lokasi toko (default: *Lotte Mart Grocery - Puri Indah*), pemilih tanggal, pencatatan nama produk, kategori barang, satuan (pack, pcs, kg, liter, dus, botol, kaleng), kuantitas, dan harga satuan. Dilengkapi chip produk cepat favorit anak kost. | **TERPENUHI (100%)** |
| **F-02** | **Perhitungan Kuantitas Otomatis** | Tombol `+` / `−` atau perubahan angka kuantitas langsung mengalikan harga satuan bersih secara reaktif detik itu juga ke subtotal baris dan total belanja tanpa refresh halaman. | **TERPENUHI (100%)** |
| **F-03** | **Kalkulator Diskon Bertingkat** | Mendukung diskon tunggal (contoh: `25%`) maupun diskon bertumpuk (contoh: `50% + 20%`, `30% + 10%`, `70% + 15%`) dengan rumus matematis bertingkat akurat: <br> $P_1 = P \times (1 - d_1/100)$, $P_2 = P_1 \times (1 - d_2/100)$. Dilengkapi rincian tahap diskon & penghematan. | **TERPENUHI (100%)** |
| **F-04** | **Komparator Harga Realtime vs Riwayat Toko** | Indikator visual seketika saat nama & harga diinput serta pada kartu troli: <br>• 🔴 **Panah Merah Naik (↑)**: Jika harga naik dibanding riwayat bulan lalu di toko tersebut (+Rp selisih).<br>• 🟢 **Panah Hijau Turun (↓)**: Jika harga turun/promo dibanding riwayat bulan lalu (-Rp hemat).<br>• ⚖️ **Tanda Setara (=)**: Jika harga stabil/tetap sama.<br>• ✨ **Tanda Baru**: Jika belum ada histori di toko tersebut. | **TERPENUHI (100%)** |
| **F-05** | **Pengendali Anggaran (Safety Cap)** | Input batas maksimal dompet dengan indikator warna visual: <br>• 🟢 **Hijau Aman** ($<90\%$) dengan sisa dompet.<br>• 🟡 **Kuning Waspada** ($\ge 90\%$ s/d $100\%$).<br>• 🚨 **Banner Merah Tegas** ($>100\%$) dengan peringatan *OVER BUDGET!*, getar haptik, suara buzzer waspada, dan **Fitur Cerdas Rekomendasi Pangkas Belanja** (1-tap tombol pangkas barang non-primer). | **TERPENUHI (100%)** |
| **F-06** | **Riwayat Sesi Belanja & Database Multi-Toko** | Metadata tersimpan rapi ke LocalStorage. Dilengkapi data awal (*seed data*) riwayat Lotte Mart & Super Indo, fitur pencarian harga termurah lintas toko (*Cross-Store Price Intelligence*), serta backup/export JSON. | **TERPENUHI (100%)** |

---

## 🚀 Cara Menjalankan Aplikasi

Aplikasi dibangun menggunakan teknologi standar web modern murni (*Vanilla HTML5, CSS3, ES Modules, Node.js*) tanpa dependensi yang berat, sehingga sangat cepat dan stabil.

### 1. Jalankan Server Lokal
Buka terminal di direktori proyek dan jalankan:
```bash
npm start
# atau
node server.js
```

### 2. Akses Aplikasi
Buka browser (Google Chrome / Safari / Edge):
```
http://localhost:3000/
```

- Pada desktop: Anda akan melihat tampilan smartphone frame cantik `430px` di tengah layar.
- Untuk menguji di HP fisik: Hubungkan HP ke jaringan WiFi yang sama dan buka `http://<IP-Komputer-Anda>:3000/`, lalu pilih **"Add to Home Screen"** (*Tambahkan ke Layar Utama*).

---

## 🗂️ Struktur Direktori Proyek

```
myfirstapp/
├── assets/
│   ├── icon.jpg            # Ikon Utama 3D Smart Grocery
│   ├── icon-192.jpg        # Ikon PWA Standar 192x192
│   └── icon-512.jpg        # Ikon PWA Standar 512x512
├── css/
│   └── style.css           # Desain Glassmorphism, Tema Gelap & Ergonomi Mobile (430px)
├── js/
│   ├── app.js              # Controller Utama, Routing Tab, Sound Effects, Haptics
│   ├── cart.js             # Engine Troli, F-02 Multiplikasi, F-03 Diskon Bertingkat, F-04 Komparator
│   ├── budget.js           # F-05 Safety Cap, Progress Gauge & Rekomendasi Pangkas Cerdas
│   ├── history.js          # F-06 Riwayat Sesi, Multi-Toko & Analisis Harga Termurah
│   └── storage.js          # Persistensi LocalStorage & Seed Data Realistis Anak Kost
├── index.html              # Entrypoint Mobile UI PWA
├── manifest.json           # PWA Manifest (Standalone Mobile App)
├── sw.js                   # Service Worker (Full Offline Caching)
├── server.js               # Zero-dependency Node.js HTTP Server
├── package.json            # Konfigurasi Proyek & Script Dev
└── README.md               # Dokumentasi Lengkap
```
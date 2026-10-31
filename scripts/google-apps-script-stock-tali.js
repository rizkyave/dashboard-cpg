/**
 * GOOGLE APPS SCRIPT WEBHOOK UNTUK CPG MUTASI STOCK TALI & GUDANG
 * File: scripts/google-apps-script-stock-tali.js
 * 
 * Target Spreadsheet: Laporan Mutasi Barang Stock Tali & Gudang
 * ID: 1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I
 * GID: 2021352613
 * 
 * PETUNJUK PEMASANGAN DI GOOGLE SHEETS:
 * 1. Buka spreadsheet "Mutasi Barang Stock Tali":
 *    https://docs.google.com/spreadsheets/d/1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I/edit?gid=2021352613#gid=2021352613
 * 2. Klik menu atas: "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus seluruh kode bawaan (myFunction), lalu tempel (Paste) seluruh kode ini.
 * 4. Klik ikon disket "Simpan proyek" (Save).
 * 5. Klik tombol biru "Terapkan" (Deploy) di pojok kanan atas -> "Penerapan baru" (New deployment).
 * 6. Klik ikon roda gigi (gear) di samping "Pilih jenis", lalu pilih "Aplikasi web" (Web app).
 * 7. Konfigurasi WAJIB:
 *    - Deskripsi: CPG Stock Tali Webhook Live Sync
 *    - Jalankan sebagai (Execute as): Saya (email Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone)  <--- PENTING! HARUS "Siapa saja"
 * 8. Klik "Terapkan" (Deploy).
 *    - Jika muncul "Otorisasi diperlukan" (Authorization required), klik "Tinjau izin" (Review permissions).
 *    - Pilih akun Google Anda -> Klik "Lanjutan" (Advanced) di kiri bawah -> Klik "Buka CPG Webhook Sync (tidak aman)" -> Klik "Izinkan" (Allow).
 * 9. Salin "URL Aplikasi Web" (Web app URL) yang berakhiran `/exec`.
 * 10. Buka Dashboard Web -> Menu "Monitoring Internal" -> Tab "Mutasi Stock Tali & Gudang" -> Klik tombol "Auto-Save Sheet" -> Tempel URL tersebut -> Klik "Tes Koneksi" -> Klik "Simpan"!
 */

var SPREADSHEET_ID = "1Bou_dU7L8UWhDEjgBpPqtKnIqoF7wLQSUN2bnYbrp1I";
var TARGET_GID = 2021352613;
var HEADER_ROW = 2; // Baris 1: Judul Laporan, Baris 2: Header Kolom

function getTargetSheet() {
  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}

  if (!ss) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {}
  }

  if (!ss) {
    throw new Error("Tidak dapat membuka Spreadsheet ID: " + SPREADSHEET_ID + ". Pastikan skrip memiliki izin akses ke spreadsheet tersebut.");
  }

  var sheets = ss.getSheets();
  var sheet = null;
  // Prioritas 1: cocokkan ID GID sheet
  for (var i = 0; i < sheets.length; i++) {
    if (sheets[i].getSheetId() == TARGET_GID) {
      sheet = sheets[i];
      break;
    }
  }

  // Prioritas 2: fallback cari nama sheet
  if (!sheet) {
    for (var j = 0; j < sheets.length; j++) {
      var name = sheets[j].getName().toUpperCase();
      if (name.includes("MUTASI") || name.includes("TALI") || name.includes("STOCK")) {
        sheet = sheets[j];
        break;
      }
    }
  }

  if (!sheet) {
    sheet = sheets[0];
  }

  return { ss: ss, sheet: sheet };
}

/**
 * Handle HTTP GET: Tes Koneksi dan Verifikasi Status
 */
function doGet(e) {
  try {
    var target = getTargetSheet();
    var sheet = target.sheet;

    return ContentService.createTextOutput(JSON.stringify({
      status: "active",
      success: true,
      spreadsheetName: target.ss.getName(),
      sheetName: sheet.getName(),
      sheetId: sheet.getSheetId(),
      totalRows: sheet.getLastRow(),
      timestamp: new Date().toISOString(),
      message: "CPG Mutasi Stock Tali Webhook AKTIF dan TERHUBUNG ke Spreadsheet: " + target.ss.getName() + " (" + sheet.getName() + ")"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: "Error koneksi spreadsheet: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Helper: Format Tanggal ke DD-MM-YYYY
 */
function formatDateIndo(dateVal) {
  if (!dateVal) return "";
  if (typeof dateVal === "string") {
    var s = dateVal.trim();
    if (s.indexOf("-") > -1) {
      var parts = s.split("-");
      if (parts[0].length === 4) {
        // Format YYYY-MM-DD -> DD-MM-YYYY
        return parts[2] + "-" + parts[1] + "-" + parts[0];
      }
    }
    return s;
  }
  try {
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) return "";
    var day = ("0" + d.getDate()).slice(-2);
    var month = ("0" + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    return day + "-" + month + "-" + year;
  } catch (e) {
    return "";
  }
}

/**
 * Handle HTTP POST: Menerima create_row atau update_row dari Dashboard CPG
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); // Kunci 30 detik agar antrean aman

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Tidak ada payload data yang diterima dari server web."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var body = JSON.parse(e.postData.contents);
    var action = body.action || "create_row";
    var data = body.data || body.item || {};

    var target = getTargetSheet();
    var sheet = target.sheet;
    var lastRow = sheet.getLastRow();

    // 1. Aksi: Tambah Baris Mutasi Baru
    if (action === "create_row") {
      var nextRow = lastRow + 1;
      var nextNo = data.no;
      if (!nextNo) {
        // Cari nomor urut terakhir di kolom A
        var maxNo = 0;
        if (lastRow > HEADER_ROW) {
          var noValues = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, 1).getValues();
          for (var r = 0; r < noValues.length; r++) {
            var n = parseInt(noValues[r][0], 10);
            if (!isNaN(n) && n > maxNo) maxNo = n;
          }
        }
        nextNo = String(maxNo + 1);
      }

      var rowValues = [
        nextNo,                                         // Col A: NO
        (data.pt || "").toUpperCase(),                  // Col B: PT
        data.deptArmada || "",                          // Col C: DEPT/ ARMADA
        data.noFpb || "",                               // Col D: NO. FPB
        (data.picTtb || "").toUpperCase(),              // Col E: PIC TTB
        data.ttb || "",                                 // Col F: TTB
        formatDateIndo(data.tglInputTtb),               // Col G: TANGGAL INPUT TTB
        formatDateIndo(data.tglKeTimLapangan),          // Col H: TANGGAL KE TIM LAPANGAN
        data.keterangan || "",                          // Col I: KETERANGAN
        data.lapseDay1 || "",                           // Col J: LAPSE DAY
        (data.picLapangan || "").toUpperCase(),         // Col K: PIC LAPANGAN
        formatDateIndo(data.tglBarangDiantar),          // Col L: TANGGAL BARANG DI DIANTAR
        data.keteranganAntar || "",                     // Col M: KETERANGAN
        formatDateIndo(data.tglTimLapKePicTtb),         // Col N: TANGGAL TIM LAP KE PIC TTB
        data.lapseDay2 || "",                           // Col O: LAPSE DAY
        formatDateIndo(data.tglTtbKePicPch),            // Col P: TANGGAL TTB KE PIC PCH
        data.keteranganPch || "",                       // Col Q: KETERANGAN
        data.lapseDay3 || ""                            // Col R: LAPSE DAY
      ];

      sheet.getRange(nextRow, 1, 1, rowValues.length).setValues([rowValues]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "✓ Mutasi baru berhasil ditambahkan ke Google Sheets baris " + nextRow + "!",
        rowNumber: nextRow,
        no: nextNo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Aksi: Update Baris Mutasi yang Sudah Ada
    if (action === "update_row") {
      var targetNo = String(data.no || "").trim();
      var targetTtb = String(data.ttb || "").trim();
      var targetFpb = String(data.noFpb || "").trim();
      var targetArmada = String(data.deptArmada || "").trim().toUpperCase();

      if (!targetNo && !targetTtb && !targetFpb) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Harus menyertakan No urut, No TTB, atau No FPB untuk update baris."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      var foundRow = -1;
      if (lastRow > HEADER_ROW) {
        // Ambil kolom A sampai F untuk pencocokan cepat
        var rangeData = sheet.getRange(HEADER_ROW + 1, 1, lastRow - HEADER_ROW, 6).getValues();
        for (var i = 0; i < rangeData.length; i++) {
          var rowNo = String(rangeData[i][0] || "").trim();
          var rowArmada = String(rangeData[i][2] || "").trim().toUpperCase();
          var rowFpb = String(rangeData[i][3] || "").trim();
          var rowTtb = String(rangeData[i][5] || "").trim();

          // Prioritas 1: No urut persis
          if (targetNo && rowNo === targetNo) {
            foundRow = HEADER_ROW + 1 + i;
            break;
          }
          // Prioritas 2: TTB dan Armada
          if (targetTtb && rowTtb === targetTtb && targetArmada && rowArmada === targetArmada) {
            foundRow = HEADER_ROW + 1 + i;
            break;
          }
          // Prioritas 3: FPB dan TTB
          if (targetTtb && rowTtb === targetTtb && targetFpb && rowFpb === targetFpb) {
            foundRow = HEADER_ROW + 1 + i;
            break;
          }
        }
      }

      if (foundRow === -1) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Data mutasi tidak ditemukan di Google Sheets (No: " + (targetNo || targetTtb) + ")."
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Ambil nilai lama satu baris
      var currentValues = sheet.getRange(foundRow, 1, 1, 18).getValues()[0];

      // Perbarui nilai jika dikirim
      if (data.pt !== undefined) currentValues[1] = String(data.pt).toUpperCase();
      if (data.deptArmada !== undefined) currentValues[2] = data.deptArmada;
      if (data.noFpb !== undefined) currentValues[3] = data.noFpb;
      if (data.picTtb !== undefined) currentValues[4] = String(data.picTtb).toUpperCase();
      if (data.ttb !== undefined) currentValues[5] = data.ttb;
      if (data.tglInputTtb !== undefined) currentValues[6] = formatDateIndo(data.tglInputTtb);
      if (data.tglKeTimLapangan !== undefined) currentValues[7] = formatDateIndo(data.tglKeTimLapangan);
      if (data.keterangan !== undefined) currentValues[8] = data.keterangan;
      if (data.lapseDay1 !== undefined) currentValues[9] = data.lapseDay1;
      if (data.picLapangan !== undefined) currentValues[10] = String(data.picLapangan).toUpperCase();
      if (data.tglBarangDiantar !== undefined) currentValues[11] = formatDateIndo(data.tglBarangDiantar);
      if (data.keteranganAntar !== undefined) currentValues[12] = data.keteranganAntar;
      if (data.tglTimLapKePicTtb !== undefined) currentValues[13] = formatDateIndo(data.tglTimLapKePicTtb);
      if (data.lapseDay2 !== undefined) currentValues[14] = data.lapseDay2;
      if (data.tglTtbKePicPch !== undefined) currentValues[15] = formatDateIndo(data.tglTtbKePicPch);
      if (data.keteranganPch !== undefined) currentValues[16] = data.keteranganPch;
      if (data.lapseDay3 !== undefined) currentValues[17] = data.lapseDay3;

      sheet.getRange(foundRow, 1, 1, 18).setValues([currentValues]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "✓ Data mutasi (No: " + (targetNo || currentValues[0]) + ") berhasil diperbarui di Google Sheets baris " + foundRow + "!",
        rowNumber: foundRow
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Aksi tidak dikenali: " + action
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Terjadi error pada webhook script: " + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}


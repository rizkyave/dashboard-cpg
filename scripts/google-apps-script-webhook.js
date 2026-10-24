/**
 * GOOGLE APPS SCRIPT WEBHOOK UNTUK CPG PROCUREMENT MONITORING SYSTEM
 * File: scripts/google-apps-script-webhook.js
 * 
 * Target Spreadsheet: Monitoring Berkas Internal Procurement
 * ID: 16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk
 * Sheet: PROCUREMENT
 * 
 * PETUNJUK PEMASANGAN DI GOOGLE SHEETS:
 * 1. Buka spreadsheet "Monitoring Berkas Internal Procurement":
 *    https://docs.google.com/spreadsheets/d/16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk/edit
 * 2. Klik menu atas: "Ekstensi" (Extensions) -> "Apps Script".
 * 3. Hapus seluruh kode bawaan (myFunction), lalu tempel (Paste) seluruh kode ini.
 * 4. Klik ikon disket "Simpan proyek" (Save).
 * 5. Klik tombol biru "Terapkan" (Deploy) di pojok kanan atas -> "Penerapan baru" (New deployment).
 * 6. Klik ikon roda gigi (gear) di samping "Pilih jenis", lalu pilih "Aplikasi web" (Web app).
 * 7. Konfigurasi WAJIB:
 *    - Deskripsi: CPG Webhook Live Sync
 *    - Jalankan sebagai (Execute as): Saya (email Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone)  <--- PENTING! HARUS "Siapa saja"
 * 8. Klik "Terapkan" (Deploy).
 *    - Jika muncul "Otorisasi diperlukan" (Authorization required), klik "Tinjau izin" (Review permissions).
 *    - Pilih akun Google Anda -> Klik "Lanjutan" (Advanced) di kiri bawah -> Klik "Buka CPG Webhook Sync (tidak aman)" -> Klik "Izinkan" (Allow).
 * 9. Salin "URL Aplikasi Web" (Web app URL) yang berakhiran `/exec`.
 * 10. Buka Dashboard Web -> Menu "Monitoring Internal" -> Klik tombol "Auto-Save Sheet" -> Tempel URL tersebut -> Klik "Tes Koneksi" -> Klik "Simpan"!
 */

var SPREADSHEET_ID = "16Ae8gGsGYx_xCNaqZvME-uZvaAeECsE69PBYlY32fZk";
var SHEET_NAME = "PROCUREMENT";
var HEADER_ROW = 2; // Baris 1: Header Grup, Baris 2: Header Kolom

function getTargetSheet() {
  var ss = null;
  // Coba ambil spreadsheet aktif jika script di-bind ke sheet
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {}

  // Fallback: buka via ID spreadsheet resmi jika dijalankan standalone
  if (!ss) {
    try {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {}
  }

  if (!ss) {
    throw new Error("Tidak dapat membuka Spreadsheet ID: " + SPREADSHEET_ID + ". Pastikan skrip memiliki izin akses ke spreadsheet tersebut.");
  }

  var sheet = ss.getSheetByName(SHEET_NAME) || ss.getSheets()[0];
  return { ss: ss, sheet: sheet };
}

/**
 * Handle HTTP GET: Digunakan oleh Dashboard untuk "Tes Koneksi" dan verifikasi status.
 */
function doGet(e) {
  try {
    var target = getTargetSheet();
    var sheet = target.sheet;
    var action = (e && e.parameter && e.parameter.action) || 'ping';

    if (action === 'get_data' || action === 'sync') {
      return handleGetData(sheet);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "active",
      success: true,
      spreadsheetName: target.ss.getName(),
      sheetName: sheet.getName(),
      totalRows: sheet.getLastRow(),
      timestamp: new Date().toISOString(),
      message: "CPG Procurement Webhook AKTIF dan TERHUBUNG ke Spreadsheet: " + target.ss.getName() + " (" + sheet.getName() + ")"
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
 * Handle HTTP POST: Menerima update_row atau create_row dari Dashboard CPG.
 */
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000); // Kunci 30 detik agar tidak tabrakan antar user

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Tidak ada payload data yang diterima dari server web."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'update_row';
    var data = payload.data || payload;

    var target = getTargetSheet();
    var sheet = target.sheet;
    var lastRow = sheet.getLastRow();

    // Aksi: Ambil data seluruh baris
    if (action === 'get_data' || action === 'sync') {
      return handleGetData(sheet);
    }

    // Aksi: Tambah Baris Baru
    if (action === 'create_row') {
      var newRowIdx = lastRow + 1;
      var newRowValues = buildRowValues(newRowIdx - HEADER_ROW, data);
      sheet.appendRow(newRowValues);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Baris baru berhasil ditambahkan ke baris " + newRowIdx + " di Google Sheets!",
        row: newRowIdx,
        fpb: data.fpb || '-',
        po: data.po || data.noPo || '-'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Aksi: Update Baris yang Ada (update_row)
    var targetFpb = String(data.fpb || '').trim().toUpperCase();
    var targetPo = String(data.po || data.noPo || '').trim().toUpperCase();

    if (!targetFpb && !targetPo && !data.rowIdx) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Harus menyertakan No. FPB atau No. PO untuk memperbarui data baris."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Ambil kolom E (NO. FPB, col 5) dan kolom F (NO. PO, col 6) untuk pencarian baris
    var searchRowCount = Math.max(1, lastRow - HEADER_ROW);
    var fpbRange = sheet.getRange(HEADER_ROW + 1, 5, searchRowCount, 2).getValues();
    var targetRowIndex = -1;

    for (var r = 0; r < fpbRange.length; r++) {
      var rowFpb = String(fpbRange[r][0] || '').trim().toUpperCase();
      var rowPo = String(fpbRange[r][1] || '').trim().toUpperCase();

      if (targetFpb && rowFpb === targetFpb) {
        targetRowIndex = HEADER_ROW + 1 + r;
        break;
      }
      if (targetPo && targetPo !== '-' && rowPo === targetPo) {
        targetRowIndex = HEADER_ROW + 1 + r;
        break;
      }
    }

    // Fallback nomor baris jika dikirim langsung
    if (targetRowIndex < 0 && data.rowIdx && data.rowIdx > HEADER_ROW && data.rowIdx <= lastRow) {
      targetRowIndex = Number(data.rowIdx);
    }

    // Jika belum ada di sheet, otomatis tambahkan sebagai baris baru
    if (targetRowIndex < 0) {
      var newRowIdx = lastRow + 1;
      var newRowValues = buildRowValues(newRowIdx - HEADER_ROW, data);
      sheet.appendRow(newRowValues);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "No. FPB/PO belum ditemukan di sheet, otomatis ditambahkan sebagai baris baru di baris " + newRowIdx,
        row: newRowIdx,
        fpb: data.fpb,
        po: data.po || data.noPo
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Perbarui cell baris yang ditemukan secara spesifik
    var updatedFields = updateRowCells(sheet, targetRowIndex, data);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data baris " + targetRowIndex + " (FPB: " + (targetFpb || targetPo) + ") berhasil diperbarui di Google Sheets! Bidang: " + updatedFields.join(', '),
      row: targetRowIndex,
      fpb: data.fpb,
      po: data.po || data.noPo,
      updatedFields: updatedFields
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error Google Apps Script: " + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Update cell individual secara presisi agar tidak menimpa rumus (seperti kolom LAPSE DAY).
 */
function updateRowCells(sheet, rowIdx, data) {
  var fields = [];

  // Purchasing:
  if (data.picPch !== undefined) { sheet.getRange(rowIdx, 2).setValue(data.picPch); fields.push("PIC PCH"); }
  if (data.entity !== undefined) { sheet.getRange(rowIdx, 3).setValue(data.entity); fields.push("PT"); }
  if (data.deptArmada !== undefined) { sheet.getRange(rowIdx, 4).setValue(data.deptArmada); fields.push("DEPT/ARMADA"); }
  if (data.fpb !== undefined) { sheet.getRange(rowIdx, 5).setValue(data.fpb); fields.push("NO. FPB"); }
  if (data.po !== undefined || data.noPo !== undefined) {
    sheet.getRange(rowIdx, 6).setValue(data.po || data.noPo || '-');
    fields.push("NO. PO");
  }
  if (data.tglPo !== undefined) { sheet.getRange(rowIdx, 7).setValue(formatDateForSheet(data.tglPo)); fields.push("TGL PO"); }
  if (data.deliveryTime !== undefined) { sheet.getRange(rowIdx, 8).setValue(data.deliveryTime); fields.push("DELIVERY TIME"); }
  if (data.noFstb !== undefined) { sheet.getRange(rowIdx, 9).setValue(data.noFstb); fields.push("NO. FSTB"); }
  if (data.tglInputFstb !== undefined) { sheet.getRange(rowIdx, 10).setValue(formatDateForSheet(data.tglInputFstb)); fields.push("TGL INPUT FSTB"); }
  if (data.tglKePicTtb !== undefined) { sheet.getRange(rowIdx, 11).setValue(formatDateForSheet(data.tglKePicTtb)); fields.push("TGL KE PIC TTB"); }
  if (data.waktuKePicTtb !== undefined) { sheet.getRange(rowIdx, 12).setValue(data.waktuKePicTtb); fields.push("WAKTU KE PIC TTB"); }
  if (data.ketPch !== undefined) { sheet.getRange(rowIdx, 13).setValue(data.ketPch); fields.push("KETERANGAN PCH"); }
  else if (data.keterangan !== undefined) { sheet.getRange(rowIdx, 13).setValue(data.keterangan); fields.push("KETERANGAN"); }

  // Logistik & Tim Lapangan:
  // Kolom 15 (O) = PIC TTB
  if (data.picTtb !== undefined) { sheet.getRange(rowIdx, 15).setValue(data.picTtb); fields.push("PIC TTB (" + data.picTtb + ")"); }
  // Kolom 16 (P) = NO. TTB
  if (data.noTtb !== undefined) { sheet.getRange(rowIdx, 16).setValue(data.noTtb); fields.push("NO. TTB"); }
  // Kolom 17 (Q) = TGL INPUT TTB
  if (data.tglInputTtb !== undefined) { sheet.getRange(rowIdx, 17).setValue(formatDateForSheet(data.tglInputTtb)); fields.push("TGL INPUT TTB"); }
  // Kolom 18 (R) = TGL KE TIM LAPANGAN
  if (data.tglKeTimLapangan !== undefined) { sheet.getRange(rowIdx, 18).setValue(formatDateForSheet(data.tglKeTimLapangan)); fields.push("TGL KE TIM LAP"); }
  // Kolom 20 (T) = PIC LAPANGAN
  if (data.picLap !== undefined) { sheet.getRange(rowIdx, 20).setValue(data.picLap); fields.push("PIC LAPANGAN"); }
  // Kolom 21 (U) = TGL BARANG DIANTAR
  if (data.tglBarangDiantar !== undefined) { sheet.getRange(rowIdx, 21).setValue(formatDateForSheet(data.tglBarangDiantar)); fields.push("TGL DIANTAR"); }
  // Kolom 22 (V) = KETERANGAN LAPANGAN
  if (data.ketLap !== undefined) { sheet.getRange(rowIdx, 22).setValue(data.ketLap); fields.push("KET LAPANGAN"); }
  // Kolom 23 (W) = TGL TIM LAPANGAN KE PIC TTB
  if (data.tglTimLapKePicTtb !== undefined) { sheet.getRange(rowIdx, 23).setValue(formatDateForSheet(data.tglTimLapKePicTtb)); fields.push("TGL LAP KE TTB"); }
  // Kolom 25 (Y) = TGL TTB KE PIC PCH
  if (data.tglTtbKePicPch !== undefined) { sheet.getRange(rowIdx, 25).setValue(formatDateForSheet(data.tglTtbKePicPch)); fields.push("TGL TTB KE PCH"); }

  // ADM PCH & Keuangan:
  if (data.tglKeAdmPch !== undefined) { sheet.getRange(rowIdx, 28).setValue(formatDateForSheet(data.tglKeAdmPch)); fields.push("TGL KE ADM"); }
  if (data.picAdm !== undefined) { sheet.getRange(rowIdx, 31).setValue(data.picAdm); fields.push("PIC ADM"); }
  if (data.noSpp !== undefined) { sheet.getRange(rowIdx, 32).setValue(data.noSpp); fields.push("NO. SPP"); }
  if (data.tglInputSpp !== undefined) { sheet.getRange(rowIdx, 33).setValue(formatDateForSheet(data.tglInputSpp)); fields.push("TGL INPUT SPP"); }
  if (data.tglKeKeuangan !== undefined) { sheet.getRange(rowIdx, 38).setValue(formatDateForSheet(data.tglKeKeuangan)); fields.push("TGL KE KEUANGAN"); }

  return fields;
}

function buildRowValues(rowNumber, data) {
  var row = [];
  row[0] = rowNumber;
  row[1] = data.picPch || '';
  row[2] = data.entity || 'CPL';
  row[3] = data.deptArmada || '';
  row[4] = data.fpb || '';
  row[5] = data.po || data.noPo || '-';
  row[6] = formatDateForSheet(data.tglPo);
  row[7] = data.deliveryTime || '1 MINGGU';
  row[8] = data.noFstb || '';
  row[9] = formatDateForSheet(data.tglInputFstb);
  row[10] = formatDateForSheet(data.tglKePicTtb);
  row[11] = data.waktuKePicTtb || '';
  row[12] = data.ketPch || data.keterangan || '';
  row[13] = ''; // Kolom N: LAPSE DAY (rumus)
  row[14] = data.picTtb || ''; // Kolom O: PIC TTB
  row[15] = data.noTtb || ''; // Kolom P: TTB
  row[16] = formatDateForSheet(data.tglInputTtb);
  row[17] = formatDateForSheet(data.tglKeTimLapangan);
  row[18] = ''; // Kolom S: LAPSE DAY (rumus)
  row[19] = data.picLap || '';
  row[20] = formatDateForSheet(data.tglBarangDiantar);
  row[21] = data.ketLap || '';
  row[22] = formatDateForSheet(data.tglTimLapKePicTtb);
  row[23] = ''; // Kolom X: LAPSE DAY (rumus)
  row[24] = formatDateForSheet(data.tglTtbKePicPch);
  row[25] = '';
  row[26] = '';
  row[27] = formatDateForSheet(data.tglKeAdmPch);
  row[28] = '';
  row[29] = '';
  row[30] = data.picAdm || '';
  row[31] = data.noSpp || '';
  row[32] = formatDateForSheet(data.tglInputSpp);
  row[33] = '';
  row[34] = '';
  row[35] = '';
  row[36] = '';
  row[37] = formatDateForSheet(data.tglKeKeuangan);
  row[38] = '';
  row[39] = '';
  return row;
}

function formatDateForSheet(str) {
  if (!str || str === '-') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    var parts = str.slice(0, 10).split('-');
    return parts[2] + '-' + parts[1] + '-' + parts[0];
  }
  return str;
}

function handleGetData(sheet) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    totalRows: values.length,
    rows: values
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * GOOGLE APPS SCRIPT WEBHOOK UNTUK CPG PROCUREMENT MONITORING SYSTEM
 * 
 * Petunjuk Pemasangan di Google Sheets:
 * 1. Buka spreadsheet "Monitoring Berkas Internal Procurement"
 * 2. Klik menu "Ekstensi" (Extensions) -> "Apps Script"
 * 3. Hapus kode bawaan (myFunction), lalu salin & tempel seluruh kode ini
 * 4. Klik tombol "Simpan" (ikon disket)
 * 5. Klik tombol biru "Terapkan" (Deploy) -> "Penerapan baru" (New deployment)
 * 6. Pilih jenis: "Aplikasi web" (Web app)
 * 7. Konfigurasi:
 *    - Deskripsi: CPG Webhook Sync
 *    - Jalankan sebagai (Execute as): Saya (email Anda)
 *    - Siapa yang memiliki akses (Who has access): Siapa saja (Anyone)
 * 8. Klik "Terapkan" (Deploy) dan berikan izin akses Google (Review permissions -> Allow)
 * 9. Salin "URL Aplikasi Web" (Web app URL) yang berakhiran `/exec`, lalu masukkan ke Dashboard!
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Tidak ada data payload yang diterima."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || 'update_row';
    var data = payload.data || payload;

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('PROCUREMENT') || ss.getSheets()[0];

    // Action: get_data (Ambil seluruh baris sheet via Webhook tanpa batasan 401/403)
    if (action === 'get_data' || action === 'sync') {
      return handleGetData(sheet);
    }

    var headerRow = 2;
    var lastRow = sheet.getLastRow();

    if (action === 'create_row') {
      var newRowIdx = lastRow + 1;
      var newRowValues = buildRowValues(sheet, newRowIdx - headerRow, data);
      sheet.appendRow(newRowValues);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Baris baru berhasil ditambahkan ke Google Sheets!",
        row: newRowIdx,
        fpb: data.fpb,
        po: data.po
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Action: update_row
    var targetFpb = String(data.fpb || '').trim().toUpperCase();
    var targetPo = String(data.po || data.noPo || '').trim().toUpperCase();

    if (!targetFpb && !targetPo && !data.rowIdx) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "Harus menyertakan No. FPB atau No. PO untuk memperbarui baris."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var fpbRange = sheet.getRange(headerRow + 1, 5, Math.max(1, lastRow - headerRow), 2).getValues();
    var targetRowIndex = -1;

    for (var r = 0; r < fpbRange.length; r++) {
      var rowFpb = String(fpbRange[r][0] || '').trim().toUpperCase();
      var rowPo = String(fpbRange[r][1] || '').trim().toUpperCase();

      if (targetFpb && rowFpb === targetFpb) {
        targetRowIndex = headerRow + 1 + r;
        break;
      }
      if (targetPo && targetPo !== '-' && rowPo === targetPo) {
        targetRowIndex = headerRow + 1 + r;
        break;
      }
    }

    if (targetRowIndex < 0 && data.rowIdx && data.rowIdx > headerRow && data.rowIdx <= lastRow) {
      targetRowIndex = Number(data.rowIdx);
    }

    if (targetRowIndex < 0) {
      var newRowIdx = lastRow + 1;
      var newRowValues = buildRowValues(sheet, newRowIdx - headerRow, data);
      sheet.appendRow(newRowValues);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "No. FPB belum terdaftar, otomatis ditambahkan sebagai baris baru di baris " + newRowIdx,
        row: newRowIdx,
        fpb: data.fpb,
        po: data.po
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Update baris yang ditemukan
    updateRowCells(sheet, targetRowIndex, data);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Data baris " + targetRowIndex + " (FPB: " + data.fpb + ") berhasil diperbarui di Google Sheets!",
      row: targetRowIndex,
      fpb: data.fpb,
      po: data.po
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

function handleGetData(sheet) {
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    totalRows: values.length,
    rows: values
  })).setMimeType(ContentService.MimeType.JSON);
}

function updateRowCells(sheet, rowIdx, data) {
  // Purchasing:
  if (data.picPch !== undefined) sheet.getRange(rowIdx, 2).setValue(data.picPch);
  if (data.entity !== undefined) sheet.getRange(rowIdx, 3).setValue(data.entity);
  if (data.deptArmada !== undefined) sheet.getRange(rowIdx, 4).setValue(data.deptArmada);
  if (data.fpb !== undefined) sheet.getRange(rowIdx, 5).setValue(data.fpb);
  if (data.po !== undefined || data.noPo !== undefined) sheet.getRange(rowIdx, 6).setValue(data.po || data.noPo || '-');
  if (data.tglPo !== undefined) sheet.getRange(rowIdx, 7).setValue(formatDateForSheet(data.tglPo));
  if (data.deliveryTime !== undefined) sheet.getRange(rowIdx, 8).setValue(data.deliveryTime);
  if (data.noFstb !== undefined) sheet.getRange(rowIdx, 9).setValue(data.noFstb);
  if (data.tglInputFstb !== undefined) sheet.getRange(rowIdx, 10).setValue(formatDateForSheet(data.tglInputFstb));
  if (data.tglKePicTtb !== undefined) sheet.getRange(rowIdx, 11).setValue(formatDateForSheet(data.tglKePicTtb));
  if (data.waktuKePicTtb !== undefined) sheet.getRange(rowIdx, 12).setValue(data.waktuKePicTtb);
  if (data.ketPch !== undefined || data.keterangan !== undefined) sheet.getRange(rowIdx, 13).setValue(data.ketPch || data.keterangan || '');

  // Logistik & Tim Lapangan:
  if (data.picTtb !== undefined) sheet.getRange(rowIdx, 15).setValue(data.picTtb);
  if (data.noTtb !== undefined) sheet.getRange(rowIdx, 16).setValue(data.noTtb);
  if (data.tglInputTtb !== undefined) sheet.getRange(rowIdx, 17).setValue(formatDateForSheet(data.tglInputTtb));
  if (data.tglKeTimLapangan !== undefined) sheet.getRange(rowIdx, 18).setValue(formatDateForSheet(data.tglKeTimLapangan));
  if (data.picLap !== undefined) sheet.getRange(rowIdx, 20).setValue(data.picLap);
  if (data.tglBarangDiantar !== undefined) sheet.getRange(rowIdx, 21).setValue(formatDateForSheet(data.tglBarangDiantar));
  if (data.ketLap !== undefined) sheet.getRange(rowIdx, 22).setValue(data.ketLap);
  if (data.tglTimLapKePicTtb !== undefined) sheet.getRange(rowIdx, 23).setValue(formatDateForSheet(data.tglTimLapKePicTtb));
  if (data.tglTtbKePicPch !== undefined) sheet.getRange(rowIdx, 25).setValue(formatDateForSheet(data.tglTtbKePicPch));

  // ADM PCH & Keuangan:
  if (data.tglKeAdmPch !== undefined) sheet.getRange(rowIdx, 28).setValue(formatDateForSheet(data.tglKeAdmPch));
  if (data.picAdm !== undefined) sheet.getRange(rowIdx, 31).setValue(data.picAdm);
  if (data.noSpp !== undefined) sheet.getRange(rowIdx, 32).setValue(data.noSpp);
  if (data.tglInputSpp !== undefined) sheet.getRange(rowIdx, 33).setValue(formatDateForSheet(data.tglInputSpp));
  if (data.tglKeKeuangan !== undefined) sheet.getRange(rowIdx, 38).setValue(formatDateForSheet(data.tglKeKeuangan));
}

function buildRowValues(sheet, rowNumber, data) {
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
  row[13] = '';
  row[14] = data.picTtb || '';
  row[15] = data.noTtb || '';
  row[16] = formatDateForSheet(data.tglInputTtb);
  row[17] = formatDateForSheet(data.tglKeTimLapangan);
  row[18] = '';
  row[19] = data.picLap || '';
  row[20] = formatDateForSheet(data.tglBarangDiantar);
  row[21] = data.ketLap || '';
  row[22] = formatDateForSheet(data.tglTimLapKePicTtb);
  row[23] = '';
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

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'ping';
  if (action === 'get_data' || action === 'sync') {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('PROCUREMENT') || ss.getSheets()[0];
    return handleGetData(sheet);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "active",
    message: "CPG Procurement Webhook is running and ready to receive POST requests!"
  })).setMimeType(ContentService.MimeType.JSON);
}

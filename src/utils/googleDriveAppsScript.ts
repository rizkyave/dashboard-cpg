/**
 * Template Kode Google Apps Script & Utilitas Sinkronisasi Google Drive Database
 * untuk modul Upload Dokumen TTB Logistik CPG.
 */

import { UploadedTtbItem } from '@/types/ttbUpload';

export const DEFAULT_DRIVE_FOLDER_ID = '1Hd6FsgWiALq1jJyRvh8auY0FJGE9h5tf';
export const DEFAULT_DRIVE_FOLDER_URL = `https://drive.google.com/drive/folders/${DEFAULT_DRIVE_FOLDER_ID}`;

export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * =========================================================================
 * GOOGLE APPS SCRIPT: DATABASE & FILE UPLOAD ENGINE TTB CPG
 * =========================================================================
 * Script ini mengotomatiskan:
 * 1. Penyimpanan berkas foto/scan TTB ke Folder Google Drive logistik CPG.
 * 2. Mengatur izin akses publik (Anyone with link can view).
 * 3. Pembuatan & pencatatan baris transaksi ke Google Spreadsheet "DATABASE_UPLOAD_TTB".
 * 4. Mengembalikan URL preview, ID berkas, dan tautan unduhan langsung.
 * 
 * PANDUAN DEPLOY CEPAT (1 MENIT):
 * 1. Buka https://script.google.com/
 * 2. Klik "New Project" (Beri judul: "CPG TTB Drive Database")
 * 3. Hapus kode bawaan, lalu tempel SELURUH KODE ini di file "Code.gs"
 * 4. Klik tombol "Deploy" (kanan atas) -> pilih "New deployment"
 * 5. Klik icon Gear (⚙) di samping "Select type" -> pilih "Web app"
 * 6. Konfigurasi:
 *    - Description : CPG TTB API v1
 *    - Execute as  : Me (akun Google Anda)
 *    - Who has access: Anyone (PENTING agar dashboard web dapat mengirim data)
 * 7. Klik "Deploy", lalu jika muncul popup otorisasi, klik "Review permissions" -> "Advanced" -> "Go to CPG TTB (unsafe)" -> "Allow".
 * 8. Salin "Web app URL" (format: https://script.google.com/macros/s/.../exec)
 * 9. Tempel URL tersebut di Dashboard CPG -> menu "Upload TTB" -> "Database Google Drive".
 * =========================================================================
 */

var DEFAULT_TARGET_FOLDER_ID = "${DEFAULT_DRIVE_FOLDER_ID}";
var DATABASE_SHEET_NAME = "DATABASE_UPLOAD_TTB";

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Tidak ada data payload yang diterima." });
    }

    var data = JSON.parse(e.postData.contents);
    var action = data.action || "upload";

    if (action === "ping") {
      return handlePing(data);
    }

    if (action === "upload") {
      return handleUpload(data);
    }

    return createJsonResponse({ success: false, error: "Aksi tidak dikenali: " + action });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || "ping";
    var folderId = (e && e.parameter && e.parameter.folderId) || DEFAULT_TARGET_FOLDER_ID;
    if (action === "list") {
      return handleList(folderId);
    }
    return handlePing({ folderId: folderId });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function handlePing(data) {
  var folderId = (data && data.folderId) || DEFAULT_TARGET_FOLDER_ID;
  var folderName = "Folder TTB CPG";
  var spreadsheetUrl = "";

  try {
    var folder = DriveApp.getFolderById(folderId);
    folderName = folder.getName();
    var sheetFile = getOrCreateDatabaseSheet(folder);
    spreadsheetUrl = sheetFile.getUrl();
  } catch (e) {
    // Non-fatal
  }

  return createJsonResponse({
    success: true,
    status: "connected",
    message: "Koneksi ke Database Google Drive berhasil!",
    folderId: folderId,
    folderName: folderName,
    spreadsheetUrl: spreadsheetUrl,
    timestamp: new Date().toISOString()
  });
}

function handleUpload(data) {
  var folderId = data.folderId || DEFAULT_TARGET_FOLDER_ID;
  var folder;
  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (e) {
    folder = DriveApp.getRootFolder();
  }

  var metadata = data.metadata || {};
  var files = data.files || [];
  if (files.length === 0) {
    return createJsonResponse({ success: false, error: "Daftar berkas kosong." });
  }

  // Buka atau buat Google Spreadsheet Database
  var ssFile = getOrCreateDatabaseSheet(folder);
  var ss = SpreadsheetApp.open(ssFile);
  var sheet = ss.getActiveSheet();

  var uploadedResults = [];
  var now = new Date();
  var timestampStr = Utilities.formatDate(now, "Asia/Makassar", "yyyy-MM-dd HH:mm:ss");

  for (var i = 0; i < files.length; i++) {
    var fileData = files[i];
    var fileName = fileData.fileName || ("TTB_" + now.getTime() + ".jpg");
    var mimeType = fileData.mimeType || "image/jpeg";
    var base64Data = fileData.base64;

    var decodedBytes = Utilities.base64Decode(base64Data);
    var blob = Utilities.newBlob(decodedBytes, mimeType, fileName);

    // Simpan berkas ke Folder Google Drive
    var driveFile = folder.createFile(blob);
    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (permErr) {
      // Abaikan jika dibatasi kebijakan organisasi
    }

    var fileId = driveFile.getId();
    var webViewLink = driveFile.getUrl();
    var downloadUrl = "https://drive.google.com/uc?export=download&id=" + fileId;
    var fileSize = driveFile.getSize();

    // Catat baris transaksi ke Database Spreadsheet
    sheet.appendRow([
      timestampStr,
      metadata.id || ("REC-" + now.getTime() + "-" + (i + 1)),
      metadata.noTtb || "-",
      metadata.cleanNoTtb || "-",
      metadata.armada || "-",
      metadata.receivedDate || "-",
      metadata.keterangan || "",
      fileData.originalFileName || fileName,
      fileName,
      fileSize,
      mimeType,
      fileId,
      webViewLink,
      downloadUrl,
      folder.getUrl()
    ]);

    uploadedResults.push({
      fileName: fileName,
      originalFileName: fileData.originalFileName || fileName,
      fileId: fileId,
      fileSize: fileSize,
      mimeType: mimeType,
      webViewLink: webViewLink,
      downloadUrl: downloadUrl,
      driveFolderUrl: folder.getUrl()
    });
  }

  return createJsonResponse({
    success: true,
    message: "Berhasil menyimpan " + uploadedResults.length + " berkas ke Google Drive dan Database Google Sheets.",
    folderId: folder.getId(),
    folderUrl: folder.getUrl(),
    spreadsheetUrl: ssFile.getUrl(),
    files: uploadedResults
  });
}

function handleList(folderId) {
  try {
    var targetFolderId = folderId || DEFAULT_TARGET_FOLDER_ID;
    var folder;
    try {
      folder = DriveApp.getFolderById(targetFolderId);
    } catch (err) {
      folder = DriveApp.getRootFolder();
    }

    var ssFile = getOrCreateDatabaseSheet(folder);
    var ss = SpreadsheetApp.open(ssFile);
    var sheet = ss.getActiveSheet();
    var data = sheet.getDataRange().getValues();

    if (data.length <= 1) {
      return createJsonResponse({ success: true, spreadsheetUrl: ssFile.getUrl(), items: [] });
    }

    var items = [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r];
      if (!row[0] && !row[2]) continue;

      var dateVal = row[0];
      var dateStr = (dateVal instanceof Date) ? dateVal.toISOString() : (dateVal ? String(dateVal) : new Date().toISOString());

      items.push({
        uploadedAt: dateStr,
        id: String(row[1] || ("REC-" + r)),
        noTtb: String(row[2] || "-"),
        cleanNoTtb: String(row[3] || "-"),
        armada: String(row[4] || "-"),
        receivedDate: String(row[5] || "-"),
        keterangan: String(row[6] || ""),
        originalFileName: String(row[7] || ""),
        renamedFileName: String(row[8] || ""),
        fileSize: Number(row[9] || 0),
        fileType: String(row[10] || "image/jpeg"),
        driveFileId: String(row[11] || ""),
        driveViewUrl: String(row[12] || ""),
        driveDownloadUrl: String(row[13] || ""),
        fileUrl: String(row[12] || ""),
        driveFolderUrl: String(row[14] || folder.getUrl()),
        spreadsheetUrl: ssFile.getUrl(),
        status: "SAVED_TO_DRIVE_DATABASE"
      });
    }

    return createJsonResponse({
      success: true,
      spreadsheetUrl: ssFile.getUrl(),
      total: items.length,
      items: items.reverse()
    });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function getOrCreateDatabaseSheet(folder) {
  var files = folder.getFilesByName(DATABASE_SHEET_NAME);
  if (files.hasNext()) {
    return files.next();
  }

  // Buat Spreadsheet baru di dalam folder jika belum ada
  var ss = SpreadsheetApp.create(DATABASE_SHEET_NAME);
  var ssFile = DriveApp.getFileById(ss.getId());
  
  // Pindahkan ke target folder
  try {
    ssFile.moveTo(folder);
  } catch (e) {
    // Abaikan jika sudah di root atau izin terbatas
  }

  var sheet = ss.getActiveSheet();
  sheet.setName("Log_TTB");

  var headers = [
    "Waktu Upload (WITA)",
    "ID Transaksi",
    "No. TTB",
    "Clean No. TTB",
    "Armada / Unit",
    "Tanggal Penerimaan",
    "Keterangan",
    "Nama File Asli",
    "Nama File Resmi (Drive)",
    "Ukuran (Bytes)",
    "Tipe Berkas",
    "ID File Drive",
    "Link Buka File (Preview)",
    "Link Unduh Langsung",
    "Folder Google Drive"
  ];

  sheet.appendRow(headers);

  // Styling header Spreadsheet
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground("#0F766E"); // Teal 700
  headerRange.setFontColor("#FFFFFF");
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);

  try {
    ssFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  return ssFile;
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export interface GoogleDriveUploadPayloadFile {
  fileName: string;
  originalFileName: string;
  mimeType: string;
  base64: string;
}

export interface GoogleDriveUploadPayload {
  action: 'upload' | 'ping';
  folderId: string;
  metadata?: {
    id?: string;
    noTtb: string;
    cleanNoTtb: string;
    armada: string;
    receivedDate: string;
    keterangan?: string;
  };
  files?: GoogleDriveUploadPayloadFile[];
}

export interface GoogleDriveUploadResultFile {
  fileName: string;
  originalFileName: string;
  fileId: string;
  fileSize: number;
  mimeType: string;
  webViewLink: string;
  downloadUrl: string;
  driveFolderUrl: string;
}

export interface GoogleDriveUploadResponse {
  success: boolean;
  message?: string;
  folderId?: string;
  folderUrl?: string;
  spreadsheetUrl?: string;
  files?: GoogleDriveUploadResultFile[];
  error?: string;
}

/**
 * Mengirim payload upload ke Web App Google Apps Script
 */
export async function uploadToGoogleDriveAppsScript(
  scriptUrl: string,
  payload: GoogleDriveUploadPayload,
  timeoutMs: number = 30000
): Promise<GoogleDriveUploadResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8', // Hindari preflight CORS strict di Google Apps Script
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`Google Apps Script merespons status ${res.status}`);
    }

    const data: GoogleDriveUploadResponse = await res.json();
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Uji konektivitas ke Web App Google Apps Script
 */
export async function pingGoogleDriveAppsScript(
  scriptUrl: string,
  folderId: string = DEFAULT_DRIVE_FOLDER_ID
): Promise<{ success: boolean; status?: string; message?: string; spreadsheetUrl?: string; error?: string }> {
  try {
    const targetUrl = new URL(scriptUrl);
    targetUrl.searchParams.set('action', 'ping');
    targetUrl.searchParams.set('folderId', folderId);

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
    });

    if (!res.ok) {
      return { success: false, error: `HTTP ${res.status}` };
    }

    const json = await res.json();
    return json;
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

/**
 * Mengambil daftar berkas riwayat langsung dari Database Spreadsheet Google Drive
 */
export async function listGoogleDriveDatabaseItems(
  scriptUrl: string,
  folderId: string = DEFAULT_DRIVE_FOLDER_ID,
  timeoutMs: number = 15000
): Promise<{ success: boolean; items?: UploadedTtbItem[]; spreadsheetUrl?: string; total?: number; error?: string }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const targetUrl = new URL(scriptUrl);
    targetUrl.searchParams.set('action', 'list');
    targetUrl.searchParams.set('folderId', folderId);

    const res = await fetch(targetUrl.toString(), {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      return { success: false, error: `Google Apps Script merespons status ${res.status}` };
    }

    const json = await res.json();
    return json;
  } catch (err) {
    clearTimeout(timeoutId);
    return { success: false, error: (err as Error).message };
  }
}


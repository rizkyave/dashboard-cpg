import csv
import re
from datetime import datetime
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Read raw data
with open(r'e:\Dashboard-cpg web\scripts\raw_crew_data.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

ROMAN_REGEX = r'^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV|XXXVI|XXXVII|XXXVIII|XXXIX|XL|XLI|XLII|XLIII|XLIV|XLV|XLVI|XLVII|XLVIII|XLIX|L|LI|LII|LIII|LIV|LV|LVI|LVII|LVIII|LIX|LX)\.\s*(.*)'

MONTH_MAP = {
    'januari': '01', 'jan': '01',
    'februari': '02', 'feb': '02',
    'maret': '03', 'mar': '03',
    'april': '04', 'apr': '04',
    'mei': '05', 'may': '05',
    'juni': '06', 'jun': '06',
    'juli': '07', 'jul': '07',
    'agustus': '08', 'agt': '08', 'agu': '08',
    'september': '09', 'sep': '09',
    'oktober': '10', 'okt': '10',
    'nopember': '11', 'november': '11', 'nop': '11', 'nov': '11',
    'desember': '12', 'des': '12'
}

def clean_date(d_str):
    if not d_str:
        return "", ""
    original = d_str.strip()
    audit_note = ""
    cleaned = original
    
    # Check typo 1924 -> 2024
    if cleaned.startswith('1924-'):
        cleaned = '2024-' + cleaned[5:]
        audit_note = "Koreksi typo tahun 1924 -> 2024"
    elif re.match(r'^\d{4}-\d{2}-\d{2}$', cleaned):
        pass
    else:
        m = re.match(r'^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$', cleaned)
        if m:
            day = m.group(1).zfill(2)
            month_name = m.group(2).lower()
            year = m.group(3)
            month = MONTH_MAP.get(month_name, '00')
            if month != '00':
                cleaned = f"{year}-{month}-{day}"
                audit_note = f"Standarisasi tanggal: '{original}' -> '{cleaned}'"
    return cleaned, audit_note

def clean_phone(p_str):
    if not p_str:
        return ""
    p_str = re.sub(r'[`\s\'\"]', '', p_str)
    if p_str.startswith('8') and len(p_str) in [10, 11, 12]:
        p_str = '0' + p_str
    return p_str

def get_vessel_type(v_name):
    name_upper = v_name.upper()
    if name_upper.startswith('SPOB') or 'SPOB' in name_upper:
        return 'SPOB'
    elif name_upper.startswith('TB') or 'TB.' in name_upper:
        return 'Tug Boat (TB)'
    elif name_upper.startswith('TK') or 'TK.' in name_upper:
        return 'Tongkang / Barge (TK)'
    elif name_upper.startswith('OB') or 'OB.' in name_upper:
        return 'Oil Barge (OB)'
    elif name_upper.startswith('SV') or 'SV.' in name_upper:
        return 'Supply Vessel (SV)'
    elif name_upper.startswith('MT') or 'MT.' in name_upper:
        return 'Motor Tanker (MT)'
    elif name_upper.startswith('LCT') or 'LCT.' in name_upper:
        return 'LCT'
    elif 'CREW BOAT' in name_upper or name_upper.startswith('CB'):
        return 'Crew Boat'
    elif 'CRANE BARGE' in name_upper:
        return 'Crane Barge'
    elif 'HOPPER BARGE' in name_upper or 'SP. HOPPER' in name_upper:
        return 'Hopper Barge'
    return 'Lainnya'

def get_department(jabatan):
    j_low = jabatan.lower()
    if 'cadet' in j_low:
        if 'deck' in j_low:
            return 'Deck (Cadet)'
        elif 'engine' in j_low:
            return 'Engine (Cadet)'
        return 'Trainee (Cadet)'
    deck_roles = ['nakhoda', 'mualim', 'bosun', 'juru mudi', 'kelasi', 'serang', 'a/b', 'a / b', 'able', 'barge master', 'asisten bm', 'operator', 'ka. kerja', 'pengawas']
    if any(r in j_low for r in deck_roles):
        return 'Deck'
    engine_roles = ['kkm', 'masinis', 'oiler', 'electrician', 'mandor']
    if any(r in j_low for r in engine_roles):
        return 'Engine'
    catering_roles = ['koki', 'messboy', 'cook']
    if any(r in j_low for r in catering_roles):
        return 'Catering / Galley'
    return 'Lainnya'

vessels = []
current_v = None

for idx, r in enumerate(rows):
    non_empty = [c.strip() for c in r if c.strip()]
    if not non_empty:
        continue
    line_str = " | ".join(non_empty)

    if any(k in line_str for k in ["DATA CREW", "TAHUN 2026", "2026-10-15", "contact@cindarapratama", "Jln. Letjend", "KONVERSI", "1 HP =", "1 KW =", "1 PS/PK ="]):
        continue
    if non_empty[0] == 'No' and 'NIK' in non_empty:
        continue

    m = None
    for c in non_empty[:3]:
        m = re.match(ROMAN_REGEX, c)
        if m:
            break
            
    if m:
        roman_num = m.group(1)
        vessel_name = m.group(2).strip()
        row_str = " ".join([x.strip() for x in r if x.strip()])
        
        gt_match = re.search(r'GT\s*([+]?\s*[\d\.,]+)', row_str, re.IGNORECASE)
        gt_val = gt_match.group(1).replace(' ', '') if gt_match else "-"
        
        phone_match = re.search(r'\b(0?811\d{6,8})\b', row_str)
        phone_val = phone_match.group(1) if phone_match else "-"
        if phone_val.startswith('8'):
            phone_val = '0' + phone_val
            
        hp_match = re.search(r'HP\s*([\d\sXx\.\,]+)', row_str, re.IGNORECASE)
        hp_val = hp_match.group(1).strip() if hp_match else "-"
        # remove arrows like ------>
        hp_val = re.sub(r'[\->]+', '', hp_val).strip()
        
        kw_match = re.search(r'KW\s*([\d\sXx\.\,]+)', row_str, re.IGNORECASE)
        kw_val = kw_match.group(1).strip() if kw_match else "-"
        if kw_val == "-":
            kw_match2 = re.search(r'([\d\sXx\.\,]+)\s*KW', row_str, re.IGNORECASE)
            if kw_match2:
                kw_val = kw_match2.group(1).strip()
        kw_val = re.sub(r'[\(\)\->]+', '', kw_val).strip()

        ps_match = re.search(r'(\d+)\s*PS', row_str, re.IGNORECASE)
        ps_val = ps_match.group(1).strip() + " PS" if ps_match else "-"

        # Clean vessel name: remove trailing commas or dots
        vessel_name = vessel_name.strip(' ,.')
        
        current_v = {
            'roman': roman_num,
            'name': vessel_name,
            'type': get_vessel_type(vessel_name),
            'gt': gt_val,
            'phone': phone_val,
            'hp': hp_val,
            'kw': kw_val,
            'ps': ps_val,
            'crew': []
        }
        vessels.append(current_v)
        continue
    elif "KAPTEN & KOKI RELIEF" in line_str:
        current_v = {
            'roman': 'RELIEF',
            'name': 'KAPTEN & KOKI RELIEF (SEA LION, OCEAN MAJENE & MAMUJU)',
            'type': 'Relief Pool',
            'gt': '-',
            'phone': '-',
            'hp': '-',
            'kw': '-',
            'ps': '-',
            'crew': []
        }
        vessels.append(current_v)
        continue

    if current_v is not None:
        current_v['crew'].append((idx, r))

# Process crew rows
master_crew = []
audit_logs = []
global_counter = 1

schools_list = [
    ("Poltekpel Barombong", "Politeknik Pelayaran Barombong"),
    ("POLITEKNIK PELAYARAN BAROMBONG", "Politeknik Pelayaran Barombong"),
    ("PIP Makassar", "Politeknik Ilmu Pelayaran Makassar"),
    ("Politeknik Ilmu Pelayaran Makassar", "Politeknik Ilmu Pelayaran Makassar"),
    ("PIP Balikpapan", "Politeknik Ilmu Pelayaran Balikpapan"),
    ("Politeknik Ilmu Pelayaran Balikpapan", "Politeknik Ilmu Pelayaran Balikpapan"),
    ("SMK PELAYARAN SAMUDERA PALOPO", "SMK Pelayaran Samudera Palopo"),
    ("SMKN 5 Balikpapan", "SMKN 5 Balikpapan"),
    ("SMKP Katangka Makassar", "SMK Pelayaran Katangka Makassar"),
    ("SMKN 3 Majene", "SMKN 3 Majene"),
    ("SMK 3 Majene", "SMKN 3 Majene"),
    ("Politeknik Maritim AMI Makassar", "Politeknik Maritim AMI Makassar"),
    ("Polimarin AMI Makassar", "Politeknik Maritim AMI Makassar"),
    ("SMKNPelayaran Kalimantan Samarinda", "SMKN Pelayaran Kalimantan Samarinda"),
    ("POLITEKNIK NEGERI SAMARINDA", "Politeknik Negeri Samarinda")
]

for v in vessels:
    v_seq = 1
    for line_idx, cr in v['crew']:
        # Handle trailing concatenated row (Line 149 - Mas'ud)
        if len(cr) > 14 and cr[14].strip().startswith('CPL-VSL'):
            extra_nik = cr[14].strip()
            extra_name = cr[15].strip()
            extra_jabatan = cr[16].strip()
            extra_hp = clean_phone(cr[17].strip())
            extra_ijazah = cr[18].strip()
            extra_vessel = cr[20].strip()
            extra_tgl, _ = clean_date(cr[21].strip())
            extra_ket = cr[22].strip()
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Data Bocor / Tertumpuk',
                'deskripsi': f"Data '{extra_name}' ({extra_nik}) untuk {extra_vessel} tertumpuk di ujung baris TB. CMPL 01. Dipisahkan dan dibersihkan."
            })
            cr = cr[:12]

        global_no = cr[1].strip() if len(cr) > 1 else ""
        vessel_seq = cr[2].strip() if len(cr) > 2 else ""
        nik = cr[3].strip() if len(cr) > 3 else ""
        name = cr[4].strip() if len(cr) > 4 else ""
        jabatan = cr[5].strip() if len(cr) > 5 else ""
        hp = cr[6].strip() if len(cr) > 6 else ""
        ijazah = cr[7].strip() if len(cr) > 7 else ""
        tahun_ijazah = cr[8].strip() if len(cr) > 8 else ""
        vessel_cell = cr[9].strip() if len(cr) > 9 else ""
        tgl_onboard = cr[10].strip() if len(cr) > 10 else ""
        keterangan = cr[11].strip() if len(cr) > 11 else ""

        # Filter out empty placeholder lines without even jabatan or name
        if not any([global_no, vessel_seq, nik, name, jabatan, hp, ijazah, tahun_ijazah, vessel_cell, tgl_onboard, keterangan]):
            continue

        audit_item = []

        # Audit shift / errors in tahun_ijazah
        if re.match(r'^0?8\d{8,}', tahun_ijazah):
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Kolom Bergeser',
                'deskripsi': f"Kolom Tahun Ijazah berisi nomor HP '{tahun_ijazah}'. Dipindahkan ke catatan dan kolom tahun dikosongkan."
            })
            audit_item.append("Tahun ijazah keliru nomor HP")
            tahun_ijazah = ""
        elif any(sh in tahun_ijazah for sh in ["Twin Sister", "Cakra", "CB."]):
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Kolom Bergeser',
                'deskripsi': f"Kolom Tahun Ijazah berisi nama kapal '{tahun_ijazah}'. Dihapus dan distandarisasi."
            })
            audit_item.append("Tahun ijazah keliru nama kapal")
            tahun_ijazah = ""

        # Clean backticks/quotes
        hp_cleaned = clean_phone(hp)
        if hp_cleaned != hp and hp:
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Karakter Kotor',
                'deskripsi': f"Pembersihan karakter HP '{hp}' -> '{hp_cleaned}'"
            })
            audit_item.append("Pembersihan format no HP")
        hp = hp_cleaned

        # Clean onboard date
        tgl_cleaned, tgl_audit = clean_date(tgl_onboard)
        if tgl_audit:
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Format Tanggal',
                'deskripsi': f"{tgl_audit} pada {name} ({v['name']})"
            })
            audit_item.append(tgl_audit)
        tgl_onboard = tgl_cleaned

        # Audit Jabatan
        if jabatan == 'Masinis IIII':
            audit_logs.append({
                'baris': line_idx,
                'kategori': 'Typo Jabatan',
                'deskripsi': f"Koreksi penulisan jabatan '{jabatan}' -> 'Masinis IV'"
            })
            audit_item.append("Koreksi Masinis IIII -> Masinis IV")
            jabatan = 'Masinis IV'

        # Standardize Ijazah
        ijazah = ijazah.strip()
        ijazah_std = re.sub(r'\s+', ' ', ijazah)
        ijazah_std = re.sub(r'ANT\s*-\s*', 'ANT-', ijazah_std)
        ijazah_std = re.sub(r'ATT\s*-\s*', 'ATT-', ijazah_std)
        ijazah_std = re.sub(r'ANT\s+', 'ANT-', ijazah_std)
        ijazah_std = re.sub(r'ATT\s+', 'ATT-', ijazah_std)
        ijazah_std = ijazah_std.replace('ANT-V O', 'ANT-V (O)').replace('ANT-IV O', 'ANT-IV (O)').replace('ANT-III O', 'ANT-III (O)')
        ijazah_std = ijazah_std.replace('ANT-V M', 'ANT-V (M)').replace('ANT-IV M', 'ANT-IV (M)').replace('ANT-III M', 'ANT-III (M)')
        ijazah_std = ijazah_std.replace('ATT-V O', 'ATT-V (O)').replace('ATT-IV O', 'ATT-IV (O)').replace('ATT-III O', 'ATT-III (O)')
        ijazah_std = ijazah_std.replace('ATT-V M', 'ATT-V (M)').replace('ATT-IV M', 'ATT-IV (M)').replace('ATT-III M', 'ATT-III (M)')
        ijazah_std = ijazah_std.replace('(O).', '(O)')

        # Status Slot
        is_vacant = False
        is_cadet = 'cadet' in jabatan.lower()
        if not name and jabatan:
            is_vacant = True
            slot_status = "LOWONG (VACANT)"
            name_display = "[POSISI LOWONG]"
        elif is_cadet:
            slot_status = "CADET (MAGANG)"
            name_display = name
        else:
            slot_status = "AKTIF"
            name_display = name

        # Institusi Cadet
        institusi = "-"
        if is_cadet:
            for pat, full_name in schools_list:
                if pat.lower() in keterangan.lower():
                    institusi = full_name
                    break

        # Status Penugasan & Ringkasan Keterangan
        ket_clean = keterangan.strip().lstrip('- `\'"').strip()
        status_tugas = "On Board"
        if "new hire" in ket_clean.lower() or "new join" in ket_clean.lower():
            status_tugas = "New Hire / New Join"
        elif "mutasi" in ket_clean.lower():
            status_tugas = "Mutasi Internal"
        elif "sign pkl" in ket_clean.lower():
            status_tugas = "Sign PKL"
        elif "rejoin" in ket_clean.lower():
            status_tugas = "Rejoin"
        elif "rencana" in ket_clean.lower() and "diri" in ket_clean.lower():
            status_tugas = "Rencana Resign"
            audit_item.append("Peringatan: Rencana mengundurkan diri")

        if is_vacant:
            status_tugas = "Belum Terisi"

        # Check duplicate Hilmi Noval
        if name == 'Muhammad Hilmi Noval A' and v['roman'] == 'XLI':
            audit_item.append("Catatan: Terdaftar ganda di SPOB Royal Rey 350 (28-01-2026)")
        elif name == 'Muhammad Hilmi Noval A' and v['roman'] == 'L':
            audit_item.append("Catatan: Penempatan terbaru (mutasi dari SPOB Royal Rey)")

        # Check duplicate NIK CPL-VSL-1447
        if nik == 'CPL-VSL-1447':
            audit_item.append("Peringatan: NIK CPL-VSL-1447 terduplikasi pada 2 crew di kapal yang sama")

        record = {
            'global_id': global_counter,
            'orig_global_no': global_no,
            'vessel_roman': v['roman'],
            'vessel_name': v['name'],
            'vessel_type': v['type'],
            'vessel_seq': v_seq,
            'nik': nik if nik else "-",
            'nama': name_display,
            'status_slot': slot_status,
            'jabatan': jabatan,
            'departemen': get_department(jabatan),
            'hp': hp if hp else "-",
            'ijazah': ijazah_std if ijazah_std else "-",
            'tahun_ijazah': tahun_ijazah if tahun_ijazah else "-",
            'tgl_onboard': tgl_onboard if tgl_onboard else "-",
            'status_tugas': status_tugas,
            'keterangan': ket_clean if ket_clean else "-",
            'institusi_cadet': institusi,
            'audit_note': "; ".join(audit_item) if audit_item else "-"
        }
        master_crew.append(record)
        global_counter += 1
        v_seq += 1

print(f"Total Master Crew records prepared: {len(master_crew)}")
print(f"Total Audit Logs: {len(audit_logs)}")

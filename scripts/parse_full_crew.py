import csv
import re
from datetime import datetime

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
        return ""
    d_str = d_str.strip()
    # Check typo 1924 -> 2024
    if d_str.startswith('1924-'):
        return '2024-' + d_str[5:]
    # Check YYYY-MM-DD
    if re.match(r'^\d{4}-\d{2}-\d{2}$', d_str):
        return d_str
    # Check DD Month YYYY (e.g., 09 Juni 2012, 17 Nopember 2009, 23 Januari 2026)
    m = re.match(r'^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$', d_str)
    if m:
        day = m.group(1).zfill(2)
        month_name = m.group(2).lower()
        year = m.group(3)
        month = MONTH_MAP.get(month_name, '00')
        if month != '00':
            return f"{year}-{month}-{day}"
    return d_str

def clean_phone(p_str):
    if not p_str:
        return ""
    # remove backticks, spaces
    p_str = re.sub(r'[`\s]', '', p_str)
    # if starts with 8 and length >= 10, prefix with 0
    if p_str.startswith('8') and len(p_str) in [10, 11, 12]:
        p_str = '0' + p_str
    return p_str

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

    # Vessel header check
    m = None
    vessel_cell = ""
    for c in non_empty[:3]:
        m = re.match(ROMAN_REGEX, c)
        if m:
            vessel_cell = c
            break
            
    if m:
        roman_num = m.group(1)
        vessel_name = m.group(2).strip()
        # Parse GT, Call/Phone, HP, KW from row
        # Let's inspect cells in r
        row_str = " ".join([x.strip() for x in r if x.strip()])
        
        gt_match = re.search(r'GT\s*([+]?\s*[\d\.,]+)', row_str, re.IGNORECASE)
        gt_val = gt_match.group(1).replace(' ', '') if gt_match else ""
        
        # Phone: 0811... or 811...
        phone_match = re.search(r'\b(0?811\d{6,8})\b', row_str)
        phone_val = phone_match.group(1) if phone_match else ""
        if phone_val.startswith('8'):
            phone_val = '0' + phone_val
            
        hp_match = re.search(r'HP\s*([\d\sXx\.\,]+)', row_str, re.IGNORECASE)
        hp_val = hp_match.group(1).strip() if hp_match else ""
        
        kw_match = re.search(r'KW\s*([\d\sXx\.\,]+)', row_str, re.IGNORECASE)
        kw_val = kw_match.group(1).strip() if kw_match else ""
        if not kw_val:
            # check e.g. 2 x 882 KW or 1 X 1468 KW or 2 X 670 KW
            kw_match2 = re.search(r'([\d\sXx\.\,]+)\s*KW', row_str, re.IGNORECASE)
            if kw_match2:
                kw_val = kw_match2.group(1).strip()
                
        # check PS
        ps_match = re.search(r'(\d+)\s*PS', row_str, re.IGNORECASE)
        ps_val = ps_match.group(1).strip() if ps_match else ""

        current_v = {
            'roman': roman_num,
            'name': vessel_name,
            'gt': gt_val,
            'phone': phone_val,
            'hp': hp_val,
            'kw': kw_val,
            'ps': ps_val,
            'raw_header': row_str,
            'crew': []
        }
        vessels.append(current_v)
        continue
    elif "KAPTEN & KOKI RELIEF" in line_str:
        current_v = {
            'roman': 'RELIEF',
            'name': 'KAPTEN & KOKI RELIEF SEA LION, OCEAN MAJENE & MAMUJU',
            'gt': '',
            'phone': '',
            'hp': '',
            'kw': '',
            'ps': '',
            'raw_header': line_str,
            'crew': []
        }
        vessels.append(current_v)
        continue

    if current_v is not None:
        current_v['crew'].append((idx, r))

print(f"Parsed {len(vessels)} vessel sections successfully.")

# Now parse crew rows
all_parsed_crew = []

for v in vessels:
    for line_idx, cr in v['crew']:
        # cr typically has:
        # col 0: empty
        # col 1: global no
        # col 2: vessel seq no
        # col 3: NIK
        # col 4: Nama
        # col 5: Jabatan
        # col 6: NO. HP
        # col 7: IJAZAH
        # col 8: TAHUN
        # col 9: Vessel
        # col 10: Sign On Date
        # col 11: Keterangan
        # col 12+: Extra
        
        # Check if line 149 (the one with Mas'ud concatenated)
        extra_person = None
        if len(cr) > 14 and cr[14].strip().startswith('CPL-VSL'):
            extra_person = cr[14:]
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
        
        # Check if all empty
        if not any([global_no, vessel_seq, nik, name, jabatan, hp, ijazah, tahun_ijazah, vessel_cell, tgl_onboard, keterangan]):
            continue
            
        # Detect anomaly: Tahun Ijazah containing vessel name or phone number
        # e.g. line 427: Rating, 085258592121, HB. Cakra VII
        if re.match(r'^0?8\d{8,}', tahun_ijazah):
            # phone accidentally in tahun_ijazah!
            # check if hp already has phone or empty
            tahun_ijazah = ""
            
        # e.g. line 133: 'SV. Twin Sister 305' in tahun_ijazah
        if "Twin Sister" in tahun_ijazah or "Cakra" in tahun_ijazah:
            tahun_ijazah = ""
            
        # Clean phone
        hp = clean_phone(hp)
        
        # Clean onboard date
        tgl_onboard = clean_date(tgl_onboard)
        
        # Check if vacant position
        is_vacant = False
        if not name and jabatan:
            is_vacant = True
        elif not name and not jabatan:
            continue # empty slot
            
        # Classify status / remark
        # Check if cadet
        is_cadet = 'cadet' in jabatan.lower()
        institusi = ""
        if is_cadet:
            # Check keterangan for school
            schools = [
                "Poltekpel Barombong", "PIP Makassar", "PIP Balikpapan", 
                "SMK PELAYARAN SAMUDERA PALOPO", "SMKN 5 Balikpapan", 
                "SMKP Katangka Makassar", "SMKN 3 Majene", "SMK 3 Majene", 
                "Politeknik Maritim AMI Makassar", "Polimarin AMI Makassar",
                "POLITEKNIK PELAYARAN BAROMBONG", "Politeknik Ilmu Pelayaran Makassar",
                "SMKNPelayaran Kalimantan Samarinda", "POLITEKNIK NEGERI SAMARINDA",
                "Politeknik Ilmu Pelayaran Balikpapan"
            ]
            for s in schools:
                if s.lower() in keterangan.lower():
                    institusi = s
                    break
                    
        item = {
            'line_idx': line_idx,
            'vessel_roman': v['roman'],
            'vessel_name': v['name'],
            'global_no': global_no,
            'vessel_seq': vessel_seq,
            'nik': nik,
            'name': name if name else "[LOWONG / VACANT]",
            'jabatan': jabatan,
            'is_vacant': is_vacant,
            'is_cadet': is_cadet,
            'hp': hp,
            'ijazah': ijazah,
            'tahun_ijazah': tahun_ijazah,
            'vessel_penempatan': vessel_cell if vessel_cell else v['name'],
            'tgl_onboard': tgl_onboard,
            'keterangan': keterangan,
            'institusi_cadet': institusi
        }
        all_parsed_crew.append(item)
        
        if extra_person:
            # Add extra person parsed
            print(f"Extra person extracted: {extra_person}")

print(f"Total crew records processed: {len(all_parsed_crew)}")
vacants = [c for c in all_parsed_crew if c['is_vacant']]
active = [c for c in all_parsed_crew if not c['is_vacant']]
cadets = [c for c in all_parsed_crew if c['is_cadet']]

print(f"Active crew: {len(active)}")
print(f"Vacant positions: {len(vacants)}")
print(f"Cadets: {len(cadets)}")

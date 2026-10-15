import csv
import re

with open(r'e:\Dashboard-cpg web\scripts\raw_crew_data.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

ROMAN_REGEX = r'^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV|XXXVI|XXXVII|XXXVIII|XXXIX|XL|XLI|XLII|XLIII|XLIV|XLV|XLVI|XLVII|XLVIII|XLIX|L|LI|LII|LIII|LIV|LV|LVI|LVII|LVIII|LIX|LX)\.\s*(.*)'

vessel_list = []
current_v = None

for idx, r in enumerate(rows):
    non_empty = [c.strip() for c in r if c.strip()]
    if not non_empty:
        continue
    line_str = " | ".join(non_empty)

    # Check if header info or conversion info
    if any(k in line_str for k in ["DATA CREW", "TAHUN 2026", "2026-10-15", "contact@cindarapratama", "Jln. Letjend", "KONVERSI", "1 HP =", "1 KW =", "1 PS/PK ="]):
        continue
    if non_empty[0] == 'No' and 'NIK' in non_empty:
        continue

    # Match vessel header
    m = None
    for c in non_empty[:3]:
        m = re.match(ROMAN_REGEX, c)
        if m:
            break
            
    if m:
        current_v = {
            'line_idx': idx,
            'roman': m.group(1),
            'vessel_title': m.group(2),
            'raw_row': r,
            'crew': []
        }
        vessel_list.append(current_v)
        continue
    elif "KAPTEN & KOKI RELIEF" in line_str:
        current_v = {
            'line_idx': idx,
            'roman': 'RELIEF',
            'vessel_title': 'KAPTEN & KOKI RELIEF SEA LION, OCEAN MAJENE & MAMUJU',
            'raw_row': r,
            'crew': []
        }
        vessel_list.append(current_v)
        continue

    if current_v is not None:
        current_v['crew'].append((idx, r))

print(f"Total vessel sections: {len(vessel_list)}")
for v in vessel_list:
    crew_count = len(v['crew'])
    # check how many have names vs empty
    active_crew = 0
    vacant_crew = 0
    for l_idx, cr in v['crew']:
        ne = [x.strip() for x in cr if x.strip()]
        # check if empty position
        # usually cr[4] is Nama
        name = cr[4].strip() if len(cr) > 4 else ""
        jabatan = cr[5].strip() if len(cr) > 5 else ""
        if not name and jabatan:
            vacant_crew += 1
        elif name:
            active_crew += 1
        elif not name and not jabatan:
            # check if completely empty or has something
            pass
    print(f"[{v['roman']:<7}] {v['vessel_title'][:35]:<35} | Total: {crew_count:2d} | Active: {active_crew:2d} | Vacant: {vacant_crew:2d} | Raw Row: {[x for x in v['raw_row'] if x.strip()][:5]}")

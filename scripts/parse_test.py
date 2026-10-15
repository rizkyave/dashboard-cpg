import csv
import re

with open(r'e:\Dashboard-cpg web\scripts\raw_crew_data.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    rows = list(reader)

vessel_list = []
current_v = None

for idx, r in enumerate(rows):
    # filter empty
    non_empty = [c.strip() for c in r if c.strip()]
    if not non_empty:
        continue
    
    line_str = " | ".join(non_empty)
    
    # Check if header row for vessel
    # Looking for Roman numeral at beginning of non-empty
    m = re.match(r'^([IVXLCDM]+)\.\s*(.*)', non_empty[0])
    if not m and len(non_empty) > 1:
        # maybe non_empty[0] is not roman, check if any cell has Roman.
        for c in non_empty[:3]:
            m = re.match(r'^([IVXLCDM]+)\.\s*(.*)', c)
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
        
    # Check if header info or conversion info
    if any(k in line_str for k in ["DATA CREW", "TAHUN 2026", "2026-10-15", "contact@cindarapratama", "Jln. Letjend", "KONVERSI", "1 HP =", "1 KW =", "1 PS/PK ="]):
        continue
    if non_empty[0] == 'No' and 'NIK' in non_empty:
        continue
        
    # Otherwise it belongs to current_v
    if current_v is not None:
        current_v['crew'].append((idx, r))
    else:
        print(f"Orphan row at line {idx}: {non_empty}")

print(f"Total vessels captured: {len(vessel_list)}")
for v in vessel_list:
    print(f"[{v['roman']}] {v['vessel_title']} -> {len(v['crew'])} crew rows")

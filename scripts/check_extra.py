import csv
import re

with open(r'e:\Dashboard-cpg web\scripts\raw_crew_data.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for idx, line in enumerate(lines, 1):
    parts = list(csv.reader([line]))[0]
    # Check length
    # print non-empty parts
    non_empty = [p for p in parts if p.strip()]
    if not non_empty:
        continue
    # Let's see lines with weird formats
    first_few = [p.strip() for p in parts[:6]]
    if any(re.match(r'^(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV|XXXVI|XXXVII|XXXVIII|XXXIX|XL|XLI|XLII|XLIII|XLIV|XLV|XLVI|XLVII|XLVIII|XLIX|L|LI|LII|LIII|LIV|LV|LVI|LVII|LVIII|LIX|LX)\.\s+', p) for p in parts[:4]):
        pass # vessel header
    elif "KONVERSI" in "".join(parts) or "Telp." in "".join(parts) or "DATA CREW" in "".join(parts) or "TAHUN" in "".join(parts) or "Jln." in "".join(parts) or "No,," in "".join(parts) or "2026-10-15" in "".join(parts):
        pass # meta header
    elif "KAPTEN & KOKI RELIEF" in "".join(parts):
        pass
    else:
        # should be a crew row or empty position row
        # print if len(parts) > 13 and has extra data
        if len(parts) > 12:
            extra = [p for p in parts[12:] if p.strip()]
            if extra:
                print(f"Line {idx} has EXTRA columns: {extra}")

import csv
import re

with open(r'e:\Dashboard-cpg web\scripts\raw_crew_data.csv', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")

vessels = []
current_vessel = None
crew_members = []

for idx, line in enumerate(lines, 1):
    raw = line.strip()
    if not raw:
        continue
    parts = list(csv.reader([line]))[0]
    # Check if vessel header
    # Usually vessel header has Roman numerals: I., II., III., etc.
    joined = " ".join(parts)
    m = re.search(r'\b(I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX|XXI|XXII|XXIII|XXIV|XXV|XXVI|XXVII|XXVIII|XXIX|XXX|XXXI|XXXII|XXXIII|XXXIV|XXXV|XXXVI|XXXVII|XXXVIII|XXXIX|XL|XLI|XLII|XLIII|XLIV|XLV|XLVI|XLVII|XLVIII|XLIX|L|LI|LII|LIII|LIV|LV|LVI|LVII|LVIII|LIX|LX)\.\s*(.*)', joined)
    if m:
        vessels.append((idx, m.group(1), m.group(2).strip(), parts))
    elif "KAPTEN & KOKI RELIEF" in joined:
        vessels.append((idx, "RELIEF", joined, parts))

print(f"Total vessel sections detected: {len(vessels)}")
for v in vessels:
    print(f"Line {v[0]}: {v[1]} -> {v[2][:60]}")

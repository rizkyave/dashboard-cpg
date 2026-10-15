from parse_full_crew import all_parsed_crew
from collections import Counter

active = [c for c in all_parsed_crew if not c['is_vacant']]

# Check duplicate NIKs
niks = [c['nik'] for c in active if c['nik']]
nik_counts = Counter(niks)
dup_niks = {k: v for k, v in nik_counts.items() if v > 1}

print("=== DUPLIKAT NIK ===")
for nik, count in dup_niks.items():
    matches = [c for c in active if c['nik'] == nik]
    print(f"NIK {nik} muncul {count}x:")
    for m in matches:
        print(f"  - [{m['vessel_roman']}] {m['vessel_name']} | {m['name']} | {m['jabatan']} | OnBoard: {m['tgl_onboard']}")

# Check duplicate Names
names = [c['name'].strip() for c in active if c['name'] and not c['is_vacant']]
name_counts = Counter(names)
dup_names = {k: v for k, v in name_counts.items() if v > 1}

print("\n=== DUPLIKAT NAMA CREW ===")
for name, count in dup_names.items():
    matches = [c for c in active if c['name'].strip() == name]
    print(f"Nama '{name}' muncul {count}x:")
    for m in matches:
        print(f"  - NIK: {m['nik']} | [{m['vessel_roman']}] {m['vessel_name']} | {m['jabatan']} | HP: {m['hp']} | OnBoard: {m['tgl_onboard']}")

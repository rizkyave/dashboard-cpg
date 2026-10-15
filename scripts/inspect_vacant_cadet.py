from parse_full_crew import all_parsed_crew, vessels

print("=== DAFTAR POSISI LOWONG (VACANT) ===")
vacants = [c for c in all_parsed_crew if c['is_vacant']]
for v in vacants:
    print(f"- Kapal [{v['vessel_roman']}] {v['vessel_name']}: Jabatan '{v['jabatan']}', Ijazah: '{v['ijazah']}'")

print("\n=== DAFTAR CADET DENGAN ASAL SEKOLAH ===")
cadets = [c for c in all_parsed_crew if c['is_cadet']]
for c in cadets:
    inst = c['institusi_cadet'] if c['institusi_cadet'] else "(Tidak tercantum)"
    print(f"- [{c['vessel_roman']}] {c['vessel_name']}: {c['name']} ({c['jabatan']}) -> {inst}")

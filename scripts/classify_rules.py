import openpyxl
from collections import Counter
import re
import os

def classify_record(no_brg, desc, qty, tb):
    c = str(no_brg or '').strip().upper()
    d = str(desc or '').strip().upper()
    prefix = c.split('-')[0].split('.')[0][:4]
    
    # 1. Non-Barang: Akun Finansial & Biaya
    if c.startswith('ACC-') or c in ['-1.0', '-2.0', '-2.1', '-2.2', '-2.3', '0.0', 'PPN', 'PBBKB', 'MISC'] or 'UANG MUKA' in d or 'SALDO AWAL' in d or (c.startswith('ACC') and not c.startswith('ACCU') and not c.startswith('ACTU')):
        return (
            'Akun Finansial & Biaya',
            'Akun Pembukuan / COA',
            'N/A',
            'Akun Akuntansi',
            'Keluarkan dari Master Persediaan'
        )

    # 2. Non-Barang: Jasa & Sewa Operasional
    if c.startswith('OAT') or 'ONGKOS ANGKUT' in d or 'HANDLING FEE' in d or 'TIME CHARTER' in d or 'SPOT CHARTER' in d or 'DREDGING' in d or c.startswith('JS ') or c.startswith('BCH-') or c in ['BMA', 'MEALS001', 'AKM001', 'PLT', 'PNP-01', 'SW-001', 'LOS-001', 'MOPS001', 'MOB-001'] or c.startswith('JASA') or c.startswith('JAS') or c.startswith('JTP') or 'JASA (SERVICE)' in d or 'JASA TANPA PAJAK' in d or 'BIAYA ' in d:
        if any(k in d for k in ['ONGKOS ANGKUT', 'HANDLING', 'CHARTER', 'SEWA ', 'BIAYA ANGKUT', 'CLEARANCE', 'DOCKING', 'LABUH TAMBAT', 'PANDU', 'FUMIGASI']):
            sub = 'Jasa Transportasi & Pelayaran'
            uom = 'Trip'
        else:
            sub = 'Jasa Perbaikan, Servis & Kalibrasi'
            uom = 'Pekerjaan'
        return (
            'Jasa & Layanan Operasional',
            sub,
            uom,
            'Jasa (Non-Fisik)',
            'Keluarkan dari Master Persediaan'
        )

    # 3. Bahan Bakar & Trading (Fuel / Oil Cargo)
    if any(k in d for k in ['BIOSOLAR', 'MFO-180', 'MFO-380', 'HSD', 'PERTAMINA DEX', 'DEXLITE', 'FUEL CONSUMPTION', 'FAME', 'CPO', 'CPKO', 'IPO', 'PERTALITE', 'MINYAK TANAH', 'MDO']) or c.startswith('TRD'):
        if not any(x in d for x in ['HOSE', 'TANGKI', 'GAUGE', 'SAMPLE', 'PASTA', 'PAST']):
            if 'BIOSOLAR' in d:
                sub = 'BBM - Biosolar (B30/B35/B50)'
            elif 'MFO' in d:
                sub = 'BBM - Marine Fuel Oil (MFO)'
            elif 'HSD' in d or 'SOLAR' in d:
                sub = 'BBM - High Speed Diesel (HSD)'
            elif 'PERTAMINA DEX' in d or 'DEXLITE' in d:
                sub = 'BBM - Pertamina Dex / Dexlite'
            elif any(x in d for x in ['CPO', 'CPKO', 'IPO', 'FAME']):
                sub = 'Kargo Cair / Nabati (CPO/FAME)'
            else:
                sub = 'BBM & Minyak Kargo'
            return (
                'Bahan Bakar & Kargo Minyak',
                sub,
                'Liter',
                'Barang Fisik',
                'Monitoring Bunker & Sounding Harian' if qty > 0 else 'Stok Kosong'
            )

    # 4. Pelumas & Gemuk
    if prefix in ['OLI1', 'OLI', 'GEMU', 'GEM'] or d.startswith('OLI ') or 'OLI (LUBRICANT)' in d or any(x in d for x in ['MEDITRAN', 'TURALIK', 'MEDRIPAL', 'RORED', 'GREASE', 'GEMUK']):
        if any(x in d for x in ['GREASE', 'GEMUK']):
            sub = 'Gemuk / Grease Pelumas'
            uom = 'Pail/Can'
        elif 'TURALIK' in d or 'HYDRAULIC' in d:
            sub = 'Oli Hidrolik (Hydraulic Oil)'
            uom = 'Liter'
        elif 'RORED' in d or 'GARDAN' in d or 'GEAR' in d:
            sub = 'Oli Gardan & Gearbox'
            uom = 'Liter'
        elif any(x in d for x in ['MEDITRAN', 'MEDRIPAL', 'DIESEL', 'MESIN']):
            sub = 'Oli Mesin Kapal (Engine Oil)'
            uom = 'Liter'
        else:
            sub = 'Pelumas Mesin & Industri'
            uom = 'Liter'
        return (
            'Pelumas & Gemuk',
            sub,
            uom,
            'Barang Fisik',
            'Buffer Stock Kamar Mesin' if qty > 0 else 'Stok Kosong'
        )

    # 5. Kimia, Coolant & Refrigerant
    if prefix in ['CAIR', 'CAI', 'THIN', 'THI', 'FRON', 'FRO', 'WARE', 'WAR', 'GAS1', 'GAS'] or d.startswith('CAIRAN') or any(x in d for x in ['CLEANER', 'DISPERSANT', 'COOLANT', 'FREON', 'URETHANE', 'THINNER', 'WD 40', 'WD-40', 'WATER REMOVER', 'ANTI KARAT', 'OXYGEN', 'ACETYLENE']):
        if 'FREON' in d:
            sub = 'Gas Freon Pendingin (Refrigerant)'
            uom = 'Tabung'
        elif any(x in d for x in ['OXYGEN', 'ACETYLENE', 'GAS ']):
            sub = 'Gas Industri & Pengelasan (O2/Acetylene)'
            uom = 'Tabung'
        elif 'COOLANT' in d:
            sub = 'Radiator Water Coolant'
            uom = 'Liter'
        elif 'THINNER' in d:
            sub = 'Thinner Cat'
            uom = 'Liter' if 'LITER' in d else 'Kaleng'
        elif 'DISPERSANT' in d:
            sub = 'Chemical Oil Dispersant (OD)'
            uom = 'Liter' if 'LITER' in d else 'Pail'
        elif any(x in d for x in ['CARBON CLEANER', 'METAL CLEANER', 'DEGREASER', 'CONTACT CLEANER', 'WD']):
            sub = 'Chemical Pembersih & Anti Karat'
            uom = 'Can/Liter'
        else:
            sub = 'Bahan Kimia Teknis & Pembersih'
            uom = 'Liter/Can'
        return (
            'Kimia & Pembersih Teknis',
            sub,
            uom,
            'Barang Fisik',
            'Stok Aktif Siap Pakai' if qty > 0 else 'Stok Kosong'
        )

    # 6. Cat, Lem & Perekat
    if prefix in ['CAT1', 'CAT', 'LEM1', 'LEM', 'PERN', 'PER', 'PHLX', 'PHL', 'COMP', 'COM'] or any(x in d for x in ['CAT (PAINTING)', 'CAT ', 'HEMPEL', 'INTERNATIONAL CAT', 'JOTUN', 'LAKBAN', 'SEALANT', 'BELZONA', 'DEVCON', 'LOCTITE', 'ISOLASI']):
        if '5 LITER' in d or '5LTR' in d or 'PAIL' in d:
            uom = 'Pail (5L)'
        elif any(x in d for x in ['20 LITER', '20LTR', '25 LITER']):
            uom = 'Pail (20L)'
        elif any(x in d for x in ['TAPE', 'LAKBAN', 'ISOLASI']):
            uom = 'Roll'
        elif any(x in d for x in ['SEALANT', 'SILICON', 'LEM BAUT', 'LOCTITE', 'GLUE']):
            uom = 'Tube'
        elif any(x in d for x in ['CAT', 'THINNER', 'PYLOX']):
            uom = 'Kaleng'
        else:
            uom = 'Pcs'
            
        if any(x in d for x in ['CAT ', 'CAT1', 'HEMPADUR', 'INTERLAC', 'INTERTUF', 'INTERSEAL', 'JOTAMASTIC', 'PYLOX']):
            sub = 'Cat Marine & Coating'
        elif any(x in d for x in ['LAKBAN', 'ISOLASI', 'TAPE']):
            sub = 'Lakban & Pita Isolasi'
        elif any(x in d for x in ['SEALANT', 'LEM', 'BELZONA', 'DEVCON', 'LOCTITE', 'THREEBOND']):
            sub = 'Lem, Sealant & Epoksi Logam'
        else:
            sub = 'Cat, Perekat & Finishing'
        return (
            'Cat, Lem & Perekat',
            sub,
            uom,
            'Barang Fisik',
            'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong'
        )

    # 7. Permesinan & Mesin Kapal
    if prefix in ['PIST', 'PIS', 'CYLI', 'CYL', 'LNER', 'LNE', 'VALV', 'VAL', 'TAPP', 'TAP', 'CAMS', 'CMS', 'CRSH', 'CRS', 'COTG', 'COG', 'TUBO', 'TUB', 'PULL', 'PUL', 'MCHN', 'MCH', 'GENS', 'GEN', 'AIRC', 'AIR', 'RDTR', 'RDT', 'WTCR', 'WTR', 'WTCT', 'WTC', 'INJE', 'INJ', 'NZZL', 'NZZ', 'THST', 'THS', 'MANF', 'MAN', 'SLVE', 'SLV', 'RPRK', 'RPR', 'TIER', 'TIE', 'REM1', 'REM'] or any(k in d for k in ['PISTON', 'CYLINDER', 'LINER', 'VALVE', 'CAMSHAFT', 'CRANKSHAFT', 'CONNECTING ROD', 'TAPPET', 'ROCKER ARM', 'TURBOCHARGER', 'ALTERNATOR', 'STARTER', 'DINAMO', 'RADIATOR', 'WATER COOLER', 'WATER JACKET', 'INJECTOR', 'NOZZLE', 'THERMOSTAT', 'MANIFOLD', 'SLEEVE', 'REPAIR KIT', 'TIE ROD', 'REM (BRAKE)', 'BRAKE']):
        if any(x in d for x in ['REM (BRAKE)', 'BRAKE', 'BOOSTER REM', 'KAMPAS REM', 'BRAKE SHOE']):
            sub = 'Sistem Pengereman & Brake Pad'
            uom = 'Set' if 'SET' in d or 'KIT' in d else 'Pcs'
        elif any(x in d for x in ['TIE ROD', 'STEERING', 'KEMUDI', 'RUDDER']):
            sub = 'Sistem Kemudi & Steering (Tie Rod)'
            uom = 'Pcs'
        elif any(x in d for x in ['VALVE', 'KRAN', 'KLEP']):
            sub = 'Katup & Valve Mesin (Intake/Exhaust)'
            uom = 'Pcs'
        elif any(x in d for x in ['INJECTOR', 'NOZZLE', 'FEED PUMP', 'INJECTION PUMP', 'PLUNGER']):
            sub = 'Sistem Bahan Bakar Mesin (Fuel Injection)'
            uom = 'Pcs'
        elif any(x in d for x in ['PISTON', 'LINER', 'CYLINDER', 'CRANKSHAFT', 'CAMSHAFT', 'CONNECTING ROD', 'TAPPET', 'SLEEVE']):
            sub = 'Komponen Internal Mesin (Engine Internal)'
            uom = 'Pcs' if 'KIT' not in d else 'Set'
        elif any(x in d for x in ['TURBOCHARGER', 'CARTRIDGE WHEEL']):
            sub = 'Turbocharger & Komponen'
            uom = 'Unit' if 'KIT' not in d else 'Set'
        elif any(x in d for x in ['RADIATOR', 'WATER COOLER', 'AIR COOLER', 'HEAT EXCHANGER', 'THERMOSTAT', 'MANIFOLD']):
            sub = 'Sistem Pendingin & Manifold Mesin'
            uom = 'Unit' if 'ASSY' in d or 'CMP' in d else 'Pcs'
        elif any(x in d for x in ['REPAIR KIT']):
            sub = 'Repair Kit Komponen Mesin'
            uom = 'Set'
        elif any(x in d for x in ['ALTERNATOR', 'DINAMO STARTER', 'MOTOR STARTER']):
            sub = 'Sistem Starter & Dinamo Mesin'
            uom = 'Unit' if 'ASSY' in d else 'Pcs'
        elif any(x in d for x in ['MESIN', 'GENSET', 'ENGINE']):
            sub = 'Mesin Induk / Genset Kapal (Assembly)'
            uom = 'Unit'
        else:
            sub = 'Sparepart Mesin & Auxiliary'
            uom = 'Pcs'
            
        action = 'Stok Aktif Kamar Mesin' if qty > 0 else ('Investigasi Selisih Fisik (Minus)' if qty < 0 else 'Stok Kosong')
        return ('Permesinan & Mesin Kapal', sub, uom, 'Barang Fisik', action)

    # 8. Transmisi, Kopling, Bearing & Metal
    if prefix in ['BEAR', 'BEA', 'MTAL', 'MTA', 'BUSH', 'BUH', 'THRU', 'THR', 'KPLG', 'KPL', 'CLUT', 'CLU', 'GEAR', 'GEA', 'TRAN', 'TRA', 'VBLT', 'VBL', 'TIBE', 'TIB', 'SHAF', 'SHA', 'UNVJ', 'UNV', 'CROS', 'CRO', 'SLCK', 'SLC'] or any(k in d for k in ['BEARING', 'BUSHING', 'METAL DUDUK', 'METAL JALAN', 'THRUST METAL', 'KOPLING', 'CLUTCH', 'GEARBOX', 'TRANSMISI', 'SHAFT', 'AS PROPELLER', 'V-BELT', 'TIMING BELT', 'UNIVERSAL JOINT', 'SLACK ADJUSTER']):
        if any(x in d for x in ['BEARING', 'LAHAR']):
            sub = 'Bantalan Putar (Bearing)'
            uom = 'Pcs'
        elif any(x in d for x in ['METAL DUDUK', 'METAL JALAN', 'METAL BULAN', 'THRUST METAL', 'BUSHING']):
            sub = 'Metal Mesin & Bushing (Sleeve)'
            uom = 'Set' if 'SET' in d else 'Pcs'
        elif any(x in d for x in ['KOPLING', 'CLUTCH', 'DISC CLUTCH', 'COUPLING']):
            sub = 'Kopling & Kampas Kopling (Clutch/Coupling)'
            uom = 'Set' if 'KIT' in d or 'ASSY' in d else 'Pcs'
        elif any(x in d for x in ['GEARBOX', 'TRANSMISI', 'GEAR']):
            sub = 'Gearbox & Roda Gigi (Gears)'
            uom = 'Unit' if 'GEARBOX' in d else 'Pcs'
        elif any(x in d for x in ['SHAFT', 'AS RODA', 'AS IDLER', 'AS POMPA', 'AS PROPELLER']):
            sub = 'Poros & Shaft Penggerak'
            uom = 'Batang/Pcs'
        elif any(x in d for x in ['V-BELT', 'TIMING BELT', 'BELT']):
            sub = 'Tali Kipas (V-Belt & Timing Belt)'
            uom = 'Pcs'
        else:
            sub = 'Komponen Transmisi & Penggerak'
            uom = 'Pcs'
        return ('Transmisi, Bearing & Penggerak', sub, uom, 'Barang Fisik', 'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong')

    # 9. Gasket, Packing, Seal & O-Ring
    if prefix in ['GSKT', 'GSK', 'PACK', 'PAC', 'SEAL', 'SAL', 'ORNG', 'ORN', 'SEAG', 'SEG', 'KRET', 'KRE', 'RING', 'RIN', 'WASE', 'WAE'] or any(k in d for k in ['GASKET', 'PACKING', 'SEAL', 'ORING', 'O-RING', 'SEALING', 'KLINGRIT', 'RAMES', 'TBA']):
        if any(x in d for x in ['FULL SET', 'OVERHAUL GASKET', 'PACKING SET', 'PACK SET']):
            sub = 'Gasket Kit & Full Set Overhaul'
            uom = 'Set'
        elif any(x in d for x in ['MECHANICAL SEAL', 'SEAL OIL', 'SEAL CRANKSHAFT', 'SEAL VALVE']):
            sub = 'Mechanical Seal & Oil Seal'
            uom = 'Pcs'
        elif any(x in d for x in ['ORING', 'O-RING', 'SEALING RING']):
            sub = 'O-Ring & Sealing Ring'
            uom = 'Pcs'
        elif any(x in d for x in ['KLINGRIT', 'RAMES', 'TBA', 'TOMBO']):
            sub = 'Packing Lembaran / Karet Gasket'
            uom = 'Lembar/Roll'
        elif 'TAPE' in d:
            sub = 'Seal Tape Perpipaan'
            uom = 'Roll'
        else:
            sub = 'Gasket, Packing & Ring Seal'
            uom = 'Pcs'
        return ('Gasket, Packing & Seals', sub, uom, 'Barang Fisik', 'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong')

    # 10. Filter & Separator
    if prefix in ['FLTR', 'FLT', 'STRN', 'STR', 'ELEM', 'ELM'] or any(k in d for k in ['FILTER', 'STRAINER', 'SEPARATOR', 'RACOR']):
        if any(x in d for x in ['LO', 'OIL FILTER', 'LUBE OIL']):
            sub = 'Filter Oli Mesin (Lube Oil Filter)'
        elif any(x in d for x in ['FO', 'FUEL FILTER', 'SOLAR', 'RACOR']):
            sub = 'Filter Bahan Bakar (Fuel Filter)'
        elif any(x in d for x in ['AIR FILTER', 'UDARA', 'AIR CLEANER']):
            sub = 'Filter Udara Mesin (Air Filter)'
        elif any(x in d for x in ['WATER SEPARATOR', 'SEPARATOR']):
            sub = 'Fuel Water Separator'
        else:
            sub = 'Filter & Saringan Mesin'
        return ('Filter & Separator', sub, 'Pcs', 'Barang Fisik', 'Fast Moving Sparepart' if qty > 0 else 'Stok Kosong')

    # 11. Pompa, Kompresor & HVAC
    if prefix in ['PUMP', 'PUM', 'PMM', 'VPAS', 'VPA', 'ACA', 'ACAC', 'IMPL', 'IMP', 'VCCL', 'VCC', 'KIBL', 'KIB', 'KIEX', 'KIE'] or any(k in d for k in ['POMPA', 'PUMP', 'KOMPRESOR', 'COMPRESSOR', 'IMPELLER', 'AIR CONDITIONER', 'AC ', 'BLOWER', 'EXHAUST FAN']):
        if any(x in d for x in ['AC ', 'AIR CONDITIONER', 'EVAPORATOR', 'CONDENSOR']):
            sub = 'Air Conditioner (AC) & Komponen'
            uom = 'Unit' if any(x in d for x in ['MESIN AC', 'KOMPRESSOR', 'COMPRESSOR']) else 'Pcs'
        elif any(x in d for x in ['BLOWER', 'EXHAUST FAN', 'KIPAS (BLOWER)']):
            sub = 'Blower & Exhaust Fan Ventilasi'
            uom = 'Unit'
        elif any(x in d for x in ['IMPELLER', 'KARET IMPELLER']):
            sub = 'Impeller Pompa Pendingin Kapal'
            uom = 'Pcs'
        elif any(x in d for x in ['POMPA TRANSFER', 'ALKON', 'FRESH WATER PUMP', 'SEA WATER PUMP', 'OIL PUMP']):
            sub = 'Pompa Kapal & Transfer BBM'
            uom = 'Unit' if 'ASSY' in d or 'POMPA' in d else 'Pcs'
        else:
            sub = 'Pompa Mesin & Kompresor Udara'
            uom = 'Unit' if 'ASSY' in d else 'Pcs'
        return ('Pompa, Kompresor & HVAC', sub, uom, 'Barang Fisik', 'Stok Aktif Siap Pakai' if qty > 0 else 'Stok Kosong')

    # 12. Sistem Perpipaan, Valve & Selang
    if prefix in ['PIPA', 'PIP', 'SEHO', 'SEH', 'SEKO', 'SEK', 'FLAN', 'FLA', 'NPEL', 'NPE', 'ELBO', 'ELB', 'TEE1', 'TEE', 'SOCK', 'SOC', 'RDCR', 'RDC', 'CAML', 'CAM', 'COUP', 'COP', 'KRAN', 'KRA', 'STKR', 'SK1', 'DOP1', 'DOP', 'TUKL', 'TUK', 'PLUG', 'PLU', 'KLEM', 'KLE'] or any(k in d for k in ['PIPA', 'PIPE', 'HOSE', 'SELANG', 'FLANGE', 'NEPEL', 'ELBOW', 'CAM LOCK', 'QUICK COUPLER', 'STOP KRAN', 'KLEM PIPA', 'CLAMP']):
        if any(x in d for x in ['SELANG', 'HOSE']):
            sub = 'Selang Bunker, Hidrolik & Industri'
            uom = 'Roll' if 'ROLL' in d else 'Meter'
        elif any(x in d for x in ['PIPA', 'PIPE']):
            sub = 'Pipa Seamless, SGP & Galvanis'
            uom = 'Batang'
        elif 'FLANGE' in d:
            sub = 'Flange Sambungan Pipa (JIS/ANSI)'
            uom = 'Pcs'
        elif any(x in d for x in ['CAM LOCK', 'COUPLER', 'QUICK COUPLING']):
            sub = 'Camlock & Quick Coupler Bunker'
            uom = 'Pcs'
        elif any(x in d for x in ['KRAN', 'STOP KRAN', 'TUSEN KLEP']):
            sub = 'Keran Air & Katup Jalur Pipa'
            uom = 'Pcs'
        elif any(x in d for x in ['KLEM', 'CLAMP']):
            sub = 'Klem Pipa & Klem Selang'
            uom = 'Pcs'
        elif any(x in d for x in ['ELBOW', 'TEE', 'REDUCER', 'SOCK', 'DOP', 'PLUG']):
            sub = 'Fitting Pipa (Elbow, Tee, Reducer, Sock)'
            uom = 'Pcs'
        elif 'NEPEL' in d:
            sub = 'Nepel & Drat Pipa'
            uom = 'Pcs'
        else:
            sub = 'Aksesoris Perpipaan & Selang'
            uom = 'Pcs'
        return ('Perpipaan, Selang & Sambungan', sub, uom, 'Barang Fisik', 'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong')

    # 13. Safety, Damkar & SOLAS
    if prefix in ['SFTY', 'SFT', 'FIRE', 'FIR', 'SCBA', 'SCB', 'EEBD', 'EEB', 'SOS1', 'SOS', 'ALRM', 'ALR', 'WARN', 'WAN'] or any(k in d for k in ['APAR', 'LIFE BUOY', 'LIFE JACKET', 'LIFE RAFT', 'SCBA', 'EEBD', 'HELM SAFETY', 'SAFETY CONE', 'FIREMAN']):
        if any(x in d for x in ['APAR', 'FOAM', 'POWDER', 'CO2']):
            sub = 'Alat Pemadam Api Ringan (APAR & Damkar)'
            uom = 'Tabung'
        elif any(x in d for x in ['LIFE RAFT', 'LIFE BUOY', 'LIFE JACKET', 'PELAMPUNG', 'WORK VEST']):
            sub = 'Peralatan Keselamatan Jiwa Laut (SOLAS)'
            uom = 'Unit/Pcs'
        elif any(x in d for x in ['SCBA', 'EEBD', 'BREATHING']):
            sub = 'Peralatan Pernapasan Darurat (SCBA/EEBD)'
            uom = 'Unit'
        elif any(x in d for x in ['ALARM', 'DETECTOR', 'SMOKE', 'GAS DETECTOR']):
            sub = 'Detektor Gas & Alarm Kebakaran'
            uom = 'Unit'
        elif any(x in d for x in ['HELM', 'KACAMATA', 'EAR MUFF', 'RESPIRATOR']):
            sub = 'Alat Pelindung Diri (APD Lapangan)'
            uom = 'Pcs'
        else:
            sub = 'Perlengkapan Keselamatan & Rambu'
            uom = 'Pcs'
        return ('Keselamatan Kerja & SOLAS (Safety)', sub, uom, 'Barang Fisik', 'Safety Mandatori Kapal' if qty > 0 else 'Stok Kosong')

    # 14. Deck Machinery, Tali & Rigging
    if prefix in ['TALI', 'TAL', 'BELW', 'BEL', 'KWAT', 'KWA', 'RNTI', 'RNT', 'SGEL', 'SGE', 'KSSH', 'KSS', 'KUKU', 'KUK', 'JANG', 'JAN', 'BNDR', 'BND', 'TPAL', 'TPA', 'PAS', 'PAST'] or any(k in d for k in ['TALI PP', 'TALI MANILA', 'SLING', 'JANGKAR', 'RANTAI JANGKAR', 'SEGEL JANGKAR', 'KENTER SEGEL', 'KUKU MACAN', 'OIL BOOM', 'ABSORBENT PAD']):
        if 'OIL BOOM' in d or 'ABSORBENT' in d:
            sub = 'Alat Penanggulangan Tumpahan Minyak (Tier-1)'
            uom = 'Meter' if 'BOOM' in d else 'Lembar'
        elif any(x in d for x in ['TALI PP', 'TALI MANILA', 'TALI TAMBANG', 'TALI NYLON']):
            sub = 'Tali Tambat & Tali Tunda (Mooring/Towing)'
            uom = 'Roll' if 'METER' not in d else 'Meter'
        elif any(x in d for x in ['JANGKAR', 'RANTAI JANGKAR', 'KENTER SEGEL', 'SEGEL JANGKAR', 'SEGEL OMEGA']):
            sub = 'Perangkat Jangkar & Sambungan Rantai'
            uom = 'Pcs'
        elif any(x in d for x in ['WIRE CLIP', 'KUKU MACAN', 'THIMBLE', 'SLING']):
            sub = 'Rigging Hardware & Kawat Seling'
            uom = 'Pcs' if 'SLING' not in d else 'Batang/Set'
        elif 'BENDERA' in d:
            sub = 'Bendera Isyarat & Navigasi Kapal'
            uom = 'Lembar'
        elif 'TERPAL' in d:
            sub = 'Terpal Penutup Muatan & Dek'
            uom = 'Lembar'
        elif 'PASTA' in d:
            sub = 'Pasta Ukur Minyak / Air (Sounding Paste)'
            uom = 'Tube'
        else:
            sub = 'Perlengkapan Dek Kapal'
            uom = 'Pcs'
        return ('Perlengkapan Dek & Rigging', sub, uom, 'Barang Fisik', 'Stok Aktif Dek' if qty > 0 else 'Stok Kosong')

    # 15. Navigasi & Komunikasi Kapal
    if prefix in ['RDAR', 'RDA', 'AISS', 'AIS', 'GPS1', 'GPS', 'RDIO', 'RDI', 'KMPS', 'KMP', 'ATNA', 'ATN', 'ATSY', 'ATS', 'CVS1', 'CVS', 'SIHR', 'SIH'] or any(k in d for k in ['RADAR', 'AIS ', 'GPS ', 'RADIO VHF', 'RADIO SSB', 'ECHOSOUNDER', 'KOMPAS', 'NAVTEX', 'SIRINE', 'HORN']):
        if any(x in d for x in ['RADAR', 'MAGNETRON']):
            sub = 'Radar Kapal & Komponen'
        elif any(x in d for x in ['AIS', 'GPS', 'NAVTEX']):
            sub = 'Alat Navigasi Elektronik (AIS/GPS/Navtex)'
        elif any(x in d for x in ['RADIO', 'VHF', 'SSB', 'HT ']):
            sub = 'Radio Komunikasi Kapal (VHF/SSB/HT)'
        elif any(x in d for x in ['KOMPAS', 'COMPASS']):
            sub = 'Kompas Magnetik & Gyrocompass'
        elif any(x in d for x in ['SIRINE', 'HORN', 'KLAKSON']):
            sub = 'Sinyal Suara & Klakson Kapal (Air Horn)'
        else:
            sub = 'Perangkat Navigasi & Komunikasi'
        return ('Navigasi & Komunikasi Kapal', sub, 'Unit', 'Barang Fisik', 'Instrumen Navigasi Aktif' if qty > 0 else 'Stok Kosong')

    # 16. Kelistrikan, Kabel & Penerangan
    if prefix in ['LAMP', 'LAM', 'KBEL', 'KBE', 'SKKA', 'SKK', 'TMNL', 'TMN', 'MCB1', 'MCB', 'MCBB', 'MBB', 'COTR', 'COT', 'RLAY', 'RLA', 'FUSE', 'FUS', 'SWIT', 'SWI', 'SKLR', 'SKL', 'STKO', 'STK', 'STEK', 'STE', 'BTRI', 'BTR', 'ACCU', 'ACC', 'TRFO', 'TRF', 'AVR1', 'AVR', 'AKUR', 'AKU', 'THMT', 'THM', 'PRES', 'PRE', 'RPM1', 'RPM', 'HZMT', 'HZM', 'SDNG', 'SDN', 'SNSR', 'SNS', 'SEND', 'SEN', 'POIV', 'POI', 'POSP', 'POS', 'PANS', 'PAN', 'DIOD', 'DIO', 'TIME', 'TIM', 'SOCT', 'SOT', 'CONR', 'CON', 'SNTR', 'SNT', 'TOPU', 'TOP'] or any(k in d for k in ['LAMPU', 'KABEL', 'SKUN', 'MCB', 'CONTACTOR', 'RELAY', 'FUSE', 'SWITCH', 'BATERAI', 'ACCU', 'AVOMETER', 'PRESSURE GAUGE', 'SOUNDING', 'DIODA', 'SOCKET LISTRIK', 'CONNECTOR', 'TIMER', 'SENTER', 'PUSH BUTTON']):
        if any(x in d for x in ['LAMPU', 'LAMP', 'BULB', 'LIGHT', 'BOHLAM']):
            sub = 'Lampu Navigasi & Penerangan Dek'
            uom = 'Pcs'
        elif any(x in d for x in ['KABEL', 'CABLE']):
            sub = 'Kabel Listrik Marine & Instalasi'
            uom = 'Meter' if 'ROL' not in d else 'Roll'
        elif any(x in d for x in ['ACCU', 'BATERAI', 'BATTERY']):
            sub = 'Aki / Baterai Cadangan Kapal'
            uom = 'Unit'
        elif any(x in d for x in ['PRESSURE GAUGE', 'THERMOMETER', 'AVOMETER', 'TACHOMETER', 'SOUNDING', 'ALAT UKUR', 'SENSOR']):
            sub = 'Sensor, Meteran & Alat Ukur Listrik'
            uom = 'Unit/Pcs'
        elif any(x in d for x in ['SENTER']):
            sub = 'Senter & Emergency Light'
            uom = 'Unit'
        else:
            sub = 'Panel Listrik, Relay & Saklar (Switchgear)'
            uom = 'Pcs'
        return ('Kelistrikan & Instrumentasi', sub, uom, 'Barang Fisik', 'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong')

    # 17. Fasteners & Hardware
    if prefix in ['BBMN', 'B/N', 'B/O', 'MUR', 'SKRP', 'SKR', 'PAKU', 'PAK', 'FISH', 'FIS', 'WASR', 'WAS', 'PIN1', 'PIN', 'DOWE', 'DOW', 'RIVE', 'RIV', 'SPRG', 'SPG', 'COVE', 'COV', 'GANG', 'GAN'] or any(k in d for k in ['BAUT', 'MUR', 'BOLT', 'NUT', 'STUD BOLT', 'U-BOLT', 'SEKRUP', 'SKRUP', 'WASHER', 'RING PLAT', 'SPRING', 'PEGAS', 'COVER', 'CAP', 'HANDLE', 'GAGANG']):
        if any(x in d for x in ['STUD BOLT', 'U-BOLT']):
            sub = 'Stud Bolt & U-Bolt'
        elif any(x in d for x in ['B/N', 'BAUT', 'BOLT']):
            sub = 'Baut & Mur (Bolt & Nut)'
        elif any(x in d for x in ['MUR', 'NUT']):
            sub = 'Mur (Nut)'
        elif any(x in d for x in ['WASHER', 'RING PLAT']):
            sub = 'Ring Plat & Washer'
        elif any(x in d for x in ['SPRING', 'PEGAS']):
            sub = 'Pegas & Springs'
        elif any(x in d for x in ['COVER', 'CAP', 'TUTUP']):
            sub = 'Cover, Tutup & Cap'
        elif any(x in d for x in ['HANDLE', 'GAGANG']):
            sub = 'Handle & Gagang Pintu/Palka'
        elif any(x in d for x in ['SEKRUP', 'SKRUP', 'SCREW']):
            sub = 'Sekrup & Tapping Screw'
        elif any(x in d for x in ['PAKU', 'RIVET']):
            sub = 'Paku & Rivet'
        else:
            sub = 'Fasteners & Hardware Pengikat'
        return ('Fasteners & Hardware', sub, 'Pcs', 'Barang Fisik', 'Stok Aktif Gudang' if qty > 0 else 'Stok Kosong')

    # 18. Material Logam & Bangunan
    if prefix in ['PLAT', 'PLA', 'BESI', 'BES', 'BBGN', 'BBG', 'KACA', 'KAC', 'DOOR', 'DOO', 'ENGS', 'ENG', 'KDGE', 'KDG', 'LIST', 'LIS', 'HOLL', 'HOL', 'KANA', 'KAN', 'SENG', 'SNG', 'GYPS', 'GYP', 'TEKE', 'TEK', 'HPL1', 'HPL', 'PLAE', 'PLE'] or any(k in d for k in ['PLAT MARINE', 'PLAT BESI', 'BESI SIKU', 'H BEAM', 'BESI HOLLOW', 'CANAL', 'SEMEN', 'ASBES', 'KACA', 'PLATE']):
        if 'PLAT MARINE' in d or 'PLAT BESI' in d or 'PLATE' in d:
            sub = 'Plat Marine & Plat Baja Konstruksi'
            uom = 'Lembar'
        elif any(x in d for x in ['BESI SIKU', 'H BEAM', 'HOLLOW', 'CANAL', 'WF']):
            sub = 'Besi Profil (Siku, H-Beam, Hollow)'
            uom = 'Batang'
        elif any(x in d for x in ['SEMEN', 'PASIR', 'BATU', 'ASBES', 'SENG', 'GYPSUM', 'TRIPLEK']):
            sub = 'Bahan Bangunan & Galvalum'
            uom = 'Lembar/Sak'
        elif any(x in d for x in ['PINTU', 'KUSEN', 'ENGSEL', 'GEMBOK', 'KACA']):
            sub = 'Pintu, Kaca & Kunci Aksesoris'
            uom = 'Pcs/Set'
        else:
            sub = 'Material Logam & Bangunan'
            uom = 'Batang/Lembar'
        return ('Material Logam & Konstruksi', sub, uom, 'Barang Fisik', 'Material Workshop' if qty > 0 else 'Stok Kosong')

    # 19. Perkakas & Bengkel (Tools & Workshop)
    if prefix in ['A2TK', 'A2T', 'KEYT', 'KEY', 'OBNG', 'OBN', 'TANG', 'TAN', 'GURI', 'GUR', 'BOR1', 'BOR', 'GERG', 'GER', 'APLS', 'APL', 'LAS1', 'LAS', 'KUAS', 'KUA', 'SKAT', 'SKA', 'TRKR', 'TRK', 'CUTT', 'CUT', 'SPRA', 'SPR', 'SLDR', 'SLD', 'HTAP', 'HTA', 'FLAR', 'FLR', 'GTSC', 'GTS', 'PALU', 'PAL'] or any(k in d for k in ['KUNCI RING', 'KUNCI INGGRIS', 'GURINDA', 'MATA BOR', 'MATA POTONG', 'MESIN BOR', 'MESIN LAS', 'KAWAT LAS', 'KUAS', 'SIKAT KAWAT', 'OBENG', 'TANG', 'PALU ']):
        if any(x in d for x in ['GURINDA', 'MATA POTONG', 'FLAP DISC', 'AMPLAS']):
            sub = 'Mata Gurinda, Amplas & Batu Potong'
            uom = 'Pcs'
        elif any(x in d for x in ['KAWAT LAS', 'MESIN LAS', 'TRAFO LAS', 'STANG LAS']):
            sub = 'Peralatan Las & Kawat Las'
            uom = 'Dos/Kg' if 'KAWAT' in d else 'Unit'
        elif any(x in d for x in ['KUAS', 'BULU ROLL', 'BAK CAT']):
            sub = 'Kuas & Perlengkapan Pengecatan'
            uom = 'Pcs'
        elif any(x in d for x in ['SIKAT', 'CUP BRUSH']):
            sub = 'Sikat Kawat & Cup Brush'
            uom = 'Pcs'
        elif any(x in d for x in ['KUNCI ', 'TANG ', 'OBENG ', 'TREKER', 'PALU ']):
            sub = 'Perkakas Tangan (Hand Tools)'
            uom = 'Set' if 'SET' in d else 'Pcs'
        elif any(x in d for x in ['MESIN BOR', 'MESIN BUBUT', 'MESIN SEKRAP', 'DONGKRAK']):
            sub = 'Mesin Perkakas Bengkel (Power Tools)'
            uom = 'Unit'
        else:
            sub = 'Alat Kerja & Workshop'
            uom = 'Pcs'
        return ('Perkakas, Alat Kerja & Workshop', sub, uom, 'Barang Fisik', 'Stok Aktif Workshop' if qty > 0 else 'Stok Kosong')

    # 20. Seragam & APD Pekerja
    if prefix in ['UNIF', 'UNI', 'SATA', 'SAT', 'MASK', 'MAS'] or any(k in d for k in ['COVERALL', 'WEARPACK', 'SERAGAM', 'SEPATU SAFETY', 'SARUNG TANGAN', 'MASKER']):
        if 'SEPATU SAFETY' in d:
            sub = 'Sepatu Safety Lapangan'
            uom = 'Pasang'
        elif 'SARUNG TANGAN' in d:
            sub = 'Sarung Tangan Kerja (Katun/Las/Karet)'
            uom = 'Pasang'
        elif any(x in d for x in ['COVERALL', 'WEARPACK']):
            sub = 'Baju Coverall / Wearpack Lapangan'
            uom = 'Pcs'
        elif 'MASKER' in d:
            sub = 'Masker Pernapasan & Debu'
            uom = 'Box/Pcs'
        else:
            sub = 'Seragam Kantor & Lapangan'
            uom = 'Stel/Pcs'
        return ('Pakaian Kerja & APD', sub, uom, 'Barang Fisik', 'Stok Aktif Perlengkapan Kru' if qty > 0 else 'Stok Kosong')

    # 21. Perlengkapan Mess, Dapur & Housekeeping
    if prefix in ['ADKC', 'ADK', 'MGKK', 'MGK', 'FOOD', 'FOO', 'MIDR', 'MID', 'HOUK', 'HOU', 'TISU', 'TIS', 'SAMP', 'SAM', 'KAIN', 'KAI', 'KAPL', 'KAP', 'TOIL', 'TOI', 'ATBE', 'ATB', 'FURN', 'FUR', 'DKOR', 'DKO', 'CTNR', 'CTN', 'JRGN', 'JRG', 'MCWS', 'MCW', 'KLKS', 'KLK', 'BAN1', 'BAN', 'SPDM', 'EMBE', 'EMB', 'HAKA', 'HAK'] or any(k in d for k in ['EMBER', 'KARPET', 'HAMBAL', 'DAPUR', 'PIRING', 'BERAS']):
        if any(x in d for x in ['BERAS', 'GULA', 'MIE', 'MAKANAN', 'MINYAK GORENG', 'KOPI', 'TEH', 'SUSU', 'VITAMIN']):
            sub = 'Sembako & Konsumsi Kru Mess'
            uom = 'Kg/Dus/Bks'
        elif any(x in d for x in ['PIRING', 'MANGKUK', 'SENDOK', 'PANCI', 'KOMPOR', 'RICE COOKER', 'WAJAN', 'DAPUR']):
            sub = 'Peralatan Masak & Makan Mess'
            uom = 'Pcs/Unit'
        elif any(x in d for x in ['KAIN MAJUN', 'MAJUN', 'ABSORBENT OIL PAD']):
            sub = 'Kain Majun & Absorbent Pad'
            uom = 'Kg' if 'MAJUN' in d else 'Lembar'
        elif any(x in d for x in ['SAPU', 'PEL', 'EMBER', 'SAMPAH', 'TISSUE', 'DETERJEN', 'SABUN', 'KEMOCENG', 'KARPET', 'HAMBAL']):
            sub = 'Housekeeping & Kebersihan Mess'
            uom = 'Pcs/Btl/Pak'
        elif any(x in d for x in ['KASUR', 'BANTAL', 'GULING', 'SPREI', 'SELIMUT']):
            sub = 'Perlengkapan Kamar Tidur Kru'
            uom = 'Pcs'
        elif any(x in d for x in ['BAN ', 'VELG']):
            sub = 'Ban & Roda Kendaraan Operasional'
            uom = 'Pcs'
        else:
            sub = 'Akomodasi & Fasilitas Mess'
            uom = 'Unit/Pcs'
        return ('Perlengkapan Mess, Dapur & Housekeeping', sub, uom, 'Barang Fisik', 'Stok Aktif Mess' if qty > 0 else 'Stok Kosong')

    # 22. Dokumen, ATK & IT Kantor
    if prefix in ['ATK1', 'ATK', 'PAPR', 'PAP', 'BUKU', 'BUK', 'BLFO', 'BLF', 'STAM', 'STA', 'KOMP', 'KOM', 'PRIN', 'PRI', 'IPCM', 'IPC', 'MKRO', 'MKR', 'HUB1', 'HUB', 'ELEK', 'ELE'] or any(k in d for k in ['KOMPUTER', 'LAPTOP', 'PRINTER', 'CCTV', 'CAMERA', 'KERTAS HVS', 'LOG BOOK', 'BLANGKO']):
        if any(x in d for x in ['KOMPUTER', 'LAPTOP', 'PRINTER', 'CCTV', 'CAMERA', 'ROUTER', 'SWITCH', 'MONITOR', 'HARDISK']):
            sub = 'Perangkat IT, Komputer & CCTV'
            uom = 'Unit'
        elif any(x in d for x in ['KERTAS', 'HVS', 'FOTO', 'BUFFALO']):
            sub = 'Kertas Fotocopy & Cetak (HVS)'
            uom = 'Rim'
        elif any(x in d for x in ['LOG BOOK', 'JURNAL DECK', 'JURNAL MESIN', 'BUKU ']):
            sub = 'Buku Jurnal & Log Book Resmi Kapal'
            uom = 'Buku'
        elif any(x in d for x in ['BLANGKO', 'FORMULIR', 'BUNKER DELIVERY']):
            sub = 'Blangko & Dokumen BDR Kapal'
            uom = 'Blok/Buku'
        elif any(x in d for x in ['TELEVISI', 'TV ', 'SETRIKA', 'DISPENSER']):
            sub = 'Elektronik & Rumah Tangga Kantor'
            uom = 'Unit'
        else:
            sub = 'Alat Tulis Kantor (ATK)'
            uom = 'Pcs'
        return ('Administrasi, Dokumen & IT Kantor', sub, uom, 'Barang Fisik', 'Stok Operasional Kantor' if qty > 0 else 'Stok Kosong')

    # 23. Medis
    if prefix in ['HLTH', 'HLT'] or any(k in d for k in ['KESEHATAN', 'OBAT', 'MEDIK', 'P3K', 'PERBAN', 'ALKOHOL']):
        return ('Kesehatan & P3K Kapal', 'Obat-obatan & Perlengkapan Medis P3K', 'Box/Botol/Pcs', 'Barang Fisik', 'Stok P3K Kapal' if qty > 0 else 'Stok Kosong')

    # 24. Fallback: Parse prefix
    if ' - ' in d:
        extracted = d.split(' - ')[0].strip().title()
        return ('Material & Perlengkapan Operasional', extracted, 'Pcs', 'Barang Fisik', 'Stok Aktif' if qty > 0 else 'Stok Kosong')

    return ('Material & Perlengkapan Operasional', 'Barang Operasional Umum', 'Pcs', 'Barang Fisik', 'Stok Aktif' if qty > 0 else 'Stok Kosong')

print('Refined classifier loaded.')

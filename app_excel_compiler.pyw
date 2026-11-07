#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Aplikasi Kompilasi Excel Multi-Perusahaan
PT Cindara Pratama Lines - CPG Group
Menggabungkan banyak file Excel per perusahaan menjadi 1 Workbook:
- Sheet "Master Gabungan" (semua baris ditumpuk + kolom Perusahaan)
- Sheet terpisah per Perusahaan di workbook yang sama
"""

import os
import sys
import re
import threading
import subprocess
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

class ExcelCompilerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("CPG Excel Compiler - Penggabung File Multi-Perusahaan")
        self.root.geometry("780x620")
        self.root.minsize(700, 520)

        # File list
        self.files = []
        self.output_path = ""

        # Setup modern style
        self.setup_styles()
        self.build_ui()

    def setup_styles(self):
        style = ttk.Style()
        try:
            style.theme_use("clam")
        except:
            pass

        # Configure colors
        self.root.configure(bg="#F1F5F9")
        style.configure("TFrame", background="#F1F5F9")
        style.configure("Card.TFrame", background="#FFFFFF", relief="flat")
        style.configure("TLabel", background="#F1F5F9", font=("Segoe UI", 10))
        style.configure("Card.TLabel", background="#FFFFFF", font=("Segoe UI", 10))
        style.configure("Header.TLabel", background="#1E293B", foreground="#FFFFFF", font=("Segoe UI", 13, "bold"))
        style.configure("SubHeader.TLabel", background="#1E293B", foreground="#94A3B8", font=("Segoe UI", 9))
        style.configure("TCheckbutton", background="#FFFFFF", font=("Segoe UI", 10))

        # Buttons
        style.configure("Primary.TButton", font=("Segoe UI", 10, "bold"), background="#0284C7", foreground="#FFFFFF")
        style.map("Primary.TButton", background=[("active", "#0369A1"), ("disabled", "#94A3B8")])

        style.configure("Success.TButton", font=("Segoe UI", 11, "bold"), background="#059669", foreground="#FFFFFF")
        style.map("Success.TButton", background=[("active", "#047857"), ("disabled", "#94A3B8")])

        style.configure("Secondary.TButton", font=("Segoe UI", 9), background="#E2E8F0")

    def build_ui(self):
        # 1. Top Banner
        banner = tk.Frame(self.root, bg="#1E293B", height=65)
        banner.pack(fill="x")
        banner.pack_propagate(False)

        title_lbl = tk.Label(banner, text="📊 CPG Excel Compiler - Multi-Perusahaan", 
                             bg="#1E293B", fg="#FFFFFF", font=("Segoe UI", 13, "bold"))
        title_lbl.pack(anchor="w", padx=20, pady=(10, 0))

        subtitle_lbl = tk.Label(banner, text="Kompilasikan file Excel per perusahaan menjadi 1 Workbook terpadu (Master Gabungan & Sheet Perusahaan)", 
                                bg="#1E293B", fg="#94A3B8", font=("Segoe UI", 9))
        subtitle_lbl.pack(anchor="w", padx=20, pady=(0, 10))

        # Main Container
        main_frame = ttk.Frame(self.root, padding=16)
        main_frame.pack(fill="both", expand=True)

        # 2. File Selection Card
        card_files = tk.Frame(main_frame, bg="#FFFFFF", bd=1, relief="solid")
        card_files.configure(highlightbackground="#CBD5E1", highlightcolor="#CBD5E1", highlightthickness=1)
        card_files.pack(fill="both", expand=True, pady=(0, 12))

        header_files = tk.Frame(card_files, bg="#F8FAFC", height=40)
        header_files.pack(fill="x")
        tk.Label(header_files, text="Daftar File Excel yang Akan Digabungkan", 
                 bg="#F8FAFC", fg="#0F172A", font=("Segoe UI", 10, "bold")).pack(side="left", padx=12, pady=8)

        # Buttons on right of header
        btn_add = tk.Button(header_files, text="➕ Pilih File Excel...", bg="#0284C7", fg="#FFFFFF",
                            activebackground="#0369A1", activeforeground="#FFFFFF",
                            relief="flat", font=("Segoe UI", 9, "bold"), padx=10, pady=2,
                            command=self.browse_files, cursor="hand2")
        btn_add.pack(side="right", padx=(4, 12), pady=6)

        btn_clear = tk.Button(header_files, text="🗑️ Bersihkan", bg="#F1F5F9", fg="#64748B",
                              relief="flat", font=("Segoe UI", 9), padx=8, pady=2,
                              command=self.clear_files, cursor="hand2")
        btn_clear.pack(side="right", padx=4, pady=6)

        # Listbox for files
        list_frame = tk.Frame(card_files, bg="#FFFFFF")
        list_frame.pack(fill="both", expand=True, padx=12, pady=10)

        self.listbox = tk.Listbox(list_frame, font=("Segoe UI", 9), selectmode="extended",
                                  bd=1, relief="solid", highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=self.listbox.yview)
        self.listbox.configure(yscrollcommand=scrollbar.set)

        self.listbox.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        # 3. Options Card
        card_opts = tk.Frame(main_frame, bg="#FFFFFF", bd=1, relief="solid")
        card_opts.configure(highlightbackground="#CBD5E1", highlightcolor="#CBD5E1", highlightthickness=1)
        card_opts.pack(fill="x", pady=(0, 12))

        tk.Label(card_opts, text="Pengaturan Kompilasi", bg="#FFFFFF", fg="#0F172A", 
                 font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(10, 6))

        opts_inner = tk.Frame(card_opts, bg="#FFFFFF")
        opts_inner.pack(fill="x", padx=12, pady=(0, 10))

        self.var_master = tk.BooleanVar(value=True)
        cb_master = tk.Checkbutton(opts_inner, text="Buat Sheet 'Master Gabungan' (semua baris ditumpuk + kolom penanda Perusahaan)",
                                   variable=self.var_master, bg="#FFFFFF", font=("Segoe UI", 9), activebackground="#FFFFFF")
        cb_master.pack(anchor="w", pady=2)

        self.var_separate = tk.BooleanVar(value=True)
        cb_sep = tk.Checkbutton(opts_inner, text="Pertahankan Sheet tersendiri per Perusahaan di dalam Workbook yang sama",
                                variable=self.var_separate, bg="#FFFFFF", font=("Segoe UI", 9), activebackground="#FFFFFF")
        cb_sep.pack(anchor="w", pady=2)

        # 4. Action Area
        action_frame = tk.Frame(main_frame, bg="#F1F5F9")
        action_frame.pack(fill="x", pady=(0, 8))

        self.btn_compile = tk.Button(action_frame, text="🚀 Kompilasikan File Excel Sekarang",
                                     bg="#059669", fg="#FFFFFF", activebackground="#047857", activeforeground="#FFFFFF",
                                     relief="flat", font=("Segoe UI", 11, "bold"), pady=8, cursor="hand2",
                                     command=self.start_compilation)
        self.btn_compile.pack(fill="x")

        # Progress bar
        self.progress = ttk.Progressbar(main_frame, mode="indeterminate")

        # Status / Log Box
        self.lbl_status = tk.Label(main_frame, text="Siap. Silakan pilih 2 atau lebih file Excel di atas.",
                                   bg="#F1F5F9", fg="#475569", font=("Segoe UI", 9))
        self.lbl_status.pack(anchor="w", pady=(4, 0))

        # Bottom result buttons (hidden initially)
        self.result_frame = tk.Frame(main_frame, bg="#F1F5F9")
        self.btn_open_file = tk.Button(self.result_frame, text="📄 Buka File Excel Hasil", bg="#0284C7", fg="#FFFFFF",
                                       relief="flat", font=("Segoe UI", 9, "bold"), padx=12, pady=4, cursor="hand2",
                                       command=self.open_result_file)
        self.btn_open_folder = tk.Button(self.result_frame, text="📁 Buka Folder Hasil", bg="#64748B", fg="#FFFFFF",
                                         relief="flat", font=("Segoe UI", 9), padx=12, pady=4, cursor="hand2",
                                         command=self.open_result_folder)
        self.btn_open_file.pack(side="left", padx=(0, 8))
        self.btn_open_folder.pack(side="left")

    def browse_files(self):
        selected = filedialog.askopenfilenames(
            title="Pilih File Excel Perusahaan",
            filetypes=[("Excel Files", "*.xlsx *.xls *.xlsm"), ("Semua File", "*.*")]
        )
        if selected:
            for s in selected:
                if s not in self.files:
                    self.files.append(s)
            self.refresh_listbox()

    def clear_files(self):
        self.files = []
        self.refresh_listbox()
        self.result_frame.pack_forget()
        self.lbl_status.config(text="Daftar file dibersihkan. Siap memilih file baru.", fg="#475569")

    def refresh_listbox(self):
        self.listbox.delete(0, tk.END)
        for i, f in enumerate(self.files):
            size_kb = os.path.getsize(f) / 1024
            size_str = f"{size_kb:.1f} KB" if size_kb < 1024 else f"{(size_kb/1024):.2f} MB"
            name = os.path.basename(f)
            self.listbox.insert(tk.END, f"{i+1}. {name}  ({size_str})")

        count = len(self.files)
        if count == 0:
            self.lbl_status.config(text="Siap. Silakan pilih 2 atau lebih file Excel di atas.", fg="#475569")
        else:
            self.lbl_status.config(text=f"{count} file Excel terpilih.", fg="#0284C7")

    def clean_sheet_name(self, filename, sheetname=""):
        # Format nama sheet agar valid di Excel (maksimal 31 karakter)
        name = os.path.basename(filename)
        name = re.sub(r'[\:\\/\?\*\[\]]', '', name)
        name = re.sub(r'^(Daftar_Barang_|Monitoring_|Data_)', '', name, flags=re.I)
        name = re.sub(r'\.(xlsx|xls|xlsm)$', '', name, flags=re.I)
        name = name.replace('_', ' ').strip()
        if len(name) > 31:
            name = name[:31].strip()
        return name

    def extract_company_label(self, filename):
        name = os.path.basename(filename).replace('_', ' ')
        name = re.sub(r'\.(xlsx|xls|xlsm)$', '', name, flags=re.I)
        # Cari pola PT CINDARA, PT HANA, dsb.
        match = re.search(r'(PT\s+[A-Za-z\s]+|CPL|PPI|HL|GAJ|MIL|SP|SSK|MO)', name, re.I)
        if match:
            return match.group(0).strip().upper()
        return name

    def find_header_row(self, sheet):
        # Cari baris header yang sebenarnya (bisa di baris 1, 2, 3, 4, dst.)
        best_row = 1
        max_filled = 0
        for r_idx in range(1, min(sheet.max_row + 1, 15)):
            row_vals = [sheet.cell(row=r_idx, column=c_idx).value for c_idx in range(1, min(sheet.max_column + 1, 30))]
            filled_text = sum(1 for v in row_vals if v is not None and str(v).strip() != "")
            # Header biasanya memiliki 3 atau lebih kolom teks
            if filled_text > max_filled:
                max_filled = filled_text
                best_row = r_idx
        return best_row

    def start_compilation(self):
        if len(self.files) == 0:
            messagebox.showwarning("Peringatan", "Pilih minimal 1 file Excel terlebih dahulu!")
            return

        if not self.var_master.get() and not self.var_separate.get():
            messagebox.showwarning("Peringatan", "Pilih minimal salah satu opsi kompilasi (Master Gabungan atau Sheet Perusahaan)!")
            return

        # Minta lokasi simpan hasil
        initial_dir = os.path.dirname(self.files[0])
        default_name = "Hasil_Kompilasi_Semua_Perusahaan.xlsx"
        save_dest = filedialog.asksaveasfilename(
            title="Simpan Hasil Kompilasi Excel",
            initialdir=initial_dir,
            initialfile=default_name,
            defaultextension=".xlsx",
            filetypes=[("Excel Workbook", "*.xlsx")]
        )
        if not save_dest:
            return

        self.output_path = save_dest

        # UI Lock
        self.btn_compile.config(state="disabled")
        self.progress.pack(fill="x", pady=(6, 4))
        self.progress.start(10)
        self.result_frame.pack_forget()

        # Run thread
        threading.Thread(target=self.run_compilation_worker, daemon=True).start()

    def run_compilation_worker(self):
        try:
            wb_out = openpyxl.Workbook()
            # Hapus sheet default pertama
            default_sheet = wb_out.active

            master_data = [] # List of tuples/rows
            master_headers = []
            sheet_names_used = set()

            header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
            header_font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
            thin_border = Border(
                left=Side(style='thin', color='E2E8F0'),
                right=Side(style='thin', color='E2E8F0'),
                top=Side(style='thin', color='E2E8F0'),
                bottom=Side(style='thin', color='E2E8F0')
            )

            total_files = len(self.files)

            for idx, file_path in enumerate(self.files):
                fname = os.path.basename(file_path)
                self.update_status(f"[{idx+1}/{total_files}] Membaca {fname}...")
                company_label = self.extract_company_label(file_path)

                wb_src = openpyxl.load_workbook(file_path, data_only=True)
                for src_sheet_name in wb_src.sheetnames:
                    src_sheet = wb_src[src_sheet_name]
                    if src_sheet.max_row is None or src_sheet.max_row < 1:
                        continue

                    header_row_idx = self.find_header_row(src_sheet)

                    # Baca headers
                    curr_headers = []
                    for c_idx in range(1, src_sheet.max_column + 1):
                        val = src_sheet.cell(row=header_row_idx, column=c_idx).value
                        val_str = str(val).strip() if val is not None else f"Kolom_{c_idx}"
                        curr_headers.append(val_str)

                    # Jika master_headers belum ada, inisialisasi dari file pertama
                    if not master_headers:
                        master_headers = ["PERUSAHAAN / SUMBER"] + [h for h in curr_headers if h]

                    # 1. Kumpulkan data untuk Master Gabungan
                    if self.var_master.get():
                        for r_idx in range(header_row_idx + 1, src_sheet.max_row + 1):
                            row_vals = [src_sheet.cell(row=r_idx, column=c_idx).value for c_idx in range(1, len(curr_headers) + 1)]
                            # Abaikan baris kosong
                            if any(v is not None and str(v).strip() != "" for v in row_vals):
                                master_data.append([company_label] + row_vals)

                    # 2. Buat sheet terpisah per perusahaan jika dipilih
                    if self.var_separate.get():
                        base_sheet_title = self.clean_sheet_name(fname, src_sheet_name)
                        sheet_title = base_sheet_title
                        counter = 2
                        while sheet_title.upper() in sheet_names_used:
                            sheet_title = f"{base_sheet_title[:28]}_{counter}"
                            counter += 1

                        sheet_names_used.add(sheet_title.upper())
                        new_ws = wb_out.create_sheet(title=sheet_title)

                        # Salin baris ke sheet baru
                        for r_idx in range(header_row_idx, src_sheet.max_row + 1):
                            new_row_idx = r_idx - header_row_idx + 1
                            for c_idx in range(1, src_sheet.max_column + 1):
                                cell_val = src_sheet.cell(row=r_idx, column=c_idx).value
                                cell_out = new_ws.cell(row=new_row_idx, column=c_idx, value=cell_val)
                                cell_out.border = thin_border

                                # Format header
                                if new_row_idx == 1:
                                    cell_out.fill = header_fill
                                    cell_out.font = header_font
                                    cell_out.alignment = Alignment(horizontal="center", vertical="center")

                        # Auto-fit columns
                        for col in new_ws.columns:
                            col_letter = get_column_letter(col[0].column)
                            max_len = max(len(str(cell.value or '')) for cell in col)
                            new_ws.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 45)

                wb_src.close()

            # 3. Tulis Sheet "Master Gabungan" jika dipilih
            if self.var_master.get() and master_data:
                self.update_status("Menyusun Sheet Master Gabungan...")
                ws_master = wb_out.create_sheet(title="Master Gabungan", index=0)

                # Header Master
                for c_idx, h in enumerate(master_headers, start=1):
                    cell = ws_master.cell(row=1, column=c_idx, value=h)
                    cell.fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid") # Sky blue header
                    cell.font = Font(name="Segoe UI", size=10, bold=True, color="FFFFFF")
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    cell.border = thin_border

                # Isi data
                for r_idx, row_vals in enumerate(master_data, start=2):
                    for c_idx, val in enumerate(row_vals, start=1):
                        cell = ws_master.cell(row=r_idx, column=c_idx, value=val)
                        cell.border = thin_border
                        if c_idx == 1:
                            cell.font = Font(name="Segoe UI", size=9, bold=True, color="0F172A")
                            cell.alignment = Alignment(horizontal="center")

                # Auto-fit columns for master
                for col in ws_master.columns:
                    col_letter = get_column_letter(col[0].column)
                    max_len = max(len(str(cell.value or '')) for cell in col[:100]) # sample first 100 rows for speed
                    ws_master.column_dimensions[col_letter].width = min(max(max_len + 3, 12), 50)

                # Freeze header pane
                ws_master.freeze_panes = "A2"

            # Hapus default empty sheet jika ada sheet lain
            if len(wb_out.sheetnames) > 1 and default_sheet in wb_out.worksheets:
                wb_out.remove(default_sheet)

            # Simpan file output
            self.update_status("Menyimpan file hasil kompilasi...")
            wb_out.save(self.output_path)
            wb_out.close()

            # Selesai
            total_rows_master = len(master_data)
            self.root.after(0, self.on_compilation_success, total_rows_master, len(wb_out.sheetnames))

        except Exception as e:
            self.root.after(0, self.on_compilation_error, str(e))

    def update_status(self, text):
        self.root.after(0, lambda: self.lbl_status.config(text=text, fg="#0284C7"))

    def on_compilation_success(self, total_rows, sheet_count):
        self.progress.stop()
        self.progress.pack_forget()
        self.btn_compile.config(state="normal")
        self.result_frame.pack(fill="x", pady=(6, 0))

        fname = os.path.basename(self.output_path)
        msg = f"✅ Sukses! {len(self.files)} file dikompilasi ke '{fname}' ({sheet_count} Sheet"
        if total_rows > 0:
            msg += f", {total_rows:,} baris Master Gabungan)."
        else:
            msg += ")."

        self.lbl_status.config(text=msg, fg="#059669")
        messagebox.showinfo("Kompilasi Sukses", 
                            f"Kompilasi Excel Berhasil!\n\n"
                            f"• Total File Sumber: {len(self.files)} file\n"
                            f"• Total Sheet: {sheet_count} sheet\n"
                            f"• Total Baris Master: {total_rows:,} baris\n\n"
                            f"Disimpan di:\n{self.output_path}")

    def on_compilation_error(self, err_msg):
        self.progress.stop()
        self.progress.pack_forget()
        self.btn_compile.config(state="normal")
        self.lbl_status.config(text="❌ Gagal saat kompilasi file.", fg="#DC2626")
        messagebox.showerror("Error Kompilasi", f"Terjadi kesalahan saat mengompilasi file:\n\n{err_msg}")

    def open_result_file(self):
        if self.output_path and os.path.exists(self.output_path):
            os.startfile(self.output_path)

    def open_result_folder(self):
        if self.output_path and os.path.exists(self.output_path):
            folder = os.path.dirname(self.output_path)
            os.startfile(folder)


def main():
    root = tk.Tk()
    app = ExcelCompilerApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()

'use client';

import React, { useState } from 'react';
import { X, PlusCircle } from 'lucide-react';
import { ProcurementItem } from '@/types/procurement';

interface NewRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (item: ProcurementItem) => void;
}

export default function NewRecordModal({
  isOpen,
  onClose,
  onSubmit,
}: NewRecordModalProps) {
  const [entity, setEntity] = useState('CPL');
  const [fpb, setFpb] = useState('');
  const [po, setPo] = useState('');
  const [item, setItem] = useState('');
  const [peruntukan, setPeruntukan] = useState('');
  const [picPch, setPicPch] = useState('NOVI');
  const [picTtb, setPicTtb] = useState('DAVILA');
  const [picLap, setPicLap] = useState('AGUS');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newRecord: ProcurementItem = {
      fpb,
      entity,
      po,
      date: new Date().toISOString().slice(0, 10),
      item,
      peruntukan,
      lapse: 0,
      statusBadge: 'PROSES ADM PURCHASING',
      statusTone: 'cyan',
      picPch,
      picTtb,
      picLap,
      picAdm: 'MANDA',
      picAktif: `${picPch} (PCH)`,
      statusPenjelasan: 'Berkas baru diinput, menunggu serah terima ke TTB',
    };

    onSubmit(newRecord);
    // Reset form
    setFpb('');
    setPo('');
    setItem('');
    setPeruntukan('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0c1220] border border-cyan-500/40 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-cyan-400" />
            <span>Input Berkas Pengadaan Baru</span>
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Entitas Anak Perusahaan CPG</label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
            >
              <option value="CPL">CPL - PT Cindara Pratama Lines</option>
              <option value="PPI">PPI - PT Petro Perkasa Indonesia</option>
              <option value="HL">HL - PT Hana Lines</option>
              <option value="GAJ">GAJ - PT Galangan Aliran Jaya (Balikpapan Shipyard)</option>
              <option value="MIL">MIL - PT Mapan Indonesia Lines</option>
              <option value="SP">SP - PT Sinar Pasifik</option>
              <option value="SSK">SSK - PT Sinar Surya Konstruksi</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1">Nomor FPB</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-FPB-26-0000133"
                value={fpb}
                onChange={(e) => setFpb(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">Nomor PO Internal</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-PO-26-00405"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Deskripsi Barang</label>
            <input
              type="text"
              required
              placeholder="Cth: Oli Mesin Meditran SX 15W-40 (Drum)"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Peruntukan Armada / Unit</label>
            <input
              type="text"
              required
              placeholder="Cth: U/ TB. ENTEBE EXPRESS 61"
              value={peruntukan}
              onChange={(e) => setPeruntukan(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-slate-400 mb-1">PIC PCH</label>
              <input
                type="text"
                value={picPch}
                onChange={(e) => setPicPch(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">PIC TTB</label>
              <input
                type="text"
                value={picTtb}
                onChange={(e) => setPicTtb(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 mb-1">PIC Lapangan</label>
              <input
                type="text"
                value={picLap}
                onChange={(e) => setPicLap(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg font-semibold hover:bg-slate-700 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-semibold shadow transition"
            >
              Simpan Berkas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

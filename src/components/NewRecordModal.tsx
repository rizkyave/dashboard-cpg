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
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 cursor-pointer animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-card border border-border rounded-t-2xl sm:rounded-xl w-full max-w-lg p-4 sm:p-5 space-y-4 shadow-xl cursor-default max-h-[92vh] overflow-y-auto pb-10 sm:pb-5"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-primary" />
            <span>Input Berkas Pengadaan Baru</span>
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-muted-foreground font-medium mb-1.5">Entitas Anak Perusahaan CPG</label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm sm:text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">Nomor FPB</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-FPB-26-0000133"
                value={fpb}
                onChange={(e) => setFpb(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm sm:text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">Nomor PO Internal</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-PO-26-00405"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground font-mono text-sm sm:text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground font-medium mb-1.5">Deskripsi Barang</label>
            <input
              type="text"
              required
              placeholder="Cth: Oli Mesin Meditran SX 15W-40 (Drum)"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm sm:text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-muted-foreground font-medium mb-1.5">Peruntukan Armada / Unit</label>
            <input
              type="text"
              required
              placeholder="Cth: TB. CINDARA 01"
              value={peruntukan}
              onChange={(e) => setPeruntukan(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-foreground text-sm sm:text-xs focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>


          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">PIC PCH</label>
              <input
                type="text"
                value={picPch}
                onChange={(e) => setPicPch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">PIC TTB</label>
              <input
                type="text"
                value={picTtb}
                onChange={(e) => setPicTtb(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-muted-foreground font-medium mb-1.5">PIC Lapangan</label>
              <input
                type="text"
                value={picLap}
                onChange={(e) => setPicLap(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground font-mono focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-8 px-4 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg font-medium transition shadow-xs"
            >
              Simpan Berkas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

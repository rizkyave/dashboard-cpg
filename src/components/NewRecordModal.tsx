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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg border border-border bg-muted/60 text-muted-foreground flex items-center justify-center">
              <PlusCircle className="w-4 h-4 text-foreground" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              Input Berkas Pengadaan Baru
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1 font-medium">Entitas Anak Perusahaan CPG</label>
            <select
              value={entity}
              onChange={(e) => setEntity(e.target.value)}
              className="w-full h-8 bg-background border border-border rounded-lg px-3 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="CPL" className="bg-popover text-popover-foreground">CPL - PT Cindara Pratama Lines</option>
              <option value="PPI" className="bg-popover text-popover-foreground">PPI - PT Petro Perkasa Indonesia</option>
              <option value="HL" className="bg-popover text-popover-foreground">HL - PT Hana Lines</option>
              <option value="GAJ" className="bg-popover text-popover-foreground">GAJ - PT Galangan Aliran Jaya (Balikpapan Shipyard)</option>
              <option value="MIL" className="bg-popover text-popover-foreground">MIL - PT Mapan Indonesia Lines</option>
              <option value="SP" className="bg-popover text-popover-foreground">SP - PT Sinar Pasifik</option>
              <option value="SSK" className="bg-popover text-popover-foreground">SSK - PT Sinar Surya Konstruksi</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Nomor FPB</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-FPB-26-0000133"
                value={fpb}
                onChange={(e) => setFpb(e.target.value)}
                className="w-full h-8 bg-background border border-border rounded-lg px-3 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">Nomor PO Internal</label>
              <input
                type="text"
                required
                placeholder="Cth: CPL-PO-26-00405"
                value={po}
                onChange={(e) => setPo(e.target.value)}
                className="w-full h-8 bg-background border border-border rounded-lg px-3 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">Deskripsi Barang</label>
            <input
              type="text"
              required
              placeholder="Cth: Oli Mesin Meditran SX 15W-40 (Drum)"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              className="w-full h-8 bg-background border border-border rounded-lg px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">Peruntukan Armada / Unit</label>
            <input
              type="text"
              required
              placeholder="Cth: U/ TB. ENTEBE EXPRESS 61"
              value={peruntukan}
              onChange={(e) => setPeruntukan(e.target.value)}
              className="w-full h-8 bg-background border border-border rounded-lg px-3 text-foreground focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">PIC PCH</label>
              <input
                type="text"
                value={picPch}
                onChange={(e) => setPicPch(e.target.value)}
                className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">PIC TTB</label>
              <input
                type="text"
                value={picTtb}
                onChange={(e) => setPicTtb(e.target.value)}
                className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">PIC Lapangan</label>
              <input
                type="text"
                value={picLap}
                onChange={(e) => setPicLap(e.target.value)}
                className="w-full h-8 bg-background border border-border rounded-lg px-2.5 text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-4 bg-background text-foreground border border-border rounded-lg font-medium hover:bg-muted transition text-xs"
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-8 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium shadow-sm transition text-xs"
            >
              Simpan Berkas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

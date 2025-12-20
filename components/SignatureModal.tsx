import React, { useRef, useState } from 'react';
// @ts-ignore
import SignatureCanvas from 'react-signature-canvas';
import { X, Eraser, Check } from 'lucide-react';
import { SignatureData } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SignatureData) => void;
  type: 'TRAINER' | 'PARTICIPANT';
}

const SignatureModal: React.FC<Props> = ({ isOpen, onClose, onSave, type }) => {
  const sigCanvas = useRef<any>(null);
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const clear = () => {
    sigCanvas.current?.clear();
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Nama wajib diisi');
      return;
    }
    if (!role.trim()) {
      setError(type === 'TRAINER' ? 'Jabatan wajib diisi' : 'Instansi/Jabatan wajib diisi');
      return;
    }
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setError('Tanda tangan wajib diisi');
      return;
    }

    const signatureDataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
    
    if (signatureDataUrl) {
      onSave({ name, role, signatureDataUrl });
      setName('');
      setRole('');
      setError('');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b bg-slate-50">
          <h3 className="text-lg font-semibold text-slate-800">
            {type === 'TRAINER' ? 'Tanda Tangan Trainer' : 'Tanda Tangan Peserta'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Masukkan nama lengkap"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {type === 'TRAINER' ? 'Jabatan' : 'Jabatan / Instansi'}
            </label>
            <input
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder={type === 'TRAINER' ? "Contoh: Senior Trainer" : "Contoh: Staff IT / PT Maju Jaya"}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tanda Tangan</label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 hover:bg-white hover:border-blue-400 transition-colors">
              <SignatureCanvas
                ref={sigCanvas}
                penColor="black"
                canvasProps={{
                  className: 'w-full h-40 cursor-crosshair rounded-lg',
                }}
                backgroundColor="rgba(0,0,0,0)"
              />
            </div>
            <div className="flex justify-end mt-2">
              <button
                type="button"
                onClick={clear}
                className="text-xs flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors"
              >
                <Eraser size={14} /> Hapus Tanda Tangan
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 font-medium transition-all"
          >
            Batal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex justify-center items-center gap-2 shadow-lg shadow-blue-600/20 transition-all"
          >
            <Check size={18} /> Simpan
          </button>
        </div>
      </div>
    </div>
  );
};

export default SignatureModal;
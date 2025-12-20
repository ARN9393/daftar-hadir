
import React, { useState, useEffect, useCallback } from 'react';
import { 
  PlusCircle, FileDown, Share2, Users, ArrowLeft, Trash2, LogOut, 
  Lock, KeyRound, User, Link as LinkIcon, Check, CheckCircle2, 
  RotateCcw, AlertCircle, Info, Send, Copy, ClipboardCheck, ExternalLink
} from 'lucide-react';
import SignatureModal from './components/SignatureModal';
import { TrainingInfo, Attendee, SignatureData } from './types';
import { generateAttendancePDF } from './services/pdfService';

const generateId = () => `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;

// Fungsi encode/decode untuk "Data Token" agar data bisa dikirim lewat link
const encodeAttendee = (attendee: Attendee) => {
  try {
    const data = {
      n: attendee.name,
      r: attendee.role,
      s: attendee.signature,
      t: attendee.type,
      ts: attendee.timestamp
    };
    return btoa(encodeURIComponent(JSON.stringify(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) { return ""; }
};

const decodeAttendee = (token: string): Partial<Attendee> | null => {
  try {
    let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const decoded = JSON.parse(decodeURIComponent(atob(base64)));
    return {
      id: generateId(),
      name: decoded.n,
      role: decoded.r,
      signature: decoded.s,
      type: decoded.t,
      timestamp: decoded.ts
    };
  } catch (e) { return null; }
};

const encodeInfo = (info: TrainingInfo) => {
  try {
    const data = { a: info.activityName, i: info.instrumentName, t: info.date, l: info.location, pin: info.accessCode };
    return btoa(encodeURIComponent(JSON.stringify(data))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) { return ""; }
};

const decodeInfo = (str: string): Partial<TrainingInfo> | null => {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) base64 += '=';
    const d = JSON.parse(decodeURIComponent(atob(base64)));
    return { activityName: d.a, instrumentName: d.i, date: d.t, location: d.l, accessCode: d.pin };
  } catch (e) { return null; }
};

function App() {
  const [viewMode, setViewMode] = useState<'ADMIN' | 'KIOSK'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('mode') === 'kiosk' ? 'KIOSK' : 'ADMIN';
  });

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => sessionStorage.getItem('admin_auth_token') === 'valid');
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminLoginPass, setAdminLoginPass] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const [isKioskAuthenticated, setIsKioskAuthenticated] = useState(false);
  const [kioskLoginPin, setKioskLoginPin] = useState('');
  const [kioskAuthError, setKioskAuthError] = useState('');
  const [lastSubmittedAttendee, setLastSubmittedAttendee] = useState<Attendee | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'TRAINER' | 'PARTICIPANT'>('PARTICIPANT');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Core Data
  const [info, setInfo] = useState<TrainingInfo>(() => {
    const defaultDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const defaultPin = Math.floor(1000 + Math.random() * 9000).toString();
    
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('d');
    if (dataParam) {
      const decoded = decodeInfo(dataParam);
      if (decoded) return { ...decoded, activityName: decoded.activityName || '', instrumentName: decoded.instrumentName || '', date: decoded.date || defaultDate, location: decoded.location || '', accessCode: decoded.accessCode || defaultPin };
    }

    const saved = localStorage.getItem('proline_training_info');
    return saved ? JSON.parse(saved) : { activityName: '', instrumentName: '', date: defaultDate, location: '', accessCode: defaultPin };
  });

  const [attendees, setAttendees] = useState<Attendee[]>(() => {
    const saved = localStorage.getItem('proline_attendees');
    return saved ? JSON.parse(saved) : [];
  });

  // Handle URL Data Import (Link dari Peserta)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token && isAdminAuthenticated) {
      const newAttendee = decodeAttendee(token);
      if (newAttendee && newAttendee.name) {
        setAttendees(prev => {
          // Cek duplikat berdasarkan nama dan waktu yang sama
          const exists = prev.find(a => a.name === newAttendee.name && Math.abs(a.timestamp - (newAttendee.timestamp || 0)) < 1000);
          if (exists) return prev;
          
          const updated = [...prev, newAttendee as Attendee];
          // Hapus parameter token dari URL setelah import
          const url = new URL(window.location.href);
          url.searchParams.delete('token');
          window.history.replaceState({}, '', url.toString());
          alert(`Berhasil mengimpor data: ${newAttendee.name}`);
          return updated;
        });
      }
    }
  }, [isAdminAuthenticated]);

  useEffect(() => {
    localStorage.setItem('proline_attendees', JSON.stringify(attendees));
  }, [attendees]);

  useEffect(() => {
    localStorage.setItem('proline_training_info', JSON.stringify(info));
  }, [info]);

  const trainers = attendees.filter((a) => a.type === 'TRAINER');
  const participants = attendees.filter((a) => a.type === 'PARTICIPANT');

  const getShareLink = () => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('mode', 'kiosk');
    url.searchParams.set('d', encodeInfo(info));
    return url.toString();
  };

  const getTokenLink = (attendee: Attendee) => {
    const url = new URL(window.location.origin + window.location.pathname);
    url.searchParams.set('token', encodeAttendee(attendee));
    return url.toString();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLoginId.trim() === 'ProlineTS' && adminLoginPass === 'Prolinets123') {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('admin_auth_token', 'valid');
      setAdminAuthError('');
    } else {
      setAdminAuthError('ID Admin atau Password salah.');
    }
  };

  const handleKioskLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (kioskLoginPin.trim() === info.accessCode?.trim()) {
      setIsKioskAuthenticated(true);
      setKioskAuthError('');
    } else {
      setKioskAuthError('PIN Akses salah.');
    }
  };

  const handleCopyLink = () => {
    const link = getShareLink();
    navigator.clipboard.writeText(link).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  const handleSaveSignature = (data: SignatureData) => {
    const newAttendee: Attendee = {
      id: generateId(),
      name: data.name,
      role: data.role,
      signature: data.signatureDataUrl,
      type: modalType,
      timestamp: Date.now(),
    };
    setAttendees(prev => [...prev, newAttendee]);
    if (viewMode === 'KIOSK') setLastSubmittedAttendee(newAttendee);
  };

  const downloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      await generateAttendancePDF(info, attendees);
    } catch (error) {
      alert("Gagal membuat PDF.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq" alt="Logo" className="h-8" />
          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase hidden sm:block">Proline Attendance</span>
        </div>
        <div className="flex items-center gap-2">
          {viewMode === 'ADMIN' && isAdminAuthenticated && (
            <div className="flex gap-2">
                <button onClick={handleCopyLink} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-all ${copySuccess ? 'bg-green-50 border-green-200 text-green-600' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                    {copySuccess ? <Check size={16}/> : <Share2 size={16}/>}
                    <span className="hidden md:inline">{copySuccess ? 'Link Peserta Disalin' : 'Bagikan Form'}</span>
                </button>
                <button onClick={() => { setIsAdminAuthenticated(false); sessionStorage.removeItem('admin_auth_token'); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={20}/></button>
            </div>
          )}
          {viewMode === 'KIOSK' && (
             <button onClick={() => { setViewMode('ADMIN'); setIsKioskAuthenticated(false); }} className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 font-semibold">
                <ArrowLeft size={14}/> Dashboard Admin
             </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderKioskSuccess = () => {
    const tokenLink = lastSubmittedAttendee ? getTokenLink(lastSubmittedAttendee) : "";
    
    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-3xl shadow-2xl text-center space-y-6 animate-in zoom-in duration-300">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto border-4 border-green-50">
            <CheckCircle2 size={48} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tanda Tangan Berhasil!</h2>
          <p className="text-slate-500 mt-2">Terima kasih <b>{lastSubmittedAttendee?.name}</b>, kehadiran Anda telah dicatat.</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 space-y-3">
          <p className="text-xs text-blue-600 font-bold uppercase">Langkah Terakhir (Jika HP Pribadi)</p>
          <p className="text-[11px] text-blue-500 leading-tight">Klik tombol di bawah untuk menyalin link data Anda, lalu kirimkan ke WhatsApp Trainer agar masuk ke daftar utama.</p>
          <button 
            onClick={() => {
              navigator.clipboard.writeText(tokenLink);
              setTokenCopied(true);
              setTimeout(() => setTokenCopied(false), 3000);
            }}
            className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${tokenCopied ? 'bg-green-600 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
          >
            {tokenCopied ? <><ClipboardCheck size={20}/> Link Data Disalin!</> : <><Send size={18}/> Kirim Data ke Trainer</>}
          </button>
        </div>

        <button onClick={() => setLastSubmittedAttendee(null)} className="w-full py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200">
            Isi untuk Orang Lain
        </button>
      </div>
    );
  };

  const renderKioskMode = () => {
    if (lastSubmittedAttendee) return renderKioskSuccess();
    if (!isKioskAuthenticated) {
      return (
        <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100 animate-in fade-in zoom-in">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600">
                <KeyRound size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Akses Peserta</h2>
              <p className="text-sm text-slate-500 mt-1">Masukkan PIN yang diberikan oleh Admin/Trainer</p>
            </div>
            <form onSubmit={handleKioskLogin} className="space-y-6">
              {kioskAuthError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl text-center border border-red-100 font-medium">{kioskAuthError}</div>}
              <input
                type="tel"
                value={kioskLoginPin}
                onChange={(e) => setKioskLoginPin(e.target.value)}
                className="w-full px-4 py-4 border-2 border-slate-100 rounded-2xl text-center text-3xl font-mono tracking-[0.5em] focus:border-blue-500 focus:ring-0 outline-none transition-all"
                placeholder="0000"
                maxLength={6}
                autoFocus
              />
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                Buka Form Absen
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-md mx-auto mt-10 p-8 bg-white rounded-3xl shadow-2xl space-y-8 animate-in slide-in-from-bottom-4">
          <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900">Daftar Hadir Training</h2>
              <div className="mt-6 p-5 bg-slate-50 rounded-2xl text-left border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Topik Kegiatan</p>
                  <p className="text-lg font-bold text-slate-900 leading-tight">{info.activityName || 'Sesi Training Proline'}</p>
                  <div className="flex items-center gap-2 mt-3 text-slate-500 text-xs">
                    <User size={14} /> <span>{info.instrumentName || 'Umum'}</span>
                    <span className="mx-1">•</span>
                    <span>{info.date}</span>
                  </div>
              </div>
          </div>
          <button 
            onClick={() => { setModalType('PARTICIPANT'); setIsModalOpen(true); }} 
            className="w-full py-6 bg-slate-900 text-white rounded-3xl font-bold text-xl shadow-2xl shadow-slate-900/20 active:scale-95 transition-all flex flex-col items-center justify-center gap-1"
          >
              <span>Mulai Tanda Tangan</span>
              <span className="text-[10px] opacity-60 font-normal uppercase tracking-widest">Digital Signature</span>
          </button>
          <div className="flex items-center gap-2 justify-center text-slate-400 text-[10px] uppercase font-bold tracking-widest">
            <Lock size={12}/> Secure Data System
          </div>
      </div>
    );
  };

  const renderAdminDashboard = () => (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
        <section className="bg-white rounded-3xl shadow-xl border border-slate-100 p-8 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4">
              <div className="bg-amber-50 text-amber-600 px-4 py-2 rounded-2xl text-xs font-bold border border-amber-100 flex items-center gap-2">
                 <KeyRound size={14}/> PIN AKSES: {info.accessCode}
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-8">Dashboard Admin</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Nama Kegiatan</label>
                    <input name="activityName" value={info.activityName} onChange={(e) => setInfo({...info, activityName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-medium" placeholder="Contoh: Training ISO 9001" />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Ubah PIN Akses</label>
                    <input name="accessCode" value={info.accessCode} onChange={(e) => setInfo({...info, accessCode: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl font-mono tracking-widest text-center" />
                </div>
            </div>

            <div className="mt-8 p-5 bg-blue-50/50 rounded-2xl flex gap-4 border border-blue-100/50">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
                  <Info size={20} />
                </div>
                <div>
                  <p className="text-xs text-blue-700 font-semibold mb-1">Tips Koneksi Perangkat:</p>
                  <p className="text-[11px] text-blue-600 leading-relaxed">
                    Data tersimpan di <b>Browser Ini</b>. Jika peserta mengisi dari HP masing-masing, minta mereka klik <b>"Kirim Data ke Trainer"</b> setelah tanda tangan, lalu klik link yang mereka kirimkan untuk memasukkan data mereka ke daftar ini secara otomatis.
                  </p>
                </div>
            </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-blue-500"/> Trainers</h3>
                    <button onClick={() => { setModalType('TRAINER'); setIsModalOpen(true); }} className="text-blue-600 text-xs font-bold hover:underline">+ Tambah</button>
                </div>
                <div className="bg-white border border-slate-100 rounded-3xl divide-y overflow-hidden shadow-sm">
                    {trainers.length === 0 ? <p className="p-8 text-center text-slate-400 text-sm italic">Belum ada trainer</p> : trainers.map(t => (
                        <div key={t.id} className="p-5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div><p className="font-bold text-slate-900 text-sm">{t.name}</p><p className="text-[11px] text-slate-400">{t.role}</p></div>
                            <div className="flex items-center gap-3">
                                <img src={t.signature} className="h-8 border rounded bg-white p-0.5" alt="sig"/>
                                <button onClick={() => setAttendees(attendees.filter(a => a.id !== t.id))} className="text-red-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
                <div className="flex justify-between items-center px-2">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-green-500"/> Peserta ({participants.length})</h3>
                    <button onClick={downloadPDF} disabled={isGeneratingPdf} className="bg-slate-900 text-white px-5 py-2 rounded-2xl text-xs font-bold flex items-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                        {isGeneratingPdf ? <RotateCcw size={14} className="animate-spin"/> : <FileDown size={14}/>}
                        {isGeneratingPdf ? 'Memproses...' : 'Download PDF'}
                    </button>
                </div>
                <div className="bg-white border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-[10px] text-slate-400 uppercase tracking-widest">Nama Peserta</th>
                                <th className="px-6 py-4 text-[10px] text-slate-400 uppercase tracking-widest">Jabatan / Instansi</th>
                                <th className="px-6 py-4 text-right text-[10px] text-slate-400 uppercase tracking-widest">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {participants.length === 0 ? (
                              <tr><td colSpan={3} className="px-6 py-16 text-center text-slate-400 italic">Belum ada peserta yang mengisi daftar hadir.</td></tr>
                            ) : (
                              participants.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4 font-semibold text-slate-900">{p.name}</td>
                                    <td className="px-6 py-4 text-slate-500">{p.role}</td>
                                    <td className="px-6 py-4 text-right">
                                      <div className="flex justify-end items-center gap-4">
                                        <img src={p.signature} className="h-8 border rounded bg-white p-0.5 opacity-60 group-hover:opacity-100" alt="sig"/>
                                        <button onClick={() => setAttendees(attendees.filter(a => a.id !== p.id))} className="text-slate-200 hover:text-red-500 transition-colors"><Trash2 size={16}/></button>
                                      </div>
                                    </td>
                                </tr>
                              ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] pb-20">
      {renderHeader()}
      <main>
        {viewMode === 'KIOSK' ? renderKioskMode() : (
          !isAdminAuthenticated ? (
            <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6 bg-slate-50">
              <div className="max-w-sm w-full bg-white rounded-3xl shadow-2xl p-8 border border-slate-100">
                <div className="text-center mb-8">
                  <img src="https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq" alt="Proline" className="h-10 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
                </div>
                <form onSubmit={handleAdminLogin} className="space-y-4">
                  {adminAuthError && <div className="p-3 bg-red-50 text-red-600 text-xs rounded-xl text-center font-medium">{adminAuthError}</div>}
                  <input type="text" placeholder="ID Admin" value={adminLoginId} onChange={(e) => setAdminLoginId(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900" />
                  <input type="password" placeholder="Password" value={adminLoginPass} onChange={(e) => setAdminLoginPass(e.target.value)} className="w-full px-5 py-3 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900" />
                  <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-lg shadow-xl shadow-slate-900/20 active:scale-95 transition-all">Masuk</button>
                </form>
                <button onClick={() => setViewMode('KIOSK')} className="w-full mt-6 py-2 text-sm text-blue-600 font-bold hover:underline">Masuk Sebagai Peserta</button>
              </div>
            </div>
          ) : renderAdminDashboard()
        )}
      </main>
      <SignatureModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSave={handleSaveSignature} type={modalType} />
    </div>
  );
}

export default App;

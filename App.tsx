import React, { useState, useEffect } from 'react';
import { PlusCircle, FileDown, Share2, Users, ArrowLeft, Trash2, LogOut, Lock, KeyRound, User, Link as LinkIcon, Check } from 'lucide-react';
import SignatureModal from './components/SignatureModal';
import { TrainingInfo, Attendee, SignatureData } from './types';
import { generateAttendancePDF } from './services/pdfService';

// Robust ID generator
const generateId = () => {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 9)}`;
};

// Helper functions for safe URL data encoding (URL-Safe Base64)
const encodeData = (data: any) => {
  try {
    const json = JSON.stringify(data);
    const uriEncoded = encodeURIComponent(json);
    const base64 = btoa(uriEncoded);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    console.error("Encoding error", e);
    return "";
  }
};

const decodeData = (str: string) => {
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const uriEncoded = atob(base64);
    return JSON.parse(decodeURIComponent(uriEncoded));
  } catch (e) {
    console.error("Decoding error", e);
    return null;
  }
};

function App() {
  // Application State
  const [viewMode, setViewMode] = useState<'ADMIN' | 'KIOSK'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'kiosk' ? 'KIOSK' : 'ADMIN';
    }
    return 'ADMIN';
  });

  // Admin Auth State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('admin_auth_token') === 'valid';
    }
    return false;
  });
  const [adminLoginId, setAdminLoginId] = useState('');
  const [adminLoginPass, setAdminLoginPass] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  // Kiosk Auth State
  const [isKioskAuthenticated, setIsKioskAuthenticated] = useState(false);
  const [kioskLoginPin, setKioskLoginPin] = useState('');
  const [kioskAuthError, setKioskAuthError] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'TRAINER' | 'PARTICIPANT'>('PARTICIPANT');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  // Data State initialized from URL params
  const [info, setInfo] = useState<TrainingInfo>(() => {
    const defaultDate = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const defaultPin = Math.floor(1000 + Math.random() * 9000).toString();
    
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      
      const dataParam = params.get('d');
      if (dataParam) {
        const decoded = decodeData(dataParam);
        if (decoded) {
            return {
                activityName: decoded.a || '',
                instrumentName: decoded.i || '',
                date: decoded.t || defaultDate,
                location: decoded.l || '',
                participantId: decoded.pid || 'peserta',
                accessCode: decoded.pin || defaultPin,
            };
        }
      }

      const activityName = params.get('activityName');
      if (activityName) {
        return {
            activityName: activityName || '',
            instrumentName: params.get('instrumentName') || '',
            date: params.get('date') || defaultDate,
            location: params.get('location') || '',
            participantId: params.get('pid') || 'peserta',
            accessCode: params.get('pin') || defaultPin,
        };
      }
    }
    
    return {
      activityName: '',
      instrumentName: '',
      date: defaultDate,
      location: '',
      participantId: 'peserta',
      accessCode: defaultPin,
    };
  });

  const [attendees, setAttendees] = useState<Attendee[]>([]);

  const trainers = attendees.filter((a) => a.type === 'TRAINER');
  const participants = attendees.filter((a) => a.type === 'PARTICIPANT');

  const getShareLink = () => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    url.search = ''; 
    const payload = {
        a: info.activityName,
        i: info.instrumentName,
        t: info.date,
        l: info.location,
        pid: info.participantId,
        pin: info.accessCode
    };
    const encoded = encodeData(payload);
    url.searchParams.set('mode', 'kiosk');
    if (encoded) {
        url.searchParams.set('d', encoded);
    }
    return url.toString();
  };

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminLoginId === 'ProlineTS' && adminLoginPass === 'Prolinets123') {
      setIsAdminAuthenticated(true);
      sessionStorage.setItem('admin_auth_token', 'valid');
      setAdminAuthError('');
      setAdminLoginId('');
      setAdminLoginPass('');
    } else {
      setAdminAuthError('ID atau Password salah.');
    }
  };

  const handleAdminLogout = () => {
    setIsAdminAuthenticated(false);
    sessionStorage.removeItem('admin_auth_token');
    setViewMode('ADMIN');
  };

  const handleKioskLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (kioskLoginPin === info.accessCode) {
      setIsKioskAuthenticated(true);
      setKioskAuthError('');
    } else {
      setKioskAuthError('PIN Akses salah. Silakan tanya Trainer Anda.');
    }
  };

  const handleCopyLink = () => {
    const link = getShareLink();
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link).then(() => {
            setCopySuccess(true);
            setTimeout(() => setCopySuccess(false), 2000);
        }).catch(() => fallbackCopy(link));
    } else {
        fallbackCopy(link);
    }
  };

  const fallbackCopy = (text: string) => {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
        console.error('Copy failed', err);
        alert('Gagal menyalin link. Silakan salin manual.');
    }
  };

  const handleInfoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setInfo((prev) => ({ ...prev, [name]: value }));
  };

  const openSignatureModal = (type: 'TRAINER' | 'PARTICIPANT') => {
    setModalType(type);
    setIsModalOpen(true);
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
    setAttendees((prev) => [...prev, newAttendee]);
    
    if (viewMode === 'KIOSK') {
      alert('Terima kasih! Absensi Anda telah tersimpan.');
    }
  };

  const handleDeleteAttendee = (e: React.MouseEvent<HTMLButtonElement>, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!id) return;
    if (window.confirm('Apakah Anda yakin ingin menghapus data ini?')) {
      setAttendees((prev) => prev.filter((a) => a.id !== id));
    }
  };

  const downloadPDF = async () => {
    if (!info.activityName) {
      alert('Mohon isi Nama Kegiatan terlebih dahulu.');
      return;
    }
    try {
      setIsGeneratingPdf(true);
      await generateAttendancePDF(info, attendees);
    } catch (error: any) {
      console.error('Failed to generate PDF', error);
      alert(`Gagal membuat PDF: ${error.message || 'Unknown error'}`);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderHeader = () => (
    <div className="bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
                <img 
                  src="https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq"
                  alt="Proline Logo"
                  className="h-10 w-auto object-contain"
                />
            </div>
          <div className="h-6 w-px bg-slate-300 mx-2 hidden sm:block"></div>
          <span className="text-sm text-slate-500 font-medium hidden sm:block">Attendance System</span>
        </div>

        <div className="flex items-center gap-2">
          {viewMode === 'ADMIN' ? (
            isAdminAuthenticated ? (
              <>
                 <button 
                  onClick={handleCopyLink}
                  className={`px-3 py-2 rounded-lg border transition-all flex items-center gap-2 text-sm font-medium ${
                      copySuccess 
                      ? 'bg-green-50 border-green-200 text-green-600' 
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                  title="Salin Link untuk Peserta"
                >
                  {copySuccess ? <Check size={18} /> : <LinkIcon size={18} />}
                  <span className="hidden sm:inline">{copySuccess ? 'Disalin!' : 'Salin Link'}</span>
                </button>
                <button 
                  onClick={() => setViewMode('KIOSK')}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors flex items-center gap-2"
                  title="Mode Kiosk/Peserta"
                >
                  <Share2 size={20} />
                  <span className="hidden sm:inline text-sm font-medium">Mode Peserta</span>
                </button>
                <button 
                  onClick={downloadPDF}
                  disabled={isGeneratingPdf}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 text-sm font-medium shadow-lg shadow-slate-900/20 disabled:opacity-70 disabled:cursor-wait"
                >
                  <FileDown size={18} />
                  {isGeneratingPdf ? 'Memproses...' : 'Download PDF'}
                </button>
                <div className="w-px h-8 bg-slate-200 mx-2"></div>
                <button 
                  onClick={handleAdminLogout}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                  title="Keluar"
                >
                  <LogOut size={20} />
                </button>
              </>
            ) : null
          ) : (
            <button 
              onClick={() => {
                if (window.history.pushState) {
                    const url = new URL(window.location.href);
                    url.search = '';
                    window.history.pushState({}, '', url.toString());
                }
                setViewMode('ADMIN');
                setAttendees([]);
                setIsKioskAuthenticated(false);
              }}
              className="px-3 py-1.5 text-slate-600 border border-slate-300 rounded-md hover:bg-slate-50 text-xs font-medium flex items-center gap-1"
            >
              <ArrowLeft size={14} /> Kembali ke Admin
            </button>
          )}
        </div>
      </div>
    </div>
  );

  const renderAdminLogin = () => (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
          <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="text-blue-600" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Admin Login</h2>
          <p className="text-sm text-slate-500 mt-1">Gunakan kredensial Proline untuk masuk</p>
        </div>

        <form onSubmit={handleAdminLogin} className="space-y-4">
          {adminAuthError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 text-center">
              {adminAuthError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ID Admin</label>
            <input
              type="text"
              value={adminLoginId}
              onChange={(e) => setAdminLoginId(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Masukkan ID"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Kata Sandi</label>
            <input
              type="password"
              value={adminLoginPass}
              onChange={(e) => setAdminLoginPass(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              placeholder="Masukkan Password"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-lg shadow-slate-900/20 transition-all active:scale-95"
          >
            Masuk
          </button>
        </form>

        <div className="pt-6 border-t border-slate-100 mt-6">
          <button
            type="button"
            onClick={() => setViewMode('KIOSK')}
            className="w-full py-2.5 px-4 border border-blue-200 text-blue-600 rounded-lg text-sm font-semibold hover:bg-blue-50 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <Users size={18} />
            Masuk Mode Peserta
          </button>
        </div>
      </div>
    </div>
  );

  const renderKioskLogin = () => (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-sm w-full bg-white rounded-2xl shadow-xl p-8 animate-in fade-in zoom-in duration-300">
        <div className="text-center mb-6">
           <img 
              src="https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq"
              alt="Proline"
              className="h-12 w-auto object-contain mx-auto mb-4"
            />
          <h2 className="text-xl font-bold text-slate-900">Login Peserta</h2>
          <p className="text-sm text-slate-500 mt-1">Masukkan PIN dari Trainer untuk mengisi absen</p>
        </div>

        <form onSubmit={handleKioskLogin} className="space-y-4">
          {kioskAuthError && (
            <div className="p-3 bg-red-50 text-red-600 text-xs rounded-lg border border-red-100 text-center">
              {kioskAuthError}
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">PIN Akses</label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 text-slate-400" size={18} />
              <input
                type="tel"
                value={kioskLoginPin}
                onChange={(e) => setKioskLoginPin(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-center text-lg tracking-widest"
                placeholder="PIN"
                maxLength={6}
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            Buka Form Absen
          </button>
        </form>
      </div>
    </div>
  );

  const renderKioskMode = () => (
    <div className="min-h-[calc(100vh-64px)] flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-6 animate-in fade-in zoom-in duration-300">
        <div className="w-full flex justify-center mb-4">
             <img 
                  src="https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq"
                  alt="Proline Logo"
                  className="h-16 w-auto object-contain"
                />
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Presensi Kehadiran</h2>
          <p className="text-slate-500">Silakan isi data diri dan tanda tangan digital.</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl text-left space-y-3 border border-slate-100">
           <div className="flex justify-between items-center border-b border-slate-200 pb-2">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Kegiatan</span>
              <span className="text-sm font-bold text-slate-900 text-right max-w-[60%] truncate">
                {info.activityName || <span className="text-slate-400 italic">Belum diisi</span>}
              </span>
           </div>
           <div className="flex justify-between items-center">
              <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Tanggal</span>
              <span className="text-sm font-medium text-slate-900 text-right">{info.date || '-'}</span>
           </div>
        </div>

        <button
          onClick={() => openSignatureModal('PARTICIPANT')}
          className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-semibold text-lg shadow-lg shadow-blue-600/30 transition-all active:scale-95 flex justify-center items-center gap-2"
        >
          Isi Daftar Hadir
        </button>
        
        <p className="text-xs text-slate-400 mt-8">Proline Attendance System &copy; 2024</p>
      </div>
    </div>
  );

  const renderAdminMode = () => (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4">
      
      <section className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold text-slate-800">Informasi Training & Keamanan</h2>
        </div>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Kegiatan</label>
            <input
              type="text"
              name="activityName"
              value={info.activityName}
              onChange={handleInfoChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Instrumen</label>
            <input
              type="text"
              name="instrumentName"
              value={info.instrumentName}
              onChange={handleInfoChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Hari, Tanggal</label>
            <input
              type="text"
              name="date"
              value={info.date}
              onChange={handleInfoChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Lokasi</label>
            <input
              type="text"
              name="location"
              value={info.location}
              onChange={handleInfoChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
          </div>
          
          <div className="md:col-span-2 border-t pt-4 mt-2">
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                <Lock size={16} className="text-slate-500"/> Keamanan Akses Peserta
            </h3>
            <div className="max-w-xs">
                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">PIN Akses</label>
                <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 text-slate-400" size={18} />
                    <input
                        type="text"
                        name="accessCode"
                        value={info.accessCode || ''}
                        onChange={handleInfoChange}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 bg-slate-50 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-slate-700 text-center text-lg tracking-widest"
                        maxLength={6}
                    />
                </div>
                <p className="text-xs text-slate-400 mt-1">Gunakan tombol "Salin Link" di atas untuk membagikan akses ke peserta.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <section className="lg:col-span-1 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Trainers</h3>
                <button
                    onClick={() => openSignatureModal('TRAINER')}
                    className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                    <PlusCircle size={16} /> Tambah
                </button>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {trainers.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-sm">Belum ada trainer</div>
                ) : (
                    <ul className="divide-y divide-slate-100">
                        {trainers.map((t) => (
                            <li key={t.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                <div className="flex-1 mr-2">
                                    <div className="font-medium text-slate-900">{t.name}</div>
                                    <div className="text-xs text-slate-500">{t.role}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <img src={t.signature} alt="sig" className="h-8 w-auto border border-slate-100 bg-white rounded" />
                                    <button
                                        type="button"
                                        onClick={(e) => handleDeleteAttendee(e, t.id)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>

        <section className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-800">Peserta ({participants.length})</h3>
                <button
                    onClick={() => openSignatureModal('PARTICIPANT')}
                    className="text-sm flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                >
                    <PlusCircle size={16} /> Tambah
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-3 w-12 text-center">No</th>
                                <th className="px-6 py-3">Nama</th>
                                <th className="px-6 py-3">Jabatan / Instansi</th>
                                <th className="px-6 py-3 text-right">Tanda Tangan</th>
                                <th className="px-6 py-3 w-16 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {participants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        Belum ada peserta yang mengisi daftar hadir.
                                    </td>
                                </tr>
                            ) : (
                                participants.map((p, idx) => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4 text-center text-slate-500">{idx + 1}</td>
                                        <td className="px-6 py-4 font-medium text-slate-900">{p.name}</td>
                                        <td className="px-6 py-4 text-slate-600">{p.role}</td>
                                        <td className="px-6 py-4 flex justify-end">
                                            <img src={p.signature} alt="sig" className="h-8 w-auto border border-slate-100 bg-slate-50 rounded" />
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                type="button"
                                                onClick={(e) => handleDeleteAttendee(e, p.id)}
                                                className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </section>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans">
      {renderHeader()}
      <main>
        {viewMode === 'KIOSK' ? (
             isKioskAuthenticated ? renderKioskMode() : renderKioskLogin()
        ) : (
          !isAdminAuthenticated ? renderAdminLogin() : renderAdminMode()
        )}
      </main>
      
      <SignatureModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSignature}
        type={modalType}
      />
    </div>
  );
}

export default App;
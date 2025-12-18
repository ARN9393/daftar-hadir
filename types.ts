export interface TrainingInfo {
  activityName: string;
  instrumentName: string;
  date: string;
  location: string;
  participantId?: string;
  accessCode?: string;
}

export interface Attendee {
  id: string;
  name: string;
  role: string; // 'Jabatan' or 'Jabatan / Instansi'
  signature: string; // Base64 data URL
  type: 'TRAINER' | 'PARTICIPANT';
  timestamp: number;
}

export interface SignatureData {
  name: string;
  role: string;
  signatureDataUrl: string;
}
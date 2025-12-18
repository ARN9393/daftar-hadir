import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TrainingInfo, Attendee } from '../types';

// Robust helper to get the jsPDF constructor regardless of import style
const getJsPDF = () => {
  if (typeof jsPDF === 'function') return new jsPDF();
  // Handle case where default export is an object containing the class
  if ((jsPDF as any).jsPDF && typeof (jsPDF as any).jsPDF === 'function') {
    return new (jsPDF as any).jsPDF();
  }
  // Fallback global
  if ((window as any).jspdf && (window as any).jspdf.jsPDF) {
    return new (window as any).jspdf.jsPDF();
  }
  throw new Error("jsPDF library not found");
}

// Robust helper to run autoTable
const runAutoTable = (doc: any, options: any) => {
  const at = (autoTable as any).default || autoTable;
  if (typeof at === 'function') {
    at(doc, options);
  } else if ((window as any).jspdf && (window as any).jspdf.autoTable) {
    (window as any).jspdf.autoTable(doc, options);
  } else {
    console.warn("jspdf-autotable plugin not found or invalid");
  }
};

const LOGO_URL = "https://blogger.googleusercontent.com/img/a/AVvXsEgja23NlnFP6xSUoDvW48Iopqrz2WlhHK2Kufki0WdjBoQYfyyP3xSQ90L_b79uMf-w2iPwo1YOUf1KBBhh55bmWycYOIEGoij1qVVEu2tne8jtxoKzfNlULQpPwF1N5hY2cn1eJREpuU1R0TeNTdpP21OzP7ye-Zdd5n4X6HHcLpkUs7dDHA3yxWgSUDgq";

const getBase64FromUrl = (url: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve("");
        }
      } catch (error) {
        console.warn("Logo blocked by CORS", error);
        resolve(""); 
      }
    };

    img.onerror = () => {
      console.warn("Logo failed to load");
      resolve("");
    };

    // Safety timeout
    setTimeout(() => {
        if (!img.complete) resolve("");
    }, 3000);

    img.src = url;
  });
};

export const generateAttendancePDF = async (info: TrainingInfo, attendees: Attendee[]) => {
  // 1. Initialize Document
  const doc = getJsPDF();
  
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - (margin * 2);
  
  // --- HEADER SECTION ---
  doc.setFontSize(8);
  doc.text('d/PL/016c-00/0125', pageWidth - margin, 10, { align: 'right' });

  const headerTop = 15;
  const headerHeight = 20;
  
  // 2. Load Logo
  let logoBase64 = "";
  try {
    logoBase64 = await getBase64FromUrl(LOGO_URL);
  } catch (e) {
    console.warn("Logo load error", e);
  }

  // Draw Header Boxes
  doc.setDrawColor(0);
  doc.rect(margin, headerTop, 60, headerHeight); // Logo Box
  
  if (logoBase64 && logoBase64.startsWith('data:image')) {
      try {
        doc.addImage(logoBase64, 'PNG', margin + 2, headerTop + 1, 56, 18, undefined, 'FAST');
      } catch (e) {
        console.warn("Add logo failed", e);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("PROLINE", margin + 10, headerTop + 13);
      }
  } else {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("PROLINE", margin + 10, headerTop + 13);
  }

  doc.rect(margin + 60, headerTop, contentWidth - 60, headerHeight); // Title Box
  doc.setTextColor(0);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("DAFTAR HADIR TRAINING", margin + 60 + (contentWidth - 60) / 2, headerTop + 12, { align: 'center' });

  // --- INFO SECTION ---
  const infoStart = headerTop + headerHeight + 5;
  const lineHeight = 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const fields = [
    { label: "Nama Kegiatan", value: info.activityName },
    { label: "Nama Instrumen", value: info.instrumentName },
    { label: "Hari,Tanggal", value: info.date },
    { label: "Lokasi", value: info.location },
  ];

  fields.forEach((field, index) => {
    const yPos = infoStart + (index * lineHeight);
    doc.text(field.label, margin, yPos);
    doc.text(":", margin + 40, yPos);
    doc.text(field.value, margin + 45, yPos);
    doc.line(margin + 45, yPos + 1, pageWidth - margin, yPos + 1);
  });

  // --- TRAINER TABLE ---
  let currentY = infoStart + (fields.length * lineHeight) + 10;
  
  doc.setFont("helvetica", "bold");
  doc.text("Trainer", margin, currentY);
  currentY += 2;

  const trainers = attendees.filter(a => a.type === 'TRAINER');
  const trainerRows = [...trainers];
  while (trainerRows.length < 2) {
    trainerRows.push({ id: '', name: '', role: '', signature: '', type: 'TRAINER', timestamp: 0 });
  }

  try {
      runAutoTable(doc, {
        startY: currentY,
        head: [['No', 'Nama', 'Jabatan', 'Tanda tangan']],
        body: trainerRows.map((t, i) => [
          i + 1, 
          t.name, 
          t.role, 
          '' // Pass empty string to prevent printing base64 text
        ]),
        theme: 'plain',
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          fontSize: 10,
          cellPadding: 4,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [220, 220, 220],
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 60 },
          2: { cellWidth: 60 },
          3: { cellWidth: 30, minCellHeight: 15 }, // Set specific width for signature column
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const signature = trainerRows[data.row.index]?.signature;
            if (signature && signature.startsWith('data:image')) {
               try {
                 // Adjust image position and size to fit well within cell
                 const imgWidth = 24;
                 const imgHeight = 12;
                 const x = data.cell.x + (data.cell.width - imgWidth) / 2;
                 const y = data.cell.y + (data.cell.height - imgHeight) / 2;
                 doc.addImage(signature, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');
               } catch (e) {
                 console.warn("Failed to add trainer signature", e);
               }
            }
          }
        }
      });
  } catch (err) {
      console.error("Trainer table generation failed", err);
  }

  // --- PARTICIPANT TABLE ---
  // Fallback calculation if lastAutoTable is not available
  const lastFinalY = (doc as any).lastAutoTable?.finalY;
  currentY = lastFinalY ? lastFinalY + 10 : currentY + 40;
  
  doc.setFont("helvetica", "bold");
  doc.text("Peserta", margin, currentY);
  currentY += 2;

  const participants = attendees.filter(a => a.type === 'PARTICIPANT');
  const participantRows = [...participants];

  try {
      runAutoTable(doc, {
        startY: currentY,
        head: [['No', 'Nama', 'Jabatan / Instansi', 'Tandatangan']],
        body: participantRows.map((p, i) => [
          i + 1,
          p.name,
          p.role,
          '' // Pass empty string to prevent printing base64 text
        ]),
        theme: 'plain',
        styles: {
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          textColor: [0, 0, 0],
          fontSize: 10,
          cellPadding: 4,
          valign: 'middle',
        },
        headStyles: {
          fillColor: [220, 220, 220],
          fontStyle: 'bold',
          halign: 'center',
        },
        columnStyles: {
          0: { cellWidth: 15, halign: 'center' },
          1: { cellWidth: 60 },
          2: { cellWidth: 60 },
          3: { cellWidth: 30, minCellHeight: 15 }, // Set specific width for signature column
        },
        didDrawCell: (data: any) => {
          if (data.section === 'body' && data.column.index === 3) {
            const signature = participantRows[data.row.index]?.signature;
            if (signature && signature.startsWith('data:image')) {
                try {
                    // Adjust image position and size to fit well within cell
                    const imgWidth = 24;
                    const imgHeight = 12;
                    const x = data.cell.x + (data.cell.width - imgWidth) / 2;
                    const y = data.cell.y + (data.cell.height - imgHeight) / 2;
                    doc.addImage(signature, 'PNG', x, y, imgWidth, imgHeight, undefined, 'FAST');
                } catch (e) {
                    console.warn("Failed to add participant signature", e);
                }
            }
          }
        }
      });
  } catch (err) {
       console.error("Participant table generation failed", err);
  }

  // 3. Save
  doc.save(`Daftar_Hadir_${info.activityName.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
};

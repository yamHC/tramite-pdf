import React, { useState, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import {
  ShieldCheck,
  FileImage,
  Printer,
  Heart,
  Upload,
  CheckCircle2,
  Lock,
  ArrowLeft,
  FileText,
  ArrowRight,
  Check,
  ArrowUpRight,
  X,
  Eye,
} from 'lucide-react';

export default function App() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donateTab, setDonateTab] = useState('peru'); // 'peru' | 'intl'
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  const PAYPAL_DONATE_URL = 'https://www.paypal.com/donate/?hosted_button_id=A4YJTUMDD5JN6';
  const DEVSTORE_URL = 'https://devstore.vercel.app';

  // Herramienta 1: Sello de Agua Anti-Fraude
  const [wmFile, setWmFile] = useState(null);
  const [wmText, setWmText] = useState('SOLO PARA TRÁMITE - NO VÁLIDO PARA CRÉDITOS');

  // Herramienta 2: Fotos a PDF A4
  const [images, setImages] = useState([]);

  // Herramienta 3: DNI / Documentos en 1 Hoja A4 (Color o Blanco y Negro)
  const [copyImages, setCopyImages] = useState([]);
  const [copyColorMode, setCopyColorMode] = useState('bw'); // 'bw' | 'color'

  const resetStates = (tool) => {
    setSelectedTool(tool);
    setWmFile(null);
    setImages([]);
    setCopyImages([]);
    setCopyColorMode('bw');
    setStatusMsg(null);
  };

  const triggerDownload = (bytes, filename) => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatusMsg('¡Listo! Tu documento PDF ya se descargó en tu dispositivo.');
  };

  // Lógica 1: Sello de agua diagonal anti-fraude
  const handleWatermark = async (e) => {
    e.preventDefault();
    if (!wmFile) return;
    setProcessing(true);
    setStatusMsg(null);

    try {
      const arrayBuffer = await wmFile.arrayBuffer();
      let pdfDoc;

      if (wmFile.type === 'application/pdf') {
        pdfDoc = await PDFDocument.load(arrayBuffer);
      } else {
        pdfDoc = await PDFDocument.create();
        const img =
          wmFile.type === 'image/png'
            ? await pdfDoc.embedPng(arrayBuffer)
            : await pdfDoc.embedJpg(arrayBuffer);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();
      const cleanText = wmText.trim().toUpperCase() || 'SOLO PARA TRÁMITE';

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const targetDiagonalWidth = width * 0.88;
        const unitTextWidth = font.widthOfTextAtSize(cleanText, 1);
        const fontSize = Math.max(12, Math.min(height / 14, targetDiagonalWidth / unitTextWidth));
        const textWidth = font.widthOfTextAtSize(cleanText, fontSize);

        const rows = [0.18, 0.42, 0.66, 0.88];
        rows.forEach((ratioY) => {
          page.drawText(cleanText, {
            x: Math.max(15, (width - textWidth * 0.88) / 2),
            y: height * ratioY - textWidth * 0.16,
            size: fontSize,
            font: font,
            color: rgb(0.86, 0.06, 0.06),
            opacity: 0.58,
            rotate: degrees(22),
          });
        });
      });

      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, `PROTEGIDO_${wmFile.name.split('.')[0]}.pdf`);
    } catch (err) {
      setStatusMsg('Error: Asegúrate de subir una foto (JPG/PNG) o un archivo PDF válido.');
    }
    setProcessing(false);
  };

  // Lógica 2: Unir fotos en PDF A4 respetando el orden exacto de selección
  const handleImagesToPdf = async (e) => {
    e.preventDefault();
    if (images.length === 0) return;
    setProcessing(true);
    setStatusMsg(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const A4_WIDTH = 595.28;
      const A4_HEIGHT = 841.89;
      const MARGIN = 30;

      for (const file of images) {
        const buffer = await file.arrayBuffer();
        const img =
          file.type === 'image/png'
            ? await pdfDoc.embedPng(buffer)
            : await pdfDoc.embedJpg(buffer);

        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        const maxW = A4_WIDTH - MARGIN * 2;
        const maxH = A4_HEIGHT - MARGIN * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height);

        const drawW = img.width * scale;
        const drawH = img.height * scale;

        page.drawImage(img, {
          x: (A4_WIDTH - drawW) / 2,
          y: (A4_HEIGHT - drawH) / 2,
          width: drawW,
          height: drawH,
        });
      }

      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, 'DOCUMENTOS_ORDENADOS_A4.pdf');
    } catch (err) {
      setStatusMsg('Error: Verifica que todas las fotos sean JPG o PNG.');
    }
    setProcessing(false);
  };

  // Procesa imagen en Blanco y Negro (Fotocopia) o Color nítido
  const processCardImageBytes = (file, mode) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        if (mode === 'bw') {
          ctx.filter = 'grayscale(100%) contrast(125%) brightness(105%)';
        } else {
          ctx.filter = 'contrast(104%) saturate(105%)';
        }
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(
          async (blob) => {
            if (!blob) return reject(new Error('Error al procesar imagen'));
            const buffer = await blob.arrayBuffer();
            resolve({ buffer, width: img.width, height: img.height });
          },
          'image/jpeg',
          0.92
        );
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Lógica 3: DNI o Documentos en 1 sola hoja A4 (A Color o Blanco y Negro)
  const handlePhotocopyMode = async (e) => {
    e.preventDefault();
    if (copyImages.length === 0) return;
    setProcessing(true);
    setStatusMsg(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const A4_WIDTH = 595.28;
      const A4_HEIGHT = 841.89;
      const MARGIN = 40;

      if (copyImages.length <= 2) {
        const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
        const slotHeight = (A4_HEIGHT - MARGIN * 3) / 2;
        const maxW = A4_WIDTH - MARGIN * 2;

        for (let i = 0; i < copyImages.length; i++) {
          const { buffer, width, height } = await processCardImageBytes(copyImages[i], copyColorMode);
          const embeddedImg = await pdfDoc.embedJpg(buffer);
          const scale = Math.min(maxW / width, slotHeight / height);
          const drawW = width * scale;
          const drawH = height * scale;

          const yPos =
            i === 0
              ? A4_HEIGHT - MARGIN - drawH
              : A4_HEIGHT - MARGIN * 2 - slotHeight - drawH;

          page.drawImage(embeddedImg, {
            x: (A4_WIDTH - drawW) / 2,
            y: yPos,
            width: drawW,
            height: drawH,
          });
        }
      } else {
        for (const file of copyImages) {
          const { buffer, width, height } = await processCardImageBytes(file, copyColorMode);
          const embeddedImg = await pdfDoc.embedJpg(buffer);
          const page = pdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          const maxW = A4_WIDTH - MARGIN * 2;
          const maxH = A4_HEIGHT - MARGIN * 2;
          const scale = Math.min(maxW / width, maxH / height);
          const drawW = width * scale;
          const drawH = height * scale;

          page.drawImage(embeddedImg, {
            x: (A4_WIDTH - drawW) / 2,
            y: (A4_HEIGHT - drawH) / 2,
            width: drawW,
            height: drawH,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const fileName = copyColorMode === 'color' ? 'DNI_A_COLOR_A4.pdf' : 'FOTOCOPIA_BN_A4.pdf';
      triggerDownload(pdfBytes, fileName);
    } catch (err) {
      setStatusMsg('Error: Asegúrate de subir fotos JPG o PNG válidas.');
    }
    setProcessing(false);
  };

  const tools = [
    {
      id: 'watermark',
      badge: 'EVITA ESTAFAS',
      title: '1. Proteger mi DNI o Recibo',
      desc: 'Coloca letras rojas encima de tu documento antes de enviarlo por WhatsApp o correo para que nadie lo use sin tu permiso.',
      bullets: [
        'Ideal si te piden foto de tu DNI para un trámite o alquiler.',
        'Evita que suplanten tu identidad o pidan préstamos a tu nombre.',
        'Acepta fotos de celular (JPG/PNG) o archivos PDF.',
      ],
      icon: <ShieldCheck size={34} className="text-[#E5322D]" />,
      accept: 'image/png, image/jpeg, application/pdf',
      multiple: false,
      btnText: 'Elegir foto de mi DNI o PDF',
    },
    {
      id: 'img2pdf',
      badge: 'ORDENA TUS FOTOS',
      title: '2. Juntar varias fotos en 1 PDF',
      desc: 'Convierte tus fotos sueltas o capturas en un solo PDF A4. El orden en que selecciones tus imágenes será el orden exacto en el que aparecerá cada hoja (Foto 1 = Hoja 1, Foto 2 = Hoja 2).',
      bullets: [
        'Tú decides el orden: la 1ra foto elegida va en la Hoja 1, la 2da en la Hoja 2, etc.',
        'Junta recibos de luz, agua, vouchers de pago, tareas o boletas.',
        'Las fotos se acomodan solas en tamaño A4 sin recortarse.',
      ],
      icon: <FileImage size={34} className="text-amber-500" />,
      accept: 'image/png, image/jpeg',
      multiple: true,
      btnText: 'Elegir mis fotos en orden',
    },
    {
      id: 'photocopy',
      badge: 'COLOR O B/N',
      title: '3. DNI y Documentos en 1 Hoja (Color o B/N)',
      desc: 'Une la cara delantera y posterior de tu DNI en una sola hoja A4 lista para imprimir o enviar, en color original o modo fotocopia blanco y negro.',
      bullets: [
        'Sube las 2 caras de tu DNI y las acomoda juntas en 1 sola hoja A4.',
        'Elige entre mantener el color original o convertir a fotocopia blanco y negro.',
        'Perfecto para notarías, bancos, municipios o trámites virtuales.',
      ],
      icon: <Printer size={34} className="text-slate-700" />,
      accept: 'image/png, image/jpeg',
      multiple: true,
      btnText: 'Subir 2 fotos del DNI (adelante y atrás)',
    },
  ];

  const activeToolObj = tools.find((t) => t.id === selectedTool);

  // Vista previa visual en la columna derecha (misma estructura y tipografía que ExpressWord)
  const renderResultExample = () => {
    if (selectedTool === 'watermark') {
      const previewStamp = (wmText.trim().toUpperCase() || 'SOLO PARA TRÁMITE').slice(0, 34);
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-600 truncate">DNI_Foto.jpg</span>
            <ArrowRight size={14} className="text-[#E5322D] shrink-0 mx-2" />
            <span className="font-bold text-[#E5322D] flex items-center gap-1 shrink-0">
              <ShieldCheck size={14} /> PROTEGIDO.pdf
            </span>
          </div>

          {/* Simulación visual de documento protegido con sello diagonal */}
          <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-gradient-to-br from-sky-50 via-white to-slate-100 p-4 shadow-2xs select-none">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
              <span className="text-[10px] font-bold tracking-wider uppercase text-sky-900">
                DOCUMENTO NACIONAL DE IDENTIDAD
              </span>
              <span className="text-[10px] font-bold text-slate-500">N° 00000000</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-14 rounded-md bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-semibold text-slate-500 shrink-0">
                FOTO
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="h-2.5 w-3/4 bg-slate-300 rounded-xs" />
                <div className="h-2 w-1/2 bg-slate-200 rounded-xs" />
                <div className="h-2 w-2/3 bg-slate-200 rounded-xs" />
              </div>
            </div>

            {/* Líneas diagonales de marca de agua en tiempo real */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-around items-center -rotate-12 opacity-80">
              <span className="text-[10px] font-extrabold text-[#E5322D] tracking-wide whitespace-nowrap">
                {previewStamp}
              </span>
              <span className="text-[10px] font-extrabold text-[#E5322D] tracking-wide whitespace-nowrap">
                {previewStamp}
              </span>
              <span className="text-[10px] font-extrabold text-[#E5322D] tracking-wide whitespace-nowrap">
                {previewStamp}
              </span>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Tu documento queda bloqueado con líneas rojas diagonales para que no puedan reutilizarlo en otros trámites.
          </p>
        </div>
      );
    }

    if (selectedTool === 'img2pdf') {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200">
            <span className="font-semibold text-slate-600 truncate">3 fotos elegidas</span>
            <ArrowRight size={14} className="text-amber-600 shrink-0 mx-2" />
            <span className="font-bold text-slate-900 flex items-center gap-1 shrink-0">
              <FileText size={14} className="text-[#E5322D]" /> ORDENADOS_A4.pdf
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { page: 'Hoja 1', label: 'Recibo Luz' },
              { page: 'Hoja 2', label: 'Voucher Yape' },
              { page: 'Hoja 3', label: 'Constancia' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-center space-y-1.5"
              >
                <span className="inline-block text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {item.page}
                </span>
                <div className="h-14 rounded-lg bg-white border border-dashed border-slate-300 flex items-center justify-center">
                  <FileImage size={18} className="text-amber-500" />
                </div>
                <p className="text-[10px] font-semibold text-slate-600 truncate">{item.label}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-slate-500 leading-relaxed">
            Cada foto se ajusta automáticamente al centro de una hoja tamaño A4 sin recortar bordes.
          </p>
        </div>
      );
    }

    const isBw = copyColorMode === 'bw';
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs bg-slate-100 px-3.5 py-2.5 rounded-xl border border-slate-200">
          <span className="font-semibold text-slate-600 truncate">2 caras DNI</span>
          <ArrowRight size={14} className="text-slate-900 shrink-0 mx-2" />
          <span className="font-bold text-slate-950 flex items-center gap-1 shrink-0">
            <Printer size={14} className="text-[#E5322D]" /> 1 Hoja A4
          </span>
        </div>

        {/* Simulación de Hoja A4 con ambas caras del DNI (cambia según Color o B/N) */}
        <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-3 shadow-2xs max-w-[230px] mx-auto">
          <div
            className={`rounded-lg border p-2.5 transition ${
              isBw
                ? 'bg-slate-100 border-slate-400 grayscale'
                : 'bg-sky-50 border-sky-300'
            }`}
          >
            <p className="text-[9px] font-bold uppercase text-slate-700 mb-1.5">
              Cara Delantera (Anverso)
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-9 rounded-xs ${
                  isBw ? 'bg-slate-400' : 'bg-sky-300'
                }`}
              />
              <div className="space-y-1 flex-1">
                <div className="h-1.5 w-4/5 bg-slate-400 rounded-xs" />
                <div className="h-1.5 w-3/5 bg-slate-300 rounded-xs" />
              </div>
            </div>
          </div>

          <div
            className={`rounded-lg border p-2.5 transition ${
              isBw
                ? 'bg-slate-100 border-slate-400 grayscale'
                : 'bg-amber-50/70 border-amber-300'
            }`}
          >
            <p className="text-[9px] font-bold uppercase text-slate-700 mb-1.5">
              Cara Posterior (Reverso)
            </p>
            <div className="space-y-1.5">
              <div className="h-1.5 w-full bg-slate-300 rounded-xs" />
              <div className="h-1.5 w-2/3 bg-slate-300 rounded-xs" />
              <div className="h-3 w-full bg-slate-400/60 rounded-xs mt-1" />
            </div>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-relaxed">
          Ambas caras quedan centradas en una sola hoja A4 en acabado{' '}
          <strong className="text-slate-700">
            {isBw ? 'Blanco y Negro tipo fotocopia' : 'a Color original'}
          </strong>
          .
        </p>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F5F5FA] text-slate-800 flex flex-col justify-between font-sans">
      {/* Barra Superior Corporativa con Sello DevStore */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => resetStates(null)}
              className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
            >
              <span className="text-2xl font-black tracking-tight text-slate-900">
                Trámite<span className="text-[#E5322D]">PDF</span>
              </span>
            </button>

            <span className="hidden sm:inline-block h-4 w-px bg-slate-200" />

            <a
              href={DEVSTORE_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-950 transition"
            >
              <span>Un producto de</span>
              <span className="inline-flex items-center gap-1 font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded-md transition">
                <span className="w-3.5 h-3.5 rounded-xs bg-slate-950 text-white text-[9px] font-bold flex items-center justify-center">
                  DS
                </span>
                DevStore
              </span>
            </a>
          </div>

          <div className="flex items-center gap-2.5">
            <a
              href={DEVSTORE_URL}
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 px-3.5 py-2 rounded-lg border border-slate-200 hover:border-slate-400 bg-white transition"
            >
              <span>Más herramientas</span>
              <ArrowUpRight size={14} />
            </a>

            <button
              onClick={() => setShowDonateModal(true)}
              className="bg-slate-950 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-xs cursor-pointer"
            >
              <Heart size={14} className="text-white fill-white" />
              <span>Respaldar proyecto</span>
            </button>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10">
        {!selectedTool ? (
          <div className="max-w-6xl w-full text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mb-3">
              Arregla tus documentos para trámites en 30 segundos
            </h1>
            <p className="text-slate-600 text-base sm:text-lg max-w-2xl mx-auto mb-6">
              Fácil de usar, 100% gratis, sin registrarte y sin salir de casa.
            </p>

            {/* Guía visual de 3 pasos */}
            <div className="inline-flex flex-wrap items-center justify-center gap-2 sm:gap-4 bg-white px-5 py-2.5 rounded-full border border-slate-200 text-xs sm:text-sm font-medium text-slate-700 mb-10 shadow-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                Elige una opción abajo
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                Sube tu foto o PDF
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">
                  3
                </span>
                Descarga tu archivo listo
              </span>
            </div>

            {/* Tarjetas de Herramientas */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
              {tools.map((tool) => (
                <div
                  key={tool.id}
                  onClick={() => resetStates(tool.id)}
                  className="bg-white p-7 rounded-2xl shadow-sm hover:shadow-md border-2 border-slate-200/70 hover:border-[#E5322D] transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 rounded-xl bg-slate-50 group-hover:scale-105 transition">
                        {tool.icon}
                      </div>
                      <span className="text-[11px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-slate-100 text-slate-600">
                        {tool.badge}
                      </span>
                    </div>

                    <h2 className="text-xl font-extrabold text-slate-900 mb-2 group-hover:text-[#E5322D] transition">
                      {tool.title}
                    </h2>

                    <p className="text-sm text-slate-600 leading-relaxed mb-5">{tool.desc}</p>

                    <div className="border-t border-slate-100 pt-4 mb-6 space-y-2.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        ¿Para qué te sirve?
                      </p>
                      {tool.bullets.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 leading-snug">
                          <Check size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="w-full py-3 px-4 rounded-xl bg-red-50 group-hover:bg-[#E5322D] text-[#E5322D] group-hover:text-white font-bold text-sm flex items-center justify-center gap-2 transition">
                    <span>Entrar a esta opción</span>
                    <ArrowRight size={16} />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 text-xs text-slate-600 shadow-xs">
              <Lock size={14} className="text-emerald-600 shrink-0" />
              <span>
                <strong>Seguridad total:</strong> Nadie ve tus documentos. Todo se procesa dentro de tu propio celular o computadora.
              </span>
            </div>
          </div>
        ) : (
          /* PANTALLA DE ACCIÓN DIRECTA CON EJEMPLO DEL RESULTADO AL LADO */
          <div className="max-w-5xl w-full">
            <div className="mb-6 flex justify-center">
              <button
                type="button"
                onClick={() => resetStates(null)}
                className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-800 bg-white hover:bg-slate-950 hover:text-white border-2 border-slate-300 hover:border-slate-950 px-5 py-2.5 rounded-xl shadow-xs transition cursor-pointer"
              >
                <ArrowLeft size={16} />
                <span>Volver y elegir otra opción</span>
              </button>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{activeToolObj.title}</h1>
              <p className="text-slate-600 text-base max-w-2xl mx-auto leading-relaxed">
                {activeToolObj.desc}
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              {/* Columna Izquierda: Acción de subida y descarga */}
              <div className="lg:col-span-7 bg-white p-7 sm:p-9 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={activeToolObj.accept}
                  multiple={activeToolObj.multiple}
                  className="hidden"
                  onChange={(e) => {
                    if (selectedTool === 'watermark') setWmFile(e.target.files[0]);
                    if (selectedTool === 'img2pdf') setImages(Array.from(e.target.files));
                    if (selectedTool === 'photocopy') setCopyImages(Array.from(e.target.files));
                    setStatusMsg(null);
                  }}
                />

                {(selectedTool === 'watermark' && !wmFile) ||
                (selectedTool === 'img2pdf' && images.length === 0) ||
                (selectedTool === 'photocopy' && copyImages.length === 0) ? (
                  <div className="py-6 text-center">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current.click()}
                      className="w-full sm:w-auto bg-[#E5322D] hover:bg-[#c92622] text-white font-bold text-base sm:text-lg px-7 py-5 rounded-xl shadow-lg shadow-red-500/20 inline-flex items-center justify-center gap-3 transition transform hover:-translate-y-0.5 cursor-pointer"
                    >
                      <Upload size={24} className="shrink-0" />
                      <span>{activeToolObj.btnText}</span>
                    </button>
                    <p className="text-xs text-slate-500 mt-4">
                      Paso 1 de 2: Busca tu foto o archivo en tu galería o carpeta
                    </p>
                  </div>
                ) : (
                  <form
                    onSubmit={
                      selectedTool === 'watermark'
                        ? handleWatermark
                        : selectedTool === 'img2pdf'
                        ? handleImagesToPdf
                        : handlePhotocopyMode
                    }
                    className="space-y-6 text-left"
                  >
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <FileText className="text-[#E5322D] shrink-0" size={24} />
                        <div className="truncate">
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {selectedTool === 'watermark' && wmFile?.name}
                            {selectedTool === 'img2pdf' && `${images.length} foto(s) seleccionada(s)`}
                            {selectedTool === 'photocopy' &&
                              `${copyImages.length} foto(s) lista(s) para 1 hoja A4`}
                          </p>
                          <p className="text-xs text-emerald-600 font-medium">
                            ✓ Archivo cargado correctamente
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current.click()}
                        className="text-xs font-semibold text-[#E5322D] hover:underline shrink-0 ml-2 cursor-pointer"
                      >
                        Cambiar archivo
                      </button>
                    </div>

                    {/* Lista del orden de hojas en Opción 2 */}
                    {selectedTool === 'img2pdf' && images.length > 0 && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                          Orden confirmado en tu PDF:
                        </p>
                        <div className="max-h-32 overflow-y-auto space-y-1 pr-1">
                          {images.map((img, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between text-xs bg-white px-3 py-1.5 rounded-lg border border-slate-200/80"
                            >
                              <span className="font-bold text-slate-900">Hoja {i + 1}</span>
                              <span className="text-slate-600 truncate max-w-[230px]">{img.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedTool === 'watermark' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                          Escribe el texto rojo que irá encima de tu documento
                        </label>
                        <input
                          type="text"
                          value={wmText}
                          onChange={(e) => setWmText(e.target.value)}
                          className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-[#E5322D]"
                          required
                        />
                      </div>
                    )}

                    {/* Selector Color vs Blanco y Negro en Opción 3 */}
                    {selectedTool === 'photocopy' && (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                          Elige el acabado de tu hoja A4:
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setCopyColorMode('bw')}
                            className={`py-3 px-4 rounded-xl border-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                              copyColorMode === 'bw'
                                ? 'border-slate-950 bg-slate-950 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            Blanco y Negro (Fotocopia)
                          </button>
                          <button
                            type="button"
                            onClick={() => setCopyColorMode('color')}
                            className={`py-3 px-4 rounded-xl border-2 text-xs sm:text-sm font-bold transition cursor-pointer ${
                              copyColorMode === 'color'
                                ? 'border-[#E5322D] bg-[#E5322D] text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                            }`}
                          >
                            A Color Original
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={processing}
                      className="w-full bg-[#E5322D] hover:bg-[#c92622] text-white font-bold text-lg py-4 rounded-xl shadow-md transition cursor-pointer"
                    >
                      {processing ? 'Preparando tu PDF...' : 'Paso 2 de 2: Descargar PDF Listo'}
                    </button>
                  </form>
                )}

                {statusMsg && (
                  <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col gap-3 text-left">
                    <div className="flex items-center gap-2.5 text-sm text-emerald-800 font-medium">
                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                      <span>{statusMsg}</span>
                    </div>
                    <button
                      onClick={() => setShowDonateModal(true)}
                      className="self-start text-xs font-bold bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-3.5 py-2 rounded-lg shadow-xs transition cursor-pointer"
                    >
                      Apóyanos para seguir mejorando la plataforma ❤️
                    </button>
                  </div>
                )}
              </div>

              {/* Columna Derecha: Ejemplo visual de cómo queda el resultado */}
              <div className="lg:col-span-5 bg-white p-6 sm:p-7 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between text-left">
                <div>
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                    <div className="w-7 h-7 rounded-lg bg-slate-950 text-white flex items-center justify-center">
                      <Eye size={14} />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">
                        Ejemplo del resultado
                      </p>
                      <p className="text-[11px] text-slate-500">Así se entregará tu archivo al descargar</p>
                    </div>
                  </div>

                  {renderResultExample()}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modal Ejecutivo de Respaldo */}
      {showDonateModal && (
        <div className="fixed inset-0 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 text-center space-y-5 shadow-2xl border border-slate-200 relative">
            <button
              onClick={() => setShowDonateModal(false)}
              aria-label="Cerrar modal"
              className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"
            >
              <X size={16} />
            </button>

            <div className="space-y-1.5 pt-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 text-white text-[11px] font-semibold tracking-wider">
                <Heart size={11} className="fill-white" />
                <span>SOSTENIBILIDAD · DEVSTORE</span>
              </div>
              <h3 className="text-xl font-extrabold text-slate-950 tracking-tight">
                Respalda el desarrollo independiente
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Mantenemos TrámitePDF 100% gratuito y libre de publicidad invasiva. Tu aporte voluntario impulsa nuevas herramientas digitales.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setDonateTab('peru')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  donateTab === 'peru'
                    ? 'bg-slate-950 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Perú · Yape / Plin
              </button>
              <button
                type="button"
                onClick={() => setDonateTab('intl')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition cursor-pointer ${
                  donateTab === 'intl'
                    ? 'bg-slate-950 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                Internacional · PayPal
              </button>
            </div>

            {donateTab === 'peru' ? (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Escanea con Yape o Plin
                </p>
                <img
                  src="/qr-yape.jpeg"
                  alt="QR Yape"
                  className="w-44 h-44 mx-auto rounded-xl object-contain bg-white p-2 border border-slate-200 shadow-2xs"
                />
                <p className="text-[11px] text-slate-500">
                  Aporte directo sin comisiones · Desde S/ 1.00
                </p>
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Escanea o usa enlace directo (USD)
                </p>
                <img
                  src="/paypal-qr.png"
                  alt="QR PayPal"
                  className="w-44 h-44 mx-auto rounded-xl object-contain bg-white p-2 border border-slate-200 shadow-2xs"
                />
                <a
                  href={PAYPAL_DONATE_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full bg-slate-950 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-1.5 transition"
                >
                  <span>Continuar en PayPal (Tarjeta o Saldo)</span>
                  <ArrowUpRight size={14} />
                </a>
              </div>
            )}

            <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-xs">
              <a
                href={DEVSTORE_URL}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-slate-600 hover:text-slate-950 inline-flex items-center gap-1 transition"
              >
                <span>Conoce más proyectos en DevStore</span>
                <ArrowUpRight size={13} />
              </a>
              <button
                onClick={() => setShowDonateModal(false)}
                className="font-bold text-slate-950 hover:underline cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Corporativo */}
      <footer className="bg-white border-t border-slate-200 py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© 2026 TrámitePDF · Procesamiento 100% local en tu navegador.</p>
          <a
            href={DEVSTORE_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 hover:text-slate-950 transition"
          >
            <span>Desarrollado por DevStore</span>
            <ArrowUpRight size={13} />
          </a>
        </div>
      </footer>
    </div>
  );
}
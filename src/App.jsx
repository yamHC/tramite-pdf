import React, { useState, useRef } from 'react';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { ShieldCheck, FileImage, Printer, Heart, Upload, CheckCircle2, Lock, ArrowLeft, FileText, ArrowRight, Check } from 'lucide-react';

export default function App() {
  const [selectedTool, setSelectedTool] = useState(null);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const fileInputRef = useRef(null);

  // Herramienta 1: Sello de Agua Anti-Fraude
  const [wmFile, setWmFile] = useState(null);
  const [wmText, setWmText] = useState('SOLO PARA TRÁMITE - NO VÁLIDO PARA CRÉDITOS');

  // Herramienta 2: Fotos a PDF A4
  const [images, setImages] = useState([]);

  // Herramienta 3: Modo Fotocopia (Blanco y Negro / Escala de Grises)
  const [copyImages, setCopyImages] = useState([]);

  const resetStates = (tool) => {
    setSelectedTool(tool);
    setWmFile(null);
    setImages([]);
    setCopyImages([]);
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
    setStatusMsg('¡Listo! Tu documento PDF ya se descargó en tu celular o computadora.');
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
        const img = wmFile.type === 'image/png'
          ? await pdfDoc.embedPng(arrayBuffer)
          : await pdfDoc.embedJpg(arrayBuffer);
        const page = pdfDoc.addPage([img.width, img.height]);
        page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      }

      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const pages = pdfDoc.getPages();

      pages.forEach((page) => {
        const { width, height } = page.getSize();
        const fontSize = Math.max(14, width / 28);

        for (let y = height * 0.2; y < height * 0.9; y += height * 0.3) {
          page.drawText(wmText.toUpperCase(), {
            x: width * 0.1,
            y: y,
            size: fontSize,
            font: font,
            color: rgb(0.85, 0.1, 0.1),
            opacity: 0.35,
            rotate: degrees(25),
          });
        }
      });

      const pdfBytes = await pdfDoc.save();
      triggerDownload(pdfBytes, `PROTEGIDO_${wmFile.name.split('.')[0]}.pdf`);
    } catch (err) {
      setStatusMsg('Error: Asegúrate de subir una foto (JPG/PNG) o un archivo PDF válido.');
    }
    setProcessing(false);
  };

  // Lógica 2: Unir fotos a color en PDF A4
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
        const img = file.type === 'image/png'
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

  // Conversión a escala de grises tipo fotocopia nítida
  const convertImageToGrayscaleBytes = (file) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        ctx.filter = 'grayscale(100%) contrast(125%) brightness(105%)';
        ctx.drawImage(img, 0, 0);

        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('Error al procesar imagen'));
          const buffer = await blob.arrayBuffer();
          resolve({ buffer, width: img.width, height: img.height });
        }, 'image/jpeg', 0.9);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  // Lógica 3: Modo Fotocopia (DNI o documentos a blanco y negro en hoja A4)
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
          const { buffer, width, height } = await convertImageToGrayscaleBytes(copyImages[i]);
          const embeddedImg = await pdfDoc.embedJpg(buffer);
          const scale = Math.min(maxW / width, slotHeight / height);
          const drawW = width * scale;
          const drawH = height * scale;

          const yPos = i === 0
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
          const { buffer, width, height } = await convertImageToGrayscaleBytes(file);
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
      triggerDownload(pdfBytes, 'FOTOCOPIA_BN_A4.pdf');
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
      btnText: 'Haz clic aquí para elegir la foto de tu DNI o PDF',
    },
    {
      id: 'img2pdf',
      badge: 'ORDENA TUS FOTOS',
      title: '2. Juntar varias fotos en 1 PDF',
      desc: 'Convierte tus fotos sueltas o capturas de pantalla en un solo archivo PDF ordenado, tamaño hoja A4 y listo para enviar.',
      bullets: [
        'Junta recibos de luz, agua, vouchers de pago o boletas.',
        'Ordena tareas, contratos o evidencias en un único archivo.',
        'Las fotos se acomodan solas sin recortarse ni verse borrosas.',
      ],
      icon: <FileImage size={34} className="text-amber-500" />,
      accept: 'image/png, image/jpeg',
      multiple: true,
      btnText: 'Haz clic aquí para seleccionar una o varias fotos',
    },
    {
      id: 'photocopy',
      badge: 'COMO DE LIBRERÍA',
      title: '3. Modo Fotocopia (Blanco y Negro)',
      desc: 'Transforma las fotos a color de tu celular en una fotocopia nítida en blanco y negro lista para imprimir o presentar.',
      bullets: [
        'Sube las 2 caras de tu DNI y las pone juntas en 1 sola hoja A4.',
        'Aclara el fondo oscuro de las fotos tomadas con celular.',
        'Perfecto para notarías, bancos, municipios o trabajos.',
      ],
      icon: <Printer size={34} className="text-slate-700" />,
      accept: 'image/png, image/jpeg',
      multiple: true,
      btnText: 'Sube las 2 fotos de tu DNI (adelante y atrás) o recibos',
    },
  ];

  const activeToolObj = tools.find((t) => t.id === selectedTool);

  return (
    <div className="min-h-screen bg-[#F5F5FA] text-slate-800 flex flex-col justify-between font-sans">
      {/* Barra Superior */}
      <header className="bg-white shadow-sm sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <button
            onClick={() => resetStates(null)}
            className="flex items-center gap-2 text-left focus:outline-none cursor-pointer"
          >
            <span className="text-2xl font-black tracking-tight text-slate-900">
              Trámite<span className="text-[#E5322D]">PDF</span>
            </span>
          </button>

          <button
            onClick={() => setShowDonateModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
          >
            <Heart size={15} className="text-[#E5322D] fill-[#E5322D]" /> Apóyanos para mejorar
          </button>
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
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">1</span>
                Elige una opción abajo
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">2</span>
                Sube tu foto o PDF
              </span>
              <span className="text-slate-300">•</span>
              <span className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-[#E5322D] text-white text-xs flex items-center justify-center font-bold">3</span>
                Descarga tu archivo listo
              </span>
            </div>

            {/* Tarjetas de Herramientas Detalladas y Ordenadas */}
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

                    <p className="text-sm text-slate-600 leading-relaxed mb-5">
                      {tool.desc}
                    </p>

                    <div className="border-t border-slate-100 pt-4 mb-6 space-y-2.5">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">¿Para qué te sirve?</p>
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
              <span><strong>Seguridad total:</strong> Nadie ve tus documentos. Todo se procesa dentro de tu propio celular o computadora.</span>
            </div>
          </div>
        ) : (
          /* PANTALLA DE ACCIÓN DIRECTA */
          <div className="max-w-2xl w-full text-center">
            <button
              onClick={() => resetStates(null)}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900 mb-6 transition cursor-pointer"
            >
              <ArrowLeft size={16} /> Volver y elegir otra opción
            </button>

            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">{activeToolObj.title}</h1>
            <p className="text-slate-600 text-base mb-8">{activeToolObj.desc}</p>

            <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-sm border border-slate-200">
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

              {((selectedTool === 'watermark' && !wmFile) ||
                (selectedTool === 'img2pdf' && images.length === 0) ||
                (selectedTool === 'photocopy' && copyImages.length === 0)) ? (
                <div className="py-6">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current.click()}
                    className="bg-[#E5322D] hover:bg-[#c92622] text-white font-bold text-base sm:text-lg px-7 py-5 rounded-xl shadow-lg shadow-red-500/20 inline-flex items-center gap-3 transition transform hover:-translate-y-0.5 cursor-pointer"
                  >
                    <Upload size={24} className="shrink-0" />
                    <span>{activeToolObj.btnText}</span>
                  </button>
                  <p className="text-xs text-slate-500 mt-4">Paso 1 de 2: Busca tu foto o archivo en tu galería o carpeta</p>
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
                          {selectedTool === 'photocopy' && `${copyImages.length} foto(s) lista(s) para fotocopia B/N`}
                        </p>
                        <p className="text-xs text-emerald-600 font-medium">✓ Archivo cargado correctamente</p>
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

                  {selectedTool === 'watermark' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                        Escribe el texto que irá encima de tu documento
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
                <div className="mt-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-left">
                  <div className="flex items-center gap-2.5 text-sm text-emerald-800 font-medium">
                    <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                    <span>{statusMsg}</span>
                  </div>
                  <button
                    onClick={() => setShowDonateModal(true)}
                    className="text-xs font-bold bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 px-3 py-2 rounded-lg shadow-xs whitespace-nowrap transition cursor-pointer"
                  >
                    Apóyanos para mejorar la página ❤️
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Modal de Apoyo (Solo Yape) */}
      {showDonateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100">
            <div className="w-12 h-12 bg-red-50 text-[#E5322D] rounded-full flex items-center justify-center mx-auto">
              <Heart size={24} className="fill-[#E5322D]" />
            </div>
            <h3 className="text-xl font-extrabold text-slate-900">Apóyanos para seguir mejorando la página</h3>
            <p className="text-sm text-slate-600">
              Esta herramienta es 100% gratuita y sin publicidad invasiva. Si te salvó el trámite hoy, puedes dejar un aporte voluntario desde S/ 1 o S/ 2.
            </p>

            <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-5 space-y-3">
              <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Escanea con Yape o Plin</p>
              <img src="/qr-yape.jpeg" alt="QR Yape" className="w-48 h-48 mx-auto rounded-xl object-contain bg-white p-2 border border-purple-200 shadow-xs" />
            </div>

            <button
              onClick={() => setShowDonateModal(false)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 rounded-xl text-sm transition cursor-pointer"
            >
              Cerrar ventana
            </button>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 py-5 text-center text-xs text-slate-500">
        © 2026 TrámitePDF · Procesamiento local seguro en tu navegador.
      </footer>
    </div>
  );
}
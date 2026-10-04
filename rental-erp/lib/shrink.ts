// 큰 파일을 브라우저에서 줄여서 올린다 (서버가 한 번에 받을 수 있는 크기는 Vercel 제한으로 약 4.5MB).
// - 사진(JPG/PNG/WEBP): 긴 변을 줄이고 JPEG 로 다시 저장
// - PDF: 각 쪽을 그림으로 그린 뒤 JPEG 로 압축해 새 PDF 로 묶는다 (스캔 계약서용)
// 브라우저 전용 (pdf.js 는 필요할 때만 불러옴)
import { MAX_SOURCE_BYTES, MAX_UPLOAD_BYTES } from "@/lib/constants";

export type ShrinkResult = { file: File; note: string | null };

const TARGET = MAX_UPLOAD_BYTES - 200 * 1024; // 여유
const MAX_PAGES = 50;

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(n >= 100 * 1024 * 1024 ? 0 : 1)}MB`;

function baseName(name: string) {
  return name.replace(/\.[^.]+$/, "") || "file";
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("이미지 변환 실패"))), "image/jpeg", quality),
  );
}

async function shrinkImage(file: File): Promise<File> {
  const bmp = await createImageBitmap(file);
  try {
    for (const [side, q] of [
      [2400, 0.85],
      [2000, 0.75],
      [1600, 0.7],
      [1200, 0.6],
    ] as const) {
      const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bmp.width * scale);
      canvas.height = Math.round(bmp.height * scale);
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToJpeg(canvas, q);
      if (blob.size <= TARGET) return new File([blob], `${baseName(file.name)}.jpg`, { type: "image/jpeg" });
    }
  } finally {
    bmp.close();
  }
  throw new Error("사진을 충분히 줄이지 못했습니다.");
}

async function shrinkPdf(file: File, onProgress?: (msg: string) => void): Promise<{ file: File; pages: number; total: number }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerPort ??= new Worker(new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url), { type: "module" });
  const { PDFDocument } = await import("pdf-lib");

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const src = await task.promise;
  try {
    const total = src.numPages;
    let pages = Math.min(total, MAX_PAGES);
    // 쪽 수가 많을수록 쪽당 크기를 작게
    const tries: [number, number][] = [
      [1700, 0.72],
      [1400, 0.6],
      [1100, 0.5],
      [900, 0.45],
    ];
    for (let t = 0; t < tries.length + 2; t++) {
      const [width, q] = tries[Math.min(t, tries.length - 1)];
      if (t >= tries.length) pages = Math.max(1, Math.floor(pages / 2)); // 그래도 크면 앞쪽만
      const out = await PDFDocument.create();
      for (let i = 1; i <= pages; i++) {
        onProgress?.(`큰 파일을 줄이는 중... (${i}/${pages}쪽)`);
        const page = await src.getPage(i);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await page.render({ canvas, canvasContext: canvas.getContext("2d")!, viewport }).promise;
        const jpg = await out.embedJpg(new Uint8Array(await (await canvasToJpeg(canvas, q)).arrayBuffer()));
        out.addPage([base.width, base.height]).drawImage(jpg, { x: 0, y: 0, width: base.width, height: base.height });
        page.cleanup();
        canvas.width = canvas.height = 0;
      }
      const bytes = await out.save();
      if (bytes.length <= TARGET) {
        return { file: new File([bytes as BlobPart], `${baseName(file.name)}.pdf`, { type: "application/pdf" }), pages, total };
      }
    }
  } finally {
    await task.destroy();
  }
  throw new Error("PDF 를 충분히 줄이지 못했습니다.");
}

/**
 * 올릴 파일 준비: 4MB 이하면 그대로, 크면 자동 압축. 최대 1GB 까지 받는다.
 * note 는 화면에 보여줄 안내 (압축했을 때만).
 */
export async function prepareUpload(file: File, onProgress?: (msg: string) => void): Promise<ShrinkResult> {
  if (file.size > MAX_SOURCE_BYTES) throw new Error(`파일이 너무 큽니다 (${mb(file.size)}). 1GB 이하만 올릴 수 있습니다.`);
  if (file.size <= MAX_UPLOAD_BYTES) return { file, note: null };
  const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const isImage = /^image\/(jpeg|png|webp)$/.test(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
  if (!isPdf && !isImage) throw new Error("PDF, JPG, PNG 파일만 올릴 수 있습니다.");
  onProgress?.(`큰 파일(${mb(file.size)})을 올리기 좋게 줄이는 중...`);
  try {
    if (isImage) {
      const f = await shrinkImage(file);
      return { file: f, note: `사진을 ${mb(file.size)} → ${mb(f.size)}로 줄여서 올렸습니다.` };
    }
    const r = await shrinkPdf(file, onProgress);
    return {
      file: r.file,
      note: `PDF 를 ${mb(file.size)} → ${mb(r.file.size)}로 줄여서 올렸습니다.${r.pages < r.total ? ` (전체 ${r.total}쪽 중 앞 ${r.pages}쪽만)` : ""}`,
    };
  } catch (e) {
    throw new Error(`파일을 줄이지 못했습니다: ${e instanceof Error ? e.message : String(e)} — 스캔 해상도를 낮추거나 필요한 쪽만 따로 저장해 올려 주세요.`);
  }
}

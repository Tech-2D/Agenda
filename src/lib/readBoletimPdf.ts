import { BoletimError, parseBoletim, type Boletim, type TextItem } from "./boletim";

/** Lê o PDF do boletim no próprio navegador (nada é enviado para fora) e devolve as notas. */
export async function readBoletimPdf(file: File): Promise<Boletim> {
  // O PDF.js é grande: só é baixado quando alguém importa um boletim.
  const [pdfjs, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let doc;
  try {
    doc = await task.promise;
  } catch {
    throw new BoletimError("Não foi possível abrir o arquivo. Confira se é o PDF do boletim.");
  }

  try {
    const items: TextItem[] = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      for (const it of content.items) {
        if ("str" in it) items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, page: p });
      }
    }
    return parseBoletim(items);
  } finally {
    void task.destroy();
  }
}

export async function extractResumeText(file) {
  if (!file) {
    return "";
  }
  const name = file.name?.toLowerCase() || "";
  const type = file.type || "";

  if (type === "application/pdf" || name.endsWith(".pdf")) {
    const arrayBuffer = await file.arrayBuffer();
    return extractPdfText(arrayBuffer);
  }
  if (type.startsWith("text/") || name.endsWith(".md") || name.endsWith(".rtf") || name.endsWith(".txt")) {
    return file.text();
  }
  return file.text();
}

async function extractPdfText(arrayBuffer) {
  const pdfjsLib = await import(chrome.runtime.getURL("vendor/pdfjs/build/pdf.mjs"));
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("vendor/pdfjs/build/pdf.worker.mjs");
  }
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer
  });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent({
      normalizeWhitespace: true
    });
    const lines = [];
    const lineTolerance = 2;

    content.items.forEach((item) => {
      if (!item?.str) return;
      const x = item.transform?.[4] ?? 0;
      const y = item.transform?.[5] ?? 0;
      let line = lines.find((entry) => Math.abs(entry.y - y) <= lineTolerance);
      if (!line) {
        line = { y, items: [] };
        lines.push(line);
      } else {
        line.y = (line.y + y) / 2;
      }
      line.items.push({
        x,
        text: item.str,
        width: item.width || 0
      });
    });

    lines.sort((a, b) => b.y - a.y);

    const pageText = lines
      .map((line) => {
        line.items.sort((a, b) => a.x - b.x);
        let lineText = "";
        let prevX = null;
        line.items.forEach((chunk) => {
          if (prevX !== null && chunk.x - prevX > 8) {
            lineText += " ";
          }
          lineText += chunk.text;
          prevX = chunk.x + chunk.width;
        });
        return lineText.trim();
      })
      .filter(Boolean)
      .join("\n");

    text += `${pageText}\n\n`;
  }
  return text.trim();
}

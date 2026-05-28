const MM = 300 / 25.4;
const A4 = { wMm: 210, hMm: 297, w: Math.round(210 * MM), h: Math.round(297 * MM) };
const $ = (id) => document.getElementById(id);
const state = { photos: [] };

const controls = [
  "layoutPreset", "itemW", "itemH", "cols", "rows", "gap", "pageMargin",
  "guideMode", "cutMargin", "radius", "showGuides"
];

const presets = {
  photocard: { w: 55, h: 85, cols: 3, rows: 3, gap: 4, radius: 4 },
  keychain: { w: 45, h: 60, cols: 4, rows: 4, gap: 4, radius: 8 },
  polaroid: { w: 70, h: 90, cols: 2, rows: 3, gap: 5, radius: 2 }
};

controls.forEach((id) => $(id).addEventListener("input", render));

$("layoutPreset").addEventListener("change", () => {
  const preset = presets[$("layoutPreset").value];
  if (preset) {
    $("itemW").value = preset.w;
    $("itemH").value = preset.h;
    $("cols").value = preset.cols;
    $("rows").value = preset.rows;
    $("gap").value = preset.gap;
    $("radius").value = preset.radius;
  }
  render();
});

$("photoFiles").addEventListener("change", async (event) => {
  const files = Array.from(event.target.files || []);
  for (const file of files) {
    const url = await fileToDataURL(file);
    const image = await loadImage(url);
    state.photos.push({ name: file.name, url, image });
  }
  event.target.value = "";
  render();
});

$("clearPhotos").addEventListener("click", () => {
  state.photos = [];
  render();
});

$("renderBtn").addEventListener("click", render);
$("pngBtn").addEventListener("click", downloadPng);
$("svgBtn").addEventListener("click", downloadSvg);
$("pdfBtn").addEventListener("click", openPdfPrint);
$("cmykBtn").addEventListener("click", openCmykGuide);

function getConfig() {
  return {
    itemW: parseFloat($("itemW").value),
    itemH: parseFloat($("itemH").value),
    cols: parseInt($("cols").value, 10),
    rows: parseInt($("rows").value, 10),
    gap: parseFloat($("gap").value),
    pageMargin: parseFloat($("pageMargin").value),
    guideMode: $("guideMode").value,
    cutMargin: parseFloat($("cutMargin").value),
    radius: parseFloat($("radius").value),
    showGuides: $("showGuides").checked,
    preset: $("layoutPreset").value
  };
}

function buildItems(cfg) {
  const total = Math.max(1, cfg.cols * cfg.rows);
  const photos = state.photos.length ? state.photos : Array.from({ length: total }, () => null);
  const itemW = cfg.itemW * MM;
  const itemH = cfg.itemH * MM;
  const gap = cfg.gap * MM;
  const safe = cfg.pageMargin * MM;
  const usableW = A4.w - safe * 2;
  const usableH = A4.h - safe * 2;
  const gridW = cfg.cols * itemW + (cfg.cols - 1) * gap;
  const gridH = cfg.rows * itemH + (cfg.rows - 1) * gap;
  const startX = safe + (usableW - gridW) / 2;
  const startY = safe + (usableH - gridH) / 2;

  return Array.from({ length: total }, (_, index) => {
    const col = index % cfg.cols;
    const row = Math.floor(index / cfg.cols);
    return {
      x: startX + col * (itemW + gap),
      y: startY + row * (itemH + gap),
      w: itemW,
      h: itemH,
      photo: photos[index % photos.length]
    };
  });
}

function render() {
  const cfg = getConfig();
  const ctx = $("sheet").getContext("2d");
  ctx.clearRect(0, 0, A4.w, A4.h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, A4.w, A4.h);

  const items = buildItems(cfg);
  items.forEach((item) => drawItem(ctx, item, cfg));

  $("photoCount").textContent = `${state.photos.length} foto${state.photos.length === 1 ? "" : "s"}`;
  $("summary").textContent = `${items.length} peça(s) em A4 para ${presetLabel(cfg.preset)}.`;
  setStatus(state.photos.length ? "Prévia atualizada. Confira as guias antes de imprimir ou cortar." : "Carregue fotos para montar a folha.");
}

function drawItem(ctx, item, cfg) {
  ctx.save();
  ctx.translate(item.x, item.y);

  if (item.photo) {
    const fit = coverFit(item.photo.image, item.w, item.h);
    ctx.save();
    roundedClip(ctx, 0, 0, item.w, item.h, cfg.radius * MM);
    ctx.drawImage(item.photo.image, fit.x, fit.y, fit.w, fit.h);
    ctx.restore();
  } else {
    ctx.fillStyle = "#f4efff";
    roundRect(ctx, 0, 0, item.w, item.h, cfg.radius * MM);
    ctx.fill();
    ctx.fillStyle = "#7b61ff";
    ctx.font = `700 ${Math.max(22, item.w * .08)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto", item.w / 2, item.h / 2);
  }

  if (cfg.showGuides && cfg.guideMode !== "none") drawGuide(ctx, item, cfg);
  ctx.restore();
}

function drawGuide(ctx, item, cfg) {
  const margin = cfg.cutMargin * MM;
  const x = -margin;
  const y = -margin;
  const w = item.w + margin * 2;
  const h = item.h + margin * 2;
  const r = cfg.radius * MM;
  ctx.save();
  ctx.strokeStyle = "rgba(43, 17, 79, .55)";
  ctx.lineWidth = 2;
  if (cfg.guideMode === "dashed") ctx.setLineDash([12, 10]);
  if (cfg.guideMode === "corners") {
    ctx.setLineDash([]);
    const len = 42;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(cx, cy + sy * len);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx + sx * len, cy);
      ctx.stroke();
    });
  } else {
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }
  ctx.restore();
}

function buildCutSvg() {
  const cfg = getConfig();
  const items = buildItems(cfg);
  const paths = items.map((item) => {
    const margin = cfg.cutMargin;
    const x = item.x / MM - margin;
    const y = item.y / MM - margin;
    const w = item.w / MM + margin * 2;
    const h = item.h / MM + margin * 2;
    const r = Math.min(cfg.radius, w / 2, h / 2);
    return `<rect x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" rx="${fmt(r)}" ry="${fmt(r)}"/>`;
  }).join("\n");
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${A4.wMm}mm" height="${A4.hMm}mm" viewBox="0 0 ${A4.wMm} ${A4.hMm}">`,
    `<g fill="none" stroke="#000000" stroke-width="0.2">`,
    paths,
    `</g>`,
    `</svg>`
  ].join("\n");
}

function downloadPng() {
  render();
  const link = document.createElement("a");
  link.href = $("sheet").toDataURL("image/png");
  link.download = "artiva-fotoprint-previa.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function downloadSvg() {
  downloadBlob("artiva-fotoprint-corte.svg", buildCutSvg(), "image/svg+xml");
  setStatus("SVG de corte gerado. Importe no software da plotter e confira a escala A4 antes de cortar.");
}

function openPdfPrint() {
  render();
  const png = $("sheet").toDataURL("image/png");
  const html = `<!doctype html><html><head><title>Artiva FotoPrint - PDF</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}</style></head><body><img src="${png}" onload="setTimeout(()=>print(),300)"></body></html>`;
  const win = window.open("", "_blank");
  win.document.write(html);
  win.document.close();
  setStatus("PDF comum: use a opção Salvar como PDF na janela de impressão.");
}

function openCmykGuide() {
  const text = [
    "Fluxo futuro: PDF impressão CMYK",
    "",
    "Navegadores geram PDF em RGB. Para impressão profissional em CMYK, exporte o PNG/PDF comum e converta em um editor gráfico ou fluxo de gráfica.",
    "",
    "Sugestão atual:",
    "1. Gere a folha em PNG ou PDF comum.",
    "2. Abra no Canva, Photoshop, Illustrator, Corel ou ferramenta da gráfica.",
    "3. Converta para CMYK conforme o perfil solicitado.",
    "4. Confira escala, sangria e margens antes de imprimir."
  ].join("\n");
  downloadBlob("artiva-fotoprint-fluxo-cmyk.txt", text, "text/plain;charset=utf-8");
  setStatus("Fluxo CMYK salvo como orientação. A geração CMYK direta será tratada em uma etapa futura.");
}

function setStatus(message) {
  $("status").textContent = message;
}

function presetLabel(value) {
  return {
    photocard: "PhotoCard",
    keychain: "chaveiro acrílico",
    polaroid: "Polaroid",
    custom: "layout personalizado"
  }[value] || "layout";
}

function coverFit(img, boxW, boxH) {
  const scale = Math.max(boxW / img.width, boxH / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}

function roundedClip(ctx, x, y, w, h, r) {
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function downloadBlob(name, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fmt(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

render();

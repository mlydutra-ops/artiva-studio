const MM = 300 / 25.4;
const A4 = { wMm: 210, hMm: 297, w: Math.round(210 * MM), h: Math.round(297 * MM) };
const $ = (id) => document.getElementById(id);
const state = { photos: [] };

const presets = {
  photocard: { label: "PhotoCard", w: 55, h: 85, cols: 3, rows: 3, gap: 4, radius: 4, style: "photo" },
  keychain3x4: { label: "chaveiro acrílico 3x4", w: 30, h: 40, cols: 5, rows: 6, gap: 4, radius: 3, style: "photo" },
  keychainRound: { label: "chaveiro acrílico redondo", w: 35, h: 35, cols: 4, rows: 6, gap: 5, radius: 18, style: "round" },
  portrait6x9: { label: "foto retrato 6x9", w: 60, h: 90, cols: 3, rows: 3, gap: 4, radius: 3, style: "photo" },
  polaroidMini: { label: "Polaroid clássica mini", w: 72, h: 90, cols: 2, rows: 3, gap: 6, radius: 2, style: "polaroid" },
  polaroidClassic: { label: "Polaroid clássica padrão", w: 90, h: 115, cols: 2, rows: 2, gap: 8, radius: 2, style: "polaroid" },
  polaroidTape: { label: "Polaroid estilizada - fita", w: 72, h: 90, cols: 2, rows: 3, gap: 6, radius: 2, style: "polaroid-tape" },
  polaroidHearts: { label: "Polaroid estilizada - corações", w: 72, h: 90, cols: 2, rows: 3, gap: 6, radius: 2, style: "polaroid-hearts" },
  polaroidColor: { label: "Polaroid colors", w: 72, h: 90, cols: 2, rows: 3, gap: 6, radius: 2, style: "polaroid-color" },
  custom: { label: "layout personalizado", w: 55, h: 85, cols: 3, rows: 3, gap: 4, radius: 4, style: "photo" }
};

const controls = [
  "itemW", "itemH", "cols", "rows", "gap", "pageMargin",
  "guideMode", "cutMargin", "radius", "showGuides"
];

controls.forEach((id) => $(id).addEventListener("input", render));

$("layoutCards").addEventListener("click", (event) => {
  const card = event.target.closest("[data-preset]");
  if (!card) return;
  applyPreset(card.dataset.preset);
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

function applyPreset(key) {
  const preset = presets[key] || presets.photocard;
  $("layoutPreset").value = key;
  $("itemW").value = preset.w;
  $("itemH").value = preset.h;
  $("cols").value = preset.cols;
  $("rows").value = preset.rows;
  $("gap").value = preset.gap;
  $("radius").value = preset.radius;
  document.querySelectorAll(".layout-card").forEach((card) => {
    card.classList.toggle("active", card.dataset.preset === key);
  });
  render();
}

function getConfig() {
  const presetKey = $("layoutPreset").value;
  const preset = presets[presetKey] || presets.custom;
  return {
    itemW: cleanNumber($("itemW").value, preset.w),
    itemH: cleanNumber($("itemH").value, preset.h),
    cols: cleanInteger($("cols").value, preset.cols),
    rows: cleanInteger($("rows").value, preset.rows),
    gap: cleanNumber($("gap").value, preset.gap),
    pageMargin: cleanNumber($("pageMargin").value, 8),
    guideMode: $("guideMode").value,
    cutMargin: cleanNumber($("cutMargin").value, 1),
    radius: cleanNumber($("radius").value, preset.radius),
    preset: presetKey,
    style: preset.style || "photo",
    label: preset.label || "layout personalizado"
  };
}

function buildItems(cfg) {
  const total = Math.max(1, cfg.cols * cfg.rows);
  const photos = state.photos.length ? state.photos : Array.from({ length: total }, () => null);
  const cutW = cfg.itemW * MM;
  const cutH = cfg.itemH * MM;
  const bleed = Math.max(0, cfg.cutMargin * MM);
  const itemW = cutW + bleed * 2;
  const itemH = cutH + bleed * 2;
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
      cutW,
      cutH,
      bleed,
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
  $("layoutPhotoCount").textContent = `${state.photos.length} foto${state.photos.length === 1 ? "" : "s"}`;
  $("summary").textContent = `${items.length} peça(s) em A4 para ${cfg.label}.`;
  setStatus(state.photos.length ? "Prévia atualizada. Confira as guias antes de imprimir ou cortar." : "Carregue fotos para montar a folha.");
}

function drawItem(ctx, item, cfg) {
  ctx.save();
  ctx.translate(item.x, item.y);

  if (cfg.style.startsWith("polaroid")) {
    drawPolaroid(ctx, item, cfg);
  } else if (cfg.style === "round") {
    drawRoundPhoto(ctx, item, cfg);
  } else {
    drawFullPhoto(ctx, item, cfg);
  }

  if (cfg.showGuides && cfg.guideMode !== "none") drawGuide(ctx, item, cfg);
  ctx.restore();
}

function drawFullPhoto(ctx, item, cfg) {
  if (item.photo) {
    const fit = coverFit(item.photo.image, item.w, item.h);
    ctx.save();
    roundedClip(ctx, 0, 0, item.w, item.h, cfg.radius * MM);
    ctx.drawImage(item.photo.image, fit.x, fit.y, fit.w, fit.h);
    ctx.restore();
  } else {
    drawPlaceholder(ctx, 0, 0, item.w, item.h, cfg.radius * MM, "Foto");
  }
}

function drawRoundPhoto(ctx, item, cfg) {
  const r = Math.min(item.w, item.h) / 2;
  const cx = item.w / 2;
  const cy = item.h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  if (item.photo) {
    const fit = coverFit(item.photo.image, item.w, item.h);
    ctx.drawImage(item.photo.image, fit.x, fit.y, fit.w, fit.h);
  } else {
    ctx.fillStyle = "#f4efff";
    ctx.fillRect(0, 0, item.w, item.h);
    ctx.fillStyle = "#7b61ff";
    ctx.font = `700 ${Math.max(20, item.w * .12)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Foto", cx, cy);
  }
  ctx.restore();
}

function drawPolaroid(ctx, item, cfg) {
  const dark = cfg.style === "polaroid-color";
  const frame = Math.max(18, item.w * .08);
  const bottom = Math.max(34, item.h * .20);
  const photoBox = {
    x: frame,
    y: frame,
    w: item.w - frame * 2,
    h: item.h - frame - bottom
  };

  ctx.fillStyle = dark ? "#191721" : "#fffdf9";
  roundRect(ctx, 0, 0, item.w, item.h, cfg.radius * MM);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = dark ? "#191721" : "#ded6cc";
  ctx.stroke();

  if (cfg.style === "polaroid-hearts") drawHeartPattern(ctx, item.w, item.h);
  if (cfg.style === "polaroid-tape") drawTape(ctx, item.w);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
  ctx.strokeStyle = dark ? "#ffffff" : "#e3d9cd";
  ctx.lineWidth = 2;
  ctx.strokeRect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);

  if (item.photo) {
    const fit = coverFit(item.photo.image, photoBox.w, photoBox.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoBox.x, photoBox.y, photoBox.w, photoBox.h);
    ctx.clip();
    ctx.drawImage(item.photo.image, photoBox.x + fit.x, photoBox.y + fit.y, fit.w, fit.h);
    ctx.restore();
  } else {
    drawPlaceholder(ctx, photoBox.x, photoBox.y, photoBox.w, photoBox.h, 0, "Foto");
  }
}

function drawGuide(ctx, item, cfg) {
  const x = item.bleed;
  const y = item.bleed;
  const w = item.cutW;
  const h = item.cutH;
  const r = cfg.radius * MM;

  ctx.save();
  if (cfg.guideMode === "corners") {
    const len = Math.min(42, w / 4, h / 4);
    strokeGuide(ctx, cfg, () => {
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
        ctx.moveTo(cx, cy + sy * len);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx + sx * len, cy);
      });
    });
  } else if (cfg.style === "round") {
    strokeGuide(ctx, cfg, () => {
      ctx.arc(item.w / 2, item.h / 2, Math.min(item.cutW, item.cutH) / 2, 0, Math.PI * 2);
    });
  } else {
    strokeGuide(ctx, cfg, () => roundRect(ctx, x, y, w, h, r));
  }
  ctx.restore();
}

function buildCutSvg() {
  const cfg = getConfig();
  const items = buildItems(cfg);
  const paths = items.map((item) => {
    const x = (item.x + item.bleed) / MM;
    const y = (item.y + item.bleed) / MM;
    const w = item.cutW / MM;
    const h = item.cutH / MM;
    if (cfg.style === "round") {
      return `<circle cx="${fmt(x + w / 2)}" cy="${fmt(y + h / 2)}" r="${fmt(Math.min(w, h) / 2)}"/>`;
    }
    const r = Math.min(Math.max(0, cfg.radius), w / 2, h / 2);
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
  setStatus("SVG de corte gerado na medida final indicada. A arte mantém sangria para fora da linha de corte.");
}

function openPdfPrint() {
  render();
  const png = $("sheet").toDataURL("image/png");
  const html = `<!doctype html><html><head><title>Artiva FotoPrint - PDF</title><style>@page{size:A4;margin:0}html,body{margin:0}img{display:block;width:210mm;height:297mm}</style></head><body><img src="${png}" onload="setTimeout(()=>print(),300)"></body></html>`;
  const win = window.open("", "_blank");
  if (!win) {
    setStatus("O navegador bloqueou a janela do PDF. Permita pop-ups para gerar o PDF comum.");
    return;
  }
  win.document.write(html);
  win.document.close();
  setStatus("PDF comum: use a opção Salvar como PDF na janela de impressão.");
}

function drawPlaceholder(ctx, x, y, w, h, radius, text) {
  ctx.fillStyle = "#f4efff";
  roundRect(ctx, x, y, w, h, radius);
  ctx.fill();
  ctx.fillStyle = "#7b61ff";
  ctx.font = `700 ${Math.max(18, w * .11)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function strokeGuide(ctx, cfg, buildPath) {
  const dashed = cfg.guideMode === "dashed";
  const draw = (color, width, dash = []) => {
    ctx.save();
    ctx.beginPath();
    buildPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.restore();
  };
  draw("rgba(255, 255, 255, .95)", 7, dashed ? [14, 8] : []);
  draw("rgba(255, 122, 89, .98)", 3, dashed ? [14, 8] : []);
}

function drawTape(ctx, w) {
  ctx.save();
  ctx.translate(w / 2 - 42, 4);
  ctx.rotate(-0.12);
  ctx.fillStyle = "rgba(232, 135, 176, .55)";
  roundRect(ctx, 0, 0, 84, 26, 6);
  ctx.fill();
  ctx.restore();
}

function drawHeartPattern(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = "rgba(232, 135, 176, .22)";
  for (let y = 10; y < h - 8; y += 28) {
    for (let x = 10; x < w - 8; x += 30) drawHeart(ctx, x, y, 5);
  }
  ctx.restore();
}

function drawHeart(ctx, x, y, size) {
  ctx.beginPath();
  ctx.moveTo(x, y + size);
  ctx.bezierCurveTo(x - size * 2, y - size, x - size * 3, y + size * 1.5, x, y + size * 3);
  ctx.bezierCurveTo(x + size * 3, y + size * 1.5, x + size * 2, y - size, x, y + size);
  ctx.fill();
}

function setStatus(message) {
  $("status").textContent = message;
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
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
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

function cleanNumber(value, fallback) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanInteger(value, fallback) {
  const number = parseInt(value, 10);
  return Number.isFinite(number) ? number : fallback;
}

function fmt(value) {
  return Number(value).toFixed(3).replace(/\.?0+$/, "");
}

applyPreset("photocard");

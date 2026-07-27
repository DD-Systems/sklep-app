const canvas = document.querySelector("#reel");
const ctx = canvas.getContext("2d");
const playButton = document.querySelector("#playButton");
const recordButton = document.querySelector("#recordButton");
const statusEl = document.querySelector("#status");

const W = canvas.width;
const H = canvas.height;
const duration = 16;
const fps = 30;
const palette = ["#145c63", "#f1c75b", "#f7f2e8", "#ef6f61", "#5be0ba", "#223033"];

let products = [];
let images = new Map();
let start = performance.now();
let paused = false;
let pauseAt = 0;

const groups = [
  {
    title: "Kosmetyki od 7 zł",
    subtitle: "Rexona, Dove, Old Spice, Gillette",
    filter: /rexona|dove|old spice|gillette|nivea|lady/i
  },
  {
    title: "Dom ogarnięty taniej",
    subtitle: "Fairy, Vizir, Persil",
    filter: /fairy|vizir|persil/i
  },
  {
    title: "Kawa do domu",
    subtitle: "Lavazza i Dallmayr w dobrej cenie",
    filter: /kawa|lavazza|dallmayr/i
  }
];

function fitText(text, maxWidth, size, min = 32) {
  ctx.font = `900 ${size}px Inter, Arial, sans-serif`;
  while (ctx.measureText(text).width > maxWidth && size > min) {
    size -= 2;
    ctx.font = `900 ${size}px Inter, Arial, sans-serif`;
  }
  return size;
}

function wrap(text, maxWidth, size, weight = 800) {
  ctx.font = `${weight} ${size}px Inter, Arial, sans-serif`;
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function shortName(name) {
  return String(name)
    .replace(/antyperspirant/ig, "antyp.")
    .replace(/dezodorant/ig, "deo")
    .replace(/kapsułki do zmywarki/ig, "kaps. do zmywarki")
    .replace(/kapsułki do prania/ig, "kaps. do prania")
    .replace(/maszynka do golenia/ig, "maszynki")
    .replace(/\s+/g, " ")
    .trim();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function ease(x) {
  return 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
}

function sceneProgress(t, from, to) {
  return Math.min(1, Math.max(0, (t - from) / (to - from)));
}

function sceneAlpha(t, from, to, fade = 0.35) {
  if (t < from || t > to) return 0;
  return Math.min(1, (t - from) / fade, (to - t) / fade);
}

function drawBg(t) {
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, palette[0]);
  grad.addColorStop(0.52, "#202927");
  grad.addColorStop(1, "#111315");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = palette[1];
  ctx.lineWidth = 4;
  for (let i = -3; i < 9; i += 1) {
    ctx.beginPath();
    ctx.moveTo(i * 180 + (t * 28) % 180, 0);
    ctx.lineTo(i * 180 - 320 + (t * 28) % 180, H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHeader() {
  ctx.fillStyle = palette[2];
  ctx.font = "800 34px Inter, Arial, sans-serif";
  ctx.fillText("LOKALNY SKLEP", 70, 88);
  ctx.fillStyle = palette[1];
  ctx.font = "900 42px Inter, Arial, sans-serif";
  ctx.fillText("dla znajomych", 70, 138);
}

function drawProduct(product, x, y, w, h, delay = 0, t = 1) {
  const p = ease(Math.max(0, t - delay));
  if (!product || !p) return;

  ctx.save();
  ctx.translate(x, y + (1 - p) * 80);
  ctx.globalAlpha = p;
  roundRect(0, 0, w, h, 34);
  ctx.fillStyle = "#fbf7ed";
  ctx.fill();

  const img = images.get(product.id);
  if (img?.complete) {
    const pad = 22;
    const iw = w - pad * 2;
    const ih = h * 0.55;
    const scale = Math.min(iw / img.width, ih / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, pad + (iw - dw) / 2, pad + (ih - dh) / 2, dw, dh);
  }

  ctx.fillStyle = "#17282a";
  const nameLines = wrap(shortName(product.name), w - 44, 30, 900).slice(0, 2);
  ctx.font = "900 30px Inter, Arial, sans-serif";
  nameLines.forEach((line, i) => ctx.fillText(line, 22, h * 0.68 + i * 38));

  ctx.fillStyle = palette[3];
  ctx.font = "900 48px Inter, Arial, sans-serif";
  ctx.fillText(`${product.price} zł`, 22, h - 34);

  ctx.fillStyle = "#145c63";
  ctx.font = "800 26px Inter, Arial, sans-serif";
  ctx.fillText(`${product.stock || 0} szt.`, w - 118, h - 42);
  ctx.restore();
}

function drawHook(t) {
  const p = ease(sceneAlpha(t, 0, 3.25));
  ctx.save();
  ctx.translate(0, (1 - p) * 70);
  ctx.globalAlpha = p;
  ctx.fillStyle = palette[2];
  const size = fitText("Szybkie zakupy?", W - 120, 104, 54);
  ctx.font = `900 ${size}px Inter, Arial, sans-serif`;
  ctx.fillText("Szybkie zakupy?", 70, 440);
  ctx.fillStyle = palette[1];
  ctx.font = "900 76px Inter, Arial, sans-serif";
  ctx.fillText("w cenach dla", 70, 540);
  ctx.fillText("znajomych", 70, 625);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 43px Inter, Arial, sans-serif";
  wrap("Kosmetyki, chemia, kawa i prosty koszyk w telefonie.", W - 140, 43, 800)
    .forEach((line, i) => ctx.fillText(line, 70, 745 + i * 55));
  ctx.restore();

  drawProduct(products[0], 95, 1010, 405, 560, 0.05, p);
  drawProduct(products[10], 565, 980, 405, 560, 0.15, p);
}

function drawGroup(group, t, from, to) {
  const p = ease(sceneAlpha(t, from, to));
  const picked = products.filter((item) => group.filter.test(item.name)).slice(0, 3);
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * 55);
  ctx.fillStyle = palette[1];
  ctx.font = "900 68px Inter, Arial, sans-serif";
  wrap(group.title, W - 140, 68, 900).forEach((line, i) => ctx.fillText(line, 70, 300 + i * 76));
  ctx.fillStyle = palette[2];
  ctx.font = "800 39px Inter, Arial, sans-serif";
  ctx.fillText(group.subtitle, 70, 475);
  ctx.restore();

  drawProduct(picked[0], 70, 610, 430, 525, 0, p);
  drawProduct(picked[1], 580, 660, 390, 500, 0.12, p);
  drawProduct(picked[2], 170, 1215, 735, 390, 0.24, p);
}

function drawAppScene(t) {
  const p = ease(sceneAlpha(t, 12, 14.45));
  ctx.save();
  ctx.globalAlpha = p;
  ctx.translate(0, (1 - p) * 60);
  ctx.fillStyle = palette[2];
  ctx.font = "900 78px Inter, Arial, sans-serif";
  ctx.fillText("Wybierasz.", 70, 360);
  ctx.fillText("Dodajesz.", 70, 445);
  ctx.fillStyle = palette[1];
  ctx.fillText("Wysyłasz.", 70, 530);

  roundRect(150, 690, 780, 780, 54);
  ctx.fillStyle = "#f7f2e8";
  ctx.fill();
  ctx.fillStyle = "#145c63";
  ctx.font = "900 54px Inter, Arial, sans-serif";
  ctx.fillText("Koszyk", 215, 790);
  ctx.font = "800 34px Inter, Arial, sans-serif";
  ["2 produkty", "Płatność: gotówka lub Blik", "Dostawa dla znajomych: 0 zł"].forEach((line, i) => {
    ctx.fillText(line, 215, 890 + i * 74);
  });
  roundRect(215, 1190, 650, 112, 26);
  ctx.fillStyle = palette[3];
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 42px Inter, Arial, sans-serif";
  ctx.fillText("Wyślij zamówienie", 305, 1262);
  ctx.restore();
}

function drawCta(t) {
  const p = ease(sceneAlpha(t, 14.2, 15.95));
  ctx.save();
  ctx.globalAlpha = p;
  ctx.fillStyle = palette[2];
  ctx.font = "900 86px Inter, Arial, sans-serif";
  wrap("Zajrzyj do katalogu", W - 140, 86, 900).forEach((line, i) => ctx.fillText(line, 70, 560 + i * 92));
  ctx.fillStyle = palette[4];
  ctx.font = "900 58px Inter, Arial, sans-serif";
  ctx.fillText("sklepapp2026@gmail.com", 70, 820);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 42px Inter, Arial, sans-serif";
  wrap("Odbiór lokalnie. Ilości są ograniczone.", W - 140, 42, 800).forEach((line, i) => {
    ctx.fillText(line, 70, 930 + i * 55);
  });
  ctx.restore();
}

function drawFrame(ms) {
  const t = ((ms - start) / 1000) % duration;
  drawBg(t);
  drawHeader();
  drawHook(t);
  drawGroup(groups[0], t, 3, 6);
  drawGroup(groups[1], t, 6, 9);
  drawGroup(groups[2], t, 9, 12.2);
  drawAppScene(t);
  drawCta(t);

  ctx.fillStyle = "rgba(255,255,255,.74)";
  ctx.font = "800 28px Inter, Arial, sans-serif";
  ctx.fillText("Oferta dla znajomych • ceny w katalogu", 70, H - 64);
}

function tick(ms) {
  if (!paused) drawFrame(ms);
  requestAnimationFrame(tick);
}

async function loadProducts() {
  const response = await fetch("../products.json", { cache: "no-store" });
  products = (await response.json()).slice(0, 20);
  images = new Map(products.map((product) => {
    const img = new Image();
    img.src = product.image;
    return [product.id, img];
  }));
  statusEl.textContent = `Załadowano ${products.length} produktów.`;
}

function record() {
  recordButton.disabled = true;
  statusEl.textContent = "Nagrywanie 16 s...";
  start = performance.now();
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: "video/webm;codecs=vp9" });
  const chunks = [];
  recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data);
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sklep-app-tiktok-rolka.webm";
    a.click();
    URL.revokeObjectURL(url);
    statusEl.textContent = "Gotowe: pobrano sklep-app-tiktok-rolka.webm.";
    recordButton.disabled = false;
  };
  recorder.start();
  setTimeout(() => recorder.stop(), duration * 1000);
}

playButton.addEventListener("click", () => {
  paused = !paused;
  playButton.textContent = paused ? "Odtwórz" : "Pauza";
  if (paused) {
    pauseAt = performance.now();
  } else {
    start += performance.now() - pauseAt;
  }
});

recordButton.addEventListener("click", record);

loadProducts()
  .then(() => requestAnimationFrame(tick))
  .catch(() => {
    statusEl.textContent = "Nie udało się wczytać produktów. Uruchom przez lokalny serwer.";
  });

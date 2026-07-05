/**
 * <bf-color-wheel> — hue ring + saturation/value triangle picker (the
 * classic wheel-triangle layout), rendered on canvas with pointer-drag
 * interaction. Exposes `.value` as a #rrggbb hex string and fires "change"
 * on user input, so forms can treat it like any input element.
 * System-agnostic; no external dependencies.
 */

const SIZE = 156;
const RING = 16;

function hsvToRgb(h, s, v) {
  const i = Math.floor(h / 60) % 6;
  const f = h / 60 - Math.floor(h / 60);
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const [r, g, b] = [
    [v, t, p], [q, v, p], [p, v, t],
    [p, q, v], [t, p, v], [v, p, q]
  ][i];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max === 0 ? 0 : d / max, max];
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex([r, g, b]) {
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export class BfColorWheel extends HTMLElement {
  #hue = 16;
  #sat = 1;
  #val = 1;
  #canvas = null;
  #ctx = null;
  #swatch = null;
  #label = null;
  #zone = null;

  // Triangle vertices: hue at 0° (right), white at -120° (upper left),
  // black at +120° (lower left) — canvas y grows downward.
  get #geometry() {
    const c = SIZE / 2;
    const outer = c - 1;
    const inner = outer - RING;
    const tri = inner - 5;
    const vertex = angle => [c + tri * Math.cos(angle), c + tri * Math.sin(angle)];
    return { c, outer, inner, hueV: vertex(0), whiteV: vertex(-2 * Math.PI / 3), blackV: vertex(2 * Math.PI / 3) };
  }

  connectedCallback() {
    if (this.#canvas) return;
    this.#canvas = document.createElement("canvas");
    this.#canvas.width = SIZE;
    this.#canvas.height = SIZE;
    this.#swatch = document.createElement("span");
    this.#swatch.className = "bf-cw-swatch";
    this.#label = document.createElement("span");
    this.#label.className = "bf-cw-hex";
    const side = document.createElement("div");
    side.className = "bf-cw-side";
    side.append(this.#swatch, this.#label);
    this.append(this.#canvas, side);
    this.#ctx = this.#canvas.getContext("2d", { willReadFrequently: true });

    const initial = hexToRgb(this.getAttribute("value"));
    if (initial) [this.#hue, this.#sat, this.#val] = rgbToHsv(...initial);

    this.#canvas.addEventListener("pointerdown", this.#onPointerDown.bind(this));
    this.#canvas.addEventListener("pointermove", this.#onPointerMove.bind(this));
    const endDrag = () => { this.#zone = null; };
    this.#canvas.addEventListener("pointerup", endDrag);
    this.#canvas.addEventListener("pointercancel", endDrag);
    this.#canvas.addEventListener("lostpointercapture", endDrag);
    this.#render();
  }

  get value() {
    return rgbToHex(hsvToRgb(this.#hue, this.#sat, this.#val));
  }

  set value(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    [this.#hue, this.#sat, this.#val] = rgbToHsv(...rgb);
    if (this.#ctx) this.#render();
  }

  #onPointerDown(event) {
    if (event.button !== 0) return;
    const { x, y } = this.#localPoint(event);
    const { c, outer, inner } = this.#geometry;
    const dist = Math.hypot(x - c, y - c);
    if (dist <= outer + 3 && dist >= inner - 3) this.#zone = "ring";
    else this.#zone = "triangle";
    this.#canvas.setPointerCapture(event.pointerId);
    this.#apply(x, y);
  }

  #onPointerMove(event) {
    if (!this.#zone) return;
    const { x, y } = this.#localPoint(event);
    this.#apply(x, y);
  }

  #localPoint(event) {
    const rect = this.#canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (SIZE / rect.width),
      y: (event.clientY - rect.top) * (SIZE / rect.height)
    };
  }

  #apply(x, y) {
    const { c, hueV, whiteV, blackV } = this.#geometry;
    if (this.#zone === "ring") {
      this.#hue = ((Math.atan2(y - c, x - c) * 180 / Math.PI) + 360) % 360;
    } else {
      // Barycentric coordinates over (hue, white, black), clamped into the triangle
      const [x1, y1] = hueV, [x2, y2] = whiteV, [x3, y3] = blackV;
      const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      let wH = ((y2 - y3) * (x - x3) + (x3 - x2) * (y - y3)) / det;
      let wW = ((y3 - y1) * (x - x3) + (x1 - x3) * (y - y3)) / det;
      wH = Math.max(0, wH); wW = Math.max(0, wW);
      let wB = 1 - wH - wW;
      if (wB < 0) { const sum = wH + wW; wH /= sum; wW /= sum; wB = 0; }
      // color = wH*hue + wW*white  =>  v = wH + wW, s = wH / (wH + wW)
      this.#val = Math.min(1, wH + wW);
      this.#sat = this.#val === 0 ? 0 : Math.min(1, wH / this.#val);
    }
    this.#render();
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  #render() {
    const ctx = this.#ctx;
    const { c, outer, inner, hueV, whiteV, blackV } = this.#geometry;
    ctx.clearRect(0, 0, SIZE, SIZE);

    // Hue ring
    for (let a = 0; a < 360; a++) {
      const start = (a - 0.6) * Math.PI / 180;
      const end = (a + 1) * Math.PI / 180;
      ctx.beginPath();
      ctx.arc(c, c, (outer + inner) / 2, start, end);
      ctx.lineWidth = RING;
      ctx.strokeStyle = rgbToHex(hsvToRgb(a, 1, 1));
      ctx.stroke();
    }

    // SV triangle (per-pixel barycentric mix of hue/white/black)
    const [x1, y1] = hueV, [x2, y2] = whiteV, [x3, y3] = blackV;
    const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
    const hueRgb = hsvToRgb(this.#hue, 1, 1);
    const minX = Math.floor(Math.min(x1, x2, x3)), maxX = Math.ceil(Math.max(x1, x2, x3));
    const minY = Math.floor(Math.min(y1, y2, y3)), maxY = Math.ceil(Math.max(y1, y2, y3));
    const image = ctx.getImageData(minX, minY, maxX - minX, maxY - minY);
    const data = image.data;
    for (let py = minY; py < maxY; py++) {
      for (let px = minX; px < maxX; px++) {
        const wH = ((y2 - y3) * (px - x3) + (x3 - x2) * (py - y3)) / det;
        const wW = ((y3 - y1) * (px - x3) + (x1 - x3) * (py - y3)) / det;
        const wB = 1 - wH - wW;
        if (wH < 0 || wW < 0 || wB < 0) continue;
        const i = ((py - minY) * (maxX - minX) + (px - minX)) * 4;
        data[i] = Math.round(wH * hueRgb[0] + wW * 255);
        data[i + 1] = Math.round(wH * hueRgb[1] + wW * 255);
        data[i + 2] = Math.round(wH * hueRgb[2] + wW * 255);
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, minX, minY);

    // Hue marker on the ring
    const hueAngle = this.#hue * Math.PI / 180;
    ctx.beginPath();
    ctx.arc(c + ((outer + inner) / 2) * Math.cos(hueAngle), c + ((outer + inner) / 2) * Math.sin(hueAngle), 5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ffffff";
    ctx.stroke();

    // SV marker inside the triangle
    const wH = this.#sat * this.#val;
    const wW = (1 - this.#sat) * this.#val;
    const wB = 1 - this.#val;
    const mx = wH * x1 + wW * x2 + wB * x3;
    const my = wH * y1 + wW * y2 + wB * y3;
    ctx.beginPath();
    ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.#val > 0.55 ? "#111111" : "#ffffff";
    ctx.stroke();

    const hex = this.value;
    if (this.#swatch) this.#swatch.style.backgroundColor = hex;
    if (this.#label) this.#label.textContent = hex;
  }
}

export function registerColorWheel() {
  if (!customElements.get("bf-color-wheel")) {
    customElements.define("bf-color-wheel", BfColorWheel);
  }
}

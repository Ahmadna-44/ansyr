/* ============================================================
   charts.js — مخططات SVG بسيطة وخفيفة بدون أي مكتبات خارجية
   ============================================================ */

function donutChart(segments, size = 170) {
  // segments: [{ value, color, label }]
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const R = size / 2 - 14, C = 2 * Math.PI * R, cx = size / 2, cy = size / 2;
  let offset = 0;
  const circles = segments.map(seg => {
    const len = (seg.value / total) * C;
    const circle = `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${seg.color}" stroke-width="20"
      stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"
      style="filter:drop-shadow(0 0 6px ${seg.color}88)"/>`;
    offset += len;
    return circle;
  }).join("");
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="direction:ltr;">
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--border)" stroke-width="20"/>
      ${circles}
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="IBM Plex Mono" font-size="22" font-weight="700" fill="var(--text)">${total}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-family="Cairo" font-size="11" fill="var(--muted)">إجمالي الطلاب</text>
    </svg>
  `;
}

function barChart(data, opts = {}) {
  // data: [{ label, value, color }]
  // ترتيب الأعمدة من اليسار لليمين بالـ SVG: [رقم القيمة] [الشريط] [نص التسمية] — يناسب اتجاه القراءة من اليمين لليسار
  const w = opts.width || 320, barH = opts.barHeight || 22, gap = 12;
  const max = opts.maxValue || Math.max(1, ...data.map(d => d.value));
  const h = data.length * (barH + gap);
  const labelW = opts.labelWidth || 96;
  const valueW = 26;
  const chartW = w - labelW - valueW - 12;
  const barX = valueW + 6;
  const rows = data.map((d, i) => {
    const y = i * (barH + gap);
    const bw = (d.value / max) * chartW;
    return `
      <text x="${w}" y="${y + barH/2 + 4}" text-anchor="end" font-family="Cairo" font-size="10.5" fill="var(--text)">${d.label}</text>
      <rect x="${barX}" y="${y}" width="${chartW}" height="${barH}" rx="6" fill="var(--border)"/>
      <rect x="${barX}" y="${y}" width="${Math.max(bw,2)}" height="${barH}" rx="6" fill="${d.color}" style="filter:drop-shadow(0 0 5px ${d.color}77)"/>
      <text x="0" y="${y + barH/2 + 4}" text-anchor="start" font-family="IBM Plex Mono" font-size="11.5" fill="var(--muted)">${d.value}</text>
    `;
  }).join("");
  return `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" style="direction:ltr;display:block;">${rows}</svg>`;
}

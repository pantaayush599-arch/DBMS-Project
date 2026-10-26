// Small dependency-free chart helpers (HTML + inline SVG), so the app works offline.
// Every mark carries a data-tip for the shared hover/focus tooltip; colors come
// from CSS custom properties in styles.css so light and dark mode both work.

const Charts = (() => {
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

  // Round an axis maximum up to a clean number (1, 2, 2.5, 5 x 10^n).
  function niceMax(v) {
    if (v <= 0) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
  }

  function table(rows, cols) {
    const head = cols.map((c) => `<th${c.num ? ' class="num"' : ''}>${esc(c.label)}</th>`).join('');
    const body = rows.map((r) => `<tr>${cols.map((c) => `<td${c.num ? ' class="num"' : ''}>${esc(c.fmt ? c.fmt(r[c.key], r) : r[c.key])}</td>`).join('')}</tr>`).join('');
    return `<details class="as-table"><summary>View as table</summary><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></details>`;
  }

  // Horizontal bars: compare magnitude across categories.
  // opts: { label, value, fmt, marker?(row) -> number, low?(row) -> bool, markerLabel }
  function bars(rows, opts) {
    if (!rows.length) return '<div class="empty">No data yet.</div>';
    const max = niceMax(Math.max(...rows.map((r) => Math.max(opts.value(r), opts.marker ? opts.marker(r) : 0))));
    const fmt = opts.fmt || ((v) => v.toLocaleString('en-IN'));
    const items = rows.map((r) => {
      const v = opts.value(r);
      const low = opts.low && opts.low(r);
      const m = opts.marker ? opts.marker(r) : null;
      const tip = `${fmt(v)}|${opts.label(r)}${m !== null ? ` · ${opts.markerLabel}: ${fmt(m)}` : ''}${low ? ' · Low stock' : ''}`;
      return `<div class="hbar" tabindex="0" data-tip="${esc(tip)}">
          <span class="hbar-label">${esc(opts.label(r))}</span>
          <span class="hbar-track">
            <span class="hbar-fill${low ? ' low' : ''}" style="width:${(v / max) * 100}%"></span>
            ${m !== null ? `<span class="hbar-marker" style="left:${(m / max) * 100}%"></span>` : ''}
          </span>
          <span class="hbar-value">${esc(fmt(v))}${low ? ' <span class="flag">⚠ Low</span>' : ''}</span>
        </div>`;
    }).join('');
    const legend = opts.marker
      ? `<div class="legend"><span><i class="key-rect"></i>Units in stock</span><span><i class="key-tick"></i>${esc(opts.markerLabel)}</span><span><i class="key-rect low"></i>At or below reorder level</span></div>`
      : '';
    return `${legend}<div class="hbars">${items}</div>`;
  }

  // Vertical columns over time for a single series. Labels only the latest and the peak.
  function columns(rows, { x, y, fmt }) {
    if (!rows.length) return '<div class="empty">No data yet.</div>';
    const values = rows.map(y);
    const max = niceMax(Math.max(...values));
    const peak = values.indexOf(Math.max(...values));
    const ticks = [0, max / 2, max];
    const cols = rows.map((r, i) => {
      const v = y(r);
      const showLabel = i === rows.length - 1 || i === peak;
      return `<div class="col" tabindex="0" data-tip="${esc(`${fmt(v)}|${x(r)}`)}">
          <div class="col-bar-wrap">
            ${showLabel ? `<span class="col-value" style="bottom:${(v / max) * 100}%">${esc(compactMoney(v))}</span>` : ''}
            <div class="col-bar" style="height:${(v / max) * 100}%"></div>
          </div>
          <span class="col-x">${esc(x(r))}</span>
        </div>`;
    }).join('');
    return `<div class="columns">
        <div class="col-grid">${ticks.map((t) => `<div class="gridline" style="bottom:${(t / max) * 100}%"><span>${esc(compactMoney(t))}</span></div>`).join('')}</div>
        <div class="col-row">${cols}</div>
      </div>`;
  }

  // Multi-series line chart with a crosshair tooltip per X position.
  // series: [{ key, label, color: 'var(--series-1)' }]
  function lines(el, rows, { x, series, fmt }) {
    if (!rows.length) { el.innerHTML = '<div class="empty">No data yet.</div>'; return; }
    const W = Math.max(el.clientWidth, 280);
    const H = 220;
    const pad = { l: 48, r: 72, t: 12, b: 28 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;
    const max = niceMax(Math.max(...rows.flatMap((r) => series.map((s) => r[s.key]))));
    const px = (i) => pad.l + (rows.length === 1 ? iw / 2 : (i / (rows.length - 1)) * iw);
    const py = (v) => pad.t + ih - (v / max) * ih;
    const ticks = [0, max / 2, max];

    let svg = `<svg width="${W}" height="${H}" role="img" aria-label="${esc(series.map((s) => s.label).join(' and '))} by month">`;
    svg += ticks.map((t) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${py(t)}" y2="${py(t)}"/>
      <text class="tick" x="${pad.l - 8}" y="${py(t) + 4}" text-anchor="end">${esc(compactMoney(t))}</text>`).join('');
    svg += rows.map((r, i) => `<text class="tick" x="${px(i)}" y="${H - 8}" text-anchor="middle">${esc(x(r))}</text>`).join('');
    // end labels: placed at each line's last point, nudged apart only if they would overlap
    const ends = series.map((s) => ({ s, y: py(rows[rows.length - 1][s.key]) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 14) ends[i].y = ends[i - 1].y + 14;
    for (const s of series) {
      const d = rows.map((r, i) => `${i ? 'L' : 'M'}${px(i)},${py(r[s.key])}`).join('');
      svg += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
      const last = rows.length - 1;
      svg += `<circle cx="${px(last)}" cy="${py(rows[last][s.key])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    }
    for (const e of ends) svg += `<text class="end-label" x="${W - pad.r + 8}" y="${e.y + 4}">${esc(e.s.label)}</text>`;
    // hover bands: one per X, full height, carrying every series' value
    const band = rows.length === 1 ? iw : iw / (rows.length - 1);
    svg += rows.map((r, i) => {
      const tip = `${x(r)}|${series.map((s) => `${s.label}: ${fmt(r[s.key])}`).join('|')}`;
      return `<g class="band" tabindex="0" data-tip="${esc(tip)}" data-tip-multi="1">
          <rect x="${px(i) - band / 2}" y="${pad.t}" width="${band}" height="${ih}" fill="transparent"/>
          <line class="xhair" x1="${px(i)}" x2="${px(i)}" y1="${pad.t}" y2="${pad.t + ih}"/>
        </g>`;
    }).join('');
    svg += '</svg>';
    const legend = `<div class="legend">${series.map((s) => `<span><i class="key-line" style="background:${s.color}"></i>${esc(s.label)}</span>`).join('')}</div>`;
    el.innerHTML = legend + svg;
  }

  // Capacity meter: the fill carries severity; the track is a lighter step of the same ramp.
  function meter(label, pct, sub) {
    const level = pct >= 90 ? 'critical' : pct >= 75 ? 'warning' : '';
    const flag = level ? ` <span class="flag ${level}">${level === 'critical' ? '⛔ Almost full' : '⚠ Filling up'}</span>` : '';
    return `<div class="meter" tabindex="0" data-tip="${esc(`${pct}% used|${label} · ${sub}`)}">
        <div class="meter-head"><span>${esc(label)}${flag}</span><strong>${pct}%</strong></div>
        <div class="meter-track ${level}"><div class="meter-fill" style="width:${Math.min(pct, 100)}%"></div></div>
        <div class="meter-sub">${esc(sub)}</div>
      </div>`;
  }

  // Order status: a single 100% stacked bar per order type, status colors + text labels.
  function statusBars(rows, types) {
    const kind = { Pending: 'warning', Received: 'good', Shipped: 'good', Cancelled: 'muted' };
    const icon = { warning: '◷', good: '✓', muted: '✕' };
    return types.map((type) => {
      const segs = rows.filter((r) => r.Order_Type === type);
      const total = segs.reduce((a, r) => a + r.Orders, 0);
      if (!total) return '';
      const order = ['Pending', 'Received', 'Shipped', 'Cancelled'];
      segs.sort((a, b) => order.indexOf(a.Status) - order.indexOf(b.Status));
      return `<div class="status-block">
          <div class="status-title">${esc(type)} orders <span class="muted">· ${total} total</span></div>
          <div class="stack">${segs.map((s) => `<span class="seg ${kind[s.Status]}" tabindex="0" style="flex:${s.Orders}" data-tip="${esc(`${s.Orders} orders|${type} · ${s.Status}`)}"></span>`).join('')}</div>
          <div class="legend">${segs.map((s) => `<span><i class="key-rect ${kind[s.Status]}"></i>${icon[kind[s.Status]]} ${esc(s.Status)} <strong>${s.Orders}</strong></span>`).join('')}</div>
        </div>`;
    }).join('');
  }

  function compactMoney(v) { return '₹' + compact.format(v); }

  // Shared tooltip: value first (strong), label second.
  function initTooltip() {
    const tip = document.createElement('div');
    tip.id = 'chart-tip';
    document.body.appendChild(tip);
    const show = (target, x, y) => {
      const parts = target.dataset.tip.split('|');
      tip.replaceChildren();
      if (target.dataset.tipMulti) {
        const head = document.createElement('div'); head.className = 'tip-label'; head.textContent = parts[0]; tip.append(head);
        for (const p of parts.slice(1)) { const row = document.createElement('div'); row.className = 'tip-value'; row.textContent = p; tip.append(row); }
      } else {
        const v = document.createElement('div'); v.className = 'tip-value'; v.textContent = parts[0];
        const l = document.createElement('div'); l.className = 'tip-label'; l.textContent = parts.slice(1).join(' · ');
        tip.append(v, l);
      }
      tip.style.display = 'block';
      const r = tip.getBoundingClientRect();
      tip.style.left = Math.min(x + 14, innerWidth - r.width - 8) + 'px';
      tip.style.top = Math.max(y - r.height - 10, 8) + 'px';
    };
    document.addEventListener('pointermove', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t) show(t, e.clientX, e.clientY); else tip.style.display = 'none';
    });
    document.addEventListener('focusin', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t) { const r = t.getBoundingClientRect(); show(t, r.left + r.width / 2, r.top); }
    });
    document.addEventListener('focusout', () => (tip.style.display = 'none'));
  }

  return { bars, columns, lines, meter, statusBars, table, initTooltip, compactMoney };
})();

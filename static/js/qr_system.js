/**
 * NutriPrint QR System
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides QR code generation for food cards, meal plans, and recipe pages.
 *
 * Depends on: qrcodejs  (loaded in pages that use this module)
 * CDN: https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js
 *
 * Public API:
 *   NutriQR.recipeUrl(foodName)            → canonical recipe URL string
 *   NutriQR.slug(foodName)                 → URL slug for food name
 *   NutriQR.generate(container, url, size) → renders QR into container element
 *   NutriQR.downloadQR(canvasOrImg, name)  → downloads QR as PNG
 *   NutriQR.buildFoodCardQR(foodName)      → returns HTML string for food card QR badge
 *   NutriQR.buildMealItemQR(foodName)      → returns HTML string for meal plan row QR
 *   NutriQR.initPage()                     → auto-wires all [data-qr-food] elements
 */

'use strict';

(function () {

  /* ── Helpers ────────────────────────────────────────────────────────────── */

  function slug(name) {
    return encodeURIComponent(
      (name || '')
        .trim()
        .replace(/\s+/g, '_')
    );
  }

  function recipeUrl(foodName) {
    const base = window.location.origin;
    return `${base}/recipes/${slug(foodName)}`;
  }

  /** Render a QR code into containerEl. Returns the QR instance or null. */
  function generate(containerEl, url, size) {
    if (!containerEl || typeof QRCode === 'undefined') return null;
    containerEl.innerHTML = '';
    size = size || 120;
    try {
      return new QRCode(containerEl, {
        text          : url,
        width         : size,
        height        : size,
        colorDark     : '#0F5E46',
        colorLight    : '#ffffff',
        correctLevel  : QRCode.CorrectLevel.M,
      });
    } catch (_) {
      containerEl.innerHTML = `<div style="width:${size}px;height:${size}px;
        display:flex;align-items:center;justify-content:center;
        background:#F0FDF4;border-radius:8px;font-size:10px;
        color:#64748B;text-align:center;padding:8px;">
        QR unavailable
      </div>`;
      return null;
    }
  }

  /** Download the QR code canvas/img as a PNG file. */
  function downloadQR(containerEl, foodName) {
    if (!containerEl) return;
    const canvas = containerEl.querySelector('canvas');
    const img    = containerEl.querySelector('img');
    const safe   = (foodName || 'recipe').replace(/[^a-z0-9]/gi, '_').toLowerCase();

    if (canvas) {
      const link  = document.createElement('a');
      link.href   = canvas.toDataURL('image/png');
      link.download = `nutriprint_qr_${safe}.png`;
      link.click();
    } else if (img) {
      const link  = document.createElement('a');
      link.href   = img.src;
      link.download = `nutriprint_qr_${safe}.png`;
      link.click();
    }
  }

  /* ── HTML builders ──────────────────────────────────────────────────────── */

  /**
   * Returns an HTML string for a collapsible QR badge on a food card.
   * Usage: inject into food card template with data-qr-food attribute.
   */
  function buildFoodCardQR(foodName) {
    const url   = recipeUrl(foodName);
    const safe  = (foodName || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const safeFn = safe.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    return `
<div class="nq-card-qr" data-qr-food="${safe}">
  <button class="nq-qr-toggle" onclick="NutriQR._toggleCardQR(this)"
          aria-expanded="false" aria-label="Show QR code for ${safe} recipe">
    <span class="nq-qr-icon">⬜</span>
    <span class="nq-qr-label">QR Recipe</span>
  </button>
  <div class="nq-qr-popover" hidden>
    <div class="nq-qr-popover-inner">
      <div class="nq-qr-canvas-wrap" id="nq-canvas-${safeFn}"></div>
      <div class="nq-qr-popover-meta">
        <span class="nq-qr-food-name">${safe}</span>
        <span class="nq-qr-scan-hint">📱 Scan to open recipe</span>
      </div>
      <div class="nq-qr-popover-actions">
        <a href="${url}" target="_blank" rel="noopener noreferrer"
           class="nq-qr-btn nq-qr-btn--primary">
          Open Recipe ↗
        </a>
        <button class="nq-qr-btn nq-qr-btn--ghost"
                onclick="NutriQR.downloadQR(document.getElementById('nq-canvas-${safeFn}'), '${safe}')">
          📥 Download QR
        </button>
        <button class="nq-qr-btn nq-qr-btn--ghost"
                onclick="NutriQR._printRecipeCard('${safe}', '${url}')">
          🖨 Print Card
        </button>
      </div>
    </div>
  </div>
</div>`;
  }

  /**
   * Returns an HTML string for a compact QR chip on meal plan rows.
   */
  function buildMealItemQR(foodName) {
    const url  = recipeUrl(foodName);
    const safe = (foodName || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `<a href="${url}" target="_blank" rel="noopener noreferrer"
               class="nq-meal-qr-chip" title="Open recipe for ${safe}"
               aria-label="Open recipe for ${safe}">
  <span class="nq-meal-qr-icon">⬜</span>
  <span>Recipe</span>
</a>`;
  }

  /* ── Toggle handler for food card QR popover ────────────────────────────── */

  function _toggleCardQR(btnEl) {
    const card    = btnEl.closest('.nq-card-qr');
    const popover = card.querySelector('.nq-qr-popover');
    const canvasId = card.querySelector('.nq-qr-canvas-wrap')?.id;
    const foodName = card.dataset.qrFood;
    const expanded = btnEl.getAttribute('aria-expanded') === 'true';

    if (expanded) {
      popover.hidden = true;
      btnEl.setAttribute('aria-expanded', 'false');
    } else {
      popover.hidden = false;
      btnEl.setAttribute('aria-expanded', 'true');
      // Render QR once (check if already rendered)
      const wrap = document.getElementById(canvasId);
      if (wrap && !wrap.dataset.rendered) {
        generate(wrap, recipeUrl(foodName), 120);
        wrap.dataset.rendered = '1';
      }
    }
  }

  /* ── Printable recipe card ──────────────────────────────────────────────── */

  function _printRecipeCard(foodName, url) {
    const win  = window.open('', '_blank', 'width=600,height=800');
    if (!win) { window.open(url + '?print=1', '_blank'); return; }

    const safeUrl = url.replace(/"/g, '&quot;');
    const safeName = (foodName || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    win.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${safeName} — NutriPrint Recipe Card</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Inter,sans-serif;background:#fff;color:#0F172A;padding:24px}
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@700;900&family=Inter:wght@400;600;700&display=swap');
    .card{max-width:380px;margin:0 auto;border:2px solid #BBF7D0;border-radius:20px;overflow:hidden}
    .card-header{background:linear-gradient(135deg,#0F5E46,#1D9E75);color:white;padding:20px;text-align:center}
    .card-logo{font-size:11px;font-weight:700;letter-spacing:.15em;text-transform:uppercase;color:rgba(255,255,255,.7);margin-bottom:6px}
    .card-name{font-family:Poppins,sans-serif;font-weight:900;font-size:22px;letter-spacing:-.02em;line-height:1.2}
    .card-sub{font-size:12px;color:rgba(255,255,255,.65);margin-top:4px}
    .card-body{padding:20px;display:flex;flex-direction:column;gap:16px;align-items:center}
    .qr-wrap{padding:12px;border:1.5px solid #BBF7D0;border-radius:14px;background:#F0FDF4;display:inline-block}
    .scan-label{font-size:11px;font-weight:700;color:#065F46;text-align:center;margin-top:8px;letter-spacing:.06em;text-transform:uppercase}
    .url-text{font-size:9px;color:#94A3B8;text-align:center;word-break:break-all;max-width:280px;margin-top:4px}
    .benefits{width:100%;background:#F8FAF9;border-radius:12px;padding:14px}
    .benefits-title{font-weight:700;font-size:12px;color:#1D9E75;margin-bottom:8px;text-transform:uppercase;letter-spacing:.08em}
    .benefit-row{display:flex;gap:8px;align-items:flex-start;font-size:12px;color:#374151;margin-bottom:6px;line-height:1.4}
    .benefit-dot{width:6px;height:6px;background:#1D9E75;border-radius:50%;flex-shrink:0;margin-top:4px}
    .card-footer{background:#F0FDF4;padding:12px 20px;text-align:center;border-top:1px solid #BBF7D0}
    .footer-text{font-size:10px;color:#64748B;font-weight:600}
    @media print{body{padding:0}.card{border:2px solid #BBF7D0;box-shadow:none}}
  </style>
</head>
<body>
<div class="card">
  <div class="card-header">
    <div class="card-logo">🌿 NutriPrint Recipe Card</div>
    <div class="card-name">${safeName}</div>
    <div class="card-sub">Karnataka School Nutrition Program</div>
  </div>
  <div class="card-body">
    <div>
      <div class="qr-wrap">
        <div id="print-qr"></div>
      </div>
      <div class="scan-label">📱 Scan for full recipe</div>
      <div class="url-text">${safeUrl}</div>
    </div>
    <div class="benefits">
      <div class="benefits-title">✅ Key Nutrition Benefits</div>
      <div class="benefit-row"><div class="benefit-dot"></div>Rich in essential minerals and vitamins</div>
      <div class="benefit-row"><div class="benefit-dot"></div>Supports growth and bone development</div>
      <div class="benefit-row"><div class="benefit-dot"></div>Locally available Karnataka ingredient</div>
      <div class="benefit-row"><div class="benefit-dot"></div>Budget-friendly school meal option</div>
    </div>
  </div>
  <div class="card-footer">
    <div class="footer-text">NutriPrint V2 · Yenepoya Institute of Technology · nutriprint.app</div>
  </div>
</div>
<script>
  window.addEventListener('load', function() {
    new QRCode(document.getElementById('print-qr'), {
      text: '${safeUrl}',
      width: 140, height: 140,
      colorDark: '#0F5E46', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M
    });
    setTimeout(function() { window.print(); }, 800);
  });
<\/script>
</body></html>`);
    win.document.close();
  }

  /* ── Auto-init ──────────────────────────────────────────────────────────── */

  /**
   * On DOMContentLoaded, render any element with [data-qr-render] attribute.
   * <div data-qr-render data-qr-food="Ragi Mudde" data-qr-size="120"></div>
   */
  function initPage() {
    document.querySelectorAll('[data-qr-render]').forEach(el => {
      const foodName = el.dataset.qrFood;
      const size     = parseInt(el.dataset.qrSize, 10) || 120;
      if (!foodName) return;
      generate(el, recipeUrl(foodName), size);
    });
  }

  document.addEventListener('DOMContentLoaded', initPage);

  /* ── Export ─────────────────────────────────────────────────────────────── */
  window.NutriQR = {
    slug,
    recipeUrl,
    generate,
    downloadQR,
    buildFoodCardQR,
    buildMealItemQR,
    initPage,
    _toggleCardQR,
    _printRecipeCard,
  };

})();

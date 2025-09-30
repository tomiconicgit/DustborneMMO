// file: src/ui/ItemIcons.js
// Procedurally renders a stylized COPPER CHUNK inventory icon to a transparent PNG,
// then dispatches:  window.dispatchEvent(new CustomEvent('icon:copper-ready', { detail: { dataURL } }));
//
// Style notes:
//  - Faceted nugget silhouette (not the in-world rock).
//  - Coppery gradient, rim light, subtle inner line-work and specular sparkles.
//  - Square icon, transparent background, crisp at 256px.
//
// You can call generateCopperChunkIcon(size) yourself later if needed.

export default class ItemIcons {
  static main = null;

  static async create() {
    if (!ItemIcons.main) ItemIcons.main = new ItemIcons();
    // Generate once at boot
    const dataURL = ItemIcons.main.generateCopperChunkIcon(256);
    window.dispatchEvent(new CustomEvent('icon:copper-ready', { detail: { dataURL } }));
  }

  // --- helpers ---------------------------------------------------------------

  _poly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  _facet(ctx, pts, fill, stroke = null, lineWidth = 1) {
    this._poly(ctx, pts);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
  }

  // Slight random jitter for more "natural" edges
  _jitter(pts, mag) {
    return pts.map(([x, y]) => [x + (Math.random() * 2 - 1) * mag, y + (Math.random() * 2 - 1) * mag]);
  }

  // --- icon generator --------------------------------------------------------

  generateCopperChunkIcon(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Transparent background by default.

    // Centered viewport
    const cx = size * 0.5;
    const cy = size * 0.5;
    const s  = size * 0.34; // overall scale of the nugget

    // Base copper colors
    const copperMid   = '#c9712b';
    const copperDark  = '#7a3d1a';
    const copperDeep  = '#592a13';
    const copperLite  = '#e99b57';
    const copperEdge  = '#f6c08a';

    // Silhouette (irregular hex-ish)
    let shell = [
      [cx - 0.95*s, cy - 0.10*s],
      [cx - 0.50*s, cy - 0.85*s],
      [cx + 0.55*s, cy - 0.75*s],
      [cx + 0.95*s, cy + 0.05*s],
      [cx + 0.35*s, cy + 0.85*s],
      [cx - 0.60*s, cy + 0.75*s],
    ];
    shell = this._jitter(shell, s*0.04);

    // Fill with radial copper gradient
    const g = ctx.createRadialGradient(cx - 0.15*s, cy - 0.2*s, s*0.1, cx, cy, s*1.2);
    g.addColorStop(0.00, copperEdge);
    g.addColorStop(0.35, copperLite);
    g.addColorStop(0.75, copperMid);
    g.addColorStop(1.00, copperDark);

    this._facet(ctx, shell, g);

    // Inner facet network (3–4 chunky planes)
    const f1 = this._jitter([
      [cx - 0.55*s, cy - 0.15*s],
      [cx - 0.25*s, cy - 0.55*s],
      [cx + 0.25*s, cy - 0.45*s],
      [cx + 0.10*s, cy - 0.05*s],
    ], s*0.02);

    const f2 = this._jitter([
      [cx - 0.40*s, cy + 0.20*s],
      [cx + 0.05*s, cy - 0.05*s],
      [cx + 0.40*s, cy + 0.05*s],
      [cx + 0.15*s, cy + 0.45*s],
      [cx - 0.20*s, cy + 0.45*s],
    ], s*0.02);

    const f3 = this._jitter([
      [cx - 0.10*s, cy - 0.05*s],
      [cx + 0.30*s, cy - 0.35*s],
      [cx + 0.65*s, cy - 0.05*s],
      [cx + 0.30*s, cy + 0.15*s],
    ], s*0.02);

    const facGrad = (ax, ay, bx, by, c0, c1) => {
      const gg = ctx.createLinearGradient(ax, ay, bx, by);
      gg.addColorStop(0, c0);
      gg.addColorStop(1, c1);
      return gg;
    };

    this._facet(ctx, f1, facGrad(cx-0.55*s, cy-0.55*s, cx+0.25*s, cy-0.05*s, copperLite, copperDeep));
    this._facet(ctx, f2, facGrad(cx-0.40*s, cy+0.45*s, cx+0.40*s, cy-0.05*s, copperMid, copperDark));
    this._facet(ctx, f3, facGrad(cx+0.65*s, cy-0.05*s, cx-0.10*s, cy-0.05*s, copperLite, copperMid));

    // Rim light on top-left edge
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = 'rgba(255, 235, 210, 0.65)';
    ctx.lineWidth = Math.max(1, size * 0.015);
    this._poly(ctx, [
      shell[1],
      shell[0],
      shell[5],
    ]);
    ctx.stroke();
    ctx.restore();

    // Inner thin strokes to sell facets (very subtle)
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, size * 0.006);
    [f1, f2, f3].forEach(f => { this._poly(ctx, f); ctx.stroke(); });
    ctx.restore();

    // Specular sparkles (a few small glints)
    const sparkle = (x, y, r) => {
      const lg = ctx.createRadialGradient(x, y, 0, x, y, r);
      lg.addColorStop(0, 'rgba(255,255,255,0.9)');
      lg.addColorStop(0.4, 'rgba(255,255,255,0.5)');
      lg.addColorStop(1, 'rgba(255,255,255,0.0)');
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI*2);
      ctx.fill();
    };
    sparkle(cx - 0.10*s, cy - 0.30*s, size * 0.02);
    sparkle(cx + 0.18*s, cy + 0.10*s, size * 0.018);
    sparkle(cx - 0.22*s, cy + 0.22*s, size * 0.014);

    // Very subtle shadow under nugget for depth (still transparent bg)
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    const sh = ctx.createRadialGradient(cx, cy + 0.35*s, 0, cx, cy + 0.35*s, 0.9*s);
    sh.addColorStop(0, 'rgba(0,0,0,0.20)');
    sh.addColorStop(1, 'rgba(0,0,0,0.00)');
    ctx.fillStyle = sh;
    ctx.beginPath();
    ctx.arc(cx, cy + 0.35*s, 0.9*s, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();

    return canvas.toDataURL('image/png');
  }
}
/**
 * Fleet poster (S44): a shareable PNG of an airline's liveries and stats.
 * Layout is pure maths per format so both sizes render identically every
 * time; drawing only reads the layout.
 */

export const POSTER_FORMATS = {
  portrait: { width: 1080, height: 1350, columns: 3, rows: 3 },
  landscape: { width: 1200, height: 630, columns: 4, rows: 2 },
} as const;

export type PosterFormat = keyof typeof POSTER_FORMATS;

export interface PosterInput {
  airlineName: string;
  icaoCode: string;
  colors: { primary: string; secondary: string; accent: string };
  stats: Array<{ label: string; value: string }>;
  liveries: Array<{ name: string; imageUrl?: string | null }>;
  footer: string;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PosterLayout {
  width: number;
  height: number;
  band: Rect;
  title: { x: number; y: number; size: number };
  subtitle: { x: number; y: number; size: number };
  stats: Array<{ x: number; y: number; valueSize: number; labelSize: number }>;
  cells: Rect[];
  footer: { x: number; y: number; size: number };
}

/** Space between a stat's value and its label. */
export const STAT_LINE_GAP = 6;

export function layoutFleetPoster(format: PosterFormat, statCount = 3): PosterLayout {
  const { width, height, columns, rows } = POSTER_FORMATS[format];
  const unit = Math.min(width, height) / 100; // ~6–11 px
  const pad = Math.round(unit * 6);
  const titleSize = Math.round(unit * 8);
  const subtitleSize = Math.round(unit * 3);
  const statValueSize = Math.round(unit * 5);
  const statLabelSize = Math.round(unit * 2.2);
  const footerSize = Math.round(unit * 2.6);
  const gap = Math.round(unit * 2);

  // Header flows top-down: title, subtitle, then stats; the band wraps it.
  const titleY = pad + titleSize;
  const subtitleY = titleY + Math.round(unit * 4.5);
  const statsY = subtitleY + 2 * gap + statValueSize + STAT_LINE_GAP + statLabelSize;
  const bandHeight = statsY + pad;

  const statsWidth = width - 2 * pad;
  const stats = Array.from({ length: statCount }, (_, i) => ({
    x: pad + Math.round((statsWidth / statCount) * i),
    y: statsY,
    valueSize: statValueSize,
    labelSize: statLabelSize,
  }));

  const gridTop = bandHeight + pad;
  const gridBottom = height - pad - footerSize - gap;
  const cellW = Math.floor((width - 2 * pad - (columns - 1) * gap) / columns);
  const cellH = Math.floor((gridBottom - gridTop - (rows - 1) * gap) / rows);
  const cells: Rect[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < columns; c += 1) {
      cells.push({
        x: pad + c * (cellW + gap),
        y: gridTop + r * (cellH + gap),
        w: cellW,
        h: cellH,
      });
    }
  }

  return {
    width,
    height,
    band: { x: 0, y: 0, w: width, h: bandHeight },
    title: { x: pad, y: titleY, size: titleSize },
    subtitle: { x: pad, y: subtitleY, size: subtitleSize },
    stats,
    cells,
    footer: { x: pad, y: height - pad, size: footerSize },
  };
}

/** The subset of the canvas 2D API the poster uses (so tests can record calls). */
export interface PosterContext {
  fillStyle: string | CanvasGradient | CanvasPattern;
  font: string;
  textBaseline: CanvasTextBaseline;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number, maxWidth?: number): void;
  drawImage(
    image: CanvasImageSource,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  save(): void;
  restore(): void;
}

export interface PosterImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** Source rect that covers `cell` without distortion (centre crop). */
export function coverCrop(
  image: { width: number; height: number },
  cell: { w: number; h: number },
) {
  const scale = Math.max(cell.w / image.width, cell.h / image.height);
  const sw = cell.w / scale;
  const sh = cell.h / scale;
  return { sx: (image.width - sw) / 2, sy: (image.height - sh) / 2, sw, sh };
}

const FONT = "system-ui, -apple-system, 'Segoe UI', sans-serif";

export function drawFleetPoster(
  ctx: PosterContext,
  layout: PosterLayout,
  input: PosterInput,
  images: ReadonlyArray<PosterImage | null>,
) {
  ctx.save();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, layout.width, layout.height);
  ctx.fillStyle = input.colors.primary;
  ctx.fillRect(layout.band.x, layout.band.y, layout.band.w, layout.band.h);

  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${layout.title.size}px ${FONT}`;
  ctx.fillText(
    input.airlineName,
    layout.title.x,
    layout.title.y,
    layout.width - 2 * layout.title.x,
  );
  ctx.fillStyle = input.colors.accent;
  ctx.font = `600 ${layout.subtitle.size}px ${FONT}`;
  ctx.fillText(input.icaoCode, layout.subtitle.x, layout.subtitle.y);

  layout.stats.forEach((slot, i) => {
    const stat = input.stats[i];
    if (!stat) return;
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${slot.valueSize}px ${FONT}`;
    ctx.fillText(stat.value, slot.x, slot.y - slot.labelSize - STAT_LINE_GAP);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = `600 ${slot.labelSize}px ${FONT}`;
    ctx.fillText(stat.label.toUpperCase(), slot.x, slot.y);
  });

  layout.cells.forEach((cell, i) => {
    const livery = input.liveries[i];
    if (!livery) return;
    const image = images[i];
    if (image) {
      const crop = coverCrop(image, cell);
      ctx.drawImage(
        image.source,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        cell.x,
        cell.y,
        cell.w,
        cell.h,
      );
    } else {
      ctx.fillStyle = input.colors.primary;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = `${Math.round(cell.h * 0.35)}px ${FONT}`;
      ctx.fillText("✈", cell.x + cell.w * 0.4, cell.y + cell.h * 0.62);
    }
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    const captionH = Math.round(layout.footer.size * 1.8);
    ctx.fillRect(cell.x, cell.y + cell.h - captionH, cell.w, captionH);
    ctx.fillStyle = "#ffffff";
    ctx.font = `600 ${layout.footer.size}px ${FONT}`;
    ctx.fillText(livery.name, cell.x + 10, cell.y + cell.h - captionH * 0.3, cell.w - 20);
  });

  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `600 ${layout.footer.size}px ${FONT}`;
  ctx.fillText(input.footer, layout.footer.x, layout.footer.y);
  ctx.restore();
}

/** Loads livery images CORS-clean (so the canvas stays exportable); failures become null. */
export function loadPosterImages(
  urls: ReadonlyArray<string | null | undefined>,
): Promise<Array<PosterImage | null>> {
  return Promise.all(
    urls.map(
      (url) =>
        new Promise<PosterImage | null>((resolve) => {
          if (!url) {
            resolve(null);
            return;
          }
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () =>
            resolve({ source: img, width: img.naturalWidth, height: img.naturalHeight });
          img.onerror = () => resolve(null);
          img.src = url;
        }),
    ),
  );
}

export function posterFileName(airlineName: string, format: PosterFormat): string {
  const slug =
    airlineName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "airline";
  const { width, height } = POSTER_FORMATS[format];
  return `${slug}-fleet-${width}x${height}.png`;
}

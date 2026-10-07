/**
 * Low-power rendering (S54). Without GPU acceleration a globe frame costs
 * hundreds of milliseconds, so redrawing even 5 times a second starves the
 * page. Low-power mode slows the map clock to one tick a second, stops the
 * decorative route flow and renders at 1× pixel ratio; aircraft still move.
 *
 * It switches on when the WebGL renderer is a software one, or when frames
 * are measured to be slow.
 */

/** Map-clock period in low-power mode. */
export const LOW_POWER_CLOCK_MS = 1000;

const SOFTWARE_RENDERERS = /swiftshader|llvmpipe|softpipe|software|basic render driver/i;

/** Whether a WebGL renderer string names a software rasteriser. */
export function isSoftwareRenderer(renderer: string | null | undefined): boolean {
  return Boolean(renderer && SOFTWARE_RENDERERS.test(renderer));
}

/** The unmasked WebGL renderer string, when the browser exposes it. */
export function webglRenderer(
  gl: Pick<WebGLRenderingContext, "getExtension" | "getParameter"> | null | undefined,
): string | null {
  if (!gl) return null;
  try {
    const info = gl.getExtension("WEBGL_debug_renderer_info") as {
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const value = gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : 0x1f01 /* RENDERER */);
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Watches frame cost: the time from a map write to the next animation
 * frame, which includes the redraw it caused. That cost doesn't depend on
 * how often we draw, so the mode doesn't oscillate. Slow frames (smoothed
 * cost above `slowMs`) switch low-power on; it switches off only after a
 * clearly fast stretch (below `fastMs`).
 */
export class FrameCostGovernor {
  private average: number | null = null;
  private fastSamples = 0;
  lowPower: boolean;
  private readonly slowMs: number;
  private readonly fastMs: number;
  private readonly fastSamplesToRecover: number;

  constructor({
    lowPower = false,
    slowMs = 100,
    fastMs = 40,
    fastSamplesToRecover = 20,
  }: { lowPower?: boolean; slowMs?: number; fastMs?: number; fastSamplesToRecover?: number } = {}) {
    this.lowPower = lowPower;
    this.slowMs = slowMs;
    this.fastMs = fastMs;
    this.fastSamplesToRecover = fastSamplesToRecover;
  }

  /** Records one frame's cost; returns whether low-power mode is on. */
  sample(costMs: number): boolean {
    this.average = this.average === null ? costMs : this.average * 0.8 + costMs * 0.2;
    if (!this.lowPower && this.average > this.slowMs) {
      this.lowPower = true;
      this.fastSamples = 0;
    } else if (this.lowPower) {
      this.fastSamples = costMs < this.fastMs ? this.fastSamples + 1 : 0;
      if (this.fastSamples >= this.fastSamplesToRecover) {
        this.lowPower = false;
        this.fastSamples = 0;
      }
    }
    return this.lowPower;
  }
}

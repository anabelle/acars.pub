import { describe, expect, it } from "vitest";
import {
  FrameCostGovernor,
  isSoftwareRenderer,
  RENDER_MODE_STORAGE_KEY,
  readRenderModeOverride,
  webglRenderer,
} from "./renderMode";

describe("isSoftwareRenderer()", () => {
  it("recognises software rasterisers", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "Microsoft Basic Render Driver",
      "Software Rasterizer",
    ]) {
      expect(isSoftwareRenderer(name)).toBe(true);
    }
  });

  it("leaves real GPUs and unknowns alone", () => {
    for (const name of [
      "ANGLE (Apple, Apple M1, OpenGL 4.1)",
      "NVIDIA GeForce RTX 3060",
      "",
      null,
    ]) {
      expect(isSoftwareRenderer(name)).toBe(false);
    }
  });
});

describe("webglRenderer()", () => {
  it("prefers the unmasked renderer", () => {
    const gl = {
      getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 0x9246 }),
      getParameter: (p: number) => (p === 0x9246 ? "llvmpipe" : "WebKit WebGL"),
    };
    expect(webglRenderer(gl as never)).toBe("llvmpipe");
  });

  it("falls back to RENDERER, and survives a missing or throwing context", () => {
    const gl = { getExtension: () => null, getParameter: () => "WebKit WebGL" };
    expect(webglRenderer(gl as never)).toBe("WebKit WebGL");
    expect(webglRenderer(null)).toBeNull();
    const broken = {
      getExtension: () => {
        throw new Error("lost");
      },
      getParameter: () => null,
    };
    expect(webglRenderer(broken as never)).toBeNull();
  });
});

describe("FrameCostGovernor", () => {
  it("switches low-power on when frames are slow", () => {
    const governor = new FrameCostGovernor();
    expect(governor.sample(16)).toBe(false);
    let on = false;
    for (let i = 0; i < 10 && !on; i++) on = governor.sample(250);
    expect(on).toBe(true);
  });

  it("ignores a single slow frame", () => {
    const governor = new FrameCostGovernor();
    for (let i = 0; i < 10; i++) governor.sample(16);
    expect(governor.sample(300)).toBe(false);
  });

  it("recovers only after a sustained fast stretch", () => {
    const governor = new FrameCostGovernor({ lowPower: true, fastSamplesToRecover: 5 });
    for (let i = 0; i < 4; i++) expect(governor.sample(10)).toBe(true);
    expect(governor.sample(200)).toBe(true); // a slow frame resets the count
    for (let i = 0; i < 4; i++) governor.sample(10);
    expect(governor.sample(10)).toBe(false);
  });
});

describe("readRenderModeOverride()", () => {
  const storage = (value: string | null) => ({
    getItem: (key: string) => (key === RENDER_MODE_STORAGE_KEY ? value : null),
  });

  it("reads a forced mode", () => {
    expect(readRenderModeOverride(storage("low"))).toBe("low");
    expect(readRenderModeOverride(storage("full"))).toBe("full");
  });

  it("is automatic otherwise, even when storage is missing or throws", () => {
    expect(readRenderModeOverride(storage(null))).toBeNull();
    expect(readRenderModeOverride(storage("turbo"))).toBeNull();
    expect(readRenderModeOverride(null)).toBeNull();
    expect(
      readRenderModeOverride({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBeNull();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StateCreator } from "zustand";
import type { AirlineState } from "../types";
import { createIdentitySlice } from "./identitySlice";
import { hydrateIdentityFromStorage } from "../localLoader";

vi.mock("../localLoader", () => ({
  hydrateIdentityFromStorage: vi.fn(),
}));

const loginWithNsecMock = vi.fn();

vi.mock("@acars/nostr", () => ({
  attachSigner: vi.fn(),
  ensureConnected: vi.fn(),
  getPubkey: vi.fn(() => Promise.resolve("pubkey-1")),
  loginWithNsec: (...args: unknown[]) => loginWithNsecMock(...args),
  publishAction: vi.fn(),
  waitForNip07: vi.fn(() => Promise.resolve(true)),
}));

vi.mock("../engine", () => ({
  useEngineStore: {
    getState: vi.fn(() => ({
      tick: 100000,
    })),
  },
}));

const createSliceState = (overrides: Partial<AirlineState> = {}) => {
  const state = {
    pubkey: null,
    identityStatus: "checking",
    isLoading: false,
    error: null,
    airline: null,
    fleet: [],
    routes: [],
    timeline: [],
    actionChainHash: "",
    actionSeq: 0,
    latestCheckpoint: null,
    fleetDeletedDuringCatchup: [],
    initializeIdentity: vi.fn(),
    createAirline: vi.fn(),
    loginWithNsec: vi.fn(),
  } as unknown as AirlineState;

  const set = vi.fn((partial: AirlineState | ((prev: AirlineState) => Partial<AirlineState>)) => {
    const next = typeof partial === "function" ? partial(state) : partial;
    Object.assign(state, next);
  });
  const get = () => state;

  const slice = (createIdentitySlice as StateCreator<AirlineState>)(set, get, {} as never);
  Object.assign(state, slice);
  Object.assign(state, overrides);
  return { state, set };
};

beforeEach(() => {
  vi.mocked(hydrateIdentityFromStorage).mockReset();
  loginWithNsecMock.mockReset();
});

describe("identitySlice initializeIdentity", () => {
  it("initializes identity and calls hydrateIdentityFromStorage", async () => {
    const { state } = createSliceState();

    await state.initializeIdentity();

    // It should have resolved the pubkey-1 from the nostr mock
    expect(hydrateIdentityFromStorage).toHaveBeenCalledWith("pubkey-1", expect.any(Function));
    // The state isn't explicitly changed to ready here because hydrateIdentityFromStorage handles the set() calls now
  });

  it("sets guest status if extension returns no pubkey", async () => {
    const { getPubkey } = await import("@acars/nostr");
    vi.mocked(getPubkey).mockResolvedValueOnce(null);

    const { state } = createSliceState();

    await state.initializeIdentity();

    expect(state.identityStatus).toBe("guest");
    expect(hydrateIdentityFromStorage).not.toHaveBeenCalled();
  });
});

describe("identitySlice loginWithNsec", () => {
  it("hydrates identity after successful nsec login", async () => {
    loginWithNsecMock.mockResolvedValueOnce("pubkey-2");

    const { state } = createSliceState({
      pubkey: "old-pubkey",
      identityStatus: "ready",
    });

    await state.loginWithNsec("nsec1valid");

    expect(loginWithNsecMock).toHaveBeenCalledWith("nsec1valid");
    expect(hydrateIdentityFromStorage).toHaveBeenCalledWith("pubkey-2", expect.any(Function));
  });

  it("exposes a fixed user-facing error when nsec login fails", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    loginWithNsecMock.mockRejectedValueOnce(new Error("library details"));
    const { state } = createSliceState({ identityStatus: "ready" });

    await state.loginWithNsec("bad-key");

    expect(state.error).toBe("Invalid nsec key.");
    expect(state.identityStatus).toBe("ready");
    expect(state.isLoading).toBe(false);
    warnSpy.mockRestore();
  });
});

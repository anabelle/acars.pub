import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getPublicKeyMock = vi.fn();
const signerMock = vi.fn();
const privateSignerCtorMock = vi.fn();
const privateSignerUserMock = vi.fn();
const ndk = { signer: null as unknown };

vi.mock("@nostr-dev-kit/ndk", () => {
  return {
    NDKNip07Signer: class {
      constructor(...args: unknown[]) {
        signerMock(...args);
      }
    },
    NDKPrivateKeySigner: class {
      constructor(...args: unknown[]) {
        privateSignerCtorMock(...args);
      }

      user() {
        return privateSignerUserMock();
      }
    },
  };
});

vi.mock("./ndk.js", () => {
  return {
    getNDK: () => ndk,
  };
});

import { attachSigner, getPubkey, hasNip07, loginWithNsec, waitForNip07 } from "./identity.js";

describe("identity", () => {
  beforeEach(() => {
    getPublicKeyMock.mockReset();
    signerMock.mockReset();
    privateSignerCtorMock.mockReset();
    privateSignerUserMock.mockReset();
    ndk.signer = null;
    delete (globalThis as any).window;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("detects missing NIP-07 extension", () => {
    expect(hasNip07()).toBe(false);
  });

  it("detects available NIP-07 extension", () => {
    (globalThis as any).window = { nostr: { getPublicKey: getPublicKeyMock } };
    expect(hasNip07()).toBe(true);
  });

  it("waits for NIP-07 extension and resolves true when available", async () => {
    (globalThis as any).window = { nostr: { getPublicKey: getPublicKeyMock } };
    const result = await waitForNip07(10);
    expect(result).toBe(true);
  });

  it("returns null when getPublicKey times out", async () => {
    vi.useFakeTimers();
    (globalThis as any).window = {
      nostr: {
        getPublicKey: () => new Promise<string>(() => {}),
      },
    };

    const promise = getPubkey(4000);
    vi.advanceTimersByTime(4000);
    const result = await promise;
    expect(result).toBeNull();
  });

  it("attaches a new signer when available", () => {
    (globalThis as any).window = { nostr: { getPublicKey: getPublicKeyMock } };
    attachSigner();
    expect(signerMock).toHaveBeenCalledWith(15000);
  });

  it("loginWithNsec validates before attaching signer", async () => {
    let resolveUser: ((value: { pubkey: string }) => void) | null = null;
    privateSignerUserMock.mockImplementation(
      () =>
        new Promise<{ pubkey: string }>((resolve) => {
          resolveUser = resolve;
        }),
    );

    const promise = loginWithNsec("  nsec1valid  ");
    expect(privateSignerCtorMock).toHaveBeenCalledWith("nsec1valid");
    expect(ndk.signer).toBeNull();

    if (!resolveUser) throw new Error("Expected signer.user resolver");
    resolveUser({ pubkey: "pubkey-1" });

    await expect(promise).resolves.toBe("pubkey-1");
    expect(ndk.signer).not.toBeNull();
  });

  it("loginWithNsec keeps signer unset on invalid key", async () => {
    privateSignerUserMock.mockRejectedValueOnce(new Error("invalid nsec"));

    await expect(loginWithNsec("nsec1bad")).rejects.toThrow("invalid nsec");
    expect(ndk.signer).toBeNull();
  });
});

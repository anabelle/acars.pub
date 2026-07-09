import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => {
  const uploadMock = vi.fn();
  const blossomInstance = { upload: uploadMock };
  const BlossomCtor = vi.fn(() => blossomInstance);
  return { BlossomCtor, blossomInstance, uploadMock };
});

vi.mock("./ndk.js", () => ({
  // getNDK returns an object whose `signer` we control per-test via ndkMock.
  getNDK: () => ndkMock,
}));

vi.mock("@nostr-dev-kit/ndk-blossom", () => ({
  default: mock.BlossomCtor,
}));

import { uploadToBlossom } from "./blossom.js";

const ndkMock = {
  signer: {} as unknown,
};

beforeEach(() => {
  ndkMock.signer = {};
  mock.BlossomCtor.mockClear();
  mock.uploadMock.mockReset();
});

describe("uploadToBlossom", () => {
  it("throws when NDK has no signer", async () => {
    ndkMock.signer = undefined;
    await expect(uploadToBlossom(new Blob(["x"]), "f.png")).rejects.toThrow("no signer");
  });

  it("uploads the blob and returns the blossom URL", async () => {
    mock.uploadMock.mockResolvedValue({ url: "https://blossom.example/file.png" });
    const url = await uploadToBlossom(
      new Blob([new Uint8Array([1, 2, 3])]),
      "plane.png",
      "image/png",
    );
    expect(url).toBe("https://blossom.example/file.png");
    expect(mock.BlossomCtor).toHaveBeenCalledTimes(1);
    // The uploaded value is a File constructed from the blob + filename + mime.
    const [file, opts] = mock.uploadMock.mock.calls[0];
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe("plane.png");
    expect((file as File).type).toBe("image/png");
    expect(opts).toMatchObject({ server: "https://blossom.primal.net", maxRetries: 3 });
  });

  it("throws when the upload resolves without a URL", async () => {
    mock.uploadMock.mockResolvedValue({ url: undefined });
    await expect(uploadToBlossom(new Blob(["x"]), "f.png")).rejects.toThrow("no URL");
  });
});

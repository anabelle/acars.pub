import { cleanup, render, screen } from "@testing-library/react";
import { nip19 } from "nostr-tools";
import { afterEach, describe, expect, it, vi } from "vitest";

const params: { npub?: string } = {};
vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useParams: () => params,
  useNavigate: () => vi.fn(),
}));
vi.mock("@/features/airline/components/PublicAirlinePage", () => ({
  PublicAirlinePage: ({ pubkey }: { pubkey: string }) => <p>airline {pubkey}</p>,
}));

import AirlinePage from "./-airline.$npub.lazy";

afterEach(cleanup);

describe("/airline/$npub", () => {
  it("decodes the npub", () => {
    params.npub = nip19.npubEncode("c".repeat(64));
    render(<AirlinePage />);
    expect(screen.getByText(`airline ${"c".repeat(64)}`)).toBeInTheDocument();
  });

  it("explains an invalid link", () => {
    params.npub = "nonsense";
    render(<AirlinePage />);
    expect(screen.getByTestId("public-airline-status")).toHaveTextContent(
      "isn't a valid airline link",
    );
  });
});

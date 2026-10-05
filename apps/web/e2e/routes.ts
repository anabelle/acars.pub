/** Every top-level surface a guest can reach, with a file-safe slug. */
export const GUEST_ROUTES: ReadonlyArray<{ slug: string; path: string }> = [
  { slug: "home", path: "/" },
  { slug: "home-cockpit", path: "/?panel=cockpit" },
  { slug: "join", path: "/join" },
  { slug: "network", path: "/network" },
  { slug: "fleet", path: "/fleet" },
  { slug: "leaderboard", path: "/leaderboard" },
  { slug: "corporate", path: "/corporate" },
  { slug: "about", path: "/about" },
  { slug: "airport-MAD", path: "/airport/MAD" },
];

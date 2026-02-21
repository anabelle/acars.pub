# 🖥 UI/UX & Cross-Platform Architecture
## The "Universal Web" Strategy for AirTR

The MVP React application was a quick prototype to prove the decentralized engine. To achieve the "Planetary Scale" ambition defined in the Design Bible, we need an opinionated, robust, and fiercely scalable UI architecture. 

We cannot afford brittle CSS, broken routes, or duplicate codebases for Mobile and Desktop.

This document outlines the architecture for the **New Frontend Layer** of AirTR.

---

## 1. The UX Vision: "Bloomberg Terminal meets Flightradar24"

AirTR is an idle-management financial MMO. The UI must feel less like a casual mobile game and more like a high-end corporate dashboard. 
- **Dark Mode Default**: Slate/zinc backgrounds with vibrant neon accents for routes and monetary values.
- **Data Density**: High data density using strict typography (e.g., *Inter* or *Geist*).
- **Infinite Virtualization**: Lists of 10,000 aircraft must scroll flawlessly at 60fps.
- **Glassmorphism & Maps**: The underlying layer is always the dynamic, live WebGL world map. UI panels float above it using glassmorphic backgrounds (`backdrop-blur`).

---

## 2. The Cross-Platform Strategy

Instead of maintaining separate Swift/Kotlin code, or fighting the React Native bridge with heavy WebGL mapping libraries, we will use the **"Universal Web"** approach. We write the UI once, and wrap it natively.

| Target | Technology | Why it's the right choice |
| :--- | :--- | :--- |
| **Web Browser** | **Vite + PWA** | Frictionless onboarding via URL. Zero installation required. |
| **Desktop (Mac/Win/Lin)** | **Tauri (Rust)** | Wraps the web bundle in a lightweight OS window. Gives us direct multi-threading for the heavy $O(1)$ math and raw TCP WebSocket speeds for Nostr, bypassing browser limitations. |
| **Mobile (iOS/Android)** | **Capacitor** | Wraps the web bundle for the App Stores. Allows access to native Haptics (vibrating when buying a plane or receiving a Zap) and Push Notifications for when a dividend is issued. |

Since AirTR relies entirely on purely deterministic client-side mathematics and Nostr WebSockets, wrapping a highly optimized React/Vite/WebGL bundle is the most predictable and performant path.

---

## 3. The Opinionated Frontend Stack

To ensure that any AI Agent or human contributor can build predictably, we are standardizing on the following hyper-opinionated stack:

### 3.1 Routing: TanStack Router
*Why:* It is 100% type-safe. It generates a route tree dynamically. An AI agent cannot accidentally link to a broken page (`/airline/abc` instead of `/airlines/abc`) because the TypeScript compiler will immediately fail. It is the most robust routing solution for complex web apps in 2024/2025.

### 3.2 UI Components: Tailwind CSS + shadcn/ui
*Why:* Traditional CSS (`index.css`) becomes brittle and spaghetti-like at scale. Tailwind provides strict design tokens constraint. **shadcn/ui** provides accessible (Radix UI), beautifully designed base components that AI agents inherently understand and can compose without writing custom CSS.

### 3.3 State & Data: Zustand + TanStack Query
*Why:* 
- `Zustand`: For synchronous, global engine state (the current Tick, the Airline Entity).
- `TanStack Query`: For asynchronous data fetching from Nostr relays (e.g., retrieving historical price data for a stock chart, or querying the global leaderboard).

### 3.4 The Map: MapLibre GL JS + react-map-gl
*Why:* Mapbox is proprietary and expensive. MapLibre is open-source, highly performant WebGL, and can render 100,000 pulsing route lines instantly without destroying device battery.

### 3.5 Virtualization: TanStack Virtual
*Why:* DOM nodes are the enemy of performance. If a player looks at the global Fleet Market (used aircraft), there might be 5,000 items. `tanstack/react-virtual` ensures only the 15 items visible on screen actually exist in HTML.

---

## 4. Feature-Sliced Directory Structure

The new `apps/web` will abandon the flat `components/` folder for a predictably scalable **Feature-Sliced Design**. Agents will know exactly where code belongs.

```text
apps/web/
├── src/
│   ├── app/                # Global app setup (Providers, Router init)
│   ├── routes/             # TanStack Router file-based route definitions
│   ├── shared/             # Reusable UI (shadcn buttons, cards, layout layers)
│   │   ├── components/     # e.g., <Button>, <Dialog>, <MapBase>
│   │   └── lib/            # utils, cn() for tailwind
│   └── features/           # The Core Game Modules
│       ├── identity/       # Nostr login, NIP-07, Key setup
│       ├── corporate/      # Stock charts, M&A, Dividends, IPO
│       ├── fleet/          # Buy/Sell aircraft, Maintenance schedules
│       └── network/        # Route creation, Hubs, Map overlays
```

### Anatomy of a Feature
Each feature acts as a mini-library. If an agent is working on the Fleet Manager, they don't touch code anywhere else.
```text
features/fleet/
├── components/       # <AircraftList>, <UsedMarketTable>
├── hooks/            # useFleetValuation(), useBuyAircraft()
├── utils.ts          # Fleet-specific pure functions
└── index.ts          # Public exports for the rest of the app
```

---

## 5. Gamification / Engageability Loops

A robust UI isn't just about code—it's about dopamine. 

1. **The Nostr "Zap" Button**: Deeply integrated throughout the UI. If you see a competing CEO on the leaderboard, you can ⚡ Zap them real Sats directly from the UI.
2. **Haptic Feedback**: Leveraging Capacitor's Haptic API. When a major event occurs (your company IPOs, or a hostile takeover begins), the device physically reacts.
3. **Live Ticker Tape**: A constant, scrolling marquee at the bottom of the screen showing global Nostr events: *"✈️ [SkyNova] just purchased an A380"*, *"📉 [Oceanic] has filed Chapter 11"*.

---

This architecture prevents the app from becoming a legacy burden. By relying strictly on type-safe routing, atomic Tailwind styling, and standard feature slices, future agents can confidently add massive new corporate modules without breaking the existing UI.

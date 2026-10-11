import { AlertList, DayStrip, Readout } from "@/shared/ui/cockpit";
import { PaxCrowd, Sign, Slab } from "@/shared/ui/ramp";

const PIXEL_MAGENTA = "#C061CB";

/** The Cockpit + Ramp kit (S59): every piece in both of its modes. */
export default function KitPage() {
  return (
    <div className="flex min-h-full flex-col lg:flex-row" data-testid="kit">
      <section
        aria-label="Ramp"
        className="ramp-ground flex flex-1 flex-col gap-5 p-4 text-ramp-paint sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Sign variant="direction" arrow="left">
            Live
          </Sign>
          <Sign variant="location">Hangar</Sign>
          <Sign variant="direction" arrow="right">
            Lines
          </Sign>
          <Sign variant="mandatory">Hold</Sign>
        </div>

        <Slab edge="sign" className="flex flex-col gap-2 p-3">
          <span className="font-sign text-xl font-extrabold uppercase tracking-[0.06em]">
            Dorado
          </span>
          <DayStrip
            colour={PIXEL_MAGENTA}
            legs={[
              { startHour: 5.5, durationHours: 3.2 },
              { startHour: 9.2, durationHours: 3.2 },
              { startHour: 13.3, durationHours: 3.4 },
              { startHour: 17.3, durationHours: 3.4 },
            ]}
          />
          <span className="text-sm text-ramp-paint/85">
            Brought 1,062 people home on 4 Sep. 211,480 so far.
          </span>
        </Slab>

        <Slab edge="idle" className="flex flex-col gap-3 p-3">
          <span className="text-sm leading-relaxed">
            San José sold out again: <b>28 people</b> stayed behind. Mariposa is idle at Panama
            City.
          </span>
          <PaxCrowd
            segments={[
              { count: 412, tone: "paint", label: "boarded" },
              { count: 46, tone: "normal", label: "connected" },
              { count: 28, tone: "caution", label: "stayed behind" },
            ]}
          />
          <button
            type="button"
            className="min-h-10 self-start rounded-[3px] bg-sign-yellow px-3 font-sign text-sm font-extrabold uppercase tracking-[0.06em] text-sign-black"
          >
            Fly Mariposa to SJO ▶
          </button>
        </Slab>
      </section>

      <section
        aria-label="Cockpit"
        className="flex flex-1 flex-col gap-5 bg-cockpit-bg p-4 text-nd-white sm:p-8"
      >
        <div className="flex flex-wrap gap-3">
          <Readout label="GS" value="452" unit="kt" />
          <Readout label="ALT" value="FL360" />
          <Readout label="Block" value="12.4" unit="h" tone="normal" />
          <Readout label="Fuel" value="18%" tone="caution" />
          <Readout label="Selected" value="PTY" tone="selected" />
        </div>
        <AlertList
          alerts={[
            { id: "1", level: "caution", text: "KDFW TSRA · Quetzal hold 18 min" },
            { id: "2", level: "normal", text: "Landed 12:02Z · return on time" },
            { id: "3", level: "warning", text: "HK-5521 maintenance overdue" },
            { id: "4", level: "advisory", text: "METAR SKBO 101600Z 27008KT" },
          ]}
        />
        <div className="flex flex-col gap-2 rounded-[3px] border border-cockpit-line bg-cockpit-panel p-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Colours, one job each
          </span>
          <div className="flex flex-wrap gap-3 font-avionics-mono text-xs">
            <span className="text-nd-magenta">ACTIVE LEG</span>
            <span className="text-nd-cyan">SELECTION</span>
            <span className="text-nd-green">NORMAL</span>
            <span className="text-nd-amber">CAUTION</span>
            <span className="text-nd-red">WARNING</span>
            <span className="text-nd-white">DATA</span>
          </div>
        </div>
      </section>
    </div>
  );
}

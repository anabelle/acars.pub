import { FamilySilhouette } from "@/shared/components/FamilySilhouette";

type Props = {
  familyId: string;
  /** The airline's livery colours; the silhouette wears the primary. */
  primary?: string;
  secondary?: string;
};

/**
 * What stands in for a painting that does not exist yet (S60): the family
 * silhouette in the airline's colours on a cockpit panel, never an error.
 */
export function LiveryFallback({ familyId, primary = "#8A949E", secondary }: Props) {
  return (
    <div
      data-testid="livery-fallback"
      className="absolute inset-0 flex items-center justify-center overflow-hidden bg-cockpit-panel"
    >
      <span
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1"
        style={{ background: secondary ?? primary }}
      />
      <span className="h-3/4 w-3/4 opacity-60" style={{ color: primary }}>
        <FamilySilhouette familyId={familyId} className="h-full w-full -rotate-6" />
      </span>
    </div>
  );
}

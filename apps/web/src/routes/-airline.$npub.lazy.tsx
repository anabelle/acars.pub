import { useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PublicAirlinePage } from "@/features/airline/components/PublicAirlinePage";
import { parseAirlineKey } from "@/features/airline/utils/airlineKey";
import { PanelBody, PanelHeader, PanelLayout } from "@/shared/components/layout/PanelLayout";

export default function AirlinePage() {
  const { t } = useTranslation("game");
  const { npub } = useParams({ strict: false }) as { npub?: string };
  const pubkey = parseAirlineKey(npub);

  return (
    <PanelLayout>
      <PanelHeader
        title={t("publicAirline.pageTitle")}
        subtitle={t("publicAirline.pageSubtitle")}
      />
      <PanelBody className="pt-3 sm:pt-4">
        {pubkey ? (
          <PublicAirlinePage pubkey={pubkey} />
        ) : (
          <p
            className="py-16 text-center text-sm text-muted-foreground"
            data-testid="public-airline-status"
          >
            {t("publicAirline.invalid")}
          </p>
        )}
      </PanelBody>
    </PanelLayout>
  );
}

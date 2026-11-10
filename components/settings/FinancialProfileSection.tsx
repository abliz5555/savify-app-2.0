import { useRouter } from "expo-router";
import React from "react";
import { useFinancialProfile } from "@/contexts/FinanceContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

export function FinancialProfileSection() {
  const { t } = useT();
  const colors = useColors();
  const router = useRouter();
  const { data: profile, isLoading } = useFinancialProfile();

  return (
    <>
      <SectionHeader label={t("financialStatus")} colors={colors} />
      <SettingCard colors={colors}>
        <SettingRow
          label={isLoading ? "..." : profile ? t("updateFinancialProfile") : t("startFinancialSetup")}
          icon={profile ? "edit-2" : "play-circle"}
          colors={colors}
          loading={isLoading}
          onPress={isLoading ? undefined : () => router.push("/financial-setup" as any)}
        />
      </SettingCard>
    </>
  );
}

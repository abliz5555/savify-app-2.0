import { Feather } from "@expo/vector-icons";
import { APP_CONFIG } from "@/lib/config";
import Constants from "expo-constants";
import React, { useState } from "react";
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { F } from "@/components/ui";
import { Divider, ms, SectionHeader, SettingCard, SettingRow } from "./SettingHelpers";

export function LegalSection() {
  const colors = useColors();
  const { t } = useT();
  const [aboutModal, setAboutModal] = useState(false);
  const [privacyModal, setPrivacyModal] = useState(false);
  const [termsModal, setTermsModal] = useState(false);

  const handleContactSupport = () => {
    Linking.openURL(`mailto:${APP_CONFIG.SUPPORT_EMAIL}?subject=Savify%20Support%20Request`);
  };

  return (
    <>
      <SectionHeader label={t("legalSection")} colors={colors} />
      <SettingCard colors={colors}>
        <SettingRow label={t("privacyPolicy")} icon="file-text" colors={colors} onPress={() => setPrivacyModal(true)} />
        <Divider colors={colors} />
        <SettingRow label={t("termsOfService")} icon="book-open" colors={colors} onPress={() => setTermsModal(true)} />
      </SettingCard>

      <SectionHeader label={t("supportSection")} colors={colors} />
      <SettingCard colors={colors}>
        <SettingRow label={t("contactSupport")} icon="send" colors={colors} onPress={handleContactSupport} />
        <Divider colors={colors} />
        <SettingRow label={t("aboutSavify")} icon="info" colors={colors} onPress={() => setAboutModal(true)} />
      </SettingCard>

      {/* About Modal */}
      <Modal visible={aboutModal} transparent animationType="fade">
        <Pressable style={ms.centeredOverlay} onPress={() => setAboutModal(false)}>
          <Pressable style={[ms.centeredSheet, { backgroundColor: colors.card, gap: 0 }]} onPress={() => {}}>
            <Pressable
              onPress={() => setAboutModal(false)}
              style={{ position: "absolute", top: 14, right: 14, zIndex: 10, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.muted, alignItems: "center", justifyContent: "center" }}
              hitSlop={10}
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
            <View style={{ alignItems: "center", paddingBottom: 14 }}>
              <View style={{ width: 62, height: 62, borderRadius: 18, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center", marginBottom: 10 }}>
                <Feather name="zap" size={28} color={colors.accent} />
              </View>
              <Text style={[ms.sheetTitle, { color: colors.foreground, textAlign: "center" }]}>Savify</Text>
              <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, textAlign: "center", marginTop: 3 }}>
                Your smart personal finance companion
              </Text>
            </View>
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, paddingTop: 12, paddingBottom: 12, gap: 9 }}>
              {([
                { icon: "bar-chart-2", label: "Track expenses, income & net balance" },
                { icon: "target", label: "Budget goals & savings milestones" },
                { icon: "credit-card", label: "Loan tracker with payoff estimates" },
                { icon: "cpu", label: "AI financial coach (Pro)" },
              ] as const).map((f) => (
                <View key={f.icon} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: colors.accentBg, alignItems: "center", justifyContent: "center" }}>
                    <Feather name={f.icon} size={13} color={colors.accent} />
                  </View>
                  <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.foreground, flex: 1 }}>{f.label}</Text>
                </View>
              ))}
            </View>
            <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSoft, paddingTop: 12, paddingBottom: 14, gap: 7 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.mutedForeground }}>{t("appVersion")}</Text>
                <Text style={{ fontSize: 13, fontFamily: F.semibold, color: colors.foreground }}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.mutedForeground }}>Build</Text>
                <Text style={{ fontSize: 13, fontFamily: F.semibold, color: colors.foreground }}>{String(Constants.expoConfig?.extra?.buildNumber ?? "1")}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.mutedForeground }}>Support</Text>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.accent }}>{APP_CONFIG.SUPPORT_EMAIL}</Text>
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.mutedForeground }}>Legal</Text>
                <Pressable onPress={() => { setAboutModal(false); setTimeout(() => setTermsModal(true), 300); }}>
                  <Text style={{ fontSize: 13, fontFamily: F.medium, color: colors.accent }}>Terms of Service</Text>
                </Pressable>
              </View>
            </View>
            <TouchableOpacity style={[ms.saveBtn, { backgroundColor: colors.accent }]} onPress={() => setAboutModal(false)}>
              <Text style={ms.saveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Privacy Policy Modal */}
      <Modal visible={privacyModal} transparent animationType="slide">
        <Pressable style={ms.overlay} onPress={() => setPrivacyModal(false)}>
          <Pressable style={[ms.legalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[ms.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("privacyPolicy")}</Text>
              <Pressable onPress={() => setPrivacyModal(false)} style={ms.closeBtn} hitSlop={10}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, fontFamily: F.regular, color: colors.mutedForeground, marginBottom: 14 }}>Last updated: November 2026</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {([
                {
                  heading: "1. Introduction",
                  body: "Savify (\"we\", \"our\", or \"us\") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and safeguard your personal and financial information when you use the Savify mobile application. By using Savify, you agree to the practices described in this policy.",
                },
                {
                  heading: "2. Information We Collect",
                  body: "Account Information: When you register, we collect your email address and display name through our authentication provider (Supabase Auth).\n\nFinancial Data: We store the financial information you voluntarily enter, including income and expense transactions, loan records and payment history, savings goals and progress, budget goals, and recurring expenses.\n\nApp Preferences: Settings such as your preferred currency, language, and display theme are stored locally on your device and are not transmitted to our servers.",
                },
                {
                  heading: "3. How We Use Your Information",
                  body: "We use your information exclusively to:\n• Provide, operate, and maintain the Savify service\n• Sync your financial data securely across your devices\n• Display personalised financial summaries, reports, and insights\n• Send in-app notifications for recurring expenses or reminders (only when enabled by you)\n• Improve the performance and stability of the app\n\nWe do not use your financial data for advertising, profiling, or any purpose beyond delivering the Savify service to you.",
                },
                {
                  heading: "4. Data Storage",
                  body: "Your financial data is stored in Supabase, a cloud database platform that uses industry-standard AES-256 encryption at rest and TLS in transit. Supabase infrastructure is hosted on AWS and is SOC 2 Type II certified. Your data is stored in a dedicated database partition and is logically isolated — only your account can access your records. For details on Supabase's data practices, see: supabase.com/privacy",
                },
                {
                  heading: "5. Authentication",
                  body: "Account creation and login are handled by Supabase Auth, part of the same secure platform that stores your data. Passwords are never stored in plain text — they are hashed by Supabase. Session tokens are stored on your device and expire automatically. See: supabase.com/privacy",
                },
                {
                  heading: "6. Data Sharing & Third Parties",
                  body: "We do not sell, rent, trade, or share your personal or financial data with any third parties for marketing, advertising, or commercial purposes.\n\nThird-party services that process data:\n• Supabase — login and database storage (see Sections 4 and 5)\n• Google Gemini — ONLY when you choose to scan a receipt, the photo is sent to Google to read the amount and shop name. The photo is not stored by Savify. Google may use free-tier requests to improve its services, so do not scan documents with sensitive personal details.\n• Apple / RevenueCat — only to process Pro subscriptions\n\nSmart Coach tips are calculated on your phone and are never sent anywhere.",
                },
                {
                  heading: "7. Security",
                  body: "We take the security of your financial data seriously. Measures we implement include:\n• Encrypted data transmission (TLS/HTTPS) between your device and our servers\n• Encrypted storage at rest in our database\n• Logical data isolation — each account can only access its own records\n• Token-based authentication with session expiry\n\nNo method of transmission or storage is 100% secure. We encourage you to use a strong password and keep your device secure.",
                },
                {
                  heading: "8. Your Rights",
                  body: "You have the right to:\n• Access: View all your financial data within the app at any time\n• Correction: Edit or update any data you have entered\n• Deletion: Permanently delete your account and all associated data from Settings → Delete Account. Deletion happens immediately and cannot be undone\n• Portability: Request an export of your data by contacting us at " + APP_CONFIG.SUPPORT_EMAIL + "\n\nIf you are located in the European Economic Area (EEA), you may also have rights under GDPR, including the right to lodge a complaint with a supervisory authority.",
                },
                {
                  heading: "9. Children's Privacy",
                  body: "Savify is not directed to children under the age of 13. We do not knowingly collect personal information from anyone under 13. If you believe we have inadvertently collected such information, please contact us and we will promptly delete it.",
                },
                {
                  heading: "10. Changes to This Policy",
                  body: "We may update this Privacy Policy from time to time. When we make material changes, we will notify you through the app or via the email associated with your account. Continued use of Savify after changes are posted constitutes your acceptance of the updated policy.",
                },
                {
                  heading: "11. Contact",
                  body: "If you have questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us:\n\nEmail: " + APP_CONFIG.SUPPORT_EMAIL + "\n\nWe aim to respond to all privacy-related inquiries within 2 business days.",
                },
              ] as const).map((item) => (
                <View key={item.heading} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: colors.foreground, marginBottom: 5 }}>{item.heading}</Text>
                  <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, lineHeight: 20 }}>{item.body}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[ms.saveBtn, { backgroundColor: colors.accent, marginTop: 12 }]} onPress={() => setPrivacyModal(false)}>
              <Text style={ms.saveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Terms of Service Modal */}
      <Modal visible={termsModal} transparent animationType="slide">
        <Pressable style={ms.overlay} onPress={() => setTermsModal(false)}>
          <Pressable style={[ms.legalSheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[ms.handle, { backgroundColor: colors.borderSoft }]} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[ms.sheetTitle, { color: colors.foreground }]}>{t("termsOfService")}</Text>
              <Pressable onPress={() => setTermsModal(false)} style={ms.closeBtn} hitSlop={10}>
                <Feather name="x" size={15} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 11, fontFamily: F.regular, color: colors.mutedForeground, marginBottom: 14 }}>Last updated: November 2026</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {([
                {
                  heading: "1. Acceptance of Terms",
                  body: "By downloading, installing, or using Savify (\"the App\"), you agree to be bound by these Terms of Service (\"Terms\"). If you do not agree to these Terms, please do not use the App. These Terms form a legally binding agreement between you and the Savify team.",
                },
                {
                  heading: "2. Eligibility",
                  body: "You must be at least 13 years of age to use Savify. By using the App, you represent and warrant that you meet this age requirement. If you are under the age of majority in your jurisdiction, you confirm that you have parental or guardian consent to use the App.",
                },
                {
                  heading: "3. Your Account",
                  body: "You are responsible for:\n• Maintaining the confidentiality of your account credentials\n• All activity that occurs under your account\n• Ensuring that the information you provide is accurate and up to date\n• Notifying us immediately at " + APP_CONFIG.SUPPORT_EMAIL + " if you suspect unauthorised access to your account\n\nYou may not share your account with others or create accounts for purposes other than personal use.",
                },
                {
                  heading: "4. Acceptable Use",
                  body: "You agree not to:\n• Use the App for any unlawful purpose or in violation of any applicable laws\n• Attempt to gain unauthorised access to our systems or another user's data\n• Reverse engineer, decompile, or disassemble any part of the App\n• Use the App to store or transmit malicious code\n• Interfere with the App's operation or the experience of other users\n\nViolation of these restrictions may result in immediate account termination.",
                },
                {
                  heading: "5. Financial Data & Accuracy",
                  body: "Savify is a personal record-keeping tool. All financial data in the App is entered manually by you. We make no representations or warranties regarding the accuracy, completeness, or fitness for purpose of any data displayed in the App.\n\nYou are solely responsible for verifying the accuracy of any information you enter and for any decisions made based on data within the App.",
                },
                {
                  heading: "6. Not Financial Advice",
                  body: "Savify is not a licensed financial institution, investment advisor, broker, accountant, or tax advisor. Nothing in the App — including AI-generated insights, summaries, suggestions, or projections — constitutes financial, investment, tax, or legal advice.\n\nAlways consult a qualified financial professional before making significant financial decisions. We expressly disclaim any liability for financial decisions made in reliance on the App.",
                },
                {
                  heading: "7. Pro Subscription",
                  body: "Certain features of Savify require a paid Pro subscription. By subscribing:\n• You authorise us to charge the applicable fee to your payment method through the Apple App Store or Google Play\n• Subscriptions automatically renew at the end of each billing period unless cancelled at least 24 hours before the renewal date\n• You may manage or cancel your subscription at any time in your Apple ID or Google Play subscription settings\n• Refunds are handled in accordance with Apple's standard refund policy\n\nWe reserve the right to modify subscription pricing with reasonable prior notice.",
                },
                {
                  heading: "8. Intellectual Property",
                  body: "All content, features, design, trademarks, and code within Savify are the exclusive property of the Savify team or its licensors and are protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable licence to use the App for personal, non-commercial purposes. Nothing in these Terms transfers any ownership rights to you.",
                },
                {
                  heading: "9. Disclaimer of Warranties",
                  body: "The App is provided \"as is\" and \"as available\" without warranties of any kind, express or implied. We do not warrant that the App will be uninterrupted, error-free, or free of viruses. To the fullest extent permitted by applicable law, we disclaim all warranties including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.",
                },
                {
                  heading: "10. Limitation of Liability",
                  body: "To the maximum extent permitted by applicable law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages — including loss of data, loss of profits, or financial loss — arising from your use of or inability to use the App, even if we have been advised of the possibility of such damages.",
                },
                {
                  heading: "11. Termination",
                  body: "You may delete your account at any time from Settings → Delete Account. Upon deletion, your data will be permanently removed from our servers within 30 days.\n\nWe reserve the right to suspend or terminate your account without prior notice if you violate these Terms or engage in conduct that is harmful to other users, us, or third parties.",
                },
                {
                  heading: "12. Changes to Terms",
                  body: "We may update these Terms from time to time to reflect changes in the App, applicable law, or our practices. We will notify you of material changes through the App or via email. Your continued use of Savify after the effective date of any changes constitutes acceptance of the revised Terms.",
                },
                {
                  heading: "13. Governing Law",
                  body: "These Terms are governed by and construed in accordance with applicable laws. Any disputes arising under these Terms shall be resolved through good-faith negotiation first. If unresolved, disputes shall be subject to the exclusive jurisdiction of the competent courts in the applicable jurisdiction.",
                },
                {
                  heading: "14. Contact",
                  body: "If you have questions about these Terms of Service, please contact us:\n\nEmail: " + APP_CONFIG.SUPPORT_EMAIL + "\n\nWe will respond to all inquiries within 2 business days.",
                },
              ] as const).map((item) => (
                <View key={item.heading} style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 13.5, fontFamily: F.semibold, color: colors.foreground, marginBottom: 5 }}>{item.heading}</Text>
                  <Text style={{ fontSize: 13, fontFamily: F.regular, color: colors.mutedForeground, lineHeight: 20 }}>{item.body}</Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={[ms.saveBtn, { backgroundColor: colors.accent, marginTop: 12 }]} onPress={() => setTermsModal(false)}>
              <Text style={ms.saveText}>Done</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

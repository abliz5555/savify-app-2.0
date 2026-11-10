/**
 * Premium feature modals: Scan Bill, AI Analysis, PDF Report
 * All three require isPro — the parent should gate access.
 */
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal,
  Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAddTransaction, useFinanceData, useFinancialProfile } from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { useT } from "@/lib/i18n";
import { callReceiptScan, callInsights } from "@/lib/ai";
import { formatCurrency, formatDate, formatShortDate, EXPENSE_CATEGORIES, todayISO, monthKey } from "@/lib/format";
import { F, Card, SectionLabel, PrimaryButton, CategoryPicker, FormInput } from "@/components/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Shared sheet chrome
// ─────────────────────────────────────────────────────────────────────────────

function Sheet({
  visible, onClose, title, subtitle, children,
}: {
  visible: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[sh.container, {
          backgroundColor: colors.card,
          paddingBottom: Math.max(insets.bottom, 16) + 8,
          maxHeight: "92%",
        }]}>
          <View style={[sh.handle, { backgroundColor: colors.borderSoft }]} />
          <View style={sh.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[sh.title, { color: colors.foreground }]}>{title}</Text>
              {subtitle && <Text style={[sh.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={[sh.closeBtn, { backgroundColor: colors.muted }]}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const sh = StyleSheet.create({
  container: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 18, gap: 12 },
  title: { fontSize: 19, fontFamily: F.extrabold, letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontFamily: F.regular, marginTop: 3 },
  closeBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
});

// ─────────────────────────────────────────────────────────────────────────────
// SCAN BILL MODAL
// ─────────────────────────────────────────────────────────────────────────────

type ScanPhase = "idle" | "scanning" | "confirm" | "saving" | "error";
type ScannedData = { merchant: string; amount: number; date: string; category: string; confidence: number };

export function ScanBillModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { currency } = useSettings();
  const addTx = useAddTransaction();
  const { tCat } = useT();

  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [scanned, setScanned] = useState<ScannedData | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editCategory, setEditCategory] = useState("Other");
  const [errMsg, setErrMsg] = useState("");

  const reset = () => { setPhase("idle"); setScanned(null); setErrMsg(""); };

  const handleClose = () => { reset(); onClose(); };

  const scan = async (result: ImagePicker.ImagePickerResult) => {
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (!asset.base64) { setErrMsg("Could not read image data. Please try again."); setPhase("error"); return; }

    setPhase("scanning");
    try {
      const mimeType = asset.mimeType ?? "image/jpeg";
      const data = await callReceiptScan(asset.base64, mimeType);
      setScanned(data);
      setEditAmount(data.amount > 0 ? String(data.amount) : "");
      setEditDesc(data.merchant || "");
      setEditCategory(EXPENSE_CATEGORIES.includes(data.category) ? data.category : "Other");
      setPhase("confirm");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Scan failed. Please try a clearer image.");
      setPhase("error");
    }
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow photo access to scan bills."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"], quality: 0.5, base64: true,
    });
    await scan(result);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access to scan bills."); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"], quality: 0.5, base64: true,
    });
    await scan(result);
  };

  const saveExpense = async () => {
    const amt = parseFloat(editAmount);
    if (!editDesc.trim() || !Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Check your details", "Please enter a description and valid amount.");
      return;
    }
    setPhase("saving");
    try {
      const scannedDate = scanned?.date && /^\d{4}-\d{2}-\d{2}$/.test(scanned.date) && scanned.date <= todayISO()
        ? new Date(scanned.date + "T12:00:00").toISOString() : undefined;
      await addTx.mutateAsync({ type: "expense", description: editDesc.trim(), amount: amt, category: editCategory, createdAt: scannedDate });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleClose();
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Failed to save. Please try again.");
      setPhase("error");
    }
  };

  return (
    <Sheet visible={visible} onClose={handleClose} title="Scan Bill" subtitle="AI reads the amount, merchant & category">
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        {/* IDLE — choose source */}
        {phase === "idle" && (
          <View style={sc.content}>
            <View style={[sc.illustrationBox, { backgroundColor: colors.accentBg }]}>
              <Feather name="camera" size={44} color={colors.accent} />
              <Text style={[sc.illustrationText, { color: colors.accent }]}>Point at a receipt or invoice</Text>
            </View>
            <TouchableOpacity style={[sc.optionBtn, { backgroundColor: colors.primary }]} onPress={takePhoto} activeOpacity={0.82}>
              <Feather name="camera" size={20} color={colors.primaryForeground} />
              <Text style={[sc.optionLabel, { color: colors.primaryForeground }]}>Take a Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[sc.optionBtn, { backgroundColor: colors.muted }]} onPress={pickFromLibrary} activeOpacity={0.82}>
              <Feather name="image" size={20} color={colors.foreground} />
              <Text style={[sc.optionLabel, { color: colors.foreground }]}>Choose from Library</Text>
            </TouchableOpacity>
            <Text style={[sc.tip, { color: colors.mutedForeground }]}>
              For best results, ensure the total amount is visible and the image is well-lit.
            </Text>
          </View>
        )}

        {/* SCANNING — spinner */}
        {phase === "scanning" && (
          <View style={sc.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[sc.scanningText, { color: colors.foreground }]}>Reading your receipt…</Text>
            <Text style={[sc.scanningSubText, { color: colors.mutedForeground }]}>AI is extracting merchant, amount & category</Text>
          </View>
        )}

        {/* CONFIRM — review & edit */}
        {phase === "confirm" && scanned && (
          <View style={sc.content}>
            {/* Confidence badge */}
            <View style={[sc.confRow, {
              backgroundColor: scanned.confidence >= 0.8 ? colors.greenBg : colors.muted,
              borderColor: scanned.confidence >= 0.8 ? colors.green : colors.borderSoft,
            }]}>
              <Feather name={scanned.confidence >= 0.8 ? "check-circle" : "alert-circle"} size={14}
                color={scanned.confidence >= 0.8 ? colors.green : colors.amberFill} />
              <Text style={[sc.confText, { color: scanned.confidence >= 0.8 ? colors.green : colors.foreground }]}>
                {scanned.confidence >= 0.8
                  ? `Scanned with ${Math.round(scanned.confidence * 100)}% confidence`
                  : "Low confidence — please review and correct the details below"}
              </Text>
            </View>

            <Text style={[sc.reviewLabel, { color: colors.mutedForeground }]}>Review & edit before saving</Text>

            <FormInput
              label={`Amount (${currency})`}
              value={editAmount}
              onChangeText={setEditAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />
            <FormInput
              label="Description / Merchant"
              value={editDesc}
              onChangeText={setEditDesc}
              placeholder="e.g. Starbucks, Amazon"
            />
            <View style={{ gap: 7, marginBottom: 4 }}>
              <SectionLabel>Category</SectionLabel>
              <CategoryPicker categories={EXPENSE_CATEGORIES} value={editCategory} onChange={setEditCategory} labelFn={tCat} />
            </View>
            <Text style={[sc.dateNote, { color: colors.mutedForeground }]}>
              Receipt date: {formatDate(scanned.date)}
            </Text>
            <PrimaryButton label="Save as Expense" onPress={saveExpense} loading={(phase as ScanPhase) === "saving"} />
            <TouchableOpacity style={sc.retryLink} onPress={reset}>
              <Text style={[sc.retryText, { color: colors.accent }]}>Scan a different image</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* SAVING — loading */}
        {phase === "saving" && (
          <View style={sc.center}>
            <ActivityIndicator size="large" color={colors.accent} />
            <Text style={[sc.scanningText, { color: colors.foreground }]}>Saving expense…</Text>
          </View>
        )}

        {/* ERROR */}
        {phase === "error" && (
          <View style={sc.content}>
            <View style={[sc.errorBox, { backgroundColor: colors.redBg, borderColor: colors.red }]}>
              <Feather name="alert-circle" size={22} color={colors.red} />
              <Text style={[sc.errorText, { color: colors.red }]}>{errMsg}</Text>
            </View>
            <TouchableOpacity style={[sc.optionBtn, { backgroundColor: colors.muted }]} onPress={reset} activeOpacity={0.82}>
              <Feather name="refresh-cw" size={18} color={colors.foreground} />
              <Text style={[sc.optionLabel, { color: colors.foreground }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ height: 8 }} />
      </ScrollView>
    </Sheet>
  );
}

const sc = StyleSheet.create({
  content: { gap: 12, paddingBottom: 4 },
  illustrationBox: { alignItems: "center", justifyContent: "center", borderRadius: 16, paddingVertical: 32, gap: 10, marginBottom: 4 },
  illustrationText: { fontSize: 14, fontFamily: F.medium },
  optionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 15, borderRadius: 14 },
  optionLabel: { fontSize: 15, fontFamily: F.semibold },
  tip: { fontSize: 12, fontFamily: F.regular, textAlign: "center", lineHeight: 18, paddingHorizontal: 10 },
  center: { alignItems: "center", justifyContent: "center", paddingVertical: 52, gap: 12 },
  scanningText: { fontSize: 16, fontFamily: F.bold },
  scanningSubText: { fontSize: 13, fontFamily: F.regular, textAlign: "center" },
  confRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderRadius: 10, borderWidth: 1 },
  confText: { fontSize: 12.5, fontFamily: F.medium, flex: 1 },
  reviewLabel: { fontSize: 12, fontFamily: F.medium, marginBottom: -4 },
  dateNote: { fontSize: 11.5, fontFamily: F.regular, marginTop: -4 },
  retryLink: { alignItems: "center", paddingVertical: 10 },
  retryText: { fontSize: 13.5, fontFamily: F.semibold },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 13, fontFamily: F.medium, lineHeight: 19 },
});

// ─────────────────────────────────────────────────────────────────────────────
// AI ANALYSIS MODAL
// ─────────────────────────────────────────────────────────────────────────────

type InsightTrend = "up" | "down" | "neutral";
type Insight = { type: string; icon: string; title: string; message: string; trend: InsightTrend };
type AnalysisPhase = "loading" | "done" | "error";

// Loading steps that animate in sequence while waiting for the API
const LOADING_STEPS = [
  { icon: "bar-chart-2", label: "Reading your income & expenses" },
  { icon: "pie-chart",   label: "Analysing spending patterns" },
  { icon: "target",      label: "Reviewing goals & debt" },
  { icon: "cpu",         label: "Generating personalised insights" },
];

export function AIAnalysisModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { currency } = useSettings();
  const { data } = useFinanceData();
  const { data: profile } = useFinancialProfile();
  const profileRef = React.useRef(profile);
  profileRef.current = profile;

  const [phase, setPhase] = useState<AnalysisPhase>("loading");
  const [insights, setInsights] = useState<Insight[]>([]);
  const [errMsg, setErrMsg] = useState("");
  const [loadStep, setLoadStep] = useState(0);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  // ── Fix: keep data in a ref so useCallback doesn't re-create on every render ──
  const dataRef = React.useRef(data);
  dataRef.current = data;

  // Stable load function — no data in deps, accessed via ref
  const load = useCallback(async () => {
    const d = dataRef.current;
    if (!d) return;

    setPhase("loading");
    setInsights([]);
    setLoadStep(0);

    // Advance the step indicator every ~1.8s for visual feedback
    const stepTimer = setInterval(() => {
      setLoadStep(s => Math.min(s + 1, LOADING_STEPS.length - 1));
    }, 1800);

    try {
      // short pause so the friendly "analysing" steps are visible
      await new Promise((r) => setTimeout(r, 1200));
      const result = await callInsights(d, currency, profileRef.current);
      clearInterval(stepTimer);
      setLoadStep(LOADING_STEPS.length - 1);
      setInsights(result.insights ?? []);
      setGeneratedAt(new Date());
      setPhase("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      clearInterval(stepTimer);
      setErrMsg(e instanceof Error ? e.message : "Could not generate insights. Please try again.");
      setPhase("error");
    }
  }, [currency]); // ← data intentionally omitted — accessed via ref

  // Only trigger when modal becomes visible (not on every render)
  useEffect(() => {
    if (visible) load();
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Colour helpers ──────────────────────────────────────────────────────────
  const trendAccent = (t: InsightTrend) =>
    t === "up" ? colors.green : t === "down" ? colors.red : colors.accent;
  const trendBg = (t: InsightTrend) =>
    t === "up" ? colors.greenBg : t === "down" ? colors.redBg : colors.accentBg;
  const trendFeather = (t: InsightTrend): "trending-up" | "trending-down" | "minus" =>
    t === "up" ? "trending-up" : t === "down" ? "trending-down" : "minus";

  // ── Snapshot metrics from current data ─────────────────────────────────────
  const snap = React.useMemo(() => {
    const d = dataRef.current;
    if (!d) return null;
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const monthTx = d.transactions.filter(t => monthKey(t.createdAt) === prefix);
    const inc = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const exp = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const rate = inc > 0 ? ((inc - exp) / inc * 100) : 0;
    return { inc, exp, net: inc - exp, rate };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Sheet visible={visible} onClose={onClose}
      title="AI Analysis" subtitle="Personal tips from your own numbers — private & offline">
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}
        contentContainerStyle={{ paddingBottom: 12 }}>

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <View style={ai.loadingWrap}>
            {/* Branded header */}
            <View style={[ai.loadingBrand, { backgroundColor: colors.accentBg }]}>
              <Text style={ai.brandEmoji}>✨</Text>
              <View>
                <Text style={[ai.brandTitle, { color: colors.accent }]}>Analysing your finances</Text>
                <Text style={[ai.brandSub, { color: colors.accent + "99" }]}>
                  This takes about 8–10 seconds
                </Text>
              </View>
            </View>

            {/* Step progress */}
            <View style={{ gap: 6 }}>
              {LOADING_STEPS.map((step, i) => {
                const done = i < loadStep;
                const active = i === loadStep;
                return (
                  <View key={step.label} style={[ai.stepRow, {
                    backgroundColor: done ? colors.greenBg : active ? colors.accentBg : colors.muted,
                    borderColor: done ? colors.green + "40" : active ? colors.accent + "40" : "transparent",
                  }]}>
                    <View style={[ai.stepIconBox, {
                      backgroundColor: done ? colors.green : active ? colors.accent : colors.mutedForeground + "30",
                    }]}>
                      {done
                        ? <Feather name="check" size={12} color="#fff" />
                        : active
                          ? <ActivityIndicator size={12} color="#fff" />
                          : <Feather name={step.icon as any} size={12} color={colors.mutedForeground} />}
                    </View>
                    <Text style={[ai.stepLabel, {
                      color: done ? colors.green : active ? colors.accent : colors.mutedForeground,
                      fontFamily: active ? F.semibold : F.regular,
                    }]}>
                      {step.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* ── ERROR ── */}
        {phase === "error" && (
          <View style={ai.center}>
            <View style={[ai.errorBox, { backgroundColor: colors.redBg, borderColor: colors.red }]}>
              <Feather name="alert-circle" size={20} color={colors.red} />
              <Text style={[ai.errorText, { color: colors.red }]}>{errMsg}</Text>
            </View>
            <TouchableOpacity
              style={[ai.retryBtn, { backgroundColor: colors.muted }]}
              onPress={load} activeOpacity={0.8}
            >
              <Feather name="refresh-cw" size={16} color={colors.foreground} />
              <Text style={[ai.retryText, { color: colors.foreground }]}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <View style={{ gap: 12 }}>
            {/* ── Snapshot strip ── */}
            {snap && (
              <View style={[ai.snapCard, { backgroundColor: colors.accentBg, borderColor: colors.accent + "30" }]}>
                <Text style={[ai.snapLabel, { color: colors.accent }]}>THIS MONTH AT A GLANCE</Text>
                <View style={ai.snapRow}>
                  {[
                    { label: "Income",   value: formatCurrency(snap.inc, currency), color: colors.green },
                    { label: "Spent",    value: formatCurrency(snap.exp, currency), color: colors.red },
                    { label: "Saved",    value: formatCurrency(snap.net, currency), color: snap.net >= 0 ? colors.accent : colors.red },
                    { label: "Rate",     value: `${snap.rate.toFixed(1)}%`,         color: snap.rate >= 20 ? colors.green : colors.amberFill },
                  ].map(m => (
                    <View key={m.label} style={ai.snapMetric}>
                      <Text style={[ai.snapValue, { color: m.color }]} adjustsFontSizeToFit numberOfLines={1}>
                        {m.value}
                      </Text>
                      <Text style={[ai.snapMetricLabel, { color: colors.accent + "99" }]}>{m.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Insight cards ── */}
            <Text style={[ai.sectionHeading, { color: colors.mutedForeground }]}>
              {insights.length} PERSONALISED INSIGHTS
            </Text>

            {insights.map((ins, i) => (
              <View key={i} style={[ai.card, {
                backgroundColor: colors.card,
                borderColor: colors.borderSoft,
              }]}>
                {/* Left accent bar */}
                <View style={[ai.accentBar, { backgroundColor: trendAccent(ins.trend) }]} />

                <View style={ai.cardBody}>
                  {/* Header row */}
                  <View style={ai.cardHeader}>
                    <View style={[ai.iconCircle, { backgroundColor: trendBg(ins.trend) }]}>
                      <Text style={ai.insightEmoji}>{ins.icon}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[ai.cardTitle, { color: colors.foreground }]}>{ins.title}</Text>
                    </View>
                    <View style={[ai.trendChip, { backgroundColor: trendBg(ins.trend) }]}>
                      <Feather name={trendFeather(ins.trend)} size={12} color={trendAccent(ins.trend)} />
                    </View>
                  </View>

                  {/* Message */}
                  <Text style={[ai.cardMessage, { color: colors.mutedForeground }]}>
                    {ins.message}
                  </Text>

                  {/* Type tag */}
                  <View style={ai.cardFooter}>
                    <View style={[ai.typeTag, { backgroundColor: trendAccent(ins.trend) + "15",
                      borderColor: trendAccent(ins.trend) + "40" }]}>
                      <Text style={[ai.typeText, { color: trendAccent(ins.trend) }]}>
                        {ins.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {/* ── Footer ── */}
            <View style={[ai.footer, { borderTopColor: colors.borderSoft }]}>
              {generatedAt && (
                <Text style={[ai.footerTime, { color: colors.mutedForeground }]}>
                  Generated at {generatedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
              )}
              <TouchableOpacity style={[ai.regenBtn, { borderColor: colors.borderSoft }]}
                onPress={load} activeOpacity={0.8}>
                <Feather name="refresh-cw" size={13} color={colors.mutedForeground} />
                <Text style={[ai.regenText, { color: colors.mutedForeground }]}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

const ai = StyleSheet.create({
  // Loading
  loadingWrap: { gap: 16, paddingBottom: 8 },
  loadingBrand: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 16 },
  brandEmoji: { fontSize: 32 },
  brandTitle: { fontSize: 15, fontFamily: F.bold },
  brandSub: { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  stepIconBox: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  stepLabel: { fontSize: 13, lineHeight: 17 },

  // Error
  center: { alignItems: "center", paddingVertical: 36, gap: 14 },
  errorBox: { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1, alignSelf: "stretch" },
  errorText: { flex: 1, fontSize: 13, fontFamily: F.medium, lineHeight: 19 },
  retryBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  retryText: { fontSize: 14, fontFamily: F.semibold },

  // Snapshot strip
  snapCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10 },
  snapLabel: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.8 },
  snapRow: { flexDirection: "row", justifyContent: "space-between" },
  snapMetric: { alignItems: "center", flex: 1 },
  snapValue: { fontSize: 14, fontFamily: F.extrabold, maxWidth: 80 },
  snapMetricLabel: { fontSize: 10, fontFamily: F.medium, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.4 },

  // Section heading
  sectionHeading: { fontSize: 10, fontFamily: F.bold, letterSpacing: 0.8, marginBottom: -4 },

  // Insight card
  card: {
    borderRadius: 16, borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    // depth shadow
    shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 8, shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  accentBar: { width: 4, borderTopLeftRadius: 16, borderBottomLeftRadius: 16 },
  cardBody: { flex: 1, padding: 14, gap: 8 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  insightEmoji: { fontSize: 20, lineHeight: 26 },
  cardTitle: { fontSize: 14, fontFamily: F.bold, lineHeight: 19 },
  trendChip: { width: 28, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  cardMessage: { fontSize: 13, fontFamily: F.regular, lineHeight: 20 },
  cardFooter: { flexDirection: "row", alignItems: "center" },
  typeTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1 },
  typeText: { fontSize: 9.5, fontFamily: F.extrabold, letterSpacing: 0.6 },

  // Footer
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  footerTime: { fontSize: 11, fontFamily: F.regular },
  regenBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 8 },
  regenText: { fontSize: 12, fontFamily: F.medium },
});

// ─────────────────────────────────────────────────────────────────────────────
// PDF REPORT MODAL
// ─────────────────────────────────────────────────────────────────────────────

type ReportPhase = "preview" | "generating" | "done" | "error";

export function PDFReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { currency, displayName } = useSettings();
  const { data } = useFinanceData();
  const [phase, setPhase] = useState<ReportPhase>("preview");
  const [errMsg, setErrMsg] = useState("");
  const [dateRange, setDateRange] = useState<"thisMonth" | "lastMonth" | "last3Months" | "allTime">("thisMonth");
  const [csvPhase, setCsvPhase] = useState<"idle" | "exporting" | "done">("idle");

  const rangeLabel = React.useMemo(() => {
    const now = new Date();
    if (dateRange === "lastMonth") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return prev.toLocaleString("default", { month: "long", year: "numeric" });
    }
    if (dateRange === "last3Months") {
      const start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      return `${start.toLocaleString("default", { month: "short" })} – ${now.toLocaleString("default", { month: "short", year: "numeric" })}`;
    }
    if (dateRange === "allTime") return "All Time";
    return now.toLocaleString("default", { month: "long", year: "numeric" });
  }, [dateRange]);

  const getRangeTx = useCallback((txs: NonNullable<typeof data>["transactions"]) => {
    const now = new Date();
    if (dateRange === "allTime") return txs;
    if (dateRange === "lastMonth") {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const p = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
      return txs.filter(t => monthKey(t.createdAt) === p);
    }
    if (dateRange === "last3Months") {
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
      return txs.filter(t => t.createdAt >= cutoffStr);
    }
    const now2 = new Date();
    const p = `${now2.getFullYear()}-${String(now2.getMonth() + 1).padStart(2, "0")}`;
    return txs.filter(t => monthKey(t.createdAt) === p);
  }, [dateRange]);

  const reportData = React.useMemo(() => {
    if (!data) return null;
    const monthTx = getRangeTx(data.transactions);
    const monthIncome = monthTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const monthExpenses = monthTx.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    const allIncome = data.transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const allExpenses = data.transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);

    const catMap: Record<string, number> = {};
    monthTx.filter(t => t.type === "expense").forEach(t => { catMap[t.category] = (catMap[t.category] ?? 0) + t.amount; });
    const categories = Object.entries(catMap).sort((a, b) => b[1] - a[1]);

    const totalLoans = data.loans.reduce((s, l) => {
      const paid = (l.payments ?? []).reduce((a: number, p: { amount: number }) => a + p.amount, 0);
      return s + Math.max(l.totalAmount - paid, 0);
    }, 0);

    const recentTx = [...data.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 15);

    return {
      monthIncome, monthExpenses, allIncome, allExpenses,
      net: allIncome - allExpenses,
      savings: data.savingsGoals.reduce((s, g) => s + g.currentAmount, 0),
      totalLoans,
      categories,
      recentTx,
      budgetGoals: data.budgetGoals.map(bg => {
        const spent = monthTx.filter(t => t.type === "expense" && t.category === bg.category).reduce((s, t) => s + t.amount, 0);
        return { ...bg, spent };
      }),
      savingsGoals: data.savingsGoals,
    };
  }, [data, getRangeTx]);

  const generateHtml = () => {
    if (!reportData) return "";
    const fmt = (n: number) => formatCurrency(n, currency);
    const rows = (items: { label: string; value: string; bold?: boolean; color?: string }[]) =>
      items.map(r => `<tr>
        <td style="color:#666;font-size:13px;padding:7px 0">${r.label}</td>
        <td style="text-align:right;font-size:13px;font-weight:${r.bold ? "700" : "500"};color:${r.color ?? "#1a1a1a"};padding:7px 0">${r.value}</td>
      </tr>`).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; background: #f5f5f7; color: #1a1a1a; }
  .page { max-width: 700px; margin: 0 auto; background: #fff; min-height: 100vh; }
  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; padding: 36px 32px; }
  .header h1 { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 13px; opacity: 0.85; margin-top: 6px; }
  .content { padding: 28px 32px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 12px; }
  .card { background: #f9f9fb; border-radius: 12px; padding: 16px 18px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  tr { border-bottom: 1px solid #f0f0f0; }
  tr:last-child { border-bottom: none; }
  .big-stat { font-size: 28px; font-weight: 800; }
  .stat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
  .stat-card { background: #f9f9fb; border-radius: 12px; padding: 14px 16px; }
  .stat-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  .stat-value { font-size: 18px; font-weight: 700; }
  .bar-track { background: #eee; border-radius: 4px; height: 7px; margin-top: 6px; }
  .bar-fill { height: 7px; border-radius: 4px; }
  .footer { background: #f5f5f7; padding: 20px 32px; text-align: center; font-size: 11px; color: #aaa; }
</style></head><body><div class="page">
<div class="header">
  <h1>Savify Financial Report</h1>
  <p>${rangeLabel}${displayName ? ` · ${displayName}` : ""} · Generated ${new Date().toLocaleDateString()}</p>
</div>
<div class="content">

  <div class="section">
    <div class="section-title">Net Balance</div>
    <div class="card">
      <div class="big-stat" style="color:${reportData.net >= 0 ? "#16a34a" : "#dc2626"}">${fmt(reportData.net)}</div>
      <p style="font-size:12px;color:#888;margin-top:4px">All-time net (income minus expenses)</p>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${rangeLabel}</div>
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Income</div>
        <div class="stat-value" style="color:#16a34a">${fmt(reportData.monthIncome)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Expenses</div>
        <div class="stat-value" style="color:#dc2626">${fmt(reportData.monthExpenses)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Net Saved</div>
        <div class="stat-value" style="color:#6366f1">${fmt(reportData.monthIncome - reportData.monthExpenses)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Savings Rate</div>
        <div class="stat-value">${reportData.monthIncome > 0 ? ((reportData.monthIncome - reportData.monthExpenses) / reportData.monthIncome * 100).toFixed(1) + "%" : "—"}</div>
      </div>
    </div>
  </div>

  ${reportData.categories.length > 0 ? `
  <div class="section">
    <div class="section-title">Spending by Category</div>
    <div class="card">
      <table>${reportData.categories.map(([cat, amt]) => {
        const pct = reportData.monthExpenses > 0 ? (amt / reportData.monthExpenses * 100).toFixed(1) : 0;
        const barPct = reportData.categories[0]?.[1] > 0 ? (amt / reportData.categories[0][1] * 100) : 0;
        return `<tr>
          <td style="padding:8px 0">
            <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:4px">${cat}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${barPct}%;background:#6366f1"></div></div>
          </td>
          <td style="text-align:right;vertical-align:top;padding:8px 0 8px 12px">
            <div style="font-size:13px;font-weight:700">${fmt(amt)}</div>
            <div style="font-size:11px;color:#888">${pct}%</div>
          </td>
        </tr>`;
      }).join("")}</table>
    </div>
  </div>` : ""}

  ${reportData.budgetGoals.length > 0 ? `
  <div class="section">
    <div class="section-title">Budget Goals</div>
    <div class="card"><table>${rows(reportData.budgetGoals.map(g => ({
      label: g.category + (g.spent > g.monthlyLimit ? " ⚠️" : ""),
      value: `${fmt(g.spent)} / ${fmt(g.monthlyLimit)}`,
      color: g.spent > g.monthlyLimit ? "#dc2626" : "#16a34a",
    })))}</table></div>
  </div>` : ""}

  ${reportData.savingsGoals.length > 0 ? `
  <div class="section">
    <div class="section-title">Savings Goals</div>
    <div class="card"><table>${rows(reportData.savingsGoals.map(g => ({
      label: g.name,
      value: `${fmt(g.currentAmount)} / ${fmt(g.targetAmount)}`,
      color: g.currentAmount >= g.targetAmount ? "#16a34a" : "#6366f1",
    })))}</table></div>
  </div>` : ""}

  ${reportData.totalLoans > 0 ? `
  <div class="section">
    <div class="section-title">Outstanding Debt</div>
    <div class="card">
      <div style="font-size:22px;font-weight:700;color:#dc2626">${fmt(reportData.totalLoans)}</div>
      <p style="font-size:12px;color:#888;margin-top:3px">Total remaining across all borrowed loans</p>
    </div>
  </div>` : ""}

  ${reportData.recentTx.length > 0 ? `
  <div class="section">
    <div class="section-title">Recent Transactions</div>
    <div class="card"><table>${reportData.recentTx.map(tx => `<tr>
      <td style="padding:7px 0">
        <div style="font-size:13px;font-weight:600">${tx.description}</div>
        <div style="font-size:11px;color:#888">${tx.category} · ${formatShortDate(tx.createdAt)}</div>
      </td>
      <td style="text-align:right;padding:7px 0;font-size:13px;font-weight:700;color:${tx.type === "income" ? "#16a34a" : "#1a1a1a"}">
        ${tx.type === "income" ? "+" : "-"}${fmt(tx.amount)}
      </td>
    </tr>`).join("")}</table></div>
  </div>` : ""}

</div>
<div class="footer">Generated by Savify Premium · ${new Date().toLocaleString()}</div>
</div></body></html>`;
  };

  const shareReport = async () => {
    setPhase("generating");
    try {
      const html = generateHtml();
      if (Platform.OS === "web") {
        // Web fallback: open print dialog
        const win = (global as any).window;
        if (win) { win.document.write(html); win.document.close(); win.print(); }
        setPhase("done");
        return;
      }
      const { uri } = await Print.printToFileAsync({ html, base64: false });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Share Financial Report", UTI: "com.adobe.pdf" });
      } else {
        await Print.printAsync({ uri });
      }
      setPhase("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      setErrMsg(e instanceof Error ? e.message : "Could not generate report. Please try again.");
      setPhase("error");
    }
  };

  const shareCsv = async () => {
    if (!data) return;
    setCsvPhase("exporting");
    try {
      const txs = getRangeTx(data.transactions).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const escCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
      const header = ["Date", "Type", "Description", "Category", "Amount"].join(",");
      const rows = txs.map(tx =>
        [tx.createdAt.slice(0, 10), tx.type, escCsv(tx.description), escCsv(tx.category),
          (tx.type === "income" ? tx.amount : -tx.amount).toFixed(2)].join(",")
      );
      const csv = [header, ...rows].join("\n");
      const fileUri = (FileSystem.cacheDirectory ?? "") + "savify-export.csv";
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: "text/csv", dialogTitle: "Export CSV", UTI: "public.comma-separated-values-text" });
      }
      setCsvPhase("done");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setCsvPhase("idle");
      Alert.alert("Export Failed", "Could not export CSV. Please try again.");
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Export Report"
      subtitle={`${rangeLabel} · ${displayName ?? "Savify"}`}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 8 }}>
        {!reportData ? (
          <View style={pr.center}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {/* Date range selector */}
            <View style={pr.rangeRow}>
              {(["thisMonth", "lastMonth", "last3Months", "allTime"] as const).map((r) => {
                const label = r === "thisMonth" ? "This Month" : r === "lastMonth" ? "Last Month" : r === "last3Months" ? "3 Months" : "All Time";
                const active = dateRange === r;
                return (
                  <Pressable
                    key={r}
                    onPress={() => { setDateRange(r); setPhase("preview"); setCsvPhase("idle"); }}
                    style={[pr.rangeChip, {
                      backgroundColor: active ? colors.accent : colors.card,
                      borderColor: active ? colors.accent : colors.borderSoft,
                    }]}
                  >
                    <Text style={[pr.rangeChipText, { color: active ? "#fff" : colors.mutedForeground }]}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Report preview cards */}
            <View style={[pr.previewCard, { backgroundColor: colors.accentBg, borderColor: colors.accent + "40" }]}>
              <Feather name="file-text" size={22} color={colors.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[pr.previewTitle, { color: colors.accent }]}>{rangeLabel} Report</Text>
                <Text style={[pr.previewSub, { color: colors.accent + "bb" }]}>
                  {reportData.recentTx.length} transactions · {reportData.categories.length} categories
                </Text>
              </View>
            </View>

            {/* Summary preview */}
            <Card style={{ padding: 14, gap: 0 }}>
              <SectionLabel style={{ marginBottom: 10 }}>Report Summary</SectionLabel>
              {[
                { label: "Income this month", value: formatCurrency(reportData.monthIncome, currency), color: colors.green },
                { label: "Expenses this month", value: formatCurrency(reportData.monthExpenses, currency), color: colors.red },
                { label: "Net saved", value: formatCurrency(reportData.monthIncome - reportData.monthExpenses, currency), color: colors.accent },
                { label: "Net balance (all-time)", value: formatCurrency(reportData.net, currency), color: reportData.net >= 0 ? colors.foreground : colors.destructive },
                ...(reportData.totalLoans > 0 ? [{ label: "Outstanding debt", value: formatCurrency(reportData.totalLoans, currency), color: colors.red }] : []),
              ].map(item => (
                <View key={item.label} style={[pr.summaryRow, { borderTopColor: colors.borderSoft }]}>
                  <Text style={[pr.summaryLabel, { color: colors.mutedForeground }]}>{item.label}</Text>
                  <Text style={[pr.summaryValue, { color: item.color }]}>{item.value}</Text>
                </View>
              ))}
            </Card>

            {/* What's included */}
            <View style={[pr.includesList, { backgroundColor: colors.muted, borderRadius: 12 }]}>
              <Text style={[pr.includesTitle, { color: colors.foreground }]}>Report includes:</Text>
              {[
                "Net balance & monthly summary",
                reportData.categories.length > 0 ? `Spending by ${reportData.categories.length} categories` : null,
                reportData.budgetGoals.length > 0 ? `${reportData.budgetGoals.length} budget goals` : null,
                reportData.savingsGoals.length > 0 ? `${reportData.savingsGoals.length} savings goals` : null,
                reportData.totalLoans > 0 ? "Outstanding debt overview" : null,
                `Last ${reportData.recentTx.length} transactions`,
              ].filter(Boolean).map(item => (
                <View key={item as string} style={pr.includesRow}>
                  <Feather name="check" size={13} color={colors.green} />
                  <Text style={[pr.includesText, { color: colors.mutedForeground }]}>{item}</Text>
                </View>
              ))}
            </View>

            {phase === "error" && (
              <View style={[pr.errorBox, { backgroundColor: colors.redBg, borderColor: colors.red }]}>
                <Feather name="alert-circle" size={16} color={colors.red} />
                <Text style={[pr.errorText, { color: colors.red }]}>{errMsg}</Text>
              </View>
            )}

            {phase === "done" ? (
              <View style={[pr.doneBox, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <Text style={[pr.doneText, { color: colors.green }]}>PDF shared successfully!</Text>
              </View>
            ) : (
              <PrimaryButton
                label={phase === "generating" ? "Generating PDF…" : "Share as PDF"}
                onPress={shareReport}
                loading={phase === "generating"}
              />
            )}

            {phase === "done" && (
              <TouchableOpacity style={pr.retryLink} onPress={() => setPhase("preview")}>
                <Text style={[pr.retryText, { color: colors.accent }]}>Share again</Text>
              </TouchableOpacity>
            )}

            {/* CSV Export */}
            <View style={[pr.csvDivider, { borderTopColor: colors.borderSoft }]}>
              <Text style={[pr.csvLabel, { color: colors.mutedForeground }]}>EXPORT AS</Text>
            </View>
            {csvPhase === "done" ? (
              <View style={[pr.doneBox, { backgroundColor: colors.greenBg, borderColor: colors.green }]}>
                <Feather name="check-circle" size={18} color={colors.green} />
                <Text style={[pr.doneText, { color: colors.green }]}>CSV exported!</Text>
              </View>
            ) : (
              <TouchableOpacity
                style={[pr.csvBtn, { backgroundColor: colors.card, borderColor: colors.borderSoft }]}
                onPress={shareCsv}
                disabled={csvPhase === "exporting"}
              >
                {csvPhase === "exporting" ? (
                  <ActivityIndicator size="small" color={colors.accent} />
                ) : (
                  <Feather name="download" size={16} color={colors.accent} />
                )}
                <Text style={[pr.csvBtnText, { color: colors.accent }]}>
                  {csvPhase === "exporting" ? "Exporting…" : "Export as CSV"}
                </Text>
              </TouchableOpacity>
            )}
            {csvPhase === "done" && (
              <TouchableOpacity style={pr.retryLink} onPress={() => setCsvPhase("idle")}>
                <Text style={[pr.retryText, { color: colors.accent }]}>Export again</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        <View style={{ height: 8 }} />
      </ScrollView>
    </Sheet>
  );
}

const pr = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: 52 },
  rangeRow: { flexDirection: "row", gap: 6 },
  rangeChip: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  rangeChipText: { fontSize: 11, fontFamily: F.semibold },
  previewCard: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 12, borderWidth: 1 },
  previewTitle: { fontSize: 14, fontFamily: F.bold },
  previewSub: { fontSize: 12, fontFamily: F.regular, marginTop: 2 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9, borderTopWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 13, fontFamily: F.regular },
  summaryValue: { fontSize: 13, fontFamily: F.bold },
  includesList: { padding: 14, gap: 6 },
  includesTitle: { fontSize: 12.5, fontFamily: F.semibold, marginBottom: 4 },
  includesRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  includesText: { fontSize: 12.5, fontFamily: F.regular },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1 },
  errorText: { flex: 1, fontSize: 12.5, fontFamily: F.medium },
  doneBox: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1 },
  doneText: { fontSize: 14, fontFamily: F.bold },
  retryLink: { alignItems: "center", paddingVertical: 8 },
  retryText: { fontSize: 13, fontFamily: F.semibold },
  csvDivider: { flexDirection: "row", alignItems: "center", paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  csvLabel: { fontSize: 9, fontFamily: F.bold, letterSpacing: 0.8, marginLeft: 4 },
  csvBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 12, borderWidth: 1, paddingVertical: 13 },
  csvBtnText: { fontSize: 14, fontFamily: F.semibold },
});

import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from "react-native";
import Animated, { FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, cancelAnimation } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { F } from "@/components/ui";
import { useAddTransaction } from "@/contexts/FinanceContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";
import { formatCurrency } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { convert, dateLabelFor, EXAMPLES, EXPENSE_CATS, INCOME_CATS, parseSentence } from "@/lib/smartParse";
import { speechAvailable, startListening } from "@/lib/speech";
import type { AccountType } from "@/lib/types";

// ─── Open the sheet from anywhere ────────────────────────────────────────────

type OpenOpts = { listen?: boolean };
const QuickAddCtx = createContext<{ open: (o?: OpenOpts) => void }>({ open: () => {} });
export const useQuickAdd = () => useContext(QuickAddCtx);

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ visible: boolean; listen: boolean; key: number }>({ visible: false, listen: false, key: 0 });
  const open = useCallback((o?: OpenOpts) => setState((s) => ({ visible: true, listen: !!o?.listen, key: s.key + 1 })), []);
  return (
    <QuickAddCtx.Provider value={{ open }}>
      {children}
      {state.visible && (
        <QuickAddSheet key={state.key} startListening={state.listen} onClose={() => setState((s) => ({ ...s, visible: false }))} />
      )}
    </QuickAddCtx.Provider>
  );
}

// ─── The sheet ───────────────────────────────────────────────────────────────

type Acc = AccountType | "none";

function QuickAddSheet({ startListening: autoListen, onClose }: { startListening: boolean; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { currency, language } = useSettings();
  const { tCat } = useT();
  const add = useAddTransaction();

  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState("");
  const stopRef = useRef<() => void>(() => {});

  // what the user changed by hand (wins over what we read from the sentence)
  const [o, setO] = useState<{ type?: "expense" | "income"; amount?: string; category?: string; account?: Acc; dayOffset?: number; convert?: boolean; note?: string }>({});
  const [saved, setSaved] = useState<null | string>(null);

  const parsed = useMemo(() => parseSentence(text), [text]);
  const type = o.type ?? parsed.type;
  const cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;
  const category = o.category ?? (parsed.category && cats.includes(parsed.category) ? parsed.category : null);
  const account: Acc | null = o.account ?? parsed.account ?? null;
  const date = useMemo(() => {
    if (o.dayOffset === undefined) return parsed.date;
    const d = new Date(); d.setDate(d.getDate() - o.dayOffset); return d;
  }, [o.dayOffset, parsed.date]);

  const rawAmount = o.amount !== undefined ? parseFloat(o.amount.replace(/,/g, "")) : parsed.amount ?? NaN;
  const spokenCur = parsed.currency && parsed.currency !== currency ? parsed.currency : null;
  const converted = spokenCur && Number.isFinite(rawAmount) ? convert(rawAmount, spokenCur, currency) : null;
  const useConvert = (o.convert ?? true) && converted !== null;
  const finalAmount = useConvert ? converted! : rawAmount;
  const amountOk = Number.isFinite(finalAmount) && finalAmount > 0;
  const hasInput = text.trim().length > 0 || Object.keys(o).length > 0;

  const missingLabel = !amountOk ? "Enter the amount" : !category ? "Choose a category" : !account ? (type === "income" ? "Where did it go?" : "How did you pay?") : null;

  // ── Voice ──
  const pulse = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));
  const canVoice = speechAvailable();

  const listen = useCallback(async () => {
    if (listening) { stopRef.current(); return; }
    setVoiceMsg("");
    if (!canVoice) {
      setVoiceMsg("Tip: tap the 🎤 on your keyboard to speak. (Built-in voice works in the installed app.)");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setListening(true);
    pulse.value = withRepeat(withSequence(withTiming(1.35, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    stopRef.current = await startListening({
      language,
      onText: (t) => { setText(t); setO({}); },
      onEnd: () => { setListening(false); cancelAnimation(pulse); pulse.value = 1; },
      onError: (m) => { setVoiceMsg(m); setListening(false); cancelAnimation(pulse); pulse.value = 1; },
    });
  }, [listening, canVoice, language, pulse]);

  useEffect(() => {
    // opened with "Tell Savify": start listening right away (only where voice works)
    if (autoListen && canVoice) { const id = setTimeout(listen, 350); return () => clearTimeout(id); }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => stopRef.current(), []);

  // ── Save ──
  const save = async () => {
    if (missingLabel || !category || !account) return;
    try {
      const d = new Date(date); d.setHours(new Date().getHours(), new Date().getMinutes(), 0, 0);
      await add.mutateAsync({
        type,
        amount: Math.round(finalAmount * 100) / 100,
        category,
        description: (o.note ?? parsed.description ?? category).trim() || category,
        account: account === "none" ? undefined : account,
        createdAt: d.toISOString(),
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSaved(`${type === "income" ? "+" : "−"}${formatCurrency(finalAmount, currency)} · ${tCat(category)}`);
    } catch (e) {
      setVoiceMsg(e instanceof Error ? e.message : "Could not save. Please try again.");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  };

  const reset = () => { setText(""); setO({}); setSaved(null); setVoiceMsg(""); };

  const chip = (active: boolean, warn = false) => [
    s.chip,
    { backgroundColor: active ? colors.accent : colors.muted, borderColor: active ? colors.accent : warn ? colors.amber : "transparent" },
  ];
  const chipText = (active: boolean) => [s.chipText, { color: active ? colors.accentForeground : colors.foreground }];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[s.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.handle, { backgroundColor: colors.border }]} />

          {saved ? (
            <Animated.View entering={FadeIn} style={s.savedBox}>
              <View style={[s.savedIcon, { backgroundColor: colors.greenBg }]}>
                <Feather name="check" size={30} color={colors.green} />
              </View>
              <Text style={[s.savedTitle, { color: colors.foreground }]}>Saved</Text>
              <Text style={[s.savedSub, { color: colors.mutedForeground }]}>{saved}</Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" }}>
                <Pressable onPress={reset} style={[s.secondaryBtn, { backgroundColor: colors.muted }]}>
                  <Text style={[s.btnText, { color: colors.foreground }]}>Add another</Text>
                </Pressable>
                <Pressable onPress={onClose} style={[s.primaryBtn, { backgroundColor: colors.primary, flex: 1 }]}>
                  <Text style={[s.btnText, { color: colors.primaryForeground }]}>Done</Text>
                </Pressable>
              </View>
            </Animated.View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: 4 }}>
              <View style={s.headRow}>
                <Text style={[s.title, { color: colors.foreground }]}>Tell Savify</Text>
                <Pressable onPress={onClose} hitSlop={10} style={[s.close, { backgroundColor: colors.muted }]} accessibilityLabel="Close">
                  <Feather name="x" size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>

              {/* Speak or type */}
              <View style={[s.inputRow, { backgroundColor: colors.input, borderColor: listening ? colors.accent : colors.border }]}>
                <TextInput
                  value={text}
                  onChangeText={(v) => { setText(v); setSaved(null); }}
                  placeholder={listening ? "Listening…" : "Say or type… “Lunch 35 cash”"}
                  placeholderTextColor={colors.mutedForeground}
                  style={[s.input, { color: colors.foreground }]}
                  multiline
                  autoFocus={!autoListen || !canVoice}
                  returnKeyType="done"
                  blurOnSubmit
                />
                <Pressable onPress={listen} accessibilityLabel={listening ? "Stop listening" : "Speak"} style={s.micWrap}>
                  {listening && <Animated.View style={[s.micPulse, { backgroundColor: colors.accent }, pulseStyle]} />}
                  <View style={[s.mic, { backgroundColor: colors.accent }]}>
                    <Feather name={listening ? "square" : "mic"} size={20} color={colors.accentForeground} />
                  </View>
                </Pressable>
              </View>
              {!!voiceMsg && <Text style={[s.hint, { color: colors.mutedForeground }]}>{voiceMsg}</Text>}

              {!hasInput ? (
                <Animated.View entering={FadeInDown.duration(250)} style={{ gap: 10 }}>
                  <Text style={[s.label, { color: colors.mutedForeground }]}>Try saying</Text>
                  <View style={s.wrap}>
                    {EXAMPLES.map((ex) => (
                      <Pressable key={ex} onPress={() => setText(ex)} style={[s.example, { borderColor: colors.border }]}>
                        <Text style={{ color: colors.foreground, fontFamily: F.medium, fontSize: 13.5 }}>“{ex}”</Text>
                      </Pressable>
                    ))}
                  </View>
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.duration(250)} style={{ gap: 16 }}>
                  {/* Expense / Income */}
                  <View style={[s.seg, { backgroundColor: colors.muted }]}>
                    {(["expense", "income"] as const).map((k) => (
                      <Pressable key={k} onPress={() => setO((x) => ({ ...x, type: k, category: undefined }))}
                        style={[s.segItem, type === k && { backgroundColor: colors.card }]}>
                        <Feather name={k === "expense" ? "arrow-up-right" : "arrow-down-left"} size={14} color={k === "expense" ? colors.red : colors.green} />
                        <Text style={[s.segText, { color: type === k ? colors.foreground : colors.mutedForeground }]}>{k === "expense" ? "Expense" : "Income"}</Text>
                      </Pressable>
                    ))}
                  </View>

                  {/* Amount */}
                  <View style={{ gap: 6 }}>
                    <Text style={[s.label, { color: !amountOk ? colors.amber : colors.mutedForeground }]}>Amount{!amountOk ? " · needed" : ""}</Text>
                    <View style={[s.amountBox, { borderColor: !amountOk ? colors.amber : colors.border }]}>
                      <Text style={[s.amountCur, { color: colors.mutedForeground }]}>{spokenCur && !useConvert ? spokenCur : spokenCur ? spokenCur : currency}</Text>
                      <TextInput
                        value={o.amount ?? (parsed.amount ? String(parsed.amount) : "")}
                        onChangeText={(v) => setO((x) => ({ ...x, amount: v.replace(/[^0-9.,]/g, "") }))}
                        keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.mutedForeground}
                        style={[s.amountInput, { color: colors.foreground }]}
                      />
                    </View>
                    {spokenCur && converted !== null && (
                      <View style={s.wrap}>
                        <Pressable onPress={() => setO((x) => ({ ...x, convert: true }))} style={chip(useConvert)}>
                          <Text style={chipText(useConvert)}>Save as {formatCurrency(converted, currency)} (approx.)</Text>
                        </Pressable>
                        <Pressable onPress={() => setO((x) => ({ ...x, convert: false }))} style={chip(!useConvert)}>
                          <Text style={chipText(!useConvert)}>Save as {rawAmount} {currency}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>

                  {/* Category */}
                  <View style={{ gap: 8 }}>
                    <Text style={[s.label, { color: !category ? colors.amber : colors.mutedForeground }]}>Category{!category ? " · pick one" : ""}</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                      {cats.map((c) => (
                        <Pressable key={c} onPress={() => setO((x) => ({ ...x, category: c }))} style={chip(category === c, !category)}>
                          <Text style={chipText(category === c)}>{tCat(c)}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Account */}
                  <View style={{ gap: 8 }}>
                    <Text style={[s.label, { color: !account ? colors.amber : colors.mutedForeground }]}>
                      {type === "income" ? "Received in" : "Paid with"}{!account ? " · needed" : ""}
                    </Text>
                    <View style={s.wrap}>
                      {([["cash", "Cash", "dollar-sign"], ["bank", "Bank / Card", "credit-card"], ["savings", "Savings", "archive"], ["none", "Don't track", "minus"]] as const).map(([k, label, icon]) => (
                        <Pressable key={k} onPress={() => setO((x) => ({ ...x, account: k }))} style={chip(account === k, !account)}>
                          <Feather name={icon} size={13} color={account === k ? colors.accentForeground : colors.mutedForeground} />
                          <Text style={chipText(account === k)}>{label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* Date */}
                  <View style={{ gap: 8 }}>
                    <Text style={[s.label, { color: colors.mutedForeground }]}>When</Text>
                    <View style={s.wrap}>
                      {[0, 1, 2].map((off) => {
                        const d = new Date(); d.setDate(d.getDate() - off);
                        const active = dateLabelFor(date) === dateLabelFor(d);
                        return (
                          <Pressable key={off} onPress={() => setO((x) => ({ ...x, dayOffset: off }))} style={chip(active)}>
                            <Text style={chipText(active)}>{dateLabelFor(d)}</Text>
                          </Pressable>
                        );
                      })}
                      {!["Today", "Yesterday", dateLabelFor(new Date(Date.now() - 2 * 86400000))].includes(dateLabelFor(date)) && (
                        <View style={chip(true)}><Text style={chipText(true)}>{dateLabelFor(date)}</Text></View>
                      )}
                    </View>
                  </View>

                  {/* Note */}
                  <View style={[s.noteRow, { borderColor: colors.border }]}>
                    <Feather name="edit-3" size={15} color={colors.mutedForeground} />
                    <TextInput
                      value={o.note ?? parsed.description}
                      onChangeText={(v) => setO((x) => ({ ...x, note: v }))}
                      placeholder="Note (optional)" placeholderTextColor={colors.mutedForeground}
                      style={[s.noteInput, { color: colors.foreground }]}
                    />
                  </View>

                  <Pressable
                    onPress={save}
                    disabled={!!missingLabel || add.isPending}
                    style={[s.primaryBtn, { backgroundColor: missingLabel ? colors.muted : colors.primary }]}
                  >
                    {add.isPending ? <ActivityIndicator color={colors.primaryForeground} /> : (
                      <Text style={[s.btnText, { color: missingLabel ? colors.mutedForeground : colors.primaryForeground }]}>
                        {missingLabel ?? `Save ${type} · ${formatCurrency(finalAmount, currency)}`}
                      </Text>
                    )}
                  </Pressable>
                </Animated.View>
              )}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { marginTop: "auto", borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, maxHeight: "92%" },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 12 },
  headRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 22, fontFamily: F.bold, letterSpacing: -0.4 },
  close: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderRadius: 20, paddingLeft: 16, paddingRight: 8, minHeight: 64 },
  input: { flex: 1, fontSize: 17, fontFamily: F.medium, paddingVertical: 14, maxHeight: 110 },
  micWrap: { width: 50, height: 50, alignItems: "center", justifyContent: "center" },
  micPulse: { position: "absolute", width: 50, height: 50, borderRadius: 25, opacity: 0.3 },
  mic: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  hint: { fontSize: 13, fontFamily: F.regular, lineHeight: 18, marginTop: -6 },
  label: { fontSize: 13, fontFamily: F.semibold },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  example: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  seg: { flexDirection: "row", borderRadius: 14, padding: 4, gap: 4 },
  segItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 11 },
  segText: { fontSize: 14, fontFamily: F.semibold },
  amountBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, height: 62 },
  amountCur: { fontSize: 16, fontFamily: F.semibold },
  amountInput: { flex: 1, fontSize: 28, fontFamily: F.bold, letterSpacing: -0.5 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  chipText: { fontSize: 13.5, fontFamily: F.semibold },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 48 },
  noteInput: { flex: 1, fontSize: 15, fontFamily: F.regular },
  primaryBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  secondaryBtn: { height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  btnText: { fontSize: 16, fontFamily: F.semibold },
  savedBox: { alignItems: "center", paddingVertical: 24, gap: 6 },
  savedIcon: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", marginBottom: 6 },
  savedTitle: { fontSize: 22, fontFamily: F.bold },
  savedSub: { fontSize: 15, fontFamily: F.medium },
});

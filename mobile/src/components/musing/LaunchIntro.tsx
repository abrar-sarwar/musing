import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text } from "react-native";
import { fb, muse } from "@/constants/theme";

// shown once per cold launch. module scope, so tab switches and remounts never replay it.
let played = false;
const HOLD_MS = 950;

// the brief musing. introduction on a fresh launch. it waits on nothing: no api,
// no data, no images. it leaves on its own in about a second, or at once on a tap.
export function LaunchIntro() {
  const [visible, setVisible] = useState(!played);
  const fade = useRef(new Animated.Value(1)).current; // whole overlay
  const rise = useRef(new Animated.Value(0)).current; // wordmark in
  const line = useRef(new Animated.Value(0)).current; // underline draws
  const leaving = useRef(false);

  function leave(fast = false) {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(fade, { toValue: 0, duration: fast ? 120 : 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => setVisible(false));
  }

  useEffect(() => {
    if (played) return;
    played = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          // no movement: show it settled, then cut away
          rise.setValue(1);
          line.setValue(1);
        } else {
          Animated.parallel([
            Animated.timing(rise, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(line, { toValue: 1, duration: 520, delay: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]).start();
        }
        timer = setTimeout(() => leave(), HOLD_MS);
      });
    // safety net: whatever happens above, the intro can never outstay its welcome
    const hard = setTimeout(() => setVisible(false), 2200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearTimeout(hard);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity: fade }]} accessibilityViewIsModal={false}>
      <Pressable style={styles.fill} onPress={() => leave(true)} accessibilityRole="button" accessibilityLabel="musing. less planning. more happening. tap to skip">
        <Animated.View style={{ alignItems: "center", opacity: rise, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <Text style={styles.word}>
            musing<Text style={{ color: muse.start }}>.</Text>
          </Text>
          <Animated.View style={[styles.lineWrap, { transform: [{ scaleX: line }] }]}>
            <LinearGradient colors={[fb.blue, muse.start]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
          </Animated.View>
          <Text style={styles.tag}>less planning. more happening.</Text>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#fff", zIndex: 100 },
  fill: { flex: 1, alignItems: "center", justifyContent: "center" },
  word: { fontSize: 46, fontWeight: "800", letterSpacing: -1.8, color: fb.text },
  lineWrap: { width: 132, marginTop: 6 },
  line: { height: 4, borderRadius: 2 },
  tag: { marginTop: 14, fontSize: 16, color: fb.muted, letterSpacing: 0.1 },
});

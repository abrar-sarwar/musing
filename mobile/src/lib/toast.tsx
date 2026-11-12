import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { Animated, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// tiny toast for mocked facebook actions, so nothing on screen is a dead button.
const ToastContext = createContext<(text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState<string | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (t: string) => {
      if (timer.current) clearTimeout(timer.current);
      setText(t);
      Animated.timing(fade, { toValue: 1, duration: 140, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setText(null));
      }, 1700);
    },
    [fade],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      {text && (
        <Animated.View pointerEvents="none" style={[styles.toast, { bottom: insets.bottom + 84, opacity: fade }]}>
          <Text style={styles.text}>{text}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  toast: { position: "absolute", alignSelf: "center", maxWidth: "86%", backgroundColor: "rgba(28,30,33,0.94)", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  text: { color: "#fff", fontSize: 14, fontWeight: "500", textAlign: "center" },
});

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import Animated, { FadeIn, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { ArrowRight, Check, ChevronLeft, ChevronRight, X, type LucideIcon } from 'lucide-react-native';
import { elevation, palette, radius, tokens, type, useTheme, type TypeVariant } from './theme';
import { useApp } from '../state/app-context';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function T({ children, variant, size, bold = false, heading = false, color, style, lines, uppercase }: {
  children: React.ReactNode; variant?: TypeVariant; size?: number; bold?: boolean; heading?: boolean;
  color?: string; style?: TextStyle; lines?: number; uppercase?: boolean;
}) {
  const theme = useTheme();
  // A Figma text style wins; the size/bold/heading props remain for call sites
  // that predate the token import.
  const base: TextStyle = variant
    ? type[variant]
    : { fontSize: size ?? 13, lineHeight: (size ?? 13) * 1.45, fontFamily: heading ? 'Outfit_600SemiBold' : bold ? 'PublicSans_700Bold' : 'PublicSans_400Regular' };
  return (
    <Text numberOfLines={lines} style={[base, { color: color ?? theme.text }, uppercase ? { textTransform: 'uppercase' } : null, style]}>
      {children}
    </Text>
  );
}

/** btn/back: chevron plus a muted body/s label. */
export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, alignSelf: 'flex-start', opacity: pressed ? 0.6 : 1 })}>
      <ChevronLeft size={14} color={theme.muted} />
      <T variant="bodyS" color={theme.muted}>{label}</T>
    </Pressable>
  );
}

export function Eyebrow({ children, style }: { children: React.ReactNode; style?: TextStyle }) {
  const theme = useTheme();
  return <T variant="eyebrow" uppercase color={theme.muted} style={style}>{children}</T>;
}

export function Row({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.row, style]}>{children}</View>;
}

export function Card({ children, style, onPress, index = 0, accessibilityLabel }: { children: React.ReactNode; style?: ViewStyle; onPress?: () => void; index?: number; accessibilityLabel?: string }) {
  'use no memo'; // Reanimated shared values are mutable by design; the compiler cannot model them.
  const theme = useTheme();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const surface = [s.card, { backgroundColor: theme.surface, borderColor: theme.border }, elevation.card, style];
  if (!onPress) {
    return <Animated.View entering={FadeIn.delay(index * 45).duration(260)} accessible={accessibilityLabel ? true : undefined} accessibilityLabel={accessibilityLabel} style={surface}>{children}</Animated.View>;
  }
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      entering={FadeIn.delay(index * 45).duration(260)}
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      onPressIn={() => { scale.value = withSpring(0.975, { damping: 18, stiffness: 320 }); }}
      // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable by design
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
      onPress={onPress}
      style={[surface, animated]}
    >
      {children}
    </AnimatedPressable>
  );
}

/** pill component from the design: tinted background, brand-coloured label. */
export function Pill({ children, color = tokens.state.success, tint, icon: Icon }: { children: React.ReactNode; color?: string; tint?: string; icon?: LucideIcon }) {
  return (
    <Row style={{ alignSelf: 'flex-start', backgroundColor: tint ?? `${color}1F`, paddingHorizontal: 9, paddingVertical: 4, borderRadius: radius.pill, gap: 5 }}>
      {Icon ? <Icon size={12} color={color} /> : null}
      <T variant="labelPill" color={color}>{children}</T>
    </Row>
  );
}
export const Badge = Pill;

/** ico tile from the subject cards: 38px, radius/sm, tinted, 19px glyph. */
export function IconTile({ icon: Icon, color, tint, size = 38 }: { icon: LucideIcon; color: string; tint?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: radius.sm, backgroundColor: tint ?? `${color}1F`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon color={color} size={size * 0.5} strokeWidth={1.8} />
    </View>
  );
}
export const IconBox = ({ icon, color = palette.green, size = 38 }: { icon: LucideIcon; color?: string; size?: number }) => <IconTile icon={icon} color={color} size={size} />;

/** bar + fill, animating from empty so progress reads as movement. */
export function Bar({ value, color = tokens.brand.limeDeep, height = 7 }: { value: number; color?: string; height?: number }) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  const width = useSharedValue(0);
  useEffect(() => { width.value = withTiming(clamped, { duration: 650 }); }, [clamped, width]);
  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={{ flex: 1, height, borderRadius: radius.pill, backgroundColor: theme.surfaceAlt, overflow: 'hidden' }}>
      <Animated.View style={[{ height: '100%', borderRadius: radius.pill, backgroundColor: color }, animated]} />
    </View>
  );
}

export function Button({ title, onPress, variant = 'primary', icon: Icon, disabled, loading, style }: {
  title: string; onPress: () => void; variant?: 'primary' | 'outline' | 'soft' | 'danger' | 'accent'; icon?: LucideIcon; disabled?: boolean; loading?: boolean; style?: ViewStyle;
}) {
  const theme = useTheme();
  const solid = variant === 'primary' || variant === 'danger' || variant === 'accent';
  const color = variant === 'danger' ? tokens.state.critical : variant === 'accent' ? tokens.brand.sunDeep : theme.appbar;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading }}
      disabled={disabled || loading} onPress={onPress}
      style={({ pressed }) => [s.button, {
        backgroundColor: solid ? color : variant === 'soft' ? theme.surfaceAlt : 'transparent',
        borderColor: solid ? color : theme.border,
        opacity: disabled || loading ? 0.45 : pressed ? 0.78 : 1,
      }, style]}
    >
      {loading ? <ActivityIndicator color={solid ? '#fff' : theme.text} size="small" /> : Icon ? <Icon size={17} color={solid ? '#fff' : theme.text} /> : null}
      <T variant="titleS" color={solid ? '#fff' : theme.text}>{title}</T>
    </Pressable>
  );
}

export function Action({ title, task, ...props }: Omit<React.ComponentProps<typeof Button>, 'onPress'> & { task: () => Promise<unknown> }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useApp();
  return <Button {...props} title={title} loading={loading} onPress={() => {
    if (loading) return;
    setLoading(true);
    void task().catch((error: unknown) => toast(error instanceof Error ? error.message : 'Please try again.', 'error')).finally(() => setLoading(false));
  }} />;
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        accessibilityLabel={label} placeholderTextColor={theme.muted} {...props}
        style={[s.input, {
          backgroundColor: theme.surface, color: theme.text, borderColor: theme.border,
          minHeight: props.multiline ? 110 : 49, textAlignVertical: props.multiline ? 'top' : 'center',
        }, props.style]}
      />
    </View>
  );
}

export function Section({ title, caption, action, onPress }: { title: string; caption?: string; action?: string; onPress?: () => void }) {
  const theme = useTheme();
  return (
    <Row style={{ marginTop: 4 }}>
      <View style={{ flex: 1 }}>
        <T variant="titleM">{title}</T>
        {caption ? <T variant="bodyS" color={theme.muted}>{caption}</T> : null}
      </View>
      {action ? <Pressable accessibilityRole="button" onPress={onPress}><T variant="titleS" color={tokens.brand.sky}>{action}</T></Pressable> : null}
    </Row>
  );
}

export function Ring({ value, size = 126, color = tokens.brand.limeDeep, label, suffix = '%' }: { value: number | null; size?: number; color?: string; label?: string; suffix?: string }) {
  const theme = useTheme();
  const r = (size - 12) / 2;
  const circumference = 2 * Math.PI * r;
  const target = Math.min(1, Math.max(0, value ?? 0));
  const shown = useSharedValue(0);
  useEffect(() => { shown.value = withTiming(target, { duration: 900 }); }, [target, shown]);
  // strokeDashoffset is an SVG attribute, so it animates through animatedProps.
  const animated = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - shown.value) }));
  return (
    <View accessibilityLabel={`${label ?? 'Mastery'} ${value === null ? 'no data' : `${Math.round(value * 100)} percent`}`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={theme.surfaceAlt} strokeWidth={9} />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={9}
          strokeDasharray={`${circumference} ${circumference}`} strokeLinecap="round"
          rotation={-90} origin={`${size / 2}, ${size / 2}`} animatedProps={animated}
        />
      </Svg>
      <T variant="displayL" style={{ fontSize: size * 0.24, lineHeight: size * 0.29 }}>{value === null ? '—' : `${Math.round(value * 100)}${suffix}`}</T>
      {label ? <T variant="bodyS" color={theme.muted}>{label}</T> : null}
    </View>
  );
}

export function Trend({ values, color = tokens.brand.limeDeep }: { values: number[]; color?: string }) {
  const theme = useTheme();
  const width = 310, height = 90;
  const points = values.map((v, i) => [10 + (i * (width - 20)) / Math.max(1, values.length - 1), height - 10 - Math.min(1, Math.max(0, v)) * 65]);
  const path = points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' ');
  if (values.length < 2) return <T variant="bodyS" color={theme.muted}>Your trend appears after more progress snapshots.</T>;
  return (
    <Animated.View entering={FadeIn.duration(400)}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={10} y1={height - 10} x2={width - 10} y2={height - 10} stroke={theme.border} />
        <Path d={`${path} L ${width - 10} ${height - 10} L 10 ${height - 10} Z`} fill={`${color}14`} />
        <Path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {points.map(([x, y], i) => <Circle key={i} cx={x} cy={y} r={3} fill={color} />)}
      </Svg>
    </Animated.View>
  );
}

export function Pills<TValue extends string>({ items, value, onChange }: { items: { label: string; value: TValue }[]; value: TValue; onChange: (value: TValue) => void }) {
  const theme = useTheme();
  return (
    <Row style={{ backgroundColor: theme.surfaceAlt, padding: 4, borderRadius: radius.sm, gap: 3 }}>
      {items.map((item) => {
        const active = value === item.value;
        return (
          <Pressable
            key={item.value} accessibilityRole="button" accessibilityState={{ selected: active }} onPress={() => onChange(item.value)}
            style={[{ flex: 1, minHeight: 44, justifyContent: 'center', borderRadius: radius.sm, alignItems: 'center', backgroundColor: active ? theme.surface : 'transparent' }, active ? elevation.card : null]}
          >
            <T variant={active ? 'labelPill' : 'titleS'} color={active ? theme.navActive : theme.muted} style={{ fontSize: 13 }}>{item.label}</T>
          </Pressable>
        );
      })}
    </Row>
  );
}

export function Info({ title, text, icon: Icon = Check, color = tokens.state.success }: { title: string; text: string; icon?: LucideIcon; color?: string }) {
  return (
    <Card style={{ backgroundColor: `${color}0F`, borderColor: `${color}2E` }}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Icon color={color} size={18} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 4 }}>
          <T variant="titleS" color={color}>{title}</T>
          <T variant="bodyS">{text}</T>
        </View>
      </Row>
    </Card>
  );
}

export function Empty({ title, text, icon: Icon = ArrowRight }: { title: string; text: string; icon?: LucideIcon }) {
  const theme = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: 12, paddingVertical: 32 }}>
      <IconTile icon={Icon} color={theme.navActive} tint={tokens.tint.forestBright} size={48} />
      <T variant="titleM">{title}</T>
      <T variant="bodyS" color={theme.muted} style={{ textAlign: 'center', maxWidth: 280 }}>{text}</T>
    </Card>
  );
}

export function ListRow({ title, detail, icon: Icon, onPress, right }: { title: string; detail?: string; icon?: LucideIcon; onPress?: () => void; right?: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} style={({ pressed }) => ({ paddingVertical: 12, opacity: pressed && onPress ? 0.65 : 1 })}>
      <Row>
        {Icon ? <Icon size={19} color={theme.text} strokeWidth={1.8} /> : null}
        <View style={{ flex: 1 }}>
          <T variant="titleS">{title}</T>
          {detail ? <T variant="bodyS" color={theme.muted}>{detail}</T> : null}
        </View>
        {right ?? (onPress ? <ChevronRight size={15} color={theme.muted} /> : null)}
      </Row>
    </Pressable>
  );
}

export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(6,30,25,0.5)', justifyContent: 'flex-end' }}>
        <Pressable accessibilityLabel="Close dialog" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={{ width: '100%', maxWidth: 560, alignSelf: 'center', maxHeight: '88%', backgroundColor: theme.page, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: 22, paddingBottom: 34, gap: 16 }}>
          <Row>
            <T variant="displayL" style={{ flex: 1 }}>{title}</T>
            <Pressable accessibilityRole="button" accessibilityLabel="Close dialog" onPress={onClose} style={{ padding: 8 }}>
              <X size={20} color={theme.text} />
            </Pressable>
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  card: { padding: 14, borderWidth: 1, borderRadius: radius.md, gap: 9 },
  button: { minHeight: 46, borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: 15, paddingVertical: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  input: { borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 12, fontFamily: 'PublicSans_400Regular', fontSize: 13 },
});

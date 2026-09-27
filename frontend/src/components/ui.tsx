import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import type { Interest } from '../data/catalog';
import { makeStyles, MAX_CONTENT_WIDTH, useTheme } from '../theme';

export type IoniconName = ComponentProps<typeof Ionicons>['name'];
export type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

// ---------------------------------------------------------------------------------------------
// Layout

type ScreenProps = {
  children: ReactNode;
  /** Rendered above the scrolling content, e.g. a `Header`. */
  header?: ReactNode;
  /** Pinned below the content, e.g. the primary action of a form. */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  contentStyle?: StyleProp<ViewStyle>;
  /** Enables pull-to-refresh on scrolling screens; the spinner shows until it resolves. */
  onRefresh?: () => Promise<unknown>;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  edges = ['top', 'bottom'],
  contentStyle,
  onRefresh,
}: ScreenProps) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (!onRefresh) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } catch {
      // Screens show their own load errors; the spinner just needs to stop.
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        {header ? <View style={styles.column}>{header}</View> : null}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.column, styles.content, contentStyle]}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              onRefresh ? (
                <RefreshControl colors={[colors.primary]} onRefresh={refresh} refreshing={refreshing} tintColor={colors.primary} />
              ) : undefined
            }
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.column, styles.content, contentStyle]}>{children}</View>
        )}
        {footer ? <View style={[styles.column, styles.footer]}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type HeaderProps = {
  title?: string;
  subtitle?: string;
  /** Defaults to going back. Pass `null` to hide the back arrow. */
  onBack?: (() => void) | null;
  right?: ReactNode;
  centered?: boolean;
};

export function Header({ title, subtitle, onBack, right, centered = false }: HeaderProps) {
  const styles = useStyles();
  const showBack = onBack !== null;

  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack ? <BackButton onPress={onBack ?? undefined} /> : null}
      </View>
      <View style={[styles.headerTitleWrap, !centered && styles.headerTitleLeft]}>
        {title ? (
          <Txt numberOfLines={1} variant="h3">
            {title}
            {subtitle ? <Txt color="muted" variant="body"> {subtitle}</Txt> : null}
          </Txt>
        ) : null}
      </View>
      <View style={[styles.headerSide, styles.headerRight]}>{right}</View>
    </View>
  );
}

export function BackButton({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <IconButton
      accessibilityLabel="Back"
      icon={<Ionicons color={colors.text} name="arrow-back" size={22} />}
      onPress={onPress ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
    />
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  filled = false,
  style,
}: {
  icon: ReactNode;
  onPress?: () => void;
  accessibilityLabel: string;
  filled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.iconButton,
        filled && styles.iconButtonFilled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Text

type TxtProps = TextProps & {
  variant?: 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodyStrong' | 'caption' | 'label';
  color?: 'default' | 'muted' | 'subtle' | 'primary' | 'success' | 'danger' | 'inverse';
  center?: boolean;
  style?: StyleProp<TextStyle>;
};

export function Txt({ variant = 'body', color = 'default', center, style, ...props }: TxtProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const tone = {
    default: colors.text,
    muted: colors.textMuted,
    subtle: colors.textSubtle,
    primary: colors.primary,
    success: colors.success,
    danger: colors.danger,
    inverse: '#FFFFFF',
  }[color];

  return (
    <Text
      {...props}
      style={[styles[variant], { color: tone }, center && styles.center, style]}
    />
  );
}

export function TitleBlock({ title, subtitle }: { title: string; subtitle?: string }) {
  const styles = useStyles();
  return (
    <View style={styles.titleBlock}>
      <Txt center variant="h1">
        {title}
      </Txt>
      {subtitle ? (
        <Txt center color="muted" style={styles.titleBlockSubtitle}>
          {subtitle}
        </Txt>
      ) : null}
    </View>
  );
}

export function SectionTitle({
  title,
  action,
  onAction,
  style,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.sectionTitle, style]}>
      <Txt variant="h3">{title}</Txt>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <Txt color="primary" variant="label">
            {action} ›
          </Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Controls

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'primary' | 'outline' | 'soft' | 'ghost' | 'light';
  icon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading = false,
  disabled = false,
  compact = false,
  style,
}: ButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const textColor = {
    primary: colors.onPrimary,
    outline: colors.primary,
    soft: colors.primary,
    ghost: colors.primary,
    light: colors.primary,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        styles[`button_${variant}`],
        disabled && !loading && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonText, compact && styles.buttonTextCompact, { color: textColor }]}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

type FieldProps = TextInputProps & {
  icon?: IoniconName;
  label?: string;
  /** Adds a show/hide toggle for passwords. */
  secure?: boolean;
  right?: ReactNode;
  /** Shown under the field, which is outlined in red. */
  error?: string;
  /** Shown under the field when there is no error. */
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<TextInput>;
};

export function Field({ icon, label, secure, right, error, hint, containerStyle, multiline, style, ref, ...props }: FieldProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(true);

  return (
    <View style={containerStyle}>
      {label ? (
        <Txt style={styles.fieldLabel} variant="label">
          {label}
        </Txt>
      ) : null}
      <View style={[styles.field, multiline && styles.fieldMultiline, error ? styles.fieldError : null]}>
        {icon ? <Ionicons color={colors.textSubtle} name={icon} size={18} /> : null}
        <TextInput
          placeholderTextColor={colors.textSubtle}
          secureTextEntry={secure && hidden}
          selectionColor={colors.primary}
          {...props}
          multiline={multiline}
          ref={ref}
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline, style]}
        />
        {secure ? (
          <Pressable
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
            hitSlop={10}
            onPress={() => setHidden((value) => !value)}
          >
            <Ionicons color={colors.textSubtle} name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} />
          </Pressable>
        ) : null}
        {right}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={styles.fieldErrorText}>
          {error}
        </Text>
      ) : hint ? (
        <Txt color="subtle" style={styles.fieldHint} variant="caption">
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  error?: string;
}) {
  const styles = useStyles();
  return (
    <View>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        hitSlop={6}
        onPress={() => onChange(!checked)}
        style={styles.checkboxRow}
      >
        <View style={[styles.checkbox, checked && styles.checkboxChecked, error ? styles.fieldError : null]}>
          {checked ? <Ionicons color="#FFFFFF" name="checkmark" size={14} /> : null}
        </View>
        <View style={styles.flex}>{children}</View>
      </Pressable>
      {error ? <Text style={styles.fieldErrorText}>{error}</Text> : null}
    </View>
  );
}

export function SearchBar({
  placeholder = 'Where do you want to go?',
  onPress,
  value,
  onChangeText,
  autoFocus,
  right,
}: {
  placeholder?: string;
  onPress?: () => void;
  value?: string;
  onChangeText?: (value: string) => void;
  autoFocus?: boolean;
  right?: ReactNode;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (onPress) {
    return (
      <Pressable accessibilityRole="search" onPress={onPress} style={styles.searchBar}>
        <Ionicons color={colors.textMuted} name="search" size={18} />
        <Txt color="subtle" style={styles.flex}>
          {placeholder}
        </Txt>
        {right}
      </Pressable>
    );
  }

  return (
    <View style={styles.searchBar}>
      <Ionicons color={colors.textMuted} name="search" size={18} />
      <TextInput
        autoFocus={autoFocus}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        returnKeyType="search"
        selectionColor={colors.primary}
        style={styles.searchInput}
        value={value}
      />
      {right}
    </View>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed, style]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({
  options,
  value,
  onChange,
  scroll = true,
  grow = false,
}: {
  options: string[];
  value: string | null;
  onChange: (value: string) => void;
  scroll?: boolean;
  /** Stretch chips to share the row equally. */
  grow?: boolean;
}) {
  const styles = useStyles();
  const chips = options.map((option) => (
    <Chip
      key={option}
      label={option}
      onPress={() => onChange(option)}
      selected={option === value}
      style={grow && styles.flex}
    />
  ));

  if (!scroll) return <View style={styles.chipWrap}>{chips}</View>;
  return (
    <ScrollView
      contentContainerStyle={styles.chipScroll}
      horizontal
      showsHorizontalScrollIndicator={false}
    >
      {chips}
    </ScrollView>
  );
}

/** Pill tabs, e.g. Upcoming / Active / Completed or Day 1 / Day 2. */
export function SegmentTabs({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.segments}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text numberOfLines={1} style={[styles.segmentText, selected && styles.segmentTextSelected]}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Underlined tabs, e.g. About / Itinerary / Travelers / Reviews. */
export function UnderlineTabs({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.underlineTabs}>
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={option}
            onPress={() => onChange(option)}
            style={[styles.underlineTab, selected && styles.underlineTabSelected]}
          >
            <Txt color={selected ? 'primary' : 'muted'} variant="label">
              {option}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RadioOption({
  label,
  description,
  selected,
  onPress,
  boxed = true,
}: {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  boxed?: boolean;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.radioRow,
        boxed && styles.radioBoxed,
        boxed && selected && styles.radioBoxedSelected,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{label}</Txt>
        {description ? (
          <Txt color="muted" variant="caption">
            {description}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** A tile with a round colored icon and a label, for travel styles and trip activities. */
export function InterestTile({
  interest,
  selected,
  onPress,
}: {
  interest: Interest;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.interestTile, selected && styles.interestTileSelected, pressed && styles.pressed]}
    >
      <View style={[styles.interestIcon, { backgroundColor: isDark ? `${interest.tint}33` : interest.background }]}>
        <MaterialCommunityIcons color={interest.tint} name={interest.icon as MciName} size={26} />
      </View>
      <Txt center numberOfLines={1} variant="caption">
        {interest.label}
      </Txt>
      {selected ? (
        <View style={styles.interestCheck}>
          <Ionicons color="#FFFFFF" name="checkmark" size={12} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function InterestGrid({
  items,
  selected,
  onToggle,
}: {
  items: Interest[];
  selected: string[];
  onToggle: (key: Interest['key']) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.interestGrid}>
      {items.map((interest) => (
        <View key={interest.key} style={styles.interestCell}>
          <InterestTile
            interest={interest}
            onPress={() => onToggle(interest.key)}
            selected={selected.includes(interest.key)}
          />
        </View>
      ))}
    </View>
  );
}

export function StepProgress({ step, total }: { step: number; total: number }) {
  const styles = useStyles();
  return (
    <View accessibilityLabel={`Step ${step} of ${total}`} style={styles.steps}>
      {Array.from({ length: total }, (_, index) => {
        const number = index + 1;
        const isDone = number < step;
        const isCurrent = number === step;
        return (
          <View key={number} style={[styles.stepItem, index === total - 1 && styles.stepItemLast]}>
            <View style={[styles.stepDot, (isDone || isCurrent) && styles.stepDotDone, isCurrent && styles.stepDotCurrent]} />
            {index < total - 1 ? <View style={[styles.stepLine, isDone && styles.stepLineDone]} /> : null}
          </View>
        );
      })}
    </View>
  );
}

export function PageDots({ count, index }: { count: number; index: number }) {
  const styles = useStyles();
  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Content

export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

export function Avatar({
  uri,
  size = 44,
  verified = false,
  name,
}: {
  uri?: string | null;
  size?: number;
  verified?: boolean;
  /** Initials are shown when there is no photo. */
  name?: string | null;
}) {
  const styles = useStyles();
  const initials = (name ?? '?')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <View style={{ width: size, height: size }}>
      {uri ? (
        <Image source={{ uri }} style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
          <Text style={[styles.avatarInitials, { fontSize: size * 0.36 }]}>{initials}</Text>
        </View>
      )}
      {verified ? (
        <View style={styles.verifiedBadge}>
          <Ionicons color="#FFFFFF" name="checkmark" size={9} />
        </View>
      ) : null}
    </View>
  );
}

export function VerifiedIcon({ size = 16 }: { size?: number }) {
  const { colors } = useTheme();
  return <MaterialCommunityIcons color={colors.primary} name="check-decagram" size={size} />;
}

/** An icon with a line of text, e.g. the date or group size on a trip card. */
export function MetaRow({
  icon,
  children,
  small = false,
}: {
  icon: IoniconName;
  children: ReactNode;
  small?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.metaRow}>
      <Ionicons color={colors.textMuted} name={icon} size={small ? 13 : 16} />
      <Txt color="muted" numberOfLines={1} style={styles.flex} variant={small ? 'caption' : 'body'}>
        {children}
      </Txt>
    </View>
  );
}

export function ListRow({
  icon,
  iconTint,
  iconBackground,
  title,
  subtitle,
  onPress,
  right,
  boxed = false,
}: {
  icon: MciName;
  iconTint?: string;
  iconBackground?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
  boxed?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, boxed && styles.listRowBoxed, pressed && styles.pressed]}
    >
      <View style={[styles.listIcon, iconBackground ? { backgroundColor: iconBackground } : null]}>
        <MaterialCommunityIcons color={iconTint ?? colors.textMuted} name={icon} size={20} />
      </View>
      <View style={styles.flex}>
        <Txt variant="bodyStrong">{title}</Txt>
        {subtitle ? (
          <Txt color="muted" variant="caption">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} /> : null)}
    </Pressable>
  );
}

export function EmptyState({ icon, title, message }: { icon: MciName; title: string; message: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons color={colors.textSubtle} name={icon} size={40} />
      <Txt center variant="h3">
        {title}
      </Txt>
      <Txt center color="muted">
        {message}
      </Txt>
    </View>
  );
}

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.stars}>
      {Array.from({ length: 5 }, (_, i) => (
        <Ionicons
          color={colors.star}
          key={i}
          name={rating >= i + 1 ? 'star' : rating > i ? 'star-half' : 'star-outline'}
          size={size}
        />
      ))}
    </View>
  );
}

export function TripivoLogo({ size = 64, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg height={(size * 40) / 64} viewBox="0 0 64 40" width={size}>
      <Path d="M2 38 L24 8 L34 21 L41 13 L62 38 Z" fill={color} />
    </Svg>
  );
}

export function GoogleLogo({ size = 20 }: { size?: number }) {
  return (
    <Svg height={size} viewBox="0 0 48 48" width={size}>
      <Path
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
        fill="#FFC107"
      />
      <Path
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
        fill="#FF3D00"
      />
      <Path
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
        fill="#4CAF50"
      />
      <Path
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
        fill="#1976D2"
      />
    </Svg>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const styles = useStyles();
  return (
    <Text accessibilityRole="alert" style={styles.error}>
      {children}
    </Text>
  );
}

export function LoadingState() {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

/** A failed load, with a retry button. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <MaterialCommunityIcons color={colors.textSubtle} name="cloud-alert-outline" size={40} />
      <Txt center variant="h3">
        Couldn’t load this
      </Txt>
      <Txt center color="muted">
        {message}
      </Txt>
      {onRetry ? <Button compact label="Try again" onPress={onRetry} style={styles.retry} variant="soft" /> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

// react-native-web draws the browser's focus ring around inputs; the field borders replace it.
const noWebOutline = Platform.OS === 'web' ? ({ outlineWidth: 0, outlineStyle: 'none' } as object) : {};

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: c.background },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  content: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12 },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  center: { textAlign: 'center' },

  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  headerSide: { minWidth: 44, flexDirection: 'row', alignItems: 'center' },
  headerRight: { justifyContent: 'flex-end', gap: 4 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitleLeft: { alignItems: 'flex-start', paddingLeft: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  iconButtonFilled: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border },

  display: { fontSize: 34, fontWeight: '800', letterSpacing: -0.5 },
  h1: { fontSize: 24, fontWeight: '800', lineHeight: 31 },
  h2: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  h3: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  body: { fontSize: 14, lineHeight: 20 },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 17 },
  label: { fontSize: 13, fontWeight: '600', lineHeight: 18 },

  titleBlock: { alignItems: 'center', marginTop: 8, marginBottom: 24, gap: 6 },
  titleBlockSubtitle: { maxWidth: 280 },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
  },

  button: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 20,
    borderRadius: 26,
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20 },
  button_primary: {
    backgroundColor: c.primary,
    shadowColor: c.primary,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  button_outline: { borderWidth: 1.5, borderColor: c.primary, backgroundColor: 'transparent' },
  button_soft: { backgroundColor: c.primarySoft },
  button_ghost: { backgroundColor: 'transparent' },
  button_light: { backgroundColor: '#FFFFFF' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextCompact: { fontSize: 14 },

  fieldLabel: { marginBottom: 8, color: c.text },
  field: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    backgroundColor: c.surface,
  },
  fieldMultiline: { alignItems: 'flex-start', paddingVertical: 12 },
  fieldError: { borderColor: c.danger },
  fieldErrorText: { marginTop: 6, marginLeft: 4, color: c.danger, fontSize: 12, lineHeight: 17 },
  fieldHint: { marginTop: 6, marginLeft: 4 },
  checkboxRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    marginTop: 1,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: c.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: { borderColor: c.primary, backgroundColor: c.primary },
  fieldInput: { flex: 1, minWidth: 0, minHeight: 50, color: c.text, fontSize: 15, ...noWebOutline },
  fieldInputMultiline: { minHeight: 80, textAlignVertical: 'top', paddingTop: 0 },

  searchBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  searchInput: { flex: 1, minWidth: 0, minHeight: 46, color: c.text, fontSize: 15, ...noWebOutline },

  chip: {
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  chipSelected: { backgroundColor: c.primary, borderColor: c.primary },
  chipText: { color: c.text, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: c.onPrimary },
  chipScroll: { gap: 8, paddingRight: 8 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  segments: { flexDirection: 'row', gap: 8 },
  segment: {
    flex: 1,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderRadius: 19,
    backgroundColor: c.surfaceAlt,
  },
  segmentSelected: { backgroundColor: c.primary },
  segmentText: { color: c.textMuted, fontSize: 13, fontWeight: '600' },
  segmentTextSelected: { color: c.onPrimary },

  underlineTabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border },
  underlineTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  underlineTabSelected: { borderBottomColor: c.primary },

  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  radioBoxed: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  radioBoxedSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: c.textSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: c.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.primary },

  interestGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  interestCell: { width: '33.333%', padding: 5 },
  interestTile: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'transparent',
    backgroundColor: c.surface,
  },
  interestTileSelected: { borderColor: c.primary, backgroundColor: c.primarySoft },
  interestIcon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  interestCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },

  steps: { flexDirection: 'row', alignItems: 'center', marginVertical: 12 },
  stepItem: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  stepItemLast: { flex: 0 },
  stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
  stepDotDone: { backgroundColor: c.primary },
  stepDotCurrent: { width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: c.primarySoft },
  stepLine: { flex: 1, height: 2, marginHorizontal: 4, backgroundColor: c.border },
  stepLineDone: { backgroundColor: c.primary },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.border },
  dotActive: { width: 22, backgroundColor: c.primary },

  card: {
    padding: 12,
    borderRadius: 18,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  avatar: { backgroundColor: c.surfaceAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.primarySoft },
  avatarInitials: { color: c.primary, fontWeight: '700' },
  verifiedBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: c.surface,
    backgroundColor: c.primary,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  listRowBoxed: {
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  listIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40, paddingHorizontal: 20 },
  loading: { paddingVertical: 60, alignItems: 'center', justifyContent: 'center' },
  retry: { marginTop: 8 },
  stars: { flexDirection: 'row', gap: 2 },
  error: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: c.dangerSoft,
    color: c.danger,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
}));

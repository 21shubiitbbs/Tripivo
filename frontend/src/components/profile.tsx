import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import {
  BADGES,
  industryLabel,
  interests,
  isInterestKey,
  PROFILE_PARTS,
  promptQuestion,
  VIBE_AXES,
} from '../data/catalog';
import type { BucketListItem, Compatibility, MyProfile, Profile, ProfilePrompt, Vibe, VibeAxis } from '../lib/api';
import { makeStyles, useTheme } from '../theme';
import { Avatar, Chip, MetaRow, SectionTitle, Txt, VerifiedIcon, type MciName } from './ui';

// Pieces of a traveler profile, shared by the Profile tab, other travelers' profiles and the
// screens that edit them.

type HeaderProfile = Pick<Profile, 'name' | 'username' | 'picture' | 'verified' | 'city' | 'profession' | 'industry'>;

export function ProfileHeader({ profile }: { profile: HeaderProfile }) {
  const styles = useStyles();
  const work = [profile.profession, industryLabel(profile.industry)]
    .filter((part, index, parts) => part && parts.indexOf(part) === index)
    .join(' · ');
  return (
    <View style={styles.identity}>
      <Avatar name={profile.name} size={92} uri={profile.picture} />
      <View style={styles.identityText}>
        <View style={styles.nameRow}>
          <Txt numberOfLines={1} style={styles.name} variant="h2">
            {profile.name || 'Traveler'}
          </Txt>
          {profile.verified ? <VerifiedIcon /> : null}
        </View>
        {profile.username ? <Txt color="muted">@{profile.username}</Txt> : null}
        {profile.city ? <MetaRow icon="location-outline">{profile.city}</MetaRow> : null}
        {work ? <MetaRow icon="briefcase-outline">{work}</MetaRow> : null}
      </View>
    </View>
  );
}

export function ProfileStats({ stats }: { stats: Profile['stats'] }) {
  const styles = useStyles();
  const items = [
    { label: 'Trips', value: String(stats.trips) },
    { label: 'Rating', value: stats.rating?.toFixed(1) ?? '–' },
    { label: 'Followers', value: String(stats.followers) },
    { label: 'Following', value: String(stats.following) },
  ];
  return (
    <View style={styles.stats}>
      {items.map((stat, index) => (
        <Fragment key={stat.label}>
          {index > 0 ? <View style={styles.statDivider} /> : null}
          <View style={styles.stat}>
            <Txt variant="h3">{stat.value}</Txt>
            <Txt color="muted" variant="caption">
              {stat.label}
            </Txt>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** `highlight`: keys to mark as shared with the viewer. */
export function InterestTags({ keys, highlight = [] }: { keys: string[]; highlight?: string[] }) {
  const styles = useStyles();
  const known = keys.filter(isInterestKey);
  if (!known.length) return null;
  return (
    <>
      <SectionTitle title="Interests" />
      <View style={styles.tags}>
        {known.map((key) => (
          <View key={key} style={[styles.tag, highlight.includes(key) && styles.tagShared]}>
            <MaterialCommunityIcons color={interests[key].tint} name={interests[key].icon as MciName} size={16} />
            <Txt variant="caption">{interests[key].label}</Txt>
          </View>
        ))}
      </View>
    </>
  );
}

/** A titled row of pills, e.g. languages. `highlight`: labels shared with the viewer. */
export function TagSection({
  title,
  items,
  highlight = [],
}: {
  title: string;
  items: { label: string; icon?: string }[];
  highlight?: string[];
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!items.length) return null;
  const shared = highlight.map((item) => item.toLowerCase());
  return (
    <>
      <SectionTitle title={title} />
      <View style={styles.tags}>
        {items.map((item) => (
          <View key={item.label} style={[styles.tag, shared.includes(item.label.toLowerCase()) && styles.tagShared]}>
            {item.icon ? <MaterialCommunityIcons color={colors.textMuted} name={item.icon as MciName} size={16} /> : null}
            <Txt variant="caption">{item.label}</Txt>
          </View>
        ))}
      </View>
    </>
  );
}

export function BadgeRow({ badges }: { badges: string[] }) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const known = badges.filter((key) => BADGES[key]);
  if (!known.length) return null;
  return (
    <ScrollView contentContainerStyle={styles.badges} horizontal showsHorizontalScrollIndicator={false}>
      {known.map((key) => {
        const badge = BADGES[key];
        return (
          <View accessibilityLabel={`${badge.label}: ${badge.description}`} key={key} style={styles.badge}>
            <View style={[styles.badgeIcon, { backgroundColor: `${badge.tint}${isDark ? '33' : '1A'}` }]}>
              <MaterialCommunityIcons color={badge.tint} name={badge.icon as MciName} size={18} />
            </View>
            <Txt variant="label">{badge.label}</Txt>
          </View>
        );
      })}
    </ScrollView>
  );
}

/**
 * The travel vibe as a 5-step scale per axis. With `compareTo`, the viewer's own position is
 * drawn as a ring so two travelers can see where they differ.
 */
export function VibeView({ vibe, compareTo }: { vibe: Vibe; compareTo?: Vibe | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const axes = VIBE_AXES.filter((axis) => vibe[axis.key] !== null);
  if (!axes.length) return null;
  return (
    <View style={styles.vibe}>
      {axes.map((axis) => {
        const value = vibe[axis.key]!;
        const mine = compareTo?.[axis.key] ?? null;
        return (
          <View key={axis.key} style={styles.vibeAxis}>
            <View style={styles.vibeLabelRow}>
              <MaterialCommunityIcons color={colors.primary} name={axis.icon as MciName} size={16} />
              <Txt variant="label">{axis.label}</Txt>
            </View>
            <View style={styles.vibeTrack}>
              {[1, 2, 3, 4, 5].map((step) => (
                <View key={step} style={styles.vibeStep}>
                  <View
                    style={[
                      styles.vibeDot,
                      step === value && styles.vibeDotOn,
                      step === mine && (step === value ? styles.vibeDotBoth : styles.vibeDotMine),
                    ]}
                  />
                </View>
              ))}
            </View>
            <View style={styles.vibeEnds}>
              <Txt color="muted" variant="caption">
                {axis.low}
              </Txt>
              <Txt color="muted" variant="caption">
                {axis.high}
              </Txt>
            </View>
          </View>
        );
      })}
      {compareTo && axes.some((axis) => compareTo[axis.key] !== null) ? (
        <View style={styles.vibeLegend}>
          <View style={[styles.vibeDot, styles.vibeDotOn, styles.legendDot]} />
          <Txt color="muted" variant="caption">
            Them
          </Txt>
          <View style={[styles.vibeDot, styles.vibeDotMine, styles.legendDot]} />
          <Txt color="muted" variant="caption">
            You
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

/** Pick a 1–5 position on every vibe axis. */
export function VibePicker({ value, onChange }: { value: Vibe; onChange: (axis: VibeAxis, step: number) => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.vibe}>
      {VIBE_AXES.map((axis) => (
        <View key={axis.key} style={styles.vibeAxis}>
          <View style={styles.vibeLabelRow}>
            <MaterialCommunityIcons color={colors.primary} name={axis.icon as MciName} size={18} />
            <Txt variant="bodyStrong">{axis.label}</Txt>
          </View>
          <View accessibilityRole="radiogroup" style={styles.pickerTrack}>
            {[1, 2, 3, 4, 5].map((step) => {
              const selected = value[axis.key] === step;
              return (
                <Pressable
                  accessibilityLabel={`${axis.label}: ${step} of 5, from ${axis.low} to ${axis.high}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  hitSlop={4}
                  key={step}
                  onPress={() => onChange(axis.key, step)}
                  style={({ pressed }) => [styles.pickerStep, selected && styles.pickerStepOn, pressed && styles.pressed]}
                >
                  <Txt color={selected ? 'inverse' : 'muted'} variant="label">
                    {step}
                  </Txt>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.vibeEnds}>
            <Txt color="muted" variant="caption">
              {axis.low}
            </Txt>
            <Txt color="muted" variant="caption">
              {axis.high}
            </Txt>
          </View>
        </View>
      ))}
    </View>
  );
}

export function PromptCards({ prompts }: { prompts: ProfilePrompt[] }) {
  const styles = useStyles();
  if (!prompts.length) return null;
  return (
    <View style={styles.prompts}>
      {prompts.map((prompt) => (
        <View key={prompt.prompt} style={styles.promptCard}>
          <Txt color="muted" variant="label">
            {promptQuestion(prompt.prompt)}
          </Txt>
          <Txt style={styles.promptAnswer} variant="h3">
            {prompt.answer}
          </Txt>
        </View>
      ))}
    </View>
  );
}

/** `shared`: names also on the viewer's bucket list, drawn highlighted. */
export function BucketListView({ items, shared = [] }: { items: BucketListItem[]; shared?: string[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (!items.length) return null;
  const sharedNames = shared.map((name) => name.toLowerCase());
  return (
    <View style={styles.tags}>
      {items.map((item) => {
        const isShared = sharedNames.includes(item.name.toLowerCase());
        return (
          <View key={item.id} style={[styles.tag, isShared && styles.tagShared]}>
            <MaterialCommunityIcons
              color={isShared ? colors.primary : colors.textMuted}
              name={isShared ? 'star-four-points' : 'map-marker-outline'}
              size={16}
            />
            <Txt variant="caption">{item.name}</Txt>
          </View>
        );
      })}
    </View>
  );
}

/** Why the viewer and this traveler would get on: score, reasons and what they share. */
export function CompatibilityCard({ compatibility, name }: { compatibility: Compatibility; name: string | null }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const firstName = name?.split(' ')[0] ?? 'this traveler';
  const tone =
    compatibility.score >= 70 ? 'Great match' : compatibility.score >= 45 ? 'Good match' : 'Some things in common';
  return (
    <View style={styles.compat}>
      <View style={styles.compatTop}>
        <View style={styles.compatScore}>
          <Txt color="inverse" variant="h2">
            {compatibility.score}%
          </Txt>
        </View>
        <View style={styles.flex}>
          <Txt variant="h3">{tone}</Txt>
          <Txt color="muted" variant="caption">
            How you and {firstName} would travel together
            {compatibility.vibeMatch !== null ? ` · ${compatibility.vibeMatch}% vibe match` : ''}
          </Txt>
        </View>
      </View>
      {compatibility.reasons.length ? (
        <View style={styles.compatReasons}>
          {compatibility.reasons.slice(0, 5).map((reason) => (
            <View key={reason} style={styles.compatReason}>
              <Ionicons color={colors.success} name="checkmark-circle" size={16} />
              <Txt style={styles.flex} variant="caption">
                {reason}
              </Txt>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Profile strength with the next things to fill in. */
export function CompletenessCard({ completeness }: { completeness: MyProfile['completeness'] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (completeness.percent >= 100) return null;
  const next = completeness.missing.filter((key) => PROFILE_PARTS[key]).slice(0, 3);
  return (
    <View style={styles.completeness}>
      <View style={styles.compatTop}>
        <View style={styles.flex}>
          <Txt variant="bodyStrong">Profile strength: {completeness.percent}%</Txt>
          <Txt color="muted" variant="caption">
            Complete profiles get better travel matches.
          </Txt>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${completeness.percent}%` }]} />
      </View>
      {next.map((key) => (
        <Pressable
          accessibilityRole="button"
          key={key}
          onPress={() => router.push(PROFILE_PARTS[key].route as never)}
          style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
        >
          <Ionicons color={colors.primary} name="add-circle-outline" size={18} />
          <Txt color="primary" style={styles.flex} variant="label">
            {PROFILE_PARTS[key].label}
          </Txt>
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
        </Pressable>
      ))}
    </View>
  );
}

/** Wrapping chips for picking one or several options by key. */
export function OptionChips<K extends string>({
  options,
  selected,
  onToggle,
}: {
  options: { key: K; label: string }[];
  selected: K[];
  onToggle: (key: K) => void;
}) {
  const styles = useStyles();
  return (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip key={option.key} label={option.label} onPress={() => onToggle(option.key)} selected={selected.includes(option.key)} />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.8 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 16 },
  identityText: { flex: 1, minWidth: 0, gap: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1 },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
    paddingVertical: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, height: 28, backgroundColor: c.border },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: c.surfaceAlt,
  },
  tagShared: { borderColor: c.primary, backgroundColor: c.primarySoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  badges: { gap: 8, paddingVertical: 4 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  badgeIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  vibe: { gap: 16 },
  vibeAxis: { gap: 8 },
  vibeLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vibeTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 14,
    paddingHorizontal: 6,
    backgroundColor: c.surfaceAlt,
  },
  vibeStep: { flex: 1, alignItems: 'center' },
  vibeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: c.border },
  vibeDotOn: { width: 18, height: 18, borderRadius: 9, backgroundColor: c.primary },
  vibeDotMine: { width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: c.warning, backgroundColor: 'transparent' },
  vibeDotBoth: { borderWidth: 3, borderColor: c.warning },
  vibeEnds: { flexDirection: 'row', justifyContent: 'space-between' },
  vibeLegend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { marginLeft: 6 },
  pickerTrack: { flexDirection: 'row', gap: 8 },
  pickerStep: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  pickerStepOn: { borderColor: c.primary, backgroundColor: c.primary },

  prompts: { gap: 12 },
  promptCard: {
    gap: 6,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  promptAnswer: { lineHeight: 26 },

  compat: {
    gap: 12,
    marginTop: 16,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.primary,
    backgroundColor: c.primarySoft,
  },
  compatTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  compatScore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
  },
  compatReasons: { gap: 6 },
  compatReason: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  completeness: {
    gap: 10,
    marginBottom: 8,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
  },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.surfaceAlt },
  progressFill: { height: 8, borderRadius: 4, backgroundColor: c.primary },
  nudge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
}));

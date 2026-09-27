import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Fragment } from 'react';
import { View } from 'react-native';
import { interests, isInterestKey } from '../data/catalog';
import type { Profile } from '../lib/api';
import { makeStyles } from '../theme';
import { Avatar, MetaRow, SectionTitle, Txt, VerifiedIcon, type MciName } from './ui';

// Pieces of a traveler profile, shared by the Profile tab and other travelers' profiles.

type HeaderProfile = Pick<Profile, 'name' | 'username' | 'picture' | 'verified' | 'city' | 'profession'>;

export function ProfileHeader({ profile }: { profile: HeaderProfile }) {
  const styles = useStyles();
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
        {profile.profession ? <MetaRow icon="briefcase-outline">{profile.profession}</MetaRow> : null}
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

export function InterestTags({ keys }: { keys: string[] }) {
  const styles = useStyles();
  const known = keys.filter(isInterestKey);
  if (!known.length) return null;
  return (
    <>
      <SectionTitle title="Interests" />
      <View style={styles.tags}>
        {known.map((key) => (
          <View key={key} style={styles.tag}>
            <MaterialCommunityIcons color={interests[key].tint} name={interests[key].icon as MciName} size={16} />
            <Txt variant="caption">{interests[key].label}</Txt>
          </View>
        ))}
      </View>
    </>
  );
}

const useStyles = makeStyles((c) => ({
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
    backgroundColor: c.surfaceAlt,
  },
}));

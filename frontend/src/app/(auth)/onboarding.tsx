import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { Button, InterestGrid, MetaRow, PageDots, Screen, Txt } from '../../components/ui';
import { images, interests, onboardingPortraits, TRAVEL_STYLES, type InterestKey } from '../../data/catalog';
import { useAuth } from '../../lib/auth';
import { makeStyles } from '../../theme';

// 2–5. Onboarding: three intro slides, then the travel-style picker.

const SLIDES = [
  { title: 'Travel Together\nExplore More', subtitle: 'Join like-minded travelers\nfor unforgettable experiences' },
  { title: 'Meet Amazing\nPeople', subtitle: 'Connect with verified travelers\nwho share your interests' },
  { title: 'Plan or Join Trips', subtitle: 'Create your own trips or join\nexisting ones' },
  { title: 'Your Travel Style', subtitle: 'Choose what you love' },
];

export default function OnboardingScreen() {
  const styles = useStyles();
  const { draft, setDraft } = useAuth();
  const [index, setIndex] = useState(0);
  const [styleKeys, setStyleKeys] = useState<string[]>(draft.travelStyles ?? []);
  const slide = SLIDES[index];
  const isLast = index === SLIDES.length - 1;

  function next() {
    if (!isLast) {
      setIndex(index + 1);
      return;
    }
    setDraft({ travelStyles: styleKeys });
    router.push('/location');
  }

  function toggleStyle(key: InterestKey) {
    setStyleKeys((keys) => (keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]));
  }

  return (
    <Screen
      footer={
        <View style={styles.footer}>
          <PageDots count={SLIDES.length} index={index} />
          <Button label="Next" onPress={next} />
        </View>
      }
      header={
        <View style={styles.topBar}>
          {index > 0 ? (
            <Pressable accessibilityLabel="Back" hitSlop={10} onPress={() => setIndex(index - 1)}>
              <Ionicons name="arrow-back" size={22} style={styles.icon} />
            </Pressable>
          ) : (
            <View />
          )}
          {!isLast ? (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => setIndex(SLIDES.length - 1)}>
              <Txt color="muted" variant="label">
                Skip
              </Txt>
            </Pressable>
          ) : null}
        </View>
      }
    >
      <View style={styles.text}>
        <Txt center variant="h1">
          {slide.title}
        </Txt>
        <Txt center color="muted">
          {slide.subtitle}
        </Txt>
      </View>

      {index === 0 ? <Image source={{ uri: images.hikers }} style={styles.hero} /> : null}
      {index === 1 ? <PeopleGlobe /> : null}
      {index === 2 ? <PhoneMock /> : null}
      {index === 3 ? (
        <InterestGrid
          items={TRAVEL_STYLES.map((key) => interests[key])}
          onToggle={toggleStyle}
          selected={styleKeys}
        />
      ) : null}
    </Screen>
  );
}

// Positions of the traveler avatars around the globe, as percentages.
const AVATAR_SPOTS = [
  { left: '18%', top: '8%', size: 48 },
  { left: '70%', top: '4%', size: 40 },
  { left: '40%', top: '36%', size: 72 },
  { left: '6%', top: '52%', size: 56 },
  { left: '76%', top: '56%', size: 50 },
  { left: '44%', top: '80%', size: 42 },
] as const;

function PeopleGlobe() {
  const styles = useStyles();
  return (
    <View style={styles.globe}>
      <View style={styles.globeCircle}>
        <Ionicons color="#9CC0F5" name="earth" size={220} />
      </View>
      {AVATAR_SPOTS.map((spot, i) => (
        <Image
          key={onboardingPortraits[i]}
          source={{ uri: onboardingPortraits[i] }}
          style={[
            styles.globeAvatar,
            { left: spot.left, top: spot.top, width: spot.size, height: spot.size, borderRadius: spot.size / 2 },
          ]}
        />
      ))}
    </View>
  );
}

function PhoneMock() {
  const styles = useStyles();
  return (
    <View style={styles.phone}>
      <View style={styles.phoneNotch} />
      <Image source={{ uri: images.manaliSnow }} style={styles.phoneImage} />
      <Txt style={styles.phoneTitle} variant="bodyStrong">
        Manali Adventure
      </Txt>
      <MetaRow icon="people-outline" small>
        8/12 people
      </MetaRow>
      <MetaRow icon="calendar-outline" small>
        Oct 15 - Oct 20
      </MetaRow>
      <Image source={{ uri: images.ladakh }} style={[styles.phoneImage, styles.phoneImageSecond]} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  topBar: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  icon: { color: c.text },
  text: { alignItems: 'center', gap: 10, marginTop: 16, marginBottom: 28 },
  hero: { width: '100%', aspectRatio: 0.95, borderRadius: 28, backgroundColor: c.surfaceAlt },
  footer: { gap: 20 },
  globe: { width: '100%', aspectRatio: 1, maxWidth: 360, alignSelf: 'center' },
  globeCircle: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: c.primarySoft,
  },
  globeAvatar: { position: 'absolute', borderWidth: 3, borderColor: c.surface, backgroundColor: c.surfaceAlt },
  phone: {
    width: 230,
    alignSelf: 'center',
    gap: 6,
    padding: 12,
    paddingTop: 22,
    borderRadius: 32,
    borderWidth: 6,
    borderColor: c.text,
    backgroundColor: c.surface,
  },
  phoneNotch: {
    position: 'absolute',
    top: 6,
    alignSelf: 'center',
    width: 70,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.text,
  },
  phoneImage: { width: '100%', height: 120, borderRadius: 14, backgroundColor: c.surfaceAlt },
  phoneImageSecond: { height: 80, marginTop: 8, opacity: 0.8 },
  phoneTitle: { marginTop: 6 },
}));

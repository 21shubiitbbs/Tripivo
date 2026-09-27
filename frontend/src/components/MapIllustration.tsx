import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { makeStyles, useTheme } from '../theme';

/** The round map with a pin, from the location permission screen. */
export function MapIllustration() {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const block = isDark ? '#1E2E47' : '#FFFFFF';
  const park = isDark ? '#1F4034' : '#CDEBD3';

  return (
    <View style={styles.map}>
      <Svg height="100%" viewBox="0 0 300 300" width="100%">
        <Rect fill={colors.primarySoft} height={300} rx={150} width={300} />
        <Path d="M40 110 L140 60 L170 120 L80 170 Z" fill={park} />
        <Path d="M180 60 L260 110 L230 170 L170 130 Z" fill={block} />
        <Path d="M70 190 L150 150 L200 230 L120 260 Z" fill={block} />
        <Path d="M200 180 L260 160 L250 230 L215 240 Z" fill={park} />
        <Path d="M20 150 L290 120" stroke={block} strokeWidth={10} />
        <Path d="M150 20 L170 290" stroke={block} strokeWidth={10} />
      </Svg>
      <View style={styles.pin}>
        <Ionicons color={colors.primary} name="location" size={64} />
      </View>
    </View>
  );
}

/** A flat street map filling its container, for the map view. */
export function StreetMap() {
  const { isDark } = useTheme();
  const land = isDark ? '#15233A' : '#EEF1F5';
  const road = isDark ? '#23344F' : '#FFFFFF';
  const park = isDark ? '#1F4034' : '#D5EEDB';
  const water = isDark ? '#1B3656' : '#BFDDF7';

  return (
    <Svg height="100%" preserveAspectRatio="xMidYMid slice" viewBox="0 0 400 300" width="100%">
      <Rect fill={land} height={300} width={400} />
      <Path d="M0 250 C80 230 120 280 200 260 S330 220 400 240 L400 300 L0 300 Z" fill={water} />
      <Path d="M250 40 L330 30 L350 110 L270 120 Z" fill={park} />
      <Path d="M40 60 L120 50 L110 130 L30 120 Z" fill={park} />
      <Path d="M160 150 L220 140 L230 200 L170 210 Z" fill={water} />
      <Path d="M0 90 L400 70" stroke={road} strokeWidth={9} />
      <Path d="M0 180 L400 150" stroke={road} strokeWidth={12} />
      <Path d="M140 0 L180 300" stroke={road} strokeWidth={10} />
      <Path d="M300 0 L260 300" stroke={road} strokeWidth={7} />
      <Path d="M60 0 L20 300" stroke={road} strokeWidth={5} />
      <Path d="M0 0 L400 300" stroke={road} strokeWidth={4} />
    </Svg>
  );
}

const useStyles = makeStyles(() => ({
  map: { width: '80%', maxWidth: 320, aspectRatio: 1, alignSelf: 'center', marginTop: 32 },
  pin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

import type { ConfigContext, ExpoConfig } from 'expo/config';

// Extends app.json. The Google Sign-In plugin needs the iOS client ID reversed into a URL scheme,
// and it fails prebuild without one, so it is only added once that client ID is configured.
export default ({ config }: ConfigContext): ExpoConfig => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const plugins = [...(config.plugins ?? [])];

  if (iosClientId) {
    const iosUrlScheme = `com.googleusercontent.apps.${iosClientId.replace('.apps.googleusercontent.com', '')}`;
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme }]);
  }

  return { ...config, name: config.name ?? 'Tripivo', slug: config.slug ?? 'tripivo', plugins };
};

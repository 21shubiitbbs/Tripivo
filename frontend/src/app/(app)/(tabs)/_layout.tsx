import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable, View, type ColorValue } from 'react-native';
import type { IoniconName } from '../../../components/ui';
import { makeStyles, useTheme } from '../../../theme';

function tabIcon(name: IoniconName, focusedName: IoniconName) {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons color={color} name={focused ? focusedName : name} size={24} />;
  }
  return TabIcon;
}

export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: tabIcon('home-outline', 'home') }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarIcon: tabIcon('briefcase-outline', 'briefcase') }} />
      {/* The middle "+" opens the create-trip flow over the tabs instead of switching tab. */}
      <Tabs.Screen
        name="new"
        options={{ title: 'Create', tabBarButton: () => <CreateTripButton /> }}
      />
      <Tabs.Screen
        name="messages"
        options={{ title: 'Chat', tabBarIcon: tabIcon('chatbubble-ellipses-outline', 'chatbubble-ellipses') }}
      />
      <Tabs.Screen name="profile" options={{ title: 'Me', tabBarIcon: tabIcon('person-outline', 'person') }} />
    </Tabs>
  );
}

function CreateTripButton() {
  const styles = useStyles();
  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityLabel="Create a trip"
        accessibilityRole="button"
        onPress={() => router.push('/create')}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Ionicons color="#FFFFFF" name="add" size={30} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  button: {
    width: 52,
    height: 52,
    marginTop: -14,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.primary,
    shadowColor: c.primary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pressed: { opacity: 0.85 },
}));

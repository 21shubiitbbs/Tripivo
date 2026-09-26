import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { getApiHealth } from './src/lib/api';

type Trip = {
  id: number;
  destination: string;
  dateLabel: string;
};

type ApiStatus = 'checking' | 'online' | 'offline';

export default function App() {
  const [trips, setTrips] = useState<Trip[]>([
    { id: 1, destination: 'Lisbon', dateLabel: 'OCT 18 - 22  /  4 NIGHTS' },
  ]);
  const [isPlannerOpen, setIsPlannerOpen] = useState(false);
  const [destination, setDestination] = useState('');
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    let isActive = true;

    getApiHealth()
      .then(() => {
        if (isActive) setApiStatus('online');
      })
      .catch(() => {
        if (isActive) setApiStatus('offline');
      });

    return () => {
      isActive = false;
    };
  }, []);

  function addTrip() {
    const cleanDestination = destination.trim();
    if (!cleanDestination) return;

    setTrips((currentTrips) => [
      { id: Date.now(), destination: cleanDestination, dateLabel: 'DATES TO BE DECIDED' },
      ...currentTrips,
    ]);
    setDestination('');
    setIsPlannerOpen(false);
  }

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>T</Text>
            </View>
            <Text style={styles.brandName}>tripivo</Text>
          </View>
          <View style={styles.apiBadge}>
            <View
              style={[
                styles.apiDot,
                apiStatus === 'online' && styles.apiDotOnline,
                apiStatus === 'offline' && styles.apiDotOffline,
              ]}
            />
            <Text style={styles.apiText}>API {apiStatus}</Text>
          </View>
        </View>

        <View style={styles.intro}>
          <Text style={styles.eyebrow}>MAKE ROOM FOR SOMEWHERE NEW</Text>
          <Text style={styles.headline}>A little closer to your next escape.</Text>
          <Text style={styles.subheading}>
            Keep the ideas, details, and good parts of every trip in one place.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => setIsPlannerOpen(true)}
          style={({ pressed }) => [styles.planButton, pressed && styles.pressed]}
        >
          <Text style={styles.planButtonMark}>+</Text>
          <Text style={styles.planButtonText}>Plan a trip</Text>
          <Text style={styles.planButtonArrow}>→</Text>
        </Pressable>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>On your horizon</Text>
          <Text style={styles.tripCount}>{trips.length.toString().padStart(2, '0')}</Text>
        </View>

        {trips.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Your map is wide open.</Text>
            <Text style={styles.emptyCopy}>Start with a place you can’t stop thinking about.</Text>
          </View>
        ) : (
          trips.map((trip, index) => (
            <View key={trip.id} style={styles.tripCard}>
              <View style={styles.tripCardTop}>
                <Text style={styles.tripLabel}>{index === 0 ? 'NEXT ADVENTURE' : 'ON THE LIST'}</Text>
                <Text style={styles.tripNumber}>{String(index + 1).padStart(2, '0')}</Text>
              </View>
              <Text style={styles.destination}>{trip.destination}</Text>
              <Text style={styles.tripDate}>{trip.dateLabel}</Text>
              <View style={styles.tripDivider} />
              <View style={styles.tripFooter}>
                <Text style={styles.tripFooterText}>Your itinerary starts here</Text>
                <Text style={styles.tripFooterArrow}>↗</Text>
              </View>
            </View>
          ))
        )}

        <View style={styles.footerNote}>
          <Text style={styles.footerRule} />
          <Text style={styles.footerText}>GO LIGHT. COME BACK FULL.</Text>
        </View>
      </ScrollView>

      <Modal
        animationType="fade"
        onRequestClose={() => setIsPlannerOpen(false)}
        transparent
        visible={isPlannerOpen}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard}>
            <Text style={styles.eyebrow}>START WITH A PLACE</Text>
            <Text style={styles.modalTitle}>Where to?</Text>
            <TextInput
              autoFocus
              onChangeText={setDestination}
              onSubmitEditing={addTrip}
              placeholder="City or destination"
              placeholderTextColor="#85877F"
              returnKeyType="done"
              style={styles.destinationInput}
              value={destination}
            />
            <View style={styles.modalActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsPlannerOpen(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={!destination.trim()}
                onPress={addTrip}
                style={({ pressed }) => [
                  styles.createButton,
                  !destination.trim() && styles.createButtonDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.createButtonText}>Create trip</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F2EC',
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 36,
  },
  topBar: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  brandMark: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D8E0C5',
  },
  brandMarkText: {
    color: '#263A2D',
    fontSize: 17,
    fontWeight: '700',
  },
  brandName: {
    color: '#202720',
    fontSize: 19,
    fontWeight: '700',
  },
  apiBadge: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    borderRadius: 15,
    backgroundColor: '#E8E8E0',
  },
  apiDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B6843C',
  },
  apiDotOnline: {
    backgroundColor: '#3C7653',
  },
  apiDotOffline: {
    backgroundColor: '#B8513D',
  },
  apiText: {
    color: '#5F665D',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  intro: {
    marginTop: 48,
    marginBottom: 24,
  },
  eyebrow: {
    color: '#71806C',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  headline: {
    maxWidth: 370,
    marginTop: 14,
    color: '#202720',
    fontSize: 38,
    fontWeight: '600',
    lineHeight: 43,
  },
  subheading: {
    maxWidth: 330,
    marginTop: 12,
    color: '#6F746B',
    fontSize: 15,
    lineHeight: 22,
  },
  planButton: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 17,
    borderRadius: 8,
    backgroundColor: '#263A2D',
  },
  planButtonMark: {
    marginRight: 12,
    color: '#E8B282',
    fontSize: 24,
    lineHeight: 26,
  },
  planButtonText: {
    flex: 1,
    color: '#F8F7F1',
    fontSize: 15,
    fontWeight: '600',
  },
  planButtonArrow: {
    color: '#F8F7F1',
    fontSize: 20,
  },
  pressed: {
    opacity: 0.82,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 38,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#202720',
    fontSize: 19,
    fontWeight: '600',
  },
  tripCount: {
    color: '#85877F',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tripCard: {
    minHeight: 206,
    padding: 20,
    borderRadius: 8,
    backgroundColor: '#DCE4D0',
  },
  tripCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  tripLabel: {
    color: '#596C55',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  tripNumber: {
    color: '#70806C',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  destination: {
    marginTop: 22,
    color: '#263A2D',
    fontSize: 32,
    fontWeight: '600',
  },
  tripDate: {
    marginTop: 5,
    color: '#596C55',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  tripDivider: {
    height: 1,
    marginTop: 20,
    backgroundColor: '#C3D0B6',
  },
  tripFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 13,
  },
  tripFooterText: {
    color: '#596C55',
    fontSize: 12,
  },
  tripFooterArrow: {
    color: '#263A2D',
    fontSize: 18,
  },
  emptyState: {
    paddingVertical: 28,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#E8E7DE',
  },
  emptyTitle: {
    color: '#263A2D',
    fontSize: 18,
    fontWeight: '600',
  },
  emptyCopy: {
    marginTop: 7,
    color: '#6F746B',
    fontSize: 14,
    lineHeight: 20,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 30,
  },
  footerRule: {
    width: 22,
    height: 1,
    backgroundColor: '#DB9270',
  },
  footerText: {
    color: '#85877F',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(20, 30, 23, 0.48)',
  },
  modalCard: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    padding: 24,
    borderRadius: 8,
    backgroundColor: '#F8F7F1',
  },
  modalTitle: {
    marginTop: 12,
    color: '#202720',
    fontSize: 30,
    fontWeight: '600',
  },
  destinationInput: {
    minHeight: 52,
    marginTop: 20,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CFD1C6',
    borderRadius: 6,
    color: '#202720',
    fontSize: 15,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  cancelButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cancelText: {
    color: '#62685F',
    fontSize: 14,
    fontWeight: '600',
  },
  createButton: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: 6,
    backgroundColor: '#263A2D',
  },
  createButtonDisabled: {
    opacity: 0.45,
  },
  createButtonText: {
    color: '#F8F7F1',
    fontSize: 14,
    fontWeight: '600',
  },
});

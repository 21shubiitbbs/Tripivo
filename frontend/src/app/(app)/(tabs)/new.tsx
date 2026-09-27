import { Redirect } from 'expo-router';

// Placeholder for the tab bar's "+" button, which opens /create directly. Reached only via a
// deep link to /new.
export default function NewTripTab() {
  return <Redirect href="/create" />;
}

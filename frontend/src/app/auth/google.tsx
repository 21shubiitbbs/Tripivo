import { Redirect } from 'expo-router';

// Return URL of the browser-based Google sign-in (src/lib/googleBrowserSignIn.ts). The auth
// session reads the token from the URL itself; if the link also reaches the router, go home.
export default function GoogleAuthReturn() {
  return <Redirect href="/" />;
}

import { Redirect } from 'expo-router';

/** Overview is the start page now ("/"); keeps links to /overview working. */
export default function OverviewRedirect() {
  return <Redirect href="/" />;
}

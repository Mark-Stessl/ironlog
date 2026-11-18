import { Redirect } from 'expo-router';

/** The History tab became Overview; old links and home-screen bookmarks still work. */
export default function HistoryRedirect() {
  return <Redirect href="/overview" />;
}

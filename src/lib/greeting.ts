// Friendly greetings for the Workout and Overview tabs.

export function greeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return 'Late session?';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function motivation(workoutsThisWeek: number): string {
  if (workoutsThisWeek === 0) return 'Ready when you are.';
  if (workoutsThisWeek === 1) return 'One workout this week. Keep it rolling.';
  if (workoutsThisWeek < 4) return `${workoutsThisWeek} workouts this week. Nice momentum.`;
  return `${workoutsThisWeek} workouts this week. You're on fire.`;
}

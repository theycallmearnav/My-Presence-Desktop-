// ============================================================================
//  DISCORD APPLICATION ID  —  set this ONCE, then every user gets it for free.
// ============================================================================
//
//  Your end-users never touch this. You (the distributor) create ONE Discord
//  application a single time and paste its ID below. After that, anyone who
//  downloads the app just works — no setup, no application ID on their side.
//
//  HOW TO GET IT (2 minutes, one time):
//    1. Go to https://discord.com/developers/applications
//    2. Click "New Application". The NAME you choose is what everyone will see
//       as "Playing <name>" on their profile — so name it whatever you want
//       displayed (e.g. "My Presence").
//    3. On "General Information", copy the "Application ID" (a long number).
//    4. Paste it between the quotes below and rebuild the app.
//
//  You can also override it at build time with the VITE_DISCORD_APP_ID env var.
// ============================================================================

export const BUNDLED_APPLICATION_ID: string =
  (import.meta.env.VITE_DISCORD_APP_ID as string | undefined)?.trim() ||
  '1525516685963165747';

/** True when a real ID has been configured (not the placeholder). */
export function hasBundledApplicationId(): boolean {
  return /^\d{8,20}$/.test(BUNDLED_APPLICATION_ID);
}

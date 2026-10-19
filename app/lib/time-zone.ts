/**
 * The timezone the business operates in.
 *
 * Every "today" and every calendar-day boundary in this app is this zone's, not the
 * browser's and not UTC. The API is configured the same way (`APP_TIMEZONE`,
 * defaulting to `Asia/Kolkata`), and the two must agree: at UTC+5:30 a UTC-derived
 * "today" is the previous date for the first five and a half hours of every working
 * day, so a client and a server disagreeing about it means a date the user picked
 * being refused as being in the future.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Kolkata';

import { pgPool } from './pgPool.js';

/**
 * Destroys every login session belonging to a user (FR1.4: a password reset
 * must invalidate existing sessions). Sessions are stored by connect-pg-simple
 * in the "session" table; the user id lives inside the JSON payload.
 */
export async function invalidateUserSessions(userId: number): Promise<void> {
  await pgPool.query(`DELETE FROM "session" WHERE (sess->>'userId')::int = $1`, [userId]);
}

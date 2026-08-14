import { describe, expect, it } from 'vitest';
import { config } from './middleware';

/**
 * The middleware no longer decides what is protected — it establishes identity
 * and nothing else, so the class of bug these tests used to guard against is
 * gone structurally rather than by assertion.
 *
 * That bug was real twice over. `/api/jobs/run` was once caught by the matcher,
 * so every scheduled run redirected to sign-in and the jobs stopped, silently.
 * And the Clerk matcher that briefly replaced it treated `/sign-info` as public,
 * because `'/sign-in(.*)'` consumes any suffix rather than a path segment.
 *
 * What still matters is the matcher that decides where middleware RUNS: too
 * broad and every static asset pays for a Clerk handshake.
 */
describe('middleware matcher', () => {
  // Next anchors matcher patterns against the whole path. Testing unanchored
  // would let the regex match at a later offset and report a skipped asset as
  // matched — which is exactly what the first version of this test did.
  const matches = (path: string) => new RegExp(`^${config.matcher[0]}$`).test(path);

  it('is a single pattern', () => {
    expect(config.matcher).toHaveLength(1);
  });

  it.each([
    ['_next/static', '/_next/static/chunks/main.js'],
    ['_next/image', '/_next/image'],
    ['favicon', '/favicon.ico'],
    ['an svg', '/logo.svg'],
    ['a png', '/photos/member.png'],
  ])('skips %s', (_label, path) => {
    expect(matches(path)).toBe(false);
  });

  it.each(['/', '/members', '/api/jobs/run', '/sign-in'])('runs on %s', (path) => {
    expect(matches(path)).toBe(true);
  });
});

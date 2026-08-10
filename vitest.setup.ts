// Node caches the process timezone on first use, so pin it before any test
// module touches a Date. See the comment in vitest.config.ts for why this is
// deliberately not the gym's timezone.
process.env.TZ = 'America/New_York';

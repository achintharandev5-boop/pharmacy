// This launcher cannot silently start an unrestricted service if the profile is omitted.
try {
  require('./require-profile.cjs')(process.env);
  require('../../apps/api/dist/main.js');
} catch {
  console.error('Staging API startup refused. Check staging configuration and build output.');
  process.exitCode = 1;
}

module.exports = function requireStagingProfile(env, frontend = false) {
  if (env.DEPLOYMENT_PROFILE !== 'synthetic-staging' ||
      (frontend && env.NEXT_PUBLIC_DEPLOYMENT_PROFILE !== 'synthetic-staging')) {
    throw new Error('Staging launcher requires explicit synthetic-staging profile markers.');
  }
};

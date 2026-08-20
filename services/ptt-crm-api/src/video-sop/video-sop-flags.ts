export function assertCinematicEnabled(config: { contentMarketingVideoCinematicEnabled: boolean }): void {
  if (!config.contentMarketingVideoCinematicEnabled) {
    throw new Error('cmkt_cinematic_disabled');
  }
}

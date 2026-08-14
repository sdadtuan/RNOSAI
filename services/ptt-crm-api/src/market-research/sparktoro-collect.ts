/** Mockable SparkToro fetch. Tests replace this. Missing flag/key is handled by the service. */

export async function collectSparkToro(_input: {
  query: string;
  apiKey: string;
}): Promise<{ results: Array<{ url: string; title: string; snippet: string }> }> {
  return { results: [] };
}

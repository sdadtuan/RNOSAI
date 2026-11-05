export type ForecastInput = {
  scheduled_batch_credits: number | null;
  historical_avg: number | null;
  reserved: number | null;
};

export const FORECAST_ASSUMPTION =
  'Forecast = scheduled_batch_credits + historical_avg + reserved. Không gồm ads spend.';

export function forecastCredits(input: ForecastInput): {
  forecast: number | null;
  assumption: string;
} {
  const parts = [input.scheduled_batch_credits, input.historical_avg, input.reserved];
  if (parts.every((value) => value == null)) {
    return { forecast: null, assumption: FORECAST_ASSUMPTION };
  }
  return {
    forecast: parts.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    assumption: FORECAST_ASSUMPTION,
  };
}

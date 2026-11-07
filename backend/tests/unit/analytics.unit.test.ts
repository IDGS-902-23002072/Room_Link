import { beforeEach, describe, expect, it } from "vitest";
import {
  DailyMetrics,
  toUtcMidnight,
  type IAnalyticsRepository,
  type IAnalyticsSource,
} from "../../src/domain/index.js";
import { AnalyticsService } from "../../src/modules/analytics/index.js";

class InMemoryAnalyticsRepository implements IAnalyticsRepository {
  readonly items = new Map<string, DailyMetrics>();
  async upsertDaily(metrics: DailyMetrics) {
    const key = metrics.metricDate.toISOString().slice(0, 10);
    this.items.set(key, metrics);
    return metrics;
  }
  async findByDate(metricDate: Date) {
    return this.items.get(metricDate.toISOString().slice(0, 10)) ?? null;
  }
  async listRange(from: Date, to: Date) {
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);
    return Array.from(this.items.entries())
      .filter(([key]) => key >= fromKey && key <= toKey)
      .map(([, m]) => m);
  }
}

function stubSource(values: Partial<Record<keyof IAnalyticsSource, any>> = {}): IAnalyticsSource {
  const d = (n: number) => async () => n;
  return {
    countUsersRegisteredOn: values.countUsersRegisteredOn ?? d(10),
    countActiveListingsAt: values.countActiveListingsAt ?? d(5),
    countConnectionsSentOn: values.countConnectionsSentOn ?? d(7),
    countConnectionsAcceptedOn: values.countConnectionsAcceptedOn ?? d(3),
    countListingsClosedOn: values.countListingsClosedOn ?? d(1),
    avgDaysToCloseOn: values.avgDaysToCloseOn ?? (async () => 12.5),
    avgAffinityScoreOn: values.avgAffinityScoreOn ?? (async () => 78.2),
  };
}

describe("AnalyticsService.recomputeDaily", () => {
  let repo: InMemoryAnalyticsRepository;
  const today = new Date("2026-11-07T12:34:56Z");
  const now = () => today;

  beforeEach(() => {
    repo = new InMemoryAnalyticsRepository();
  });

  it("aggregates all counters and upserts by day", async () => {
    const service = new AnalyticsService(repo, stubSource(), now);
    const result = await service.recomputeDaily(new Date("2026-11-06T09:00:00Z"));

    expect(result.usersRegistered).toBe(10);
    expect(result.activeListings).toBe(5);
    expect(result.connectionsSent).toBe(7);
    expect(result.connectionsAccepted).toBe(3);
    expect(result.listingsClosed).toBe(1);
    expect(result.avgDaysToClose).toBe(12.5);
    expect(result.avgAffinityScore).toBe(78.2);
    expect(result.metricDate.toISOString()).toBe("2026-11-06T00:00:00.000Z");
    expect(repo.items.size).toBe(1);
  });

  it("is idempotent for the same day", async () => {
    const service = new AnalyticsService(repo, stubSource(), now);
    await service.recomputeDaily(new Date("2026-11-06T09:00:00Z"));
    await service.recomputeDaily(new Date("2026-11-06T22:00:00Z"));
    expect(repo.items.size).toBe(1);
  });

  it("rejects future dates and invalid dates", async () => {
    const service = new AnalyticsService(repo, stubSource(), now);
    await expect(
      service.recomputeDaily(new Date("2027-01-01T00:00:00Z")),
    ).rejects.toMatchObject({ code: "METRIC_DATE_IN_FUTURE" });

    await expect(service.recomputeDaily(new Date("not a date"))).rejects.toMatchObject({
      code: "INVALID_METRIC_DATE",
    });
  });

  it("propagates null averages when there is no data", async () => {
    const service = new AnalyticsService(
      repo,
      stubSource({
        avgDaysToCloseOn: async () => null,
        avgAffinityScoreOn: async () => null,
      }),
      now,
    );
    const result = await service.recomputeDaily(new Date("2026-11-06T00:00:00Z"));
    expect(result.avgDaysToClose).toBeNull();
    expect(result.avgAffinityScore).toBeNull();
  });

  it("entity rejects negative counters", () => {
    expect(
      () =>
        new DailyMetrics({
          metricDate: toUtcMidnight(new Date()),
          usersRegistered: -1,
          activeListings: 0,
          connectionsSent: 0,
          connectionsAccepted: 0,
          listingsClosed: 0,
          avgDaysToClose: null,
          avgAffinityScore: null,
          createdAt: new Date(),
        }),
    ).toThrow();
  });
});

describe("AnalyticsService.getRange", () => {
  it("rejects inverted range", async () => {
    const repo = new InMemoryAnalyticsRepository();
    const service = new AnalyticsService(repo, stubSource());
    await expect(
      service.getRange(new Date("2026-11-10T00:00:00Z"), new Date("2026-11-01T00:00:00Z")),
    ).rejects.toMatchObject({ code: "INVALID_RANGE_ORDER" });
  });

  it("returns stored metrics in the range", async () => {
    const repo = new InMemoryAnalyticsRepository();
    const service = new AnalyticsService(repo, stubSource(), () => new Date("2026-11-10T12:00:00Z"));
    await service.recomputeDaily(new Date("2026-11-05T00:00:00Z"));
    await service.recomputeDaily(new Date("2026-11-07T00:00:00Z"));
    await service.recomputeDaily(new Date("2026-11-08T00:00:00Z"));

    const range = await service.getRange(
      new Date("2026-11-06T00:00:00Z"),
      new Date("2026-11-08T00:00:00Z"),
    );
    expect(range.length).toBe(2);
    expect(
      range.map((m) => m.metricDate.toISOString().slice(0, 10)).sort(),
    ).toEqual(["2026-11-07", "2026-11-08"]);
  });
});

import type {
  CompatibilityFeedCandidate,
  ConnectionRequest,
} from "../../domain/repositories/ICompatibilityRepository.js";
import type {
  AffinityFeedResult,
  CompatibilityTestResult,
} from "./compatibility.service.js";

export class CompatibilityView {
  static toTest(result: CompatibilityTestResult) {
    return result;
  }

  static toFeed(result: AffinityFeedResult) {
    return {
      ...result,
      profiles: result.profiles.map((profile) => this.toCandidate(profile)),
    };
  }

  static toCandidate(candidate: CompatibilityFeedCandidate) {
    return candidate;
  }

  static toConnection(request: ConnectionRequest) {
    return {
      id: request.id,
      requesterId: request.requesterId,
      addresseeId: request.addresseeId,
      status: request.status,
      createdAt: request.createdAt.toISOString(),
    };
  }
}

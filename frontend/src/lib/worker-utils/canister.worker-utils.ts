import type { CanisterId } from "$lib/types/canister";
import type { CanisterActorParams } from "$lib/types/worker";
/**
 * HTTP-Agent explicit CJS import for compatibility with web worker - avoid Error [RollupError]: Unexpected token (Note that you need plugins to import files that are not JavaScript)
 */
import { HttpAgent, getManagementCanister } from "@dfinity/agent/lib/cjs/index";

export {
  HttpAgent as HttpAgentWorker,
  getManagementCanister as getManagementCanisterWorker,
};

export interface CreateCanisterWorkerParams {
  canisterId: CanisterId;
  agent: HttpAgent;
}

export const createCanisterWorker = async <T>({
  identity,
  canisterId,
  create,
  host,
  fetchRootKey,
}: {
  create: (params: CreateCanisterWorkerParams) => T;
} & CanisterActorParams & { canisterId: CanisterId }): Promise<T> => {
  const agent = new HttpAgent({
    identity,
    host,
  });

  if (fetchRootKey) {
    await agent.fetchRootKey();
  }

  return create({ agent, canisterId });
};
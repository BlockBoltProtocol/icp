import type { NeuronInfo } from "@dfinity/nns";
import { ICP, LedgerCanister, Topic } from "@dfinity/nns";
import { mock } from "jest-mock-extended";
import { tick } from "svelte/internal";
import { get } from "svelte/store";
import * as api from "../../../lib/api/governance.api";
import * as ledgerApi from "../../../lib/api/ledger.api";
import { E8S_PER_ICP } from "../../../lib/constants/icp.constants";
import * as services from "../../../lib/services/neurons.services";
import { neuronsStore } from "../../../lib/stores/neurons.store";
import { toastsStore } from "../../../lib/stores/toasts.store";
import {
  mockIdentity,
  mockIdentityErrorMsg,
  resetIdentity,
  setNoIdentity,
} from "../../mocks/auth.store.mock";
import { mockFullNeuron, mockNeuron } from "../../mocks/neurons.mock";

const {
  addFollowee,
  getNeuronId,
  joinCommunityFund,
  listNeurons,
  loadNeuron,
  removeFollowee,
  stakeAndLoadNeuron,
  startDissolving,
  stopDissolving,
  updateDelay,
} = services;

jest.mock("../../../lib/stores/toasts.store", () => {
  return {
    toastsStore: {
      error: jest.fn(),
      show: jest.fn(),
    },
  };
});

describe("neurons-services", () => {
  const notControlledNeuron = {
    ...mockNeuron,
    neuronId: BigInt(123),
    fullNeuron: {
      ...mockFullNeuron,
      controller: "not-controller",
    },
  };
  const controlledNeuron = {
    ...mockNeuron,
    neuronId: BigInt(1234),
    fullNeuron: {
      ...mockFullNeuron,
      controller: mockIdentity.getPrincipal().toText(),
    },
  };

  const spyStakeNeuron = jest
    .spyOn(api, "stakeNeuron")
    .mockImplementation(() => Promise.resolve(mockNeuron.neuronId));

  const spyGetNeuron = jest
    .spyOn(api, "queryNeuron")
    .mockImplementation(() => Promise.resolve(mockNeuron));

  const neurons = [mockNeuron, controlledNeuron];

  const spyQueryNeurons = jest
    .spyOn(api, "queryNeurons")
    .mockImplementation(() => Promise.resolve(neurons));

  const spyIncreaseDissolveDelay = jest
    .spyOn(api, "increaseDissolveDelay")
    .mockImplementation(() => Promise.resolve());

  const spyJoinCommunityFund = jest
    .spyOn(api, "joinCommunityFund")
    .mockImplementation(() => Promise.resolve());

  const spySplitNeuron = jest
    .spyOn(api, "splitNeuron")
    .mockImplementation(() => Promise.resolve(BigInt(11)));

  const spyStartDissolving = jest
    .spyOn(api, "startDissolving")
    .mockImplementation(() => Promise.resolve());

  const spyStopDissolving = jest
    .spyOn(api, "stopDissolving")
    .mockImplementation(() => Promise.resolve());

  const spySetFollowees = jest
    .spyOn(api, "setFollowees")
    .mockImplementation(() => Promise.resolve());

  const spyClaimOrRefresh = jest
    .spyOn(api, "claimOrRefreshNeuron")
    .mockImplementation(() => Promise.resolve(undefined));

  const spyGetNeuronBalance = jest
    .spyOn(ledgerApi, "getNeuronBalance")
    .mockImplementation(() => Promise.resolve(ICP.fromString("1") as ICP));

  afterEach(() => {
    spyGetNeuron.mockClear();
  });

  describe("stake new neuron", () => {
    it("should stake and load a neuron", async () => {
      await stakeAndLoadNeuron({ amount: 10 });

      expect(spyStakeNeuron).toHaveBeenCalled();

      const neuron = get(neuronsStore)[0];
      expect(neuron).toEqual(mockNeuron);
    });

    it(`stakeNeuron return undefined if amount less than ${
      E8S_PER_ICP / E8S_PER_ICP
    } ICP`, async () => {
      jest
        .spyOn(LedgerCanister, "create")
        .mockImplementation(() => mock<LedgerCanister>());

      const response = await stakeAndLoadNeuron({
        amount: 0.1,
      });

      expect(response).toBeUndefined();
      expect(toastsStore.error).toBeCalled();
    });

    it("stake neuron should return undefined if amount not valid", async () => {
      jest
        .spyOn(LedgerCanister, "create")
        .mockImplementation(() => mock<LedgerCanister>());

      const response = await stakeAndLoadNeuron({
        amount: NaN,
      });

      expect(response).toBeUndefined();
      expect(toastsStore.error).toBeCalled();
    });

    it("should not stake neuron if no identity", async () => {
      setNoIdentity();

      const response = await stakeAndLoadNeuron({
        amount: 10,
      });

      expect(response).toBeUndefined();
      expect(toastsStore.error).toBeCalled();

      resetIdentity();
    });
  });

  describe("list neurons", () => {
    afterEach(() => {
      jest.clearAllMocks();
    });
    it("should list neurons", async () => {
      await listNeurons();

      expect(spyQueryNeurons).toHaveBeenCalled();

      const neuronsList = get(neuronsStore);
      expect(neuronsList).toEqual(neurons);
    });

    it("should check neurons balances", async () => {
      await listNeurons();
      // `await` does not wait for `onLoad` to finish
      await tick();

      expect(spyGetNeuronBalance).toBeCalledTimes(neurons.length);
    });

    it("should claim or refresh neurons whose balance does not match stake", async () => {
      const balance = ICP.fromString("2") as ICP;
      const neuronMatchingStake = {
        ...mockNeuron,
        fullNeuron: {
          ...mockFullNeuron,
          cachedNeuronStake: balance.toE8s(),
        },
      };
      const neuronNotMatchingStake = {
        ...mockNeuron,
        fullNeuron: {
          ...mockFullNeuron,
          cachedNeuronStake: BigInt(3_000_000_000),
        },
      };
      spyGetNeuronBalance.mockImplementation(() => Promise.resolve(balance));
      spyQueryNeurons.mockImplementation(() =>
        Promise.resolve([neuronNotMatchingStake, neuronMatchingStake])
      );
      await listNeurons();
      // `await` does not wait for `onLoad` to finish
      await tick();

      expect(spyClaimOrRefresh).toBeCalledTimes(1);
    });

    it("should not claim or refresh neurons whose balance does not match stake but ICP is less than one", async () => {
      const balance = ICP.fromString("0.9") as ICP;
      const neuronMatchingStake = {
        ...mockNeuron,
        fullNeuron: {
          ...mockFullNeuron,
          cachedNeuronStake: balance.toE8s(),
        },
      };
      const neuronNotMatchingStake = {
        ...mockNeuron,
        fullNeuron: {
          ...mockFullNeuron,
          cachedNeuronStake: BigInt(3_000_000_000),
        },
      };
      spyGetNeuronBalance.mockImplementation(() => Promise.resolve(balance));
      spyQueryNeurons.mockImplementation(() =>
        Promise.resolve([neuronNotMatchingStake, neuronMatchingStake])
      );
      await listNeurons();
      // `await` does not wait for `onLoad` to finish
      await tick();

      expect(spyClaimOrRefresh).not.toBeCalled();
    });

    it("should not list neurons if no identity", async () => {
      setNoIdentity();

      const call = async () => await listNeurons();

      await expect(call).rejects.toThrow(mockIdentityErrorMsg);

      resetIdentity();
    });
  });

  describe("update delay", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should update delay", async () => {
      neuronsStore.pushNeurons(neurons);
      await updateDelay({
        neuronId: controlledNeuron.neuronId,
        dissolveDelayInSeconds: 12000,
      });

      expect(spyIncreaseDissolveDelay).toHaveBeenCalled();
    });

    it("should not update delay if no identity", async () => {
      setNoIdentity();

      await updateDelay({
        neuronId: BigInt(10),
        dissolveDelayInSeconds: 12000,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyIncreaseDissolveDelay).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not update delay if neuron not controlled by user", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);

      await updateDelay({
        neuronId: notControlledNeuron.neuronId,
        dissolveDelayInSeconds: 12000,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyIncreaseDissolveDelay).not.toHaveBeenCalled();

      neuronsStore.setNeurons([]);
    });
  });

  describe("joinCommunityFund", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should update neuron", async () => {
      neuronsStore.pushNeurons(neurons);
      await joinCommunityFund(controlledNeuron.neuronId);

      expect(spyJoinCommunityFund).toHaveBeenCalled();
    });

    it("should not update neuron if no identity", async () => {
      setNoIdentity();

      await joinCommunityFund(BigInt(10));

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyJoinCommunityFund).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not update neuron if not controlled by user", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);

      await joinCommunityFund(notControlledNeuron.neuronId);

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyJoinCommunityFund).not.toHaveBeenCalled();
    });
  });

  describe("startDissolving", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should update neuron", async () => {
      neuronsStore.pushNeurons(neurons);
      await startDissolving(controlledNeuron.neuronId);

      expect(spyStartDissolving).toHaveBeenCalled();
    });

    it("should not update neuron if no identity", async () => {
      setNoIdentity();

      await startDissolving(BigInt(10));

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyStartDissolving).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not update neuron if not controlled by user", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);

      await startDissolving(notControlledNeuron.neuronId);

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyStartDissolving).not.toHaveBeenCalled();
    });
  });

  describe("stopDissolving", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should update neuron", async () => {
      neuronsStore.pushNeurons(neurons);
      await stopDissolving(controlledNeuron.neuronId);

      expect(spyStopDissolving).toHaveBeenCalled();
    });

    it("should not update neuron if no identity", async () => {
      setNoIdentity();

      await stopDissolving(BigInt(10));

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyStopDissolving).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not update neuron if not controlled by user", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);

      await stopDissolving(notControlledNeuron.neuronId);

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spyStopDissolving).not.toHaveBeenCalled();
    });
  });

  describe("splitNeuron", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should update neuron", async () => {
      neuronsStore.pushNeurons(neurons);
      await services.splitNeuron({
        neuronId: controlledNeuron.neuronId,
        amount: 2.2,
      });

      expect(spySplitNeuron).toHaveBeenCalled();
    });

    it("should not update neuron if no identity", async () => {
      neuronsStore.pushNeurons(neurons);
      setNoIdentity();

      await services.splitNeuron({
        neuronId: controlledNeuron.neuronId,
        amount: 2.2,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySplitNeuron).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not update neuron if not controlled by user", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);

      await services.splitNeuron({
        neuronId: notControlledNeuron.neuronId,
        amount: 2.2,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySplitNeuron).not.toHaveBeenCalled();

      neuronsStore.setNeurons([]);
    });
  });

  describe("add followee", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should add the followee to next call", async () => {
      const followee = BigInt(8);
      neuronsStore.setNeurons(neurons);
      const topic = Topic.ExchangeRate;
      await addFollowee({
        neuronId: controlledNeuron.neuronId,
        topic,
        followee,
      });

      const expectedArgument = {
        neuronId: controlledNeuron.neuronId,
        identity: mockIdentity,
        topic,
        followees: [followee],
      };
      expect(spySetFollowees).toHaveBeenCalledWith(expectedArgument);
    });

    it("should not call api if no identity", async () => {
      const followee = BigInt(8);
      neuronsStore.setNeurons(neurons);
      const topic = Topic.ExchangeRate;

      setNoIdentity();

      await addFollowee({
        neuronId: controlledNeuron.neuronId,
        topic,
        followee,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySetFollowees).not.toHaveBeenCalled();
      resetIdentity();
    });

    it("should not call api if not controlled by user nor hotkey", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);
      const followee = BigInt(8);
      const topic = Topic.ExchangeRate;

      await addFollowee({
        neuronId: notControlledNeuron.neuronId,
        topic,
        followee,
      });

      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySetFollowees).not.toHaveBeenCalled();
    });
  });

  describe("remove followee", () => {
    afterEach(() => {
      jest.clearAllMocks();
      neuronsStore.setNeurons([]);
    });
    it("should remove the followee to next call", async () => {
      const followee = BigInt(8);
      const topic = Topic.ExchangeRate;
      const neuronFollowing = {
        ...controlledNeuron,
        fullNeuron: {
          ...controlledNeuron.fullNeuron,
          followees: [{ topic, followees: [followee] }],
        },
      };
      neuronsStore.setNeurons([neuronFollowing]);
      await removeFollowee({
        neuronId: neuronFollowing.neuronId,
        topic,
        followee,
      });

      const expectedArgument = {
        neuronId: neuronFollowing.neuronId,
        identity: mockIdentity,
        topic,
        followees: [],
      };
      expect(spySetFollowees).toHaveBeenCalledWith(expectedArgument);
    });

    it("should not call api if no identity", async () => {
      const followee = BigInt(8);
      neuronsStore.setNeurons(neurons);
      const topic = Topic.ExchangeRate;

      setNoIdentity();

      await removeFollowee({
        neuronId: controlledNeuron.neuronId,
        topic,
        followee,
      });
      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySetFollowees).not.toHaveBeenCalled();

      resetIdentity();
    });

    it("should not call api if user not controller nor hotkey", async () => {
      neuronsStore.pushNeurons([notControlledNeuron]);
      const followee = BigInt(8);
      const topic = Topic.ExchangeRate;

      await removeFollowee({
        neuronId: notControlledNeuron.neuronId,
        topic,
        followee,
      });
      expect(toastsStore.error).toHaveBeenCalled();
      expect(spySetFollowees).not.toHaveBeenCalled();
    });
  });

  describe("details", () => {
    beforeAll(() => {
      // Avoid to print errors during test
      jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterAll(() => jest.clearAllMocks());
    it("should get neuronId from valid path", async () => {
      expect(getNeuronId("/#/neuron/123")).toBe(BigInt(123));
      expect(getNeuronId("/#/neuron/0")).toBe(BigInt(0));
    });

    it("should not get neuronId from invalid path", async () => {
      expect(getNeuronId("/#/neuron/")).toBeUndefined();
      expect(getNeuronId("/#/neuron/1.5")).toBeUndefined();
      expect(getNeuronId("/#/neuron/123n")).toBeUndefined();
    });
  });

  describe("load neuron", () => {
    it("should get neuron from neurons store if presented and not call queryNeuron", async () => {
      neuronsStore.pushNeurons([mockNeuron]);
      await loadNeuron({
        neuronId: mockNeuron.neuronId,
        setNeuron: (neuron: NeuronInfo) => {
          neuronsStore.setNeurons([]);
          expect(neuron?.neuronId).toBe(mockNeuron.neuronId);
        },
      });
      await tick();
      expect(spyGetNeuron).not.toBeCalled();
    });

    it("should call the api to get neuron if not in store", async () => {
      await loadNeuron({
        neuronId: mockNeuron.neuronId,
        setNeuron: jest.fn,
      });
      expect(spyGetNeuron).toBeCalled();
    });
  });
});

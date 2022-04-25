import { ICP } from "@dfinity/nns";
import { get } from "svelte/store";
import * as accountsApi from "../../../lib/api/accounts.api";
import * as ledgerApi from "../../../lib/api/ledger.api";
import {
  addSubAccount,
  getAccountFromStore,
  routePathAccountIdentifier,
  syncAccounts,
  transferICP,
} from "../../../lib/services/accounts.services";
import { accountsStore } from "../../../lib/stores/accounts.store";
import { toastsStore } from "../../../lib/stores/toasts.store";
import type { TransactionStore } from "../../../lib/stores/transaction.store";
import {
  mockMainAccount,
  mockSubAccount,
} from "../../mocks/accounts.store.mock";
import {
  mockIdentityErrorMsg,
  resetIdentity,
  setNoIdentity,
} from "../../mocks/auth.store.mock";
import en from "../../mocks/i18n.mock";

describe("accounts-services", () => {
  describe("services", () => {
    const mockAccounts = { main: mockMainAccount, subAccounts: [] };

    const spyLoadAccounts = jest
      .spyOn(accountsApi, "loadAccounts")
      .mockImplementation(() => Promise.resolve(mockAccounts));

    const spyCreateSubAccount = jest
      .spyOn(accountsApi, "createSubAccount")
      .mockImplementation(() => Promise.resolve());

    const spySendICP = jest
      .spyOn(ledgerApi, "sendICP")
      .mockImplementation(() => Promise.resolve(BigInt(0)));

    beforeAll(() => jest.spyOn(console, "error").mockImplementation(jest.fn));

    afterAll(() => jest.clearAllMocks());

    it("should sync accounts", async () => {
      await syncAccounts();

      expect(spyLoadAccounts).toHaveBeenCalled();

      const accounts = get(accountsStore);
      expect(accounts).toEqual(mockAccounts);
    });

    it("should add a subaccount", async () => {
      await addSubAccount({ name: "test subaccount" });

      expect(spyCreateSubAccount).toHaveBeenCalled();
    });

    it("should not sync accounts if no identity", async () => {
      setNoIdentity();

      const call = async () => await syncAccounts();

      await expect(call).rejects.toThrow(Error(mockIdentityErrorMsg));

      resetIdentity();
    });

    it("should not add subaccount if no identity", async () => {
      const spyToastError = jest.spyOn(toastsStore, "error");

      setNoIdentity();

      await addSubAccount({ name: "test subaccount" });

      expect(spyToastError).toBeCalled();
      expect(spyToastError).toBeCalledWith({
        labelKey: "create_subaccount",
        err: new Error(en.error.missing_identity),
      });

      resetIdentity();
    });

    const transferICPParams: TransactionStore = {
      selectedAccount: mockMainAccount,
      destinationAddress: mockSubAccount.identifier,
      amount: ICP.fromE8s(BigInt(1)),
    };

    it("should transfer ICP", async () => {
      await transferICP(transferICPParams);

      expect(spySendICP).toHaveBeenCalled();
    });

    it("should sync accounts after transfer ICP", async () => {
      await transferICP(transferICPParams);

      expect(spyLoadAccounts).toHaveBeenCalled();
    });

    it("should throw errors if transfer params not provided", async () => {
      const { err: errSelectedAccount } = await transferICP({
        ...transferICPParams,
        selectedAccount: undefined,
      });

      expect(errSelectedAccount).toEqual("error.transaction_no_source_account");

      const { err: errDestinationAddress } = await transferICP({
        ...transferICPParams,
        destinationAddress: undefined,
      });

      expect(errDestinationAddress).toEqual(
        "error.transaction_no_destination_address"
      );

      const { err: errAmount } = await transferICP({
        ...transferICPParams,
        amount: undefined,
      });

      expect(errAmount).toEqual("error.transaction_invalid_amount");
    });
  });

  describe("details", () => {
    beforeAll(() => {
      // Avoid to print errors during test
      jest.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterAll(() => jest.clearAllMocks());

    it("should get account identifier from valid path", () => {
      expect(
        routePathAccountIdentifier(`/#/wallet/${mockMainAccount.identifier}`)
      ).toEqual(mockMainAccount.identifier);
    });

    it("should not get account identifier from invalid path", () => {
      expect(routePathAccountIdentifier("/#/wallet/")).toBeUndefined();
      expect(routePathAccountIdentifier(undefined)).toBeUndefined();
    });
  });

  describe("get-account", () => {
    beforeAll(() =>
      accountsStore.set({
        main: mockMainAccount,
        subAccounts: [mockSubAccount],
      })
    );

    afterAll(() => accountsStore.reset());

    it("should not return an account if no identifier is provided", () => {
      expect(getAccountFromStore(undefined)).toBeUndefined();
    });

    it("should find no account if not matches", () => {
      expect(getAccountFromStore("aaa")).toBeUndefined();
    });

    it("should return corresponding account", () => {
      expect(getAccountFromStore(mockMainAccount.identifier)).toEqual(
        mockMainAccount
      );
      expect(getAccountFromStore(mockSubAccount.identifier)).toEqual(
        mockSubAccount
      );
    });
  });
});

import { OWN_CANISTER_ID_TEXT } from "$lib/constants/canister-ids.constants";
import {
  authStore,
  type AuthStore,
  type AuthStoreData,
} from "$lib/stores/auth.store";
import type { IcrcTokenMetadata } from "$lib/types/icrc";
import {
  UserTokenAction,
  type UserToken,
  type UserTokenBase,
} from "$lib/types/tokens-page";
import { sumAccounts } from "$lib/utils/accounts.utils";
import { buildAccountsUrl, buildWalletUrl } from "$lib/utils/navigation.utils";
import { isUniverseNns } from "$lib/utils/universe.utils";
import { encodeIcrcAccount } from "@dfinity/ledger-icrc";
import { isNullish, TokenAmountV2 } from "@dfinity/utils";
import { derived, type Readable } from "svelte/store";
import type { UniversesAccounts } from "./accounts-list.derived";
import { tokensListBaseStore } from "./tokens-list-base.derived";
import { tokensByUniverseIdStore } from "./tokens.derived";
import { universesAccountsStore } from "./universes-accounts.derived";

const convertToUserTokenData = ({
  accounts,
  tokensByUniverse,
  baseTokenData,
  authData,
}: {
  accounts: UniversesAccounts;
  tokensByUniverse: Record<string, IcrcTokenMetadata>;
  baseTokenData: UserTokenBase;
  authData: AuthStoreData;
}): UserToken => {
  const token = tokensByUniverse[baseTokenData.universeId.toText()];
  const rowHref = isNullish(authData.identity)
    ? undefined
    : isUniverseNns(baseTokenData.universeId)
    ? buildAccountsUrl({ universe: baseTokenData.universeId.toText() })
    : buildWalletUrl({
        universe: baseTokenData.universeId.toText(),
        account: encodeIcrcAccount({
          owner: authData.identity.getPrincipal(),
        }),
      });
  const accountsList = accounts[baseTokenData.universeId.toText()];
  const mainAccount = accountsList?.find(({ type }) => type === "main");
  if (isNullish(token) || isNullish(accountsList) || isNullish(mainAccount)) {
    return {
      ...baseTokenData,
      balance: "loading",
      actions: [],
    };
  }
  const fee = TokenAmountV2.fromUlps({ amount: token.fee, token });
  // For ICP we show the sum of all ICP accounts.
  // For other tokens we show the main account balance because subaccounts are not yet supported.
  const balance = TokenAmountV2.fromUlps({
    amount: isUniverseNns(baseTokenData.universeId)
      ? sumAccounts(accountsList)
      : mainAccount.balanceUlps,
    token,
  });
  // For ICP, the row represents all the ICP accounts. Therefore, we don't want to set the accountIdentifier.
  const accountIdentifier = isUniverseNns(baseTokenData.universeId)
    ? undefined
    : mainAccount.identifier;
  return {
    ...baseTokenData,
    token,
    fee,
    balance,
    actions: [
      ...(baseTokenData.universeId.toText() === OWN_CANISTER_ID_TEXT
        ? [UserTokenAction.GoToDetail]
        : [UserTokenAction.Receive, UserTokenAction.Send]),
    ],
    accountIdentifier,
    rowHref,
  };
};

export const tokensListUserStore = derived<
  [
    Readable<UserTokenBase[]>,
    Readable<UniversesAccounts>,
    Readable<Record<string, IcrcTokenMetadata>>,
    AuthStore,
  ],
  UserToken[]
>(
  [
    tokensListBaseStore,
    universesAccountsStore,
    tokensByUniverseIdStore,
    authStore,
  ],
  ([tokensList, accounts, tokensByUniverse, authData]) =>
    tokensList.map((baseTokenData) =>
      convertToUserTokenData({
        baseTokenData,
        accounts,
        tokensByUniverse,
        authData,
      })
    )
);

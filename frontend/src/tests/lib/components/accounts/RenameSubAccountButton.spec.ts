/**
 * @jest-environment jsdom
 */

import RenameSubAccount from "$lib/components/accounts/RenameSubAccountButton.svelte";
import { walletModal } from "$lib/stores/modal.store";
import { fireEvent } from "@testing-library/dom";
import { render } from "@testing-library/svelte";
import { get } from "svelte/store";
import en from "../../../mocks/i18n.mock";

describe("RenameSubAccountButton", () => {
  it("should contain a closed modal per default", () => {
    const { getByText } = render(RenameSubAccount);
    expect(() => getByText(en.accounts.rename_linked_account)).toThrow();
  });

  it("should contain an action named rename", async () => {
    const { getByText } = render(RenameSubAccount);
    expect(getByText(en.accounts.rename)).toBeInTheDocument();
  });

  it("should open modal", async () => {
    const { getByTestId } = render(RenameSubAccount);
    await fireEvent.click(
      getByTestId("open-rename-subaccount-button") as HTMLButtonElement
    );

    const modal = get(walletModal);
    expect(modal).toEqual("rename");
  });
});

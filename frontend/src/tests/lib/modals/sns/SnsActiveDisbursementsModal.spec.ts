/**
 * @jest-environment jsdom
 */

import SnsActiveDisbursementsModal from "$lib/modals/sns/neurons/SnsActiveDisbursementsModal.svelte";
import { mockPrincipal } from "$tests/mocks/auth.store.mock";
import { renderModal } from "$tests/mocks/modal.mock";
import { mockSnsNeuron } from "$tests/mocks/sns-neurons.mock";
import { SnsActiveDisbursementsModalPo } from "$tests/page-objects/SnsActiveDisbursementsModal.page-object";
import { JestPageObjectElement } from "$tests/page-objects/jest.page-object";
import type { SnsNeuron } from "@dfinity/sns";
import type { DisburseMaturityInProgress } from "@dfinity/sns/dist/candid/sns_governance";

describe("SnsActiveDisbursementsModal", () => {
  const renderComponent = async (neuron: SnsNeuron) => {
    const { container } = await renderModal({
      component: SnsActiveDisbursementsModal,
      props: {
        neuron,
      },
    });
    return SnsActiveDisbursementsModalPo.under(
      new JestPageObjectElement(container)
    );
  };

  it("should display ActiveDisbursementEntries", async () => {
    const testActiveDisbursement: DisburseMaturityInProgress = {
      timestamp_of_disbursement_seconds: 10000n,
      amount_e8s: 1000000n,
      account_to_disburse_to: [
        {
          owner: [mockPrincipal],
          subaccount: [],
        },
      ],
    };
    const po = await renderComponent({
      ...mockSnsNeuron,
      disburse_maturity_in_progress: [
        testActiveDisbursement,
        testActiveDisbursement,
      ],
    });

    expect(await po.getActiveDisbursementEntryPos()).toHaveLength(2);
  });
});
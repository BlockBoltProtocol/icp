/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/svelte";
import SNSProjectDetail from "../../routes/SNSProjectDetail.svelte";

describe("SNSProjectDetail", () => {
  it("should render info section", () => {
    const { queryByTestId } = render(SNSProjectDetail);

    expect(queryByTestId("sns-project-detail-info")).toBeInTheDocument();
  });

  it("should render status section", () => {
    const { queryByTestId } = render(SNSProjectDetail);

    expect(queryByTestId("sns-project-detail-status")).toBeInTheDocument();
  });
});

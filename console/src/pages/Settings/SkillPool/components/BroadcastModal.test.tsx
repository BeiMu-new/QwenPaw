/**
 * BroadcastModal.test.tsx — cancel must stay reachable during a download.
 *
 * Regression: antd 5.29 short-circuits `onCancel` whenever `confirmLoading`
 * is set (`modal/Modal.js`), so binding the busy state to that prop turned
 * "Cancel import" into a button that looked enabled and did nothing. The
 * modal shell is stubbed here so the test can assert the two invariants
 * directly instead of depending on the footer's DOM behaviour.
 */
import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type {
  PoolDownloadState,
  PoolSkillSpec,
  WorkspaceSkillSummary,
} from "../../../../api/types";
import { BroadcastModal } from "./BroadcastModal";

const { captured } = vi.hoisted(() => ({
  captured: [] as Array<Record<string, unknown>>,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@number-flow/react", () => ({ default: () => null }));

vi.mock("@/components/interaction/SharedModal", () => ({
  SharedModal: (props: Record<string, unknown>) => {
    captured.push(props);
    return <div>{props.children as React.ReactNode}</div>;
  },
}));

// The design package resolves its antd re-exports differently under Vitest.
vi.mock("@agentscope-ai/design", () => ({
  Button: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  Input: () => null,
  Select: () => null,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const SKILLS: PoolSkillSpec[] = [
  { name: "demo-skill", source: "external", tags: [] },
];

const WORKSPACES: WorkspaceSkillSummary[] = [
  { agent_id: "ws-a", agent_name: "Workspace A", skill_names: [] },
];

function renderModal(downloadState: PoolDownloadState | null) {
  const onCancel = vi.fn();
  const onCancelDownload = vi.fn();
  const onConfirm = vi.fn(() => new Promise<void>(() => {}));
  render(
    <BroadcastModal
      open
      skills={SKILLS}
      workspaces={WORKSPACES}
      initialSkillNames={["demo-skill"]}
      downloadState={downloadState}
      onCancel={onCancel}
      onCancelDownload={onCancelDownload}
      onConfirm={onConfirm}
    />,
  );
  return { onCancel, onCancelDownload, onConfirm };
}

function latest() {
  return captured[captured.length - 1];
}

describe("BroadcastModal cancel handling", () => {
  it("never hands Modal a confirmLoading flag", () => {
    renderModal(null);
    expect(latest().confirmLoading).toBeUndefined();
  });

  it("moves the busy state onto the OK button", async () => {
    renderModal(null);
    await act(async () => {
      void (latest().onOk as () => void)();
    });
    expect(latest().confirmLoading).toBeUndefined();
    expect((latest().okButtonProps as { loading?: boolean }).loading).toBe(
      true,
    );
  });

  it("routes cancel to the download canceller while downloading", () => {
    const { onCancelDownload, onCancel } = renderModal("running");
    (latest().onCancel as () => void)();
    expect(onCancelDownload).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("closes the dialog when nothing is downloading", () => {
    const { onCancelDownload, onCancel } = renderModal(null);
    (latest().onCancel as () => void)();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancelDownload).not.toHaveBeenCalled();
  });
});

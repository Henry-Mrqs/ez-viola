import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { HandsFreeCalibrationWizard } from "@/components/calibration/hands-free-calibration-wizard";
import {
  HandsFreeCalibrationEngine,
  HandsFreeCalibrationProgress,
} from "@/audio/hands-free-calibration-engine";

describe("HandsFreeCalibrationWizard (2-Meter UI, Pluck Counter & Tactile Escapes)", () => {
  const createMockEngine = (stateOverride?: Partial<HandsFreeCalibrationProgress>) => {
    const defaultState: HandsFreeCalibrationProgress = {
      state: "AWAITING_PLUCK",
      currentTarget: {
        type: "string",
        stringNumber: 6,
        name: "E2",
        targetFrequency: 82.41,
        displayName: "Corda 6 (E2) — Mais grossa (Cima)",
        instructionText: "Toque a corda 6 (mais grossa) solta e deixe soar",
      },
      targetIndex: 0,
      totalTargets: 6,
      currentPluckCount: 1,
      targetPlucks: 3,
      lastOnsetTimestamp: Date.now(),
      inactivityWarning: false,
      feedbackMessage: "Toque 1/3 confirmado!",
      autoAdvanceCountdownMs: 0,
      outlierRejected: false,
      ...stateOverride,
    };

    return {
      getState: () => defaultState,
      subscribe: vi.fn((listener: (p: HandsFreeCalibrationProgress) => void) => {
        listener(defaultState);
        return () => {};
      }),
      retryCurrentStep: vi.fn(),
      skipCurrentStep: vi.fn(),
      stopWizard: vi.fn(),
    } as unknown as HandsFreeCalibrationEngine;
  };

  it("renders wizard with 2-meter typography and 3-step pluck counter", () => {
    const engine = createMockEngine();
    const html = renderToStaticMarkup(
      <HandsFreeCalibrationWizard engine={engine} />
    );

    expect(html).toContain('data-testid="hands-free-calibration-wizard"');
    expect(html).toContain("Corda 6 (E2) — Mais grossa (Cima)");
    expect(html).toContain('data-testid="pluck-counter-1"');
    expect(html).toContain('data-testid="pluck-counter-2"');
    expect(html).toContain('data-testid="pluck-counter-3"');
  });

  it("renders tactile manual escape buttons (Refazer, Pular, Encerrar)", () => {
    const engine = createMockEngine();
    const html = renderToStaticMarkup(
      <HandsFreeCalibrationWizard engine={engine} />
    );

    expect(html).toContain('data-testid="wizard-retry-button"');
    expect(html).toContain("Refazer corda");
    expect(html).toContain('data-testid="wizard-skip-button"');
    expect(html).toContain("Pular corda");
    expect(html).toContain('data-testid="wizard-cancel-button"');
    expect(html).toContain("Encerrar");
  });

  it("displays inactivity pedagogical nudge warning when inactivityWarning is true", () => {
    const engine = createMockEngine({
      inactivityWarning: true,
      inactivityMessage: "Não estamos ouvindo seu violão... Toque mais perto!",
    });
    const html = renderToStaticMarkup(
      <HandsFreeCalibrationWizard engine={engine} />
    );

    expect(html).toContain('data-testid="inactivity-warning"');
    expect(html).toContain("Não estamos ouvindo seu violão");
  });

  it("renders completion screen with finish button when state is CALIBRATION_DONE", () => {
    const engine = createMockEngine({
      state: "CALIBRATION_DONE",
      feedbackMessage: "Calibração concluída com sucesso!",
    });
    const html = renderToStaticMarkup(
      <HandsFreeCalibrationWizard engine={engine} />
    );

    expect(html).toContain("Violão Calibrado!");
    expect(html).toContain('data-testid="wizard-finish-button"');
    expect(html).toContain("Concluir e Começar a Tocar");
  });
});

import type { LivePlantWarranty, PlantCompliance } from '../interfaces/Plant';

const STATE_CODE_PATTERN = /^[A-Z]{2}$/;

export const parseRestrictedStatesInput = (
  input: string,
): { states: string[]; invalidEntries: string[] } => {
  const states: string[] = [];
  const invalidEntries: string[] = [];

  input
    .split(/[\n,;]+/)
    .map((value) => value.trim())
    .filter(Boolean)
    .forEach((value) => {
      const normalized = value.toUpperCase();
      if (STATE_CODE_PATTERN.test(normalized)) {
        if (!states.includes(normalized)) {
          states.push(normalized);
        }
      } else {
        invalidEntries.push(value);
      }
    });

  return { states, invalidEntries };
};

export const normalizeRestrictedStates = (states: string[] | undefined): string[] => {
  const unique = new Set<string>();
  (states ?? []).forEach((value) => {
    if (typeof value !== 'string') {
      return;
    }
    const normalized = value.trim().toUpperCase();
    if (STATE_CODE_PATTERN.test(normalized)) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
};

export interface ComplianceContext {
  restrictedStates: string[];
  restrictedStatesAcknowledged: boolean;
  requiresPhytosanitaryCertificate: boolean;
  phytosanitaryAcknowledged: boolean;
  phytosanitaryDetails?: string;
  arrivalGuaranteeOffered: boolean;
  arrivalGuaranteeAcknowledged: boolean;
}

export const buildComplianceContext = (
  compliance: PlantCompliance | undefined,
  warranty: LivePlantWarranty | undefined,
): ComplianceContext => {
  const restrictedStates = normalizeRestrictedStates(compliance?.restrictedStates);
  const phytosanitaryDetails = compliance?.phytosanitaryDetails?.trim();

  return {
    restrictedStates,
    restrictedStatesAcknowledged: Boolean(
      compliance?.restrictedStatesAcknowledged && restrictedStates.length > 0,
    ),
    requiresPhytosanitaryCertificate: Boolean(compliance?.requiresPhytosanitaryCertificate),
    phytosanitaryAcknowledged: Boolean(compliance?.phytosanitaryAcknowledged),
    phytosanitaryDetails: phytosanitaryDetails?.length ? phytosanitaryDetails : undefined,
    arrivalGuaranteeOffered: Boolean(warranty?.isOffered),
    arrivalGuaranteeAcknowledged: Boolean(
      warranty?.isOffered && compliance?.arrivalGuaranteeAcknowledged,
    ),
  } satisfies ComplianceContext;
};

export const hasCompliance = (context: ComplianceContext): boolean => {
  return (
    context.restrictedStates.length > 0 ||
    context.requiresPhytosanitaryCertificate ||
    context.arrivalGuaranteeOffered
  );
};

export const formatRestrictedStatesSummary = (states: string[]): string => {
  if (states.length === 0) {
    return '';
  }
  if (states.length <= 3) {
    return states.join(', ');
  }
  const visible = states.slice(0, 3).join(', ');
  return `${visible} +${states.length - 3} more`;
};

export const getComplianceHighlights = (
  compliance: PlantCompliance | undefined,
  warranty: LivePlantWarranty | undefined,
): string[] => {
  const context = buildComplianceContext(compliance, warranty);
  const highlights: string[] = [];

  if (context.restrictedStates.length > 0) {
    highlights.push(`No ship: ${formatRestrictedStatesSummary(context.restrictedStates)}`);
  }

  if (context.requiresPhytosanitaryCertificate) {
    highlights.push(
      context.phytosanitaryAcknowledged
        ? 'Phytosanitary certificate confirmed'
        : 'Phytosanitary certificate required (confirmation pending)',
    );
  }

  if (context.arrivalGuaranteeOffered) {
    highlights.push(
      context.arrivalGuaranteeAcknowledged
        ? 'Arrival guarantee confirmed'
        : 'Arrival guarantee advertised (acknowledgment needed)',
    );
  }

  return highlights;
};

import type { DeliveryMethod, ZipRange } from "../interfaces/Plant";

export interface DeliveryMethodOption {
  value: DeliveryMethod;
  label: string;
  description: string;
  requiresZip?: boolean;
}

export const DELIVERY_METHOD_OPTIONS: DeliveryMethodOption[] = [
  {
    value: "LOCAL_PICKUP",
    label: "Local pickup",
    description: "Buyer meets the seller to collect the plant.",
  },
  {
    value: "LOCAL_DELIVERY",
    label: "Local courier delivery",
    description: "Seller or partner courier delivers within 25 miles of the listing.",
  },
  {
    value: "REGIONAL_SHIPPING",
    label: "Regional carrier shipping",
    description: "Approved regional carriers within designated ZIP ranges.",
    requiresZip: true,
  },
  {
    value: "NATIONWIDE_SHIPPING",
    label: "Nationwide shipping",
    description: "Insulated nationwide service to the contiguous U.S.",
    requiresZip: true,
  },
];

export const DELIVERY_METHOD_LABEL_LOOKUP = new Map(
  DELIVERY_METHOD_OPTIONS.map((option) => [option.value, option.label])
);

const DELIVERY_METHOD_COMPATIBILITY: Record<DeliveryMethod, DeliveryMethod[]> = {
  LOCAL_PICKUP: ["LOCAL_DELIVERY", "REGIONAL_SHIPPING"],
  LOCAL_DELIVERY: ["LOCAL_PICKUP", "REGIONAL_SHIPPING"],
  REGIONAL_SHIPPING: ["LOCAL_PICKUP", "LOCAL_DELIVERY", "NATIONWIDE_SHIPPING"],
  NATIONWIDE_SHIPPING: ["REGIONAL_SHIPPING"],
};

const DELIVERY_METHOD_DEPENDENCIES: Partial<Record<DeliveryMethod, DeliveryMethod[]>> = {
  NATIONWIDE_SHIPPING: ["REGIONAL_SHIPPING"],
};

export const SHIPPING_METHODS: DeliveryMethod[] = [
  "REGIONAL_SHIPPING",
  "NATIONWIDE_SHIPPING",
];

export const PROHIBITED_STATE_ALERTS: Record<string, string> = {
  AK: "Alaska restricts inbound live plant shipments without special permitting. Remove shipping methods or coordinate with fulfillment.",
  HI: "Hawaii requires agricultural pre-clearance. Shipping is currently paused per fulfillment policy.",
  PR: "Puerto Rico blocks live plant imports without USDA inspection. Offer pickup or local delivery only.",
  GU: "Guam prohibits direct live plant shipments. Shipping methods are not permitted.",
};

export const isShippingMethod = (method: DeliveryMethod) =>
  SHIPPING_METHODS.includes(method);

export const requiresZipRanges = (methods: DeliveryMethod[]) =>
  methods.some(isShippingMethod);

export const getDeliveryCombinationError = (
  methods: DeliveryMethod[],
): string | null => {
  const uniqueMethods = Array.from(new Set(methods));

  if (uniqueMethods.length === 0) {
    return "Select at least one delivery method before publishing.";
  }

  for (const method of uniqueMethods) {
    const required = DELIVERY_METHOD_DEPENDENCIES[method] ?? [];
    const missing = required.filter((dependency) => !uniqueMethods.includes(dependency));
    if (missing.length > 0) {
      const methodLabel = DELIVERY_METHOD_LABEL_LOOKUP.get(method) ?? method;
      const missingLabels = missing
        .map((dependency) => DELIVERY_METHOD_LABEL_LOOKUP.get(dependency) ?? dependency)
        .join(", ");
      return `${methodLabel} requires also offering ${missingLabels} per fulfillment guidance.`;
    }
  }

  for (let i = 0; i < uniqueMethods.length; i += 1) {
    for (let j = i + 1; j < uniqueMethods.length; j += 1) {
      const first = uniqueMethods[i];
      const second = uniqueMethods[j];
      const forwardAllowed = DELIVERY_METHOD_COMPATIBILITY[first] ?? [];
      const reverseAllowed = DELIVERY_METHOD_COMPATIBILITY[second] ?? [];

      if (!forwardAllowed.includes(second) || !reverseAllowed.includes(first)) {
        const firstLabel = DELIVERY_METHOD_LABEL_LOOKUP.get(first) ?? first;
        const secondLabel = DELIVERY_METHOD_LABEL_LOOKUP.get(second) ?? second;
        return `${firstLabel} cannot be paired with ${secondLabel} under the approved delivery matrix.`;
      }
    }
  }

  return null;
};

const STATE_CODE_REGEX = /\b(?:A[KLRZ]|C[AOT]|D[CE]|F[LM]|G[AUP]|H[HI]|I[ADLN]|K[SY]|L[A]|M[ADEHINOPST]|N[CDEHJMVY]|O[HKR]|P[A]|R[HI]|S[CD]|T[NX]|U[ST]|V[AIT]|W[AIVY]|PR|GU)\b/gi;

export const extractStateCode = (location: string): string | null => {
  if (!location) {
    return null;
  }

  const matches = location.toUpperCase().match(STATE_CODE_REGEX);
  if (!matches || matches.length === 0) {
    return null;
  }

  return matches[matches.length - 1];
};

export const getProhibitedStateMessage = (
  stateCode: string | null,
  methods: DeliveryMethod[],
): string | null => {
  if (!stateCode) {
    return null;
  }

  if (!methods.some(isShippingMethod)) {
    return null;
  }

  return PROHIBITED_STATE_ALERTS[stateCode] ?? null;
};

export const parseZipRanges = (
  input: string,
): { ranges: ZipRange[]; invalidEntries: string[] } => {
  const ranges: ZipRange[] = [];
  const invalidEntries: string[] = [];

  const entries = input
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  entries.forEach((entry) => {
    const normalized = entry.replace(/\s+/g, "");
    const match = normalized.match(/^(\d{5})(?:-(\d{5}))?$/);

    if (!match) {
      invalidEntries.push(entry);
      return;
    }

    const start = match[1];
    const end = match[2] ?? match[1];

    if (Number(start) > Number(end)) {
      invalidEntries.push(entry);
      return;
    }

    ranges.push({ start, end });
  });

  return { ranges, invalidEntries };
};

export const formatZipRange = (range: ZipRange): string =>
  range.start === range.end ? range.start : `${range.start}-${range.end}`;


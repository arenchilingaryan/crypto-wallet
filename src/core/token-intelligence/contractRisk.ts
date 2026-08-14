import {
  evidenceConflict,
  evidenceSources,
  resolveEvidence,
  unknownEvidence,
} from "./evidence";
import {
  honeypotFlagLevel,
  honeypotFlagMessage,
  honeypotFlagReasonCode,
  isContractHoneypotFlag,
} from "./honeypotFlags";
import { reason, resultFromReasons, uniqueReasons } from "./risk";
import {
  UNKNOWN,
  type ContractIntelligence,
  type Evidence,
  type EvidenceConflict,
  type EvidenceObservation,
  type NormalizedGoPlusSnapshot,
  type NormalizedHoneypotSnapshot,
  type ProviderSnapshot,
  type RiskReason,
} from "./types";
import { asTriState } from "./validation";

type ContractBuildResult = {
  contract: ContractIntelligence;
  conflicts: EvidenceConflict[];
};

function observation<T>(
  snapshot: ProviderSnapshot<unknown>,
  source: "goplus" | "honeypot-check",
  value: T | typeof UNKNOWN,
): EvidenceObservation<T> | null {
  return snapshot.status === "available"
    ? { source, value, observedAt: snapshot.observedAt }
    : null;
}

function booleanEvidence(
  observations: readonly (EvidenceObservation<boolean> | null)[],
  dangerWhen: boolean,
): Evidence<boolean> {
  return resolveEvidence(
    observations
      .filter((item): item is EvidenceObservation<boolean> => item !== null)
      .map((item) => ({ ...item, value: asTriState(item.value) })),
    {
      conservative(values) {
        return values.includes(dangerWhen) ? dangerWhen : !dangerWhen;
      },
    },
  );
}

function singleEvidence<T>(
  item: EvidenceObservation<T> | null,
): Evidence<T> {
  return item ? resolveEvidence([item]) : unknownEvidence<T>();
}

function addCapability(
  reasons: RiskReason[],
  evidence: Evidence<boolean>,
  code: string,
  level: "medium" | "high" | "critical",
  message: string,
) {
  if (evidence.value === true) {
    reasons.push(reason(code, level, message, evidenceSources(evidence)));
  }
}

export function buildContractIntelligence({
  goplus,
  honeypot,
}: {
  goplus: ProviderSnapshot<NormalizedGoPlusSnapshot>;
  honeypot: ProviderSnapshot<NormalizedHoneypotSnapshot>;
}): ContractBuildResult {
  const go = goplus.status === "available" ? goplus.data : null;
  const hp = honeypot.status === "available" ? honeypot.data : null;
  const isOpenSource = booleanEvidence(
    [
      observation(goplus, "goplus", go?.contract.isOpenSource ?? UNKNOWN),
      observation(
        honeypot,
        "honeypot-check",
        hp?.contractCode.openSource ?? UNKNOWN,
      ),
    ],
    false,
  );
  const rootOpenSource = booleanEvidence(
    [
      observation(
        honeypot,
        "honeypot-check",
        hp?.contractCode.rootOpenSource ?? UNKNOWN,
      ),
    ],
    false,
  );
  const isProxy = booleanEvidence(
    [
      observation(goplus, "goplus", go?.contract.isProxy ?? UNKNOWN),
      observation(
        honeypot,
        "honeypot-check",
        hp?.contractCode.isProxy ?? UNKNOWN,
      ),
    ],
    true,
  );
  const hasProxyCalls = booleanEvidence(
    [
      observation(
        honeypot,
        "honeypot-check",
        hp?.contractCode.hasProxyCalls ?? UNKNOWN,
      ),
    ],
    true,
  );
  const isMintable = booleanEvidence(
    [observation(goplus, "goplus", go?.contract.isMintable ?? UNKNOWN)],
    true,
  );
  const ownerAddress = singleEvidence(
    observation(goplus, "goplus", go?.contract.ownerAddress ?? UNKNOWN),
  );
  const hiddenOwner = booleanEvidence(
    [observation(goplus, "goplus", go?.contract.hiddenOwner ?? UNKNOWN)],
    true,
  );
  const canTakeBackOwnership = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.contract.canTakeBackOwnership ?? UNKNOWN,
      ),
    ],
    true,
  );
  const ownerChangeBalance = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.contract.ownerChangeBalance ?? UNKNOWN,
      ),
    ],
    true,
  );
  const selfDestruct = booleanEvidence(
    [observation(goplus, "goplus", go?.contract.selfDestruct ?? UNKNOWN)],
    true,
  );
  const externalCall = booleanEvidence(
    [observation(goplus, "goplus", go?.contract.externalCall ?? UNKNOWN)],
    true,
  );
  const transferPausable = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.trading.transferPausable ?? UNKNOWN,
      ),
    ],
    true,
  );
  const isBlacklisted = booleanEvidence(
    [
      observation(goplus, "goplus", go?.trading.isBlacklisted ?? UNKNOWN),
    ],
    true,
  );
  const slippageModifiable = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.trading.slippageModifiable ?? UNKNOWN,
      ),
    ],
    true,
  );
  const personalSlippageModifiable = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.trading.personalSlippageModifiable ?? UNKNOWN,
      ),
    ],
    true,
  );
  const antiWhale = booleanEvidence(
    [observation(goplus, "goplus", go?.trading.isAntiWhale ?? UNKNOWN)],
    true,
  );
  const antiWhaleModifiable = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.trading.antiWhaleModifiable ?? UNKNOWN,
      ),
    ],
    true,
  );
  const isAirdropScam = booleanEvidence(
    [
      observation(
        goplus,
        "goplus",
        go?.additional.isAirdropScam ?? UNKNOWN,
      ),
    ],
    true,
  );
  const fakeToken = booleanEvidence(
    [observation(goplus, "goplus", go?.additional.fakeToken ?? UNKNOWN)],
    true,
  );
  const note = singleEvidence(
    observation(goplus, "goplus", go?.additional.note ?? UNKNOWN),
  );
  const reasons: RiskReason[] = [];

  addCapability(
    reasons,
    ownerChangeBalance,
    "owner-change-balance",
    "high",
    "Owner can change holder balances",
  );
  addCapability(
    reasons,
    hiddenOwner,
    "hidden-owner",
    "high",
    "Hidden ownership capability detected",
  );
  addCapability(
    reasons,
    canTakeBackOwnership,
    "ownership-reclaimable",
    "high",
    "Ownership can potentially be reclaimed",
  );
  addCapability(
    reasons,
    selfDestruct,
    "self-destruct",
    "high",
    "Contract contains a self-destruct capability",
  );
  addCapability(
    reasons,
    isAirdropScam,
    "airdrop-scam",
    "critical",
    "GoPlus identified an airdrop scam",
  );
  addCapability(
    reasons,
    fakeToken,
    "fake-token",
    "critical",
    "GoPlus identified a counterfeit token",
  );
  addCapability(
    reasons,
    personalSlippageModifiable,
    "personal-tax-modifiable",
    "high",
    "Owner can set address-specific trading tax",
  );
  addCapability(
    reasons,
    slippageModifiable,
    "tax-modifiable",
    "high",
    "Owner can modify trading tax",
  );
  addCapability(
    reasons,
    transferPausable,
    "transfer-pausable",
    "high",
    "Owner can pause token transfers",
  );
  addCapability(
    reasons,
    isBlacklisted,
    "blacklist",
    "high",
    "Address blacklist capability detected",
  );
  addCapability(
    reasons,
    isMintable,
    "mintable",
    "medium",
    "Mint function is available; this is a capability, not proof of fraud",
  );
  addCapability(
    reasons,
    isProxy,
    "proxy",
    "medium",
    "Contract is upgradeable through a proxy",
  );
  addCapability(
    reasons,
    hasProxyCalls,
    "proxy-calls",
    "medium",
    "Delegate calls exist in the trading execution path",
  );
  addCapability(
    reasons,
    externalCall,
    "external-call",
    "medium",
    "Contract behavior depends on external calls",
  );
  addCapability(
    reasons,
    antiWhaleModifiable,
    "anti-whale-modifiable",
    "medium",
    "Anti-whale limits can be changed",
  );

  if (isOpenSource.value === false || rootOpenSource.value === false) {
    reasons.push(
      reason(
        "closed-source",
        "high",
        "Contract source is not fully available for inspection",
        [...evidenceSources(isOpenSource), ...evidenceSources(rootOpenSource)],
      ),
    );
  }

  for (const [index, message] of (go?.additional.otherPotentialRisks ?? []).entries()) {
    reasons.push(
      reason(`goplus-risk-${index}`, "medium", message, ["goplus"]),
    );
  }

  for (const [index, flag] of (hp?.summary.flags ?? []).entries()) {
    if (!isContractHoneypotFlag(flag)) {
      continue;
    }

    reasons.push(
      reason(
        honeypotFlagReasonCode("contract", index, flag),
        honeypotFlagLevel(flag),
        honeypotFlagMessage(flag),
        ["honeypot-check"],
      ),
    );
  }

  if (antiWhale.value === true) {
    reasons.push(
      reason(
        "anti-whale",
        "info",
        "Anti-whale mechanism detected",
        evidenceSources(antiWhale),
      ),
    );
  }

  const availableCount = [goplus, honeypot].filter(
    (item) => item.status === "available",
  ).length;
  const allEvidenceKnown = [
    isOpenSource,
    rootOpenSource,
    isProxy,
    hasProxyCalls,
    isMintable,
    hiddenOwner,
    canTakeBackOwnership,
    ownerChangeBalance,
    selfDestruct,
    externalCall,
    transferPausable,
    isBlacklisted,
    slippageModifiable,
    personalSlippageModifiable,
    antiWhale,
    antiWhaleModifiable,
    isAirdropScam,
    fakeToken,
  ].every((item) => item.value !== UNKNOWN);
  const risk = resultFromReasons({
    reasons: uniqueReasons(reasons),
    confidence:
      availableCount === 2 ? "full" : availableCount === 1 ? "partial" : "unknown",
    lowWhenClear:
      availableCount === 2 && allEvidenceKnown && reasons.length === 0,
  });
  const conflicts = [
    evidenceConflict("Open-source status", isOpenSource),
    evidenceConflict("Proxy status", isProxy),
  ].filter((item): item is EvidenceConflict => item !== null);

  return {
    contract: {
      isOpenSource,
      rootOpenSource,
      isProxy,
      hasProxyCalls,
      isMintable,
      ownerAddress,
      hiddenOwner,
      canTakeBackOwnership,
      ownerChangeBalance,
      selfDestruct,
      externalCall,
      transferPausable,
      isBlacklisted,
      slippageModifiable,
      personalSlippageModifiable,
      antiWhale,
      antiWhaleModifiable,
      isAirdropScam,
      fakeToken,
      otherPotentialRisks: go?.additional.otherPotentialRisks ?? [],
      note,
      risk,
    },
    conflicts,
  };
}

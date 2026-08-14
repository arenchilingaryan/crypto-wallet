import { useEffect, useState } from "react";

import { useRouter } from "expo-router";

import {
  draftToPolicy,
  policyToDraft,
  PolicyView,
  type PolicyDraft,
} from "@/components/screens/policy-view";

import { ACTIVE_NETWORK, isTestnetNetwork } from "@/constants/networks";

import {
  DEFAULT_SECURITY_POLICY,
  type SecurityPolicy,
} from "@/core/security/securityPolicy";

import { policyApi } from "@/platform/react-native/policyApi";

export default function LimitsScreen() {
  const router = useRouter();

  const [draft, setDraft] = useState<PolicyDraft>(
    policyToDraft(DEFAULT_SECURITY_POLICY),
  );

  const [loaded, setLoaded] = useState<SecurityPolicy>(
    DEFAULT_SECURITY_POLICY,
  );

  const [saving, setSaving] = useState(false);

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let mounted = true;

    void policyApi.load().then((policy) => {
      if (mounted) {
        setLoaded(policy);

        setDraft(policyToDraft(policy));
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <PolicyView
      draft={draft}
      networkName={ACTIVE_NETWORK.name}
      enforced={!isTestnetNetwork(ACTIVE_NETWORK.id)}
      saving={saving}
      saved={saved}
      onChange={(next) => {
        setDraft(next);
        setSaved(false);
      }}
      onSave={() => {
        void (async () => {
          try {
            setSaving(true);

            await policyApi.save(draftToPolicy(draft, loaded));

            setSaved(true);
          } catch (error) {
            console.error("Saving policy failed:", error);
          } finally {
            setSaving(false);
          }
        })();
      }}
      onBack={() => {
        router.back();
      }}
    />
  );
}

import { StyleSheet } from "react-native";

import { Colors, Radius, Spacing } from "@/constants/theme";

export const styles = StyleSheet.create({
  heading: {
    marginBottom: Spacing.sm,
  },

  summary: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    padding: Spacing.lg,

    gap: Spacing.xs,

    marginBottom: Spacing.xl,
  },

  reviewGroup: {
    marginTop: Spacing.sm,

    gap: Spacing.xs,
  },

  setupLink: {
    marginTop: Spacing.md,

    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,

    gap: 2,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.md,
  },

  state: {
    marginTop: Spacing.xl,

    alignItems: "center",

    gap: Spacing.sm,
  },

  list: {
    gap: Spacing.sm,
  },

  approval: {
    backgroundColor: Colors.surface,

    borderWidth: 1,
    borderColor: Colors.border,

    borderRadius: Radius.lg,

    padding: Spacing.lg,

    gap: Spacing.md,
  },

  approvalTop: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.md,
  },

  approvalTitle: {
    flexDirection: "row",

    alignItems: "center",

    gap: Spacing.sm,
  },

  riskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 1,

    borderRadius: Radius.full,

    backgroundColor: Colors.surfaceAlt,
  },

  approvalIdentity: {
    flex: 1,

    gap: 2,
  },

  approvalAmounts: {
    alignItems: "flex-end",

    gap: 2,
  },

  approvalDetails: {
    gap: Spacing.xs,

    paddingTop: Spacing.md,

    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },

  detailRow: {
    flexDirection: "row",

    alignItems: "center",
    justifyContent: "space-between",

    gap: Spacing.md,
  },

  revokeButton: {
    alignSelf: "flex-start",

    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,

    borderWidth: 1,
    borderColor: Colors.borderStrong,

    borderRadius: Radius.full,
  },

  revokeButtonPressed: {
    backgroundColor: Colors.surfaceAlt,
  },

  footer: {
    height: Spacing.xl,
  },
});

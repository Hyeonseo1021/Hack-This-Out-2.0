// src/utils/tierUtils.ts

export const TierNames: Record<number, string> = {
  1: "Script Kiddie",
  2: "Rookie",
  3: "Hacker",
  4: "Elite Hacker",
  5: "Pro Hacker",
  6: "Shadow"
};

export const getTierName = (tier: number): string => {
  return TierNames[tier] || "Unknown";
};


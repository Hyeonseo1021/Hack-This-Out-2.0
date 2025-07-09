export const getTierName = (tier: number): string => {
  switch (tier) {
    case 1: return "Script Kiddie";
    case 2: return "Rookie";
    case 3: return "Hacker";
    case 4: return "Elite Hacker";
    case 5: return "Pro Hacker";
    case 6: return "Shadow";
    default: return "Unknown";
  }
};

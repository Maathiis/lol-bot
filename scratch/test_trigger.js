
const TIERS = [
  "IRON",
  "BRONZE",
  "SILVER",
  "GOLD",
  "PLATINUM",
  "EMERALD",
  "DIAMOND",
  "MASTER",
  "GRANDMASTER",
  "CHALLENGER",
];

function trigger(oldTier, newTier) {
  if (!oldTier || !newTier || oldTier === "UNRANKED" || newTier === "UNRANKED")
    return false;
  const oldIdx = TIERS.indexOf(oldTier.toUpperCase());
  const newIdx = TIERS.indexOf(newTier.toUpperCase());
  return oldIdx > -1 && newIdx > -1 && newIdx < oldIdx;
}

console.log("Plat to Gold:", trigger("PLATINUM", "GOLD")); // Should be true
console.log("Plat 1 to Plat 2 (both PLATINUM):", trigger("PLATINUM", "PLATINUM")); // Should be false
console.log("Emerald to Plat:", trigger("EMERALD", "PLATINUM")); // Should be true

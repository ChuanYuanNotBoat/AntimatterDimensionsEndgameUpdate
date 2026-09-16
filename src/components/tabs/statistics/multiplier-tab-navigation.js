// IDs are save data (player.options.multiplierTab.currTab); never renumber existing entries.
// Keep navigation separate from the formula tree. A resource only belongs here after its
// multiplierTabValues[root].total has been implemented, including its unlock condition.
export const MULTIPLIER_TAB_GROUPS = [
  {
    key: "core",
    text: "Core",
    options: [
      { id: 0, key: "AM", text: "Antimatter Production" },
      { id: 1, key: "tickspeed", text: "Tickspeed" },
      { id: 11, key: "gamespeed", text: "Game Speed" },
    ],
  },
  {
    key: "dimensions",
    text: "Dimensions",
    options: [
      { id: 2, key: "AD", text: "Antimatter Dimensions", dimensionTiers: 8 },
      { id: 4, key: "ID", text: "Infinity Dimensions", dimensionTiers: 8 },
      { id: 8, key: "TD", text: "Time Dimensions", dimensionTiers: 8 },
    ],
  },
  {
    key: "prestige",
    text: "Prestige",
    options: [
      { id: 3, key: "IP", text: "Infinity Points" },
      { id: 5, key: "infinities", text: "Infinities" },
      { id: 7, key: "EP", text: "Eternity Points" },
      { id: 9, key: "eternities", text: "Eternities" },
    ],
  },
  {
    key: "systems",
    text: "Systems",
    options: [
      { id: 6, key: "replicanti", text: "Replicanti Speed" },
      { id: 10, key: "DT", text: "Dilated Time" },
    ],
  },
];

export function availableMultiplierTabGroups(isActive) {
  return MULTIPLIER_TAB_GROUPS.map(group => ({
    ...group,
    options: group.options.filter(option => isActive(option.key)),
  })).filter(group => group.options.length > 0);
}

// Prefer another unlocked tab in the saved tab's category, otherwise the first
// unlocked category. This also handles obsolete/corrupted currTab save values.
export function resolveMultiplierTab(groups, currentID) {
  const selectedGroup = groups.find(group => group.options.some(option => option.id === currentID));
  if (selectedGroup) return selectedGroup.options.find(option => option.id === currentID);

  const originalGroup = MULTIPLIER_TAB_GROUPS.find(group => group.options.some(option => option.id === currentID));
  const fallbackGroup = groups.find(group => group.key === originalGroup?.key) ?? groups[0];
  return fallbackGroup?.options[0] ?? null;
}

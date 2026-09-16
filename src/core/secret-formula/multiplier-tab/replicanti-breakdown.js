import {
  addOrderedFinalImpacts,
  addOrderedTraceMismatch,
  addOrderedTransform,
  createOrderedTransformCache,
  orderedMultiplyStep,
} from "./ordered-breakdown";

// Only the EXTERNAL speed multiplier is being decomposed, not the subsequent
// over-cap interval adjustment. Keep the source order and Pelle early return
// aligned with src/core/replicanti.js:totalReplicantiSpeedMult().
function trace(skipKey = null, steps = null) {
  let value = DC.D1;
  if (steps) addOrderedTransform(steps, "base", "formula", DC.D1, DC.D1, {
    alwaysShow: true, display: "External speed multiplier starts at ×1"
  });
  const mult = (key, effect) => {
    value = orderedMultiplyStep(steps, key, value, effect, skipKey);
  };
  const overCap = Replicanti.amount.gt(replicantiCap());
  mult("pelle", PelleRifts.decay.effectValue);
  mult("pelleGlyph", Pelle.specialGlyphEffect.replication);
  mult("iap", ShopPurchase.replicantiPurchases.currentMult);

  if (Pelle.isDisabled("replicantiIntervalMult")) {
    // Pelle only restores particular sources when the matching upgrade applies.
    if (PelleAchievementUpgrade.achievement81.canBeApplied) {
      mult("achievement1", Effects.product(Achievement(81)));
    }
    if (PelleDestructionUpgrade.timestudy62.canBeApplied) {
      mult("study62", Effects.product(TimeStudy(62)));
    }
    if (PelleDestructionUpgrade.timestudy213.canBeApplied) {
      mult("study213", Effects.product(TimeStudy(213)));
    }
    if (PelleRealityUpgrade.replicativeAmplifier.canBeApplied) {
      mult("amplifierRep", RealityUpgrade(2).effectOrDefault(1));
    }
    if (PelleRealityUpgrade.cosmicallyDuplicate.canBeApplied) {
      mult("realityUpgrade1", Effects.product(RealityUpgrade(6)));
    }
    if (PelleRealityUpgrade.replicativeRapidity.canBeApplied) {
      mult("realityUpgrade2", Effects.product(RealityUpgrade(23)));
    }
    if (PelleDestructionUpgrade.timestudy132.canBeApplied) mult("study132", 3);
    if (PelleAchievementUpgrade.achievement134.canBeApplied && !overCap) mult("achievement2", 2);
    if (PelleDestructionUpgrade.destroyedGlyphEffects.canBeApplied) {
      mult("glyph", getAdjustedGlyphEffect("replicationspeed"));
    }
    if (PelleCelestialUpgrade.raTeresa3.canBeApplied) {
      mult("pelleAlteration", Decimal.clampMin(
        Decimal.log10(Replicanti.amount.add(1)).times(getSecondaryGlyphEffect("replicationdtgain")), 1));
    }
    if (PelleCelestialUpgrade.raV3.canBeApplied) {
      mult("ra", Ra.unlocks.continuousTTBoost.effects.replicanti.effectOrDefault(1));
    }
    if (PelleAlchemyUpgrade.alchemyReplication.canBeApplied) {
      mult("alchemy", AlchemyResource.replication.effectOrDefault(1));
    }
    return value;
  }

  mult("achievement1", Achievement(81).effectOrDefault(1));
  mult("study62", TimeStudy(62).effectOrDefault(1));
  mult("study213", TimeStudy(213).effectOrDefault(1));
  mult("realityUpgrade1", RealityUpgrade(6).effectOrDefault(1));
  mult("realityUpgrade2", RealityUpgrade(23).effectOrDefault(1));
  mult("amplifierRep", RealityUpgrade(2).effectOrDefault(1));
  if (TimeStudy(132).isBought) {
    mult("study132", Perk.studyPassive.isBought && !player.disablePostReality ? 3 : 1.5);
  }
  if (!overCap && Achievement(134).isUnlocked && !player.disablePostReality) mult("achievement2", 2);
  mult("glyph", getAdjustedGlyphEffect("replicationspeed"));
  if (GlyphAlteration.isAdded("replication")) mult("glyphAlteration", ReplicantiMultipliers.dtMult);
  mult("alchemy", AlchemyResource.replication.effectOrDefault(1));
  mult("ra", Ra.unlocks.continuousTTBoost.effects.replicanti.effectOrDefault(1));
  if (LHC.voidRunning) mult("nullUpgrade", NullUpgrade.replicantiSpeedMult.effectOrDefault(1));
  return value;
}

function build() {
  const steps = {};
  const result = trace(null, steps);
  addOrderedFinalImpacts(steps, key => trace(key), result, ["base"]);
  addOrderedTraceMismatch(steps, result,
    totalReplicantiSpeedMult(Replicanti.amount.gt(replicantiCap())),
    "External speed formula differs from src/core/replicanti.js");
  return steps;
}

const getTrace = createOrderedTransformCache(build, 250);
export const ReplicantiBreakdown = {
  transform: key => getTrace(key),
  summary: () => ({
    type: "formula", before: DC.D1,
    after: totalReplicantiSpeedMult(Replicanti.amount.gt(replicantiCap())),
    alwaysShow: true,
  }),
};

// This actually deals with both sacrifice and refining, but I wasn't 100% sure what to call it
export const GlyphSacrificeHandler = {
  // Anything scaling on sacrifice caps at this value, even though the actual sacrifice values can go higher
  get maxSacrificeForEffects() {
    return (BreakEternityUpgrade.glyphSacrificeUncap.isBought && !player.disablePostReality) ? DC.BEMAX : new Decimal(1e100);
  },
  // This is used for glyph UI-related things in a few places, but is handled here as a getter which is only called
  // sparingly - that is, whenever the cache is invalidated after a glyph is sacrificed. Thus it only gets recalculated
  // when glyphs are actually sacrificed, rather than every render cycle.
  get logTotalSacrifice() {
    // We check elsewhere for this equalling zero to determine if the player has ever sacrificed. Technically this
    // should check for -Infinity, but the clampMin works in practice because the minimum possible sacrifice
    // value is greater than 1 for even the weakest possible glyph
    return BASIC_GLYPH_TYPES.reduce(
      (tot, type) => tot + Decimal.log10(Decimal.clampMin(player.reality.glyphs.sac[type], 1)).toNumber(), 0);
  },
  get canSacrifice() {
    return RealityUpgrade(19).isBought;
  },
  get isRefining() {
    return Ra.unlocks.unlockGlyphAlchemy.canBeApplied && AutoGlyphProcessor.sacMode !== AUTO_GLYPH_REJECT.SACRIFICE;
  },
  handleSpecialGlyphTypes(glyph) {
    switch (glyph.type) {
      case "companion":
        Modal.deleteCompanion.show();
        return true;
      case "cursed":
        Glyphs.removeFromInventory(glyph);
        return true;
    }
    return false;
  },
  // Removes a glyph, accounting for sacrifice unlock and alchemy state
  removeGlyph(glyph, force = false) {
    if (this.handleSpecialGlyphTypes(glyph)) return;
    if (!this.canSacrifice) this.deleteGlyph(glyph, force);
    else if (this.isRefining) this.attemptRefineGlyph(glyph, force);
    else this.sacrificeGlyph(glyph, force);
  },
  deleteGlyph(glyph, force) {
    if (force || !player.options.confirmations.glyphSacrifice) Glyphs.removeFromInventory(glyph);
    else Modal.glyphDelete.show({ idx: glyph.idx });
  },
  glyphSacrificeGain(glyph) {
    if (!this.canSacrifice || (Pelle.isDoomed && !PelleRealityUpgrade.scourToEmpower.canBeApplied)) return new Decimal(0);
    if (glyph.type === "reality") return new Decimal(glyph.level).times(0.01).times(Achievement(171).effectOrDefault(1));
    const pre10kFactor = Decimal.pow(Decimal.clampMax(glyph.level, 10000).add(10), 2.5);
    const post10kFactor = Decimal.clampMin(new Decimal(glyph.level).sub(10000), 0).div(100).add(1);
    const power = player.disablePostReality ? 1 : Effects.product(
        Ra.unlocks.maxGlyphRarityAndShardSacrificeBoost,
        EndgameUpgrade(24),
        Ra.unlocks.sacrificePower,
        DualityUpgrade(22)
      );
    return Decimal.pow(pre10kFactor.times(post10kFactor).times(glyph.strength).times(
      Teresa.runRewardMultiplier).times(Achievement(171).effectOrDefault(1)), power);
  },
  sacrificeGlyph(glyph, force = false) {
    if (Pelle.isDoomed && !PelleRealityUpgrade.scourToEmpower.canBeApplied) return;
    // This also needs to be here because this method is called directly from drag-and-drop sacrificing
    if (this.handleSpecialGlyphTypes(glyph)) return;
    const toGain = this.glyphSacrificeGain(glyph);
    const askConfirmation = !force && player.options.confirmations.glyphSacrifice;
    if (askConfirmation) {
      Modal.glyphSacrifice.show({ idx: glyph.idx, gain: toGain });
      return;
    }
    player.reality.glyphs.sac[glyph.type] = player.reality.glyphs.sac[glyph.type].add(toGain);
    GameCache.logTotalGlyphSacrifice.invalidate();
    Glyphs.removeFromInventory(glyph);
    EventHub.dispatch(GAME_EVENT.GLYPH_SACRIFICED, glyph);
  },
  glyphAlchemyResource(glyph) {
    const type = GlyphTypes[glyph.type];
    return AlchemyResources.all[type.alchemyResource];
  },
  // Scaling function to make refinement value ramp up with higher glyph levels
  levelRefinementValue(level) {
    // The expansion-pack level/3 term is not capped at 25000. Keep the
    // theoretical refinement value in Decimal until applying the real Number cap.
    return Decimal.max(Decimal.min(Decimal.pow(level, 3).div(1e8), 25000), (ExpansionPack.effarigPack.isBought &&
      !player.disablePostReality) ? new Decimal(level).div(3) : DC.D1);
  },
  // Alchemy is Number-backed. A Decimal exactly at Number.MAX_VALUE may
  // round UP to Infinity in toNumber(); compare with the cap before converting.
  finiteRefinementNumber(value, cap, source) {
    if (typeof cap !== "number" || !Number.isFinite(cap) || cap < 0) {
      throw new Error(`Invalid alchemy cap for ${source}`);
    }
    const decimal = new Decimal(value);
    if ([decimal.sign, decimal.layer, decimal.mag].some(x => !Number.isFinite(x)) || decimal.lt(0)) {
      throw new Error(`Invalid alchemy Decimal for ${source}`);
    }
    if (decimal.gte(cap)) return cap;
    const converted = decimal.toNumber();
    if (Number.isFinite(converted) && converted >= 0) return Math.min(converted, cap);
    // Extremely close to MAX_VALUE, the library's toNumber() can overflow
    // while a dimensionless fraction remains safely representable.
    if (cap === 0) return 0;
    const fraction = decimal.div(cap).toNumber();
    if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
      throw new Error(`Invalid alchemy Number conversion for ${source}`);
    }
    return Math.min(fraction * cap, cap);
  },
  // Native Number arithmetic is safe when we first compare gain against the
  // available room; a saturated sum must not be converted back from Decimal.
  addRefinementToCap(amount, gain, cap) {
    if (![amount, gain, cap].every(x => typeof x === "number" && Number.isFinite(x) && x >= 0)) {
      throw new Error("Invalid alchemy refinement amount, gain, or cap");
    }
    // The previous behavior preserves an existing balance above its cap.
    if (amount >= cap) return amount;
    if (gain >= cap - amount) return cap;
    return amount + gain;
  },
  // Refined glyphs give this proportion of their maximum attainable value from their level
  glyphRefinementEfficiency: 0.05,
  glyphRawRefinementGain(glyph) {
    if (!Ra.unlocks.unlockGlyphAlchemy.canBeApplied) return 0;
    const glyphMaxValue = this.levelRefinementValue(glyph.level);
    const rarityModifier = strengthToRarity(glyph.strength) / 100;
    const extraEffects = Ra.unlocks.alchemyCapIncrease.effectOrDefault(1);
    // Alchemy resources are stored as native Numbers, with a finite game cap.
    // Cap the Decimal result BEFORE converting to Number (not after Infinity).
    return this.finiteRefinementNumber(new Decimal(glyphMaxValue).times(this.glyphRefinementEfficiency)
      .times(rarityModifier).times(extraEffects), Ra.alchemyResourceCap, "raw glyph refinement");
  },
  glyphRefinementGain(glyph) {
    if (!Ra.unlocks.unlockGlyphAlchemy.canBeApplied || !generatedTypes.includes(glyph.type)) return 0;
    const resource = this.glyphAlchemyResource(glyph);
    if (!resource.isUnlocked) return 0;
    const glyphActualValue = this.glyphRawRefinementGain(glyph);
    if (resource.cap === 0) return glyphActualValue;
    const amountUntilCap = this.glyphEffectiveCap(glyph) - resource.amount;
    return Math.clamp(amountUntilCap, 0, glyphActualValue);
  },
  // The glyph that is being refined can increase the cap, which means the effective cap
  // will be the current resource cap or the cap after this glyph is refined, whichever is higher.
  glyphEffectiveCap(glyph) {
    const resource = this.glyphAlchemyResource(glyph);
    const currentCap = resource.cap;
    const capAfterRefinement = this.highestRefinementValue(glyph);
    const higherCap = Math.clampMin(currentCap, capAfterRefinement);
    return Math.clampMax(higherCap, Ra.alchemyResourceCap);
  },
  highestRefinementValue(glyph) {
    return this.finiteRefinementNumber(new Decimal(this.glyphRawRefinementGain(glyph))
      .div(this.glyphRefinementEfficiency), Ra.alchemyResourceCap, "highest glyph refinement");
  },
  attemptRefineGlyph(glyph, force) {
    if (glyph.type === "reality") return;
    if (glyph.type === "cursed") {
      Glyphs.removeFromInventory(glyph);
      return;
    }
    const decoherence = AlchemyResource.decoherence.isUnlocked;
    if (!Ra.unlocks.unlockGlyphAlchemy.canBeApplied ||
        (this.glyphRefinementGain(glyph) === 0 && !decoherence) ||
        (decoherence && AlchemyResources.base.every(x => x.data.amount >= Ra.alchemyResourceCap))) {
      this.sacrificeGlyph(glyph, force);
      return;
    }

    if (!player.options.confirmations.glyphRefine || force) {
      this.refineGlyph(glyph);
      return;
    }
    const resource = this.glyphAlchemyResource(glyph);
    Modal.glyphRefine.show({
      idx: glyph.idx,
      resourceName: resource.name,
      resourceAmount: resource.amount,
      gain: this.glyphRefinementGain(glyph),
      cap: resource.cap
    });

  },
  refineGlyph(glyph) {
    if (Pelle.isDoomed) return;
    const resource = this.glyphAlchemyResource(glyph);
    // This technically completely trashes the glyph for no rewards if not unlocked, but this will only happen ever
    // if the player specificially tries to do so (in which case they're made aware that it's useless) or if the
    // Reality choices contain *only* locked glyph choices. That's a rare enough edge case that I think it's okay
    // to just delete it instead of complicating the program flow more than it already is by attempting sacrifice.
    if (!resource.isUnlocked) {
      Glyphs.removeFromInventory(glyph);
      return;
    }
    const rawRefinementGain = this.glyphRawRefinementGain(glyph);
    const refinementGain = this.glyphRefinementGain(glyph);
    // Keep a pre-existing balance above the current cap unchanged.
    const maxResource = Math.max(this.glyphEffectiveCap(glyph), resource.amount);
    resource.amount = this.addRefinementToCap(resource.amount, refinementGain, maxResource);
    const decoherenceGain = this.finiteRefinementNumber(new Decimal(rawRefinementGain)
      .times(AlchemyResource.decoherence.effectValue), Ra.alchemyResourceCap, "decoherence");
    for (const glyphTypeName of ALCHEMY_BASIC_GLYPH_TYPES) {
      if (glyphTypeName !== glyph.type) {
        const glyphType = GlyphTypes[glyphTypeName];
        const otherResource = AlchemyResources.all[glyphType.alchemyResource];
        const maxResource = Math.max(otherResource.cap, otherResource.amount);
        // Compare against remaining room before adding; never write Infinity.
        otherResource.amount = this.addRefinementToCap(otherResource.amount, decoherenceGain, maxResource);
      }
    }
    if (resource.isBaseResource) {
      resource.highestRefinementValue = this.highestRefinementValue(glyph);
    }
    Glyphs.removeFromInventory(glyph);
  }
};

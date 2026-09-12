# Canonical data dictionary work

DEV-001 defines the dictionary; DEV-003 implements runtime schemas. Only operational health/readiness contracts exist today.

Define, at minimum: instrument and exchange aliases/ISIN; source and usage rights; raw document; observation with currency/unit/scale, effective/observed/retrieved time and revision lineage; event with fact/scenario type; evidence-backed causal edge; account/position/lot/transaction; goal and disclosed assumption; suitability profile; immutable policy result.

Decide exact-decimal representation, rounding and reconciliation tolerance before financial calculations. Distinguish percentage from percentage points, annualised from period return, nominal from real, preliminary from revised/final, and source-reported from calculated values. Multi-goal instances must not use goal type as identity.

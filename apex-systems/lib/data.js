// Mock records for three of Apex's existing systems of record. Each keeps the shape and quirks of the
// product it stands in for, because the app has to cope with that mess in real life:
//  - ERP (SAP S/4HANA): OData-style envelopes, SAP material numbers, uppercase text, YYYYMMDD dates.
//  - QMS (Veeva Vault QMS): snake_case fields with __v / __c suffixes and picklist values.
//  - Regulatory (SAP EHS / Sphera-style compliance service): camelCase, ISO dates, notice periods per market.
// Apex is fictional; so are these records. One raw material per open or recent supplier-change case.

// [material, description, supplier id, supplier name, supply end]
const materials = [
  ["MAT-000417", "BINDER X-17 ACRYLIC", "V-20931", "MERIDIAN SPECIALTY MATERIALS", "20270228"],
  ["MAT-000615", "PIGMENT PB-15:3 PHTHALO BLUE", "V-31877", "SUNFIELD COLOURS", "20270115"],
  ["MAT-000502", "RESIN R-50 POLYAMIDE", "V-20931", "MERIDIAN SPECIALTY MATERIALS", "20270131"],
  ["MAT-000312", "TALC T-12 MICRONISED", "V-41120", "NORDIC MINERALS", "20270331"],
  ["MAT-000508", "SLIP AGENT E-8 ERUCAMIDE", "V-18402", "HALVORSEN CHEMIE", "20270215"],
  ["MAT-000505", "UV ABSORBER UV-5 BENZOTRIAZOLE", "V-27765", "BRIGHTWATER CHEMICALS", "20270331"],
  ["MAT-000210", "WAX W-210 POLYETHYLENE", "V-30115", "NORDHAVN WAXES", "20261231"],
  ["MAT-000309", "SILICA SX-9 PRECIPITATED", "V-22604", "CORVANE INDUSTRIAL", "20261205"],
  ["MAT-000683", "PIGMENT PY-83 DIARYLIDE YELLOW", "V-31877", "SUNFIELD COLOURS", "20261215"],
  ["MAT-000404", "DISPERSANT PD-4 POLYMERIC", "V-18402", "HALVORSEN CHEMIE", "20261021"],
  ["MAT-000112", "ANTIOXIDANT AO-12 PHENOLIC", "V-22604", "CORVANE INDUSTRIAL", "20260930"],
];

// SAP product hierarchy (top level) by product family: 4xx coatings, 7xx inks, the rest plastics additives.
const hierarchy = id => (/^FG-4/.test(id) ? "COATINGS" : /^FG-7/.test(id) ? "INKS" : "PLASTICS");

// [finished good, description, plant, sales org, components (material: description)]
const goods = [
  ["FG-420-US", "AEROSHIELD 420 PROTECTIVE COATING", "US10", "US01", { "MAT-000417": "BINDER X-17 ACRYLIC", "MAT-000102": "TITANIUM DIOXIDE R-9" }],
  ["FG-420-EU", "AEROSHIELD 420 PROTECTIVE COATING (EU)", "NL20", "EU01", { "MAT-000417": "BINDER X-17 ACRYLIC", "MAT-000102": "TITANIUM DIOXIDE R-9" }],
  ["FG-088-US", "FLEXADD 88 PLASTIC ADDITIVE", "US10", "US01", { "MAT-000233": "CARRIER RESIN CR-5", "MAT-000418": "BINDER X-17P PLASTICS GRADE" }],
  ["FG-710-US", "COBALT 710 PACKAGING INK", "US30", "US01", { "MAT-000615": "PIGMENT PB-15:3 PHTHALO BLUE", "MAT-000502": "RESIN R-50 POLYAMIDE" }],
  ["FG-710-EU", "COBALT 710 PACKAGING INK (EU)", "NL20", "EU01", { "MAT-000615": "PIGMENT PB-15:3 PHTHALO BLUE", "MAT-000502": "RESIN R-50 POLYAMIDE" }],
  ["FG-725-US", "NAVY 725 SHEETFED INK", "US30", "US01", { "MAT-000616": "PIGMENT PB-15:4 PHTHALO BLUE", "MAT-000503": "RESIN R-52 ROSIN ESTER" }],
  ["FG-730-US", "FLEXOBOND 730 LAMINATING INK", "US30", "US01", { "MAT-000502": "RESIN R-50 POLYAMIDE", "MAT-000683": "PIGMENT PY-83 DIARYLIDE YELLOW" }],
  ["FG-150-US", "POLYFILL 150 MASTERBATCH", "US20", "US01", { "MAT-000312": "TALC T-12 MICRONISED", "MAT-000233": "CARRIER RESIN CR-5" }],
  ["FG-150-EU", "POLYFILL 150 MASTERBATCH (EU)", "DE40", "EU01", { "MAT-000312": "TALC T-12 MICRONISED", "MAT-000233": "CARRIER RESIN CR-5" }],
  ["FG-160-US", "GLIDE 160 FILM ADDITIVE", "US20", "US01", { "MAT-000508": "SLIP AGENT E-8 ERUCAMIDE" }],
  ["FG-160-EU", "GLIDE 160 FILM ADDITIVE (EU)", "DE40", "EU01", { "MAT-000508": "SLIP AGENT E-8 ERUCAMIDE" }],
  ["FG-170-US", "SUNGUARD 170 UV MASTERBATCH", "US20", "US01", { "MAT-000505": "UV ABSORBER UV-5 BENZOTRIAZOLE", "MAT-000112": "ANTIOXIDANT AO-12 PHENOLIC" }],
  ["FG-170-EU", "SUNGUARD 170 UV MASTERBATCH (EU)", "DE40", "EU01", { "MAT-000505": "UV ABSORBER UV-5 BENZOTRIAZOLE", "MAT-000112": "ANTIOXIDANT AO-12 PHENOLIC" }],
  ["FG-175-US", "SUNGUARD 175 HALS MASTERBATCH", "US20", "US01", { "MAT-000506": "HALS STABILISER H-2" }],
  ["FG-440-US", "SATINCOAT 440 WOOD FINISH", "US10", "US01", { "MAT-000210": "WAX W-210 POLYETHYLENE", "MAT-000404": "DISPERSANT PD-4 POLYMERIC" }],
  ["FG-440-EU", "SATINCOAT 440 WOOD FINISH (EU)", "NL20", "EU01", { "MAT-000210": "WAX W-210 POLYETHYLENE", "MAT-000404": "DISPERSANT PD-4 POLYMERIC" }],
  ["FG-450-US", "MATTEX 450 CLEAR COAT", "US10", "US01", { "MAT-000309": "SILICA SX-9 PRECIPITATED" }],
  ["FG-450-EU", "MATTEX 450 CLEAR COAT (EU)", "NL20", "EU01", { "MAT-000309": "SILICA SX-9 PRECIPITATED" }],
  ["FG-720-US", "SUNBURST 720 PACKAGING INK", "US30", "US01", { "MAT-000683": "PIGMENT PY-83 DIARYLIDE YELLOW" }],
  ["FG-720-EU", "SUNBURST 720 PACKAGING INK (EU)", "NL20", "EU01", { "MAT-000683": "PIGMENT PY-83 DIARYLIDE YELLOW" }],
  ["FG-430-US", "DURACOAT 430 INDUSTRIAL ENAMEL", "US10", "US01", { "MAT-000404": "DISPERSANT PD-4 POLYMERIC", "MAT-000102": "TITANIUM DIOXIDE R-9" }],
  ["FG-430-EU", "DURACOAT 430 INDUSTRIAL ENAMEL (EU)", "NL20", "EU01", { "MAT-000404": "DISPERSANT PD-4 POLYMERIC", "MAT-000102": "TITANIUM DIOXIDE R-9" }],
  ["FG-190-US", "THERMAX 190 STABILISER BLEND", "US20", "US01", { "MAT-000112": "ANTIOXIDANT AO-12 PHENOLIC" }],
];

// Recipe share per finished good and material, for the where-used list.
const recipes = [
  ["MAT-000417", "FG-420-US", "RCP-420-01", "18.5"], ["MAT-000417", "FG-420-EU", "RCP-420-02", "18.5"],
  ["MAT-000615", "FG-710-US", "RCP-710-01", "12.0"], ["MAT-000615", "FG-710-EU", "RCP-710-02", "12.0"],
  ["MAT-000502", "FG-710-US", "RCP-710-01", "31.0"], ["MAT-000502", "FG-710-EU", "RCP-710-02", "31.0"], ["MAT-000502", "FG-730-US", "RCP-730-01", "28.5"],
  ["MAT-000312", "FG-150-US", "RCP-150-01", "60.0"], ["MAT-000312", "FG-150-EU", "RCP-150-02", "60.0"],
  ["MAT-000508", "FG-160-US", "RCP-160-01", "8.0"], ["MAT-000508", "FG-160-EU", "RCP-160-02", "8.0"],
  ["MAT-000505", "FG-170-US", "RCP-170-01", "15.0"], ["MAT-000505", "FG-170-EU", "RCP-170-02", "15.0"],
  ["MAT-000210", "FG-440-US", "RCP-440-01", "4.5"], ["MAT-000210", "FG-440-EU", "RCP-440-02", "4.5"],
  ["MAT-000309", "FG-450-US", "RCP-450-01", "6.0"], ["MAT-000309", "FG-450-EU", "RCP-450-02", "6.0"],
  ["MAT-000683", "FG-720-US", "RCP-720-01", "14.0"], ["MAT-000683", "FG-720-EU", "RCP-720-02", "14.0"], ["MAT-000683", "FG-730-US", "RCP-730-01", "9.0"],
  ["MAT-000404", "FG-430-US", "RCP-430-01", "2.5"], ["MAT-000404", "FG-430-EU", "RCP-430-02", "2.5"], ["MAT-000404", "FG-440-US", "RCP-440-01", "1.5"], ["MAT-000404", "FG-440-EU", "RCP-440-02", "1.5"],
  ["MAT-000112", "FG-190-US", "RCP-190-01", "40.0"], ["MAT-000112", "FG-170-US", "RCP-170-01", "2.0"], ["MAT-000112", "FG-170-EU", "RCP-170-02", "2.0"],
];

const goodById = Object.fromEntries(goods.map(([id, description, plant, salesOrg, components]) => [id, { id, description, plant, salesOrg, components }]));

export const erp = {
  materials: Object.fromEntries(materials.map(([Material, MaterialDescription, Supplier, SupplierName, SupplyEndDate]) =>
    [Material, { Material, MaterialDescription, MaterialGroup: "RAW", Supplier, SupplierName, SupplyEndDate }])),
  // Which finished goods consume a raw material, by recipe and plant.
  whereUsed: recipes.reduce((all, [material, good, Recipe, ShareInRecipePct]) => {
    const g = goodById[good];
    (all[material] ??= []).push({ Recipe, FinishedGood: g.id, FinishedGoodDescription: g.description, Plant: g.plant, SalesOrg: g.salesOrg, ShareInRecipePct });
    return all;
  }, {}),
  finishedGoods: Object.fromEntries(goods.map(([FinishedGood, Description, Plant, SalesOrg, components]) =>
    [FinishedGood, { FinishedGood, Description, Plant, SalesOrg, ProductHierarchy: hierarchy(FinishedGood), Components: Object.entries(components).map(([Material, desc]) => ({ Material, Description: desc })) }])),
};

// [id, name, product, material, grade, region, effective date, scope]
const qualifications = [
  ["QLF-US-14", "AeroShield 420 / Binder X-17 qualification (NA)", "FG-420-US", "MAT-000417", "X-17", "na__c", "2021-03-04", "Qualified with Binder X-17 only. Any change to the binder formulation requires requalification."],
  ["QLF-EU-03", "AeroShield 420 / Binder X-17 qualification (EMEA)", "FG-420-EU", "MAT-000417", "X-17", "emea__c", "2022-06-20", "Qualified for EMEA customers with Binder X-17 only. Formulation changes require requalification and Regulatory review."],
  ["QLF-US-31", "FlexAdd 88 / Carrier resin CR-5 qualification (NA)", "FG-088-US", "MAT-000233", "CR-5", "na__c", "2023-01-11", "Qualified with carrier resin CR-5 and binder grade X-17P. Binder X-17 is not used."],
  ["QLF-US-40", "Cobalt 710 / Pigment PB-15:3 qualification (NA)", "FG-710-US", "MAT-000615", "PB-15:3", "na__c", "2022-02-14", "Qualified with PB-15:3 alpha crystal form. Pigment grade changes require colour and lightfastness retesting."],
  ["QLF-EU-12", "Cobalt 710 / Pigment PB-15:3 qualification (EMEA)", "FG-710-EU", "MAT-000615", "PB-15:3", "emea__c", "2022-09-01", "Qualified for EMEA with PB-15:3 alpha form. Food-contact migration file references this grade."],
  ["QLF-US-41", "Cobalt 710 / Resin R-50 qualification (NA)", "FG-710-US", "MAT-000502", "R-50", "na__c", "2022-02-14", "Qualified with Resin R-50. Resin changes require adhesion and block-resistance testing."],
  ["QLF-EU-13", "Cobalt 710 / Resin R-50 qualification (EMEA)", "FG-710-EU", "MAT-000502", "R-50", "emea__c", "2022-09-01", "Qualified for EMEA with Resin R-50. Resin changes require requalification."],
  ["QLF-US-44", "FlexoBond 730 / Resin R-50 qualification (NA)", "FG-730-US", "MAT-000502", "R-50", "na__c", "2023-05-22", "Qualified with Resin R-50 for laminating use. Resin changes require bond-strength testing."],
  ["QLF-US-22", "PolyFill 150 / Talc T-12 qualification (NA)", "FG-150-US", "MAT-000312", "T-12", "na__c", "2020-11-30", "Qualified with Talc T-12 from the Luleå mine. Packaging format is not part of the qualification."],
  ["QLF-EU-08", "PolyFill 150 / Talc T-12 qualification (EMEA)", "FG-150-EU", "MAT-000312", "T-12", "emea__c", "2021-04-12", "Qualified for EMEA with Talc T-12. Packaging format is not part of the qualification."],
  ["QLF-US-26", "Glide 160 / Slip agent E-8 qualification (NA)", "FG-160-US", "MAT-000508", "E-8", "na__c", "2021-08-09", "Qualified with E-8 made at the Hamburg plant. A production site change requires requalification."],
  ["QLF-EU-09", "Glide 160 / Slip agent E-8 qualification (EMEA)", "FG-160-EU", "MAT-000508", "E-8", "emea__c", "2021-10-18", "Qualified for EMEA with E-8 made at the Hamburg plant. A production site change requires requalification."],
  ["QLF-US-28", "SunGuard 170 / UV absorber UV-5 qualification (NA)", "FG-170-US", "MAT-000505", "UV-5", "na__c", "2022-03-07", "Qualified with UV-5. Additive substitution requires weathering tests."],
  ["QLF-EU-10", "SunGuard 170 / UV absorber UV-5 qualification (EMEA)", "FG-170-EU", "MAT-000505", "UV-5", "emea__c", "2022-07-25", "Qualified for EMEA with UV-5. Additive substitution requires weathering tests and REACH review."],
  ["QLF-US-17", "SatinCoat 440 / Wax W-210 qualification (NA)", "FG-440-US", "MAT-000210", "W-210", "na__c", "2021-01-19", "Qualified with W-210 made at the Aarhus plant. A production site change requires requalification."],
  ["QLF-EU-05", "SatinCoat 440 / Wax W-210 qualification (EMEA)", "FG-440-EU", "MAT-000210", "W-210", "emea__c", "2021-06-03", "Qualified for EMEA with W-210 made at the Aarhus plant. A production site change requires requalification."],
  ["QLF-US-33", "Mattex 450 / Silica SX-9 qualification (NA)", "FG-450-US", "MAT-000309", "SX-9", "na__c", "2023-02-27", "Qualified with Silica SX-9. Packaging format is not part of the qualification."],
  ["QLF-EU-14", "Mattex 450 / Silica SX-9 qualification (EMEA)", "FG-450-EU", "MAT-000309", "SX-9", "emea__c", "2023-06-12", "Qualified for EMEA with Silica SX-9. Packaging format is not part of the qualification."],
  ["QLF-EU-15", "Sunburst 720 / Pigment PY-83 qualification (EMEA)", "FG-720-EU", "MAT-000683", "PY-83", "emea__c", "2022-10-03", "Qualified for EMEA with PY-83. Pigment grade changes require colour retesting."],
  ["QLF-US-38", "Sunburst 720 / Pigment PY-83 qualification (NA)", "FG-720-US", "MAT-000683", "PY-83", "na__c", "2022-05-16", "Qualified with PY-83. Pigment grade changes require colour retesting."],
  ["QLF-US-45", "FlexoBond 730 / Pigment PY-83 qualification (NA)", "FG-730-US", "MAT-000683", "PY-83", "na__c", "2023-05-22", "Qualified with PY-83. Pigment grade changes require colour retesting."],
  ["QLF-US-15", "DuraCoat 430 / Dispersant PD-4 qualification (NA)", "FG-430-US", "MAT-000404", "PD-4", "na__c", "2020-09-14", "Qualified with PD-4 made at the Leverkusen plant. A production site change requires requalification."],
  ["QLF-EU-04", "DuraCoat 430 / Dispersant PD-4 qualification (EMEA)", "FG-430-EU", "MAT-000404", "PD-4", "emea__c", "2021-02-08", "Qualified for EMEA with PD-4 made at the Leverkusen plant. A production site change requires requalification."],
  ["QLF-US-18", "SatinCoat 440 / Dispersant PD-4 qualification (NA)", "FG-440-US", "MAT-000404", "PD-4", "na__c", "2021-01-19", "Qualified with PD-4 made at the Leverkusen plant. A production site change requires requalification."],
  ["QLF-EU-06", "SatinCoat 440 / Dispersant PD-4 qualification (EMEA)", "FG-440-EU", "MAT-000404", "PD-4", "emea__c", "2021-06-03", "Qualified for EMEA with PD-4 made at the Leverkusen plant. A production site change requires requalification."],
  ["QLF-US-20", "Thermax 190 / Antioxidant AO-12 qualification (NA)", "FG-190-US", "MAT-000112", "AO-12", "na__c", "2020-06-22", "Qualified with AO-12. Packaging format is not part of the qualification."],
  ["QLF-US-29", "SunGuard 170 / Antioxidant AO-12 qualification (NA)", "FG-170-US", "MAT-000112", "AO-12", "na__c", "2022-03-07", "Qualified with AO-12. Packaging format is not part of the qualification."],
  ["QLF-EU-11", "SunGuard 170 / Antioxidant AO-12 qualification (EMEA)", "FG-170-EU", "MAT-000112", "AO-12", "emea__c", "2022-07-25", "Qualified for EMEA with AO-12. Packaging format is not part of the qualification."],
];

export const qms = {
  qualifications: qualifications.map(([id, name__v, product__c, material__c, material_grade__c, region__c, effective_date__c, scope__c]) =>
    ({ id, name__v, status__v: "effective__c", product__c, material__c, material_grade__c, region__c, effective_date__c, scope__c })),
};

export const regulatory = {
  rules: [
    { ruleId: "REG-US-02", market: "US", changeType: "FORMULATION", appliesTo: "Coatings, inks and plastic additives", noticeDays: 60, effectiveFrom: "2024-01-01", requirement: "Customer product change notice under contract terms. No agency filing is needed for a raw-material substitution at this level." },
    { ruleId: "REG-EU-07", market: "EU", changeType: "FORMULATION", appliesTo: "Coatings, inks and plastic additives", noticeDays: 90, effectiveFrom: "2023-07-01", requirement: "Notify EMEA customers in writing before a formulation change ships. Regulatory Affairs reviews REACH registration impact first." },
    { ruleId: "REG-US-05", market: "US", changeType: "SITE", appliesTo: "All products", noticeDays: 90, effectiveFrom: "2024-01-01", requirement: "Customer notice for a change of raw-material manufacturing site, with the new site's certificate of analysis." },
    { ruleId: "REG-EU-09", market: "EU", changeType: "SITE", appliesTo: "All products", noticeDays: 120, effectiveFrom: "2023-07-01", requirement: "Notify EMEA customers of a manufacturing site change. Regulatory Affairs confirms the new site's REACH registration covers the substance." },
    { ruleId: "REG-US-08", market: "US", changeType: "PACKAGING", appliesTo: "All products", noticeDays: 0, effectiveFrom: "2024-01-01", requirement: "No customer notice required for a packaging-only change. Update the shipping specification." },
    { ruleId: "REG-EU-11", market: "EU", changeType: "PACKAGING", appliesTo: "All products", noticeDays: 30, effectiveFrom: "2023-07-01", requirement: "Notify EMEA customers of a packaging change that alters handling or labelling. CLP labels must be updated." },
  ],
};

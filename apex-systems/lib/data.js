// Mock records for three of Apex's existing systems of record. Each keeps the shape and quirks of the
// product it stands in for, because the app has to cope with that mess in real life:
//  - ERP (SAP S/4HANA): OData-style envelopes, SAP material numbers, uppercase text, YYYYMMDD dates.
//  - QMS (Veeva Vault QMS): snake_case fields with __v / __c suffixes and picklist values.
//  - Regulatory (SAP EHS / Sphera-style compliance service): camelCase, ISO dates, notice periods per market.
// Apex is fictional; so are these records.

export const erp = {
  materials: {
    "MAT-000417": {
      Material: "MAT-000417",
      MaterialDescription: "BINDER X-17 ACRYLIC",
      MaterialGroup: "RAW-BINDER",
      Supplier: "V-20931",
      SupplierName: "MERIDIAN SPECIALTY MATERIALS",
      SupplyEndDate: "20270228",
    },
  },
  // Which finished goods consume a raw material, by recipe and plant.
  whereUsed: {
    "MAT-000417": [
      { Recipe: "RCP-420-01", FinishedGood: "FG-420-US", FinishedGoodDescription: "AEROSHIELD 420 PROTECTIVE COATING", Plant: "US10", SalesOrg: "US01", ShareInRecipePct: "18.5" },
      { Recipe: "RCP-420-02", FinishedGood: "FG-420-EU", FinishedGoodDescription: "AEROSHIELD 420 PROTECTIVE COATING (EU)", Plant: "NL20", SalesOrg: "EU01", ShareInRecipePct: "18.5" },
    ],
  },
  finishedGoods: {
    "FG-420-US": { FinishedGood: "FG-420-US", Description: "AEROSHIELD 420 PROTECTIVE COATING", Plant: "US10", SalesOrg: "US01", Components: [{ Material: "MAT-000417", Description: "BINDER X-17 ACRYLIC" }, { Material: "MAT-000102", Description: "TITANIUM DIOXIDE R-9" }] },
    "FG-420-EU": { FinishedGood: "FG-420-EU", Description: "AEROSHIELD 420 PROTECTIVE COATING (EU)", Plant: "NL20", SalesOrg: "EU01", Components: [{ Material: "MAT-000417", Description: "BINDER X-17 ACRYLIC" }, { Material: "MAT-000102", Description: "TITANIUM DIOXIDE R-9" }] },
    "FG-088-US": { FinishedGood: "FG-088-US", Description: "FLEXADD 88 PLASTIC ADDITIVE", Plant: "US10", SalesOrg: "US01", Components: [{ Material: "MAT-000233", Description: "CARRIER RESIN CR-5" }, { Material: "MAT-000418", Description: "BINDER X-17P PLASTICS GRADE" }] },
  },
};

export const qms = {
  qualifications: [
    {
      id: "QLF-US-14", name__v: "AeroShield 420 / Binder X-17 qualification (NA)", status__v: "effective__c",
      product__c: "FG-420-US", material__c: "MAT-000417", material_grade__c: "X-17", region__c: "na__c",
      effective_date__c: "2021-03-04", scope__c: "Qualified with Binder X-17 only. Any change to the binder formulation requires requalification.",
    },
    {
      id: "QLF-EU-03", name__v: "AeroShield 420 / Binder X-17 qualification (EMEA)", status__v: "effective__c",
      product__c: "FG-420-EU", material__c: "MAT-000417", material_grade__c: "X-17", region__c: "emea__c",
      effective_date__c: "2022-06-20", scope__c: "Qualified for EMEA customers with Binder X-17 only. Formulation changes require requalification and Regulatory review.",
    },
    {
      id: "QLF-US-31", name__v: "FlexAdd 88 / Carrier resin CR-5 qualification (NA)", status__v: "effective__c",
      product__c: "FG-088-US", material__c: "MAT-000233", material_grade__c: "CR-5", region__c: "na__c",
      effective_date__c: "2023-01-11", scope__c: "Qualified with carrier resin CR-5 and binder grade X-17P. Binder X-17 is not used.",
    },
  ],
};

export const regulatory = {
  rules: [
    {
      ruleId: "REG-US-02", market: "US", changeType: "FORMULATION", appliesTo: "Coatings and plastic additives",
      noticeDays: 60, effectiveFrom: "2024-01-01",
      requirement: "Customer product change notice under contract terms. No agency filing is needed for a binder substitution at this level.",
    },
    {
      ruleId: "REG-EU-07", market: "EU", changeType: "FORMULATION", appliesTo: "Coatings",
      noticeDays: 90, effectiveFrom: "2023-07-01",
      requirement: "Notify EMEA coating customers in writing before a formulation change ships. Regulatory Affairs reviews REACH registration impact first.",
    },
  ],
};

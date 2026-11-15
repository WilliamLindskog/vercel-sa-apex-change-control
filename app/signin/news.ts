import type { StaticImageData } from "next/image";
import brickMill from "@/app/ui/images/brick-mill-tower.jpg";
import paintSwatches from "@/app/ui/images/binder-paint-swatches.jpg";
import rotterdamLab from "@/app/ui/images/rotterdam-lab-flasks.jpg";
import singapore from "@/app/ui/images/singapore-marina-bay.jpg";

// Apex is fictional; so is its news. The Binder X-17 story matches the demo case (SCC-2026-041).
export type Article = {
  slug: string;
  date: string;
  title: string;
  summary: string;
  image: StaticImageData;
  position: string;
  body: string[];
  facts: [string, string][];
};

export const news: Article[] = [
  {
    slug: "binder-x17-change-review",
    date: "12 Nov 2026",
    title: "Binder X-17 change review opens",
    summary: "Meridian is ending X-17. Three coatings products are being checked before anything changes.",
    image: paintSwatches,
    position: "center 18%",
    body: [
      "Meridian Specialty Materials told Apex on 12 November that it will stop making Binder X-17 at the end of February 2027. It proposes X-17R, with a revised stabilizer package, as the replacement.",
      "Three finished coatings use X-17, sold in the US and the EU. Before any switch, Apex checks each one against its qualification records and the notice rules in each market.",
      "Quality decides whether the products need re-testing. Regulatory Affairs decides which customers must be told, and by when. No product changes until both have signed off.",
    ],
    facts: [["Supplier", "Meridian Specialty Materials"], ["Last X-17 delivery", "28 Feb 2027"], ["Products checked", "3, in the US and EU"], ["Case lead", "Dana Okafor"]],
  },
  {
    slug: "rotterdam-reach-update",
    date: "28 Oct 2026",
    title: "Rotterdam lab finishes REACH update",
    summary: "Registration dossiers for 42 additives are now current for the EU.",
    image: rotterdamLab,
    position: "center",
    body: [
      "The Rotterdam regulatory lab has finished updating the REACH dossiers for 42 additives sold in the European Union, two months ahead of plan.",
      "The work brings test data, safety data sheets and use descriptions in line with the latest guidance. Customers in the EU get the updated sheets with their next order.",
      "The same team reviews customer notices for supplier changes that affect EU products.",
    ],
    facts: [["Site", "Rotterdam, NL"], ["Dossiers updated", "42"], ["Finished", "Two months early"], ["Contact", "Marcus Lindqvist"]],
  },
  {
    slug: "cleveland-198-years",
    date: "30 Sep 2026",
    title: "Cleveland marks 198 years",
    summary: "The site that began as a pigment works in 1828 is still Apex's home.",
    image: brickMill,
    position: "center",
    body: [
      "Apex began in 1828 as a small pigment works beside the river in Cleveland. Its first laboratory opened in 1871, and the brick mill tower still stands at the centre of the site.",
      "Today Cleveland is home to the coatings team, the main quality lab and the people who run supplier changes for North America.",
      "Staff and families marked the anniversary with an open day and a walk through the archive.",
    ],
    facts: [["Founded", "1828"], ["First laboratory", "1871"], ["Today", "Coatings, quality, supplier changes"], ["Site", "Cleveland, OH"]],
  },
  {
    slug: "singapore-technical-service",
    date: "4 Sep 2026",
    title: "Singapore technical service expands",
    summary: "A larger team now supports customers across Southeast Asia, in their time zone.",
    image: singapore,
    position: "58% center",
    body: [
      "Apex has doubled its technical service team in Singapore, so customers across Southeast Asia can get formulation help during their own working day.",
      "The team helps with trials, troubleshooting and switching between grades. It works closely with the labs in Cleveland and Rotterdam.",
    ],
    facts: [["Site", "Singapore"], ["Team", "Doubled in size"], ["Covers", "Southeast Asia"], ["Works with", "Cleveland and Rotterdam labs"]],
  },
];

export const findArticle = (slug: string) => news.find(article => article.slug === slug);

// Four roles run a supplier change. The Product Manager leads it end to end; three experts each own one
// assessment, in this order: Technical (lab-scale tests), Quality (production trial and QC tests), Regulatory
// (compliance and customer notices). Names start with their role's letter so a person is never mistaken for a product.
export type ReviewRole = "Technical" | "Quality" | "Regulatory";
export type Role = "Product Manager" | "Lab Manager" | "Production & Quality Control" | "Regulatory Expert";

export const reviewOrder: ReviewRole[] = ["Technical", "Quality", "Regulatory"];
export const reviewerRole: Record<ReviewRole, Role> = { Technical: "Lab Manager", Quality: "Production & Quality Control", Regulatory: "Regulatory Expert" };
export const reviewLabel: Record<ReviewRole, string> = { Technical: "Technical assessment", Quality: "Quality assessment", Regulatory: "Regulatory assessment" };
export const reviewFor = (role: Role) => reviewOrder.find(review => reviewerRole[review] === role) ?? null;

export type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  site: string;
  initials: string;
};

// Demo directory. In production these identities come from Apex's identity provider.
export const users: User[] = [
  { id: "peter", name: "Peter Hansen", email: "peter.hansen@apex.internal", role: "Product Manager", title: "Product Manager, Coatings", site: "Cleveland, OH", initials: "PH" },
  { id: "paula", name: "Paula Romero", email: "paula.romero@apex.internal", role: "Product Manager", title: "Product Manager, Plastics & Inks", site: "Rotterdam, NL", initials: "PR" },
  { id: "lisa", name: "Lisa Chen", email: "lisa.chen@apex.internal", role: "Lab Manager", title: "Lab Manager, Applications Lab", site: "Cleveland, OH", initials: "LC" },
  { id: "quinn", name: "Quinn Patel", email: "quinn.patel@apex.internal", role: "Production & Quality Control", title: "Production & QC, Coatings plant", site: "Cleveland, OH", initials: "QP" },
  { id: "quentin", name: "Quentin Lee", email: "quentin.lee@apex.internal", role: "Production & Quality Control", title: "Production & QC, Plastics & Inks plant", site: "Akron, OH", initials: "QL" },
  { id: "rachel", name: "Rachel Moreau", email: "rachel.moreau@apex.internal", role: "Regulatory Expert", title: "Regulatory Expert, US & EU", site: "Rotterdam, NL", initials: "RM" },
];

export const findUser = (id: string | undefined) => users.find(user => user.id === id);

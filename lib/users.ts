export type ReviewRole = "Quality" | "Regulatory Affairs";
export type Role = "Product Change Lead" | ReviewRole;

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
  { id: "dana", name: "Dana Okafor", email: "dana.okafor@apex.internal", role: "Product Change Lead", title: "Product Change Lead, Coatings", site: "Cleveland, OH", initials: "DO" },
  { id: "priya", name: "Priya Raman", email: "priya.raman@apex.internal", role: "Quality", title: "Quality Manager, Coatings", site: "Cleveland, OH", initials: "PR" },
  { id: "marcus", name: "Marcus Lindqvist", email: "marcus.lindqvist@apex.internal", role: "Regulatory Affairs", title: "Regulatory Affairs, EMEA", site: "Rotterdam, NL", initials: "ML" },
  { id: "ingrid", name: "Ingrid Solberg", email: "ingrid.solberg@apex.internal", role: "Product Change Lead", title: "Product Change Lead, Plastics & Inks", site: "Rotterdam, NL", initials: "IS" },
  { id: "kenji", name: "Kenji Watanabe", email: "kenji.watanabe@apex.internal", role: "Quality", title: "Quality Engineer, Plastics & Inks", site: "Akron, OH", initials: "KW" },
  { id: "lucia", name: "Lucía Fernández", email: "lucia.fernandez@apex.internal", role: "Regulatory Affairs", title: "Regulatory Affairs, Americas", site: "Cleveland, OH", initials: "LF" },
];

export const findUser = (id: string | undefined) => users.find(user => user.id === id);
// Several people can hold a role; each case names its own lead and reviewers (see lib/case.ts).
export const userForRole = (role: Role) => users.find(user => user.role === role)!;

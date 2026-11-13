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
  { id: "dana", name: "Dana Okafor", email: "dana.okafor@apex.internal", role: "Product Change Lead", title: "Product Change Lead", site: "Cleveland, OH", initials: "DO" },
  { id: "priya", name: "Priya Raman", email: "priya.raman@apex.internal", role: "Quality", title: "Quality Engineering Manager", site: "Cleveland, OH", initials: "PR" },
  { id: "marcus", name: "Marcus Lindqvist", email: "marcus.lindqvist@apex.internal", role: "Regulatory Affairs", title: "Regulatory Affairs Specialist, EMEA", site: "Rotterdam, NL", initials: "ML" },
];

export const findUser = (id: string | undefined) => users.find(user => user.id === id);
export const userForRole = (role: Role) => users.find(user => user.role === role)!;

import type { Role } from "@prisma/client";

/**
 * The seeded demo accounts, in one place so that the seed script, the landing
 * page buttons and the README cannot drift apart.
 *
 * A shared, published password is a deliberate choice for a review environment:
 * the point is that anyone opening the deployed link can be inside each role in
 * one click. Nothing here would survive contact with a real deployment, and the
 * README says so.
 */
export const DEMO_PASSWORD = "demo1234";

export type DemoAccount = {
  key: string;
  email: string;
  name: string;
  role: Role;
};

export const DEMO_ACCOUNTS: readonly DemoAccount[] = [
  {
    key: "seller",
    email: "seller@n5deal.demo",
    name: "Marta Kovalenko",
    role: "SELLER",
  },
  {
    key: "buyer",
    email: "buyer@n5deal.demo",
    name: "Anders Holm",
    role: "BUYER",
  },
  {
    key: "manager",
    email: "manager@n5deal.demo",
    name: "Priya Raman",
    role: "MANAGER",
  },
];

export function demoAccountForRole(role: Role): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((a) => a.role === role);
}

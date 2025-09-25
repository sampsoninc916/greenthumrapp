export const ROLES = {
  BUYER: "buyer",
  SELLER: "seller",
  ADMIN: "admin",
};

export const hasRole = (user, role) => user?.roles?.includes(role);

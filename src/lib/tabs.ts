import {
  BookOpenIcon,
  CalendarDaysIcon,
  FolderIcon,
  PackageOpenIcon,
  ShoppingBasketIcon,
} from "lucide-react";

export const tabs = [
  { to: "/", label: "Recipes", icon: BookOpenIcon, end: true },
  { to: "/plan", label: "Plan", icon: CalendarDaysIcon, end: false },
  { to: "/shopping", label: "Shopping", icon: ShoppingBasketIcon, end: false },
  { to: "/pantry", label: "Pantry", icon: PackageOpenIcon, end: false },
  { to: "/collections", label: "Collections", icon: FolderIcon, end: false },
] as const;

export const tabIndex = (path: string) => {
  const trimmed = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return tabs.findIndex((tab) => tab.to === trimmed);
};

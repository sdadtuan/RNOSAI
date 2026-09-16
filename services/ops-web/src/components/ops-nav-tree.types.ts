export type NavChild = {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

export type NavLeaf = {
  kind: 'leaf';
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: number;
};

export type NavParent = {
  kind: 'parent';
  id: string;
  label: string;
  icon: string;
  children: NavChild[];
};

export type NavItem = NavLeaf | NavParent;

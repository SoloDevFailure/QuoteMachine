export type BusinessBranding = {
  companyName: string;
  logoAssetId?: string;
  primaryColor?: string;
  accentColor?: string;
};

// Phase 1 placeholder. A future Business Profile can replace this source
// without changing the Home screen component hierarchy.
export const defaultBusinessBranding: BusinessBranding = {
  companyName: "Your Trade Business",
};

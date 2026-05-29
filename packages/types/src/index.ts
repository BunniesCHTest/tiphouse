export type UserRole = "USER" | "ADMIN";
export type DonationStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "REVIEW";
export type PaymentProvider = "PROMPTPAY" | "OMISE" | "GBPRIMEPAY" | "STRIPE";

export interface PublicDonationPage {
  slug: string;
  displayName: string;
  handle: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  minAmount: number;
  goalAmount: number;
  theme: Record<string, unknown>;
}

export interface CreateDonationRequest {
  pageSlug: string;
  donorName: string;
  message: string;
  amount: number;
  anonymous: boolean;
  provider: PaymentProvider;
}

export interface DonationAlertPayload {
  donationId: string;
  donorName: string;
  amount: number;
  message: string;
  anonymous: boolean;
  avatarUrl?: string | null;
  soundUrl?: string | null;
  createdAt: string;
}

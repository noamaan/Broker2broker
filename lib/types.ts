export type Role = "USER" | "ADMIN" | "DEVELOPER";
export type CurrentUser = {
  userID: string;
  fullName: string;
  mobile: string;
  email: string;
  agencyName: string;
  whatsappNumber: string;
  city: string;
  preferredLocalities: string[];
  role: Role;
  accountStatus: string;
  membershipStatus: string;
  currentPlan: string;
  membershipStartAt: string;
  membershipExpiresAt: string;
  createdAt: string;
  brokerProfile?: Record<string, unknown>;
  maintenanceMode?: boolean;
};
export type Listing = {
  isPublic?: boolean; listingID: string; ownerID: string; title: string; transactionType: string; propertyType: string; bhk: string; city: string; locality: string; landmark: string; carpetArea: string; builtUpArea: string; furnishing: string; floor: string; amenities: string[]; price: number; rent: number; deposit: number; availability: string; tenantPreference: string; contactNumbers: string[]; description: string; originalText: string; images: string[]; status: string; availabilityConfirmedAt: string; reconfirmDueAt: string; createdAt: string; updatedAt: string; broker?: {userID:string;fullName:string;agencyName:string;city:string;isVerified:boolean;bio:string}; needsReconfirmation?: boolean;
};
export type PaymentRequest = {requestID:string;userID:string;fullName:string;mobile:string;email:string;agencyName:string;subscriptionPlan:string;amount:number;upiTransactionID:string;paymentDate:string;requestDate:string;status:string;adminNotes:string;approvedBy:string;approvalDate:string;screenshotFileID:string;durationDays:number;whatsappNumber:string};

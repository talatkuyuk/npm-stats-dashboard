export interface PackageStats {
  name: string;
  version: string;
  weeklyDownloads: number;
  dependents: number;
  githubStars: number;
  openIssues: number;
  lastChecked: string | null;
  npmUrl: string;
  repoUrl: string | null;
  previousStats?: {
    weeklyDownloads: number;
    githubStars: number;
    openIssues: number;
  };
  // Add loading states for progressive loading
  isLoadingGithubData?: boolean;
  // Add failure tracking
  githubFetchFailed?: boolean;
  // Add diff properties for historical comparison
  previousWeeklyDownloads?: number;
  previousGithubStars?: number;
  previousOpenIssues?: number;
}

export interface UserPackages {
  username: string;
  packages: PackageStats[];
  totalDownloads: number;
  totalStars: number;
  isLoadingGithubData?: boolean;
  // Add historical totals for comparison
  previousTotalDownloads?: number;
  previousTotalStars?: number;
}

export interface User {
  sub: string; // Auth0 user ID
  email?: string;
  picture?: string;
  name?: string;
  nickname?: string;
}

export interface UserSubscription {
  userId: string;
  isPaid: boolean;
  planType: "free" | "pro";
  subscriptionId?: string;
  expiresAt?: string;
}

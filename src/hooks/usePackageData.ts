import { useState, useCallback } from "react";
import { UserPackages, PackageStats } from "../types";

interface UsePackageDataReturn {
  userStats: UserPackages | null;
  setUserStats: React.Dispatch<React.SetStateAction<UserPackages | null>>;
  loading: boolean;
  noPackagesFound: boolean;
  failureStats: { total: number; failed: number };
  retryingPackages: Set<string>;
  rateLimitInfo: {
    isLimited: boolean;
    resetTime: number | null;
    message: string | null;
  };
  setFailureStats: React.Dispatch<
    React.SetStateAction<{ total: number; failed: number }>
  >;
  setRetryingPackages: React.Dispatch<React.SetStateAction<Set<string>>>;
  setRateLimitInfo: React.Dispatch<
    React.SetStateAction<{
      isLimited: boolean;
      resetTime: number | null;
      message: string | null;
    }>
  >;
  handleSearch: (searchTerm: string) => Promise<void>;
  handleClearSearch: () => void;
  retryPackageGithubData: (packageName: string) => Promise<void>;
  retryAllFailedFetches: () => Promise<void>;
}

export function usePackageData(
  isLoggedIn: boolean,
  user: any,
  packageLimit: number
): UsePackageDataReturn {
  const [userStats, setUserStats] = useState<UserPackages | null>(null);
  const [loading, setLoading] = useState(false);
  const [noPackagesFound, setNoPackagesFound] = useState(false);
  const [failureStats, setFailureStats] = useState({ total: 0, failed: 0 });
  const [retryingPackages, setRetryingPackages] = useState<Set<string>>(
    new Set()
  );
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    isLimited: boolean;
    resetTime: number | null;
    message: string | null;
  }>({ isLimited: false, resetTime: null, message: null });

  // Function to fetch historical data
  const fetchHistoricalData = async (
    auth0UserId: string,
    npmUsername: string
  ) => {
    try {
      const response = await fetch(
        `/api/user-stats-history?githubUserId=${encodeURIComponent(
          auth0UserId
        )}&npmUsername=${encodeURIComponent(npmUsername)}`
      );

      if (response.ok) {
        const result = await response.json();
        console.log(`📊 Historical data fetched:`, result);
        return result.data || null;
      } else {
        console.log(`📊 No historical data available`);
        return null;
      }
    } catch (error) {
      console.error("Error fetching historical data:", error);
      return null;
    }
  };

  // Function to save current data with enhanced structure
  const saveCurrentData = async (
    auth0UserId: string,
    npmUsername: string,
    userStats: UserPackages
  ) => {
    try {
      // Create enhanced data structure for storage
      const dataToSave = {
        packages: userStats.packages,
        totalDownloads: userStats.totalDownloads,
        totalStars: userStats.totalStars,
        packageCount: userStats.packages.length,
        timestamp: new Date().toISOString(),
        username: npmUsername,
      };

      const response = await fetch("/api/user-stats-history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          githubUserId: auth0UserId,
          npmUsername,
          data: dataToSave,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log(
          `💾 Enhanced data saved successfully for date: ${result.date}`
        );
        return true;
      } else {
        console.error("Failed to save data:", await response.text());
        return false;
      }
    } catch (error) {
      console.error("Error saving data:", error);
      return false;
    }
  };

  // Function to retry failed GitHub fetches for a specific package
  const retryPackageGithubData = useCallback(async (packageName: string) => {
    console.log(`🔄 Retrying GitHub data for: ${packageName}`);

    setRetryingPackages((prev) => new Set(prev).add(packageName));

    try {
      const url = `/api/github-stats?package=${encodeURIComponent(
        packageName
      )}`;
      const response = await fetch(url);

      if (response.ok) {
        const githubData = await response.json();
        console.log(`✅ Retry success for ${packageName}:`, githubData);

        // Update the specific package in state
        setUserStats((prevStats) => {
          if (!prevStats) return null;

          const updatedPackages = prevStats.packages.map((pkg) => {
            if (pkg.name === packageName) {
              const updatedPkg = {
                ...pkg,
                githubStars: githubData.stars || 0,
                openIssues: githubData.openIssues || 0,
                repoUrl: githubData.repoUrl || pkg.repoUrl,
                githubFetchFailed: false,
              };
              return updatedPkg;
            }
            return pkg;
          });

          // Recalculate total stars
          const newTotalStars = updatedPackages.reduce(
            (sum, pkg) => sum + pkg.githubStars,
            0
          );

          return {
            ...prevStats,
            packages: updatedPackages,
            totalStars: newTotalStars,
          };
        });

        // Update failure stats
        setFailureStats((prev) => ({
          ...prev,
          failed: Math.max(0, prev.failed - 1),
        }));
      } else if (response.status === 429) {
        // Handle rate limiting
        const errorData = await response.json().catch(() => ({}));
        console.log(`🚫 Rate limited retry for ${packageName}:`, errorData);

        if (errorData.resetTime) {
          setRateLimitInfo({
            isLimited: true,
            resetTime: errorData.resetTime,
            message: errorData.details || "GitHub API rate limit exceeded",
          });
        }
      } else {
        console.log(`❌ Retry failed for ${packageName}: ${response.status}`);
      }
    } catch (error) {
      console.error(`💥 Retry error for ${packageName}:`, error);
    } finally {
      setRetryingPackages((prev) => {
        const newSet = new Set(prev);
        newSet.delete(packageName);
        return newSet;
      });
    }
  }, []);

  // Function to load GitHub data progressively with failure handling
  const loadGithubDataProgressively = async (
    packages: PackageStats[],
    username: string
  ) => {
    console.log("🔄 Starting progressive GitHub data loading...");

    const batchSize = 2; // Smaller batches to be more respectful of rate limits
    let stats = { total: packages.length, failed: 0 };
    setFailureStats(stats);

    for (let i = 0; i < packages.length; i += batchSize) {
      const batch = packages.slice(i, i + batchSize);
      console.log(
        `📦 Processing GitHub batch ${
          Math.floor(i / batchSize) + 1
        }/${Math.ceil(packages.length / batchSize)}`
      );

      // Process batch in parallel with retry logic
      const batchResults = await Promise.all(
        batch.map(async (pkg) => {
          let attempts = 0;
          const maxAttempts = 2; // Allow 1 retry

          while (attempts < maxAttempts) {
            attempts++;

            try {
              const url = `/api/github-stats?package=${encodeURIComponent(
                pkg.name
              )}`;
              console.log(
                `🔍 Attempt ${attempts}/${maxAttempts} for ${pkg.name}`
              );

              const response = await fetch(url);

              if (response.ok) {
                const githubData = await response.json();
                console.log(
                  `✅ Frontend received GitHub data for ${pkg.name}:`,
                  githubData
                );

                const updatedPkg = {
                  ...pkg,
                  githubStars: githubData.stars || 0,
                  openIssues: githubData.openIssues || 0,
                  repoUrl: githubData.repoUrl || pkg.repoUrl,
                  isLoadingGithubData: false,
                  githubFetchFailed: false,
                };

                return updatedPkg;
              } else if (response.status === 429) {
                // Handle rate limiting
                const errorData = await response.json().catch(() => ({}));
                console.log(`🚫 Rate limited for ${pkg.name}:`, errorData);

                if (errorData.resetTime) {
                  setRateLimitInfo({
                    isLimited: true,
                    resetTime: errorData.resetTime,
                    message:
                      errorData.details || "GitHub API rate limit exceeded",
                  });
                }

                // Don't retry on rate limit - mark as failed
                break;
              } else if (response.status === 403) {
                // Handle different HTTP error codes
                const errorData = await response.json().catch(() => ({}));
                console.log(
                  `❌ HTTP ${response.status} for ${pkg.name}: ${
                    errorData.error || "Unknown error"
                  }`
                );

                // Rate limit - wait longer before retry
                if (attempts < maxAttempts) {
                  console.log(
                    `⏳ Rate limited, waiting before retry for ${pkg.name}...`
                  );
                  await new Promise((resolve) => setTimeout(resolve, 2000));
                  continue;
                }

                // If we get here, we've exhausted retries or hit a non-retryable error
                break;
              } else if (response.status >= 500) {
                // Server error - retry
                if (attempts < maxAttempts) {
                  console.log(`🔄 Server error, retrying for ${pkg.name}...`);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                  continue;
                }

                // If we get here, we've exhausted retries or hit a non-retryable error
                break;
              }
            } catch (error) {
              console.error(
                `💥 Network error for ${pkg.name} (attempt ${attempts}):`,
                error
              );

              if (attempts < maxAttempts) {
                console.log(`🔄 Network error, retrying for ${pkg.name}...`);
                await new Promise((resolve) => setTimeout(resolve, 1000));
                continue;
              }
            }
          }

          // If we get here, all attempts failed
          console.log(`🚫 All attempts failed for ${pkg.name}`);
          stats.failed++;

          return {
            ...pkg,
            isLoadingGithubData: false,
            githubFetchFailed: true,
          };
        })
      );

      // Update the state with the new batch data
      setUserStats((prevStats) => {
        if (!prevStats) return null;

        const updatedPackages = prevStats.packages.map((pkg) => {
          const updatedPkg = batchResults.find(
            (result) => result.name === pkg.name
          );
          return updatedPkg || pkg;
        });

        // Calculate new total stars
        const newTotalStars = updatedPackages.reduce(
          (sum, pkg) => sum + pkg.githubStars,
          0
        );

        // Check if all packages are done loading
        const stillLoading = updatedPackages.some(
          (pkg) => pkg.isLoadingGithubData
        );

        return {
          ...prevStats,
          packages: updatedPackages,
          totalStars: newTotalStars,
          isLoadingGithubData: stillLoading,
        };
      });

      // Update failure stats
      setFailureStats({ ...stats });

      // Add delay between batches to avoid overwhelming APIs
      if (i + batchSize < packages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(
      `🎉 Progressive GitHub data loading completed. Failed: ${stats.failed}/${stats.total}`
    );

    // Save data to Redis if user is logged in and all loading is complete
    if (isLoggedIn && user && userStats) {
      console.log(`💾 Saving enhanced data to Redis for user ${user.sub}`);
      await saveCurrentData(user.sub, userStats.username, userStats);
    }
  };

  // Function to retry all failed GitHub fetches
  const retryAllFailedFetches = useCallback(async () => {
    if (!userStats) return;

    const failedPackages = userStats.packages.filter(
      (pkg) => pkg.githubFetchFailed
    );
    console.log(
      `🔄 Retrying ${failedPackages.length} failed GitHub fetches...`
    );

    // Process retries in small batches to avoid overwhelming the API
    const batchSize = 2;
    for (let i = 0; i < failedPackages.length; i += batchSize) {
      const batch = failedPackages.slice(i, i + batchSize);

      await Promise.all(batch.map((pkg) => retryPackageGithubData(pkg.name)));

      // Add delay between batches
      if (i + batchSize < failedPackages.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    console.log(`✅ Completed retry for all failed fetches`);
  }, [userStats, retryPackageGithubData]);

  // Handle search - now receives searchTerm from SearchForm
  const handleSearch = useCallback(
    async (searchTerm: string) => {
      setLoading(true);
      setUserStats(null);
      setNoPackagesFound(false);
      setFailureStats({ total: 0, failed: 0 });
      setRetryingPackages(new Set());
      setRateLimitInfo({ isLimited: false, resetTime: null, message: null });

      try {
        console.log("Searching for username:", searchTerm);
        const response = await fetch(
          `/api/stats?username=${encodeURIComponent(searchTerm)}`
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log("Received initial data:", data);

        // Check if no packages were found
        if (!data.packages || data.packages.length === 0) {
          setNoPackagesFound(true);
          setLoading(false);
          return;
        }

        // Apply package limit
        const limitedPackages = data.packages.slice(0, packageLimit);
        console.log(
          `📦 Limiting packages to ${packageLimit}: ${data.packages.length} -> ${limitedPackages.length}`
        );

        // Fetch historical data if user is logged in
        let historicalData: any = null;
        if (isLoggedIn && user) {
          console.log(`📊 Fetching historical data for user ${user.sub}`);
          historicalData = await fetchHistoricalData(user.sub, searchTerm);
        }

        // Set initial data with loading states and historical comparison
        const initialPackages = limitedPackages.map((pkg: any) => {
          // Find historical data for this package
          const historicalPkg = historicalData?.packages?.find(
            (h: any) => h.name === pkg.name
          );

          return {
            ...pkg,
            isLoadingGithubData: true,
            githubFetchFailed: false,
            // Add historical data for comparison (only if package exists in historical data)
            previousWeeklyDownloads: historicalPkg?.weeklyDownloads,
            previousGithubStars: historicalPkg?.githubStars,
            previousOpenIssues: historicalPkg?.openIssues,
          };
        });

        const initialUserStats = {
          ...data,
          packages: initialPackages,
          totalStars: 0,
          isLoadingGithubData: true,
          // Add historical totals for comparison
          previousTotalDownloads: historicalData?.totalDownloads,
          previousTotalStars: historicalData?.totalStars,
        };

        setUserStats(initialUserStats);
        setLoading(false);

        // Start loading GitHub data progressively
        loadGithubDataProgressively(initialPackages, searchTerm);
      } catch (error) {
        console.error("Failed to fetch user stats:", error);
        setLoading(false);
        // Re-throw error so SearchForm can handle it
        throw error;
      }
    },
    [isLoggedIn, user, packageLimit]
  );

  // Clear search and reset everything
  const handleClearSearch = useCallback(() => {
    setUserStats(null);
    setNoPackagesFound(false);
    setFailureStats({ total: 0, failed: 0 });
    setRetryingPackages(new Set());
    setRateLimitInfo({ isLimited: false, resetTime: null, message: null });
  }, []);

  return {
    userStats,
    setUserStats,
    loading,
    noPackagesFound,
    failureStats,
    retryingPackages,
    rateLimitInfo,
    setFailureStats,
    setRetryingPackages,
    setRateLimitInfo,
    handleSearch,
    handleClearSearch,
    retryPackageGithubData,
    retryAllFailedFetches,
  };
}

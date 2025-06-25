import React, { useState, useEffect, useCallback } from "react";
import {
  Search,
  Star,
  Download,
  AlertCircle,
  User,
  ExternalLink,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Package,
  RefreshCw,
  XCircle,
  GripVertical,
  RotateCcw,
  Tag,
  Clock,
} from "lucide-react";
import { UserPackages, PackageStats } from "./types";
import { ShimmerCell } from "./components/ShimmerCell";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthStatus } from "./components/AuthStatus";
import { PlanIndicator } from "./components/PlanIndicator";
import { FeaturePromotion } from "./components/FeaturePromotion";
import { DiffDisplay } from "./components/DiffDisplay";
import { AdSidebar, GoogleAd } from "./components/GoogleAds";
import { useAuth } from "./contexts/AuthContext";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
} from "@tanstack/react-table";
import "./styles/global.css";

function App() {
  const { user, subscription } = useAuth();
  const [userStats, setUserStats] = useState<UserPackages | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noPackagesFound, setNoPackagesFound] = useState(false);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [failureStats, setFailureStats] = useState({ total: 0, failed: 0 });
  const [retryingPackages, setRetryingPackages] = useState<Set<string>>(
    new Set()
  );
  const [rateLimitInfo, setRateLimitInfo] = useState<{
    isLimited: boolean;
    resetTime: number | null;
    message: string | null;
  }>({ isLimited: false, resetTime: null, message: null });

  // Local state for filter inputs
  const [nameFilter, setNameFilter] = useState("");
  const [downloadsFilter, setDownloadsFilter] = useState("");
  const [starsFilter, setStarsFilter] = useState("");

  // Get user subscription info
  const isLoggedIn = !!user;
  const isPaid = subscription?.isPaid || false;
  const packageLimit = isLoggedIn ? (isPaid ? Infinity : 100) : 20;

  // Fixed: Use PackageStats type instead of broken Package type
  const columnHelper = createColumnHelper<PackageStats>();

  // Debounced filter update for package name
  const debouncedUpdateNameFilter = useCallback(
    debounce((value: string) => {
      setColumnFilters((prev) =>
        prev
          .filter((filter) => filter.id !== "name")
          .concat(value ? [{ id: "name", value }] : [])
      );
    }, 300),
    []
  );

  // Update name filter with debouncing
  useEffect(() => {
    debouncedUpdateNameFilter(nameFilter);
  }, [nameFilter, debouncedUpdateNameFilter]);

  // Update numeric filters immediately
  useEffect(() => {
    setColumnFilters((prev) => {
      let newFilters = prev.filter(
        (filter) =>
          filter.id !== "weeklyDownloads" && filter.id !== "githubStars"
      );

      if (downloadsFilter) {
        const value = parseInt(downloadsFilter);
        if (!isNaN(value)) {
          newFilters.push({ id: "weeklyDownloads", value });
        }
      }

      if (starsFilter) {
        const value = parseInt(starsFilter);
        if (!isNaN(value)) {
          newFilters.push({ id: "githubStars", value });
        }
      }

      return newFilters;
    });
  }, [downloadsFilter, starsFilter]);

  // Custom sorting handler for three-state sorting
  const handleColumnSort = (columnId: string) => {
    setSorting((prev) => {
      const existingSort = prev.find((sort) => sort.id === columnId);

      if (!existingSort) {
        // No current sort -> ascending
        return [{ id: columnId, desc: false }];
      } else if (!existingSort.desc) {
        // Currently ascending -> descending
        return [{ id: columnId, desc: true }];
      } else {
        // Currently descending -> no sort (remove from sorting)
        return prev.filter((sort) => sort.id !== columnId);
      }
    });
  };

  // Helper function to get sort state for display
  const getSortState = (columnId: string) => {
    const sort = sorting.find((s) => s.id === columnId);
    if (!sort) return "none";
    return sort.desc ? "desc" : "asc";
  };

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
  const retryPackageGithubData = async (packageName: string) => {
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
        console.log(`🔍 Retry data structure:`, {
          stars: githubData.stars,
          openIssues: githubData.openIssues,
          repoUrl: githubData.repoUrl,
        });

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
              console.log(`🔄 Retry update for ${packageName}:`, {
                before: { stars: pkg.githubStars, issues: pkg.openIssues },
                after: {
                  stars: updatedPkg.githubStars,
                  issues: updatedPkg.openIssues,
                },
              });
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
  };

  // Function to retry all failed GitHub fetches
  const retryAllFailedFetches = async () => {
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
  };

  // Reset table layout to defaults
  const resetTableLayout = () => {
    setColumnOrder([]);
    setColumnSizing({});
    setSorting([]);
    setColumnFilters([]);

    // Clear filter inputs
    setNameFilter("");
    setDownloadsFilter("");
    setStarsFilter("");
  };

  // Clear search and reset everything
  const handleClearSearch = () => {
    setUserStats(null);
    setNoPackagesFound(false);
    setError(null);
    setSearchTerm("");
    setFailureStats({ total: 0, failed: 0 });
    setRetryingPackages(new Set());
    setRateLimitInfo({ isLimited: false, resetTime: null, message: null });

    // Also clear any filters
    setNameFilter("");
    setDownloadsFilter("");
    setStarsFilter("");
    setColumnFilters([]);
    setSorting([]);
  };

  const columns = [
    columnHelper.display({
      id: "number",
      header: () => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <span className="text-xs font-bold">#</span>
        </div>
      ),
      cell: (info) => (
        <span className="text-xs text-gray-500 font-mono">
          {info.row.index + 1}
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: false,
      size: 40,
      minSize: 35,
      maxSize: 50,
    }),
    columnHelper.accessor("name", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Package Name</span>
          <button
            className="sort-button flex-shrink-0"
            onClick={() => handleColumnSort("name")}
          >
            {getSortState("name") === "asc" ? (
              <ArrowUp size={14} />
            ) : getSortState("name") === "desc" ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </button>
        </div>
      ),
      cell: (info) => {
        const pkg = info.row.original;
        const isRetrying = retryingPackages.has(pkg.name);

        return (
          <div className="flex items-center gap-2">
            <a
              href={info.row.original.npmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium truncate"
              title={info.getValue()}
            >
              {info.getValue()}
            </a>
            {info.row.original.repoUrl && (
              <a
                href={info.row.original.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-primary flex-shrink-0"
              >
                <ExternalLink size={16} />
              </a>
            )}
            {pkg.githubFetchFailed && (
              <button
                onClick={() => retryPackageGithubData(pkg.name)}
                disabled={isRetrying}
                className="retry-button flex-shrink-0"
                title="Retry GitHub data fetch"
              >
                {isRetrying ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </button>
            )}
          </div>
        );
      },
      filterFn: "includesString",
      enableResizing: true,
      size: 350,
      minSize: 250,
      maxSize: 600,
    }),
    columnHelper.accessor("version", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Version</span>
          {/* Add invisible spacer to match other columns with sort buttons */}
          <div className="w-[14px] h-[14px] flex-shrink-0" />
        </div>
      ),
      cell: (info) => (
        <span className="text-xs text-gray-600 font-mono">
          {info.getValue()}
        </span>
      ),
      enableSorting: false,
      enableColumnFilter: false,
      enableResizing: true,
      size: 80,
      minSize: 70,
      maxSize: 120,
    }),
    columnHelper.accessor("weeklyDownloads", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Weekly</span>
          <button
            className="sort-button flex-shrink-0"
            onClick={() => handleColumnSort("weeklyDownloads")}
          >
            {getSortState("weeklyDownloads") === "asc" ? (
              <ArrowUp size={14} />
            ) : getSortState("weeklyDownloads") === "desc" ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </button>
        </div>
      ),
      cell: (info) => {
        const pkg = info.row.original;
        return (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm">
              {info.getValue().toLocaleString()}
            </span>
            {isLoggedIn && pkg.previousWeeklyDownloads !== undefined && (
              <DiffDisplay
                current={info.getValue()}
                previous={pkg.previousWeeklyDownloads}
                showIcon={false}
              />
            )}
          </div>
        );
      },
      sortingFn: "basic",
      filterFn: (row, columnId, filterValue) => {
        return row.getValue(columnId) >= filterValue;
      },
      enableResizing: true,
      size: 120,
      minSize: 100,
      maxSize: 160,
    }),
    columnHelper.accessor("dependents", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Deps</span>
          <button
            className="sort-button flex-shrink-0"
            onClick={() => handleColumnSort("dependents")}
          >
            {getSortState("dependents") === "asc" ? (
              <ArrowUp size={14} />
            ) : getSortState("dependents") === "desc" ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </button>
        </div>
      ),
      cell: (info) => (
        <span className="font-mono text-sm">
          {info.getValue().toLocaleString()}
        </span>
      ),
      sortingFn: "basic",
      enableResizing: true,
      size: 80,
      minSize: 70,
      maxSize: 120,
    }),
    columnHelper.accessor("githubStars", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Stars</span>
          <button
            className="sort-button flex-shrink-0"
            onClick={() => handleColumnSort("githubStars")}
          >
            {getSortState("githubStars") === "asc" ? (
              <ArrowUp size={14} />
            ) : getSortState("githubStars") === "desc" ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </button>
        </div>
      ),
      cell: (info) => {
        const pkg = info.row.original;
        if (pkg.isLoadingGithubData) {
          return <ShimmerCell width="40px" height="18px" />;
        }
        return (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm">
              {info.getValue().toLocaleString()}
            </span>
            {isLoggedIn && pkg.previousGithubStars !== undefined && (
              <DiffDisplay
                current={info.getValue()}
                previous={pkg.previousGithubStars}
                showIcon={false}
              />
            )}
          </div>
        );
      },
      sortingFn: "basic",
      filterFn: (row, columnId, filterValue) => {
        return row.getValue(columnId) >= filterValue;
      },
      enableResizing: true,
      size: 80,
      minSize: 70,
      maxSize: 120,
    }),
    columnHelper.accessor("openIssues", {
      header: ({ column }) => (
        <div className="flex items-start gap-1 whitespace-nowrap min-h-[20px]">
          <GripVertical
            size={12}
            className="drag-handle opacity-50 flex-shrink-0"
          />
          <span className="text-xs font-bold">Issues</span>
          <button
            className="sort-button flex-shrink-0"
            onClick={() => handleColumnSort("openIssues")}
          >
            {getSortState("openIssues") === "asc" ? (
              <ArrowUp size={14} />
            ) : getSortState("openIssues") === "desc" ? (
              <ArrowDown size={14} />
            ) : (
              <ArrowUpDown size={14} />
            )}
          </button>
        </div>
      ),
      cell: (info) => {
        const pkg = info.row.original;
        if (pkg.isLoadingGithubData) {
          return <ShimmerCell width="30px" height="18px" />;
        }
        return (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm">
              {info.getValue().toLocaleString()}
            </span>
            {isLoggedIn && pkg.previousOpenIssues !== undefined && (
              <DiffDisplay
                current={info.getValue()}
                previous={pkg.previousOpenIssues}
                showIcon={false}
              />
            )}
          </div>
        );
      },
      sortingFn: "basic",
      enableResizing: true,
      size: 80,
      minSize: 70,
      maxSize: 120,
    }),
  ];

  const table = useReactTable({
    data: userStats?.packages || [],
    columns,
    state: {
      sorting,
      columnFilters,
      columnOrder,
      columnSizing,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnOrderChange: setColumnOrder,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
    enableColumnOrdering: true,
  });

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
                console.log(`🔍 Data structure analysis for ${pkg.name}:`, {
                  hasStars: "stars" in githubData,
                  starsValue: githubData.stars,
                  starsType: typeof githubData.stars,
                  hasOpenIssues: "openIssues" in githubData,
                  openIssuesValue: githubData.openIssues,
                  hasRepoUrl: "repoUrl" in githubData,
                  repoUrlValue: githubData.repoUrl,
                  allKeys: Object.keys(githubData),
                });

                const updatedPkg = {
                  ...pkg,
                  githubStars: githubData.stars || 0, // Use 'stars' field from API response
                  openIssues: githubData.openIssues || 0,
                  repoUrl: githubData.repoUrl || pkg.repoUrl, // Keep existing repoUrl if API doesn't provide one
                  isLoadingGithubData: false,
                  githubFetchFailed: false,
                };

                console.log(`🔄 Package update for ${pkg.name}:`, {
                  before: { stars: pkg.githubStars, issues: pkg.openIssues },
                  after: {
                    stars: updatedPkg.githubStars,
                    issues: updatedPkg.openIssues,
                  },
                  apiResponse: {
                    stars: githubData.stars,
                    issues: githubData.openIssues,
                  },
                });

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

        console.log(
          `🔄 Updating state with batch results:`,
          batchResults.map((r) => ({
            name: r.name,
            stars: r.githubStars,
            issues: r.openIssues,
          }))
        );

        const updatedPackages = prevStats.packages.map((pkg) => {
          const updatedPkg = batchResults.find(
            (result) => result.name === pkg.name
          );
          if (updatedPkg) {
            console.log(
              `📊 Updating ${pkg.name}: ${pkg.githubStars} -> ${updatedPkg.githubStars} stars`
            );
          }
          return updatedPkg || pkg;
        });

        // Calculate new total stars
        const newTotalStars = updatedPackages.reduce(
          (sum, pkg) => sum + pkg.githubStars,
          0
        );
        console.log(`⭐ New total stars: ${newTotalStars}`);
        console.log(
          `📊 Stars breakdown:`,
          updatedPackages.map((p) => ({ name: p.name, stars: p.githubStars }))
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setLoading(true);
    setError(null);
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
      setError(
        error instanceof Error ? error.message : "Failed to fetch user stats"
      );
      setLoading(false);
    }
  };

  const clearAllFilters = () => {
    setNameFilter("");
    setDownloadsFilter("");
    setStarsFilter("");
    setColumnFilters([]);
  };

  // Helper function to handle column drag and drop
  const handleColumnDragStart = (e: React.DragEvent, headerId: string) => {
    e.dataTransfer.setData("text/plain", headerId);
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleColumnDrop = (e: React.DragEvent, targetHeaderId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId !== targetHeaderId) {
      const currentOrder = table.getState().columnOrder;
      const allColumns = table.getAllColumns().map((col) => col.id);

      // If no custom order exists, use the default column order
      const workingOrder = currentOrder.length > 0 ? currentOrder : allColumns;

      const draggedIndex = workingOrder.indexOf(draggedId);
      const targetIndex = workingOrder.indexOf(targetHeaderId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...workingOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedId);
        setColumnOrder(newOrder);
      }
    }
  };

  // Helper function to format time until rate limit reset
  const formatTimeUntilReset = (resetTime: number) => {
    const now = Date.now();
    const diff = resetTime - now;

    if (diff <= 0) return "now";

    const minutes = Math.ceil(diff / (60 * 1000));
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""}`;

    const hours = Math.ceil(diff / (60 * 60 * 1000));
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  };

  // Determine if we should show ads in the main content area
  const showMainContentAds =
    !userStats && !loading && !noPackagesFound && !error;
  const shouldShowAds = !isPaid; // Show ads unless user has paid plan

  return (
    <div className="dashboard-layout">
      <div className="main-content">
        <div className="dashboard">
          <header>
            <div className="header-top">
              <div className="header-title-section">
                <h1>NPM Stats Dashboard</h1>
              </div>
              <div className="header-actions">
                <PlanIndicator />
                <ThemeToggle />
                <AuthStatus />
              </div>
            </div>
            <form onSubmit={handleSearch}>
              <div className="search-container">
                <User size={20} />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Enter NPM username to view package statistics"
                  disabled={loading}
                />
                <button type="submit" disabled={loading || !searchTerm.trim()}>
                  {loading ? "Searching..." : "Search"}
                </button>
                {(userStats || noPackagesFound || error) && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="clear-button"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>

            {error && (
              <div className="error-message">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            {/* Rate limit warning */}
            {rateLimitInfo.isLimited && rateLimitInfo.resetTime && (
              <div className="rate-limit-warning">
                <Clock size={20} />
                <div className="rate-limit-content">
                  <span className="rate-limit-title">
                    GitHub API Rate Limited
                  </span>
                  <span className="rate-limit-message">
                    {rateLimitInfo.message} Rate limit resets in{" "}
                    {formatTimeUntilReset(rateLimitInfo.resetTime)}.
                  </span>
                  <span className="rate-limit-tip">
                    💡 Add a GitHub token to your environment variables for
                    higher rate limits (5000/hour vs 60/hour)
                  </span>
                </div>
              </div>
            )}
          </header>

          {/* Feature promotion for non-logged-in users */}
          {!isLoggedIn && <FeaturePromotion />}

          {/* Show ads in main content area when no search results */}
          {showMainContentAds && shouldShowAds && (
            <div className="main-content-ads">
              <div className="main-content-ads-grid">
                {/* Large banner ad */}
                <div className="main-ad-banner">
                  <GoogleAd
                    adSlot="1234567893"
                    adFormat="horizontal"
                    style={{ width: "100%", height: "250px" }}
                    className="ad-banner-large"
                  />
                </div>

                {/* Two medium ads side by side */}
                <div className="main-ads-row">
                  <div className="main-ad-medium">
                    <GoogleAd
                      adSlot="1234567894"
                      adFormat="rectangle"
                      style={{ width: "100%", height: "300px" }}
                      className="ad-medium"
                    />
                  </div>
                  <div className="main-ad-medium">
                    <GoogleAd
                      adSlot="1234567895"
                      adFormat="rectangle"
                      style={{ width: "100%", height: "300px" }}
                      className="ad-medium"
                    />
                  </div>
                </div>

                {/* Another banner ad */}
                <div className="main-ad-banner">
                  <GoogleAd
                    adSlot="1234567896"
                    adFormat="horizontal"
                    style={{ width: "100%", height: "200px" }}
                    className="ad-banner-medium"
                  />
                </div>
              </div>
            </div>
          )}

          {/* No packages found state */}
          {noPackagesFound && (
            <div className="no-packages-found">
              <div className="no-packages-content">
                <Package size={64} className="no-packages-icon" />
                <h2>No packages found</h2>
                <p>
                  We couldn't find any NPM packages for the username "
                  <strong>{searchTerm}</strong>".
                </p>
                <div className="no-packages-suggestions">
                  <h3>This could be because:</h3>
                  <ul>
                    <li>The username doesn't exist on NPM</li>
                    <li>The user hasn't published any packages yet</li>
                    <li>The username was misspelled</li>
                    <li>
                      The packages are published under a different username
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Show table and filters only when we have packages */}
          {userStats && userStats.packages.length > 0 && (
            <div className="user-stats">
              <div className="user-header">
                <div className="user-header-top">
                  <h2>{userStats.username}'s Packages</h2>
                  <div className="package-limit-info">
                    <span className="package-count">
                      Showing {userStats.packages.length} packages
                      {!isPaid && userStats.packages.length >= packageLimit && (
                        <span className="limit-reached"> (limit reached)</span>
                      )}
                    </span>
                    {!isPaid && (
                      <span className="upgrade-hint">
                        Upgrade to Pro for unlimited packages
                      </span>
                    )}
                  </div>
                </div>
                <div className="user-totals">
                  <div className="total">
                    <Download size={20} />
                    <div className="total-with-diff">
                      <span>
                        {userStats.totalDownloads.toLocaleString()} total
                        downloads
                      </span>
                      {isLoggedIn &&
                        userStats.previousTotalDownloads !== undefined && (
                          <DiffDisplay
                            current={userStats.totalDownloads}
                            previous={userStats.previousTotalDownloads}
                            showIcon={false}
                          />
                        )}
                    </div>
                  </div>
                  <div className="total">
                    <Star size={20} />
                    {userStats.isLoadingGithubData ? (
                      <div className="loading-stats">
                        <ShimmerCell width="80px" height="20px" />
                        <span>total stars</span>
                      </div>
                    ) : (
                      <div className="total-with-diff">
                        <span>
                          {userStats.totalStars.toLocaleString()} total stars
                        </span>
                        {isLoggedIn &&
                          userStats.previousTotalStars !== undefined && (
                            <DiffDisplay
                              current={userStats.totalStars}
                              previous={userStats.previousTotalStars}
                              showIcon={false}
                            />
                          )}
                      </div>
                    )}
                  </div>
                </div>
                {userStats.isLoadingGithubData && (
                  <div className="loading-indicator">
                    <Loader2 size={16} className="animate-spin" />
                    <span>Loading GitHub statistics...</span>
                  </div>
                )}
                {failureStats.total > 0 && failureStats.failed > 0 && (
                  <div className="failure-stats">
                    <div className="failure-stats-content">
                      <span className="failure-count">
                        <XCircle size={16} />
                        {failureStats.failed} GitHub fetch failures
                      </span>
                      <span className="github-failure-note">
                        (GitHub API rate limits or network issues)
                      </span>
                      <button
                        onClick={retryAllFailedFetches}
                        className="retry-all-button"
                        disabled={
                          retryingPackages.size > 0 || rateLimitInfo.isLimited
                        }
                      >
                        <RefreshCw
                          size={16}
                          className={
                            retryingPackages.size > 0 ? "animate-spin" : ""
                          }
                        />
                        Retry All Failed
                      </button>
                      <span className="total-count">
                        out of {failureStats.total} packages
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="table-controls">
                <div className="filter-controls">
                  <div className="filter-group">
                    <label htmlFor="name-filter">Filter by Package Name:</label>
                    <input
                      id="name-filter"
                      type="text"
                      value={nameFilter}
                      onChange={(e) => setNameFilter(e.target.value)}
                      placeholder="Search packages..."
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-group">
                    <label htmlFor="downloads-filter">
                      Min Weekly Downloads:
                    </label>
                    <input
                      id="downloads-filter"
                      type="number"
                      value={downloadsFilter}
                      onChange={(e) => setDownloadsFilter(e.target.value)}
                      placeholder="0"
                      className="filter-input"
                      min="0"
                    />
                  </div>
                  <div className="filter-group">
                    <label htmlFor="stars-filter">Min GitHub Stars:</label>
                    <input
                      id="stars-filter"
                      type="number"
                      value={starsFilter}
                      onChange={(e) => setStarsFilter(e.target.value)}
                      placeholder="0"
                      className="filter-input"
                      min="0"
                    />
                  </div>
                  <button
                    onClick={clearAllFilters}
                    className="clear-filters-btn"
                  >
                    Clear Filters
                  </button>
                  <button
                    onClick={resetTableLayout}
                    className="reset-layout-btn"
                    title="Reset column order and sizes"
                  >
                    <RotateCcw size={16} />
                    Reset Layout
                  </button>
                </div>
              </div>

              <div className="table-container">
                <table style={{ width: table.getCenterTotalSize() }}>
                  <thead>
                    {table.getHeaderGroups().map((headerGroup) => (
                      <tr key={headerGroup.id}>
                        {headerGroup.headers.map((header) => (
                          <th
                            key={header.id}
                            style={{
                              width: header.getSize(),
                              position: "relative",
                            }}
                            className={
                              header.column.getCanSort()
                                ? "sortable-header"
                                : ""
                            }
                          >
                            <div
                              className="header-content"
                              draggable={true}
                              onDragStart={(e) =>
                                handleColumnDragStart(e, header.id)
                              }
                              onDragOver={handleColumnDragOver}
                              onDrop={(e) => handleColumnDrop(e, header.id)}
                            >
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </div>
                            {header.column.getCanResize() && (
                              <div
                                className="resizer"
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                              />
                            )}
                          </th>
                        ))}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {table.getRowModel().rows.map((row) => (
                      <tr key={row.id}>
                        {row.getVisibleCells().map((cell) => (
                          <td
                            key={cell.id}
                            style={{ width: cell.column.getSize() }}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Ad Sidebar - Only show if not paid */}
      {shouldShowAds && <AdSidebar className="desktop-only" />}
    </div>
  );
}

// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export default App;

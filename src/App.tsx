import React from "react";
import { ThemeToggle } from "./components/ThemeToggle";
import { AuthStatus } from "./components/AuthStatus";
import { FeaturePromotion } from "./components/FeaturePromotion";
import { AdSidebar, GoogleAd } from "./components/GoogleAds";
import { SearchForm } from "./components/SearchForm/SearchForm";
import { NoPackagesFound } from "./components/NoPackagesFound/NoPackagesFound";
import { UserStatsHeader } from "./components/UserStatsHeader/UserStatsHeader";
import { TableControls } from "./components/TableControls/TableControls";
import { PackageTable } from "./components/PackageTable/PackageTable";
import { useAuth } from "./contexts/AuthContext";
import { usePackageData } from "./hooks/usePackageData";
import { useTableFilters } from "./hooks/useTableFilters";
import { formatTimeUntilReset } from "./utils/timeUtils";
import styles from "./App.module.css";
import "./styles/global.css";

function App() {
  const { user, subscription } = useAuth();

  // Get user subscription info
  const isLoggedIn = !!user;
  const isPaid = subscription?.isPaid || false;
  const packageLimit = isLoggedIn ? (isPaid ? Infinity : 100) : 20;

  // Use custom hooks for state management
  const {
    userStats,
    loading,
    noPackagesFound,
    failureStats,
    retryingPackages,
    rateLimitInfo,
    handleSearch,
    handleClearSearch,
    retryPackageGithubData,
    retryAllFailedFetches,
  } = usePackageData(isLoggedIn, user, packageLimit);

  const {
    nameFilter,
    downloadsFilter,
    starsFilter,
    setNameFilter,
    setDownloadsFilter,
    setStarsFilter,
    clearAllFilters,
    handleFiltersChange,
    handleResetLayout,
  } = useTableFilters();

  // Determine if we should show ads in the main content area
  const showMainContentAds = !userStats && !loading && !noPackagesFound;
  const shouldShowAds = !isPaid; // Show ads unless user has paid plan

  return (
    <div className={styles.dashboardLayout}>
      <div className={styles.mainContent}>
        <div className={styles.dashboard}>
          <header className={styles.header}>
            <div className={styles.headerTop}>
              <div className={styles.headerTitleSection}>
                <h1 className={styles.title}>NPM Stats Dashboard</h1>
              </div>
              <div className={styles.headerActions}>
                <ThemeToggle />
                <AuthStatus />
              </div>
            </div>
            <SearchForm
              loading={loading}
              onSearch={handleSearch}
              onClear={handleClearSearch}
              showClear={!!(userStats || noPackagesFound)}
              rateLimitInfo={rateLimitInfo}
              formatTimeUntilReset={formatTimeUntilReset}
            />
          </header>

          {/* Feature promotion for non-logged-in users */}
          {!isLoggedIn && <FeaturePromotion />}

          {/* Show only two medium ads under FeaturePromotion when no search results */}
          {showMainContentAds && shouldShowAds && (
            <div className="main-content-ads">
              <div className="main-content-ads-header">
                <span className="ad-label">Sponsored</span>
              </div>
              <div className="main-content-ads-grid">
                {/* Two medium ads side by side - same size as sidebar */}
                <div className="main-ads-row">
                  <div className="main-ad-widget">
                    <GoogleAd
                      adSlot="1234567894"
                      adFormat="rectangle"
                      style={{ width: "300px", height: "250px" }}
                      className="ad-medium"
                    />
                  </div>
                  <div className="main-ad-widget">
                    <GoogleAd
                      adSlot="1234567895"
                      adFormat="rectangle"
                      style={{ width: "300px", height: "300px" }}
                      className="ad-medium"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* No packages found state */}
          {noPackagesFound && (
            <NoPackagesFound searchTerm={userStats?.username || ""} />
          )}

          {/* Show table and filters only when we have packages */}
          {userStats && userStats.packages.length > 0 && (
            <div className={styles.userStats}>
              <UserStatsHeader
                userStats={userStats}
                isLoggedIn={isLoggedIn}
                isPaid={isPaid}
                packageLimit={packageLimit}
                failureStats={failureStats}
                retryingPackages={retryingPackages}
                rateLimitInfo={rateLimitInfo}
                retryAllFailedFetches={retryAllFailedFetches}
              />

              <TableControls
                nameFilter={nameFilter}
                setNameFilter={setNameFilter}
                downloadsFilter={downloadsFilter}
                setDownloadsFilter={setDownloadsFilter}
                starsFilter={starsFilter}
                setStarsFilter={setStarsFilter}
                clearAllFilters={clearAllFilters}
                onResetLayout={() => {
                  // Call the reset function stored on the PackageTable component
                  if ((PackageTable as any).resetTableLayout) {
                    (PackageTable as any).resetTableLayout();
                  }
                  handleResetLayout();
                }}
              />

              <PackageTable
                packages={userStats.packages}
                retryingPackages={retryingPackages}
                retryPackageGithubData={retryPackageGithubData}
                isLoggedIn={isLoggedIn}
                nameFilter={nameFilter}
                downloadsFilter={downloadsFilter}
                starsFilter={starsFilter}
                onFiltersChange={handleFiltersChange}
              />
            </div>
          )}
        </div>
      </div>

      {/* Ad Sidebar - Only show if not paid */}
      {shouldShowAds && <AdSidebar className="desktop-only" />}
    </div>
  );
}

export default App;

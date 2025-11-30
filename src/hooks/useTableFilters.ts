import { useState, useCallback } from "react";

interface UseTableFiltersReturn {
  nameFilter: string;
  downloadsFilter: string;
  starsFilter: string;
  setNameFilter: (value: string) => void;
  setDownloadsFilter: (value: string) => void;
  setStarsFilter: (value: string) => void;
  clearAllFilters: () => void;
  handleFiltersChange: (filters: {
    name: string;
    downloads: string;
    stars: string;
  }) => void;
  handleResetLayout: () => void;
}

export function useTableFilters(): UseTableFiltersReturn {
  // Filter state for table controls
  const [nameFilter, setNameFilter] = useState("");
  const [downloadsFilter, setDownloadsFilter] = useState("");
  const [starsFilter, setStarsFilter] = useState("");

  const clearAllFilters = useCallback(() => {
    setNameFilter("");
    setDownloadsFilter("");
    setStarsFilter("");
  }, []);

  // Handle filter changes from PackageTable
  const handleFiltersChange = useCallback(
    (filters: { name: string; downloads: string; stars: string }) => {
      setNameFilter(filters.name);
      setDownloadsFilter(filters.downloads);
      setStarsFilter(filters.stars);
    },
    []
  );

  // Handle reset layout from TableControls
  const handleResetLayout = useCallback(() => {
    // Clear filter inputs
    clearAllFilters();
    // Reset table layout via ref (this will be handled by PackageTable internally now)
  }, [clearAllFilters]);

  return {
    nameFilter,
    downloadsFilter,
    starsFilter,
    setNameFilter,
    setDownloadsFilter,
    setStarsFilter,
    clearAllFilters,
    handleFiltersChange,
    handleResetLayout,
  };
}

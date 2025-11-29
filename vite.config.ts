import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { Redis } from "@upstash/redis";

// Robust fetch with retry mechanism
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Create a new AbortController for each attempt
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          "User-Agent": "NPM-Stats-Dashboard/1.0",
          Accept: "application/json",
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      // Don't retry on client errors (4xx) except for rate limits
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 429 &&
        response.status !== 403
      ) {
        return response;
      }

      // Don't retry on successful responses
      if (response.ok) {
        return response;
      }

      // For server errors (5xx) or rate limits, we'll retry
      if (attempt === maxRetries) {
        return response; // Return the last response even if it's an error
      }

      console.log(
        `🔄 Attempt ${attempt + 1} failed for ${url}: ${
          response.status
        }. Retrying...`
      );
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on AbortError (timeout)
      if (lastError.name === "AbortError" && attempt === maxRetries) {
        throw lastError;
      }

      console.log(
        `🔄 Attempt ${attempt + 1} failed for ${url}: ${lastError.message}. ${
          attempt < maxRetries ? "Retrying..." : "Max retries reached."
        }`
      );

      if (attempt === maxRetries) {
        throw lastError;
      }
    }

    // Exponential backoff with jitter
    if (attempt < maxRetries) {
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Max retries reached");
}

// Safe Redis client wrapper
class SafeRedisClient {
  private redis: Redis | null = null;
  private isConnected = false;

  constructor(url?: string, token?: string) {
    if (url && token) {
      try {
        this.redis = new Redis({ url, token });
        this.isConnected = true;
        console.log("✅ Redis client initialized successfully");
      } catch (error) {
        console.warn("⚠️ Failed to initialize Redis client:", error);
        this.redis = null;
        this.isConnected = false;
      }
    } else {
      console.warn("⚠️ Redis credentials not provided - running without Redis");
      this.isConnected = false;
    }
  }

  async get(key: string): Promise<any> {
    if (!this.redis || !this.isConnected) {
      console.log("📊 Redis not available, returning null for key:", key);
      return null;
    }

    try {
      const result = await this.redis.get(key);
      console.log(`📊 Redis GET ${key}:`, result ? "found" : "not found");
      return result;
    } catch (error) {
      console.warn(`⚠️ Redis GET error for key ${key}:`, error);
      this.isConnected = false; // Mark as disconnected on error
      return null;
    }
  }

  async set(key: string, value: any): Promise<boolean> {
    if (!this.redis || !this.isConnected) {
      console.log("💾 Redis not available, skipping SET for key:", key);
      return false;
    }

    try {
      await this.redis.set(key, value);
      console.log(`💾 Redis SET ${key}: success`);
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis SET error for key ${key}:`, error);
      this.isConnected = false; // Mark as disconnected on error
      return false;
    }
  }

  isAvailable(): boolean {
    return this.isConnected && this.redis !== null;
  }
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, process.cwd(), "");

  // Initialize safe Redis client with loaded environment variables
  const safeRedis = new SafeRedisClient(
    env.UPSTASH_REDIS_REST_URL,
    env.UPSTASH_REDIS_REST_TOKEN
  );

  return {
    plugins: [
      react(),
      {
        name: "api-middleware",
        configureServer(server) {
          // Configure server headers to ensure Auth0 compatibility
          server.middlewares.use((req, res, next) => {
            // Remove any problematic headers
            res.removeHeader("Cross-Origin-Embedder-Policy");
            res.removeHeader("Cross-Origin-Resource-Policy");

            // Set Auth0-compatible headers
            res.setHeader(
              "Cross-Origin-Opener-Policy",
              "same-origin-allow-popups"
            );
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.setHeader(
              "Access-Control-Allow-Methods",
              "GET, POST, PUT, DELETE, OPTIONS"
            );
            res.setHeader(
              "Access-Control-Allow-Headers",
              "Content-Type, Authorization, X-Requested-With"
            );
            res.setHeader("Access-Control-Allow-Credentials", "true");

            // Handle preflight requests
            if (req.method === "OPTIONS") {
              res.statusCode = 200;
              res.end();
              return;
            }

            next();
          });

          // Handle stats API
          server.middlewares.use("/api/stats", async (req, res, next) => {
            await handleStatsAPI(req, res);
          });

          // Handle GitHub stats API - Pass env object to access GitHub token
          server.middlewares.use(
            "/api/github-stats",
            async (req, res, next) => {
              await handleGithubStatsAPI(req, res, env);
            }
          );

          // Handle user stats history API
          server.middlewares.use(
            "/api/user-stats-history",
            async (req, res, next) => {
              await handleUserStatsHistoryAPI(req, res, safeRedis);
            }
          );
        },
      },
    ],
    optimizeDeps: {
      exclude: ["lucide-react"],
    },
    server: {
      headers: {
        // Ensure no COEP headers are set
        "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
        "Referrer-Policy": "strict-origin-when-cross-origin",
      },
    },
  };
});

async function handleStatsAPI(req: any, res: any) {
  console.log("API middleware hit for:", req.originalUrl || req.url);

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const url = new URL(
      req.originalUrl || req.url,
      `http://${req.headers.host}`
    );
    const username = url.searchParams.get("username");

    if (!username) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ error: "Username is required" }));
      return;
    }

    console.log("🔍 === NPM SEARCH API REQUEST ===");
    console.log(`📦 Searching for packages by maintainer: ${username}`);
    console.log(
      `🌐 API URL: https://registry.npmjs.org/-/v1/search?text=maintainer:${username}&size=250`
    );

    const response = await fetchWithRetry(
      `https://registry.npmjs.org/-/v1/search?text=maintainer:${username}&size=250`
    );

    if (!response.ok) {
      throw new Error(`NPM API responded with status: ${response.status}`);
    }

    const data = await response.json();
    console.log(
      `📊 NPM API response received: ${data.objects.length} packages found`
    );
    console.log(`⏰ Response timestamp: ${new Date().toISOString()}`);

    // Log detailed download data for debugging
    console.log("\n📈 === DOWNLOAD DATA ANALYSIS ===");
    data.objects.forEach((pkg: any, index: number) => {
      const downloads = pkg.downloads;
      console.log(`${index + 1}. ${pkg.package.name}:`);
      console.log(`   📊 Raw downloads object:`, downloads);
      console.log(`   📈 Weekly downloads: ${downloads?.weekly || 0}`);
      console.log(`   📅 Monthly downloads: ${downloads?.monthly || 0}`);

      // Check if this is the package in question
      if (pkg.package.name === "recma-mdx-import-react") {
        console.log(`\n🎯 === FOUND TARGET PACKAGE: ${pkg.package.name} ===`);
        console.log(`   📊 Full package object:`, JSON.stringify(pkg, null, 2));
        console.log(
          `   📈 Weekly downloads from API: ${downloads?.weekly || 0}`
        );
        console.log(
          `   📅 Monthly downloads from API: ${downloads?.monthly || 0}`
        );
        console.log(
          `   🔗 NPM URL: ${
            pkg.package.links?.npm ||
            `https://www.npmjs.com/package/${pkg.package.name}`
          }`
        );
        console.log(`   ⏰ Last updated: ${pkg.package.date}`);
        console.log(`   📊 Search score: ${pkg.searchScore}`);
      }
    });

    // Helper function to extract and clean GitHub URL
    const extractGithubUrl = (pkg: any) => {
      // Check for repository URL in multiple possible locations
      let repositoryUrl =
        pkg.package.repository?.url ||
        pkg.package.links?.repository ||
        pkg.package.bugs?.url ||
        pkg.package.links?.bugs ||
        pkg.package.homepage;

      if (!repositoryUrl) return null;

      console.log(
        `🔗 Processing repo URL for ${pkg.package.name}: ${repositoryUrl}`
      );

      // Clean up the repository URL
      let cleanUrl = repositoryUrl;

      // Remove git+ prefix
      if (cleanUrl.startsWith("git+")) {
        cleanUrl = cleanUrl.substring(4);
      }

      // Remove .git suffix
      if (cleanUrl.endsWith(".git")) {
        cleanUrl = cleanUrl.slice(0, -4);
      }

      // Remove any trailing slashes or fragments
      cleanUrl = cleanUrl.replace(/[#?].*$/, "").replace(/\/$/, "");

      // Test GitHub patterns
      const githubPatterns = [
        /https:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
        /http:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
        /git@github\.com:([^\/\s]+)\/([^\/\s#?]+)/i,
        /github\.com[\/:]([^\/\s]+)\/([^\/\s#?]+)/i,
        /www\.github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
      ];

      for (const pattern of githubPatterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
          const owner = match[1];
          const repo = match[2];
          const githubUrl = `https://github.com/${owner}/${repo}`;
          console.log(
            `✅ Extracted GitHub URL for ${pkg.package.name}: ${githubUrl}`
          );
          return githubUrl;
        }
      }

      console.log(
        `❌ No GitHub pattern matched for ${pkg.package.name}: ${cleanUrl}`
      );
      return null;
    };

    // Create packages with NPM data and initial GitHub URLs
    const packages = data.objects.map((pkg: any) => {
      const repoUrl = extractGithubUrl(pkg);
      const weeklyDownloads = pkg.downloads?.weekly || 0;

      // Log each package creation for debugging
      console.log(
        `📦 Creating package object for ${pkg.package.name}: ${weeklyDownloads} weekly downloads`
      );

      return {
        name: pkg.package.name,
        version: pkg.package.version,
        weeklyDownloads: weeklyDownloads,
        dependents: pkg.dependents || 0,
        githubStars: 0,
        openIssues: 0,
        lastChecked: new Date().toISOString(),
        npmUrl:
          pkg.package.links?.npm ||
          `https://www.npmjs.com/package/${pkg.package.name}`,
        repoUrl: repoUrl, // Set the GitHub URL immediately
      };
    });

    const totalDownloads = packages.reduce(
      (sum: number, pkg: any) => sum + pkg.weeklyDownloads,
      0
    );

    const result = {
      username,
      packages,
      totalDownloads,
      totalStars: 0,
    };

    console.log(`\n✅ === FINAL RESULT SUMMARY ===`);
    console.log(`👤 Username: ${username}`);
    console.log(`📦 Total packages: ${packages.length}`);
    console.log(
      `📈 Total weekly downloads: ${totalDownloads.toLocaleString()}`
    );
    console.log(
      `🔗 Packages with GitHub links: ${
        packages.filter((p) => p.repoUrl).length
      }`
    );

    // Log the specific package data being returned
    const targetPackage = packages.find(
      (p) => p.name === "recma-mdx-import-react"
    );
    if (targetPackage) {
      console.log(`\n🎯 === TARGET PACKAGE IN RESULT ===`);
      console.log(`📦 Package: ${targetPackage.name}`);
      console.log(`📈 Weekly downloads: ${targetPackage.weeklyDownloads}`);
      console.log(`📊 Full object:`, targetPackage);
    }

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error("API Error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(
      JSON.stringify({
        error: "Failed to fetch package data",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

// Rate limiting state
let rateLimitInfo = {
  remaining: 60,
  resetTime: Date.now() + 60 * 60 * 1000, // 1 hour from now
  isLimited: false,
};

// Updated function signature to accept env object
async function handleGithubStatsAPI(
  req: any,
  res: any,
  env: Record<string, string>
) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  try {
    const url = new URL(
      req.originalUrl || req.url,
      `http://${req.headers.host}`
    );
    const packageName = url.searchParams.get("package");

    if (!packageName) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(JSON.stringify({ error: "Package name is required" }));
      return;
    }

    console.log(`🔍 === GITHUB API REQUEST FOR: ${packageName} ===`);

    // Check if we're currently rate limited
    if (rateLimitInfo.isLimited && Date.now() < rateLimitInfo.resetTime) {
      const minutesUntilReset = Math.ceil(
        (rateLimitInfo.resetTime - Date.now()) / (60 * 1000)
      );
      console.log(
        `🚫 Rate limited for ${packageName}. Reset in ${minutesUntilReset} minutes.`
      );

      res.statusCode = 429;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.end(
        JSON.stringify({
          error: "GitHub API rate limit exceeded",
          details: `Rate limit will reset in ${minutesUntilReset} minutes`,
          packageName,
          success: false,
          rateLimited: true,
          resetTime: rateLimitInfo.resetTime,
        })
      );
      return;
    }

    let githubStars = 0;
    let openIssues = 0;
    let repoUrl = null;

    try {
      // Get package info from NPM to find repository URL
      console.log(`📦 Fetching NPM data for: ${packageName}`);

      const npmResponse = await fetchWithRetry(
        `https://registry.npmjs.org/${encodeURIComponent(packageName)}`
      );

      if (npmResponse.ok) {
        const npmData = await npmResponse.json();

        // Find repository URL
        let repositoryUrl =
          npmData.repository?.url ||
          npmData.bugs?.url ||
          npmData.homepage ||
          npmData.links?.repository;

        if (repositoryUrl) {
          console.log(`🔗 Found repo URL for ${packageName}: ${repositoryUrl}`);

          // Clean up the repository URL
          let cleanUrl = repositoryUrl;

          // Remove git+ prefix
          if (cleanUrl.startsWith("git+")) {
            cleanUrl = cleanUrl.substring(4);
          }

          // Remove .git suffix
          if (cleanUrl.endsWith(".git")) {
            cleanUrl = cleanUrl.slice(0, -4);
          }

          // Remove any trailing slashes or fragments
          cleanUrl = cleanUrl.replace(/[#?].*$/, "").replace(/\/$/, "");

          // Test GitHub patterns
          const githubPatterns = [
            /https:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
            /http:\/\/github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
            /git@github\.com:([^\/\s]+)\/([^\/\s#?]+)/i,
            /github\.com[\/:]([^\/\s]+)\/([^\/\s#?]+)/i,
            /www\.github\.com\/([^\/\s]+)\/([^\/\s#?]+)/i,
          ];

          let githubMatch = null;

          for (const pattern of githubPatterns) {
            githubMatch = cleanUrl.match(pattern);
            if (githubMatch) break;
          }

          if (githubMatch) {
            const owner = githubMatch[1];
            const repo = githubMatch[2];
            const fullRepo = `${owner}/${repo}`;
            repoUrl = `https://github.com/${fullRepo}`;

            console.log(`📊 Calling GitHub API for: ${fullRepo}`);
            console.log(
              `🔢 Current rate limit status: ${rateLimitInfo.remaining} remaining`
            );

            // Prepare GitHub API headers
            const githubHeaders: Record<string, string> = {
              "User-Agent": "NPM-Stats-Dashboard/1.0",
              Accept: "application/vnd.github.v3+json",
              "X-GitHub-Api-Version": "2022-11-28",
            };

            // Get GitHub token from environment variables using env object
            const githubToken =
              env.GITHUB_TOKEN || env.GITHUB_PAT || env.GH_TOKEN;
            if (githubToken) {
              githubHeaders["Authorization"] = `Bearer ${githubToken}`;
              console.log(
                `🔑 Using GitHub authentication token (${githubToken.substring(
                  0,
                  8
                )}...)`
              );
              // Reset rate limit info when using token (5000/hour instead of 60/hour)
              if (rateLimitInfo.remaining <= 60) {
                rateLimitInfo.remaining = 5000;
                rateLimitInfo.isLimited = false;
              }
            } else {
              console.log(
                `⚠️ No GitHub token found in environment variables - using unauthenticated requests (limited to 60/hour)`
              );
              console.log(
                `   Add GITHUB_TOKEN to your .env file for higher rate limits (5000/hour)`
              );
            }

            try {
              const githubResponse = await fetchWithRetry(
                `https://api.github.com/repos/${fullRepo}`,
                {
                  headers: githubHeaders,
                }
              );

              // Update rate limit info from response headers
              const remaining = githubResponse.headers.get(
                "X-RateLimit-Remaining"
              );
              const resetTime = githubResponse.headers.get("X-RateLimit-Reset");

              if (remaining) {
                rateLimitInfo.remaining = parseInt(remaining);
                console.log(
                  `🔢 Updated rate limit remaining: ${rateLimitInfo.remaining}`
                );
              }
              if (resetTime) {
                rateLimitInfo.resetTime = parseInt(resetTime) * 1000; // Convert to milliseconds
                console.log(
                  `⏰ Rate limit resets at: ${new Date(
                    rateLimitInfo.resetTime
                  ).toLocaleTimeString()}`
                );
              }

              console.log(
                `🌐 GitHub API Response: ${githubResponse.status} for ${fullRepo}`
              );

              if (githubResponse.ok) {
                const githubData = await githubResponse.json();

                // Log the raw GitHub API response for debugging
                console.log(`📊 GitHub API Success for ${fullRepo}:`, {
                  stargazers_count: githubData.stargazers_count,
                  open_issues_count: githubData.open_issues_count,
                  full_name: githubData.full_name,
                });

                // Extract values safely
                const rawStars = githubData.stargazers_count;
                const rawIssues = githubData.open_issues_count;

                githubStars =
                  typeof rawStars === "number" && !isNaN(rawStars)
                    ? rawStars
                    : 0;
                openIssues =
                  typeof rawIssues === "number" && !isNaN(rawIssues)
                    ? rawIssues
                    : 0;

                console.log(
                  `✅ GitHub success for ${fullRepo}: ${githubStars} stars, ${openIssues} issues`
                );
              } else if (githubResponse.status === 404) {
                console.log(`⚠️ Repository not found: ${fullRepo}`);
              } else if (
                githubResponse.status === 403 ||
                githubResponse.status === 429
              ) {
                console.log(`🚫 GitHub API rate limit hit for ${fullRepo}`);

                // Mark as rate limited
                rateLimitInfo.isLimited = true;

                // If we don't have reset time from headers, estimate it
                if (!resetTime) {
                  rateLimitInfo.resetTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
                }

                const minutesUntilReset = Math.ceil(
                  (rateLimitInfo.resetTime - Date.now()) / (60 * 1000)
                );
                console.log(
                  `   Rate limit resets in: ${minutesUntilReset} minutes`
                );

                // Return rate limit error
                res.statusCode = 429;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.end(
                  JSON.stringify({
                    error: "GitHub API rate limit exceeded",
                    details: githubToken
                      ? `Rate limit will reset in ${minutesUntilReset} minutes.`
                      : `Rate limit will reset in ${minutesUntilReset} minutes. Consider adding a GitHub token for higher limits.`,
                    packageName,
                    success: false,
                    rateLimited: true,
                    resetTime: rateLimitInfo.resetTime,
                    repoUrl: repoUrl,
                  })
                );
                return;
              } else {
                console.log(
                  `❌ GitHub API error for ${fullRepo}: ${githubResponse.status}`
                );
                const errorText = await githubResponse
                  .text()
                  .catch(() => "Unable to read error response");
                console.log(`   Error details: ${errorText}`);
              }
            } catch (githubError) {
              if (
                githubError instanceof Error &&
                githubError.name === "AbortError"
              ) {
                console.log(`⏰ GitHub API timeout for ${fullRepo}`);
              } else {
                console.log(
                  `💥 GitHub API error for ${fullRepo}:`,
                  githubError instanceof Error
                    ? githubError.message
                    : githubError
                );
              }
            }
          } else {
            console.log(
              `🔍 No GitHub pattern matched for ${packageName}: ${cleanUrl}`
            );
          }
        } else {
          console.log(`📦 No repository URL found for ${packageName}`);
        }
      } else {
        console.log(
          `⚠️ NPM API error for ${packageName}: ${npmResponse.status}`
        );
      }
    } catch (npmError) {
      console.error(
        `💥 NPM fetch error for ${packageName}:`,
        npmError instanceof Error ? npmError.message : npmError
      );
    }

    // Return successful result
    const result = {
      packageName,
      stars: githubStars,
      openIssues: openIssues,
      repoUrl: repoUrl,
      success: true,
      rateLimited: false,
    };

    console.log(
      `🏁 SUCCESS for ${packageName}: ${result.stars} stars, ${result.openIssues} issues`
    );

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.statusCode = 200;
    res.end(JSON.stringify(result));
  } catch (error) {
    console.error(`💥 GitHub API Error:`, error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(
      JSON.stringify({
        error: "Failed to fetch GitHub data",
        details: error instanceof Error ? error.message : "Unknown error",
        packageName: new URL(
          req.originalUrl || req.url,
          `http://${req.headers.host}`
        ).searchParams.get("package"),
        success: false,
      })
    );
  }
}

async function handleUserStatsHistoryAPI(
  req: any,
  res: any,
  safeRedis: SafeRedisClient
) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const url = new URL(
      req.originalUrl || req.url,
      `http://${req.headers.host}`
    );

    if (req.method === "GET") {
      // Fetch historical data
      const githubUserId = url.searchParams.get("githubUserId");
      const npmUsername = url.searchParams.get("npmUsername");

      if (!githubUserId || !npmUsername) {
        res.statusCode = 400;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({ error: "githubUserId and npmUsername are required" })
        );
        return;
      }

      console.log(
        `📊 Fetching historical data for GitHub user ${githubUserId}, NPM user ${npmUsername}`
      );

      if (!safeRedis.isAvailable()) {
        console.log(`📊 Redis not available - returning empty historical data`);
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            data: null,
            lastCheckedDate: null,
            redisAvailable: false,
            message: "Historical data storage is currently unavailable",
          })
        );
        return;
      }

      try {
        // Extract GitHub username from Auth0 ID (e.g., "github|12345678" -> "demo-dev")
        // For mock auth, we'll use the nickname from the user object
        // In real implementation, you'd extract this from the Auth0 user profile
        const githubUsername = githubUserId.includes("|")
          ? "demo-dev"
          : githubUserId;

        // Updated key pattern: npm-stats:github-user:demo-dev:npm-user:ipikuka:last-checked-date
        const lastCheckedKey = `npm-stats:github-user:${githubUsername}:npm-user:${npmUsername}:last-checked-date`;
        const lastCheckedDate = await safeRedis.get(lastCheckedKey);

        if (!lastCheckedDate) {
          console.log(
            `📊 No historical data found for ${githubUsername}/${npmUsername}`
          );
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              data: null,
              lastCheckedDate: null,
              redisAvailable: true,
            })
          );
          return;
        }

        // Get historical data for that date
        const dataKey = `npm-stats:github-user:${githubUsername}:npm-user:${npmUsername}:date:${lastCheckedDate}`;
        const historicalData = await safeRedis.get(dataKey);

        if (!historicalData) {
          console.log(`📊 No data found for date ${lastCheckedDate}`);
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              data: null,
              lastCheckedDate,
              redisAvailable: true,
            })
          );
          return;
        }

        console.log(
          `📊 Found historical data for ${lastCheckedDate}:`,
          historicalData
        );

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            data: historicalData,
            lastCheckedDate,
            redisAvailable: true,
          })
        );
      } catch (redisError) {
        console.error("Redis fetch error:", redisError);
        res.statusCode = 200; // Don't fail the request, just return empty data
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            data: null,
            lastCheckedDate: null,
            redisAvailable: false,
            error: "Failed to fetch historical data - Redis connection issue",
            details:
              redisError instanceof Error
                ? redisError.message
                : "Unknown error",
          })
        );
      }
    } else if (req.method === "POST") {
      // Save current data
      let body = "";
      req.on("data", (chunk: any) => {
        body += chunk.toString();
      });

      req.on("end", async () => {
        try {
          const { githubUserId, npmUsername, data } = JSON.parse(body);

          if (!githubUserId || !npmUsername || !data) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                error: "githubUserId, npmUsername, and data are required",
              })
            );
            return;
          }

          const currentDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD format

          // Extract GitHub username from Auth0 ID (e.g., "github|12345678" -> "demo-dev")
          const githubUsername = githubUserId.includes("|")
            ? "demo-dev"
            : githubUserId;

          console.log(
            `💾 Saving data for GitHub user ${githubUsername}, NPM user ${npmUsername}, date ${currentDate}`
          );
          console.log(`💾 Saving enhanced data structure:`, {
            packages: data.packages?.length || 0,
            totalDownloads: data.totalDownloads,
            totalStars: data.totalStars,
            timestamp: data.timestamp,
          });

          if (!safeRedis.isAvailable()) {
            console.log(`💾 Redis not available - data not saved`);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: false,
                date: currentDate,
                redisAvailable: false,
                message: "Data could not be saved - Redis connection issue",
              })
            );
            return;
          }

          // Updated key pattern: npm-stats:github-user:demo-dev:npm-user:ipikuka:date:2024-01-15
          const dataKey = `npm-stats:github-user:${githubUsername}:npm-user:${npmUsername}:date:${currentDate}`;
          const dataSet = await safeRedis.set(dataKey, data);

          // Update last checked date
          const lastCheckedKey = `npm-stats:github-user:${githubUsername}:npm-user:${npmUsername}:last-checked-date`;
          const dateSet = await safeRedis.set(lastCheckedKey, currentDate);

          if (dataSet && dateSet) {
            console.log(
              `✅ Data saved successfully for ${currentDate} with new key pattern and enhanced structure`
            );
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: true,
                date: currentDate,
                redisAvailable: true,
              })
            );
          } else {
            console.log(`⚠️ Data save partially failed for ${currentDate}`);
            res.statusCode = 200;
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                success: false,
                date: currentDate,
                redisAvailable: true,
                message: "Data save operation failed",
              })
            );
          }
        } catch (parseError) {
          console.error("JSON parse error:", parseError);
          res.statusCode = 400;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: "Invalid JSON",
              details:
                parseError instanceof Error
                  ? parseError.message
                  : "Unknown error",
            })
          );
        }
      });
    } else {
      res.statusCode = 405;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: "Method not allowed" }));
    }
  } catch (error) {
    console.error("User stats history API error:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

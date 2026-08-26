import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The committed extension key keeps this ID stable for every unpacked clone.
  // Vinext checks the Origin hostname before extension API routes execute.
  allowedDevOrigins: ["febphjmgnkpofbinjebefmenfldbjbbb"],
};

export default nextConfig;

import type { NextConfig } from "next";
import { resolve } from "path";
import CopyPlugin from "copy-webpack-plugin";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };

    // WASMファイルをコピー
    if (isServer) {
      config.plugins.push(
        new CopyPlugin({
          patterns: [
            {
              from: resolve("node_modules/symbol-crypto-wasm-node/symbol_crypto_wasm_bg.wasm"),
              to: resolve(".next/server/chunks/"),
            },
          ],
        })
      );
    }

    return config;
  },
  serverExternalPackages: ["symbol-sdk", "symbol-crypto-wasm-node"],
};

export default nextConfig;

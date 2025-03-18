const path = require("path");

module.exports = {
  mode: "development", // or "production" as needed
  entry: "./background.js",
  devtool: "source-map", // Use source-map instead of eval-based devtools
  output: {
    filename: "background.bundle.js",
    path: path.resolve(__dirname, "dist"),
    library: {
      type: "module",
    },
  },
  experiments: {
    outputModule: true,
  },
};

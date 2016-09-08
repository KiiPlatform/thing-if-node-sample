"use strict"

var webpack = require("webpack"),
    path    = require("path");

module.exports = {

  entry: {
    main: "./src/main.js",
  },

  target: "node",

  resolve: {
    root: ".",
    extensions: ["", ".js"],
    alias: {
      "kii-sdk": path.join(__dirname, "./lib/kii-cloud-sdk-v2.1.34.js"),
    },
  },

  output: {
    path: path.join(__dirname, "."),
    filename: `[name].js`,
  },

  module: {
    loaders: [
      { test: /(\.js)$/, loader: 'babel?cacheDirectory', exclude: /node_modules/ },
    ],
  },

  externals: {
    blecast_tm: "BlecastTM",
  }
}

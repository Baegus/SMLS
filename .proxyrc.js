const express = require("express");
const path = require("node:path");

module.exports = function (app) {
	app.use("/", express.static(path.join(__dirname, "static")));
};
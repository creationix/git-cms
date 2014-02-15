"use strict";

var mine = require("mine");
var pathJoin = require("pathjoin");
var binary = require('bodec');

module.exports = page_generator;


function page_generator(servePath, req, callback) {
  var etag = req.current;

  var modules = {};  // compiled modules
  var packagePaths = {}; // key is base + name , value is full path
  var aliases = {}; // path aliases from the "browser" directive in package.json

  return callback(null, {etag: etag, fetch: fetch});

  function fetch(callback) {
	}

  // callback(new Error("TODO: Implement compiler"));
}



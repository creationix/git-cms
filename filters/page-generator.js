"use strict";

var mine = require("mine");
var pathJoin = require("pathjoin");
var binary = require('bodec');

module.exports = page_generator;


function page_generator(servePath, req, callback) {

  // Use commit hash for cache invalidation.  That is the simplest and invalidates
  // on any change to anything within the top repository.
  var etag = req.current;

  return callback(null, {etag: etag, fetch: fetch});

/*
  function fetch(callback) {

    console.log("PATH: " + req.targetPath);

    // The system wants us to render the body now.  First we need to read the target tree.
    var detailsPath = pathJoin(req.targetPath, "manifest.json");

    console.log("DETAILS PATH: " + detailsPath);
    loadJson(detailsPath, onDetails);

    function onDetails(err, details) {
      if (err) return callback(err);
      if (!details) return callback("Missing " + detailsPath);

      console.log("DETAILS: " + JSON.stringify(details));

      // For now just render the json out as the final output
      callback(null, binary.fromUnicode(JSON.stringify(details)));

    }
  }
*/
  function fetch(callback) {

    console.log("PATH: " + req.targetPath);

    // The system wants us to render the body now.  First we need to read the target tree.
    var manifestPath = pathJoin(req.targetPath, "manifest.json");

    console.log("DETAILS PATH: " + manifestPath);
    loadJson(manifestPath, onManifest);

    function onManifest(err, manifest) {
      if (err) return callback(err);
      if (!manifest) return callback("Missing " + manifestPath);

			var m = JSON.parse(manifest);

      console.log("MANIFEST: " + m);

			var template = m["template"];

      // For now just render the json out as the final output
      callback(null, binary.fromUnicode(template));

    }
  }

  function loadJson(path, callback) {
    loadFile(path, onJson);

    function onJson(err, json) {
      if (json === undefined) return callback(err);
      var data;
      try { data = JSON.parse(json); }
      catch (err) { return callback(err); }
      callback(null, data);
    }
  }

  function loadFile(path, callback) {
    servePath(path, null, onResult);

    function onResult(err, result) {
      if (!result) return callback(err);
      result.fetch(onBody);
    }

    function onBody(err, body) {
      if (err) return callback(err);
      var text;
      try { text = binary.toUnicode(body); }
      catch (err) { return callback(err); }
      callback(null, text);
    }
  }
}
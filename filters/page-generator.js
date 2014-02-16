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

  function fetch(callback) {
    // The system wants us to render the body now.  First we need to read the target template.
    req.target.fetch(onBody);

    // Now that we have the body, we can process it
    function onBody(err, body) {
      if (err) return callback(err);

      // Convert to text.  This will throw if the data isn't utf-8, so we try..catch
      var html;
      try { html = binary.toUnicode(body); }
      catch (err) { return callback(err); }

      // TODO: here process the html
      // If we need to load any other resources, we will use
      // servePath(path, etag, callback) to load them.
      // Then once we're done rendering the final html page...
      // Send the result as binary.
      callback(null, binary.fromUnicode(html));
    }
  }
}

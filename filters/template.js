/*global -name*/
var pathJoin = require('pathjoin');
var binary = require('bodec');
var modes = require('js-git/lib/modes');


var compile;

module.exports = function (newServe, req, callback) {
  if (!compile) {
    compile = initCompile(newServe);
  }

  var templatePath = pathJoin(req.paths.root, req.template);

  compile(templatePath, function (err, template) {
    if (err) return callback(err);
    callback(null, {
      mode: modes.file,
      hash: req.codeHash + "-" + template.hash,
      fetch: fetch
    });
    function fetch(callback) {
      template.fn(req, function (err, code) {
        if (err) return callback(err);
        callback(null, binary.fromUnicode(code));
      });
    }
  });

};

function initCompile(servePath) {
  return kernel(load, helpers);
  function load(path, callback) {
    servePath(path, function (err, result) {
      if (!result) return callback(err);
      callback(null, result.hash, fetch);

      function fetch(callback) {
        result.fetch(function (err, blob) {
          if (err) return callback(err);
          var code = binary.toUnicode(blob);
          callback(null, code);
        });
      }
    });
  }
}

var helpers = {
  loop: function (array, block, callback) {
    var index = array.length;
    var parts = new Array(index--);
    array.forEach(function (part, i) {
      block(part, function (err, result) {
        if (err) return error(err);
        parts[i] = result;
        check();
      });
    });
    var done;
    check();
    function error(err) {
      if (done) return;
      done = true;
      callback(err);
    }
    function check() {
      if (done) return;
      while (parts.hasOwnProperty(index)) { index--; }
      if (index < 0) {
        done = true;
        callback(null, parts.join(""));
      }
    }
  },
  if: function (condition, block, callback) {
    if (condition) block({}, callback);
    else callback(null, "");
  }
};

// This is the external library.
function kernel(load, helpers) {

  // Regex to matches all template tags. Allows one level of parens within the arguments
  // Also allows basic expressions in double {{tags}}
  var tagRegex = /(\{[#\/]?([a-z$_][a-z0-9$_]*(\.[a-z$_][a-z0-9$_]*)*)(\([^)]*(\([^)]*\)[^)]*)*\))?\}|\{\{[^}]*(\{[^}]*\}[^}]*)*\}\})/ig;

  // Compiled kernel templates.  Stored by path.
  // Contain hash for simple invalidation.
  var compiledCache = {};

  return compile;

  function compile(path, callback) {
    var template;
    load(path, function (err, hash, fetch) {
      template = compiledCache[path];
      if (template && template.hash === hash) {
        return callback(null, template);
      }
      template = { hash: hash };
      fetch(onSource);
    });

    function onSource(err, source) {
      if (err) return callback(err);
      var tokens = tokenizer(source);
      var ast = parser(tokens, source, path);
      template.fn = gen(ast, helpers);
      compiledCache[path] = template;
      callback(null, template);
    }
  }

  function gen(ast, parent) {
    return function (data, callback) {
      data.__proto__ = parent;
      exec(ast, data, callback);
    };
  }

  // Execute a template
  function exec(node, data, callback) {
    if (!callback) return exec.bind(null, node, data);

    // Execute array parts in parallel.
    if (Array.isArray(node)) {
      var left = node.length;
      if (!left) return callback(null, "");
      var parts = new Array(left);
      var done = false;
      return node.forEach(function (piece, i) {
        exec(piece, data, function (err, part) {
          if (done) return;
          if (err) {
            done = true;
            return callback(err);
          }
          parts[i] = part;
          if (!--left) return callback(null, parts.join(""));
        });
      });
    }

    // Send strings back as-is
    if (typeof node === "string") {
      return callback(null, node);
    }

    // Execute async functions
    if (node.args) {
      var args = node.args.split(/,\s*/).map(function (name) {
        return data[name];
      });
      if (node.contents) {
        args.push(gen(node.contents, data));
      }
      args.push(callback);
      return data[node.name].apply(null, args);
    }

    // Variable replacement is simple.
    callback(null, data[node.name]);
  }



  // This lexes a source string into discrete tokens for easy parsing.
  function tokenizer(source) {
    var parts = [];
    var position = 0;
    tagRegex.index = 0;
    var match;
    while ((match = tagRegex.exec(source))) {
      var index = match.index;
      match = match[0];
      if (index > position) { // Raw text was before this tag
        parts.push(source.substr(position, index - position));
      }
      position = index + match.length;

      // Create a token and tag the position in the source file for error reporting.
      var obj = {start: index, end: position};
      var i;

      if (match[1] === "{") { // Raw expression
        obj.name = match.substr(2, match.length - 4);
      } else if (match[1] === "#") { // Open tag
        obj.open = true;
        if (match[match.length - 2] === ")") { // With arguments
          i = match.indexOf("(");
          obj.name = match.substr(2, i - 2);
          obj.args = match.substr(i + 1, match.length - i - 3);
        } else { // Without arguments
          obj.name = match.substr(2, match.length - 3);
        }
      } else if (match[1] === "/") { // Close tag
        obj.close = true;
        obj.name = match.substr(2, match.length - 3);
      } else { // Normal tag
        if (match[match.length - 2] === ")") { // With arguments
          i = match.indexOf("(");
          obj.name = match.substr(1, i - 1);
          obj.args = match.substr(i + 1, match.length - i - 3);
        } else { // Without arguments
          obj.name = match.substr(1, match.length - 2);
        }
      }
      parts.push(obj);
      tagRegex.lastIndex = position;
    }
    if (source.length > position) { // There is raw text left over
      parts.push(source.substr(position));
    }
    return parts;
  }

  function parser(tokens, source, filename) {
    var parts = [];
    var openStack = [];
    var i, l;
    var simple, top;
    for (i = 0, l = tokens.length; i < l; i++) {
      var token = tokens[i];
      if (typeof token === "string") {
        if (token[0] === "\n") token = token.substr(1);
        if (simple) simple.push(token);
        else parts.push(simple = [token]);
      } else if (token.open) {
        simple = false;
        token.parent = parts;
        parts.push(token);
        parts = token.contents = [];
        openStack.push(token);
      } else if (token.close) {
        simple = false;
        top = openStack.pop();
        if (top.name !== token.name) {
          throw new Error("Expected closer for " + stringify(source, top) + " but found " + stringify(source, token) + " " + getPosition(source, token.start, filename));
        }
        parts = top.parent;
        delete top.parent;
        delete top.open;
      } else {
        if (token.hasOwnProperty('args')) {
          simple = false;
          parts.push(token);
        } else {
          if (simple) simple.push(token);
          else parts.push(simple = [token]);
        }
      }
    }
    if (openStack.length) {
      top = openStack.pop();
      throw new Error("Expected closer for " + stringify(source, top) + " but reached end " + getPosition(source, top.end, filename));
    }
    return parts;
  }

  // Helper to show nicly formatter error messages with full file position.
  function getPosition(source, offset, filename) {
    var line = 0;
    var position = 0;
    var last = 0;
    for (position = 0; position >= 0 && position < offset; position = source.indexOf("\n", position + 1)) {
      line++;
      last = position;
    }
    return "(" + filename + ":" + line + ":" + (offset - last) + ")";
  }

  function stringify(source, token) {
    return source.substr(token.start, token.end-token.start);
  }


}

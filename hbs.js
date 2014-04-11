/**
 * @license Handlebars hbs 0.2.0 - Felix Kiunke, but Handlebars has it's own licensing junk
 *
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/require-cs for details on the plugin this was based off of
 */

/*jslint evil: true, strict: false, plusplus: false, regexp: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false, define: false, process: false, window: false */


/*
require.config.hbs = {
	basePath:    null, // The base path for templates.
	partialPath: null, // The path for partials. Can be relative to basePath (e.g. “./partials”), or absolute
	helperPath:  null, // Path for helpers. Can be relative to basePath

*/	


define(["hbs/handlebars"], function (Handlebars) {
	var fs, buildMap = [], _partials = {};

	var fetchText = function() { throw new Error("Unsupported environment.") };

	// Check if window object exists (if we are in a browser)
	if (typeof window !== "undefined") {
		fetchText = function (url, callback) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);
			xhr.onreadystatechange = function(evt) {
				if (xhr.readyState === 4) {
					if (xhr.status < 400) {
						callback(null, xhr.status < 400 ? xhr.responseText : null);
					} else {
						var err = new Error("Failed to load " + url);
						err.type = ""+xhr.status+"#"+xhr.statusText.toLowerCase().replace(/\W/g, "_");
						callback(err);
					}
				}
			};
			xhr.send(null);
		};
	} else if (typeof process !== "undefined" && process.versions && !!process.versions.node) {
		// Use require.nodeRequire, which is added by r.js.
		fs = require.nodeRequire("fs");
		fetchText = function (path, callback) {
			try {
				var body = fs.readFileSync(path, "utf8") || "";
				// Remove a possible BOM
				body = body.replace(/^\uFEFF/, "");
				callback(null, body);
			} catch(err) {
				callback(err);
			}
		};
	}

	function arrayUnique(array) {
		if (array == null) return [];

		var result = [], i;

		for (i = 0, length = array.length; i < length; i++)
			if (result.indexOf(array[i]) === -1) result.push(array[i]);

		return result;
	}

	function jsEscape(content) {
		return content.replace(/(['\\])/g, '\\$1').replace(/[\f]/g, "\\f").replace(/[\b]/g, "\\b")
			.replace(/[\n]/g, "\\n").replace(/[\t]/g, "\\t").replace(/[\r]/g, "\\r")
			.replace(/[\u2028]/g, "\\u2028").replace(/[\u2029]/g, "\\u2029");
	}

	// Normalize a path, eliminating e.g. occurences of “..” or double slashes where possible.
	function normalizePath(path) {
		var tokens = path.replace(/\/\/+/g,"/").split("/"), token,
			result = [], res, dotFirst = false;

		if (tokens[0] == ".") dotFirst = true;
		tokens = tokens.filter(function(tok) { return tok != "." })

		while ((token = tokens.shift()) != null) {
			if (token == ".." && result.length && result[result.length - 1] != "..") {
				if (result.length != 1 || result[0] != "")
					result.pop() == ".";
			} else {
				result.push(token);
			}
		}

		if (dotFirst && result[0] != "..") result.unshift(".");
		return result.length == 1 && result[0] == "" ? "/" : result.join("/");
	}

	// Adds basePath in front of path if path does not start with “.”, “..” or “/”.
	//  “.” and “..” are resolved against currentPath.
	// In the end, the toUrl function is applied to the result (if specified). This will probably
	//  be the RequireJS toUrl function that resolves paths relative to rules specified in its conf
	function resolvePath(path, basePath, currentPath, toUrl) {
		path = path || ""; basePath = basePath || ""; currentPath = currentPath || "";

		if (basePath.length && basePath[basePath.length - 1] != "/")
			basePath += "/";
		if (currentPath.length && currentPath[currentPath.length - 1] != "/")
			currentPath += "/";

		if (typeof toUrl !== "function") toUrl = function(p) {return p};

		if (/^\.\.?(\/|$)/.test(path))
			return normalizePath( toUrl(normalizePath(currentPath + path)) );
		else if (path[0] == "/")
			return normalizePath(path);
		else
			return normalizePath( toUrl(normalizePath(basePath + path)) );
	}
	window.resolve = resolvePath;

	return {
		get: function () {
			return Handlebars;
		},

		write: function (pluginName, name, write) {
			if ((name + "@hbs") in buildMap) {
				var text = buildMap[name + "@hbs"];
				write.asModule(pluginName + "!" + name, text);
			}
		},

		version: "0.2.0",

		load: function (name, parentRequire, onload, config) {
			var currentPath, currentDir,
				toUrl = parentRequire.toUrl; // Shortcut

			config.hbs = config.hbs || {};

			var basePath    = resolvePath(config.hbs.basePath,    "", "",      toUrl);
			var partialPath = resolvePath(config.hbs.partialPath, "", basePath, toUrl);
			var helperPath  = resolvePath(config.hbs.helperPath,  "", basePath, toUrl);

			currentPath = resolvePath(name, basePath, "", toUrl);
			currentDir  = currentPath.substr(0, currentPath.lastIndexOf('/') + 1);

			if (config.hbs.extension !== false)
				currentPath += "." + (config.hbs.extension || "hbs");

			function recursivePartialSearch(statements, res) {
				statements.forEach(function(stmt) {
					if (!stmt) return;

					if (stmt.type === "partial")
						res.push(stmt.partialName.name);

					if (stmt.program && stmt.program.statements)
						recursivePartialSearch(stmt.program.statements, res);

					if (stmt.inverse && stmt.inverse.statements)
						recursivePartialSearch(stmt.inverse.statements, res);
				});
				return res;
			}

			function findPartials(nodes) {
				var res = [];
				if (nodes && nodes.statements)
					return arrayUnique(recursivePartialSearch(nodes.statements, res));
				else
					return [];
			}

			function recursiveHelperSearch(statements, res) {

				statements.forEach(function(statement) {
					var i, len;
					var sideways;

					if (!statement) return;

					// if it's a mustache block
					if (statement.type === "mustache" &&
						statement.params && statement.params.length)
					{
						// As far as we’re concerned, this has to be a
						//  helper of some kind because it has parameters
						res.push(statement.id.string);

						// Look for SEXPRs (sub expressions as in “{{helper (helper2 "foo")}}”)
						//  and add the helper name in the sub expression to the result array
						statement.params.forEach(function(param) {
							if (param.type == "sexpr") res.push(param.id.string);
						});
					} else if (statement.type == "block" && statement.mustache && // Block helpers
					statement.program && statement.program.statements) {
						// Even empty blocks have a “program” (the contents of the block),
						// only with an empty statements array

						// If it's a block, we have to evaluate the node that
						// introduces the block (e.g. the {{#with}} or {{#helper}}):
						recursiveHelperSearch([statement.mustache], res);

						// Process the block’s contents
						recursiveHelperSearch(statement.program.statements, res);
						if (statement.inverse && statement.inverse.statements)
							recursiveHelperSearch(statement.inverse.statements, res);
					}
				});
				return res;
			}

			function findHelpers(nodes) {
				var res = [];

				if (nodes && nodes.statements)
					res = recursiveHelperSearch(nodes.statements, res);

				var builtinHelpers = [
					"each", "if", "unless", "with", "helperMissing", "blockHelperMissing"
				];

				return arrayUnique(res).filter(function(hlp) {
					return !!hlp && builtinHelpers.indexOf(hlp) < 0;
				});
			}

			function fetchAndRegister(path) {
				path = normalizePath(path);

				fetchText(path, function(err, text) {
					var nodes,
						partials, helpers, deps = [], depStr = "",
						options, precompiled, out;

					if (err)
						return onload.error(err);

					nodes = Handlebars.parse(text);

					options = config.hbs.compileOptions || {};

					partials = findPartials(nodes);
					helpers  = config.hbs.helpers != false ? findHelpers(nodes) : [];

					var deps = [];
					var depStr, helperDepStr, head, linkElem;

					partials.forEach(function(partial) {
						var path = resolvePath(partial,
							partialPath || basePath, currentDir, parentRequire.toUrl);

						// Different names can refer to the same partial (e.g. absolute vs.
						//  relative paths, so we have to keep track of that
						if (!_partials[path]) _partials[path] = [];
						_partials[path].push(partial);

						deps.push("hbs!" + path);
					});

					if (deps.length)    depStr = ",";

					depStr += deps.map(function(dep) {
						return "'" + jsEscape(dep) + "'";
					}).join(",");

					if (helpers.length) depStr += ",";

					depStr += arrayUnique(helpers.map(function(hlp) {
						function getHelperPath(helper, templatePath) {
							var p;

							// Find the helper file location in
							// helpers: { ".../filename": ["helperName1", "helperName2", ...] }
							if (typeof config.hbs.helpers == "object") {
								for (var k in config.hbs.helpers) {
									if (!config.hbs.helpers.hasOwnProperty(k) ||
										!Array.isArray(config.hbs.helpers[k]))
										continue;

									if (config.hbs.helpers[k].indexOf(helper) >= 0) {
										if (k == "") return null;
										p = k;
									}
								}
							}

							if (!p && config.hbs.helperCallback)
								p = config.hbs.helperCallback(helper, templatePath);
							else if (!p)
								p = helper;

							if (p) p += ".js";

							return resolvePath(p, helperPath || basePath, currentDir,
								parentRequire.toUrl);
						}

						var p = getHelperPath(hlp, path);
						return p == null ? null : "'" + jsEscape(p) + "'";
					}).filter(function(h) { return !!h })).join(",");

					precompiled = new Handlebars.JavaScriptCompiler().compile(
						new Handlebars.Compiler().compile(nodes, options),
						options);


					out = "/* START_TEMPLATE */\n" +
							"define(" +
								(config.isBuild ? "" : "'" + jsEscape(name) + "',") +
								"['hbs','hbs/handlebars'" + depStr + "], function(hbs, Handlebars) {\n" +
							"var t = Handlebars.template(" + precompiled + ");\n";

					(_partials[name] || []).forEach(function(ref) {
						out += "Handlebars.registerPartial('" + jsEscape(ref) + "', t);";
					});

					out += "return t;\n});\n/* END_TEMPLATE */\n";

					// if (document.body.children[0].tagName == "PRE")
					// 	document.body.innerHTML += "<pre style='border-top:10px solid #4080a0'>" + Handlebars.Utils.escapeExpression(out) + "</pre>";
					// else
					// 	document.body.parentNode.innerHTML = "<pre>" + Handlebars.Utils.escapeExpression(out) + "</pre>";

					if (config.isBuild) {
						// Keep the stuff if it’s a build
						buildMap[name + "@hbs"] = out;

						// Load the JS we just created as a module.
						// As of RequireJS 2.1.0, onload is automatically called
						//  after this has been executed.
						onload.fromText(out);
					} else {
						out += "\n//@ sourceURL=" + path; // For Firebug/browser console

						// We have to pull in the deps from above — or do we?
						require(deps, function () {
							onload.fromText(out); // Same as above
						}, function(err) {
							onload.error(err);
						});
					}

					if (config.removeCombined)
						fs.unlinkSync(path);
				});
			}

			fetchAndRegister(currentPath);
		}
	};
});
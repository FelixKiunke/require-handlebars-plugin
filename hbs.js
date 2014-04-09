/**
 * @license Handlebars hbs 0.8.0 - Felix Kiunke, but Handlebars has it's own licensing junk
 *
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/require-cs for details on the plugin this was based off of
 */

/*jslint evil: true, strict: false, plusplus: false, regexp: false */
/*global require: false, XMLHttpRequest: false, ActiveXObject: false, define: false, process: false, window: false */

define(["hbs/handlebars"], function (Handlebars) {
	var fs, filecode = "w+", buildMap = [];
	var templateExtension = "hbs";
	var devStyleDirectory = "/styles/";
	var buildStyleDirectory = "/demo-build/styles/";
	var helperDirectory = "templates/helpers/";
	var buildCSSFileName = "screen.build.css";

	var fetchText = function() { throw new Error("Environment unsupported.") };

	// Check if window object exists (if we are in a browser)
	if (typeof window !== "undefined") {
		fetchText = function (url, callback) {
			var xhr = new XMLHttpRequest();
			xhr.open("GET", url, true);
			xhr.onreadystatechange = function (evt) {
				//Do not explicitly handle errors, those should be visible via console output in the browser.
				// TODO: Properly handle errors
				if (xhr.readyState === 4)
					callback(xhr.status < 400 ? xhr.responseText : null);
			};
			xhr.send(null);
		};
	} else if (typeof process !== "undefined" && process.versions && !!process.versions.node) {
		//Using special require.nodeRequire, something added by r.js.
		fs = require.nodeRequire("fs");
		fetchText = function (path, callback) {
			var body = fs.readFileSync(path, "utf8") || "";
			// we need to remove BOM stuff from the file content
			body = body.replace(/^\uFEFF/, "");
			callback(body);
		};
	}

	var _partials = {};

	var cache = {};
/*	function fetchOrGetCached(path, callback) { // NOT USED
		if (cache[path]) {
			callback(cache[path]);
		} else {
			fetchText(path, function(data) {
				cache[path] = data;
				callback.call(this, data);
			});
		}
	};*/
	var styleList = [];
	var styleMap = {};

	function arrayUnique(array) {
		if (array == null) return [];

		var result = [], i;

		for (i = 0, length = array.length; i < length; i++)
			if (result.indexOf(array[i]) === -1) result.push(array[i]);

		return result;
	};

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

		version: "0.5.0",

		load: function (name, parentRequire, onload, config) {
			config.hbs = config.hbs || {};

			var partialsUrl = "";
			if(config.hbs.partialsUrl) {
				partialsUrl = config.hbs.partialsUrl;
				if(partialsUrl[partialsUrl.length - 1] != "/") partialsUrl += "/";
			}

			var partialDeps = [];

			function recursiveNodeSearch(statements, res) {
				statements.forEach(function(stmt) {
					if (!stmt) return;

					if (stmt.type === "partial")
						res.push(stmt.partialName.name);

					if (stmt.program && stmt.program.statements)
						recursiveNodeSearch(stmt.program.statements, res);

					if (stmt.inverse && stmt.inverse.statements)
						recursiveNodeSearch(stmt.inverse.statements, res);
				});
				return res;
			}

			function findPartialDeps(nodes) {
				var res = [];
				if (nodes && nodes.statements)
					return arrayUnique(recursiveNodeSearch(nodes.statements, res));
				else
					return [];
			}

			function composeParts(parts) {
				if (!parts) return [];

				var res = [parts[0]], cur = parts[0],
					i, len;

				for (i = 1, len = parts.length; i < len; i++) {
					if (parts.hasOwnProperty(i)) {
						cur += "." + parts[i];
						res.push(cur);
					}
				}
				return res;
			}

			function recursiveVarSearch(statements, res, prefix, helpersres) {
				prefix = prefix ? prefix + "." : "";

				var flag = false;

				statements.forEach(function(statement) {
					var i, len;
					var sideways;

					if (!statement) return;

					// if it's a mustache block
					if (statement.type === "mustache") {

						// No params, no helper
						if (!statement.params || !statement.params.length) {
							composeParts(statement.id.parts)
							.forEach(function(part) {
								if (part) res.push(prefix + part);
							});
						} else if (statement.params.length) {
							// As far as we’re concerned, this has to be a
							//  helper of some kind because it has params
							helpersres.push(statement.id.string);

							statement.params.forEach(function(param) {
								composeParts(param.parts)
								.forEach(function(part) {
									if (part) res.push(prefix + part);
								});
							});
						}
					} else if (statement.type == "block" && statement.mustache &&
					statement.program && statement.program.statements) {
						// Even empty blocks have a “program” (the contents of the block),
						// only with an empty statements array

						// If it's a block, we have to evaluate the parameters of the node that
						// introduces the block (e.g. the {{#with}} or {{#helper}})

						// TODO: We have to look for a new context -> new prefix which is introduced
						// by {{#with}} for instance. MIND YOU, #if blocks don’t introduce new contexts AFAIK
						recursiveVarSearch([statement.mustache], res, prefix, helpersres);
						// TODO: Process Sexpr (sub expressions as in “{{#helper (helper2 "foo")}}”)

						// TODO: Process block programs
					//	sideways = recursiveVarSearch([statement.mustache],[], "", helpersres)[0] || "";
					//	console.warn("SIDEWAYS: " + sideways);
					//	recursiveVarSearch(statement.program.statements, res, prefix + (sideways ? prefix ? ".XXX."+sideways : sideways : ""), helpersres);
					//	if (statement.inverse && statement.inverse.statements)
					//		recursiveVarSearch(statement.inverse.statements, res, prefix + (sideways ? prefix ? "."+sideways : sideways : ""), helpersres);
					}
				});
				return res;
			}

			// This finds the Helper dependencies since it's soooo similar --- ???
			function getExternalDeps(nodes) { // TODO: ...
				var res        = [];
				var helpersres = [];

				if (nodes && nodes.statements)
					res = recursiveVarSearch(nodes.statements, [], null, helpersres);

				var defaultHelpers = [
					"each",
					"if",
					"unless",
					"with"
				];

				return {
					vars: arrayUnique(res).map(function(e) {
						if (e === "")
							return ".";
						if (e[e.length - 1] === ".")
							return e.slice(0, -1) + "[]";
						return e;
					}),

					helpers: arrayUnique(helpersres).map(function(e){
						if (defaultHelpers.indexOf(e) >= 0)
							return undefined;
						else
							return e;
					}).filter(function(e) { return !!e }) // Remove falsy values
				};
			}

			// Normalize a path, removing e.g. occurences of “..” where possible.
			// Should be somewhat POSIX compliant, but you shouldn’t rely on that.
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

			function fetchAndRegister(path) {
				path = normalizePath(path);
				console.debug("->");
				console.log("GETTING "+path+"...");
				fetchText(path, function(text) {
					var nodes, partials, extDeps, vars, helpers, deps,
						i, len;

					if (text == null)
						throw new Error("UNABLE TO GET " + path);
					else
						console.info("GOT " + path)

					nodes = Handlebars.parse(text);

					partials = findPartialDeps(nodes);
					extDeps = getExternalDeps(nodes);
					vars = extDeps.vars;
					helpers = (extDeps.helpers || []);

				/*	console.log("-------- PARTIALS");
					console.log(partials);
					console.log("-------- EXT DEPS");
					console.log(extDeps);
					console.log("-------- ---- Vars");
					console.log(extDeps.vars);
					console.log("-------- ---- Helpers");
					console.log(extDeps.helpers);*/

					var deps = [];
					var depStr, helperDepStr, head, linkElem;
					var baseDir = name.substr(0, name.lastIndexOf('/') + 1);

					config.hbs = config.hbs || {};

					partials.forEach(function(partial) {
						var path;
						if(partial[0] == ".") // relative path
							path = normalizePath(baseDir + partial)
						else if (partial[0] == "/") // Absolute path
							path = normalizePath(partial);
						else // path relative to config.hbs.partialsUrl (if defined)
							path = normalizePath(partialsUrl + partial);

						if (!_partials[path]) _partials[path] = [];

						// We can reference the same partial via different paths
						// (e.g. absolute vs. relative)
						_partials[path].references = _partials[path].references || [];
						_partials[path].references.push(partial);

						config.hbs._loadedDeps = config.hbs._loadedDeps || {};

						deps.push("hbs!" + path);
					});

					depStr = deps.map(function(dep) {
						return "'" + dep.replace(/'/g, "\\'") + "'"
					}).join(",");

					if (config.hbs.helpers == false) {
						helperDepStr = "";
					} else {
						// TODO: Allow for definitions of helpers in the form
						//   {"path/templates/helper": ["definedHelper1", "definedHelper2"]}
						helperDepStr = (function () {
							var paths = [];

							function getPath(helper, templatePath) {
								if (config.hbs && config.hbs.helperPathCallback)
									return config.hbs.helperPathCallback(helper, templatePath);
								else if (config.hbs && config.hbs.helperDirectory)
									return config.hbs.helperDirectory + name;
								else
									return helperDirectory + name;
							}

							helpers.forEach(function(hlp) {
								paths.push("'" + getPath(hlp, path).replace(/'/g, "\\'") + "'");
							});
							return paths.join(",");
						})();
					}


					var options = config.hbs.compileOptions || {};

					var precompiled = new Handlebars.JavaScriptCompiler().compile(
						new Handlebars.Compiler().compile(nodes, options),
						options);

					if (depStr)       depStr       = "," + depStr;
					if (helperDepStr) helperDepStr = "," + helperDepStr;

					var out = "/* START_TEMPLATE */\n" +
							"define(" +
								(config.isBuild ? "" : "'" + name.replace(/'/g, "\\'") + "',") +
								"['hbs','hbs/handlebars'" + depStr + helperDepStr+"], function(hbs, Handlebars) {\n" +
							"var t = Handlebars.template(" + precompiled + ");\n";

					// TODO partials
					(_partials[name] ? _partials[name].references : []).forEach(function(ref) {
						out += "Handlebars.registerPartial('" + ref.replace(/'/g, "\\'") + "', t);";
					});

					if (!config.isBuild) {
						// TODO: We don’t need this shit, do we? If not, we can finally remove those
						//  fucking vars in getExternalDeps
						out += "t.helpers = " + JSON.stringify(helpers) + ";\n" +
								"t.vars = " + JSON.stringify(vars) + ";\n";
					}

					out += "return t;\n});\n/* END_TEMPLATE */\n";

					/*if (document.body.children[0].tagName == "PRE")
						document.body.innerHTML += "<pre style='border-top:10px solid #4080a0'>" + Handlebars.Utils.escapeExpression(out) + "</pre>";
					else
						document.body.parentNode.innerHTML = "<pre>" + Handlebars.Utils.escapeExpression(out) + "</pre>";*/

					if (config.isBuild) {
						// Keep the stuff if it’s a build
						buildMap[name + "@hbs"] = out;

						// Load the JS we just created as a module.
						// As of require.js 2.1.0, onload is automatically called
						//  after this has been executed.
						onload.fromText(out);
					}
					else {
						out += '\r\n//@ sourceURL=' + path;
						// We have to pull in the deps from above
						console.log("LOADING DEPS",deps, path)
						require(deps, function () {
							console.log("LOADED" , deps, path)
							console.log("EXECUTING", path);
							onload.fromText(out); // Same as above
							console.debug("<-");
						});
					}

					if (config.removeCombined)
						fs.unlinkSync(path);
				});
			}

			if (config.hbs.templateExtension === false) { // Don’t add an extension
				fetchAndRegister(parentRequire.toUrl(name));
			} else {
				fetchAndRegister(parentRequire.toUrl(name + "." + (config.hbs.templateExtension || "hbs")));
			}
		}
	};
});
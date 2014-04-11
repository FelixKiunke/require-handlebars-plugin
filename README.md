# Require.js Handlebars Plugin

**Table of Contents**: [Version](#version) • [Requirements](#requirements) •
[Usage Example](#usage_example) • [Installation](#installation) • [Configuration](#configuration) •
[Using helpers](#helpers) • [Builds](#builds) • [Notes](#notes) •
[Other Templating Languages](#other_templating_languages) • [License](#license)

## Version

Handlebars : `v1.3.0`

**hbs.js**:     `v0.2.0`

## Requirements

* Node.js (optional; for the build environment).
* Require.js >= 2.1.x

## Usage Example

**/templates/one.hbs:**

```html
<div>
	This is my {{adjective}} template.

	{{! To include a partial, just provide the path to the partial without the extension: }}
	{{>test}}

	{{! the path can also be relative to the current template: }}
	{{>./partials/test}}

	{{! For more on how partial paths are resolved, see below! }}
</div>
```

The partial: **/templates/paritals/test.hbs**

```html
<div>
	{{! This could obviously include subsequent partials as well }}
		
	Hello, I am {{name}}!
</div>
```

The configuration and app:
```javascript
require.config({
	paths: {
			hbs: "lib/require-handlebars-plugin/hbs" // show RequireJS where the plugin is
		},
	hbs: {
			baseDir:    "templates",
				partialDir: "./partials" // relative to baseDir
		}
});

require(["a", "b", "hbs!one"], // The path can be relative to baseDir
function( a ,  b,  tmplOne) {
	var data = {
		adjective: "first",
		name:      "anonymous"
	};
	var output = template(data);
		document.body.innerHtml = output;
});
```

**This would render as:**

```html
<div>
	This is my first template.

	<div>
		Hello, I am anonymous!
	</div>
		
	<div>
		Hello, I am anonymous!
	</div>
</div>
```

## Installation
Add the plugin to your project (typically in you `lib/` directory) and make sure you tell RequireJS where the `hbs` plugin sits in the configuration (for the plugin’s options, [see below](#configuration)):

```javascript
require.config({
	paths: {
		hbs: "lib/require-handlebars-plugin/hbs"
	},
	hbs: { ... },
	...
});
```

Then require your templates like this:

```javascript
require(["hbs!path"], function (template) {
	var context = { ... };
	// “template” is the function that renders the template with your data
	document.body.innerHTML = template(context);
});
```

# Configuration

There are several configurable options, which you can set in your require.config:

```javascript
require.config({
	// Configuration for RequireJS here
	...

	// Handlebars plugin config
	hbs: {
		basePath:       null,   // The base path for templates. This will be resolved like
								// other RequireJS paths, i.e. “path” rules will be applied
								// and it will be relative to the RequireJS baseUrl if the
								// path is not absolute (starts with a slash).
								// If basePath is null (default) or empty, you’ll have to
								// give the full template path in every require() call.

		partialPath:    null,   // The default path for partials. This can be relative to
								// baseDir and will also be resolved by RequireJS rules.

		helperPath:     null,   // The default path for helper functions. This can be
								// relative to basePath as well and will be resolved just
								// like partialPath.

		helpers:        {}      // An object that can contains a mapping of files to
								// helpers. See below for more information on helpers.
								// This can also be false, meaning that the plugin will
								// never try to find a file that contains a certain helper.

		helperCallback: null,   // A function that is passed a helper’s name and the
								// current templates full path and filename and that
								// returns the path of the helper’s file. This will only
								// be called if there’s no matching definition in
								// the “helpers” option. The returned path will be resolved
								// relative to helperPath if it’s not absolute. Mind you,
								// this is *not* an asynchronous function.

		extension:      "hbs",  // The extension for template files. Default: hbs

		compileOptions: {}      // An options object for the Handlebars compiler.
								// You probably won’t ever need this.
	}
})
```

# Helpers

Just like partials, all helpers will be loaded automagically as long as their location is clear.

All helpers must be of the form:

```javascript
define(["hbs/handlebars"], function (Handlebars) {
	function helper(context, options) {
		return "Something";
	}
	Handlebars.registerHelper("helperName", helper);

	// You can put more than one helper in one file, just make sure to register it as well!

	// The following is optional but is good practice, especially if the file contains helper
	//  functions that might be useful in regular code as well.
	return helper;
});
```

**Make sure you use the correct path for the Handlebars script, incorrect paths can lead to strange and confusing errors!**

However the plugin has to know where your helpers are located. There are several configuration options for this:

* The `helperPath` option. This defines the base path where all helper files are expected if their path is not absolute (starts with a slash)

* The `helpers` object. This maps one file to an array of helpers said file contains, i.e.:
```javascript
{
	"filename": ["helper1", "helper2", "helper3"]
}
```
This way, you can include multiple helpers in one js file. If you don’t want to load a file for a helper at all (for example if the helper has also been registered elsewhere), simply assign an empty string to it, like so:
```javascript
{
	"": ["helper1", "helper2", "helper3"] // Yes, this is possible in JavaScript!
}
```

* The `helperCallback`. You can assign a function to this and it will be called everytime a helper isn’t found in the `helpers` object (or, if there is no `helpers` object at all). Two parameters will be passed to the function: The helper name and the path of the current template. It is expected to return a path where the helper can be found. If the path is not an absolute one, it will be resolved based on `helperPath`.

# Builds

As long as all of your paths match up, this should precompile all of your templates and include them in the build.

# Notes

**Templates not loading cross-domain**

In dev mode, loading the templates requires that you are on the same domain as your templates. This is standard same origin policy stuff. Once you build, though, it won't matter since there are no additional requests. Usually a few cleverly placed host overrides get you through the dev mode hurdles.

# Other Templating Languages

_Very_ little of this is specific to handlebars, but things are just a _tiny_ bit too specific about how everything works to properly generalize this.

If you'd like to implement this for your templating language of choice, you'll need:

* Has a pre-compile type functionality (unless you don't care about builds)
* If it has some concept of partials, that you can register them externally
* It eventually returns a function that takes data context and outputs something you can deal with.
* You'll need some fancy regex or an AST to walk through.

I'd just turn your template language into a module first (just the old global name, or whatever), then look through the references to `Handlebars` in `hbs.js` and see if your templating language does something similar. It's not a terribly complicated process.

# License

Most of the code in this is from James Burke and Yehuda Katz in require.js and handlebars.js (respectively). Those projects are under their own license.

The [original version](https://github.com/SlexAxton/require-handlebars-plugin) of this plugin was written by Alex Sexton and released under the WTFPL.

Any code changed or added by me is released under the WTF public license as well.
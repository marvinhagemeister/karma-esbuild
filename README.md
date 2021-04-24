# karma-esbuild

An [esbuild](https://github.com/evanw/esbuild) preprocessor for the karma test runner. The main benefits of `esbuild` is speed and readability of the compiled output.

## Installation

```bash
npm install --save-dev karma-esbuild
```

## Usage

Add `esbuild` as your preprocessor inside your `karma.conf.js`:

```js
module.exports = function (config) {
	config.set({
		preprocessors: {
			// Add esbuild to your preprocessors
			"test/**/*.test.js": ["esbuild"],
		},
	});
};
```

### Advanced: Custom configuration

A custom esbuild configuration can be passed via an additional property on karma's config. Check out the [documentation for esbuild](https://esbuild.github.io/api/) for available options.

```js
module.exports = function (config) {
	config.set({
		preprocessors: {
			// Add esbuild to your preprocessors
			"test/**/*.test.js": ["esbuild"],
		},

		esbuild: {
			// Replace some global variables
			define: {
				COVERAGE: coverage,
				"process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV || ""),
				ENABLE_PERFORMANCE: true,
			},
			plugins: [createEsbuildPlugin()],

			// Karma-esbuild specific options
			singleBundle: true, // Merge all test files into one bundle(default: true)
		},
	});
};
```

## License

`MIT`, see [the LICENSE](./LICENSE) file.

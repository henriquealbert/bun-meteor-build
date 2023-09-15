Package["core-runtime"].queue("webapp", ["meteor", "ecmascript", "logging", "underscore", "routepolicy", "modern-browsers", "boilerplate-generator", "webapp-hashing", "inter-process-messaging", "callback-hook", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var _ = Package.underscore._;
var RoutePolicy = Package.routepolicy.RoutePolicy;
var Boilerplate = Package['boilerplate-generator'].Boilerplate;
var WebAppHashing = Package['webapp-hashing'].WebAppHashing;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var WebApp, WebAppInternals, main;

var require = meteorInstall({"node_modules":{"meteor":{"webapp":{"webapp_server.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/webapp/webapp_server.js                                                                        //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
!module.wrapAsync(async function (module1, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module1.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    module1.export({
      WebApp: () => WebApp,
      WebAppInternals: () => WebAppInternals
    });
    let assert;
    module1.link("assert", {
      default(v) {
        assert = v;
      }
    }, 0);
    let readFileSync, chmodSync, chownSync;
    module1.link("fs", {
      readFileSync(v) {
        readFileSync = v;
      },
      chmodSync(v) {
        chmodSync = v;
      },
      chownSync(v) {
        chownSync = v;
      }
    }, 1);
    let createServer;
    module1.link("http", {
      createServer(v) {
        createServer = v;
      }
    }, 2);
    let userInfo;
    module1.link("os", {
      userInfo(v) {
        userInfo = v;
      }
    }, 3);
    let pathJoin, pathDirname;
    module1.link("path", {
      join(v) {
        pathJoin = v;
      },
      dirname(v) {
        pathDirname = v;
      }
    }, 4);
    let parseUrl;
    module1.link("url", {
      parse(v) {
        parseUrl = v;
      }
    }, 5);
    let createHash;
    module1.link("crypto", {
      createHash(v) {
        createHash = v;
      }
    }, 6);
    let express;
    module1.link("express", {
      default(v) {
        express = v;
      }
    }, 7);
    let compress;
    module1.link("compression", {
      default(v) {
        compress = v;
      }
    }, 8);
    let cookieParser;
    module1.link("cookie-parser", {
      default(v) {
        cookieParser = v;
      }
    }, 9);
    let qs;
    module1.link("qs", {
      default(v) {
        qs = v;
      }
    }, 10);
    let parseRequest;
    module1.link("parseurl", {
      default(v) {
        parseRequest = v;
      }
    }, 11);
    let lookupUserAgent;
    module1.link("useragent", {
      lookup(v) {
        lookupUserAgent = v;
      }
    }, 12);
    let isModern;
    module1.link("meteor/modern-browsers", {
      isModern(v) {
        isModern = v;
      }
    }, 13);
    let send;
    module1.link("send", {
      default(v) {
        send = v;
      }
    }, 14);
    let removeExistingSocketFile, registerSocketFileCleanup;
    module1.link("./socket_file.js", {
      removeExistingSocketFile(v) {
        removeExistingSocketFile = v;
      },
      registerSocketFileCleanup(v) {
        registerSocketFileCleanup = v;
      }
    }, 15);
    let cluster;
    module1.link("cluster", {
      default(v) {
        cluster = v;
      }
    }, 16);
    let whomst;
    module1.link("@vlasky/whomst", {
      default(v) {
        whomst = v;
      }
    }, 17);
    let onMessage;
    module1.link("meteor/inter-process-messaging", {
      onMessage(v) {
        onMessage = v;
      }
    }, 18);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var SHORT_SOCKET_TIMEOUT = 5 * 1000;
    var LONG_SOCKET_TIMEOUT = 120 * 1000;
    const createExpressApp = () => {
      const app = express();
      // Security and performace headers
      // these headers come from these docs: https://expressjs.com/en/api.html#app.settings.table
      app.set('x-powered-by', false);
      app.set('etag', false);
      return app;
    };
    const WebApp = {};
    const WebAppInternals = {};
    const hasOwn = Object.prototype.hasOwnProperty;
    WebAppInternals.NpmModules = {
      express: {
        version: Npm.require('express/package.json').version,
        module: express
      }
    };

    // Though we might prefer to use web.browser (modern) as the default
    // architecture, safety requires a more compatible defaultArch.
    WebApp.defaultArch = 'web.browser.legacy';

    // XXX maps archs to manifests
    WebApp.clientPrograms = {};

    // XXX maps archs to program path on filesystem
    var archPath = {};
    var bundledJsCssUrlRewriteHook = function (url) {
      var bundledPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '';
      return bundledPrefix + url;
    };
    var sha1 = function (contents) {
      var hash = createHash('sha1');
      hash.update(contents);
      return hash.digest('hex');
    };
    function shouldCompress(req, res) {
      if (req.headers['x-no-compression']) {
        // don't compress responses with this request header
        return false;
      }

      // fallback to standard filter function
      return compress.filter(req, res);
    }

    // #BrowserIdentification
    //
    // We have multiple places that want to identify the browser: the
    // unsupported browser page, the appcache package, and, eventually
    // delivering browser polyfills only as needed.
    //
    // To avoid detecting the browser in multiple places ad-hoc, we create a
    // Meteor "browser" object. It uses but does not expose the npm
    // useragent module (we could choose a different mechanism to identify
    // the browser in the future if we wanted to).  The browser object
    // contains
    //
    // * `name`: the name of the browser in camel case
    // * `major`, `minor`, `patch`: integers describing the browser version
    //
    // Also here is an early version of a Meteor `request` object, intended
    // to be a high-level description of the request without exposing
    // details of connect's low-level `req`.  Currently it contains:
    //
    // * `browser`: browser identification object described above
    // * `url`: parsed url, including parsed query params
    //
    // As a temporary hack there is a `categorizeRequest` function on WebApp which
    // converts a connect `req` to a Meteor `request`. This can go away once smart
    // packages such as appcache are being passed a `request` object directly when
    // they serve content.
    //
    // This allows `request` to be used uniformly: it is passed to the html
    // attributes hook, and the appcache package can use it when deciding
    // whether to generate a 404 for the manifest.
    //
    // Real routing / server side rendering will probably refactor this
    // heavily.

    // e.g. "Mobile Safari" => "mobileSafari"
    var camelCase = function (name) {
      var parts = name.split(' ');
      parts[0] = parts[0].toLowerCase();
      for (var i = 1; i < parts.length; ++i) {
        parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].substr(1);
      }
      return parts.join('');
    };
    var identifyBrowser = function (userAgentString) {
      var userAgent = lookupUserAgent(userAgentString);
      return {
        name: camelCase(userAgent.family),
        major: +userAgent.major,
        minor: +userAgent.minor,
        patch: +userAgent.patch
      };
    };

    // XXX Refactor as part of implementing real routing.
    WebAppInternals.identifyBrowser = identifyBrowser;
    WebApp.categorizeRequest = function (req) {
      if (req.browser && req.arch && typeof req.modern === 'boolean') {
        // Already categorized.
        return req;
      }
      const browser = identifyBrowser(req.headers['user-agent']);
      const modern = isModern(browser);
      const path = typeof req.pathname === 'string' ? req.pathname : parseRequest(req).pathname;
      const categorized = {
        browser,
        modern,
        path,
        arch: WebApp.defaultArch,
        url: parseUrl(req.url, true),
        dynamicHead: req.dynamicHead,
        dynamicBody: req.dynamicBody,
        headers: req.headers,
        cookies: req.cookies
      };
      const pathParts = path.split('/');
      const archKey = pathParts[1];
      if (archKey.startsWith('__')) {
        const archCleaned = 'web.' + archKey.slice(2);
        if (hasOwn.call(WebApp.clientPrograms, archCleaned)) {
          pathParts.splice(1, 1); // Remove the archKey part.
          return Object.assign(categorized, {
            arch: archCleaned,
            path: pathParts.join('/')
          });
        }
      }

      // TODO Perhaps one day we could infer Cordova clients here, so that we
      // wouldn't have to use prefixed "/__cordova/..." URLs.
      const preferredArchOrder = isModern(browser) ? ['web.browser', 'web.browser.legacy'] : ['web.browser.legacy', 'web.browser'];
      for (const arch of preferredArchOrder) {
        // If our preferred arch is not available, it's better to use another
        // client arch that is available than to guarantee the site won't work
        // by returning an unknown arch. For example, if web.browser.legacy is
        // excluded using the --exclude-archs command-line option, legacy
        // clients are better off receiving web.browser (which might actually
        // work) than receiving an HTTP 404 response. If none of the archs in
        // preferredArchOrder are defined, only then should we send a 404.
        if (hasOwn.call(WebApp.clientPrograms, arch)) {
          return Object.assign(categorized, {
            arch
          });
        }
      }
      return categorized;
    };

    // HTML attribute hooks: functions to be called to determine any attributes to
    // be added to the '<html>' tag. Each function is passed a 'request' object (see
    // #BrowserIdentification) and should return null or object.
    var htmlAttributeHooks = [];
    var getHtmlAttributes = function (request) {
      var combinedAttributes = {};
      _.each(htmlAttributeHooks || [], function (hook) {
        var attributes = hook(request);
        if (attributes === null) return;
        if (typeof attributes !== 'object') throw Error('HTML attribute hook must return null or object');
        _.extend(combinedAttributes, attributes);
      });
      return combinedAttributes;
    };
    WebApp.addHtmlAttributeHook = function (hook) {
      htmlAttributeHooks.push(hook);
    };

    // Serve app HTML for this URL?
    var appUrl = function (url) {
      if (url === '/favicon.ico' || url === '/robots.txt') return false;

      // NOTE: app.manifest is not a web standard like favicon.ico and
      // robots.txt. It is a file name we have chosen to use for HTML5
      // appcache URLs. It is included here to prevent using an appcache
      // then removing it from poisoning an app permanently. Eventually,
      // once we have server side routing, this won't be needed as
      // unknown URLs with return a 404 automatically.
      if (url === '/app.manifest') return false;

      // Avoid serving app HTML for declared routes such as /sockjs/.
      if (RoutePolicy.classify(url)) return false;

      // we currently return app HTML on all URLs by default
      return true;
    };

    // We need to calculate the client hash after all packages have loaded
    // to give them a chance to populate __meteor_runtime_config__.
    //
    // Calculating the hash during startup means that packages can only
    // populate __meteor_runtime_config__ during load, not during startup.
    //
    // Calculating instead it at the beginning of main after all startup
    // hooks had run would allow packages to also populate
    // __meteor_runtime_config__ during startup, but that's too late for
    // autoupdate because it needs to have the client hash at startup to
    // insert the auto update version itself into
    // __meteor_runtime_config__ to get it to the client.
    //
    // An alternative would be to give autoupdate a "post-start,
    // pre-listen" hook to allow it to insert the auto update version at
    // the right moment.

    Meteor.startup(function () {
      function getter(key) {
        return function (arch) {
          arch = arch || WebApp.defaultArch;
          const program = WebApp.clientPrograms[arch];
          const value = program && program[key];
          // If this is the first time we have calculated this hash,
          // program[key] will be a thunk (lazy function with no parameters)
          // that we should call to do the actual computation.
          return typeof value === 'function' ? program[key] = value() : value;
        };
      }
      WebApp.calculateClientHash = WebApp.clientHash = getter('version');
      WebApp.calculateClientHashRefreshable = getter('versionRefreshable');
      WebApp.calculateClientHashNonRefreshable = getter('versionNonRefreshable');
      WebApp.calculateClientHashReplaceable = getter('versionReplaceable');
      WebApp.getRefreshableAssets = getter('refreshableAssets');
    });

    // When we have a request pending, we want the socket timeout to be long, to
    // give ourselves a while to serve it, and to allow sockjs long polls to
    // complete.  On the other hand, we want to close idle sockets relatively
    // quickly, so that we can shut down relatively promptly but cleanly, without
    // cutting off anyone's response.
    WebApp._timeoutAdjustmentRequestCallback = function (req, res) {
      // this is really just req.socket.setTimeout(LONG_SOCKET_TIMEOUT);
      req.setTimeout(LONG_SOCKET_TIMEOUT);
      // Insert our new finish listener to run BEFORE the existing one which removes
      // the response from the socket.
      var finishListeners = res.listeners('finish');
      // XXX Apparently in Node 0.12 this event was called 'prefinish'.
      // https://github.com/joyent/node/commit/7c9b6070
      // But it has switched back to 'finish' in Node v4:
      // https://github.com/nodejs/node/pull/1411
      res.removeAllListeners('finish');
      res.on('finish', function () {
        res.setTimeout(SHORT_SOCKET_TIMEOUT);
      });
      _.each(finishListeners, function (l) {
        res.on('finish', l);
      });
    };

    // Will be updated by main before we listen.
    // Map from client arch to boilerplate object.
    // Boilerplate object has:
    //   - func: XXX
    //   - baseData: XXX
    var boilerplateByArch = {};

    // Register a callback function that can selectively modify boilerplate
    // data given arguments (request, data, arch). The key should be a unique
    // identifier, to prevent accumulating duplicate callbacks from the same
    // call site over time. Callbacks will be called in the order they were
    // registered. A callback should return false if it did not make any
    // changes affecting the boilerplate. Passing null deletes the callback.
    // Any previous callback registered for this key will be returned.
    const boilerplateDataCallbacks = Object.create(null);
    WebAppInternals.registerBoilerplateDataCallback = function (key, callback) {
      const previousCallback = boilerplateDataCallbacks[key];
      if (typeof callback === 'function') {
        boilerplateDataCallbacks[key] = callback;
      } else {
        assert.strictEqual(callback, null);
        delete boilerplateDataCallbacks[key];
      }

      // Return the previous callback in case the new callback needs to call
      // it; for example, when the new callback is a wrapper for the old.
      return previousCallback || null;
    };

    // Given a request (as returned from `categorizeRequest`), return the
    // boilerplate HTML to serve for that request.
    //
    // If a previous connect middleware has rendered content for the head or body,
    // returns the boilerplate with that content patched in otherwise
    // memoizes on HTML attributes (used by, eg, appcache) and whether inline
    // scripts are currently allowed.
    // XXX so far this function is always called with arch === 'web.browser'
    function getBoilerplate(request, arch) {
      return getBoilerplateAsync(request, arch);
    }

    /**
     * @summary Takes a runtime configuration object and
     * returns an encoded runtime string.
     * @locus Server
     * @param {Object} rtimeConfig
     * @returns {String}
     */
    WebApp.encodeRuntimeConfig = function (rtimeConfig) {
      return JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
    };

    /**
     * @summary Takes an encoded runtime string and returns
     * a runtime configuration object.
     * @locus Server
     * @param {String} rtimeConfigString
     * @returns {Object}
     */
    WebApp.decodeRuntimeConfig = function (rtimeConfigStr) {
      return JSON.parse(decodeURIComponent(JSON.parse(rtimeConfigStr)));
    };
    const runtimeConfig = {
      // hooks will contain the callback functions
      // set by the caller to addRuntimeConfigHook
      hooks: new Hook(),
      // updateHooks will contain the callback functions
      // set by the caller to addUpdatedNotifyHook
      updateHooks: new Hook(),
      // isUpdatedByArch is an object containing fields for each arch
      // that this server supports.
      // - Each field will be true when the server updates the runtimeConfig for that arch.
      // - When the hook callback is called the update field in the callback object will be
      // set to isUpdatedByArch[arch].
      // = isUpdatedyByArch[arch] is reset to false after the callback.
      // This enables the caller to cache data efficiently so they do not need to
      // decode & update data on every callback when the runtimeConfig is not changing.
      isUpdatedByArch: {}
    };

    /**
     * @name addRuntimeConfigHookCallback(options)
     * @locus Server
     * @isprototype true
     * @summary Callback for `addRuntimeConfigHook`.
     *
     * If the handler returns a _falsy_ value the hook will not
     * modify the runtime configuration.
     *
     * If the handler returns a _String_ the hook will substitute
     * the string for the encoded configuration string.
     *
     * **Warning:** the hook does not check the return value at all it is
     * the responsibility of the caller to get the formatting correct using
     * the helper functions.
     *
     * `addRuntimeConfigHookCallback` takes only one `Object` argument
     * with the following fields:
     * @param {Object} options
     * @param {String} options.arch The architecture of the client
     * requesting a new runtime configuration. This can be one of
     * `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.request
     * A NodeJs [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
     * https://nodejs.org/api/http.html#http_class_http_incomingmessage
     * `Object` that can be used to get information about the incoming request.
     * @param {String} options.encodedCurrentConfig The current configuration object
     * encoded as a string for inclusion in the root html.
     * @param {Boolean} options.updated `true` if the config for this architecture
     * has been updated since last called, otherwise `false`. This flag can be used
     * to cache the decoding/encoding for each architecture.
     */

    /**
     * @summary Hook that calls back when the meteor runtime configuration,
     * `__meteor_runtime_config__` is being sent to any client.
     *
     * **returns**: <small>_Object_</small> `{ stop: function, callback: function }`
     * - `stop` <small>_Function_</small> Call `stop()` to stop getting callbacks.
     * - `callback` <small>_Function_</small> The passed in `callback`.
     * @locus Server
     * @param {addRuntimeConfigHookCallback} callback
     * See `addRuntimeConfigHookCallback` description.
     * @returns {Object} {{ stop: function, callback: function }}
     * Call the returned `stop()` to stop getting callbacks.
     * The passed in `callback` is returned also.
     */
    WebApp.addRuntimeConfigHook = function (callback) {
      return runtimeConfig.hooks.register(callback);
    };
    function getBoilerplateAsync(request, arch) {
      let boilerplate = boilerplateByArch[arch];
      runtimeConfig.hooks.forEach(hook => {
        const meteorRuntimeConfig = hook({
          arch,
          request,
          encodedCurrentConfig: boilerplate.baseData.meteorRuntimeConfig,
          updated: runtimeConfig.isUpdatedByArch[arch]
        });
        if (!meteorRuntimeConfig) return true;
        boilerplate.baseData = Object.assign({}, boilerplate.baseData, {
          meteorRuntimeConfig
        });
        return true;
      });
      runtimeConfig.isUpdatedByArch[arch] = false;
      const data = Object.assign({}, boilerplate.baseData, {
        htmlAttributes: getHtmlAttributes(request)
      }, _.pick(request, 'dynamicHead', 'dynamicBody'));
      let madeChanges = false;
      let promise = Promise.resolve();
      Object.keys(boilerplateDataCallbacks).forEach(key => {
        promise = promise.then(() => {
          const callback = boilerplateDataCallbacks[key];
          return callback(request, data, arch);
        }).then(result => {
          // Callbacks should return false if they did not make any changes.
          if (result !== false) {
            madeChanges = true;
          }
        });
      });
      return promise.then(() => ({
        stream: boilerplate.toHTMLStream(data),
        statusCode: data.statusCode,
        headers: data.headers
      }));
    }

    /**
     * @name addUpdatedNotifyHookCallback(options)
     * @summary callback handler for `addupdatedNotifyHook`
     * @isprototype true
     * @locus Server
     * @param {Object} options
     * @param {String} options.arch The architecture that is being updated.
     * This can be one of `web.browser`, `web.browser.legacy` or `web.cordova`.
     * @param {Object} options.manifest The new updated manifest object for
     * this `arch`.
     * @param {Object} options.runtimeConfig The new updated configuration
     * object for this `arch`.
     */

    /**
     * @summary Hook that runs when the meteor runtime configuration
     * is updated.  Typically the configuration only changes during development mode.
     * @locus Server
     * @param {addUpdatedNotifyHookCallback} handler
     * The `handler` is called on every change to an `arch` runtime configuration.
     * See `addUpdatedNotifyHookCallback`.
     * @returns {Object} {{ stop: function, callback: function }}
     */
    WebApp.addUpdatedNotifyHook = function (handler) {
      return runtimeConfig.updateHooks.register(handler);
    };
    WebAppInternals.generateBoilerplateInstance = function (arch, manifest, additionalOptions) {
      additionalOptions = additionalOptions || {};
      runtimeConfig.isUpdatedByArch[arch] = true;
      const rtimeConfig = _objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || {});
      runtimeConfig.updateHooks.forEach(cb => {
        cb({
          arch,
          manifest,
          runtimeConfig: rtimeConfig
        });
        return true;
      });
      const meteorRuntimeConfig = JSON.stringify(encodeURIComponent(JSON.stringify(rtimeConfig)));
      return new Boilerplate(arch, manifest, Object.assign({
        pathMapper(itemPath) {
          return pathJoin(archPath[arch], itemPath);
        },
        baseDataExtension: {
          additionalStaticJs: _.map(additionalStaticJs || [], function (contents, pathname) {
            return {
              pathname: pathname,
              contents: contents
            };
          }),
          // Convert to a JSON string, then get rid of most weird characters, then
          // wrap in double quotes. (The outermost JSON.stringify really ought to
          // just be "wrap in double quotes" but we use it to be safe.) This might
          // end up inside a <script> tag so we need to be careful to not include
          // "</script>", but normal {{spacebars}} escaping escapes too much! See
          // https://github.com/meteor/meteor/issues/3730
          meteorRuntimeConfig,
          meteorRuntimeHash: sha1(meteorRuntimeConfig),
          rootUrlPathPrefix: __meteor_runtime_config__.ROOT_URL_PATH_PREFIX || '',
          bundledJsCssUrlRewriteHook: bundledJsCssUrlRewriteHook,
          sriMode: sriMode,
          inlineScriptsAllowed: WebAppInternals.inlineScriptsAllowed(),
          inline: additionalOptions.inline
        }
      }, additionalOptions));
    };

    // A mapping from url path to architecture (e.g. "web.browser") to static
    // file information with the following fields:
    // - type: the type of file to be served
    // - cacheable: optionally, whether the file should be cached or not
    // - sourceMapUrl: optionally, the url of the source map
    //
    // Info also contains one of the following:
    // - content: the stringified content that should be served at this path
    // - absolutePath: the absolute path on disk to the file

    // Serve static files from the manifest or added with
    // `addStaticJs`. Exported for tests.
    WebAppInternals.staticFilesMiddleware = async function (staticFilesByArch, req, res, next) {
      var _Meteor$settings$pack3, _Meteor$settings$pack4;
      // console.log(String(arguments.callee));
      var pathname = parseRequest(req).pathname;
      try {
        pathname = decodeURIComponent(pathname);
      } catch (e) {
        next();
        return;
      }
      var serveStaticJs = function (s) {
        var _Meteor$settings$pack, _Meteor$settings$pack2;
        if (req.method === 'GET' || req.method === 'HEAD' || (_Meteor$settings$pack = Meteor.settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.webapp) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.alwaysReturnContent) {
          res.writeHead(200, {
            'Content-type': 'application/javascript; charset=UTF-8',
            'Content-Length': Buffer.byteLength(s)
          });
          res.write(s);
          res.end();
        } else {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        }
      };
      if (_.has(additionalStaticJs, pathname) && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs(additionalStaticJs[pathname]);
        return;
      }
      const {
        arch,
        path
      } = WebApp.categorizeRequest(req);
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        // We could come here in case we run with some architectures excluded
        next();
        return;
      }

      // If pauseClient(arch) has been called, program.paused will be a
      // Promise that will be resolved when the program is unpaused.
      const program = WebApp.clientPrograms[arch];
      await program.paused;
      if (path === '/meteor_runtime_config.js' && !WebAppInternals.inlineScriptsAllowed()) {
        serveStaticJs("__meteor_runtime_config__ = ".concat(program.meteorRuntimeConfig, ";"));
        return;
      }
      const info = getStaticFileInfo(staticFilesByArch, pathname, path, arch);
      if (!info) {
        next();
        return;
      }
      // "send" will handle HEAD & GET requests
      if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack3 = Meteor.settings.packages) !== null && _Meteor$settings$pack3 !== void 0 && (_Meteor$settings$pack4 = _Meteor$settings$pack3.webapp) !== null && _Meteor$settings$pack4 !== void 0 && _Meteor$settings$pack4.alwaysReturnContent)) {
        const status = req.method === 'OPTIONS' ? 200 : 405;
        res.writeHead(status, {
          Allow: 'OPTIONS, GET, HEAD',
          'Content-Length': '0'
        });
        res.end();
        return;
      }

      // We don't need to call pause because, unlike 'static', once we call into
      // 'send' and yield to the event loop, we never call another handler with
      // 'next'.

      // Cacheable files are files that should never change. Typically
      // named by their hash (eg meteor bundled js and css files).
      // We cache them ~forever (1yr).
      const maxAge = info.cacheable ? 1000 * 60 * 60 * 24 * 365 : 0;
      if (info.cacheable) {
        // Since we use req.headers["user-agent"] to determine whether the
        // client should receive modern or legacy resources, tell the client
        // to invalidate cached resources when/if its user agent string
        // changes in the future.
        res.setHeader('Vary', 'User-Agent');
      }

      // Set the X-SourceMap header, which current Chrome, FireFox, and Safari
      // understand.  (The SourceMap header is slightly more spec-correct but FF
      // doesn't understand it.)
      //
      // You may also need to enable source maps in Chrome: open dev tools, click
      // the gear in the bottom right corner, and select "enable source maps".
      if (info.sourceMapUrl) {
        res.setHeader('X-SourceMap', __meteor_runtime_config__.ROOT_URL_PATH_PREFIX + info.sourceMapUrl);
      }
      if (info.type === 'js' || info.type === 'dynamic js') {
        res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      } else if (info.type === 'css') {
        res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      } else if (info.type === 'json') {
        res.setHeader('Content-Type', 'application/json; charset=UTF-8');
      }
      if (info.hash) {
        res.setHeader('ETag', '"' + info.hash + '"');
      }
      if (info.content) {
        res.setHeader('Content-Length', Buffer.byteLength(info.content));
        res.write(info.content);
        res.end();
      } else {
        send(req, info.absolutePath, {
          maxage: maxAge,
          dotfiles: 'allow',
          // if we specified a dotfile in the manifest, serve it
          lastModified: false // don't set last-modified based on the file date
        }).on('error', function (err) {
          Log.error('Error serving static file ' + err);
          res.writeHead(500);
          res.end();
        }).on('directory', function () {
          Log.error('Unexpected directory ' + info.absolutePath);
          res.writeHead(500);
          res.end();
        }).pipe(res);
      }
    };
    function getStaticFileInfo(staticFilesByArch, originalPath, path, arch) {
      if (!hasOwn.call(WebApp.clientPrograms, arch)) {
        return null;
      }

      // Get a list of all available static file architectures, with arch
      // first in the list if it exists.
      const staticArchList = Object.keys(staticFilesByArch);
      const archIndex = staticArchList.indexOf(arch);
      if (archIndex > 0) {
        staticArchList.unshift(staticArchList.splice(archIndex, 1)[0]);
      }
      let info = null;
      staticArchList.some(arch => {
        const staticFiles = staticFilesByArch[arch];
        function finalize(path) {
          info = staticFiles[path];
          // Sometimes we register a lazy function instead of actual data in
          // the staticFiles manifest.
          if (typeof info === 'function') {
            info = staticFiles[path] = info();
          }
          return info;
        }

        // If staticFiles contains originalPath with the arch inferred above,
        // use that information.
        if (hasOwn.call(staticFiles, originalPath)) {
          return finalize(originalPath);
        }

        // If categorizeRequest returned an alternate path, try that instead.
        if (path !== originalPath && hasOwn.call(staticFiles, path)) {
          return finalize(path);
        }
      });
      return info;
    }

    // Parse the passed in port value. Return the port as-is if it's a String
    // (e.g. a Windows Server style named pipe), otherwise return the port as an
    // integer.
    //
    // DEPRECATED: Direct use of this function is not recommended; it is no
    // longer used internally, and will be removed in a future release.
    WebAppInternals.parsePort = port => {
      let parsedPort = parseInt(port);
      if (Number.isNaN(parsedPort)) {
        parsedPort = port;
      }
      return parsedPort;
    };
    onMessage('webapp-pause-client', async _ref => {
      let {
        arch
      } = _ref;
      await WebAppInternals.pauseClient(arch);
    });
    onMessage('webapp-reload-client', async _ref2 => {
      let {
        arch
      } = _ref2;
      await WebAppInternals.generateClientProgram(arch);
    });
    async function runWebAppServer() {
      var shuttingDown = false;
      var syncQueue = new Meteor._AsynchronousQueue();
      var getItemPathname = function (itemUrl) {
        return decodeURIComponent(parseUrl(itemUrl).pathname);
      };
      WebAppInternals.reloadClientPrograms = async function () {
        await syncQueue.runTask(function () {
          const staticFilesByArch = Object.create(null);
          const {
            configJson
          } = __meteor_bootstrap__;
          const clientArchs = configJson.clientArchs || Object.keys(configJson.clientPaths);
          try {
            clientArchs.forEach(arch => {
              generateClientProgram(arch, staticFilesByArch);
            });
            WebAppInternals.staticFilesByArch = staticFilesByArch;
          } catch (e) {
            Log.error('Error reloading the client program: ' + e.stack);
            process.exit(1);
          }
        });
      };

      // Pause any incoming requests and make them wait for the program to be
      // unpaused the next time generateClientProgram(arch) is called.
      WebAppInternals.pauseClient = async function (arch) {
        await syncQueue.runTask(() => {
          const program = WebApp.clientPrograms[arch];
          const {
            unpause
          } = program;
          program.paused = new Promise(resolve => {
            if (typeof unpause === 'function') {
              // If there happens to be an existing program.unpause function,
              // compose it with the resolve function.
              program.unpause = function () {
                unpause();
                resolve();
              };
            } else {
              program.unpause = resolve;
            }
          });
        });
      };
      WebAppInternals.generateClientProgram = async function (arch) {
        await syncQueue.runTask(() => generateClientProgram(arch));
      };
      function generateClientProgram(arch) {
        let staticFilesByArch = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : WebAppInternals.staticFilesByArch;
        const clientDir = pathJoin(pathDirname(__meteor_bootstrap__.serverDir), arch);

        // read the control for the client we'll be serving up
        const programJsonPath = pathJoin(clientDir, 'program.json');
        let programJson;
        try {
          programJson = JSON.parse(readFileSync(programJsonPath));
        } catch (e) {
          if (e.code === 'ENOENT') return;
          throw e;
        }
        if (programJson.format !== 'web-program-pre1') {
          throw new Error('Unsupported format for client assets: ' + JSON.stringify(programJson.format));
        }
        if (!programJsonPath || !clientDir || !programJson) {
          throw new Error('Client config file not parsed.');
        }
        archPath[arch] = clientDir;
        const staticFiles = staticFilesByArch[arch] = Object.create(null);
        const {
          manifest
        } = programJson;
        manifest.forEach(item => {
          if (item.url && item.where === 'client') {
            staticFiles[getItemPathname(item.url)] = {
              absolutePath: pathJoin(clientDir, item.path),
              cacheable: item.cacheable,
              hash: item.hash,
              // Link from source to its map
              sourceMapUrl: item.sourceMapUrl,
              type: item.type
            };
            if (item.sourceMap) {
              // Serve the source map too, under the specified URL. We assume
              // all source maps are cacheable.
              staticFiles[getItemPathname(item.sourceMapUrl)] = {
                absolutePath: pathJoin(clientDir, item.sourceMap),
                cacheable: true
              };
            }
          }
        });
        const {
          PUBLIC_SETTINGS
        } = __meteor_runtime_config__;
        const configOverrides = {
          PUBLIC_SETTINGS
        };
        const oldProgram = WebApp.clientPrograms[arch];
        const newProgram = WebApp.clientPrograms[arch] = {
          format: 'web-program-pre1',
          manifest: manifest,
          // Use arrow functions so that these versions can be lazily
          // calculated later, and so that they will not be included in the
          // staticFiles[manifestUrl].content string below.
          //
          // Note: these version calculations must be kept in agreement with
          // CordovaBuilder#appendVersion in tools/cordova/builder.js, or hot
          // code push will reload Cordova apps unnecessarily.
          version: () => WebAppHashing.calculateClientHash(manifest, null, configOverrides),
          versionRefreshable: () => WebAppHashing.calculateClientHash(manifest, type => type === 'css', configOverrides),
          versionNonRefreshable: () => WebAppHashing.calculateClientHash(manifest, (type, replaceable) => type !== 'css' && !replaceable, configOverrides),
          versionReplaceable: () => WebAppHashing.calculateClientHash(manifest, (_type, replaceable) => replaceable, configOverrides),
          cordovaCompatibilityVersions: programJson.cordovaCompatibilityVersions,
          PUBLIC_SETTINGS,
          hmrVersion: programJson.hmrVersion
        };

        // Expose program details as a string reachable via the following URL.
        const manifestUrlPrefix = '/__' + arch.replace(/^web\./, '');
        const manifestUrl = manifestUrlPrefix + getItemPathname('/manifest.json');
        staticFiles[manifestUrl] = () => {
          if (Package.autoupdate) {
            const {
              AUTOUPDATE_VERSION = Package.autoupdate.Autoupdate.autoupdateVersion
            } = process.env;
            if (AUTOUPDATE_VERSION) {
              newProgram.version = AUTOUPDATE_VERSION;
            }
          }
          if (typeof newProgram.version === 'function') {
            newProgram.version = newProgram.version();
          }
          return {
            content: JSON.stringify(newProgram),
            cacheable: false,
            hash: newProgram.version,
            type: 'json'
          };
        };
        generateBoilerplateForArch(arch);

        // If there are any requests waiting on oldProgram.paused, let them
        // continue now (using the new program).
        if (oldProgram && oldProgram.paused) {
          oldProgram.unpause();
        }
      }
      const defaultOptionsForArch = {
        'web.cordova': {
          runtimeConfigOverrides: {
            // XXX We use absoluteUrl() here so that we serve https://
            // URLs to cordova clients if force-ssl is in use. If we were
            // to use __meteor_runtime_config__.ROOT_URL instead of
            // absoluteUrl(), then Cordova clients would immediately get a
            // HCP setting their DDP_DEFAULT_CONNECTION_URL to
            // http://example.meteor.com. This breaks the app, because
            // force-ssl doesn't serve CORS headers on 302
            // redirects. (Plus it's undesirable to have clients
            // connecting to http://example.meteor.com when force-ssl is
            // in use.)
            DDP_DEFAULT_CONNECTION_URL: process.env.MOBILE_DDP_URL || Meteor.absoluteUrl(),
            ROOT_URL: process.env.MOBILE_ROOT_URL || Meteor.absoluteUrl()
          }
        },
        'web.browser': {
          runtimeConfigOverrides: {
            isModern: true
          }
        },
        'web.browser.legacy': {
          runtimeConfigOverrides: {
            isModern: false
          }
        }
      };
      WebAppInternals.generateBoilerplate = async function () {
        // This boilerplate will be served to the mobile devices when used with
        // Meteor/Cordova for the Hot-Code Push and since the file will be served by
        // the device's server, it is important to set the DDP url to the actual
        // Meteor server accepting DDP connections and not the device's file server.
        await syncQueue.runTask(function () {
          Object.keys(WebApp.clientPrograms).forEach(generateBoilerplateForArch);
        });
      };
      function generateBoilerplateForArch(arch) {
        const program = WebApp.clientPrograms[arch];
        const additionalOptions = defaultOptionsForArch[arch] || {};
        const {
          baseData
        } = boilerplateByArch[arch] = WebAppInternals.generateBoilerplateInstance(arch, program.manifest, additionalOptions);
        // We need the runtime config with overrides for meteor_runtime_config.js:
        program.meteorRuntimeConfig = JSON.stringify(_objectSpread(_objectSpread({}, __meteor_runtime_config__), additionalOptions.runtimeConfigOverrides || null));
        program.refreshableAssets = baseData.css.map(file => ({
          url: bundledJsCssUrlRewriteHook(file.url)
        }));
      }
      await WebAppInternals.reloadClientPrograms();

      // webserver
      var app = createExpressApp();

      // Packages and apps can add handlers that run before any other Meteor
      // handlers via WebApp.rawExpressHandlers.
      var rawExpressHandlers = createExpressApp();
      app.use(rawExpressHandlers);

      // Auto-compress any json, javascript, or text.
      app.use(compress({
        filter: shouldCompress
      }));

      // parse cookies into an object
      app.use(cookieParser());

      // We're not a proxy; reject (without crashing) attempts to treat us like
      // one. (See #1212.)
      app.use(function (req, res, next) {
        if (RoutePolicy.isValidUrl(req.url)) {
          next();
          return;
        }
        res.writeHead(400);
        res.write('Not a proxy');
        res.end();
      });

      // Parse the query string into res.query. Used by oauth_server, but it's
      // generally pretty handy..
      //
      // Do this before the next middleware destroys req.url if a path prefix
      // is set to close #10111.
      app.use(function (request, response, next) {
        request.query = qs.parse(parseUrl(request.url).query);
        next();
      });
      function getPathParts(path) {
        const parts = path.split('/');
        while (parts[0] === '') parts.shift();
        return parts;
      }
      function isPrefixOf(prefix, array) {
        return prefix.length <= array.length && prefix.every((part, i) => part === array[i]);
      }

      // Strip off the path prefix, if it exists.
      app.use(function (request, response, next) {
        const pathPrefix = __meteor_runtime_config__.ROOT_URL_PATH_PREFIX;
        const {
          pathname,
          search
        } = parseUrl(request.url);

        // check if the path in the url starts with the path prefix
        if (pathPrefix) {
          const prefixParts = getPathParts(pathPrefix);
          const pathParts = getPathParts(pathname);
          if (isPrefixOf(prefixParts, pathParts)) {
            request.url = '/' + pathParts.slice(prefixParts.length).join('/');
            if (search) {
              request.url += search;
            }
            return next();
          }
        }
        if (pathname === '/favicon.ico' || pathname === '/robots.txt') {
          return next();
        }
        if (pathPrefix) {
          response.writeHead(404);
          response.write('Unknown path');
          response.end();
          return;
        }
        next();
      });

      // Serve static files from the manifest.
      // This is inspired by the 'static' middleware.
      app.use(function (req, res, next) {
        // console.log(String(arguments.callee));
        WebAppInternals.staticFilesMiddleware(WebAppInternals.staticFilesByArch, req, res, next);
      });

      // Core Meteor packages like dynamic-import can add handlers before
      // other handlers added by package and application code.
      app.use(WebAppInternals.meteorInternalHandlers = createExpressApp());

      /**
       * @name expressHandlersCallback(req, res, next)
       * @locus Server
       * @isprototype true
       * @summary callback handler for `WebApp.expressHandlers`
       * @param {Object} req
       * a Node.js
       * [IncomingMessage](https://nodejs.org/api/http.html#http_class_http_incomingmessage)
       * object with some extra properties. This argument can be used
       *  to get information about the incoming request.
       * @param {Object} res
       * a Node.js
       * [ServerResponse](http://nodejs.org/api/http.html#http_class_http_serverresponse)
       * object. Use this to write data that should be sent in response to the
       * request, and call `res.end()` when you are done.
       * @param {Function} next
       * Calling this function will pass on the handling of
       * this request to the next relevant handler.
       *
       */

      /**
       * @method expressHandlers
       * @memberof WebApp
       * @locus Server
       * @summary Register a handler for all HTTP requests.
       * @param {String} [path]
       * This handler will only be called on paths that match
       * this string. The match has to border on a `/` or a `.`.
       *
       * For example, `/hello` will match `/hello/world` and
       * `/hello.world`, but not `/hello_world`.
       * @param {expressHandlersCallback} handler
       * A handler function that will be called on HTTP requests.
       * See `expressHandlersCallback`
       *
       */
      // Packages and apps can add handlers to this via WebApp.expressHandlers.
      // They are inserted before our default handler.
      var packageAndAppHandlers = createExpressApp();
      app.use(packageAndAppHandlers);
      var suppressConnectErrors = false;
      // connect knows it is an error handler because it has 4 arguments instead of
      // 3. go figure.  (It is not smart enough to find such a thing if it's hidden
      // inside packageAndAppHandlers.)
      app.use(function (err, req, res, next) {
        if (!err || !suppressConnectErrors || !req.headers['x-suppress-error']) {
          next(err);
          return;
        }
        res.writeHead(err.status, {
          'Content-Type': 'text/plain'
        });
        res.end('An error message');
      });
      app.use(async function (req, res, next) {
        var _Meteor$settings$pack5, _Meteor$settings$pack6;
        if (!appUrl(req.url)) {
          return next();
        } else if (req.method !== 'HEAD' && req.method !== 'GET' && !((_Meteor$settings$pack5 = Meteor.settings.packages) !== null && _Meteor$settings$pack5 !== void 0 && (_Meteor$settings$pack6 = _Meteor$settings$pack5.webapp) !== null && _Meteor$settings$pack6 !== void 0 && _Meteor$settings$pack6.alwaysReturnContent)) {
          const status = req.method === 'OPTIONS' ? 200 : 405;
          res.writeHead(status, {
            Allow: 'OPTIONS, GET, HEAD',
            'Content-Length': '0'
          });
          res.end();
        } else {
          var headers = {
            'Content-Type': 'text/html; charset=utf-8'
          };
          if (shuttingDown) {
            headers['Connection'] = 'Close';
          }
          var request = WebApp.categorizeRequest(req);
          if (request.url.query && request.url.query['meteor_css_resource']) {
            // In this case, we're requesting a CSS resource in the meteor-specific
            // way, but we don't have it.  Serve a static css file that indicates that
            // we didn't have it, so we can detect that and refresh.  Make sure
            // that any proxies or CDNs don't cache this error!  (Normally proxies
            // or CDNs are smart enough not to cache error pages, but in order to
            // make this hack work, we need to return the CSS file as a 200, which
            // would otherwise be cached.)
            headers['Content-Type'] = 'text/css; charset=utf-8';
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(200, headers);
            res.write('.meteor-css-not-found-error { width: 0px;}');
            res.end();
            return;
          }
          if (request.url.query && request.url.query['meteor_js_resource']) {
            // Similarly, we're requesting a JS resource that we don't have.
            // Serve an uncached 404. (We can't use the same hack we use for CSS,
            // because actually acting on that hack requires us to have the JS
            // already!)
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          if (request.url.query && request.url.query['meteor_dont_serve_index']) {
            // When downloading files during a Cordova hot code push, we need
            // to detect if a file is not available instead of inadvertently
            // downloading the default index page.
            // So similar to the situation above, we serve an uncached 404.
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            res.end('404 Not Found');
            return;
          }
          const {
            arch
          } = request;
          assert.strictEqual(typeof arch, 'string', {
            arch
          });
          if (!hasOwn.call(WebApp.clientPrograms, arch)) {
            // We could come here in case we run with some architectures excluded
            headers['Cache-Control'] = 'no-cache';
            res.writeHead(404, headers);
            if (Meteor.isDevelopment) {
              res.end("No client program found for the ".concat(arch, " architecture."));
            } else {
              // Safety net, but this branch should not be possible.
              res.end('404 Not Found');
            }
            return;
          }

          // If pauseClient(arch) has been called, program.paused will be a
          // Promise that will be resolved when the program is unpaused.
          await WebApp.clientPrograms[arch].paused;
          return getBoilerplateAsync(request, arch).then(_ref3 => {
            let {
              stream,
              statusCode,
              headers: newHeaders
            } = _ref3;
            if (!statusCode) {
              statusCode = res.statusCode ? res.statusCode : 200;
            }
            if (newHeaders) {
              Object.assign(headers, newHeaders);
            }
            res.writeHead(statusCode, headers);
            stream.pipe(res, {
              // End the response when the stream ends.
              end: true
            });
          }).catch(error => {
            Log.error('Error running template: ' + error.stack);
            res.writeHead(500, headers);
            res.end();
          });
        }
      });

      // Return 404 by default, if no other handlers serve this URL.
      app.use(function (req, res) {
        res.writeHead(404);
        res.end();
      });
      var httpServer = createServer(app);
      var onListeningCallbacks = [];

      // After 5 seconds w/o data on a socket, kill it.  On the other hand, if
      // there's an outstanding request, give it a higher timeout instead (to avoid
      // killing long-polling requests)
      httpServer.setTimeout(SHORT_SOCKET_TIMEOUT);

      // Do this here, and then also in livedata/stream_server.js, because
      // stream_server.js kills all the current request handlers when installing its
      // own.
      httpServer.on('request', WebApp._timeoutAdjustmentRequestCallback);

      // If the client gave us a bad request, tell it instead of just closing the
      // socket. This lets load balancers in front of us differentiate between "a
      // server is randomly closing sockets for no reason" and "client sent a bad
      // request".
      //
      // This will only work on Node 6; Node 4 destroys the socket before calling
      // this event. See https://github.com/nodejs/node/pull/4557/ for details.
      httpServer.on('clientError', (err, socket) => {
        // Pre-Node-6, do nothing.
        if (socket.destroyed) {
          return;
        }
        if (err.message === 'Parse Error') {
          socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
        } else {
          // For other errors, use the default behavior as if we had no clientError
          // handler.
          socket.destroy(err);
        }
      });

      // start up app
      _.extend(WebApp, {
        expressHandlers: packageAndAppHandlers,
        rawExpressHandlers: rawExpressHandlers,
        httpServer: httpServer,
        expressApp: app,
        // For testing.
        suppressConnectErrors: function () {
          suppressConnectErrors = true;
        },
        onListening: function (f) {
          if (onListeningCallbacks) onListeningCallbacks.push(f);else f();
        },
        // This can be overridden by users who want to modify how listening works
        // (eg, to run a proxy like Apollo Engine Proxy in front of the server).
        startListening: function (httpServer, listenOptions, cb) {
          httpServer.listen(listenOptions, cb);
        }
      });

      /**
      * @name main
      * @locus Server
      * @summary Starts the HTTP server.
      *  If `UNIX_SOCKET_PATH` is present Meteor's HTTP server will use that socket file for inter-process communication, instead of TCP.
      * If you choose to not include webapp package in your application this method still must be defined for your Meteor application to work. 
      */
      // Let the rest of the packages (and Meteor.startup hooks) insert connect
      // middlewares and update __meteor_runtime_config__, then keep going to set up
      // actually serving HTML.
      exports.main = async argv => {
        await WebAppInternals.generateBoilerplate();
        const startHttpServer = listenOptions => {
          WebApp.startListening(httpServer, listenOptions, Meteor.bindEnvironment(() => {
            if (process.env.METEOR_PRINT_ON_LISTEN) {
              console.log('LISTENING');
            }
            const callbacks = onListeningCallbacks;
            onListeningCallbacks = null;
            callbacks.forEach(callback => {
              callback();
            });
          }, e => {
            console.error('Error listening:', e);
            console.error(e && e.stack);
          }));
        };
        let localPort = process.env.PORT || 0;
        let unixSocketPath = process.env.UNIX_SOCKET_PATH;
        if (unixSocketPath) {
          if (cluster.isWorker) {
            const workerName = cluster.worker.process.env.name || cluster.worker.id;
            unixSocketPath += '.' + workerName + '.sock';
          }
          // Start the HTTP server using a socket file.
          removeExistingSocketFile(unixSocketPath);
          startHttpServer({
            path: unixSocketPath
          });
          const unixSocketPermissions = (process.env.UNIX_SOCKET_PERMISSIONS || '').trim();
          if (unixSocketPermissions) {
            if (/^[0-7]{3}$/.test(unixSocketPermissions)) {
              chmodSync(unixSocketPath, parseInt(unixSocketPermissions, 8));
            } else {
              throw new Error('Invalid UNIX_SOCKET_PERMISSIONS specified');
            }
          }
          const unixSocketGroup = (process.env.UNIX_SOCKET_GROUP || '').trim();
          if (unixSocketGroup) {
            //whomst automatically handles both group names and numerical gids
            const unixSocketGroupInfo = whomst.sync.group(unixSocketGroup);
            if (unixSocketGroupInfo === null) {
              throw new Error('Invalid UNIX_SOCKET_GROUP name specified');
            }
            chownSync(unixSocketPath, userInfo().uid, unixSocketGroupInfo.gid);
          }
          registerSocketFileCleanup(unixSocketPath);
        } else {
          localPort = isNaN(Number(localPort)) ? localPort : Number(localPort);
          if (/\\\\?.+\\pipe\\?.+/.test(localPort)) {
            // Start the HTTP server using Windows Server style named pipe.
            startHttpServer({
              path: localPort
            });
          } else if (typeof localPort === 'number') {
            // Start the HTTP server using TCP.
            startHttpServer({
              port: localPort,
              host: process.env.BIND_IP || '0.0.0.0'
            });
          } else {
            throw new Error('Invalid PORT specified');
          }
        }
        return 'DAEMON';
      };
    }
    var inlineScriptsAllowed = true;
    WebAppInternals.inlineScriptsAllowed = function () {
      return inlineScriptsAllowed;
    };
    WebAppInternals.setInlineScriptsAllowed = async function (value) {
      inlineScriptsAllowed = value;
      await WebAppInternals.generateBoilerplate();
    };
    var sriMode;
    WebAppInternals.enableSubresourceIntegrity = async function () {
      let use_credentials = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : false;
      sriMode = use_credentials ? 'use-credentials' : 'anonymous';
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssUrlRewriteHook = async function (hookFn) {
      bundledJsCssUrlRewriteHook = hookFn;
      await WebAppInternals.generateBoilerplate();
    };
    WebAppInternals.setBundledJsCssPrefix = async function (prefix) {
      var self = this;
      await self.setBundledJsCssUrlRewriteHook(function (url) {
        return prefix + url;
      });
    };

    // Packages can call `WebAppInternals.addStaticJs` to specify static
    // JavaScript to be included in the app. This static JS will be inlined,
    // unless inline scripts have been disabled, in which case it will be
    // served under `/<sha1 of contents>`.
    var additionalStaticJs = {};
    WebAppInternals.addStaticJs = function (contents) {
      additionalStaticJs['/' + sha1(contents) + '.js'] = contents;
    };

    // Exported for tests
    WebAppInternals.getBoilerplate = getBoilerplate;
    WebAppInternals.additionalStaticJs = additionalStaticJs;
    await runWebAppServer();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: true
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"socket_file.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// packages/webapp/socket_file.js                                                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      removeExistingSocketFile: () => removeExistingSocketFile,
      registerSocketFileCleanup: () => registerSocketFileCleanup
    });
    let statSync, unlinkSync, existsSync;
    module.link("fs", {
      statSync(v) {
        statSync = v;
      },
      unlinkSync(v) {
        unlinkSync = v;
      },
      existsSync(v) {
        existsSync = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const removeExistingSocketFile = socketPath => {
      try {
        if (statSync(socketPath).isSocket()) {
          // Since a new socket file will be created, remove the existing
          // file.
          unlinkSync(socketPath);
        } else {
          throw new Error("An existing file was found at \"".concat(socketPath, "\" and it is not ") + 'a socket file. Please confirm PORT is pointing to valid and ' + 'un-used socket file path.');
        }
      } catch (error) {
        // If there is no existing socket file to cleanup, great, we'll
        // continue normally. If the caught exception represents any other
        // issue, re-throw.
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    };
    const registerSocketFileCleanup = function (socketPath) {
      let eventEmitter = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : process;
      ['exit', 'SIGINT', 'SIGHUP', 'SIGTERM'].forEach(signal => {
        eventEmitter.on(signal, Meteor.bindEnvironment(() => {
          if (existsSync(socketPath)) {
            unlinkSync(socketPath);
          }
        }));
      });
    };
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"express":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/express/package.json                                            //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "express",
  "version": "4.18.2"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/express/index.js                                                //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"compression":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/compression/package.json                                        //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "compression",
  "version": "1.7.4"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/compression/index.js                                            //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"cookie-parser":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/cookie-parser/package.json                                      //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "cookie-parser",
  "version": "1.4.5"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/cookie-parser/index.js                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"qs":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/qs/package.json                                                 //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "qs",
  "version": "6.10.1",
  "main": "lib/index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"lib":{"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/qs/lib/index.js                                                 //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}},"parseurl":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/parseurl/package.json                                           //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "parseurl",
  "version": "1.3.3"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/parseurl/index.js                                               //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"useragent":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/useragent/package.json                                          //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "useragent",
  "version": "2.3.0",
  "main": "./index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/useragent/index.js                                              //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"send":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/send/package.json                                               //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "send",
  "version": "0.17.1"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/send/index.js                                                   //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"@vlasky":{"whomst":{"package.json":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/package.json                                     //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.exports = {
  "name": "@vlasky/whomst",
  "version": "0.1.7",
  "main": "index.js"
};

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                         //
// node_modules/meteor/webapp/node_modules/@vlasky/whomst/index.js                                         //
//                                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                           //
module.useNode();
/////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      WebApp: WebApp,
      WebAppInternals: WebAppInternals,
      main: main
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/webapp/webapp_server.js"
  ],
  mainModulePath: "/node_modules/meteor/webapp/webapp_server.js"
}});

//# sourceURL=meteor://💻app/packages/webapp.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvd2ViYXBwL3dlYmFwcF9zZXJ2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL3dlYmFwcC9zb2NrZXRfZmlsZS5qcyJdLCJuYW1lcyI6WyJfb2JqZWN0U3ByZWFkIiwibW9kdWxlMSIsImxpbmsiLCJkZWZhdWx0IiwidiIsImV4cG9ydCIsIldlYkFwcCIsIldlYkFwcEludGVybmFscyIsImFzc2VydCIsInJlYWRGaWxlU3luYyIsImNobW9kU3luYyIsImNob3duU3luYyIsImNyZWF0ZVNlcnZlciIsInVzZXJJbmZvIiwicGF0aEpvaW4iLCJwYXRoRGlybmFtZSIsImpvaW4iLCJkaXJuYW1lIiwicGFyc2VVcmwiLCJwYXJzZSIsImNyZWF0ZUhhc2giLCJleHByZXNzIiwiY29tcHJlc3MiLCJjb29raWVQYXJzZXIiLCJxcyIsInBhcnNlUmVxdWVzdCIsImxvb2t1cFVzZXJBZ2VudCIsImxvb2t1cCIsImlzTW9kZXJuIiwic2VuZCIsInJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSIsInJlZ2lzdGVyU29ja2V0RmlsZUNsZWFudXAiLCJjbHVzdGVyIiwid2hvbXN0Iiwib25NZXNzYWdlIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJTSE9SVF9TT0NLRVRfVElNRU9VVCIsIkxPTkdfU09DS0VUX1RJTUVPVVQiLCJjcmVhdGVFeHByZXNzQXBwIiwiYXBwIiwic2V0IiwiaGFzT3duIiwiT2JqZWN0IiwicHJvdG90eXBlIiwiaGFzT3duUHJvcGVydHkiLCJOcG1Nb2R1bGVzIiwidmVyc2lvbiIsIk5wbSIsInJlcXVpcmUiLCJtb2R1bGUiLCJkZWZhdWx0QXJjaCIsImNsaWVudFByb2dyYW1zIiwiYXJjaFBhdGgiLCJidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayIsInVybCIsImJ1bmRsZWRQcmVmaXgiLCJfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIiwiUk9PVF9VUkxfUEFUSF9QUkVGSVgiLCJzaGExIiwiY29udGVudHMiLCJoYXNoIiwidXBkYXRlIiwiZGlnZXN0Iiwic2hvdWxkQ29tcHJlc3MiLCJyZXEiLCJyZXMiLCJoZWFkZXJzIiwiZmlsdGVyIiwiY2FtZWxDYXNlIiwibmFtZSIsInBhcnRzIiwic3BsaXQiLCJ0b0xvd2VyQ2FzZSIsImkiLCJsZW5ndGgiLCJjaGFyQXQiLCJ0b1VwcGVyQ2FzZSIsInN1YnN0ciIsImlkZW50aWZ5QnJvd3NlciIsInVzZXJBZ2VudFN0cmluZyIsInVzZXJBZ2VudCIsImZhbWlseSIsIm1ham9yIiwibWlub3IiLCJwYXRjaCIsImNhdGVnb3JpemVSZXF1ZXN0IiwiYnJvd3NlciIsImFyY2giLCJtb2Rlcm4iLCJwYXRoIiwicGF0aG5hbWUiLCJjYXRlZ29yaXplZCIsImR5bmFtaWNIZWFkIiwiZHluYW1pY0JvZHkiLCJjb29raWVzIiwicGF0aFBhcnRzIiwiYXJjaEtleSIsInN0YXJ0c1dpdGgiLCJhcmNoQ2xlYW5lZCIsInNsaWNlIiwiY2FsbCIsInNwbGljZSIsImFzc2lnbiIsInByZWZlcnJlZEFyY2hPcmRlciIsImh0bWxBdHRyaWJ1dGVIb29rcyIsImdldEh0bWxBdHRyaWJ1dGVzIiwicmVxdWVzdCIsImNvbWJpbmVkQXR0cmlidXRlcyIsIl8iLCJlYWNoIiwiaG9vayIsImF0dHJpYnV0ZXMiLCJFcnJvciIsImV4dGVuZCIsImFkZEh0bWxBdHRyaWJ1dGVIb29rIiwicHVzaCIsImFwcFVybCIsIlJvdXRlUG9saWN5IiwiY2xhc3NpZnkiLCJNZXRlb3IiLCJzdGFydHVwIiwiZ2V0dGVyIiwia2V5IiwicHJvZ3JhbSIsInZhbHVlIiwiY2FsY3VsYXRlQ2xpZW50SGFzaCIsImNsaWVudEhhc2giLCJjYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUiLCJjYWxjdWxhdGVDbGllbnRIYXNoTm9uUmVmcmVzaGFibGUiLCJjYWxjdWxhdGVDbGllbnRIYXNoUmVwbGFjZWFibGUiLCJnZXRSZWZyZXNoYWJsZUFzc2V0cyIsIl90aW1lb3V0QWRqdXN0bWVudFJlcXVlc3RDYWxsYmFjayIsInNldFRpbWVvdXQiLCJmaW5pc2hMaXN0ZW5lcnMiLCJsaXN0ZW5lcnMiLCJyZW1vdmVBbGxMaXN0ZW5lcnMiLCJvbiIsImwiLCJib2lsZXJwbGF0ZUJ5QXJjaCIsImJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcyIsImNyZWF0ZSIsInJlZ2lzdGVyQm9pbGVycGxhdGVEYXRhQ2FsbGJhY2siLCJjYWxsYmFjayIsInByZXZpb3VzQ2FsbGJhY2siLCJzdHJpY3RFcXVhbCIsImdldEJvaWxlcnBsYXRlIiwiZ2V0Qm9pbGVycGxhdGVBc3luYyIsImVuY29kZVJ1bnRpbWVDb25maWciLCJydGltZUNvbmZpZyIsIkpTT04iLCJzdHJpbmdpZnkiLCJlbmNvZGVVUklDb21wb25lbnQiLCJkZWNvZGVSdW50aW1lQ29uZmlnIiwicnRpbWVDb25maWdTdHIiLCJkZWNvZGVVUklDb21wb25lbnQiLCJydW50aW1lQ29uZmlnIiwiaG9va3MiLCJIb29rIiwidXBkYXRlSG9va3MiLCJpc1VwZGF0ZWRCeUFyY2giLCJhZGRSdW50aW1lQ29uZmlnSG9vayIsInJlZ2lzdGVyIiwiYm9pbGVycGxhdGUiLCJmb3JFYWNoIiwibWV0ZW9yUnVudGltZUNvbmZpZyIsImVuY29kZWRDdXJyZW50Q29uZmlnIiwiYmFzZURhdGEiLCJ1cGRhdGVkIiwiZGF0YSIsImh0bWxBdHRyaWJ1dGVzIiwicGljayIsIm1hZGVDaGFuZ2VzIiwicHJvbWlzZSIsIlByb21pc2UiLCJyZXNvbHZlIiwia2V5cyIsInRoZW4iLCJyZXN1bHQiLCJzdHJlYW0iLCJ0b0hUTUxTdHJlYW0iLCJzdGF0dXNDb2RlIiwiYWRkVXBkYXRlZE5vdGlmeUhvb2siLCJoYW5kbGVyIiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlIiwibWFuaWZlc3QiLCJhZGRpdGlvbmFsT3B0aW9ucyIsInJ1bnRpbWVDb25maWdPdmVycmlkZXMiLCJjYiIsIkJvaWxlcnBsYXRlIiwicGF0aE1hcHBlciIsIml0ZW1QYXRoIiwiYmFzZURhdGFFeHRlbnNpb24iLCJhZGRpdGlvbmFsU3RhdGljSnMiLCJtYXAiLCJtZXRlb3JSdW50aW1lSGFzaCIsInJvb3RVcmxQYXRoUHJlZml4Iiwic3JpTW9kZSIsImlubGluZVNjcmlwdHNBbGxvd2VkIiwiaW5saW5lIiwic3RhdGljRmlsZXNNaWRkbGV3YXJlIiwic3RhdGljRmlsZXNCeUFyY2giLCJuZXh0IiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazQiLCJlIiwic2VydmVTdGF0aWNKcyIsInMiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2siLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2syIiwibWV0aG9kIiwic2V0dGluZ3MiLCJwYWNrYWdlcyIsIndlYmFwcCIsImFsd2F5c1JldHVybkNvbnRlbnQiLCJ3cml0ZUhlYWQiLCJCdWZmZXIiLCJieXRlTGVuZ3RoIiwid3JpdGUiLCJlbmQiLCJzdGF0dXMiLCJBbGxvdyIsImhhcyIsInBhdXNlZCIsImNvbmNhdCIsImluZm8iLCJnZXRTdGF0aWNGaWxlSW5mbyIsIm1heEFnZSIsImNhY2hlYWJsZSIsInNldEhlYWRlciIsInNvdXJjZU1hcFVybCIsInR5cGUiLCJjb250ZW50IiwiYWJzb2x1dGVQYXRoIiwibWF4YWdlIiwiZG90ZmlsZXMiLCJsYXN0TW9kaWZpZWQiLCJlcnIiLCJMb2ciLCJlcnJvciIsInBpcGUiLCJvcmlnaW5hbFBhdGgiLCJzdGF0aWNBcmNoTGlzdCIsImFyY2hJbmRleCIsImluZGV4T2YiLCJ1bnNoaWZ0Iiwic29tZSIsInN0YXRpY0ZpbGVzIiwiZmluYWxpemUiLCJwYXJzZVBvcnQiLCJwb3J0IiwicGFyc2VkUG9ydCIsInBhcnNlSW50IiwiTnVtYmVyIiwiaXNOYU4iLCJfcmVmIiwicGF1c2VDbGllbnQiLCJfcmVmMiIsImdlbmVyYXRlQ2xpZW50UHJvZ3JhbSIsInJ1bldlYkFwcFNlcnZlciIsInNodXR0aW5nRG93biIsInN5bmNRdWV1ZSIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsImdldEl0ZW1QYXRobmFtZSIsIml0ZW1VcmwiLCJyZWxvYWRDbGllbnRQcm9ncmFtcyIsInJ1blRhc2siLCJjb25maWdKc29uIiwiX19tZXRlb3JfYm9vdHN0cmFwX18iLCJjbGllbnRBcmNocyIsImNsaWVudFBhdGhzIiwic3RhY2siLCJwcm9jZXNzIiwiZXhpdCIsInVucGF1c2UiLCJhcmd1bWVudHMiLCJ1bmRlZmluZWQiLCJjbGllbnREaXIiLCJzZXJ2ZXJEaXIiLCJwcm9ncmFtSnNvblBhdGgiLCJwcm9ncmFtSnNvbiIsImNvZGUiLCJmb3JtYXQiLCJpdGVtIiwid2hlcmUiLCJzb3VyY2VNYXAiLCJQVUJMSUNfU0VUVElOR1MiLCJjb25maWdPdmVycmlkZXMiLCJvbGRQcm9ncmFtIiwibmV3UHJvZ3JhbSIsIldlYkFwcEhhc2hpbmciLCJ2ZXJzaW9uUmVmcmVzaGFibGUiLCJ2ZXJzaW9uTm9uUmVmcmVzaGFibGUiLCJyZXBsYWNlYWJsZSIsInZlcnNpb25SZXBsYWNlYWJsZSIsIl90eXBlIiwiY29yZG92YUNvbXBhdGliaWxpdHlWZXJzaW9ucyIsImhtclZlcnNpb24iLCJtYW5pZmVzdFVybFByZWZpeCIsInJlcGxhY2UiLCJtYW5pZmVzdFVybCIsIlBhY2thZ2UiLCJhdXRvdXBkYXRlIiwiQVVUT1VQREFURV9WRVJTSU9OIiwiQXV0b3VwZGF0ZSIsImF1dG91cGRhdGVWZXJzaW9uIiwiZW52IiwiZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2giLCJkZWZhdWx0T3B0aW9uc0ZvckFyY2giLCJERFBfREVGQVVMVF9DT05ORUNUSU9OX1VSTCIsIk1PQklMRV9ERFBfVVJMIiwiYWJzb2x1dGVVcmwiLCJST09UX1VSTCIsIk1PQklMRV9ST09UX1VSTCIsImdlbmVyYXRlQm9pbGVycGxhdGUiLCJyZWZyZXNoYWJsZUFzc2V0cyIsImNzcyIsImZpbGUiLCJyYXdFeHByZXNzSGFuZGxlcnMiLCJ1c2UiLCJpc1ZhbGlkVXJsIiwicmVzcG9uc2UiLCJxdWVyeSIsImdldFBhdGhQYXJ0cyIsInNoaWZ0IiwiaXNQcmVmaXhPZiIsInByZWZpeCIsImFycmF5IiwiZXZlcnkiLCJwYXJ0IiwicGF0aFByZWZpeCIsInNlYXJjaCIsInByZWZpeFBhcnRzIiwibWV0ZW9ySW50ZXJuYWxIYW5kbGVycyIsInBhY2thZ2VBbmRBcHBIYW5kbGVycyIsInN1cHByZXNzQ29ubmVjdEVycm9ycyIsIl9NZXRlb3Ikc2V0dGluZ3MkcGFjazUiLCJfTWV0ZW9yJHNldHRpbmdzJHBhY2s2IiwiaXNEZXZlbG9wbWVudCIsIl9yZWYzIiwibmV3SGVhZGVycyIsImNhdGNoIiwiaHR0cFNlcnZlciIsIm9uTGlzdGVuaW5nQ2FsbGJhY2tzIiwic29ja2V0IiwiZGVzdHJveWVkIiwibWVzc2FnZSIsImRlc3Ryb3kiLCJleHByZXNzSGFuZGxlcnMiLCJleHByZXNzQXBwIiwib25MaXN0ZW5pbmciLCJmIiwic3RhcnRMaXN0ZW5pbmciLCJsaXN0ZW5PcHRpb25zIiwibGlzdGVuIiwiZXhwb3J0cyIsIm1haW4iLCJhcmd2Iiwic3RhcnRIdHRwU2VydmVyIiwiYmluZEVudmlyb25tZW50IiwiTUVURU9SX1BSSU5UX09OX0xJU1RFTiIsImNvbnNvbGUiLCJsb2ciLCJjYWxsYmFja3MiLCJsb2NhbFBvcnQiLCJQT1JUIiwidW5peFNvY2tldFBhdGgiLCJVTklYX1NPQ0tFVF9QQVRIIiwiaXNXb3JrZXIiLCJ3b3JrZXJOYW1lIiwid29ya2VyIiwiaWQiLCJ1bml4U29ja2V0UGVybWlzc2lvbnMiLCJVTklYX1NPQ0tFVF9QRVJNSVNTSU9OUyIsInRyaW0iLCJ0ZXN0IiwidW5peFNvY2tldEdyb3VwIiwiVU5JWF9TT0NLRVRfR1JPVVAiLCJ1bml4U29ja2V0R3JvdXBJbmZvIiwic3luYyIsImdyb3VwIiwidWlkIiwiZ2lkIiwiaG9zdCIsIkJJTkRfSVAiLCJzZXRJbmxpbmVTY3JpcHRzQWxsb3dlZCIsImVuYWJsZVN1YnJlc291cmNlSW50ZWdyaXR5IiwidXNlX2NyZWRlbnRpYWxzIiwic2V0QnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2siLCJob29rRm4iLCJzZXRCdW5kbGVkSnNDc3NQcmVmaXgiLCJzZWxmIiwiYWRkU3RhdGljSnMiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJhc3luYyIsInN0YXRTeW5jIiwidW5saW5rU3luYyIsImV4aXN0c1N5bmMiLCJzb2NrZXRQYXRoIiwiaXNTb2NrZXQiLCJldmVudEVtaXR0ZXIiLCJzaWduYWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQXRHSCxPQUFPLENBQUNJLE1BQU0sQ0FBQztNQUFDQyxNQUFNLEVBQUNBLENBQUEsS0FBSUEsTUFBTTtNQUFDQyxlQUFlLEVBQUNBLENBQUEsS0FBSUE7SUFBZSxDQUFDLENBQUM7SUFBQyxJQUFJQyxNQUFNO0lBQUNQLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLFFBQVEsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0ksTUFBTSxHQUFDSixDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQUMsSUFBSUssWUFBWSxFQUFDQyxTQUFTLEVBQUNDLFNBQVM7SUFBQ1YsT0FBTyxDQUFDQyxJQUFJLENBQUMsSUFBSSxFQUFDO01BQUNPLFlBQVlBLENBQUNMLENBQUMsRUFBQztRQUFDSyxZQUFZLEdBQUNMLENBQUM7TUFBQSxDQUFDO01BQUNNLFNBQVNBLENBQUNOLENBQUMsRUFBQztRQUFDTSxTQUFTLEdBQUNOLENBQUM7TUFBQSxDQUFDO01BQUNPLFNBQVNBLENBQUNQLENBQUMsRUFBQztRQUFDTyxTQUFTLEdBQUNQLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJUSxZQUFZO0lBQUNYLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLE1BQU0sRUFBQztNQUFD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QTtFQUFBSSxLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvd2ViYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jLCBjaG1vZFN5bmMsIGNob3duU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IGNyZWF0ZVNlcnZlciB9IGZyb20gJ2h0dHAnO1xuaW1wb3J0IHsgdXNlckluZm8gfSBmcm9tICdvcyc7XG5pbXBvcnQgeyBqb2luIGFzIHBhdGhKb2luLCBkaXJuYW1lIGFzIHBhdGhEaXJuYW1lIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBwYXJzZSBhcyBwYXJzZVVybCB9IGZyb20gJ3VybCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCBleHByZXNzIGZyb20gJ2V4cHJlc3MnO1xuaW1wb3J0IGNvbXByZXNzIGZyb20gJ2NvbXByZXNzaW9uJztcbmltcG9ydCBjb29raWVQYXJzZXIgZnJvbSAnY29va2llLXBhcnNlcic7XG5pbXBvcnQgcXMgZnJvbSAncXMnO1xuaW1wb3J0IHBhcnNlUmVxdWVzdCBmcm9tICdwYXJzZXVybCc7XG5pbXBvcnQgeyBsb29rdXAgYXMgbG9va3VwVXNlckFnZW50IH0gZnJvbSAndXNlcmFnZW50JztcbmltcG9ydCB7IGlzTW9kZXJuIH0gZnJvbSAnbWV0ZW9yL21vZGVybi1icm93c2Vycyc7XG5pbXBvcnQgc2VuZCBmcm9tICdzZW5kJztcbmltcG9ydCB7XG4gIHJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSxcbiAgcmVnaXN0ZXJTb2NrZXRGaWxlQ2xlYW51cCxcbn0gZnJvbSAnLi9zb2NrZXRfZmlsZS5qcyc7XG5pbXBvcnQgY2x1c3RlciBmcm9tICdjbHVzdGVyJztcbmltcG9ydCB3aG9tc3QgZnJvbSAnQHZsYXNreS93aG9tc3QnO1xuXG52YXIgU0hPUlRfU09DS0VUX1RJTUVPVVQgPSA1ICogMTAwMDtcbnZhciBMT05HX1NPQ0tFVF9USU1FT1VUID0gMTIwICogMTAwMDtcblxuY29uc3QgY3JlYXRlRXhwcmVzc0FwcCA9ICgpID0+IHtcbiAgY29uc3QgYXBwID0gZXhwcmVzcygpO1xuICAvLyBTZWN1cml0eSBhbmQgcGVyZm9ybWFjZSBoZWFkZXJzXG4gIC8vIHRoZXNlIGhlYWRlcnMgY29tZSBmcm9tIHRoZXNlIGRvY3M6IGh0dHBzOi8vZXhwcmVzc2pzLmNvbS9lbi9hcGkuaHRtbCNhcHAuc2V0dGluZ3MudGFibGVcbiAgYXBwLnNldCgneC1wb3dlcmVkLWJ5JywgZmFsc2UpO1xuICBhcHAuc2V0KCdldGFnJywgZmFsc2UpO1xuICByZXR1cm4gYXBwO1xufVxuZXhwb3J0IGNvbnN0IFdlYkFwcCA9IHt9O1xuZXhwb3J0IGNvbnN0IFdlYkFwcEludGVybmFscyA9IHt9O1xuXG5jb25zdCBoYXNPd24gPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5O1xuXG5cbldlYkFwcEludGVybmFscy5OcG1Nb2R1bGVzID0ge1xuICBleHByZXNzIDoge1xuICAgIHZlcnNpb246IE5wbS5yZXF1aXJlKCdleHByZXNzL3BhY2thZ2UuanNvbicpLnZlcnNpb24sXG4gICAgbW9kdWxlOiBleHByZXNzLFxuICB9XG59O1xuXG4vLyBUaG91Z2ggd2UgbWlnaHQgcHJlZmVyIHRvIHVzZSB3ZWIuYnJvd3NlciAobW9kZXJuKSBhcyB0aGUgZGVmYXVsdFxuLy8gYXJjaGl0ZWN0dXJlLCBzYWZldHkgcmVxdWlyZXMgYSBtb3JlIGNvbXBhdGlibGUgZGVmYXVsdEFyY2guXG5XZWJBcHAuZGVmYXVsdEFyY2ggPSAnd2ViLmJyb3dzZXIubGVnYWN5JztcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gbWFuaWZlc3RzXG5XZWJBcHAuY2xpZW50UHJvZ3JhbXMgPSB7fTtcblxuLy8gWFhYIG1hcHMgYXJjaHMgdG8gcHJvZ3JhbSBwYXRoIG9uIGZpbGVzeXN0ZW1cbnZhciBhcmNoUGF0aCA9IHt9O1xuXG52YXIgYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2sgPSBmdW5jdGlvbih1cmwpIHtcbiAgdmFyIGJ1bmRsZWRQcmVmaXggPSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMX1BBVEhfUFJFRklYIHx8ICcnO1xuICByZXR1cm4gYnVuZGxlZFByZWZpeCArIHVybDtcbn07XG5cbnZhciBzaGExID0gZnVuY3Rpb24oY29udGVudHMpIHtcbiAgdmFyIGhhc2ggPSBjcmVhdGVIYXNoKCdzaGExJyk7XG4gIGhhc2gudXBkYXRlKGNvbnRlbnRzKTtcbiAgcmV0dXJuIGhhc2guZGlnZXN0KCdoZXgnKTtcbn07XG5cbmZ1bmN0aW9uIHNob3VsZENvbXByZXNzKHJlcSwgcmVzKSB7XG4gIGlmIChyZXEuaGVhZGVyc1sneC1uby1jb21wcmVzc2lvbiddKSB7XG4gICAgLy8gZG9uJ3QgY29tcHJlc3MgcmVzcG9uc2VzIHdpdGggdGhpcyByZXF1ZXN0IGhlYWRlclxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIC8vIGZhbGxiYWNrIHRvIHN0YW5kYXJkIGZpbHRlciBmdW5jdGlvblxuICByZXR1cm4gY29tcHJlc3MuZmlsdGVyKHJlcSwgcmVzKTtcbn1cblxuLy8gI0Jyb3dzZXJJZGVudGlmaWNhdGlvblxuLy9cbi8vIFdlIGhhdmUgbXVsdGlwbGUgcGxhY2VzIHRoYXQgd2FudCB0byBpZGVudGlmeSB0aGUgYnJvd3NlcjogdGhlXG4vLyB1bnN1cHBvcnRlZCBicm93c2VyIHBhZ2UsIHRoZSBhcHBjYWNoZSBwYWNrYWdlLCBhbmQsIGV2ZW50dWFsbHlcbi8vIGRlbGl2ZXJpbmcgYnJvd3NlciBwb2x5ZmlsbHMgb25seSBhcyBuZWVkZWQuXG4vL1xuLy8gVG8gYXZvaWQgZGV0ZWN0aW5nIHRoZSBicm93c2VyIGluIG11bHRpcGxlIHBsYWNlcyBhZC1ob2MsIHdlIGNyZWF0ZSBhXG4vLyBNZXRlb3IgXCJicm93c2VyXCIgb2JqZWN0LiBJdCB1c2VzIGJ1dCBkb2VzIG5vdCBleHBvc2UgdGhlIG5wbVxuLy8gdXNlcmFnZW50IG1vZHVsZSAod2UgY291bGQgY2hvb3NlIGEgZGlmZmVyZW50IG1lY2hhbmlzbSB0byBpZGVudGlmeVxuLy8gdGhlIGJyb3dzZXIgaW4gdGhlIGZ1dHVyZSBpZiB3ZSB3YW50ZWQgdG8pLiAgVGhlIGJyb3dzZXIgb2JqZWN0XG4vLyBjb250YWluc1xuLy9cbi8vICogYG5hbWVgOiB0aGUgbmFtZSBvZiB0aGUgYnJvd3NlciBpbiBjYW1lbCBjYXNlXG4vLyAqIGBtYWpvcmAsIGBtaW5vcmAsIGBwYXRjaGA6IGludGVnZXJzIGRlc2NyaWJpbmcgdGhlIGJyb3dzZXIgdmVyc2lvblxuLy9cbi8vIEFsc28gaGVyZSBpcyBhbiBlYXJseSB2ZXJzaW9uIG9mIGEgTWV0ZW9yIGByZXF1ZXN0YCBvYmplY3QsIGludGVuZGVkXG4vLyB0byBiZSBhIGhpZ2gtbGV2ZWwgZGVzY3JpcHRpb24gb2YgdGhlIHJlcXVlc3Qgd2l0aG91dCBleHBvc2luZ1xuLy8gZGV0YWlscyBvZiBjb25uZWN0J3MgbG93LWxldmVsIGByZXFgLiAgQ3VycmVudGx5IGl0IGNvbnRhaW5zOlxuLy9cbi8vICogYGJyb3dzZXJgOiBicm93c2VyIGlkZW50aWZpY2F0aW9uIG9iamVjdCBkZXNjcmliZWQgYWJvdmVcbi8vICogYHVybGA6IHBhcnNlZCB1cmwsIGluY2x1ZGluZyBwYXJzZWQgcXVlcnkgcGFyYW1zXG4vL1xuLy8gQXMgYSB0ZW1wb3JhcnkgaGFjayB0aGVyZSBpcyBhIGBjYXRlZ29yaXplUmVxdWVzdGAgZnVuY3Rpb24gb24gV2ViQXBwIHdoaWNoXG4vLyBjb252ZXJ0cyBhIGNvbm5lY3QgYHJlcWAgdG8gYSBNZXRlb3IgYHJlcXVlc3RgLiBUaGlzIGNhbiBnbyBhd2F5IG9uY2Ugc21hcnRcbi8vIHBhY2thZ2VzIHN1Y2ggYXMgYXBwY2FjaGUgYXJlIGJlaW5nIHBhc3NlZCBhIGByZXF1ZXN0YCBvYmplY3QgZGlyZWN0bHkgd2hlblxuLy8gdGhleSBzZXJ2ZSBjb250ZW50LlxuLy9cbi8vIFRoaXMgYWxsb3dzIGByZXF1ZXN0YCB0byBiZSB1c2VkIHVuaWZvcm1seTogaXQgaXMgcGFzc2VkIHRvIHRoZSBodG1sXG4vLyBhdHRyaWJ1dGVzIGhvb2ssIGFuZCB0aGUgYXBwY2FjaGUgcGFja2FnZSBjYW4gdXNlIGl0IHdoZW4gZGVjaWRpbmdcbi8vIHdoZXRoZXIgdG8gZ2VuZXJhdGUgYSA0MDQgZm9yIHRoZSBtYW5pZmVzdC5cbi8vXG4vLyBSZWFsIHJvdXRpbmcgLyBzZXJ2ZXIgc2lkZSByZW5kZXJpbmcgd2lsbCBwcm9iYWJseSByZWZhY3RvciB0aGlzXG4vLyBoZWF2aWx5LlxuXG4vLyBlLmcuIFwiTW9iaWxlIFNhZmFyaVwiID0+IFwibW9iaWxlU2FmYXJpXCJcbnZhciBjYW1lbENhc2UgPSBmdW5jdGlvbihuYW1lKSB7XG4gIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJyAnKTtcbiAgcGFydHNbMF0gPSBwYXJ0c1swXS50b0xvd2VyQ2FzZSgpO1xuICBmb3IgKHZhciBpID0gMTsgaSA8IHBhcnRzLmxlbmd0aDsgKytpKSB7XG4gICAgcGFydHNbaV0gPSBwYXJ0c1tpXS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHBhcnRzW2ldLnN1YnN0cigxKTtcbiAgfVxuICByZXR1cm4gcGFydHMuam9pbignJyk7XG59O1xuXG52YXIgaWRlbnRpZnlCcm93c2VyID0gZnVuY3Rpb24odXNlckFnZW50U3RyaW5nKSB7XG4gIHZhciB1c2VyQWdlbnQgPSBsb29rdXBVc2VyQWdlbnQodXNlckFnZW50U3RyaW5nKTtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiBjYW1lbENhc2UodXNlckFnZW50LmZhbWlseSksXG4gICAgbWFqb3I6ICt1c2VyQWdlbnQubWFqb3IsXG4gICAgbWlub3I6ICt1c2VyQWdlbnQubWlub3IsXG4gICAgcGF0Y2g6ICt1c2VyQWdlbnQucGF0Y2gsXG4gIH07XG59O1xuXG4vLyBYWFggUmVmYWN0b3IgYXMgcGFydCBvZiBpbXBsZW1lbnRpbmcgcmVhbCByb3V0aW5nLlxuV2ViQXBwSW50ZXJuYWxzLmlkZW50aWZ5QnJvd3NlciA9IGlkZW50aWZ5QnJvd3NlcjtcblxuV2ViQXBwLmNhdGVnb3JpemVSZXF1ZXN0ID0gZnVuY3Rpb24ocmVxKSB7XG4gIGlmIChyZXEuYnJvd3NlciAmJiByZXEuYXJjaCAmJiB0eXBlb2YgcmVxLm1vZGVybiA9PT0gJ2Jvb2xlYW4nKSB7XG4gICAgLy8gQWxyZWFkeSBjYXRlZ29yaXplZC5cbiAgICByZXR1cm4gcmVxO1xuICB9XG5cbiAgY29uc3QgYnJvd3NlciA9IGlkZW50aWZ5QnJvd3NlcihyZXEuaGVhZGVyc1sndXNlci1hZ2VudCddKTtcbiAgY29uc3QgbW9kZXJuID0gaXNNb2Rlcm4oYnJvd3Nlcik7XG4gIGNvbnN0IHBhdGggPVxuICAgIHR5cGVvZiByZXEucGF0aG5hbWUgPT09ICdzdHJpbmcnXG4gICAgICA/IHJlcS5wYXRobmFtZVxuICAgICAgOiBwYXJzZVJlcXVlc3QocmVxKS5wYXRobmFtZTtcblxuICBjb25zdCBjYXRlZ29yaXplZCA9IHtcbiAgICBicm93c2VyLFxuICAgIG1vZGVybixcbiAgICBwYXRoLFxuICAgIGFyY2g6IFdlYkFwcC5kZWZhdWx0QXJjaCxcbiAgICB1cmw6IHBhcnNlVXJsKHJlcS51cmwsIHRydWUpLFxuICAgIGR5bmFtaWNIZWFkOiByZXEuZHluYW1pY0hlYWQsXG4gICAgZHluYW1pY0JvZHk6IHJlcS5keW5hbWljQm9keSxcbiAgICBoZWFkZXJzOiByZXEuaGVhZGVycyxcbiAgICBjb29raWVzOiByZXEuY29va2llcyxcbiAgfTtcblxuICBjb25zdCBwYXRoUGFydHMgPSBwYXRoLnNwbGl0KCcvJyk7XG4gIGNvbnN0IGFyY2hLZXkgPSBwYXRoUGFydHNbMV07XG5cbiAgaWYgKGFyY2hLZXkuc3RhcnRzV2l0aCgnX18nKSkge1xuICAgIGNvbnN0IGFyY2hDbGVhbmVkID0gJ3dlYi4nICsgYXJjaEtleS5zbGljZSgyKTtcbiAgICBpZiAoaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoQ2xlYW5lZCkpIHtcbiAgICAgIHBhdGhQYXJ0cy5zcGxpY2UoMSwgMSk7IC8vIFJlbW92ZSB0aGUgYXJjaEtleSBwYXJ0LlxuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oY2F0ZWdvcml6ZWQsIHtcbiAgICAgICAgYXJjaDogYXJjaENsZWFuZWQsXG4gICAgICAgIHBhdGg6IHBhdGhQYXJ0cy5qb2luKCcvJyksXG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvLyBUT0RPIFBlcmhhcHMgb25lIGRheSB3ZSBjb3VsZCBpbmZlciBDb3Jkb3ZhIGNsaWVudHMgaGVyZSwgc28gdGhhdCB3ZVxuICAvLyB3b3VsZG4ndCBoYXZlIHRvIHVzZSBwcmVmaXhlZCBcIi9fX2NvcmRvdmEvLi4uXCIgVVJMcy5cbiAgY29uc3QgcHJlZmVycmVkQXJjaE9yZGVyID0gaXNNb2Rlcm4oYnJvd3NlcilcbiAgICA/IFsnd2ViLmJyb3dzZXInLCAnd2ViLmJyb3dzZXIubGVnYWN5J11cbiAgICA6IFsnd2ViLmJyb3dzZXIubGVnYWN5JywgJ3dlYi5icm93c2VyJ107XG5cbiAgZm9yIChjb25zdCBhcmNoIG9mIHByZWZlcnJlZEFyY2hPcmRlcikge1xuICAgIC8vIElmIG91ciBwcmVmZXJyZWQgYXJjaCBpcyBub3QgYXZhaWxhYmxlLCBpdCdzIGJldHRlciB0byB1c2UgYW5vdGhlclxuICAgIC8vIGNsaWVudCBhcmNoIHRoYXQgaXMgYXZhaWxhYmxlIHRoYW4gdG8gZ3VhcmFudGVlIHRoZSBzaXRlIHdvbid0IHdvcmtcbiAgICAvLyBieSByZXR1cm5pbmcgYW4gdW5rbm93biBhcmNoLiBGb3IgZXhhbXBsZSwgaWYgd2ViLmJyb3dzZXIubGVnYWN5IGlzXG4gICAgLy8gZXhjbHVkZWQgdXNpbmcgdGhlIC0tZXhjbHVkZS1hcmNocyBjb21tYW5kLWxpbmUgb3B0aW9uLCBsZWdhY3lcbiAgICAvLyBjbGllbnRzIGFyZSBiZXR0ZXIgb2ZmIHJlY2VpdmluZyB3ZWIuYnJvd3NlciAod2hpY2ggbWlnaHQgYWN0dWFsbHlcbiAgICAvLyB3b3JrKSB0aGFuIHJlY2VpdmluZyBhbiBIVFRQIDQwNCByZXNwb25zZS4gSWYgbm9uZSBvZiB0aGUgYXJjaHMgaW5cbiAgICAvLyBwcmVmZXJyZWRBcmNoT3JkZXIgYXJlIGRlZmluZWQsIG9ubHkgdGhlbiBzaG91bGQgd2Ugc2VuZCBhIDQwNC5cbiAgICBpZiAoaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgICAgcmV0dXJuIE9iamVjdC5hc3NpZ24oY2F0ZWdvcml6ZWQsIHsgYXJjaCB9KTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gY2F0ZWdvcml6ZWQ7XG59O1xuXG4vLyBIVE1MIGF0dHJpYnV0ZSBob29rczogZnVuY3Rpb25zIHRvIGJlIGNhbGxlZCB0byBkZXRlcm1pbmUgYW55IGF0dHJpYnV0ZXMgdG9cbi8vIGJlIGFkZGVkIHRvIHRoZSAnPGh0bWw+JyB0YWcuIEVhY2ggZnVuY3Rpb24gaXMgcGFzc2VkIGEgJ3JlcXVlc3QnIG9iamVjdCAoc2VlXG4vLyAjQnJvd3NlcklkZW50aWZpY2F0aW9uKSBhbmQgc2hvdWxkIHJldHVybiBudWxsIG9yIG9iamVjdC5cbnZhciBodG1sQXR0cmlidXRlSG9va3MgPSBbXTtcbnZhciBnZXRIdG1sQXR0cmlidXRlcyA9IGZ1bmN0aW9uKHJlcXVlc3QpIHtcbiAgdmFyIGNvbWJpbmVkQXR0cmlidXRlcyA9IHt9O1xuICBfLmVhY2goaHRtbEF0dHJpYnV0ZUhvb2tzIHx8IFtdLCBmdW5jdGlvbihob29rKSB7XG4gICAgdmFyIGF0dHJpYnV0ZXMgPSBob29rKHJlcXVlc3QpO1xuICAgIGlmIChhdHRyaWJ1dGVzID09PSBudWxsKSByZXR1cm47XG4gICAgaWYgKHR5cGVvZiBhdHRyaWJ1dGVzICE9PSAnb2JqZWN0JylcbiAgICAgIHRocm93IEVycm9yKCdIVE1MIGF0dHJpYnV0ZSBob29rIG11c3QgcmV0dXJuIG51bGwgb3Igb2JqZWN0Jyk7XG4gICAgXy5leHRlbmQoY29tYmluZWRBdHRyaWJ1dGVzLCBhdHRyaWJ1dGVzKTtcbiAgfSk7XG4gIHJldHVybiBjb21iaW5lZEF0dHJpYnV0ZXM7XG59O1xuV2ViQXBwLmFkZEh0bWxBdHRyaWJ1dGVIb29rID0gZnVuY3Rpb24oaG9vaykge1xuICBodG1sQXR0cmlidXRlSG9va3MucHVzaChob29rKTtcbn07XG5cbi8vIFNlcnZlIGFwcCBIVE1MIGZvciB0aGlzIFVSTD9cbnZhciBhcHBVcmwgPSBmdW5jdGlvbih1cmwpIHtcbiAgaWYgKHVybCA9PT0gJy9mYXZpY29uLmljbycgfHwgdXJsID09PSAnL3JvYm90cy50eHQnKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gTk9URTogYXBwLm1hbmlmZXN0IGlzIG5vdCBhIHdlYiBzdGFuZGFyZCBsaWtlIGZhdmljb24uaWNvIGFuZFxuICAvLyByb2JvdHMudHh0LiBJdCBpcyBhIGZpbGUgbmFtZSB3ZSBoYXZlIGNob3NlbiB0byB1c2UgZm9yIEhUTUw1XG4gIC8vIGFwcGNhY2hlIFVSTHMuIEl0IGlzIGluY2x1ZGVkIGhlcmUgdG8gcHJldmVudCB1c2luZyBhbiBhcHBjYWNoZVxuICAvLyB0aGVuIHJlbW92aW5nIGl0IGZyb20gcG9pc29uaW5nIGFuIGFwcCBwZXJtYW5lbnRseS4gRXZlbnR1YWxseSxcbiAgLy8gb25jZSB3ZSBoYXZlIHNlcnZlciBzaWRlIHJvdXRpbmcsIHRoaXMgd29uJ3QgYmUgbmVlZGVkIGFzXG4gIC8vIHVua25vd24gVVJMcyB3aXRoIHJldHVybiBhIDQwNCBhdXRvbWF0aWNhbGx5LlxuICBpZiAodXJsID09PSAnL2FwcC5tYW5pZmVzdCcpIHJldHVybiBmYWxzZTtcblxuICAvLyBBdm9pZCBzZXJ2aW5nIGFwcCBIVE1MIGZvciBkZWNsYXJlZCByb3V0ZXMgc3VjaCBhcyAvc29ja2pzLy5cbiAgaWYgKFJvdXRlUG9saWN5LmNsYXNzaWZ5KHVybCkpIHJldHVybiBmYWxzZTtcblxuICAvLyB3ZSBjdXJyZW50bHkgcmV0dXJuIGFwcCBIVE1MIG9uIGFsbCBVUkxzIGJ5IGRlZmF1bHRcbiAgcmV0dXJuIHRydWU7XG59O1xuXG4vLyBXZSBuZWVkIHRvIGNhbGN1bGF0ZSB0aGUgY2xpZW50IGhhc2ggYWZ0ZXIgYWxsIHBhY2thZ2VzIGhhdmUgbG9hZGVkXG4vLyB0byBnaXZlIHRoZW0gYSBjaGFuY2UgdG8gcG9wdWxhdGUgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5cbi8vXG4vLyBDYWxjdWxhdGluZyB0aGUgaGFzaCBkdXJpbmcgc3RhcnR1cCBtZWFucyB0aGF0IHBhY2thZ2VzIGNhbiBvbmx5XG4vLyBwb3B1bGF0ZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fIGR1cmluZyBsb2FkLCBub3QgZHVyaW5nIHN0YXJ0dXAuXG4vL1xuLy8gQ2FsY3VsYXRpbmcgaW5zdGVhZCBpdCBhdCB0aGUgYmVnaW5uaW5nIG9mIG1haW4gYWZ0ZXIgYWxsIHN0YXJ0dXBcbi8vIGhvb2tzIGhhZCBydW4gd291bGQgYWxsb3cgcGFja2FnZXMgdG8gYWxzbyBwb3B1bGF0ZVxuLy8gX19tZXRlb3JfcnVudGltZV9jb25maWdfXyBkdXJpbmcgc3RhcnR1cCwgYnV0IHRoYXQncyB0b28gbGF0ZSBmb3Jcbi8vIGF1dG91cGRhdGUgYmVjYXVzZSBpdCBuZWVkcyB0byBoYXZlIHRoZSBjbGllbnQgaGFzaCBhdCBzdGFydHVwIHRvXG4vLyBpbnNlcnQgdGhlIGF1dG8gdXBkYXRlIHZlcnNpb24gaXRzZWxmIGludG9cbi8vIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18gdG8gZ2V0IGl0IHRvIHRoZSBjbGllbnQuXG4vL1xuLy8gQW4gYWx0ZXJuYXRpdmUgd291bGQgYmUgdG8gZ2l2ZSBhdXRvdXBkYXRlIGEgXCJwb3N0LXN0YXJ0LFxuLy8gcHJlLWxpc3RlblwiIGhvb2sgdG8gYWxsb3cgaXQgdG8gaW5zZXJ0IHRoZSBhdXRvIHVwZGF0ZSB2ZXJzaW9uIGF0XG4vLyB0aGUgcmlnaHQgbW9tZW50LlxuXG5NZXRlb3Iuc3RhcnR1cChmdW5jdGlvbigpIHtcbiAgZnVuY3Rpb24gZ2V0dGVyKGtleSkge1xuICAgIHJldHVybiBmdW5jdGlvbihhcmNoKSB7XG4gICAgICBhcmNoID0gYXJjaCB8fCBXZWJBcHAuZGVmYXVsdEFyY2g7XG4gICAgICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICAgICAgY29uc3QgdmFsdWUgPSBwcm9ncmFtICYmIHByb2dyYW1ba2V5XTtcbiAgICAgIC8vIElmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWUgd2UgaGF2ZSBjYWxjdWxhdGVkIHRoaXMgaGFzaCxcbiAgICAgIC8vIHByb2dyYW1ba2V5XSB3aWxsIGJlIGEgdGh1bmsgKGxhenkgZnVuY3Rpb24gd2l0aCBubyBwYXJhbWV0ZXJzKVxuICAgICAgLy8gdGhhdCB3ZSBzaG91bGQgY2FsbCB0byBkbyB0aGUgYWN0dWFsIGNvbXB1dGF0aW9uLlxuICAgICAgcmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJyA/IChwcm9ncmFtW2tleV0gPSB2YWx1ZSgpKSA6IHZhbHVlO1xuICAgIH07XG4gIH1cblxuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaCA9IFdlYkFwcC5jbGllbnRIYXNoID0gZ2V0dGVyKCd2ZXJzaW9uJyk7XG4gIFdlYkFwcC5jYWxjdWxhdGVDbGllbnRIYXNoUmVmcmVzaGFibGUgPSBnZXR0ZXIoJ3ZlcnNpb25SZWZyZXNoYWJsZScpO1xuICBXZWJBcHAuY2FsY3VsYXRlQ2xpZW50SGFzaE5vblJlZnJlc2hhYmxlID0gZ2V0dGVyKCd2ZXJzaW9uTm9uUmVmcmVzaGFibGUnKTtcbiAgV2ViQXBwLmNhbGN1bGF0ZUNsaWVudEhhc2hSZXBsYWNlYWJsZSA9IGdldHRlcigndmVyc2lvblJlcGxhY2VhYmxlJyk7XG4gIFdlYkFwcC5nZXRSZWZyZXNoYWJsZUFzc2V0cyA9IGdldHRlcigncmVmcmVzaGFibGVBc3NldHMnKTtcbn0pO1xuXG4vLyBXaGVuIHdlIGhhdmUgYSByZXF1ZXN0IHBlbmRpbmcsIHdlIHdhbnQgdGhlIHNvY2tldCB0aW1lb3V0IHRvIGJlIGxvbmcsIHRvXG4vLyBnaXZlIG91cnNlbHZlcyBhIHdoaWxlIHRvIHNlcnZlIGl0LCBhbmQgdG8gYWxsb3cgc29ja2pzIGxvbmcgcG9sbHMgdG9cbi8vIGNvbXBsZXRlLiAgT24gdGhlIG90aGVyIGhhbmQsIHdlIHdhbnQgdG8gY2xvc2UgaWRsZSBzb2NrZXRzIHJlbGF0aXZlbHlcbi8vIHF1aWNrbHksIHNvIHRoYXQgd2UgY2FuIHNodXQgZG93biByZWxhdGl2ZWx5IHByb21wdGx5IGJ1dCBjbGVhbmx5LCB3aXRob3V0XG4vLyBjdXR0aW5nIG9mZiBhbnlvbmUncyByZXNwb25zZS5cbldlYkFwcC5fdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2sgPSBmdW5jdGlvbihyZXEsIHJlcykge1xuICAvLyB0aGlzIGlzIHJlYWxseSBqdXN0IHJlcS5zb2NrZXQuc2V0VGltZW91dChMT05HX1NPQ0tFVF9USU1FT1VUKTtcbiAgcmVxLnNldFRpbWVvdXQoTE9OR19TT0NLRVRfVElNRU9VVCk7XG4gIC8vIEluc2VydCBvdXIgbmV3IGZpbmlzaCBsaXN0ZW5lciB0byBydW4gQkVGT1JFIHRoZSBleGlzdGluZyBvbmUgd2hpY2ggcmVtb3Zlc1xuICAvLyB0aGUgcmVzcG9uc2UgZnJvbSB0aGUgc29ja2V0LlxuICB2YXIgZmluaXNoTGlzdGVuZXJzID0gcmVzLmxpc3RlbmVycygnZmluaXNoJyk7XG4gIC8vIFhYWCBBcHBhcmVudGx5IGluIE5vZGUgMC4xMiB0aGlzIGV2ZW50IHdhcyBjYWxsZWQgJ3ByZWZpbmlzaCcuXG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9qb3llbnQvbm9kZS9jb21taXQvN2M5YjYwNzBcbiAgLy8gQnV0IGl0IGhhcyBzd2l0Y2hlZCBiYWNrIHRvICdmaW5pc2gnIGluIE5vZGUgdjQ6XG4gIC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9ub2RlanMvbm9kZS9wdWxsLzE0MTFcbiAgcmVzLnJlbW92ZUFsbExpc3RlbmVycygnZmluaXNoJyk7XG4gIHJlcy5vbignZmluaXNoJywgZnVuY3Rpb24oKSB7XG4gICAgcmVzLnNldFRpbWVvdXQoU0hPUlRfU09DS0VUX1RJTUVPVVQpO1xuICB9KTtcbiAgXy5lYWNoKGZpbmlzaExpc3RlbmVycywgZnVuY3Rpb24obCkge1xuICAgIHJlcy5vbignZmluaXNoJywgbCk7XG4gIH0pO1xufTtcblxuLy8gV2lsbCBiZSB1cGRhdGVkIGJ5IG1haW4gYmVmb3JlIHdlIGxpc3Rlbi5cbi8vIE1hcCBmcm9tIGNsaWVudCBhcmNoIHRvIGJvaWxlcnBsYXRlIG9iamVjdC5cbi8vIEJvaWxlcnBsYXRlIG9iamVjdCBoYXM6XG4vLyAgIC0gZnVuYzogWFhYXG4vLyAgIC0gYmFzZURhdGE6IFhYWFxudmFyIGJvaWxlcnBsYXRlQnlBcmNoID0ge307XG5cbi8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgZnVuY3Rpb24gdGhhdCBjYW4gc2VsZWN0aXZlbHkgbW9kaWZ5IGJvaWxlcnBsYXRlXG4vLyBkYXRhIGdpdmVuIGFyZ3VtZW50cyAocmVxdWVzdCwgZGF0YSwgYXJjaCkuIFRoZSBrZXkgc2hvdWxkIGJlIGEgdW5pcXVlXG4vLyBpZGVudGlmaWVyLCB0byBwcmV2ZW50IGFjY3VtdWxhdGluZyBkdXBsaWNhdGUgY2FsbGJhY2tzIGZyb20gdGhlIHNhbWVcbi8vIGNhbGwgc2l0ZSBvdmVyIHRpbWUuIENhbGxiYWNrcyB3aWxsIGJlIGNhbGxlZCBpbiB0aGUgb3JkZXIgdGhleSB3ZXJlXG4vLyByZWdpc3RlcmVkLiBBIGNhbGxiYWNrIHNob3VsZCByZXR1cm4gZmFsc2UgaWYgaXQgZGlkIG5vdCBtYWtlIGFueVxuLy8gY2hhbmdlcyBhZmZlY3RpbmcgdGhlIGJvaWxlcnBsYXRlLiBQYXNzaW5nIG51bGwgZGVsZXRlcyB0aGUgY2FsbGJhY2suXG4vLyBBbnkgcHJldmlvdXMgY2FsbGJhY2sgcmVnaXN0ZXJlZCBmb3IgdGhpcyBrZXkgd2lsbCBiZSByZXR1cm5lZC5cbmNvbnN0IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5XZWJBcHBJbnRlcm5hbHMucmVnaXN0ZXJCb2lsZXJwbGF0ZURhdGFDYWxsYmFjayA9IGZ1bmN0aW9uKGtleSwgY2FsbGJhY2spIHtcbiAgY29uc3QgcHJldmlvdXNDYWxsYmFjayA9IGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuXG4gIGlmICh0eXBlb2YgY2FsbGJhY2sgPT09ICdmdW5jdGlvbicpIHtcbiAgICBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XSA9IGNhbGxiYWNrO1xuICB9IGVsc2Uge1xuICAgIGFzc2VydC5zdHJpY3RFcXVhbChjYWxsYmFjaywgbnVsbCk7XG4gICAgZGVsZXRlIGJvaWxlcnBsYXRlRGF0YUNhbGxiYWNrc1trZXldO1xuICB9XG5cbiAgLy8gUmV0dXJuIHRoZSBwcmV2aW91cyBjYWxsYmFjayBpbiBjYXNlIHRoZSBuZXcgY2FsbGJhY2sgbmVlZHMgdG8gY2FsbFxuICAvLyBpdDsgZm9yIGV4YW1wbGUsIHdoZW4gdGhlIG5ldyBjYWxsYmFjayBpcyBhIHdyYXBwZXIgZm9yIHRoZSBvbGQuXG4gIHJldHVybiBwcmV2aW91c0NhbGxiYWNrIHx8IG51bGw7XG59O1xuXG4vLyBHaXZlbiBhIHJlcXVlc3QgKGFzIHJldHVybmVkIGZyb20gYGNhdGVnb3JpemVSZXF1ZXN0YCksIHJldHVybiB0aGVcbi8vIGJvaWxlcnBsYXRlIEhUTUwgdG8gc2VydmUgZm9yIHRoYXQgcmVxdWVzdC5cbi8vXG4vLyBJZiBhIHByZXZpb3VzIGNvbm5lY3QgbWlkZGxld2FyZSBoYXMgcmVuZGVyZWQgY29udGVudCBmb3IgdGhlIGhlYWQgb3IgYm9keSxcbi8vIHJldHVybnMgdGhlIGJvaWxlcnBsYXRlIHdpdGggdGhhdCBjb250ZW50IHBhdGNoZWQgaW4gb3RoZXJ3aXNlXG4vLyBtZW1vaXplcyBvbiBIVE1MIGF0dHJpYnV0ZXMgKHVzZWQgYnksIGVnLCBhcHBjYWNoZSkgYW5kIHdoZXRoZXIgaW5saW5lXG4vLyBzY3JpcHRzIGFyZSBjdXJyZW50bHkgYWxsb3dlZC5cbi8vIFhYWCBzbyBmYXIgdGhpcyBmdW5jdGlvbiBpcyBhbHdheXMgY2FsbGVkIHdpdGggYXJjaCA9PT0gJ3dlYi5icm93c2VyJ1xuZnVuY3Rpb24gZ2V0Qm9pbGVycGxhdGUocmVxdWVzdCwgYXJjaCkge1xuICByZXR1cm4gZ2V0Qm9pbGVycGxhdGVBc3luYyhyZXF1ZXN0LCBhcmNoKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBUYWtlcyBhIHJ1bnRpbWUgY29uZmlndXJhdGlvbiBvYmplY3QgYW5kXG4gKiByZXR1cm5zIGFuIGVuY29kZWQgcnVudGltZSBzdHJpbmcuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge09iamVjdH0gcnRpbWVDb25maWdcbiAqIEByZXR1cm5zIHtTdHJpbmd9XG4gKi9cbldlYkFwcC5lbmNvZGVSdW50aW1lQ29uZmlnID0gZnVuY3Rpb24ocnRpbWVDb25maWcpIHtcbiAgcmV0dXJuIEpTT04uc3RyaW5naWZ5KGVuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShydGltZUNvbmZpZykpKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgVGFrZXMgYW4gZW5jb2RlZCBydW50aW1lIHN0cmluZyBhbmQgcmV0dXJuc1xuICogYSBydW50aW1lIGNvbmZpZ3VyYXRpb24gb2JqZWN0LlxuICogQGxvY3VzIFNlcnZlclxuICogQHBhcmFtIHtTdHJpbmd9IHJ0aW1lQ29uZmlnU3RyaW5nXG4gKiBAcmV0dXJucyB7T2JqZWN0fVxuICovXG5XZWJBcHAuZGVjb2RlUnVudGltZUNvbmZpZyA9IGZ1bmN0aW9uKHJ0aW1lQ29uZmlnU3RyKSB7XG4gIHJldHVybiBKU09OLnBhcnNlKGRlY29kZVVSSUNvbXBvbmVudChKU09OLnBhcnNlKHJ0aW1lQ29uZmlnU3RyKSkpO1xufTtcblxuY29uc3QgcnVudGltZUNvbmZpZyA9IHtcbiAgLy8gaG9va3Mgd2lsbCBjb250YWluIHRoZSBjYWxsYmFjayBmdW5jdGlvbnNcbiAgLy8gc2V0IGJ5IHRoZSBjYWxsZXIgdG8gYWRkUnVudGltZUNvbmZpZ0hvb2tcbiAgaG9va3M6IG5ldyBIb29rKCksXG4gIC8vIHVwZGF0ZUhvb2tzIHdpbGwgY29udGFpbiB0aGUgY2FsbGJhY2sgZnVuY3Rpb25zXG4gIC8vIHNldCBieSB0aGUgY2FsbGVyIHRvIGFkZFVwZGF0ZWROb3RpZnlIb29rXG4gIHVwZGF0ZUhvb2tzOiBuZXcgSG9vaygpLFxuICAvLyBpc1VwZGF0ZWRCeUFyY2ggaXMgYW4gb2JqZWN0IGNvbnRhaW5pbmcgZmllbGRzIGZvciBlYWNoIGFyY2hcbiAgLy8gdGhhdCB0aGlzIHNlcnZlciBzdXBwb3J0cy5cbiAgLy8gLSBFYWNoIGZpZWxkIHdpbGwgYmUgdHJ1ZSB3aGVuIHRoZSBzZXJ2ZXIgdXBkYXRlcyB0aGUgcnVudGltZUNvbmZpZyBmb3IgdGhhdCBhcmNoLlxuICAvLyAtIFdoZW4gdGhlIGhvb2sgY2FsbGJhY2sgaXMgY2FsbGVkIHRoZSB1cGRhdGUgZmllbGQgaW4gdGhlIGNhbGxiYWNrIG9iamVjdCB3aWxsIGJlXG4gIC8vIHNldCB0byBpc1VwZGF0ZWRCeUFyY2hbYXJjaF0uXG4gIC8vID0gaXNVcGRhdGVkeUJ5QXJjaFthcmNoXSBpcyByZXNldCB0byBmYWxzZSBhZnRlciB0aGUgY2FsbGJhY2suXG4gIC8vIFRoaXMgZW5hYmxlcyB0aGUgY2FsbGVyIHRvIGNhY2hlIGRhdGEgZWZmaWNpZW50bHkgc28gdGhleSBkbyBub3QgbmVlZCB0b1xuICAvLyBkZWNvZGUgJiB1cGRhdGUgZGF0YSBvbiBldmVyeSBjYWxsYmFjayB3aGVuIHRoZSBydW50aW1lQ29uZmlnIGlzIG5vdCBjaGFuZ2luZy5cbiAgaXNVcGRhdGVkQnlBcmNoOiB7fSxcbn07XG5cbi8qKlxuICogQG5hbWUgYWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFjayhvcHRpb25zKVxuICogQGxvY3VzIFNlcnZlclxuICogQGlzcHJvdG90eXBlIHRydWVcbiAqIEBzdW1tYXJ5IENhbGxiYWNrIGZvciBgYWRkUnVudGltZUNvbmZpZ0hvb2tgLlxuICpcbiAqIElmIHRoZSBoYW5kbGVyIHJldHVybnMgYSBfZmFsc3lfIHZhbHVlIHRoZSBob29rIHdpbGwgbm90XG4gKiBtb2RpZnkgdGhlIHJ1bnRpbWUgY29uZmlndXJhdGlvbi5cbiAqXG4gKiBJZiB0aGUgaGFuZGxlciByZXR1cm5zIGEgX1N0cmluZ18gdGhlIGhvb2sgd2lsbCBzdWJzdGl0dXRlXG4gKiB0aGUgc3RyaW5nIGZvciB0aGUgZW5jb2RlZCBjb25maWd1cmF0aW9uIHN0cmluZy5cbiAqXG4gKiAqKldhcm5pbmc6KiogdGhlIGhvb2sgZG9lcyBub3QgY2hlY2sgdGhlIHJldHVybiB2YWx1ZSBhdCBhbGwgaXQgaXNcbiAqIHRoZSByZXNwb25zaWJpbGl0eSBvZiB0aGUgY2FsbGVyIHRvIGdldCB0aGUgZm9ybWF0dGluZyBjb3JyZWN0IHVzaW5nXG4gKiB0aGUgaGVscGVyIGZ1bmN0aW9ucy5cbiAqXG4gKiBgYWRkUnVudGltZUNvbmZpZ0hvb2tDYWxsYmFja2AgdGFrZXMgb25seSBvbmUgYE9iamVjdGAgYXJndW1lbnRcbiAqIHdpdGggdGhlIGZvbGxvd2luZyBmaWVsZHM6XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMuYXJjaCBUaGUgYXJjaGl0ZWN0dXJlIG9mIHRoZSBjbGllbnRcbiAqIHJlcXVlc3RpbmcgYSBuZXcgcnVudGltZSBjb25maWd1cmF0aW9uLiBUaGlzIGNhbiBiZSBvbmUgb2ZcbiAqIGB3ZWIuYnJvd3NlcmAsIGB3ZWIuYnJvd3Nlci5sZWdhY3lgIG9yIGB3ZWIuY29yZG92YWAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5yZXF1ZXN0XG4gKiBBIE5vZGVKcyBbSW5jb21pbmdNZXNzYWdlXShodHRwczovL25vZGVqcy5vcmcvYXBpL2h0dHAuaHRtbCNodHRwX2NsYXNzX2h0dHBfaW5jb21pbmdtZXNzYWdlKVxuICogaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX2luY29taW5nbWVzc2FnZVxuICogYE9iamVjdGAgdGhhdCBjYW4gYmUgdXNlZCB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5lbmNvZGVkQ3VycmVudENvbmZpZyBUaGUgY3VycmVudCBjb25maWd1cmF0aW9uIG9iamVjdFxuICogZW5jb2RlZCBhcyBhIHN0cmluZyBmb3IgaW5jbHVzaW9uIGluIHRoZSByb290IGh0bWwuXG4gKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudXBkYXRlZCBgdHJ1ZWAgaWYgdGhlIGNvbmZpZyBmb3IgdGhpcyBhcmNoaXRlY3R1cmVcbiAqIGhhcyBiZWVuIHVwZGF0ZWQgc2luY2UgbGFzdCBjYWxsZWQsIG90aGVyd2lzZSBgZmFsc2VgLiBUaGlzIGZsYWcgY2FuIGJlIHVzZWRcbiAqIHRvIGNhY2hlIHRoZSBkZWNvZGluZy9lbmNvZGluZyBmb3IgZWFjaCBhcmNoaXRlY3R1cmUuXG4gKi9cblxuLyoqXG4gKiBAc3VtbWFyeSBIb29rIHRoYXQgY2FsbHMgYmFjayB3aGVuIHRoZSBtZXRlb3IgcnVudGltZSBjb25maWd1cmF0aW9uLFxuICogYF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX19gIGlzIGJlaW5nIHNlbnQgdG8gYW55IGNsaWVudC5cbiAqXG4gKiAqKnJldHVybnMqKjogPHNtYWxsPl9PYmplY3RfPC9zbWFsbD4gYHsgc3RvcDogZnVuY3Rpb24sIGNhbGxiYWNrOiBmdW5jdGlvbiB9YFxuICogLSBgc3RvcGAgPHNtYWxsPl9GdW5jdGlvbl88L3NtYWxsPiBDYWxsIGBzdG9wKClgIHRvIHN0b3AgZ2V0dGluZyBjYWxsYmFja3MuXG4gKiAtIGBjYWxsYmFja2AgPHNtYWxsPl9GdW5jdGlvbl88L3NtYWxsPiBUaGUgcGFzc2VkIGluIGBjYWxsYmFja2AuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge2FkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2t9IGNhbGxiYWNrXG4gKiBTZWUgYGFkZFJ1bnRpbWVDb25maWdIb29rQ2FsbGJhY2tgIGRlc2NyaXB0aW9uLlxuICogQHJldHVybnMge09iamVjdH0ge3sgc3RvcDogZnVuY3Rpb24sIGNhbGxiYWNrOiBmdW5jdGlvbiB9fVxuICogQ2FsbCB0aGUgcmV0dXJuZWQgYHN0b3AoKWAgdG8gc3RvcCBnZXR0aW5nIGNhbGxiYWNrcy5cbiAqIFRoZSBwYXNzZWQgaW4gYGNhbGxiYWNrYCBpcyByZXR1cm5lZCBhbHNvLlxuICovXG5XZWJBcHAuYWRkUnVudGltZUNvbmZpZ0hvb2sgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICByZXR1cm4gcnVudGltZUNvbmZpZy5ob29rcy5yZWdpc3RlcihjYWxsYmFjayk7XG59O1xuXG5mdW5jdGlvbiBnZXRCb2lsZXJwbGF0ZUFzeW5jKHJlcXVlc3QsIGFyY2gpIHtcbiAgbGV0IGJvaWxlcnBsYXRlID0gYm9pbGVycGxhdGVCeUFyY2hbYXJjaF07XG4gIHJ1bnRpbWVDb25maWcuaG9va3MuZm9yRWFjaChob29rID0+IHtcbiAgICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gaG9vayh7XG4gICAgICBhcmNoLFxuICAgICAgcmVxdWVzdCxcbiAgICAgIGVuY29kZWRDdXJyZW50Q29uZmlnOiBib2lsZXJwbGF0ZS5iYXNlRGF0YS5tZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgICAgdXBkYXRlZDogcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0sXG4gICAgfSk7XG4gICAgaWYgKCFtZXRlb3JSdW50aW1lQ29uZmlnKSByZXR1cm4gdHJ1ZTtcbiAgICBib2lsZXJwbGF0ZS5iYXNlRGF0YSA9IE9iamVjdC5hc3NpZ24oe30sIGJvaWxlcnBsYXRlLmJhc2VEYXRhLCB7XG4gICAgICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbiAgcnVudGltZUNvbmZpZy5pc1VwZGF0ZWRCeUFyY2hbYXJjaF0gPSBmYWxzZTtcbiAgY29uc3QgZGF0YSA9IE9iamVjdC5hc3NpZ24oXG4gICAge30sXG4gICAgYm9pbGVycGxhdGUuYmFzZURhdGEsXG4gICAge1xuICAgICAgaHRtbEF0dHJpYnV0ZXM6IGdldEh0bWxBdHRyaWJ1dGVzKHJlcXVlc3QpLFxuICAgIH0sXG4gICAgXy5waWNrKHJlcXVlc3QsICdkeW5hbWljSGVhZCcsICdkeW5hbWljQm9keScpXG4gICk7XG5cbiAgbGV0IG1hZGVDaGFuZ2VzID0gZmFsc2U7XG4gIGxldCBwcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cbiAgT2JqZWN0LmtleXMoYm9pbGVycGxhdGVEYXRhQ2FsbGJhY2tzKS5mb3JFYWNoKGtleSA9PiB7XG4gICAgcHJvbWlzZSA9IHByb21pc2VcbiAgICAgIC50aGVuKCgpID0+IHtcbiAgICAgICAgY29uc3QgY2FsbGJhY2sgPSBib2lsZXJwbGF0ZURhdGFDYWxsYmFja3Nba2V5XTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKHJlcXVlc3QsIGRhdGEsIGFyY2gpO1xuICAgICAgfSlcbiAgICAgIC50aGVuKHJlc3VsdCA9PiB7XG4gICAgICAgIC8vIENhbGxiYWNrcyBzaG91bGQgcmV0dXJuIGZhbHNlIGlmIHRoZXkgZGlkIG5vdCBtYWtlIGFueSBjaGFuZ2VzLlxuICAgICAgICBpZiAocmVzdWx0ICE9PSBmYWxzZSkge1xuICAgICAgICAgIG1hZGVDaGFuZ2VzID0gdHJ1ZTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gIH0pO1xuXG4gIHJldHVybiBwcm9taXNlLnRoZW4oKCkgPT4gKHtcbiAgICBzdHJlYW06IGJvaWxlcnBsYXRlLnRvSFRNTFN0cmVhbShkYXRhKSxcbiAgICBzdGF0dXNDb2RlOiBkYXRhLnN0YXR1c0NvZGUsXG4gICAgaGVhZGVyczogZGF0YS5oZWFkZXJzLFxuICB9KSk7XG59XG5cbi8qKlxuICogQG5hbWUgYWRkVXBkYXRlZE5vdGlmeUhvb2tDYWxsYmFjayhvcHRpb25zKVxuICogQHN1bW1hcnkgY2FsbGJhY2sgaGFuZGxlciBmb3IgYGFkZHVwZGF0ZWROb3RpZnlIb29rYFxuICogQGlzcHJvdG90eXBlIHRydWVcbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5hcmNoIFRoZSBhcmNoaXRlY3R1cmUgdGhhdCBpcyBiZWluZyB1cGRhdGVkLlxuICogVGhpcyBjYW4gYmUgb25lIG9mIGB3ZWIuYnJvd3NlcmAsIGB3ZWIuYnJvd3Nlci5sZWdhY3lgIG9yIGB3ZWIuY29yZG92YWAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5tYW5pZmVzdCBUaGUgbmV3IHVwZGF0ZWQgbWFuaWZlc3Qgb2JqZWN0IGZvclxuICogdGhpcyBgYXJjaGAuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5ydW50aW1lQ29uZmlnIFRoZSBuZXcgdXBkYXRlZCBjb25maWd1cmF0aW9uXG4gKiBvYmplY3QgZm9yIHRoaXMgYGFyY2hgLlxuICovXG5cbi8qKlxuICogQHN1bW1hcnkgSG9vayB0aGF0IHJ1bnMgd2hlbiB0aGUgbWV0ZW9yIHJ1bnRpbWUgY29uZmlndXJhdGlvblxuICogaXMgdXBkYXRlZC4gIFR5cGljYWxseSB0aGUgY29uZmlndXJhdGlvbiBvbmx5IGNoYW5nZXMgZHVyaW5nIGRldmVsb3BtZW50IG1vZGUuXG4gKiBAbG9jdXMgU2VydmVyXG4gKiBAcGFyYW0ge2FkZFVwZGF0ZWROb3RpZnlIb29rQ2FsbGJhY2t9IGhhbmRsZXJcbiAqIFRoZSBgaGFuZGxlcmAgaXMgY2FsbGVkIG9uIGV2ZXJ5IGNoYW5nZSB0byBhbiBgYXJjaGAgcnVudGltZSBjb25maWd1cmF0aW9uLlxuICogU2VlIGBhZGRVcGRhdGVkTm90aWZ5SG9va0NhbGxiYWNrYC5cbiAqIEByZXR1cm5zIHtPYmplY3R9IHt7IHN0b3A6IGZ1bmN0aW9uLCBjYWxsYmFjazogZnVuY3Rpb24gfX1cbiAqL1xuV2ViQXBwLmFkZFVwZGF0ZWROb3RpZnlIb29rID0gZnVuY3Rpb24oaGFuZGxlcikge1xuICByZXR1cm4gcnVudGltZUNvbmZpZy51cGRhdGVIb29rcy5yZWdpc3RlcihoYW5kbGVyKTtcbn07XG5cbldlYkFwcEludGVybmFscy5nZW5lcmF0ZUJvaWxlcnBsYXRlSW5zdGFuY2UgPSBmdW5jdGlvbihcbiAgYXJjaCxcbiAgbWFuaWZlc3QsXG4gIGFkZGl0aW9uYWxPcHRpb25zXG4pIHtcbiAgYWRkaXRpb25hbE9wdGlvbnMgPSBhZGRpdGlvbmFsT3B0aW9ucyB8fCB7fTtcblxuICBydW50aW1lQ29uZmlnLmlzVXBkYXRlZEJ5QXJjaFthcmNoXSA9IHRydWU7XG4gIGNvbnN0IHJ0aW1lQ29uZmlnID0ge1xuICAgIC4uLl9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18sXG4gICAgLi4uKGFkZGl0aW9uYWxPcHRpb25zLnJ1bnRpbWVDb25maWdPdmVycmlkZXMgfHwge30pLFxuICB9O1xuICBydW50aW1lQ29uZmlnLnVwZGF0ZUhvb2tzLmZvckVhY2goY2IgPT4ge1xuICAgIGNiKHsgYXJjaCwgbWFuaWZlc3QsIHJ1bnRpbWVDb25maWc6IHJ0aW1lQ29uZmlnIH0pO1xuICAgIHJldHVybiB0cnVlO1xuICB9KTtcblxuICBjb25zdCBtZXRlb3JSdW50aW1lQ29uZmlnID0gSlNPTi5zdHJpbmdpZnkoXG4gICAgZW5jb2RlVVJJQ29tcG9uZW50KEpTT04uc3RyaW5naWZ5KHJ0aW1lQ29uZmlnKSlcbiAgKTtcblxuICByZXR1cm4gbmV3IEJvaWxlcnBsYXRlKFxuICAgIGFyY2gsXG4gICAgbWFuaWZlc3QsXG4gICAgT2JqZWN0LmFzc2lnbihcbiAgICAgIHtcbiAgICAgICAgcGF0aE1hcHBlcihpdGVtUGF0aCkge1xuICAgICAgICAgIHJldHVybiBwYXRoSm9pbihhcmNoUGF0aFthcmNoXSwgaXRlbVBhdGgpO1xuICAgICAgICB9LFxuICAgICAgICBiYXNlRGF0YUV4dGVuc2lvbjoge1xuICAgICAgICAgIGFkZGl0aW9uYWxTdGF0aWNKczogXy5tYXAoYWRkaXRpb25hbFN0YXRpY0pzIHx8IFtdLCBmdW5jdGlvbihcbiAgICAgICAgICAgIGNvbnRlbnRzLFxuICAgICAgICAgICAgcGF0aG5hbWVcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIHJldHVybiB7XG4gICAgICAgICAgICAgIHBhdGhuYW1lOiBwYXRobmFtZSxcbiAgICAgICAgICAgICAgY29udGVudHM6IGNvbnRlbnRzLFxuICAgICAgICAgICAgfTtcbiAgICAgICAgICB9KSxcbiAgICAgICAgICAvLyBDb252ZXJ0IHRvIGEgSlNPTiBzdHJpbmcsIHRoZW4gZ2V0IHJpZCBvZiBtb3N0IHdlaXJkIGNoYXJhY3RlcnMsIHRoZW5cbiAgICAgICAgICAvLyB3cmFwIGluIGRvdWJsZSBxdW90ZXMuIChUaGUgb3V0ZXJtb3N0IEpTT04uc3RyaW5naWZ5IHJlYWxseSBvdWdodCB0b1xuICAgICAgICAgIC8vIGp1c3QgYmUgXCJ3cmFwIGluIGRvdWJsZSBxdW90ZXNcIiBidXQgd2UgdXNlIGl0IHRvIGJlIHNhZmUuKSBUaGlzIG1pZ2h0XG4gICAgICAgICAgLy8gZW5kIHVwIGluc2lkZSBhIDxzY3JpcHQ+IHRhZyBzbyB3ZSBuZWVkIHRvIGJlIGNhcmVmdWwgdG8gbm90IGluY2x1ZGVcbiAgICAgICAgICAvLyBcIjwvc2NyaXB0PlwiLCBidXQgbm9ybWFsIHt7c3BhY2ViYXJzfX0gZXNjYXBpbmcgZXNjYXBlcyB0b28gbXVjaCEgU2VlXG4gICAgICAgICAgLy8gaHR0cHM6Ly9naXRodWIuY29tL21ldGVvci9tZXRlb3IvaXNzdWVzLzM3MzBcbiAgICAgICAgICBtZXRlb3JSdW50aW1lQ29uZmlnLFxuICAgICAgICAgIG1ldGVvclJ1bnRpbWVIYXNoOiBzaGExKG1ldGVvclJ1bnRpbWVDb25maWcpLFxuICAgICAgICAgIHJvb3RVcmxQYXRoUHJlZml4OlxuICAgICAgICAgICAgX19tZXRlb3JfcnVudGltZV9jb25maWdfXy5ST09UX1VSTF9QQVRIX1BSRUZJWCB8fCAnJyxcbiAgICAgICAgICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vazogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2ssXG4gICAgICAgICAgc3JpTW9kZTogc3JpTW9kZSxcbiAgICAgICAgICBpbmxpbmVTY3JpcHRzQWxsb3dlZDogV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKCksXG4gICAgICAgICAgaW5saW5lOiBhZGRpdGlvbmFsT3B0aW9ucy5pbmxpbmUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgYWRkaXRpb25hbE9wdGlvbnNcbiAgICApXG4gICk7XG59O1xuXG4vLyBBIG1hcHBpbmcgZnJvbSB1cmwgcGF0aCB0byBhcmNoaXRlY3R1cmUgKGUuZy4gXCJ3ZWIuYnJvd3NlclwiKSB0byBzdGF0aWNcbi8vIGZpbGUgaW5mb3JtYXRpb24gd2l0aCB0aGUgZm9sbG93aW5nIGZpZWxkczpcbi8vIC0gdHlwZTogdGhlIHR5cGUgb2YgZmlsZSB0byBiZSBzZXJ2ZWRcbi8vIC0gY2FjaGVhYmxlOiBvcHRpb25hbGx5LCB3aGV0aGVyIHRoZSBmaWxlIHNob3VsZCBiZSBjYWNoZWQgb3Igbm90XG4vLyAtIHNvdXJjZU1hcFVybDogb3B0aW9uYWxseSwgdGhlIHVybCBvZiB0aGUgc291cmNlIG1hcFxuLy9cbi8vIEluZm8gYWxzbyBjb250YWlucyBvbmUgb2YgdGhlIGZvbGxvd2luZzpcbi8vIC0gY29udGVudDogdGhlIHN0cmluZ2lmaWVkIGNvbnRlbnQgdGhhdCBzaG91bGQgYmUgc2VydmVkIGF0IHRoaXMgcGF0aFxuLy8gLSBhYnNvbHV0ZVBhdGg6IHRoZSBhYnNvbHV0ZSBwYXRoIG9uIGRpc2sgdG8gdGhlIGZpbGVcblxuLy8gU2VydmUgc3RhdGljIGZpbGVzIGZyb20gdGhlIG1hbmlmZXN0IG9yIGFkZGVkIHdpdGhcbi8vIGBhZGRTdGF0aWNKc2AuIEV4cG9ydGVkIGZvciB0ZXN0cy5cbldlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc01pZGRsZXdhcmUgPSBhc3luYyBmdW5jdGlvbihcbiAgc3RhdGljRmlsZXNCeUFyY2gsXG4gIHJlcSxcbiAgcmVzLFxuICBuZXh0XG4pIHtcbiAgLy8gY29uc29sZS5sb2coU3RyaW5nKGFyZ3VtZW50cy5jYWxsZWUpKTtcbiAgdmFyIHBhdGhuYW1lID0gcGFyc2VSZXF1ZXN0KHJlcSkucGF0aG5hbWU7XG4gIHRyeSB7XG4gICAgcGF0aG5hbWUgPSBkZWNvZGVVUklDb21wb25lbnQocGF0aG5hbWUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHZhciBzZXJ2ZVN0YXRpY0pzID0gZnVuY3Rpb24ocykge1xuICAgIGlmIChcbiAgICAgIHJlcS5tZXRob2QgPT09ICdHRVQnIHx8XG4gICAgICByZXEubWV0aG9kID09PSAnSEVBRCcgfHxcbiAgICAgIE1ldGVvci5zZXR0aW5ncy5wYWNrYWdlcz8ud2ViYXBwPy5hbHdheXNSZXR1cm5Db250ZW50XG4gICAgKSB7XG4gICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICAnQ29udGVudC10eXBlJzogJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQ7IGNoYXJzZXQ9VVRGLTgnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiBCdWZmZXIuYnl0ZUxlbmd0aChzKSxcbiAgICAgIH0pO1xuICAgICAgcmVzLndyaXRlKHMpO1xuICAgICAgcmVzLmVuZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBzdGF0dXMgPSByZXEubWV0aG9kID09PSAnT1BUSU9OUycgPyAyMDAgOiA0MDU7XG4gICAgICByZXMud3JpdGVIZWFkKHN0YXR1cywge1xuICAgICAgICBBbGxvdzogJ09QVElPTlMsIEdFVCwgSEVBRCcsXG4gICAgICAgICdDb250ZW50LUxlbmd0aCc6ICcwJyxcbiAgICAgIH0pO1xuICAgICAgcmVzLmVuZCgpO1xuICAgIH1cbiAgfTtcblxuICBpZiAoXG4gICAgXy5oYXMoYWRkaXRpb25hbFN0YXRpY0pzLCBwYXRobmFtZSkgJiZcbiAgICAhV2ViQXBwSW50ZXJuYWxzLmlubGluZVNjcmlwdHNBbGxvd2VkKClcbiAgKSB7XG4gICAgc2VydmVTdGF0aWNKcyhhZGRpdGlvbmFsU3RhdGljSnNbcGF0aG5hbWVdKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCB7IGFyY2gsIHBhdGggfSA9IFdlYkFwcC5jYXRlZ29yaXplUmVxdWVzdChyZXEpO1xuXG4gIGlmICghaGFzT3duLmNhbGwoV2ViQXBwLmNsaWVudFByb2dyYW1zLCBhcmNoKSkge1xuICAgIC8vIFdlIGNvdWxkIGNvbWUgaGVyZSBpbiBjYXNlIHdlIHJ1biB3aXRoIHNvbWUgYXJjaGl0ZWN0dXJlcyBleGNsdWRlZFxuICAgIG5leHQoKTtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBJZiBwYXVzZUNsaWVudChhcmNoKSBoYXMgYmVlbiBjYWxsZWQsIHByb2dyYW0ucGF1c2VkIHdpbGwgYmUgYVxuICAvLyBQcm9taXNlIHRoYXQgd2lsbCBiZSByZXNvbHZlZCB3aGVuIHRoZSBwcm9ncmFtIGlzIHVucGF1c2VkLlxuICBjb25zdCBwcm9ncmFtID0gV2ViQXBwLmNsaWVudFByb2dyYW1zW2FyY2hdO1xuICBhd2FpdCBwcm9ncmFtLnBhdXNlZDtcblxuICBpZiAoXG4gICAgcGF0aCA9PT0gJy9tZXRlb3JfcnVudGltZV9jb25maWcuanMnICYmXG4gICAgIVdlYkFwcEludGVybmFscy5pbmxpbmVTY3JpcHRzQWxsb3dlZCgpXG4gICkge1xuICAgIHNlcnZlU3RhdGljSnMoXG4gICAgICBgX19tZXRlb3JfcnVudGltZV9jb25maWdfXyA9ICR7cHJvZ3JhbS5tZXRlb3JSdW50aW1lQ29uZmlnfTtgXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBjb25zdCBpbmZvID0gZ2V0U3RhdGljRmlsZUluZm8oc3RhdGljRmlsZXNCeUFyY2gsIHBhdGhuYW1lLCBwYXRoLCBhcmNoKTtcbiAgaWYgKCFpbmZvKSB7XG4gICAgbmV4dCgpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBcInNlbmRcIiB3aWxsIGhhbmRsZSBIRUFEICYgR0VUIHJlcXVlc3RzXG4gIGlmIChcbiAgICByZXEubWV0aG9kICE9PSAnSEVBRCcgJiZcbiAgICByZXEubWV0aG9kICE9PSAnR0VUJyAmJlxuICAgICFNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICApIHtcbiAgICBjb25zdCBzdGF0dXMgPSByZXEubWV0aG9kID09PSAnT1BUSU9OUycgPyAyMDAgOiA0MDU7XG4gICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgIEFsbG93OiAnT1BUSU9OUywgR0VULCBIRUFEJyxcbiAgICAgICdDb250ZW50LUxlbmd0aCc6ICcwJyxcbiAgICB9KTtcbiAgICByZXMuZW5kKCk7XG4gICAgcmV0dXJuO1xuICB9XG5cbiAgLy8gV2UgZG9uJ3QgbmVlZCB0byBjYWxsIHBhdXNlIGJlY2F1c2UsIHVubGlrZSAnc3RhdGljJywgb25jZSB3ZSBjYWxsIGludG9cbiAgLy8gJ3NlbmQnIGFuZCB5aWVsZCB0byB0aGUgZXZlbnQgbG9vcCwgd2UgbmV2ZXIgY2FsbCBhbm90aGVyIGhhbmRsZXIgd2l0aFxuICAvLyAnbmV4dCcuXG5cbiAgLy8gQ2FjaGVhYmxlIGZpbGVzIGFyZSBmaWxlcyB0aGF0IHNob3VsZCBuZXZlciBjaGFuZ2UuIFR5cGljYWxseVxuICAvLyBuYW1lZCBieSB0aGVpciBoYXNoIChlZyBtZXRlb3IgYnVuZGxlZCBqcyBhbmQgY3NzIGZpbGVzKS5cbiAgLy8gV2UgY2FjaGUgdGhlbSB+Zm9yZXZlciAoMXlyKS5cbiAgY29uc3QgbWF4QWdlID0gaW5mby5jYWNoZWFibGUgPyAxMDAwICogNjAgKiA2MCAqIDI0ICogMzY1IDogMDtcblxuICBpZiAoaW5mby5jYWNoZWFibGUpIHtcbiAgICAvLyBTaW5jZSB3ZSB1c2UgcmVxLmhlYWRlcnNbXCJ1c2VyLWFnZW50XCJdIHRvIGRldGVybWluZSB3aGV0aGVyIHRoZVxuICAgIC8vIGNsaWVudCBzaG91bGQgcmVjZWl2ZSBtb2Rlcm4gb3IgbGVnYWN5IHJlc291cmNlcywgdGVsbCB0aGUgY2xpZW50XG4gICAgLy8gdG8gaW52YWxpZGF0ZSBjYWNoZWQgcmVzb3VyY2VzIHdoZW4vaWYgaXRzIHVzZXIgYWdlbnQgc3RyaW5nXG4gICAgLy8gY2hhbmdlcyBpbiB0aGUgZnV0dXJlLlxuICAgIHJlcy5zZXRIZWFkZXIoJ1ZhcnknLCAnVXNlci1BZ2VudCcpO1xuICB9XG5cbiAgLy8gU2V0IHRoZSBYLVNvdXJjZU1hcCBoZWFkZXIsIHdoaWNoIGN1cnJlbnQgQ2hyb21lLCBGaXJlRm94LCBhbmQgU2FmYXJpXG4gIC8vIHVuZGVyc3RhbmQuICAoVGhlIFNvdXJjZU1hcCBoZWFkZXIgaXMgc2xpZ2h0bHkgbW9yZSBzcGVjLWNvcnJlY3QgYnV0IEZGXG4gIC8vIGRvZXNuJ3QgdW5kZXJzdGFuZCBpdC4pXG4gIC8vXG4gIC8vIFlvdSBtYXkgYWxzbyBuZWVkIHRvIGVuYWJsZSBzb3VyY2UgbWFwcyBpbiBDaHJvbWU6IG9wZW4gZGV2IHRvb2xzLCBjbGlja1xuICAvLyB0aGUgZ2VhciBpbiB0aGUgYm90dG9tIHJpZ2h0IGNvcm5lciwgYW5kIHNlbGVjdCBcImVuYWJsZSBzb3VyY2UgbWFwc1wiLlxuICBpZiAoaW5mby5zb3VyY2VNYXBVcmwpIHtcbiAgICByZXMuc2V0SGVhZGVyKFxuICAgICAgJ1gtU291cmNlTWFwJyxcbiAgICAgIF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVggKyBpbmZvLnNvdXJjZU1hcFVybFxuICAgICk7XG4gIH1cblxuICBpZiAoaW5mby50eXBlID09PSAnanMnIHx8IGluZm8udHlwZSA9PT0gJ2R5bmFtaWMganMnKSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2phdmFzY3JpcHQ7IGNoYXJzZXQ9VVRGLTgnKTtcbiAgfSBlbHNlIGlmIChpbmZvLnR5cGUgPT09ICdjc3MnKSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ3RleHQvY3NzOyBjaGFyc2V0PVVURi04Jyk7XG4gIH0gZWxzZSBpZiAoaW5mby50eXBlID09PSAnanNvbicpIHtcbiAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbjsgY2hhcnNldD1VVEYtOCcpO1xuICB9XG5cbiAgaWYgKGluZm8uaGFzaCkge1xuICAgIHJlcy5zZXRIZWFkZXIoJ0VUYWcnLCAnXCInICsgaW5mby5oYXNoICsgJ1wiJyk7XG4gIH1cblxuICBpZiAoaW5mby5jb250ZW50KSB7XG4gICAgcmVzLnNldEhlYWRlcignQ29udGVudC1MZW5ndGgnLCBCdWZmZXIuYnl0ZUxlbmd0aChpbmZvLmNvbnRlbnQpKTtcbiAgICByZXMud3JpdGUoaW5mby5jb250ZW50KTtcbiAgICByZXMuZW5kKCk7XG4gIH0gZWxzZSB7XG4gICAgc2VuZChyZXEsIGluZm8uYWJzb2x1dGVQYXRoLCB7XG4gICAgICBtYXhhZ2U6IG1heEFnZSxcbiAgICAgIGRvdGZpbGVzOiAnYWxsb3cnLCAvLyBpZiB3ZSBzcGVjaWZpZWQgYSBkb3RmaWxlIGluIHRoZSBtYW5pZmVzdCwgc2VydmUgaXRcbiAgICAgIGxhc3RNb2RpZmllZDogZmFsc2UsIC8vIGRvbid0IHNldCBsYXN0LW1vZGlmaWVkIGJhc2VkIG9uIHRoZSBmaWxlIGRhdGVcbiAgICB9KVxuICAgICAgLm9uKCdlcnJvcicsIGZ1bmN0aW9uKGVycikge1xuICAgICAgICBMb2cuZXJyb3IoJ0Vycm9yIHNlcnZpbmcgc3RhdGljIGZpbGUgJyArIGVycik7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNTAwKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgfSlcbiAgICAgIC5vbignZGlyZWN0b3J5JywgZnVuY3Rpb24oKSB7XG4gICAgICAgIExvZy5lcnJvcignVW5leHBlY3RlZCBkaXJlY3RvcnkgJyArIGluZm8uYWJzb2x1dGVQYXRoKTtcbiAgICAgICAgcmVzLndyaXRlSGVhZCg1MDApO1xuICAgICAgICByZXMuZW5kKCk7XG4gICAgICB9KVxuICAgICAgLnBpcGUocmVzKTtcbiAgfVxufTtcblxuZnVuY3Rpb24gZ2V0U3RhdGljRmlsZUluZm8oc3RhdGljRmlsZXNCeUFyY2gsIG9yaWdpbmFsUGF0aCwgcGF0aCwgYXJjaCkge1xuICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuXG4gIC8vIEdldCBhIGxpc3Qgb2YgYWxsIGF2YWlsYWJsZSBzdGF0aWMgZmlsZSBhcmNoaXRlY3R1cmVzLCB3aXRoIGFyY2hcbiAgLy8gZmlyc3QgaW4gdGhlIGxpc3QgaWYgaXQgZXhpc3RzLlxuICBjb25zdCBzdGF0aWNBcmNoTGlzdCA9IE9iamVjdC5rZXlzKHN0YXRpY0ZpbGVzQnlBcmNoKTtcbiAgY29uc3QgYXJjaEluZGV4ID0gc3RhdGljQXJjaExpc3QuaW5kZXhPZihhcmNoKTtcbiAgaWYgKGFyY2hJbmRleCA+IDApIHtcbiAgICBzdGF0aWNBcmNoTGlzdC51bnNoaWZ0KHN0YXRpY0FyY2hMaXN0LnNwbGljZShhcmNoSW5kZXgsIDEpWzBdKTtcbiAgfVxuXG4gIGxldCBpbmZvID0gbnVsbDtcblxuICBzdGF0aWNBcmNoTGlzdC5zb21lKGFyY2ggPT4ge1xuICAgIGNvbnN0IHN0YXRpY0ZpbGVzID0gc3RhdGljRmlsZXNCeUFyY2hbYXJjaF07XG5cbiAgICBmdW5jdGlvbiBmaW5hbGl6ZShwYXRoKSB7XG4gICAgICBpbmZvID0gc3RhdGljRmlsZXNbcGF0aF07XG4gICAgICAvLyBTb21ldGltZXMgd2UgcmVnaXN0ZXIgYSBsYXp5IGZ1bmN0aW9uIGluc3RlYWQgb2YgYWN0dWFsIGRhdGEgaW5cbiAgICAgIC8vIHRoZSBzdGF0aWNGaWxlcyBtYW5pZmVzdC5cbiAgICAgIGlmICh0eXBlb2YgaW5mbyA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBpbmZvID0gc3RhdGljRmlsZXNbcGF0aF0gPSBpbmZvKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gaW5mbztcbiAgICB9XG5cbiAgICAvLyBJZiBzdGF0aWNGaWxlcyBjb250YWlucyBvcmlnaW5hbFBhdGggd2l0aCB0aGUgYXJjaCBpbmZlcnJlZCBhYm92ZSxcbiAgICAvLyB1c2UgdGhhdCBpbmZvcm1hdGlvbi5cbiAgICBpZiAoaGFzT3duLmNhbGwoc3RhdGljRmlsZXMsIG9yaWdpbmFsUGF0aCkpIHtcbiAgICAgIHJldHVybiBmaW5hbGl6ZShvcmlnaW5hbFBhdGgpO1xuICAgIH1cblxuICAgIC8vIElmIGNhdGVnb3JpemVSZXF1ZXN0IHJldHVybmVkIGFuIGFsdGVybmF0ZSBwYXRoLCB0cnkgdGhhdCBpbnN0ZWFkLlxuICAgIGlmIChwYXRoICE9PSBvcmlnaW5hbFBhdGggJiYgaGFzT3duLmNhbGwoc3RhdGljRmlsZXMsIHBhdGgpKSB7XG4gICAgICByZXR1cm4gZmluYWxpemUocGF0aCk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gaW5mbztcbn1cblxuLy8gUGFyc2UgdGhlIHBhc3NlZCBpbiBwb3J0IHZhbHVlLiBSZXR1cm4gdGhlIHBvcnQgYXMtaXMgaWYgaXQncyBhIFN0cmluZ1xuLy8gKGUuZy4gYSBXaW5kb3dzIFNlcnZlciBzdHlsZSBuYW1lZCBwaXBlKSwgb3RoZXJ3aXNlIHJldHVybiB0aGUgcG9ydCBhcyBhblxuLy8gaW50ZWdlci5cbi8vXG4vLyBERVBSRUNBVEVEOiBEaXJlY3QgdXNlIG9mIHRoaXMgZnVuY3Rpb24gaXMgbm90IHJlY29tbWVuZGVkOyBpdCBpcyBub1xuLy8gbG9uZ2VyIHVzZWQgaW50ZXJuYWxseSwgYW5kIHdpbGwgYmUgcmVtb3ZlZCBpbiBhIGZ1dHVyZSByZWxlYXNlLlxuV2ViQXBwSW50ZXJuYWxzLnBhcnNlUG9ydCA9IHBvcnQgPT4ge1xuICBsZXQgcGFyc2VkUG9ydCA9IHBhcnNlSW50KHBvcnQpO1xuICBpZiAoTnVtYmVyLmlzTmFOKHBhcnNlZFBvcnQpKSB7XG4gICAgcGFyc2VkUG9ydCA9IHBvcnQ7XG4gIH1cbiAgcmV0dXJuIHBhcnNlZFBvcnQ7XG59O1xuXG5pbXBvcnQgeyBvbk1lc3NhZ2UgfSBmcm9tICdtZXRlb3IvaW50ZXItcHJvY2Vzcy1tZXNzYWdpbmcnO1xuXG5vbk1lc3NhZ2UoJ3dlYmFwcC1wYXVzZS1jbGllbnQnLCBhc3luYyAoeyBhcmNoIH0pID0+IHtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLnBhdXNlQ2xpZW50KGFyY2gpO1xufSk7XG5cbm9uTWVzc2FnZSgnd2ViYXBwLXJlbG9hZC1jbGllbnQnLCBhc3luYyAoeyBhcmNoIH0pID0+IHtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQ2xpZW50UHJvZ3JhbShhcmNoKTtcbn0pO1xuXG5hc3luYyBmdW5jdGlvbiBydW5XZWJBcHBTZXJ2ZXIoKSB7XG4gIHZhciBzaHV0dGluZ0Rvd24gPSBmYWxzZTtcbiAgdmFyIHN5bmNRdWV1ZSA9IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbiAgdmFyIGdldEl0ZW1QYXRobmFtZSA9IGZ1bmN0aW9uKGl0ZW1VcmwpIHtcbiAgICByZXR1cm4gZGVjb2RlVVJJQ29tcG9uZW50KHBhcnNlVXJsKGl0ZW1VcmwpLnBhdGhuYW1lKTtcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMucmVsb2FkQ2xpZW50UHJvZ3JhbXMgPSBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzayhmdW5jdGlvbigpIHtcbiAgICAgIGNvbnN0IHN0YXRpY0ZpbGVzQnlBcmNoID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgICAgY29uc3QgeyBjb25maWdKc29uIH0gPSBfX21ldGVvcl9ib290c3RyYXBfXztcbiAgICAgIGNvbnN0IGNsaWVudEFyY2hzID1cbiAgICAgICAgY29uZmlnSnNvbi5jbGllbnRBcmNocyB8fCBPYmplY3Qua2V5cyhjb25maWdKc29uLmNsaWVudFBhdGhzKTtcblxuICAgICAgdHJ5IHtcbiAgICAgICAgY2xpZW50QXJjaHMuZm9yRWFjaChhcmNoID0+IHtcbiAgICAgICAgICBnZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCwgc3RhdGljRmlsZXNCeUFyY2gpO1xuICAgICAgICB9KTtcbiAgICAgICAgV2ViQXBwSW50ZXJuYWxzLnN0YXRpY0ZpbGVzQnlBcmNoID0gc3RhdGljRmlsZXNCeUFyY2g7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIExvZy5lcnJvcignRXJyb3IgcmVsb2FkaW5nIHRoZSBjbGllbnQgcHJvZ3JhbTogJyArIGUuc3RhY2spO1xuICAgICAgICBwcm9jZXNzLmV4aXQoMSk7XG4gICAgICB9XG4gICAgfSk7XG4gIH07XG5cbiAgLy8gUGF1c2UgYW55IGluY29taW5nIHJlcXVlc3RzIGFuZCBtYWtlIHRoZW0gd2FpdCBmb3IgdGhlIHByb2dyYW0gdG8gYmVcbiAgLy8gdW5wYXVzZWQgdGhlIG5leHQgdGltZSBnZW5lcmF0ZUNsaWVudFByb2dyYW0oYXJjaCkgaXMgY2FsbGVkLlxuICBXZWJBcHBJbnRlcm5hbHMucGF1c2VDbGllbnQgPSBhc3luYyBmdW5jdGlvbihhcmNoKSB7XG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soKCkgPT4ge1xuICAgICAgY29uc3QgcHJvZ3JhbSA9IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXTtcbiAgICAgIGNvbnN0IHsgdW5wYXVzZSB9ID0gcHJvZ3JhbTtcbiAgICAgIHByb2dyYW0ucGF1c2VkID0gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG4gICAgICAgIGlmICh0eXBlb2YgdW5wYXVzZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIC8vIElmIHRoZXJlIGhhcHBlbnMgdG8gYmUgYW4gZXhpc3RpbmcgcHJvZ3JhbS51bnBhdXNlIGZ1bmN0aW9uLFxuICAgICAgICAgIC8vIGNvbXBvc2UgaXQgd2l0aCB0aGUgcmVzb2x2ZSBmdW5jdGlvbi5cbiAgICAgICAgICBwcm9ncmFtLnVucGF1c2UgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgIHVucGF1c2UoKTtcbiAgICAgICAgICAgIHJlc29sdmUoKTtcbiAgICAgICAgICB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHByb2dyYW0udW5wYXVzZSA9IHJlc29sdmU7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9O1xuXG4gIFdlYkFwcEludGVybmFscy5nZW5lcmF0ZUNsaWVudFByb2dyYW0gPSBhc3luYyBmdW5jdGlvbihhcmNoKSB7XG4gICAgYXdhaXQgc3luY1F1ZXVlLnJ1blRhc2soKCkgPT4gZ2VuZXJhdGVDbGllbnRQcm9ncmFtKGFyY2gpKTtcbiAgfTtcblxuICBmdW5jdGlvbiBnZW5lcmF0ZUNsaWVudFByb2dyYW0oXG4gICAgYXJjaCxcbiAgICBzdGF0aWNGaWxlc0J5QXJjaCA9IFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc0J5QXJjaFxuICApIHtcbiAgICBjb25zdCBjbGllbnREaXIgPSBwYXRoSm9pbihcbiAgICAgIHBhdGhEaXJuYW1lKF9fbWV0ZW9yX2Jvb3RzdHJhcF9fLnNlcnZlckRpciksXG4gICAgICBhcmNoXG4gICAgKTtcblxuICAgIC8vIHJlYWQgdGhlIGNvbnRyb2wgZm9yIHRoZSBjbGllbnQgd2UnbGwgYmUgc2VydmluZyB1cFxuICAgIGNvbnN0IHByb2dyYW1Kc29uUGF0aCA9IHBhdGhKb2luKGNsaWVudERpciwgJ3Byb2dyYW0uanNvbicpO1xuXG4gICAgbGV0IHByb2dyYW1Kc29uO1xuICAgIHRyeSB7XG4gICAgICBwcm9ncmFtSnNvbiA9IEpTT04ucGFyc2UocmVhZEZpbGVTeW5jKHByb2dyYW1Kc29uUGF0aCkpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLmNvZGUgPT09ICdFTk9FTlQnKSByZXR1cm47XG4gICAgICB0aHJvdyBlO1xuICAgIH1cblxuICAgIGlmIChwcm9ncmFtSnNvbi5mb3JtYXQgIT09ICd3ZWItcHJvZ3JhbS1wcmUxJykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnVW5zdXBwb3J0ZWQgZm9ybWF0IGZvciBjbGllbnQgYXNzZXRzOiAnICtcbiAgICAgICAgICBKU09OLnN0cmluZ2lmeShwcm9ncmFtSnNvbi5mb3JtYXQpXG4gICAgICApO1xuICAgIH1cblxuICAgIGlmICghcHJvZ3JhbUpzb25QYXRoIHx8ICFjbGllbnREaXIgfHwgIXByb2dyYW1Kc29uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NsaWVudCBjb25maWcgZmlsZSBub3QgcGFyc2VkLicpO1xuICAgIH1cblxuICAgIGFyY2hQYXRoW2FyY2hdID0gY2xpZW50RGlyO1xuICAgIGNvbnN0IHN0YXRpY0ZpbGVzID0gKHN0YXRpY0ZpbGVzQnlBcmNoW2FyY2hdID0gT2JqZWN0LmNyZWF0ZShudWxsKSk7XG5cbiAgICBjb25zdCB7IG1hbmlmZXN0IH0gPSBwcm9ncmFtSnNvbjtcbiAgICBtYW5pZmVzdC5mb3JFYWNoKGl0ZW0gPT4ge1xuICAgICAgaWYgKGl0ZW0udXJsICYmIGl0ZW0ud2hlcmUgPT09ICdjbGllbnQnKSB7XG4gICAgICAgIHN0YXRpY0ZpbGVzW2dldEl0ZW1QYXRobmFtZShpdGVtLnVybCldID0ge1xuICAgICAgICAgIGFic29sdXRlUGF0aDogcGF0aEpvaW4oY2xpZW50RGlyLCBpdGVtLnBhdGgpLFxuICAgICAgICAgIGNhY2hlYWJsZTogaXRlbS5jYWNoZWFibGUsXG4gICAgICAgICAgaGFzaDogaXRlbS5oYXNoLFxuICAgICAgICAgIC8vIExpbmsgZnJvbSBzb3VyY2UgdG8gaXRzIG1hcFxuICAgICAgICAgIHNvdXJjZU1hcFVybDogaXRlbS5zb3VyY2VNYXBVcmwsXG4gICAgICAgICAgdHlwZTogaXRlbS50eXBlLFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmIChpdGVtLnNvdXJjZU1hcCkge1xuICAgICAgICAgIC8vIFNlcnZlIHRoZSBzb3VyY2UgbWFwIHRvbywgdW5kZXIgdGhlIHNwZWNpZmllZCBVUkwuIFdlIGFzc3VtZVxuICAgICAgICAgIC8vIGFsbCBzb3VyY2UgbWFwcyBhcmUgY2FjaGVhYmxlLlxuICAgICAgICAgIHN0YXRpY0ZpbGVzW2dldEl0ZW1QYXRobmFtZShpdGVtLnNvdXJjZU1hcFVybCldID0ge1xuICAgICAgICAgICAgYWJzb2x1dGVQYXRoOiBwYXRoSm9pbihjbGllbnREaXIsIGl0ZW0uc291cmNlTWFwKSxcbiAgICAgICAgICAgIGNhY2hlYWJsZTogdHJ1ZSxcbiAgICAgICAgICB9O1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICBjb25zdCB7IFBVQkxJQ19TRVRUSU5HUyB9ID0gX19tZXRlb3JfcnVudGltZV9jb25maWdfXztcbiAgICBjb25zdCBjb25maWdPdmVycmlkZXMgPSB7XG4gICAgICBQVUJMSUNfU0VUVElOR1MsXG4gICAgfTtcblxuICAgIGNvbnN0IG9sZFByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgY29uc3QgbmV3UHJvZ3JhbSA9IChXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF0gPSB7XG4gICAgICBmb3JtYXQ6ICd3ZWItcHJvZ3JhbS1wcmUxJyxcbiAgICAgIG1hbmlmZXN0OiBtYW5pZmVzdCxcbiAgICAgIC8vIFVzZSBhcnJvdyBmdW5jdGlvbnMgc28gdGhhdCB0aGVzZSB2ZXJzaW9ucyBjYW4gYmUgbGF6aWx5XG4gICAgICAvLyBjYWxjdWxhdGVkIGxhdGVyLCBhbmQgc28gdGhhdCB0aGV5IHdpbGwgbm90IGJlIGluY2x1ZGVkIGluIHRoZVxuICAgICAgLy8gc3RhdGljRmlsZXNbbWFuaWZlc3RVcmxdLmNvbnRlbnQgc3RyaW5nIGJlbG93LlxuICAgICAgLy9cbiAgICAgIC8vIE5vdGU6IHRoZXNlIHZlcnNpb24gY2FsY3VsYXRpb25zIG11c3QgYmUga2VwdCBpbiBhZ3JlZW1lbnQgd2l0aFxuICAgICAgLy8gQ29yZG92YUJ1aWxkZXIjYXBwZW5kVmVyc2lvbiBpbiB0b29scy9jb3Jkb3ZhL2J1aWxkZXIuanMsIG9yIGhvdFxuICAgICAgLy8gY29kZSBwdXNoIHdpbGwgcmVsb2FkIENvcmRvdmEgYXBwcyB1bm5lY2Vzc2FyaWx5LlxuICAgICAgdmVyc2lvbjogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKG1hbmlmZXN0LCBudWxsLCBjb25maWdPdmVycmlkZXMpLFxuICAgICAgdmVyc2lvblJlZnJlc2hhYmxlOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2goXG4gICAgICAgICAgbWFuaWZlc3QsXG4gICAgICAgICAgdHlwZSA9PiB0eXBlID09PSAnY3NzJyxcbiAgICAgICAgICBjb25maWdPdmVycmlkZXNcbiAgICAgICAgKSxcbiAgICAgIHZlcnNpb25Ob25SZWZyZXNoYWJsZTogKCkgPT5cbiAgICAgICAgV2ViQXBwSGFzaGluZy5jYWxjdWxhdGVDbGllbnRIYXNoKFxuICAgICAgICAgIG1hbmlmZXN0LFxuICAgICAgICAgICh0eXBlLCByZXBsYWNlYWJsZSkgPT4gdHlwZSAhPT0gJ2NzcycgJiYgIXJlcGxhY2VhYmxlLFxuICAgICAgICAgIGNvbmZpZ092ZXJyaWRlc1xuICAgICAgICApLFxuICAgICAgdmVyc2lvblJlcGxhY2VhYmxlOiAoKSA9PlxuICAgICAgICBXZWJBcHBIYXNoaW5nLmNhbGN1bGF0ZUNsaWVudEhhc2goXG4gICAgICAgICAgbWFuaWZlc3QsXG4gICAgICAgICAgKF90eXBlLCByZXBsYWNlYWJsZSkgPT4gcmVwbGFjZWFibGUsXG4gICAgICAgICAgY29uZmlnT3ZlcnJpZGVzXG4gICAgICAgICksXG4gICAgICBjb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zOiBwcm9ncmFtSnNvbi5jb3Jkb3ZhQ29tcGF0aWJpbGl0eVZlcnNpb25zLFxuICAgICAgUFVCTElDX1NFVFRJTkdTLFxuICAgICAgaG1yVmVyc2lvbjogcHJvZ3JhbUpzb24uaG1yVmVyc2lvbixcbiAgICB9KTtcblxuICAgIC8vIEV4cG9zZSBwcm9ncmFtIGRldGFpbHMgYXMgYSBzdHJpbmcgcmVhY2hhYmxlIHZpYSB0aGUgZm9sbG93aW5nIFVSTC5cbiAgICBjb25zdCBtYW5pZmVzdFVybFByZWZpeCA9ICcvX18nICsgYXJjaC5yZXBsYWNlKC9ed2ViXFwuLywgJycpO1xuICAgIGNvbnN0IG1hbmlmZXN0VXJsID0gbWFuaWZlc3RVcmxQcmVmaXggKyBnZXRJdGVtUGF0aG5hbWUoJy9tYW5pZmVzdC5qc29uJyk7XG5cbiAgICBzdGF0aWNGaWxlc1ttYW5pZmVzdFVybF0gPSAoKSA9PiB7XG4gICAgICBpZiAoUGFja2FnZS5hdXRvdXBkYXRlKSB7XG4gICAgICAgIGNvbnN0IHtcbiAgICAgICAgICBBVVRPVVBEQVRFX1ZFUlNJT04gPSBQYWNrYWdlLmF1dG91cGRhdGUuQXV0b3VwZGF0ZS5hdXRvdXBkYXRlVmVyc2lvbixcbiAgICAgICAgfSA9IHByb2Nlc3MuZW52O1xuXG4gICAgICAgIGlmIChBVVRPVVBEQVRFX1ZFUlNJT04pIHtcbiAgICAgICAgICBuZXdQcm9ncmFtLnZlcnNpb24gPSBBVVRPVVBEQVRFX1ZFUlNJT047XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKHR5cGVvZiBuZXdQcm9ncmFtLnZlcnNpb24gPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgbmV3UHJvZ3JhbS52ZXJzaW9uID0gbmV3UHJvZ3JhbS52ZXJzaW9uKCk7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIGNvbnRlbnQ6IEpTT04uc3RyaW5naWZ5KG5ld1Byb2dyYW0pLFxuICAgICAgICBjYWNoZWFibGU6IGZhbHNlLFxuICAgICAgICBoYXNoOiBuZXdQcm9ncmFtLnZlcnNpb24sXG4gICAgICAgIHR5cGU6ICdqc29uJyxcbiAgICAgIH07XG4gICAgfTtcblxuICAgIGdlbmVyYXRlQm9pbGVycGxhdGVGb3JBcmNoKGFyY2gpO1xuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGFueSByZXF1ZXN0cyB3YWl0aW5nIG9uIG9sZFByb2dyYW0ucGF1c2VkLCBsZXQgdGhlbVxuICAgIC8vIGNvbnRpbnVlIG5vdyAodXNpbmcgdGhlIG5ldyBwcm9ncmFtKS5cbiAgICBpZiAob2xkUHJvZ3JhbSAmJiBvbGRQcm9ncmFtLnBhdXNlZCkge1xuICAgICAgb2xkUHJvZ3JhbS51bnBhdXNlKCk7XG4gICAgfVxuICB9XG5cbiAgY29uc3QgZGVmYXVsdE9wdGlvbnNGb3JBcmNoID0ge1xuICAgICd3ZWIuY29yZG92YSc6IHtcbiAgICAgIHJ1bnRpbWVDb25maWdPdmVycmlkZXM6IHtcbiAgICAgICAgLy8gWFhYIFdlIHVzZSBhYnNvbHV0ZVVybCgpIGhlcmUgc28gdGhhdCB3ZSBzZXJ2ZSBodHRwczovL1xuICAgICAgICAvLyBVUkxzIHRvIGNvcmRvdmEgY2xpZW50cyBpZiBmb3JjZS1zc2wgaXMgaW4gdXNlLiBJZiB3ZSB3ZXJlXG4gICAgICAgIC8vIHRvIHVzZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLlJPT1RfVVJMIGluc3RlYWQgb2ZcbiAgICAgICAgLy8gYWJzb2x1dGVVcmwoKSwgdGhlbiBDb3Jkb3ZhIGNsaWVudHMgd291bGQgaW1tZWRpYXRlbHkgZ2V0IGFcbiAgICAgICAgLy8gSENQIHNldHRpbmcgdGhlaXIgRERQX0RFRkFVTFRfQ09OTkVDVElPTl9VUkwgdG9cbiAgICAgICAgLy8gaHR0cDovL2V4YW1wbGUubWV0ZW9yLmNvbS4gVGhpcyBicmVha3MgdGhlIGFwcCwgYmVjYXVzZVxuICAgICAgICAvLyBmb3JjZS1zc2wgZG9lc24ndCBzZXJ2ZSBDT1JTIGhlYWRlcnMgb24gMzAyXG4gICAgICAgIC8vIHJlZGlyZWN0cy4gKFBsdXMgaXQncyB1bmRlc2lyYWJsZSB0byBoYXZlIGNsaWVudHNcbiAgICAgICAgLy8gY29ubmVjdGluZyB0byBodHRwOi8vZXhhbXBsZS5tZXRlb3IuY29tIHdoZW4gZm9yY2Utc3NsIGlzXG4gICAgICAgIC8vIGluIHVzZS4pXG4gICAgICAgIEREUF9ERUZBVUxUX0NPTk5FQ1RJT05fVVJMOlxuICAgICAgICAgIHByb2Nlc3MuZW52Lk1PQklMRV9ERFBfVVJMIHx8IE1ldGVvci5hYnNvbHV0ZVVybCgpLFxuICAgICAgICBST09UX1VSTDogcHJvY2Vzcy5lbnYuTU9CSUxFX1JPT1RfVVJMIHx8IE1ldGVvci5hYnNvbHV0ZVVybCgpLFxuICAgICAgfSxcbiAgICB9LFxuXG4gICAgJ3dlYi5icm93c2VyJzoge1xuICAgICAgcnVudGltZUNvbmZpZ092ZXJyaWRlczoge1xuICAgICAgICBpc01vZGVybjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSxcblxuICAgICd3ZWIuYnJvd3Nlci5sZWdhY3knOiB7XG4gICAgICBydW50aW1lQ29uZmlnT3ZlcnJpZGVzOiB7XG4gICAgICAgIGlzTW9kZXJuOiBmYWxzZSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfTtcblxuICBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZSA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIC8vIFRoaXMgYm9pbGVycGxhdGUgd2lsbCBiZSBzZXJ2ZWQgdG8gdGhlIG1vYmlsZSBkZXZpY2VzIHdoZW4gdXNlZCB3aXRoXG4gICAgLy8gTWV0ZW9yL0NvcmRvdmEgZm9yIHRoZSBIb3QtQ29kZSBQdXNoIGFuZCBzaW5jZSB0aGUgZmlsZSB3aWxsIGJlIHNlcnZlZCBieVxuICAgIC8vIHRoZSBkZXZpY2UncyBzZXJ2ZXIsIGl0IGlzIGltcG9ydGFudCB0byBzZXQgdGhlIEREUCB1cmwgdG8gdGhlIGFjdHVhbFxuICAgIC8vIE1ldGVvciBzZXJ2ZXIgYWNjZXB0aW5nIEREUCBjb25uZWN0aW9ucyBhbmQgbm90IHRoZSBkZXZpY2UncyBmaWxlIHNlcnZlci5cbiAgICBhd2FpdCBzeW5jUXVldWUucnVuVGFzayhmdW5jdGlvbigpIHtcbiAgICAgIE9iamVjdC5rZXlzKFdlYkFwcC5jbGllbnRQcm9ncmFtcykuZm9yRWFjaChnZW5lcmF0ZUJvaWxlcnBsYXRlRm9yQXJjaCk7XG4gICAgfSk7XG4gIH07XG5cbiAgZnVuY3Rpb24gZ2VuZXJhdGVCb2lsZXJwbGF0ZUZvckFyY2goYXJjaCkge1xuICAgIGNvbnN0IHByb2dyYW0gPSBXZWJBcHAuY2xpZW50UHJvZ3JhbXNbYXJjaF07XG4gICAgY29uc3QgYWRkaXRpb25hbE9wdGlvbnMgPSBkZWZhdWx0T3B0aW9uc0ZvckFyY2hbYXJjaF0gfHwge307XG4gICAgY29uc3QgeyBiYXNlRGF0YSB9ID0gKGJvaWxlcnBsYXRlQnlBcmNoW1xuICAgICAgYXJjaFxuICAgIF0gPSBXZWJBcHBJbnRlcm5hbHMuZ2VuZXJhdGVCb2lsZXJwbGF0ZUluc3RhbmNlKFxuICAgICAgYXJjaCxcbiAgICAgIHByb2dyYW0ubWFuaWZlc3QsXG4gICAgICBhZGRpdGlvbmFsT3B0aW9uc1xuICAgICkpO1xuICAgIC8vIFdlIG5lZWQgdGhlIHJ1bnRpbWUgY29uZmlnIHdpdGggb3ZlcnJpZGVzIGZvciBtZXRlb3JfcnVudGltZV9jb25maWcuanM6XG4gICAgcHJvZ3JhbS5tZXRlb3JSdW50aW1lQ29uZmlnID0gSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgLi4uX19tZXRlb3JfcnVudGltZV9jb25maWdfXyxcbiAgICAgIC4uLihhZGRpdGlvbmFsT3B0aW9ucy5ydW50aW1lQ29uZmlnT3ZlcnJpZGVzIHx8IG51bGwpLFxuICAgIH0pO1xuICAgIHByb2dyYW0ucmVmcmVzaGFibGVBc3NldHMgPSBiYXNlRGF0YS5jc3MubWFwKGZpbGUgPT4gKHtcbiAgICAgIHVybDogYnVuZGxlZEpzQ3NzVXJsUmV3cml0ZUhvb2soZmlsZS51cmwpLFxuICAgIH0pKTtcbiAgfVxuXG4gIGF3YWl0IFdlYkFwcEludGVybmFscy5yZWxvYWRDbGllbnRQcm9ncmFtcygpO1xuXG4gIC8vIHdlYnNlcnZlclxuICB2YXIgYXBwID0gY3JlYXRlRXhwcmVzc0FwcCgpXG5cbiAgLy8gUGFja2FnZXMgYW5kIGFwcHMgY2FuIGFkZCBoYW5kbGVycyB0aGF0IHJ1biBiZWZvcmUgYW55IG90aGVyIE1ldGVvclxuICAvLyBoYW5kbGVycyB2aWEgV2ViQXBwLnJhd0V4cHJlc3NIYW5kbGVycy5cbiAgdmFyIHJhd0V4cHJlc3NIYW5kbGVycyA9IGNyZWF0ZUV4cHJlc3NBcHAoKVxuICBhcHAudXNlKHJhd0V4cHJlc3NIYW5kbGVycyk7XG5cbiAgLy8gQXV0by1jb21wcmVzcyBhbnkganNvbiwgamF2YXNjcmlwdCwgb3IgdGV4dC5cbiAgYXBwLnVzZShjb21wcmVzcyh7IGZpbHRlcjogc2hvdWxkQ29tcHJlc3MgfSkpO1xuXG4gIC8vIHBhcnNlIGNvb2tpZXMgaW50byBhbiBvYmplY3RcbiAgYXBwLnVzZShjb29raWVQYXJzZXIoKSk7XG5cbiAgLy8gV2UncmUgbm90IGEgcHJveHk7IHJlamVjdCAod2l0aG91dCBjcmFzaGluZykgYXR0ZW1wdHMgdG8gdHJlYXQgdXMgbGlrZVxuICAvLyBvbmUuIChTZWUgIzEyMTIuKVxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKFJvdXRlUG9saWN5LmlzVmFsaWRVcmwocmVxLnVybCkpIHtcbiAgICAgIG5leHQoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZCg0MDApO1xuICAgIHJlcy53cml0ZSgnTm90IGEgcHJveHknKTtcbiAgICByZXMuZW5kKCk7XG4gIH0pO1xuXG4gIC8vIFBhcnNlIHRoZSBxdWVyeSBzdHJpbmcgaW50byByZXMucXVlcnkuIFVzZWQgYnkgb2F1dGhfc2VydmVyLCBidXQgaXQnc1xuICAvLyBnZW5lcmFsbHkgcHJldHR5IGhhbmR5Li5cbiAgLy9cbiAgLy8gRG8gdGhpcyBiZWZvcmUgdGhlIG5leHQgbWlkZGxld2FyZSBkZXN0cm95cyByZXEudXJsIGlmIGEgcGF0aCBwcmVmaXhcbiAgLy8gaXMgc2V0IHRvIGNsb3NlICMxMDExMS5cbiAgYXBwLnVzZShmdW5jdGlvbihyZXF1ZXN0LCByZXNwb25zZSwgbmV4dCkge1xuICAgIHJlcXVlc3QucXVlcnkgPSBxcy5wYXJzZShwYXJzZVVybChyZXF1ZXN0LnVybCkucXVlcnkpO1xuICAgIG5leHQoKTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gZ2V0UGF0aFBhcnRzKHBhdGgpIHtcbiAgICBjb25zdCBwYXJ0cyA9IHBhdGguc3BsaXQoJy8nKTtcbiAgICB3aGlsZSAocGFydHNbMF0gPT09ICcnKSBwYXJ0cy5zaGlmdCgpO1xuICAgIHJldHVybiBwYXJ0cztcbiAgfVxuXG4gIGZ1bmN0aW9uIGlzUHJlZml4T2YocHJlZml4LCBhcnJheSkge1xuICAgIHJldHVybiAoXG4gICAgICBwcmVmaXgubGVuZ3RoIDw9IGFycmF5Lmxlbmd0aCAmJlxuICAgICAgcHJlZml4LmV2ZXJ5KChwYXJ0LCBpKSA9PiBwYXJ0ID09PSBhcnJheVtpXSlcbiAgICApO1xuICB9XG5cbiAgLy8gU3RyaXAgb2ZmIHRoZSBwYXRoIHByZWZpeCwgaWYgaXQgZXhpc3RzLlxuICBhcHAudXNlKGZ1bmN0aW9uKHJlcXVlc3QsIHJlc3BvbnNlLCBuZXh0KSB7XG4gICAgY29uc3QgcGF0aFByZWZpeCA9IF9fbWV0ZW9yX3J1bnRpbWVfY29uZmlnX18uUk9PVF9VUkxfUEFUSF9QUkVGSVg7XG4gICAgY29uc3QgeyBwYXRobmFtZSwgc2VhcmNoIH0gPSBwYXJzZVVybChyZXF1ZXN0LnVybCk7XG5cbiAgICAvLyBjaGVjayBpZiB0aGUgcGF0aCBpbiB0aGUgdXJsIHN0YXJ0cyB3aXRoIHRoZSBwYXRoIHByZWZpeFxuICAgIGlmIChwYXRoUHJlZml4KSB7XG4gICAgICBjb25zdCBwcmVmaXhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRoUHJlZml4KTtcbiAgICAgIGNvbnN0IHBhdGhQYXJ0cyA9IGdldFBhdGhQYXJ0cyhwYXRobmFtZSk7XG4gICAgICBpZiAoaXNQcmVmaXhPZihwcmVmaXhQYXJ0cywgcGF0aFBhcnRzKSkge1xuICAgICAgICByZXF1ZXN0LnVybCA9ICcvJyArIHBhdGhQYXJ0cy5zbGljZShwcmVmaXhQYXJ0cy5sZW5ndGgpLmpvaW4oJy8nKTtcbiAgICAgICAgaWYgKHNlYXJjaCkge1xuICAgICAgICAgIHJlcXVlc3QudXJsICs9IHNlYXJjaDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV4dCgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChwYXRobmFtZSA9PT0gJy9mYXZpY29uLmljbycgfHwgcGF0aG5hbWUgPT09ICcvcm9ib3RzLnR4dCcpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfVxuXG4gICAgaWYgKHBhdGhQcmVmaXgpIHtcbiAgICAgIHJlc3BvbnNlLndyaXRlSGVhZCg0MDQpO1xuICAgICAgcmVzcG9uc2Uud3JpdGUoJ1Vua25vd24gcGF0aCcpO1xuICAgICAgcmVzcG9uc2UuZW5kKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgbmV4dCgpO1xuICB9KTtcblxuICAvLyBTZXJ2ZSBzdGF0aWMgZmlsZXMgZnJvbSB0aGUgbWFuaWZlc3QuXG4gIC8vIFRoaXMgaXMgaW5zcGlyZWQgYnkgdGhlICdzdGF0aWMnIG1pZGRsZXdhcmUuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMsIG5leHQpIHtcbiAgICAvLyBjb25zb2xlLmxvZyhTdHJpbmcoYXJndW1lbnRzLmNhbGxlZSkpO1xuICAgIFdlYkFwcEludGVybmFscy5zdGF0aWNGaWxlc01pZGRsZXdhcmUoXG4gICAgICBXZWJBcHBJbnRlcm5hbHMuc3RhdGljRmlsZXNCeUFyY2gsXG4gICAgICByZXEsXG4gICAgICByZXMsXG4gICAgICBuZXh0XG4gICAgKTtcbiAgfSk7XG5cbiAgLy8gQ29yZSBNZXRlb3IgcGFja2FnZXMgbGlrZSBkeW5hbWljLWltcG9ydCBjYW4gYWRkIGhhbmRsZXJzIGJlZm9yZVxuICAvLyBvdGhlciBoYW5kbGVycyBhZGRlZCBieSBwYWNrYWdlIGFuZCBhcHBsaWNhdGlvbiBjb2RlLlxuICBhcHAudXNlKChXZWJBcHBJbnRlcm5hbHMubWV0ZW9ySW50ZXJuYWxIYW5kbGVycyA9IGNyZWF0ZUV4cHJlc3NBcHAoKSkpO1xuXG4gIC8qKlxuICAgKiBAbmFtZSBleHByZXNzSGFuZGxlcnNDYWxsYmFjayhyZXEsIHJlcywgbmV4dClcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAaXNwcm90b3R5cGUgdHJ1ZVxuICAgKiBAc3VtbWFyeSBjYWxsYmFjayBoYW5kbGVyIGZvciBgV2ViQXBwLmV4cHJlc3NIYW5kbGVyc2BcbiAgICogQHBhcmFtIHtPYmplY3R9IHJlcVxuICAgKiBhIE5vZGUuanNcbiAgICogW0luY29taW5nTWVzc2FnZV0oaHR0cHM6Ly9ub2RlanMub3JnL2FwaS9odHRwLmh0bWwjaHR0cF9jbGFzc19odHRwX2luY29taW5nbWVzc2FnZSlcbiAgICogb2JqZWN0IHdpdGggc29tZSBleHRyYSBwcm9wZXJ0aWVzLiBUaGlzIGFyZ3VtZW50IGNhbiBiZSB1c2VkXG4gICAqICB0byBnZXQgaW5mb3JtYXRpb24gYWJvdXQgdGhlIGluY29taW5nIHJlcXVlc3QuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXNcbiAgICogYSBOb2RlLmpzXG4gICAqIFtTZXJ2ZXJSZXNwb25zZV0oaHR0cDovL25vZGVqcy5vcmcvYXBpL2h0dHAuaHRtbCNodHRwX2NsYXNzX2h0dHBfc2VydmVycmVzcG9uc2UpXG4gICAqIG9iamVjdC4gVXNlIHRoaXMgdG8gd3JpdGUgZGF0YSB0aGF0IHNob3VsZCBiZSBzZW50IGluIHJlc3BvbnNlIHRvIHRoZVxuICAgKiByZXF1ZXN0LCBhbmQgY2FsbCBgcmVzLmVuZCgpYCB3aGVuIHlvdSBhcmUgZG9uZS5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gbmV4dFxuICAgKiBDYWxsaW5nIHRoaXMgZnVuY3Rpb24gd2lsbCBwYXNzIG9uIHRoZSBoYW5kbGluZyBvZlxuICAgKiB0aGlzIHJlcXVlc3QgdG8gdGhlIG5leHQgcmVsZXZhbnQgaGFuZGxlci5cbiAgICpcbiAgICovXG5cbiAgLyoqXG4gICAqIEBtZXRob2QgZXhwcmVzc0hhbmRsZXJzXG4gICAqIEBtZW1iZXJvZiBXZWJBcHBcbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAc3VtbWFyeSBSZWdpc3RlciBhIGhhbmRsZXIgZm9yIGFsbCBIVFRQIHJlcXVlc3RzLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gW3BhdGhdXG4gICAqIFRoaXMgaGFuZGxlciB3aWxsIG9ubHkgYmUgY2FsbGVkIG9uIHBhdGhzIHRoYXQgbWF0Y2hcbiAgICogdGhpcyBzdHJpbmcuIFRoZSBtYXRjaCBoYXMgdG8gYm9yZGVyIG9uIGEgYC9gIG9yIGEgYC5gLlxuICAgKlxuICAgKiBGb3IgZXhhbXBsZSwgYC9oZWxsb2Agd2lsbCBtYXRjaCBgL2hlbGxvL3dvcmxkYCBhbmRcbiAgICogYC9oZWxsby53b3JsZGAsIGJ1dCBub3QgYC9oZWxsb193b3JsZGAuXG4gICAqIEBwYXJhbSB7ZXhwcmVzc0hhbmRsZXJzQ2FsbGJhY2t9IGhhbmRsZXJcbiAgICogQSBoYW5kbGVyIGZ1bmN0aW9uIHRoYXQgd2lsbCBiZSBjYWxsZWQgb24gSFRUUCByZXF1ZXN0cy5cbiAgICogU2VlIGBleHByZXNzSGFuZGxlcnNDYWxsYmFja2BcbiAgICpcbiAgICovXG4gIC8vIFBhY2thZ2VzIGFuZCBhcHBzIGNhbiBhZGQgaGFuZGxlcnMgdG8gdGhpcyB2aWEgV2ViQXBwLmV4cHJlc3NIYW5kbGVycy5cbiAgLy8gVGhleSBhcmUgaW5zZXJ0ZWQgYmVmb3JlIG91ciBkZWZhdWx0IGhhbmRsZXIuXG4gIHZhciBwYWNrYWdlQW5kQXBwSGFuZGxlcnMgPSBjcmVhdGVFeHByZXNzQXBwKClcbiAgYXBwLnVzZShwYWNrYWdlQW5kQXBwSGFuZGxlcnMpO1xuXG4gIHZhciBzdXBwcmVzc0Nvbm5lY3RFcnJvcnMgPSBmYWxzZTtcbiAgLy8gY29ubmVjdCBrbm93cyBpdCBpcyBhbiBlcnJvciBoYW5kbGVyIGJlY2F1c2UgaXQgaGFzIDQgYXJndW1lbnRzIGluc3RlYWQgb2ZcbiAgLy8gMy4gZ28gZmlndXJlLiAgKEl0IGlzIG5vdCBzbWFydCBlbm91Z2ggdG8gZmluZCBzdWNoIGEgdGhpbmcgaWYgaXQncyBoaWRkZW5cbiAgLy8gaW5zaWRlIHBhY2thZ2VBbmRBcHBIYW5kbGVycy4pXG4gIGFwcC51c2UoZnVuY3Rpb24oZXJyLCByZXEsIHJlcywgbmV4dCkge1xuICAgIGlmICghZXJyIHx8ICFzdXBwcmVzc0Nvbm5lY3RFcnJvcnMgfHwgIXJlcS5oZWFkZXJzWyd4LXN1cHByZXNzLWVycm9yJ10pIHtcbiAgICAgIG5leHQoZXJyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgcmVzLndyaXRlSGVhZChlcnIuc3RhdHVzLCB7ICdDb250ZW50LVR5cGUnOiAndGV4dC9wbGFpbicgfSk7XG4gICAgcmVzLmVuZCgnQW4gZXJyb3IgbWVzc2FnZScpO1xuICB9KTtcblxuICBhcHAudXNlKGFzeW5jIGZ1bmN0aW9uKHJlcSwgcmVzLCBuZXh0KSB7XG4gICAgaWYgKCFhcHBVcmwocmVxLnVybCkpIHtcbiAgICAgIHJldHVybiBuZXh0KCk7XG4gICAgfSBlbHNlIGlmIChcbiAgICAgIHJlcS5tZXRob2QgIT09ICdIRUFEJyAmJlxuICAgICAgcmVxLm1ldGhvZCAhPT0gJ0dFVCcgJiZcbiAgICAgICFNZXRlb3Iuc2V0dGluZ3MucGFja2FnZXM/LndlYmFwcD8uYWx3YXlzUmV0dXJuQ29udGVudFxuICAgICkge1xuICAgICAgY29uc3Qgc3RhdHVzID0gcmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnID8gMjAwIDogNDA1O1xuICAgICAgcmVzLndyaXRlSGVhZChzdGF0dXMsIHtcbiAgICAgICAgQWxsb3c6ICdPUFRJT05TLCBHRVQsIEhFQUQnLFxuICAgICAgICAnQ29udGVudC1MZW5ndGgnOiAnMCcsXG4gICAgICB9KTtcbiAgICAgIHJlcy5lbmQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIGhlYWRlcnMgPSB7XG4gICAgICAgICdDb250ZW50LVR5cGUnOiAndGV4dC9odG1sOyBjaGFyc2V0PXV0Zi04JyxcbiAgICAgIH07XG5cbiAgICAgIGlmIChzaHV0dGluZ0Rvd24pIHtcbiAgICAgICAgaGVhZGVyc1snQ29ubmVjdGlvbiddID0gJ0Nsb3NlJztcbiAgICAgIH1cblxuICAgICAgdmFyIHJlcXVlc3QgPSBXZWJBcHAuY2F0ZWdvcml6ZVJlcXVlc3QocmVxKTtcblxuICAgICAgaWYgKHJlcXVlc3QudXJsLnF1ZXJ5ICYmIHJlcXVlc3QudXJsLnF1ZXJ5WydtZXRlb3JfY3NzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gSW4gdGhpcyBjYXNlLCB3ZSdyZSByZXF1ZXN0aW5nIGEgQ1NTIHJlc291cmNlIGluIHRoZSBtZXRlb3Itc3BlY2lmaWNcbiAgICAgICAgLy8gd2F5LCBidXQgd2UgZG9uJ3QgaGF2ZSBpdC4gIFNlcnZlIGEgc3RhdGljIGNzcyBmaWxlIHRoYXQgaW5kaWNhdGVzIHRoYXRcbiAgICAgICAgLy8gd2UgZGlkbid0IGhhdmUgaXQsIHNvIHdlIGNhbiBkZXRlY3QgdGhhdCBhbmQgcmVmcmVzaC4gIE1ha2Ugc3VyZVxuICAgICAgICAvLyB0aGF0IGFueSBwcm94aWVzIG9yIENETnMgZG9uJ3QgY2FjaGUgdGhpcyBlcnJvciEgIChOb3JtYWxseSBwcm94aWVzXG4gICAgICAgIC8vIG9yIENETnMgYXJlIHNtYXJ0IGVub3VnaCBub3QgdG8gY2FjaGUgZXJyb3IgcGFnZXMsIGJ1dCBpbiBvcmRlciB0b1xuICAgICAgICAvLyBtYWtlIHRoaXMgaGFjayB3b3JrLCB3ZSBuZWVkIHRvIHJldHVybiB0aGUgQ1NTIGZpbGUgYXMgYSAyMDAsIHdoaWNoXG4gICAgICAgIC8vIHdvdWxkIG90aGVyd2lzZSBiZSBjYWNoZWQuKVxuICAgICAgICBoZWFkZXJzWydDb250ZW50LVR5cGUnXSA9ICd0ZXh0L2NzczsgY2hhcnNldD11dGYtOCc7XG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCBoZWFkZXJzKTtcbiAgICAgICAgcmVzLndyaXRlKCcubWV0ZW9yLWNzcy1ub3QtZm91bmQtZXJyb3IgeyB3aWR0aDogMHB4O30nKTtcbiAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmIChyZXF1ZXN0LnVybC5xdWVyeSAmJiByZXF1ZXN0LnVybC5xdWVyeVsnbWV0ZW9yX2pzX3Jlc291cmNlJ10pIHtcbiAgICAgICAgLy8gU2ltaWxhcmx5LCB3ZSdyZSByZXF1ZXN0aW5nIGEgSlMgcmVzb3VyY2UgdGhhdCB3ZSBkb24ndCBoYXZlLlxuICAgICAgICAvLyBTZXJ2ZSBhbiB1bmNhY2hlZCA0MDQuIChXZSBjYW4ndCB1c2UgdGhlIHNhbWUgaGFjayB3ZSB1c2UgZm9yIENTUyxcbiAgICAgICAgLy8gYmVjYXVzZSBhY3R1YWxseSBhY3Rpbmcgb24gdGhhdCBoYWNrIHJlcXVpcmVzIHVzIHRvIGhhdmUgdGhlIEpTXG4gICAgICAgIC8vIGFscmVhZHkhKVxuICAgICAgICBoZWFkZXJzWydDYWNoZS1Db250cm9sJ10gPSAnbm8tY2FjaGUnO1xuICAgICAgICByZXMud3JpdGVIZWFkKDQwNCwgaGVhZGVycyk7XG4gICAgICAgIHJlcy5lbmQoJzQwNCBOb3QgRm91bmQnKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAocmVxdWVzdC51cmwucXVlcnkgJiYgcmVxdWVzdC51cmwucXVlcnlbJ21ldGVvcl9kb250X3NlcnZlX2luZGV4J10pIHtcbiAgICAgICAgLy8gV2hlbiBkb3dubG9hZGluZyBmaWxlcyBkdXJpbmcgYSBDb3Jkb3ZhIGhvdCBjb2RlIHB1c2gsIHdlIG5lZWRcbiAgICAgICAgLy8gdG8gZGV0ZWN0IGlmIGEgZmlsZSBpcyBub3QgYXZhaWxhYmxlIGluc3RlYWQgb2YgaW5hZHZlcnRlbnRseVxuICAgICAgICAvLyBkb3dubG9hZGluZyB0aGUgZGVmYXVsdCBpbmRleCBwYWdlLlxuICAgICAgICAvLyBTbyBzaW1pbGFyIHRvIHRoZSBzaXR1YXRpb24gYWJvdmUsIHdlIHNlcnZlIGFuIHVuY2FjaGVkIDQwNC5cbiAgICAgICAgaGVhZGVyc1snQ2FjaGUtQ29udHJvbCddID0gJ25vLWNhY2hlJztcbiAgICAgICAgcmVzLndyaXRlSGVhZCg0MDQsIGhlYWRlcnMpO1xuICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgeyBhcmNoIH0gPSByZXF1ZXN0O1xuICAgICAgYXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiBhcmNoLCAnc3RyaW5nJywgeyBhcmNoIH0pO1xuXG4gICAgICBpZiAoIWhhc093bi5jYWxsKFdlYkFwcC5jbGllbnRQcm9ncmFtcywgYXJjaCkpIHtcbiAgICAgICAgLy8gV2UgY291bGQgY29tZSBoZXJlIGluIGNhc2Ugd2UgcnVuIHdpdGggc29tZSBhcmNoaXRlY3R1cmVzIGV4Y2x1ZGVkXG4gICAgICAgIGhlYWRlcnNbJ0NhY2hlLUNvbnRyb2wnXSA9ICduby1jYWNoZSc7XG4gICAgICAgIHJlcy53cml0ZUhlYWQoNDA0LCBoZWFkZXJzKTtcbiAgICAgICAgaWYgKE1ldGVvci5pc0RldmVsb3BtZW50KSB7XG4gICAgICAgICAgcmVzLmVuZChgTm8gY2xpZW50IHByb2dyYW0gZm91bmQgZm9yIHRoZSAke2FyY2h9IGFyY2hpdGVjdHVyZS5gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvLyBTYWZldHkgbmV0LCBidXQgdGhpcyBicmFuY2ggc2hvdWxkIG5vdCBiZSBwb3NzaWJsZS5cbiAgICAgICAgICByZXMuZW5kKCc0MDQgTm90IEZvdW5kJyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBJZiBwYXVzZUNsaWVudChhcmNoKSBoYXMgYmVlbiBjYWxsZWQsIHByb2dyYW0ucGF1c2VkIHdpbGwgYmUgYVxuICAgICAgLy8gUHJvbWlzZSB0aGF0IHdpbGwgYmUgcmVzb2x2ZWQgd2hlbiB0aGUgcHJvZ3JhbSBpcyB1bnBhdXNlZC5cbiAgICAgIGF3YWl0IFdlYkFwcC5jbGllbnRQcm9ncmFtc1thcmNoXS5wYXVzZWQ7XG5cbiAgICAgIHJldHVybiBnZXRCb2lsZXJwbGF0ZUFzeW5jKHJlcXVlc3QsIGFyY2gpXG4gICAgICAgIC50aGVuKCh7IHN0cmVhbSwgc3RhdHVzQ29kZSwgaGVhZGVyczogbmV3SGVhZGVycyB9KSA9PiB7XG4gICAgICAgICAgaWYgKCFzdGF0dXNDb2RlKSB7XG4gICAgICAgICAgICBzdGF0dXNDb2RlID0gcmVzLnN0YXR1c0NvZGUgPyByZXMuc3RhdHVzQ29kZSA6IDIwMDtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAobmV3SGVhZGVycykge1xuICAgICAgICAgICAgT2JqZWN0LmFzc2lnbihoZWFkZXJzLCBuZXdIZWFkZXJzKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICByZXMud3JpdGVIZWFkKHN0YXR1c0NvZGUsIGhlYWRlcnMpO1xuXG4gICAgICAgICAgc3RyZWFtLnBpcGUocmVzLCB7XG4gICAgICAgICAgICAvLyBFbmQgdGhlIHJlc3BvbnNlIHdoZW4gdGhlIHN0cmVhbSBlbmRzLlxuICAgICAgICAgICAgZW5kOiB0cnVlLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9KVxuICAgICAgICAuY2F0Y2goZXJyb3IgPT4ge1xuICAgICAgICAgIExvZy5lcnJvcignRXJyb3IgcnVubmluZyB0ZW1wbGF0ZTogJyArIGVycm9yLnN0YWNrKTtcbiAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgaGVhZGVycyk7XG4gICAgICAgICAgcmVzLmVuZCgpO1xuICAgICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIFJldHVybiA0MDQgYnkgZGVmYXVsdCwgaWYgbm8gb3RoZXIgaGFuZGxlcnMgc2VydmUgdGhpcyBVUkwuXG4gIGFwcC51c2UoZnVuY3Rpb24ocmVxLCByZXMpIHtcbiAgICByZXMud3JpdGVIZWFkKDQwNCk7XG4gICAgcmVzLmVuZCgpO1xuICB9KTtcblxuICB2YXIgaHR0cFNlcnZlciA9IGNyZWF0ZVNlcnZlcihhcHApO1xuICB2YXIgb25MaXN0ZW5pbmdDYWxsYmFja3MgPSBbXTtcblxuICAvLyBBZnRlciA1IHNlY29uZHMgdy9vIGRhdGEgb24gYSBzb2NrZXQsIGtpbGwgaXQuICBPbiB0aGUgb3RoZXIgaGFuZCwgaWZcbiAgLy8gdGhlcmUncyBhbiBvdXRzdGFuZGluZyByZXF1ZXN0LCBnaXZlIGl0IGEgaGlnaGVyIHRpbWVvdXQgaW5zdGVhZCAodG8gYXZvaWRcbiAgLy8ga2lsbGluZyBsb25nLXBvbGxpbmcgcmVxdWVzdHMpXG4gIGh0dHBTZXJ2ZXIuc2V0VGltZW91dChTSE9SVF9TT0NLRVRfVElNRU9VVCk7XG5cbiAgLy8gRG8gdGhpcyBoZXJlLCBhbmQgdGhlbiBhbHNvIGluIGxpdmVkYXRhL3N0cmVhbV9zZXJ2ZXIuanMsIGJlY2F1c2VcbiAgLy8gc3RyZWFtX3NlcnZlci5qcyBraWxscyBhbGwgdGhlIGN1cnJlbnQgcmVxdWVzdCBoYW5kbGVycyB3aGVuIGluc3RhbGxpbmcgaXRzXG4gIC8vIG93bi5cbiAgaHR0cFNlcnZlci5vbigncmVxdWVzdCcsIFdlYkFwcC5fdGltZW91dEFkanVzdG1lbnRSZXF1ZXN0Q2FsbGJhY2spO1xuXG4gIC8vIElmIHRoZSBjbGllbnQgZ2F2ZSB1cyBhIGJhZCByZXF1ZXN0LCB0ZWxsIGl0IGluc3RlYWQgb2YganVzdCBjbG9zaW5nIHRoZVxuICAvLyBzb2NrZXQuIFRoaXMgbGV0cyBsb2FkIGJhbGFuY2VycyBpbiBmcm9udCBvZiB1cyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gXCJhXG4gIC8vIHNlcnZlciBpcyByYW5kb21seSBjbG9zaW5nIHNvY2tldHMgZm9yIG5vIHJlYXNvblwiIGFuZCBcImNsaWVudCBzZW50IGEgYmFkXG4gIC8vIHJlcXVlc3RcIi5cbiAgLy9cbiAgLy8gVGhpcyB3aWxsIG9ubHkgd29yayBvbiBOb2RlIDY7IE5vZGUgNCBkZXN0cm95cyB0aGUgc29ja2V0IGJlZm9yZSBjYWxsaW5nXG4gIC8vIHRoaXMgZXZlbnQuIFNlZSBodHRwczovL2dpdGh1Yi5jb20vbm9kZWpzL25vZGUvcHVsbC80NTU3LyBmb3IgZGV0YWlscy5cbiAgaHR0cFNlcnZlci5vbignY2xpZW50RXJyb3InLCAoZXJyLCBzb2NrZXQpID0+IHtcbiAgICAvLyBQcmUtTm9kZS02LCBkbyBub3RoaW5nLlxuICAgIGlmIChzb2NrZXQuZGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGVyci5tZXNzYWdlID09PSAnUGFyc2UgRXJyb3InKSB7XG4gICAgICBzb2NrZXQuZW5kKCdIVFRQLzEuMSA0MDAgQmFkIFJlcXVlc3RcXHJcXG5cXHJcXG4nKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gRm9yIG90aGVyIGVycm9ycywgdXNlIHRoZSBkZWZhdWx0IGJlaGF2aW9yIGFzIGlmIHdlIGhhZCBubyBjbGllbnRFcnJvclxuICAgICAgLy8gaGFuZGxlci5cbiAgICAgIHNvY2tldC5kZXN0cm95KGVycik7XG4gICAgfVxuICB9KTtcblxuICAvLyBzdGFydCB1cCBhcHBcbiAgXy5leHRlbmQoV2ViQXBwLCB7XG4gICAgZXhwcmVzc0hhbmRsZXJzOiBwYWNrYWdlQW5kQXBwSGFuZGxlcnMsXG4gICAgcmF3RXhwcmVzc0hhbmRsZXJzOiByYXdFeHByZXNzSGFuZGxlcnMsXG4gICAgaHR0cFNlcnZlcjogaHR0cFNlcnZlcixcbiAgICBleHByZXNzQXBwOiBhcHAsXG4gICAgLy8gRm9yIHRlc3RpbmcuXG4gICAgc3VwcHJlc3NDb25uZWN0RXJyb3JzOiBmdW5jdGlvbigpIHtcbiAgICAgIHN1cHByZXNzQ29ubmVjdEVycm9ycyA9IHRydWU7XG4gICAgfSxcbiAgICBvbkxpc3RlbmluZzogZnVuY3Rpb24oZikge1xuICAgICAgaWYgKG9uTGlzdGVuaW5nQ2FsbGJhY2tzKSBvbkxpc3RlbmluZ0NhbGxiYWNrcy5wdXNoKGYpO1xuICAgICAgZWxzZSBmKCk7XG4gICAgfSxcbiAgICAvLyBUaGlzIGNhbiBiZSBvdmVycmlkZGVuIGJ5IHVzZXJzIHdobyB3YW50IHRvIG1vZGlmeSBob3cgbGlzdGVuaW5nIHdvcmtzXG4gICAgLy8gKGVnLCB0byBydW4gYSBwcm94eSBsaWtlIEFwb2xsbyBFbmdpbmUgUHJveHkgaW4gZnJvbnQgb2YgdGhlIHNlcnZlcikuXG4gICAgc3RhcnRMaXN0ZW5pbmc6IGZ1bmN0aW9uKGh0dHBTZXJ2ZXIsIGxpc3Rlbk9wdGlvbnMsIGNiKSB7XG4gICAgICBodHRwU2VydmVyLmxpc3RlbihsaXN0ZW5PcHRpb25zLCBjYik7XG4gICAgfSxcbiAgfSk7XG5cbiAgICAvKipcbiAgICogQG5hbWUgbWFpblxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBzdW1tYXJ5IFN0YXJ0cyB0aGUgSFRUUCBzZXJ2ZXIuXG4gICAqICBJZiBgVU5JWF9TT0NLRVRfUEFUSGAgaXMgcHJlc2VudCBNZXRlb3IncyBIVFRQIHNlcnZlciB3aWxsIHVzZSB0aGF0IHNvY2tldCBmaWxlIGZvciBpbnRlci1wcm9jZXNzIGNvbW11bmljYXRpb24sIGluc3RlYWQgb2YgVENQLlxuICAgKiBJZiB5b3UgY2hvb3NlIHRvIG5vdCBpbmNsdWRlIHdlYmFwcCBwYWNrYWdlIGluIHlvdXIgYXBwbGljYXRpb24gdGhpcyBtZXRob2Qgc3RpbGwgbXVzdCBiZSBkZWZpbmVkIGZvciB5b3VyIE1ldGVvciBhcHBsaWNhdGlvbiB0byB3b3JrLiBcbiAgICovXG4gIC8vIExldCB0aGUgcmVzdCBvZiB0aGUgcGFja2FnZXMgKGFuZCBNZXRlb3Iuc3RhcnR1cCBob29rcykgaW5zZXJ0IGNvbm5lY3RcbiAgLy8gbWlkZGxld2FyZXMgYW5kIHVwZGF0ZSBfX21ldGVvcl9ydW50aW1lX2NvbmZpZ19fLCB0aGVuIGtlZXAgZ29pbmcgdG8gc2V0IHVwXG4gIC8vIGFjdHVhbGx5IHNlcnZpbmcgSFRNTC5cbiAgZXhwb3J0cy5tYWluID0gYXN5bmMgYXJndiA9PiB7XG4gICAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUoKTtcblxuICAgIGNvbnN0IHN0YXJ0SHR0cFNlcnZlciA9IGxpc3Rlbk9wdGlvbnMgPT4ge1xuICAgICAgV2ViQXBwLnN0YXJ0TGlzdGVuaW5nKFxuICAgICAgICBodHRwU2VydmVyLFxuICAgICAgICBsaXN0ZW5PcHRpb25zLFxuICAgICAgICBNZXRlb3IuYmluZEVudmlyb25tZW50KFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIGlmIChwcm9jZXNzLmVudi5NRVRFT1JfUFJJTlRfT05fTElTVEVOKSB7XG4gICAgICAgICAgICAgIGNvbnNvbGUubG9nKCdMSVNURU5JTkcnKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGNvbnN0IGNhbGxiYWNrcyA9IG9uTGlzdGVuaW5nQ2FsbGJhY2tzO1xuICAgICAgICAgICAgb25MaXN0ZW5pbmdDYWxsYmFja3MgPSBudWxsO1xuICAgICAgICAgICAgY2FsbGJhY2tzLmZvckVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICBlID0+IHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGxpc3RlbmluZzonLCBlKTtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoZSAmJiBlLnN0YWNrKTtcbiAgICAgICAgICB9XG4gICAgICAgIClcbiAgICAgICk7XG4gICAgfTtcblxuICAgIGxldCBsb2NhbFBvcnQgPSBwcm9jZXNzLmVudi5QT1JUIHx8IDA7XG4gICAgbGV0IHVuaXhTb2NrZXRQYXRoID0gcHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfUEFUSDtcblxuICAgIGlmICh1bml4U29ja2V0UGF0aCkge1xuICAgICAgaWYgKGNsdXN0ZXIuaXNXb3JrZXIpIHtcbiAgICAgICAgY29uc3Qgd29ya2VyTmFtZSA9IGNsdXN0ZXIud29ya2VyLnByb2Nlc3MuZW52Lm5hbWUgfHwgY2x1c3Rlci53b3JrZXIuaWQ7XG4gICAgICAgIHVuaXhTb2NrZXRQYXRoICs9ICcuJyArIHdvcmtlck5hbWUgKyAnLnNvY2snO1xuICAgICAgfVxuICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIGEgc29ja2V0IGZpbGUuXG4gICAgICByZW1vdmVFeGlzdGluZ1NvY2tldEZpbGUodW5peFNvY2tldFBhdGgpO1xuICAgICAgc3RhcnRIdHRwU2VydmVyKHsgcGF0aDogdW5peFNvY2tldFBhdGggfSk7XG5cbiAgICAgIGNvbnN0IHVuaXhTb2NrZXRQZXJtaXNzaW9ucyA9IChcbiAgICAgICAgcHJvY2Vzcy5lbnYuVU5JWF9TT0NLRVRfUEVSTUlTU0lPTlMgfHwgJydcbiAgICAgICkudHJpbSgpO1xuICAgICAgaWYgKHVuaXhTb2NrZXRQZXJtaXNzaW9ucykge1xuICAgICAgICBpZiAoL15bMC03XXszfSQvLnRlc3QodW5peFNvY2tldFBlcm1pc3Npb25zKSkge1xuICAgICAgICAgIGNobW9kU3luYyh1bml4U29ja2V0UGF0aCwgcGFyc2VJbnQodW5peFNvY2tldFBlcm1pc3Npb25zLCA4KSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVOSVhfU09DS0VUX1BFUk1JU1NJT05TIHNwZWNpZmllZCcpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IHVuaXhTb2NrZXRHcm91cCA9IChwcm9jZXNzLmVudi5VTklYX1NPQ0tFVF9HUk9VUCB8fCAnJykudHJpbSgpO1xuICAgICAgaWYgKHVuaXhTb2NrZXRHcm91cCkge1xuICAgICAgICAvL3dob21zdCBhdXRvbWF0aWNhbGx5IGhhbmRsZXMgYm90aCBncm91cCBuYW1lcyBhbmQgbnVtZXJpY2FsIGdpZHNcbiAgICAgICAgY29uc3QgdW5peFNvY2tldEdyb3VwSW5mbyA9IHdob21zdC5zeW5jLmdyb3VwKHVuaXhTb2NrZXRHcm91cCk7XG4gICAgICAgIGlmICh1bml4U29ja2V0R3JvdXBJbmZvID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFVOSVhfU09DS0VUX0dST1VQIG5hbWUgc3BlY2lmaWVkJyk7XG4gICAgICAgIH1cbiAgICAgICAgY2hvd25TeW5jKHVuaXhTb2NrZXRQYXRoLCB1c2VySW5mbygpLnVpZCwgdW5peFNvY2tldEdyb3VwSW5mby5naWQpO1xuICAgICAgfVxuXG4gICAgICByZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwKHVuaXhTb2NrZXRQYXRoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbG9jYWxQb3J0ID0gaXNOYU4oTnVtYmVyKGxvY2FsUG9ydCkpID8gbG9jYWxQb3J0IDogTnVtYmVyKGxvY2FsUG9ydCk7XG4gICAgICBpZiAoL1xcXFxcXFxcPy4rXFxcXHBpcGVcXFxcPy4rLy50ZXN0KGxvY2FsUG9ydCkpIHtcbiAgICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIFdpbmRvd3MgU2VydmVyIHN0eWxlIG5hbWVkIHBpcGUuXG4gICAgICAgIHN0YXJ0SHR0cFNlcnZlcih7IHBhdGg6IGxvY2FsUG9ydCB9KTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIGxvY2FsUG9ydCA9PT0gJ251bWJlcicpIHtcbiAgICAgICAgLy8gU3RhcnQgdGhlIEhUVFAgc2VydmVyIHVzaW5nIFRDUC5cbiAgICAgICAgc3RhcnRIdHRwU2VydmVyKHtcbiAgICAgICAgICBwb3J0OiBsb2NhbFBvcnQsXG4gICAgICAgICAgaG9zdDogcHJvY2Vzcy5lbnYuQklORF9JUCB8fCAnMC4wLjAuMCcsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIFBPUlQgc3BlY2lmaWVkJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuICdEQUVNT04nO1xuICB9O1xufVxuXG52YXIgaW5saW5lU2NyaXB0c0FsbG93ZWQgPSB0cnVlO1xuXG5XZWJBcHBJbnRlcm5hbHMuaW5saW5lU2NyaXB0c0FsbG93ZWQgPSBmdW5jdGlvbigpIHtcbiAgcmV0dXJuIGlubGluZVNjcmlwdHNBbGxvd2VkO1xufTtcblxuV2ViQXBwSW50ZXJuYWxzLnNldElubGluZVNjcmlwdHNBbGxvd2VkID0gYXN5bmMgZnVuY3Rpb24odmFsdWUpIHtcbiAgaW5saW5lU2NyaXB0c0FsbG93ZWQgPSB2YWx1ZTtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUoKTtcbn07XG5cbnZhciBzcmlNb2RlO1xuXG5XZWJBcHBJbnRlcm5hbHMuZW5hYmxlU3VicmVzb3VyY2VJbnRlZ3JpdHkgPSBhc3luYyBmdW5jdGlvbih1c2VfY3JlZGVudGlhbHMgPSBmYWxzZSkge1xuICBzcmlNb2RlID0gdXNlX2NyZWRlbnRpYWxzID8gJ3VzZS1jcmVkZW50aWFscycgOiAnYW5vbnltb3VzJztcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUoKTtcbn07XG5cbldlYkFwcEludGVybmFscy5zZXRCdW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayA9IGFzeW5jIGZ1bmN0aW9uKGhvb2tGbikge1xuICBidW5kbGVkSnNDc3NVcmxSZXdyaXRlSG9vayA9IGhvb2tGbjtcbiAgYXdhaXQgV2ViQXBwSW50ZXJuYWxzLmdlbmVyYXRlQm9pbGVycGxhdGUoKTtcbn07XG5cbldlYkFwcEludGVybmFscy5zZXRCdW5kbGVkSnNDc3NQcmVmaXggPSBhc3luYyBmdW5jdGlvbihwcmVmaXgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBhd2FpdCBzZWxmLnNldEJ1bmRsZWRKc0Nzc1VybFJld3JpdGVIb29rKGZ1bmN0aW9uKHVybCkge1xuICAgIHJldHVybiBwcmVmaXggKyB1cmw7XG4gIH0pO1xufTtcblxuLy8gUGFja2FnZXMgY2FuIGNhbGwgYFdlYkFwcEludGVybmFscy5hZGRTdGF0aWNKc2AgdG8gc3BlY2lmeSBzdGF0aWNcbi8vIEphdmFTY3JpcHQgdG8gYmUgaW5jbHVkZWQgaW4gdGhlIGFwcC4gVGhpcyBzdGF0aWMgSlMgd2lsbCBiZSBpbmxpbmVkLFxuLy8gdW5sZXNzIGlubGluZSBzY3JpcHRzIGhhdmUgYmVlbiBkaXNhYmxlZCwgaW4gd2hpY2ggY2FzZSBpdCB3aWxsIGJlXG4vLyBzZXJ2ZWQgdW5kZXIgYC88c2hhMSBvZiBjb250ZW50cz5gLlxudmFyIGFkZGl0aW9uYWxTdGF0aWNKcyA9IHt9O1xuV2ViQXBwSW50ZXJuYWxzLmFkZFN0YXRpY0pzID0gZnVuY3Rpb24oY29udGVudHMpIHtcbiAgYWRkaXRpb25hbFN0YXRpY0pzWycvJyArIHNoYTEoY29udGVudHMpICsgJy5qcyddID0gY29udGVudHM7XG59O1xuXG4vLyBFeHBvcnRlZCBmb3IgdGVzdHNcbldlYkFwcEludGVybmFscy5nZXRCb2lsZXJwbGF0ZSA9IGdldEJvaWxlcnBsYXRlO1xuV2ViQXBwSW50ZXJuYWxzLmFkZGl0aW9uYWxTdGF0aWNKcyA9IGFkZGl0aW9uYWxTdGF0aWNKcztcblxuYXdhaXQgcnVuV2ViQXBwU2VydmVyKCk7XG5cbiIsImltcG9ydCB7IHN0YXRTeW5jLCB1bmxpbmtTeW5jLCBleGlzdHNTeW5jIH0gZnJvbSAnZnMnO1xuXG4vLyBTaW5jZSBhIG5ldyBzb2NrZXQgZmlsZSB3aWxsIGJlIGNyZWF0ZWQgd2hlbiB0aGUgSFRUUCBzZXJ2ZXJcbi8vIHN0YXJ0cyB1cCwgaWYgZm91bmQgcmVtb3ZlIHRoZSBleGlzdGluZyBmaWxlLlxuLy9cbi8vIFdBUk5JTkc6XG4vLyBUaGlzIHdpbGwgcmVtb3ZlIHRoZSBjb25maWd1cmVkIHNvY2tldCBmaWxlIHdpdGhvdXQgd2FybmluZy4gSWZcbi8vIHRoZSBjb25maWd1cmVkIHNvY2tldCBmaWxlIGlzIGFscmVhZHkgaW4gdXNlIGJ5IGFub3RoZXIgYXBwbGljYXRpb24sXG4vLyBpdCB3aWxsIHN0aWxsIGJlIHJlbW92ZWQuIE5vZGUgZG9lcyBub3QgcHJvdmlkZSBhIHJlbGlhYmxlIHdheSB0b1xuLy8gZGlmZmVyZW50aWF0ZSBiZXR3ZWVuIGEgc29ja2V0IGZpbGUgdGhhdCBpcyBhbHJlYWR5IGluIHVzZSBieVxuLy8gYW5vdGhlciBhcHBsaWNhdGlvbiBvciBhIHN0YWxlIHNvY2tldCBmaWxlIHRoYXQgaGFzIGJlZW5cbi8vIGxlZnQgb3ZlciBhZnRlciBhIFNJR0tJTEwuIFNpbmNlIHdlIGhhdmUgbm8gcmVsaWFibGUgd2F5IHRvXG4vLyBkaWZmZXJlbnRpYXRlIGJldHdlZW4gdGhlc2UgdHdvIHNjZW5hcmlvcywgdGhlIGJlc3QgY291cnNlIG9mXG4vLyBhY3Rpb24gZHVyaW5nIHN0YXJ0dXAgaXMgdG8gcmVtb3ZlIGFueSBleGlzdGluZyBzb2NrZXQgZmlsZS4gVGhpc1xuLy8gaXMgbm90IHRoZSBzYWZlc3QgY291cnNlIG9mIGFjdGlvbiBhcyByZW1vdmluZyB0aGUgZXhpc3Rpbmcgc29ja2V0XG4vLyBmaWxlIGNvdWxkIGltcGFjdCBhbiBhcHBsaWNhdGlvbiB1c2luZyBpdCwgYnV0IHRoaXMgYXBwcm9hY2ggaGVscHNcbi8vIGVuc3VyZSB0aGUgSFRUUCBzZXJ2ZXIgY2FuIHN0YXJ0dXAgd2l0aG91dCBtYW51YWxcbi8vIGludGVydmVudGlvbiAoZS5nLiBhc2tpbmcgZm9yIHRoZSB2ZXJpZmljYXRpb24gYW5kIGNsZWFudXAgb2Ygc29ja2V0XG4vLyBmaWxlcyBiZWZvcmUgYWxsb3dpbmcgdGhlIEhUVFAgc2VydmVyIHRvIGJlIHN0YXJ0ZWQpLlxuLy9cbi8vIFRoZSBhYm92ZSBiZWluZyBzYWlkLCBhcyBsb25nIGFzIHRoZSBzb2NrZXQgZmlsZSBwYXRoIGlzXG4vLyBjb25maWd1cmVkIGNhcmVmdWxseSB3aGVuIHRoZSBhcHBsaWNhdGlvbiBpcyBkZXBsb3llZCAoYW5kIGV4dHJhXG4vLyBjYXJlIGlzIHRha2VuIHRvIG1ha2Ugc3VyZSB0aGUgY29uZmlndXJlZCBwYXRoIGlzIHVuaXF1ZSBhbmQgZG9lc24ndFxuLy8gY29uZmxpY3Qgd2l0aCBhbm90aGVyIHNvY2tldCBmaWxlIHBhdGgpLCB0aGVuIHRoZXJlIHNob3VsZCBub3QgYmVcbi8vIGFueSBpc3N1ZXMgd2l0aCB0aGlzIGFwcHJvYWNoLlxuZXhwb3J0IGNvbnN0IHJlbW92ZUV4aXN0aW5nU29ja2V0RmlsZSA9IChzb2NrZXRQYXRoKSA9PiB7XG4gIHRyeSB7XG4gICAgaWYgKHN0YXRTeW5jKHNvY2tldFBhdGgpLmlzU29ja2V0KCkpIHtcbiAgICAgIC8vIFNpbmNlIGEgbmV3IHNvY2tldCBmaWxlIHdpbGwgYmUgY3JlYXRlZCwgcmVtb3ZlIHRoZSBleGlzdGluZ1xuICAgICAgLy8gZmlsZS5cbiAgICAgIHVubGlua1N5bmMoc29ja2V0UGF0aCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgYEFuIGV4aXN0aW5nIGZpbGUgd2FzIGZvdW5kIGF0IFwiJHtzb2NrZXRQYXRofVwiIGFuZCBpdCBpcyBub3QgYCArXG4gICAgICAgICdhIHNvY2tldCBmaWxlLiBQbGVhc2UgY29uZmlybSBQT1JUIGlzIHBvaW50aW5nIHRvIHZhbGlkIGFuZCAnICtcbiAgICAgICAgJ3VuLXVzZWQgc29ja2V0IGZpbGUgcGF0aC4nXG4gICAgICApO1xuICAgIH1cbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAvLyBJZiB0aGVyZSBpcyBubyBleGlzdGluZyBzb2NrZXQgZmlsZSB0byBjbGVhbnVwLCBncmVhdCwgd2UnbGxcbiAgICAvLyBjb250aW51ZSBub3JtYWxseS4gSWYgdGhlIGNhdWdodCBleGNlcHRpb24gcmVwcmVzZW50cyBhbnkgb3RoZXJcbiAgICAvLyBpc3N1ZSwgcmUtdGhyb3cuXG4gICAgaWYgKGVycm9yLmNvZGUgIT09ICdFTk9FTlQnKSB7XG4gICAgICB0aHJvdyBlcnJvcjtcbiAgICB9XG4gIH1cbn07XG5cbi8vIFJlbW92ZSB0aGUgc29ja2V0IGZpbGUgd2hlbiBkb25lIHRvIGF2b2lkIGxlYXZpbmcgYmVoaW5kIGEgc3RhbGUgb25lLlxuLy8gTm90ZSAtIGEgc3RhbGUgc29ja2V0IGZpbGUgaXMgc3RpbGwgbGVmdCBiZWhpbmQgaWYgdGhlIHJ1bm5pbmcgbm9kZVxuLy8gcHJvY2VzcyBpcyBraWxsZWQgdmlhIHNpZ25hbCA5IC0gU0lHS0lMTC5cbmV4cG9ydCBjb25zdCByZWdpc3RlclNvY2tldEZpbGVDbGVhbnVwID1cbiAgKHNvY2tldFBhdGgsIGV2ZW50RW1pdHRlciA9IHByb2Nlc3MpID0+IHtcbiAgICBbJ2V4aXQnLCAnU0lHSU5UJywgJ1NJR0hVUCcsICdTSUdURVJNJ10uZm9yRWFjaChzaWduYWwgPT4ge1xuICAgICAgZXZlbnRFbWl0dGVyLm9uKHNpZ25hbCwgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudCgoKSA9PiB7XG4gICAgICAgIGlmIChleGlzdHNTeW5jKHNvY2tldFBhdGgpKSB7XG4gICAgICAgICAgdW5saW5rU3luYyhzb2NrZXRQYXRoKTtcbiAgICAgICAgfVxuICAgICAgfSkpO1xuICAgIH0pO1xuICB9O1xuIl19

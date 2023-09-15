//////////////////////////////////////////////////////////////////////////
//                                                                      //
// This is a generated file. You can view the original                  //
// source in your browser if your browser supports source maps.         //
// Source maps are supported by all recent versions of Chrome, Safari,  //
// and Firefox, and by Internet Explorer 11.                            //
//                                                                      //
//////////////////////////////////////////////////////////////////////////


Package["core-runtime"].queue("modules", ["meteor", "modules-runtime"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var meteorInstall = Package['modules-runtime'].meteorInstall;
var verifyErrors = Package['modules-runtime'].verifyErrors;

var require = meteorInstall({"node_modules":{"meteor":{"modules":{"client.js":function module(require,exports){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/client.js                                                                                   //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
require("./install-packages.js");
require("./stubs.js");
require("./process.js");
require("./reify.js");

exports.addStyles = require("./css").addStyles;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"css.js":function module(require,exports){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/css.js                                                                                      //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var doc = document;
var head = doc.getElementsByTagName("head").item(0);

exports.addStyles = function (css) {
  var style = doc.createElement("style");

  style.setAttribute("type", "text/css");

  // https://msdn.microsoft.com/en-us/library/ms535871(v=vs.85).aspx
  var internetExplorerSheetObject =
    style.sheet || // Edge/IE11.
    style.styleSheet; // Older IEs.

  if (internetExplorerSheetObject) {
    internetExplorerSheetObject.cssText = css;
  } else {
    style.appendChild(doc.createTextNode(css));
  }

  return head.appendChild(style);
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"install-packages.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/install-packages.js                                                                         //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
function install(name, mainModule) {
  var meteorDir = {};

  // Given a package name <name>, install a stub module in the
  // /node_modules/meteor directory called <name>.js, so that
  // require.resolve("meteor/<name>") will always return
  // /node_modules/meteor/<name>.js instead of something like
  // /node_modules/meteor/<name>/index.js, in the rare but possible event
  // that the package contains a file called index.js (#6590).

  if (typeof mainModule === "string") {
    // Set up an alias from /node_modules/meteor/<package>.js to the main
    // module, e.g. meteor/<package>/index.js.
    meteorDir[name + ".js"] = mainModule;
  } else {
    // back compat with old Meteor packages
    meteorDir[name + ".js"] = function (r, e, module) {
      module.exports = Package[name];
    };
  }

  meteorInstall({
    node_modules: {
      meteor: meteorDir
    }
  });
}

// This file will be modified during computeJsOutputFilesMap to include
// install(<name>) calls for every Meteor package.

install("core-runtime");
install("meteor");
install("meteor-base");
install("mobile-experience");
install("modules-runtime");
install("modules", "meteor/modules/client.js");
install("modern-browsers");
install("babel-compiler");
install("react-fast-refresh");
install("ecmascript");
install("ecmascript-runtime");
install("babel-runtime");
install("promise", "meteor/promise/client.js");
install("fetch", "meteor/fetch/modern.js");
install("dynamic-import", "meteor/dynamic-import/client.js");
install("es5-shim");
install("ecmascript-runtime-client", "meteor/ecmascript-runtime-client/modern.js");
install("base64", "meteor/base64/base64.js");
install("ejson", "meteor/ejson/ejson.js");
install("diff-sequence", "meteor/diff-sequence/diff.js");
install("geojson-utils", "meteor/geojson-utils/main.js");
install("id-map", "meteor/id-map/id-map.js");
install("random", "meteor/random/main_client.js");
install("mongo-id", "meteor/mongo-id/id.js");
install("ordered-dict", "meteor/ordered-dict/ordered_dict.js");
install("tracker");
install("minimongo", "meteor/minimongo/minimongo_client.js");
install("check", "meteor/check/match.js");
install("retry", "meteor/retry/retry.js");
install("callback-hook", "meteor/callback-hook/hook.js");
install("ddp-common");
install("reload", "meteor/reload/reload.js");
install("socket-stream-client", "meteor/socket-stream-client/browser.js");
install("ddp-client", "meteor/ddp-client/client/client.js");
install("ddp");
install("ddp-server");
install("allow-deny");
install("mongo-dev-server");
install("logging", "meteor/logging/logging.js");
install("mongo");
install("static-html");
install("reactive-var");
install("minifier-css");
install("standard-minifier-css");
install("standard-minifier-js");
install("typescript");
install("shell-server");
install("webapp", "meteor/webapp/webapp_client.js");
install("hot-code-push");
install("launch-screen");
install("autoupdate", "meteor/autoupdate/autoupdate_client.js");

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"process.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/process.js                                                                                  //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
if (! global.process) {
  try {
    // The application can run `npm install process` to provide its own
    // process stub; otherwise this module will provide a partial stub.
    global.process = require("process");
  } catch (missing) {
    global.process = {};
  }
}

var proc = global.process;

if (Meteor.isServer) {
  // Make require("process") work on the server in all versions of Node.
  meteorInstall({
    node_modules: {
      "process.js": function (r, e, module) {
        module.exports = proc;
      }
    }
  });
} else {
  proc.platform = "browser";
  proc.nextTick = proc.nextTick || Meteor._setImmediate;
}

if (typeof proc.env !== "object") {
  proc.env = {};
}

var hasOwn = Object.prototype.hasOwnProperty;
for (var key in meteorEnv) {
  if (hasOwn.call(meteorEnv, key)) {
    proc.env[key] = meteorEnv[key];
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"reify.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/reify.js                                                                                    //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
require("@meteorjs/reify/lib/runtime").enable(
  module.constructor.prototype
);

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"stubs.js":function module(require){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// packages/modules/stubs.js                                                                                    //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var haveStubs = false;
try {
  require.resolve("meteor-node-stubs");
  haveStubs = true;
} catch (noStubs) {}

if (haveStubs) {
  // When meteor-node-stubs is installed in the application's root
  // node_modules directory, requiring it here installs aliases for stubs
  // for all Node built-in modules, such as fs, util, and http.
  require("meteor-node-stubs");
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"node_modules":{"@meteorjs":{"reify":{"lib":{"runtime":{"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor/modules/node_modules/@meteorjs/reify/lib/runtime/index.js                                //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
"use strict";

// This module should be compatible with PhantomJS v1, just like the other files
// in reify/lib/runtime. Node 4+ features like const/let and arrow functions are
// not acceptable here, and importing any npm packages should be contemplated
// with extreme skepticism.

var utils = require("./utils.js");
var Entry = require("./entry.js");

var handleAsSync = Object.create(null);

// The exports.enable method can be used to enable the Reify runtime for
// specific module objects, or for Module.prototype (where implemented),
// to make the runtime available throughout the entire module system.
exports.enable = function (mod) {
  if (mod.link !== moduleLink) {
    mod.link = moduleLink;
    mod["export"] = moduleExport;
    mod.exportDefault = moduleExportDefault;
    mod.exportAs = moduleExportAs;
    mod.runSetters = runSetters;
    mod.wrapAsync = wrapAsync;

    // Legacy shorthand for mod.exportAs("*").
    mod.makeNsSetter = moduleMakeNsSetter;

    var origRequire = mod.require;
    mod.require = function (id) {
      var exports = origRequire.call(this, id);
      var path = this.resolve(id);
      var entry = Entry.getOrNull(path);

      if (
        entry &&
        entry.asyncEvaluation &&
        !handleAsSync[path]
      ) {
        // TODO: should this re-use the promise?
        var promise = new Promise(function (resolve, reject) {
          if (entry.status === 'evaluated') {
            if (entry.evaluationError) {
              return reject(entry.evaluationError);
            }

            return resolve(exports);
          }

          entry._onEvaluated.push(function () {
            if (entry.evaluationError) {
              return reject(entry.evaluationError);
            }

            resolve(exports);
          });
        });

        Object.defineProperty(promise, '__reifyAsyncModule', {
          // TODO: the property name should probably be changed
          value: exports,
          enumerable: false,
          writable: false,
          configurable: true
        });

        return promise;
      }
      
      return exports;
    }

    return true;
  }


  return false;
};

exports._requireAsSync = function (path) {
  handleAsSync[path] = true;
}

// Calling module.link(id, setters) resolves the given ID using
// module.resolve(id), which should return a canonical absolute module
// identifier string (like require.resolve); then creates an Entry object
// for the child module and evaluates its code (if this is the first time
// it has been imported) by calling module.require(id). Finally, the
// provided setter functions will be called with values exported by the
// module, possibly multiple times when/if those exported values change.
// The module.link name is intended to evoke the "liveness" of the
// exported bindings, since we are subscribing to all future exports of
// the child module, not just taking a snapshot of its current exports.
function moduleLink(id, setters, key) {
  utils.setESModule(this.exports);
  var parentEntry = Entry.getOrCreate(this.id, this);

  var absChildId = this.resolve(id);
  var childEntry = Entry.getOrCreate(absChildId);

  if (utils.isObject(setters)) {
    childEntry.addSetters(this, setters, key);
  }

  var exports = this.require(absChildId);

  // TODO: If we can use the original require, this code would no longer be needed
  if (
    utils.isObject(exports) &&
    Object.prototype.hasOwnProperty.call(exports, '__reifyAsyncModule')
  ) {
    // If it fails, the error will be handled by the async wrapper and entry
    exports.catch(function () {});
    exports = exports.__reifyAsyncModule;
  }

  if (childEntry.module === null) {
    childEntry.module = {
      id: absChildId,
      exports: exports
    };
  }

  childEntry.runSetters();

  if (
    childEntry.asyncEvaluation &&
    // If the parent module is no longer linking, then it can't wait
    // for the async module to finish being evaluated
    parentEntry.status !== 'linking' &&
    // If the child entry is evaluated, then there is no need to wait
    // and we can allow the nested import
    // This is needed for dynamic imports to work in Meteor
    childEntry.status !== 'evaluated'
    ) {
    throw new Error('Nested imports can not import an async module');
  }

  if (childEntry.asyncEvaluation) {
    parentEntry.addAsyncDep(childEntry);
  }
}

// Register getter functions for local variables in the scope of an export
// statement. Pass true as the second argument to indicate that the getter
// functions always return the same values.
function moduleExport(getters, constant) {
  utils.setESModule(this.exports);
  var entry = Entry.getOrCreate(this.id, this);
  entry.addGetters(getters, constant);
  if (this.loaded) {
    // If the module has already been evaluated, then we need to trigger
    // another round of entry.runSetters calls, which begins by calling
    // entry.runModuleGetters(module).
    entry.runSetters();
  }
}

// Register a getter function that always returns the given value.
function moduleExportDefault(value) {
  return this["export"]({
    "default": function () {
      return value;
    }
  }, true);
}

// Returns a function suitable for passing as a setter callback to
// module.link. If name is an identifier, calling the function will set
// the export of that name to the given value. If the name is "*", all
// properties of the value object will be exported by name, except for
// "default" (use "*+" instead of "*" to include it). Why the "default"
// property is skipped: https://github.com/tc39/ecma262/issues/948
function moduleExportAs(name) {
  var entry = this;
  var includeDefault = name === "*+";
  var setter = function (value) {
    if (name === "*" || name === "*+") {
      Object.keys(value).forEach(function (key) {
        if (includeDefault || key !== "default") {
          utils.copyKey(key, entry.exports, value);
        }
      });
    } else {
      entry.exports[name] = value;
    }
  };

  if (name !== '*+' && name !== "*") {
    setter.exportAs = name;
  }

  return setter;
}

// Platform-specific code should find a way to call this method whenever
// the module system is about to return module.exports from require. This
// might happen more than once per module, in case of dependency cycles,
// so we want Module.prototype.runSetters to run each time.
function runSetters(valueToPassThrough, names) {
  Entry.getOrCreate(this.id, this).runSetters(names, true);

  // Assignments to exported local variables get wrapped with calls to
  // module.runSetters, so module.runSetters returns the
  // valueToPassThrough parameter to allow the value of the original
  // expression to pass through. For example,
  //
  //   export var a = 1;
  //   console.log(a += 3);
  //
  // becomes
  //
  //   module.export("a", () => a);
  //   var a = 1;
  //   console.log(module.runSetters(a += 3));
  //
  // This ensures module.runSetters runs immediately after the assignment,
  // and does not interfere with the larger computation.
  return valueToPassThrough;
}

// Legacy helper that returns a function that takes a namespace object and
// copies the properties of the namespace to module.exports, excluding any
// "default" property (unless includeDefault is true), which is useful for
// implementing `export * from "module"`.
//
// Instead of using this helper like so:
//
//   module.link(id, { "*": module.makeNsSetter() });
//
// non-legacy code should simply use a string-valued setter:
//
//   module.link(id, { "*": "*" });
//
// or, to include the "default" property:
//
//   module.link(id, { "*": "*+" });
//
// This helper may be removed in a future version of Reify.
function moduleMakeNsSetter(includeDefault) {
  return this.exportAs(includeDefault ? "*+" : "*");
}

let index = 0;
function wrapAsync(body, options) {
  let module = this;
  let entry = Entry.getOrCreate(module.id, module);
  let usesTopLevelAwait = options.async;

  let waitForDepsResult = undefined;

  body.call(options.self, module, function waitForDeps() {
    // waitForDeps is called twice, once to check if the module should wait
    // and again to await the promise
    if (waitForDepsResult === undefined) {

      // This code should run immediately after all deps are synchronously required
      // By setting entry.async here, we avoid issues of dead locks from
      // circular deps - this module's deps won't be able to add
      // an _onEvaluating hook to this module
      // There are other ways to do this that allow us to set async sooner
      // but it makes handling circular deps much more complicated
      entry.async = usesTopLevelAwait;
      entry.asyncEvaluation = usesTopLevelAwait || entry.pendingAsyncDeps > 0;
      // TODO: should this be handle by the entry?
      entry.asyncEvaluationIndex = index++;

      if (entry.pendingAsyncDeps === 0) {
        waitForDepsResult = null;
        if (entry.status !== 'evaluating') {
          entry.changeStatus('evaluating');
        }

        // TODO: is this code correct and needed?
        if (!entry.async && entry.asyncEvaluation) {
          entry.changeStatus('evaluated');
        }
      } else {
        let resolve;
        let reject;
        waitForDepsResult = new Promise((_resolve, _reject) => {
          resolve = _resolve;
          reject = _reject;
        });
        entry._onEvaluating.push(function () {
          // Resolves with a function to check if there was an error
          // The module runs this function after child modules that were
          // evaluated after this resolve was scheduled
          resolve(function checkForError () {
            if (entry.evaluationError) {
              throw entry.evaluationError;
            }

          });

          // If the module has async deps but doesn't use TLA,
          // then any sync parent modules need to run
          // synchronously afterwards. Technically we aren't able to do that since
          // the parent module is awaiting a promise to know when to run.
          // However, resolving that promise now will cause the parent to run
          // before any microtasks created by this module, which in practice
          // is hopefully close enough.
          if (entry.asyncEvaluation && !entry.async) {
            entry.changeStatus('evaluated');
          }
        });
      }
      
    }

    return waitForDepsResult;
  },
  function finish(error) {
    if (error) {
      entry.setEvaluationError(error);
    }

    if (entry.asyncEvaluation) {
      entry.runSetters();
    }

    if (entry.status !== 'evaluated') {
      entry.changeStatus('evaluated');
    }
  }
  );

  if (entry.evaluationError && !entry.asyncEvaluation) {
    // This is a sync module. The error is thrown here so
    // it is outside of the async function
    // If you are trying to find where this error is from, set a breakpoint
    // above on the line that calls entry.setEvaluationError
    throw entry.evaluationError;
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"utils.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor/modules/node_modules/@meteorjs/reify/lib/runtime/utils.js                                //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
"use strict";

// This module should be compatible with PhantomJS v1, just like the other files
// in reify/lib/runtime. Node 4+ features like const/let and arrow functions are
// not acceptable here, and importing any npm packages should be contemplated
// with extreme skepticism.

var useSetPrototypeOf = typeof Object.setPrototypeOf === "function";
var useSymbol = typeof Symbol === "function";

var esStrKey = "__esModule";
var esSymKey = useSymbol ? Symbol.for(esStrKey) : null;
var useToStringTag = useSymbol && typeof Symbol.toStringTag === "symbol";
var useGetOwnPropDesc =
  typeof Object.getOwnPropertyDescriptor === "function";
var hasOwn = Object.prototype.hasOwnProperty;

function copyKey(key, target, source) {
  if (useGetOwnPropDesc) {
    var desc = Object.getOwnPropertyDescriptor(source, key);
    desc.configurable = true; // Allow redefinition.
    Object.defineProperty(target, key, desc);
  } else {
    target[key] = source[key];
  }
}

exports.copyKey = copyKey;

// Returns obj[key] unless that property is defined by a getter function,
// in which case the getter function is returned.
exports.valueOrGetter = function (obj, key) {
  if (useGetOwnPropDesc && hasOwn.call(obj, key)) {
    var desc = Object.getOwnPropertyDescriptor(obj, key);
    if (typeof desc.get === "function") {
      return desc.get;
    }
  }

  return obj[key];
};

function getESModule(exported) {
  if (isObjectLike(exported)) {
    if (useSymbol && hasOwn.call(exported, esSymKey)) {
      return !! exported[esSymKey];
    }

    if (hasOwn.call(exported, esStrKey)) {
      return !! exported[esStrKey];
    }
  }

  return false;
}

exports.getESModule = getESModule;

function setESModule(exported) {
  if (isObjectLike(exported)) {
    if (useSymbol) {
      exported[esSymKey] = true;
    }

    if (! exported[esStrKey]) {
      // Other module runtime systems may set exported.__esModule such
      // that it can't be redefined, so we call Object.defineProperty only
      // when exported.__esModule is not already true.
      Object.defineProperty(exported, esStrKey, {
        configurable: true,
        enumerable: false,
        value: true,
        writable: true
      });
    }
  }
}

exports.setESModule = setESModule;

function isObject(value) {
  return typeof value === "object" && value !== null;
}

exports.isObject = isObject;

function isObjectLike(value) {
  var type = typeof value;
  return type === "function" || (type === "object" && value !== null);
}

exports.isObjectLike = isObjectLike;

exports.ensureObjectProperty = function (object, propertyName) {
  return hasOwn.call(object, propertyName)
    ? object[propertyName]
    : object[propertyName] = Object.create(null);
};

function createNamespace() {
  var namespace = Object.create(null);

  if (useToStringTag) {
    Object.defineProperty(namespace, Symbol.toStringTag, {
      value: "Module",
      configurable: false,
      enumerable: false,
      writable: false
    });
  }

  setESModule(namespace);

  return namespace;
}

exports.createNamespace = createNamespace;

function setPrototypeOf(object, proto) {
  if (useSetPrototypeOf) {
    Object.setPrototypeOf(object, proto);
  } else {
    object.__proto__ = proto;
  }
  return object;
}

exports.setPrototypeOf = setPrototypeOf;

function isThenable(potentialPromise) {
  return typeof potentialPromise === 'object' &&
    potentialPromise !== null &&
    // Check if exists to avoid Node 14+ showing warnings with circular deps
    'then' in potentialPromise &&
    // TODO: check .then isn't a getter
    typeof potentialPromise.then === 'function';
}

exports.isThenable = isThenable;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"entry.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor/modules/node_modules/@meteorjs/reify/lib/runtime/entry.js                                //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
"use strict";

// This module should be compatible with PhantomJS v1, just like the other files
// in reify/lib/runtime. Node 4+ features like const/let and arrow functions are
// not acceptable here, and importing any npm packages should be contemplated
// with extreme skepticism.

var utils = require("./utils.js");

var GETTER_ERROR = {};
var NAN = {};
var UNDEFINED = {};
var hasOwn = Object.prototype.hasOwnProperty;
var keySalt = 0;

function Entry(id) {
  // The canonical absolute module ID of the module this Entry manages.
  this.id = id;

  // The Module object this Entry manages, unknown until module.export or
  // module.link is called for the first time.
  this.module = null;

  // The normalized namespace object that importers receive when they use
  // `import * as namespace from "..."` syntax.
  this.namespace = utils.createNamespace();

  // Getters for local variables exported from the managed module.
  this.getters = Object.create(null);

  // Setters for assigning to local variables in parent modules.
  this.setters = Object.create(null);

  // Map of setters added since the last broadcast (in the same shape as
  // entry.setters[name][key]), which should receive a broadcast the next time
  // entry.runSetters() is called, regardless of whether entry.snapshots[name]
  // has changed or not. Once called, setters are removed from this.newSetters,
  // but remain in this.setters.
  this.newSetters = Object.create(null);

  // Map from local names to snapshots of the corresponding local values, used
  // to determine when local values have changed and need to be re-broadcast.
  this.snapshots = Object.create(null);

  // State for top level await

  // TODO: rename these two properties so it is less confusing
  // uses top level await
  this.async = false;
  // is an async module (uses top level await, or has deps that do)
  this.asyncEvaluation = false;

  this.asyncEvaluationIndex = null;
  this.pendingAsyncDeps = 0;
  this._onEvaluating = [];
  this._onEvaluated = [];

  // Statuses don't exactly match the ECMAScript spec
  // linking - while linking, and until module actually starts evaluating
  // evaluating - module code is being run
  // evaluated - after module finished evaluating. If async,
  //             waits until all top level async code finished
  // If top level await is not enabled, this will always be linking
  // TODO: look into changing this
  this.status = 'linking';
  // TODO: see if we can change how errors are handled so we can use a single array
  this.allAsyncParents = [];
  this.pendingAsyncParents = [];
  this.evaluationError = null;
}

var Ep = utils.setPrototypeOf(Entry.prototype, null);
var entryMap = Object.create(null);

Entry.getOrNull = function (id) {
  if (hasOwn.call(entryMap, id)) {
    return entryMap[id];
  }

  return null;
}

Entry.getOrCreate = function (id, mod) {
  var entry = hasOwn.call(entryMap, id)
    ? entryMap[id]
    : entryMap[id] = new Entry(id);

  if (utils.isObject(mod) &&
      mod.id === entry.id) {
    entry.module = mod;
  }

  return entry;
};

function safeKeys(obj) {
  var keys = Object.keys(obj);
  var esModuleIndex = keys.indexOf("__esModule");
  if (esModuleIndex >= 0) {
    keys.splice(esModuleIndex, 1);
  }
  return keys;
}

Ep.addGetters = function (getters, constant) {
  var names = safeKeys(getters);
  var nameCount = names.length;
  constant = !! constant;

  for (var i = 0; i < nameCount; ++i) {
    var name = names[i];
    var getter = getters[name];

    if (typeof getter === "function" &&
        // Should this throw if this.getters[name] exists?
        ! (name in this.getters)) {
      this.getters[name] = getter;
      getter.constant = constant;
      getter.runCount = 0;
    }
  }
};

Ep.addSetters = function (parent, setters, key) {
  var names = safeKeys(setters);
  var nameCount = names.length;

  if (! nameCount) {
    return;
  }

  // If no key is provided, make a unique key. Otherwise, make sure the key is
  // distinct from keys provided by other parent modules.
  key = key === void 0
    ? makeUniqueKey()
    : parent.id + ":" + key;

  var entry = this;

  for (var i = 0; i < nameCount; ++i) {
    var name = names[i];
    var setter = normalizeSetterValue(parent, setters[name]);

    if (typeof setter === "function") {
      setter.parent = parent;
      // Store the setter as entry.setters[name][key], and also record it
      // temporarily in entry.newSetters, so we can be sure to run it when we
      // call entry.runSetters(names) below, even though entry.snapshots[name]
      // likely will not have changed for this name.
      utils.ensureObjectProperty(entry.setters, name)[key] = setter;
      utils.ensureObjectProperty(entry.newSetters, name)[key] = setter;
    }
  }

  entry.runSetters(names);
};

function normalizeSetterValue(module, setter) {
  if (typeof setter === "function") {
    return setter;
  }

  if (typeof setter === "string") {
    // If the value of the setter property is a string, the setter will
    // re-export the imported value using that string as the name of the
    // exported value. If the string is "*", all properties of the value
    // object will be re-exported as individual exports, except for the
    // "default" property (use "*+" instead of "*" to include it).
    return module.exportAs(setter);
  }

  if (Array.isArray(setter)) {
    switch (setter.length) {
    case 0: return null;
    case 1: return normalizeSetterValue(module, setter[0]);
    default:
      var setterFns = setter.map(function (elem) {
        return normalizeSetterValue(module, elem);
      });

      // Return a combined function that calls all of the nested setter
      // functions with the same value.
      return function (value) {
        setterFns.forEach(function (fn) {
          fn(value);
        });
      };
    }
  }

  return null;
}

Ep.runGetters = function (names) {
  // Before running getters, copy anything added to the exports object
  // over to the namespace. Values returned by getters take precedence
  // over these values, but we don't want to miss anything.
  syncExportsToNamespace(this, names);

  if (names === void 0 ||
      names.indexOf("*") >= 0) {
    names = Object.keys(this.getters);
  }

  var nameCount = names.length;

  for (var i = 0; i < nameCount; ++i) {
    var name = names[i];
    var value = runGetter(this, name);

    // If the getter is run without error, update both entry.namespace and
    // module.exports with the current value so that CommonJS require
    // calls remain consistent with module.watch.
    if (value !== GETTER_ERROR) {
      this.namespace[name] = value;
      this.module.exports[name] = value;
    }
  }
};

function syncExportsToNamespace(entry, names) {
  var setDefault = false;

  if (entry.module === null) return;
  var exports = entry.module.exports;

  if (! utils.getESModule(exports)) {
    // If the module entry is managing overrides module.exports, that
    // value should be exposed as the .default property of the namespace,
    // unless module.exports is marked as an ECMASCript module.
    entry.namespace.default = exports;
    setDefault = true;
  }

  if (! utils.isObjectLike(exports)) {
    return;
  }

  if (names === void 0 ||
      names.indexOf("*") >= 0) {
    names = Object.keys(exports);
  }

  names.forEach(function (key) {
    // Don't set any properties for which a getter function exists in
    // entry.getters, don't accidentally override entry.namespace.default,
    // and only copy own properties from entry.module.exports.
    if (! hasOwn.call(entry.getters, key) &&
        ! (setDefault && key === "default") &&
        hasOwn.call(exports, key)) {
      utils.copyKey(key, entry.namespace, exports);
    }
  });
}

// Called whenever module.exports might have changed, to trigger any
// setters associated with the newly exported values. The names parameter
// is optional; without it, all getters and setters will run.
// If the '*' setter needs to be run, but not the '*' getter (names includes
// all exports/getters that changed), the runNsSetter option can be enabled.
Ep.runSetters = function (names, runNsSetter) {
  // Make sure entry.namespace and module.exports are up to date before we
  // call getExportByName(entry, name).
  this.runGetters(names);

  if (runNsSetter && names !== void 0) {
    names.push('*');
  }

  // Lazily-initialized object mapping parent module identifiers to parent
  // module objects whose setters we might need to run.
  var parents;
  var parentNames;

  forEachSetter(this, names, function (setter, name, value) {
    if (parents === void 0) {
      parents = Object.create(null);
    }

    if (parentNames === void 0) {
      parentNames = Object.create(null);
    }

    var parentId = setter.parent.id;

    // When setters use the shorthand for re-exporting values, we know
    // which exports in the parent module were modified, and can do less work
    // when running the parent setters.
    // parentNames[parentId] is set to false if there are any setters that we do
    // not know which exports they modify
    if (setter.exportAs !== void 0 && parentNames[parentId] !== false) {
      parentNames[parentId] = parentNames[parentId] || [];
      parentNames[parentId].push(setter.exportAs);
    } else if (parentNames[parentId] !== false) {
      parentNames[parentId] = false;
    }

    parents[parentId] = setter.parent;

    // The param order for setters is `value` then `name` because the `name`
    // param is only used by namespace exports.
    setter(value, name);
  });

  if (! parents) {
    return;
  }

  // If any of the setters updated the module.exports of a parent module,
  // or updated local variables that are exported by that parent module,
  // then we must re-run any setters registered by that parent module.
  var parentIDs = Object.keys(parents);
  var parentIDCount = parentIDs.length;

  for (var i = 0; i < parentIDCount; ++i) {
    // What happens if parents[parentIDs[id]] === module, or if
    // longer cycles exist in the parent chain? Thanks to our snapshot
    // bookkeeping above, the runSetters broadcast will only proceed
    // as far as there are any actual changes to report.
    var parent = parents[parentIDs[i]];
    var parentEntry = entryMap[parent.id];
    if (parentEntry) {
      parentEntry.runSetters(
        parentNames[parentIDs[i]] || void 0,
        !!parentNames[parentIDs[i]]
      );
    }
  }
};

function createSnapshot(entry, name, newValue) {
  var newSnapshot = Object.create(null);
  var newKeys = [];

  if (name === "*") {
    safeKeys(newValue).forEach(function (keyOfValue) {
      // Evaluating value[key] is risky because the property might be
      // defined by a getter function that logs a deprecation warning (or
      // worse) when evaluated. For example, Node uses this trick to display
      // a deprecation warning whenever crypto.createCredentials is
      // accessed. Fortunately, when value[key] is defined by a getter
      // function, it's enough to check whether the getter function itself
      // has changed, since we are careful elsewhere to preserve getters
      // rather than prematurely evaluating them.
      newKeys.push(keyOfValue);
      newSnapshot[keyOfValue] = normalizeSnapshotValue(
        utils.valueOrGetter(newValue, keyOfValue)
      );
    });
  } else {
    newKeys.push(name);
    newSnapshot[name] = normalizeSnapshotValue(newValue);
  }

  var oldSnapshot = entry.snapshots[name];
  if (
    oldSnapshot &&
    newKeys.every(function (key) {
      return oldSnapshot[key] === newSnapshot[key]
    }) &&
    newKeys.length === Object.keys(oldSnapshot).length
  ) {
    return oldSnapshot;
  }

  return newSnapshot;
}

function normalizeSnapshotValue(value) {
  if (value === void 0) return UNDEFINED;
  if (value !== value && isNaN(value)) return NAN;
  return value;
}

// Obtain an array of keys in entry.setters[name] for which we need to run a
// setter function. If successful, entry.snapshot[name] will be updated and/or
// entry.newSetters[name] will be removed, so the returned keys will not be
// returned again until after the snapshot changes again. If the snapshot hasn't
// changed and there aren't any entry.newSetters[name] keys, this function
// returns undefined, to avoid allocating an empty array in the common case.
function consumeKeysGivenSnapshot(entry, name, snapshot) {
  if (entry.snapshots[name] !== snapshot) {
    entry.snapshots[name] = snapshot;
    // Since the keys of entry.newSetters[name] are a subset of those of
    // entry.setters[name], we can consume entry.newSetters[name] here too.
    delete entry.newSetters[name];
    return Object.keys(entry.setters[name]);
  }

  // If new setters have been added to entry.setters (and thus also to
  // entry.newSetters) since we last recorded entry.snapshots[name], we need to
  // run those setters (for the first time) in order to consider them up-to-date
  // with respect to entry.snapshots[name].
  var news = entry.newSetters[name];
  var newKeys = news && Object.keys(news);
  if (newKeys && newKeys.length) {
    // Consume the new keys so we don't consider them again.
    delete entry.newSetters[name];
    return newKeys;
  }
}

// Invoke the given callback once for every (setter, name, value) that needs to
// be called. Note that forEachSetter does not call any setters itself, only the
// given callback.
function forEachSetter(entry, names, callback) {
  if (names === void 0) {
    names = Object.keys(entry.setters);
  }

  names.forEach(function (name) {
    // Ignore setters asking for module.exports.__esModule.
    if (name === "__esModule") return;

    var settersByKey = entry.setters[name];
    if (!settersByKey) return;

    var getter = entry.getters[name];
    var alreadyCalledConstantGetter =
      typeof getter === "function" &&
      // Sometimes a getter function will throw because it's called
      // before the variable it's supposed to return has been
      // initialized, so we need to know that the getter function has
      // run to completion at least once.
      getter.runCount > 0 &&
      getter.constant;

    var value = getExportByName(entry, name);

    // Although we may have multiple setter functions with different keys in
    // settersByKey, we can compute a snapshot of value and check it against
    // entry.snapshots[name] before iterating over the individual setter
    // functions
    var snapshot = createSnapshot(entry, name, value);

    var keys = consumeKeysGivenSnapshot(entry, name, snapshot);
    if (keys === void 0) return;

    keys.forEach(function (key) {
      var setter = settersByKey[key];
      if (!setter) {
        return;
      }

      // Invoke the setter function with the updated value.
      callback(setter, name, value);

      if (alreadyCalledConstantGetter) {
        // If we happen to know this getter function has run successfully
        // (getter.runCount > 0), and will never return a different value
        // (getter.constant), then we can forget the corresponding setter,
        // because we've already reported that constant value. Note that we
        // can't forget the getter, because we need to remember the original
        // value in case anyone tampers with entry.module.exports[name].
        delete settersByKey[key];
      }
    });
  });
}

function getExportByName(entry, name) {
  if (name === "*") {
    return entry.namespace;
  }

  if (hasOwn.call(entry.namespace, name)) {
    return entry.namespace[name];
  }

  if (entry.module === null) return;
  var exports = entry.module.exports;

  if (name === "default" &&
      ! (utils.getESModule(exports) &&
         "default" in exports)) {
    return exports;
  }

  if (exports == null) {
    return;
  }

  return exports[name];
}

function makeUniqueKey() {
  return Math.random()
    .toString(36)
    // Add an incrementing salt to help track key ordering and also
    // absolutely guarantee we never return the same key twice.
    .replace("0.", ++keySalt + "$");
}

function runGetter(entry, name) {
  var getter = entry.getters[name];
  if (!getter) return GETTER_ERROR;
  try {
    var result = getter();
    ++getter.runCount;
    return result;
  } catch (e) {}
  return GETTER_ERROR;
}

Ep.addAsyncDep = function (childEntry) {
  if (childEntry.status !== 'evaluated') {
    this.pendingAsyncDeps += 1;

    childEntry.allAsyncParents.push(this);
    childEntry.pendingAsyncParents.push(this);
  }

  if (childEntry.evaluationError) {
    this.setEvaluationError(childEntry.evaluationError);
  }
}

Ep.changeStatus = function (status) {
  switch(status) {
    case 'linking':
        this.status = 'linking';
        break;
    case 'evaluating': 
      this.status = 'evaluating';
      this._onEvaluating.forEach(function (callback) {
        callback();
      });
      break;
    case 'evaluated':
      this.status = 'evaluated';

      let toEvaluate = [];
      this.gatherReadyAsyncParents(toEvaluate);

      toEvaluate.sort((entryA, entryB) => {
        return entryA.asyncEvaluationIndex - entryB.asyncEvaluationIndex;
      });

      toEvaluate.forEach(parent => {
        parent.changeStatus('evaluating');
      });

      let callbacks = this._onEvaluated;
      this._onEvaluated = [];
      callbacks.forEach(function (callback) {
        callback();
      });

      break;
    default:
      throw new Error('Unrecognized module status: ' + status);
  }
}

Ep.gatherReadyAsyncParents = function (readyList) {
  this.pendingAsyncParents.forEach(function (parent) {
    // TODO: remove assertions
    if (!parent.asyncEvaluation || parent.pendingAsyncDeps === 0) {
      throw new Error('Unexpected state for running gatherReadyAsyncParents');
    }
    parent.pendingAsyncDeps -= 1;
    if (parent.pendingAsyncDeps === 0) {
      // TODO: Check doesn't have evaluation error
      readyList.push(parent);

      if (!parent.async) {
        parent.gatherReadyAsyncParents(readyList);
      }
    }
  });

  this.pendingAsyncParents = [];
}

Ep.setEvaluationError = function (error) {
  // If multiple deps were running in parallel, there could be
  // multiple errors. Keep the first one.
  if (!this.evaluationError) {
    this.evaluationError = error;
  }

  this.allAsyncParents.forEach(parent => {
    parent.setEvaluationError(error);
  });
}

module.exports = Entry;

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});
meteorInstall({"node_modules":{"meteor-node-stubs":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor-node-stubs/package.json                                                                  //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
module.exports = {
  "name": "meteor-node-stubs",
  "version": "1.2.5",
  "main": "index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"index.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor-node-stubs/index.js                                                                      //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var map = require("./map.json");
var meteorAliases = {};

Object.keys(map).forEach(function (id) {
  if (typeof map[id] === "string") {
    var aliasParts = module.id.split("/");
    aliasParts.pop();
    aliasParts.push("node_modules", map[id]);
    exports[id] = meteorAliases[id + ".js"] = meteorAliases["node:" + id] =
      aliasParts.join("/");
  } else {
    exports[id] = map[id];
    meteorAliases[id + ".js"] = meteorAliases["node:" + id] = function(){};
  }
});

if (typeof meteorInstall === "function") {
  meteorInstall({
    // Install the aliases into a node_modules directory one level up from
    // the root directory, so that they do not clutter the namespace
    // available to apps and packages.
    "..": {
      node_modules: meteorAliases
    }
  });
}

// If Buffer is not defined globally, but the "buffer" built-in stub is
// installed and can be imported, use it to define global.Buffer so that
// modules like core-util-is/lib/util.js can refer to Buffer without
// crashing application startup.
if (typeof global.Buffer !== "function") {
  try {
    // Use (0, require)(...) to avoid registering a dependency on the
    // "buffer" stub, in case it is not otherwise bundled.
    global.Buffer = (0, require)("buffer").Buffer;
  } catch (ok) {
    // Failure to import "buffer" is fine as long as the Buffer global
    // variable is not used.
  }
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"map.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/meteor-node-stubs/map.json                                                                      //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
module.exports = {
  "assert": "assert/",
  "buffer": "buffer/",
  "child_process": null,
  "cluster": null,
  "console": "console-browserify",
  "constants": "constants-browserify",
  "crypto": "../wrappers/crypto.js",
  "dgram": null,
  "dns": null,
  "domain": "domain-browser",
  "events": "events/",
  "fs": null,
  "http": "stream-http",
  "https": "https-browserify",
  "module": "../wrappers/module.js",
  "net": null,
  "os": "os-browserify/browser.js",
  "path": "path-browserify",
  "process": "process/browser.js",
  "punycode": "punycode/",
  "querystring": "querystring-es3/",
  "readline": null,
  "repl": null,
  "stream": "stream-browserify",
  "_stream_duplex": "readable-stream/lib/_stream_duplex.js",
  "_stream_passthrough": "readable-stream/lib/_stream_passthrough.js",
  "_stream_readable": "readable-stream/lib/_stream_readable.js",
  "_stream_transform": "readable-stream/lib/_stream_transform.js",
  "_stream_writable": "readable-stream/lib/_stream_writable.js",
  "string_decoder": "string_decoder/",
  "sys": "util/util.js",
  "timers": "timers-browserify",
  "tls": null,
  "tty": "tty-browserify",
  "url": "url/",
  "util": "util/util.js",
  "vm": "vm-browserify",
  "zlib": "browserify-zlib"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"process":{"package.json":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/process/package.json                                                                            //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
module.exports = {
  "name": "process",
  "version": "0.11.10",
  "browser": "./browser.js",
  "main": "./index.js"
};

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"browser.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/process/browser.js                                                                              //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}},"@babel":{"runtime":{"helpers":{"objectSpread2.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/objectSpread2.js                                                         //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var defineProperty = require("./defineProperty.js");
function ownKeys(e, r) {
  var t = Object.keys(e);
  if (Object.getOwnPropertySymbols) {
    var o = Object.getOwnPropertySymbols(e);
    r && (o = o.filter(function (r) {
      return Object.getOwnPropertyDescriptor(e, r).enumerable;
    })), t.push.apply(t, o);
  }
  return t;
}
function _objectSpread2(e) {
  for (var r = 1; r < arguments.length; r++) {
    var t = null != arguments[r] ? arguments[r] : {};
    r % 2 ? ownKeys(Object(t), !0).forEach(function (r) {
      defineProperty(e, r, t[r]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) {
      Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r));
    });
  }
  return e;
}
module.exports = _objectSpread2, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"defineProperty.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/defineProperty.js                                                        //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var toPropertyKey = require("./toPropertyKey.js");
function _defineProperty(obj, key, value) {
  key = toPropertyKey(key);
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }
  return obj;
}
module.exports = _defineProperty, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"toPropertyKey.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/toPropertyKey.js                                                         //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var _typeof = require("./typeof.js")["default"];
var toPrimitive = require("./toPrimitive.js");
function _toPropertyKey(arg) {
  var key = toPrimitive(arg, "string");
  return _typeof(key) === "symbol" ? key : String(key);
}
module.exports = _toPropertyKey, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"typeof.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/typeof.js                                                                //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
function _typeof(o) {
  "@babel/helpers - typeof";

  return (module.exports = _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) {
    return typeof o;
  } : function (o) {
    return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o;
  }, module.exports.__esModule = true, module.exports["default"] = module.exports), _typeof(o);
}
module.exports = _typeof, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"toPrimitive.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/toPrimitive.js                                                           //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var _typeof = require("./typeof.js")["default"];
function _toPrimitive(input, hint) {
  if (_typeof(input) !== "object" || input === null) return input;
  var prim = input[Symbol.toPrimitive];
  if (prim !== undefined) {
    var res = prim.call(input, hint || "default");
    if (_typeof(res) !== "object") return res;
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  return (hint === "string" ? String : Number)(input);
}
module.exports = _toPrimitive, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"objectWithoutProperties.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/objectWithoutProperties.js                                               //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
var objectWithoutPropertiesLoose = require("./objectWithoutPropertiesLoose.js");
function _objectWithoutProperties(source, excluded) {
  if (source == null) return {};
  var target = objectWithoutPropertiesLoose(source, excluded);
  var key, i;
  if (Object.getOwnPropertySymbols) {
    var sourceSymbolKeys = Object.getOwnPropertySymbols(source);
    for (i = 0; i < sourceSymbolKeys.length; i++) {
      key = sourceSymbolKeys[i];
      if (excluded.indexOf(key) >= 0) continue;
      if (!Object.prototype.propertyIsEnumerable.call(source, key)) continue;
      target[key] = source[key];
    }
  }
  return target;
}
module.exports = _objectWithoutProperties, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"objectWithoutPropertiesLoose.js":function module(require,exports,module){

//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                              //
// node_modules/@babel/runtime/helpers/objectWithoutPropertiesLoose.js                                          //
//                                                                                                              //
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                //
function _objectWithoutPropertiesLoose(source, excluded) {
  if (source == null) return {};
  var target = {};
  var sourceKeys = Object.keys(source);
  var key, i;
  for (i = 0; i < sourceKeys.length; i++) {
    key = sourceKeys[i];
    if (excluded.indexOf(key) >= 0) continue;
    target[key] = source[key];
  }
  return target;
}
module.exports = _objectWithoutPropertiesLoose, module.exports.__esModule = true, module.exports["default"] = module.exports;
//////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}}},{
  "extensions": [
    ".js",
    ".json",
    ".html",
    ".ts"
  ]
});


/* Exports */
return {
  export: function () { return {
      meteorInstall: meteorInstall
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/modules/client.js"
  ],
  mainModulePath: "/node_modules/meteor/modules/client.js"
}});

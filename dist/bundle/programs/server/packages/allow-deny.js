Package["core-runtime"].queue("allow-deny", ["meteor", "ecmascript", "minimongo", "check", "ejson", "ddp", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ddp-client", "ddp-server", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var ECMAScript = Package.ecmascript.ECMAScript;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var check = Package.check.check;
var Match = Package.check.Match;
var EJSON = Package.ejson.EJSON;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var AllowDeny;

var require = meteorInstall({"node_modules":{"meteor":{"allow-deny":{"allow-deny.js":function module(require,exports,module){

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                    //
// packages/allow-deny/allow-deny.js                                                                                  //
//                                                                                                                    //
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                      //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    ///
    /// Remote methods and access control.
    ///

    const hasOwn = Object.prototype.hasOwnProperty;

    // Restrict default mutators on collection. allow() and deny() take the
    // same options:
    //
    // options.insertAsync {Function(userId, doc)}
    //   return true to allow/deny adding this document
    //
    // options.updateAsync {Function(userId, docs, fields, modifier)}
    //   return true to allow/deny updating these documents.
    //   `fields` is passed as an array of fields that are to be modified
    //
    // options.removeAsync {Function(userId, docs)}
    //   return true to allow/deny removing these documents
    //
    // options.fetch {Array}
    //   Fields to fetch for these validators. If any call to allow or deny
    //   does not have this option then all fields are loaded.
    //
    // allow and deny can be called multiple times. The validators are
    // evaluated as follows:
    // - If neither deny() nor allow() has been called on the collection,
    //   then the request is allowed if and only if the "insecure" smart
    //   package is in use.
    // - Otherwise, if any deny() function returns true, the request is denied.
    // - Otherwise, if any allow() function returns true, the request is allowed.
    // - Otherwise, the request is denied.
    //
    // Meteor may call your deny() and allow() functions in any order, and may not
    // call all of them if it is able to make a decision without calling them all
    // (so don't include side effects).

    AllowDeny = {
      CollectionPrototype: {}
    };

    // In the `mongo` package, we will extend Mongo.Collection.prototype with these
    // methods
    const CollectionPrototype = AllowDeny.CollectionPrototype;

    /**
     * @summary Allow users to write directly to this collection from client code, subject to limitations you define.
     * @locus Server
     * @method allow
     * @memberOf Mongo.Collection
     * @instance
     * @param {Object} options
     * @param {Function} options.insertAsync,updateAsync,removeAsync Functions that look at a proposed modification to the database and return true if it should be allowed.
     * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
     * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
     */
    CollectionPrototype.allow = function (options) {
      addValidator(this, 'allow', options);
    };

    /**
     * @summary Override `allow` rules.
     * @locus Server
     * @method deny
     * @memberOf Mongo.Collection
     * @instance
     * @param {Object} options
     * @param {Function} options.insertAsync,updateAsync,removeAsync Functions that look at a proposed modification to the database and return true if it should be denied, even if an [allow](#allow) rule says otherwise.
     * @param {String[]} options.fetch Optional performance enhancement. Limits the fields that will be fetched from the database for inspection by your `update` and `remove` functions.
     * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections).  Pass `null` to disable transformation.
     */
    CollectionPrototype.deny = function (options) {
      addValidator(this, 'deny', options);
    };
    CollectionPrototype._defineMutationMethods = function (options) {
      const self = this;
      options = options || {};

      // set to true once we call any allow or deny methods. If true, use
      // allow/deny semantics. If false, use insecure mode semantics.
      self._restricted = false;

      // Insecure mode (default to allowing writes). Defaults to 'undefined' which
      // means insecure iff the insecure package is loaded. This property can be
      // overriden by tests or packages wishing to change insecure mode behavior of
      // their collections.
      self._insecure = undefined;
      self._validators = {
        insert: {
          allow: [],
          deny: []
        },
        update: {
          allow: [],
          deny: []
        },
        remove: {
          allow: [],
          deny: []
        },
        insertAsync: {
          allow: [],
          deny: []
        },
        updateAsync: {
          allow: [],
          deny: []
        },
        removeAsync: {
          allow: [],
          deny: []
        },
        upsertAsync: {
          allow: [],
          deny: []
        },
        // dummy arrays; can't set these!
        fetch: [],
        fetchAllFields: false
      };
      if (!self._name) return; // anonymous collection

      // XXX Think about method namespacing. Maybe methods should be
      // "Meteor:Mongo:insertAsync/NAME"?
      self._prefix = '/' + self._name + '/';

      // Mutation Methods
      // Minimongo on the server gets no stubs; instead, by default
      // it wait()s until its result is ready, yielding.
      // This matches the behavior of macromongo on the server better.
      // XXX see #MeteorServerNull
      if (self._connection && (self._connection === Meteor.server || Meteor.isClient)) {
        const m = {};
        ['insertAsync', 'updateAsync', 'removeAsync', 'insert', 'update', 'remove'].forEach(method => {
          const methodName = self._prefix + method;
          if (options.useExisting) {
            const handlerPropName = Meteor.isClient ? '_methodHandlers' : 'method_handlers';
            // Do not try to create additional methods if this has already been called.
            // (Otherwise the .methods() call below will throw an error.)
            if (self._connection[handlerPropName] && typeof self._connection[handlerPropName][methodName] === 'function') return;
          }
          const isInsert = name => name.includes('insert');
          m[methodName] = function /* ... */
          () {
            // All the methods do their own validation, instead of using check().
            check(arguments, [Match.Any]);
            const args = Array.from(arguments);
            try {
              // For an insert/insertAsync, if the client didn't specify an _id, generate one
              // now; because this uses DDP.randomStream, it will be consistent with
              // what the client generated. We generate it now rather than later so
              // that if (eg) an allow/deny rule does an insert/insertAsync to the same
              // collection (not that it really should), the generated _id will
              // still be the first use of the stream and will be consistent.
              //
              // However, we don't actually stick the _id onto the document yet,
              // because we want allow/deny rules to be able to differentiate
              // between arbitrary client-specified _id fields and merely
              // client-controlled-via-randomSeed fields.
              let generatedId = null;
              if (isInsert(method) && !hasOwn.call(args[0], '_id')) {
                generatedId = self._makeNewID();
              }
              if (this.isSimulation) {
                // In a client simulation, you can do any mutation (even with a
                // complex selector).
                if (generatedId !== null) {
                  args[0]._id = generatedId;
                }
                return self._collection[method].apply(self._collection, args);
              }

              // This is the server receiving a method call from the client.

              // We don't allow arbitrary selectors in mutations from the client: only
              // single-ID selectors.
              if (!isInsert(method)) throwIfSelectorIsNotId(args[0], method);
              if (self._restricted) {
                // short circuit if there is no way it will pass.
                if (self._validators[method].allow.length === 0) {
                  throw new Meteor.Error(403, 'Access denied. No allow validators set on restricted ' + "collection for method '" + method + "'.");
                }
                const validatedMethodName = '_validated' + method.charAt(0).toUpperCase() + method.slice(1);
                args.unshift(this.userId);
                isInsert(method) && args.push(generatedId);
                return self[validatedMethodName].apply(self, args);
              } else if (self._isInsecure()) {
                if (generatedId !== null) args[0]._id = generatedId;
                // In insecure mode, allow any mutation (with a simple selector).
                // XXX This is kind of bogus.  Instead of blindly passing whatever
                //     we get from the network to this function, we should actually
                //     know the correct arguments for the function and pass just
                //     them.  For example, if you have an extraneous extra null
                //     argument and this is Mongo on the server, the .wrapAsync'd
                //     functions like update will get confused and pass the
                //     "fut.resolver()" in the wrong slot, where _update will never
                //     invoke it. Bam, broken DDP connection.  Probably should just
                //     take this whole method and write it three times, invoking
                //     helpers for the common code.
                return self._collection[method].apply(self._collection, args);
              } else {
                // In secure mode, if we haven't called allow or deny, then nothing
                // is permitted.
                throw new Meteor.Error(403, 'Access denied');
              }
            } catch (e) {
              if (e.name === 'MongoError' ||
              // for old versions of MongoDB (probably not necessary but it's here just in case)
              e.name === 'BulkWriteError' ||
              // for newer versions of MongoDB (https://docs.mongodb.com/drivers/node/current/whats-new/#bulkwriteerror---mongobulkwriteerror)
              e.name === 'MongoBulkWriteError' || e.name === 'MinimongoError') {
                throw new Meteor.Error(409, e.toString());
              } else {
                throw e;
              }
            }
          };
        });
        self._connection.methods(m);
      }
    };
    CollectionPrototype._updateFetch = function (fields) {
      const self = this;
      if (!self._validators.fetchAllFields) {
        if (fields) {
          const union = Object.create(null);
          const add = names => names && names.forEach(name => union[name] = 1);
          add(self._validators.fetch);
          add(fields);
          self._validators.fetch = Object.keys(union);
        } else {
          self._validators.fetchAllFields = true;
          // clear fetch just to make sure we don't accidentally read it
          self._validators.fetch = null;
        }
      }
    };
    CollectionPrototype._isInsecure = function () {
      const self = this;
      if (self._insecure === undefined) return !!Package.insecure;
      return self._insecure;
    };
    CollectionPrototype._validatedInsertAsync = function (userId, doc, generatedId) {
      const self = this;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.insertAsync.deny.some(validator => {
        return validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.

      if (self._validators.insertAsync.allow.every(validator => {
        return !validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // If we generated an ID above, insertAsync it now: after the validation, but
      // before actually inserting.
      if (generatedId !== null) doc._id = generatedId;
      return self._collection.insertAsync.call(self._collection, doc);
    };
    CollectionPrototype._validatedInsert = function (userId, doc, generatedId) {
      const self = this;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.insert.deny.some(validator => {
        return validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.

      if (self._validators.insert.allow.every(validator => {
        return !validator(userId, docToValidate(validator, doc, generatedId));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // If we generated an ID above, insert it now: after the validation, but
      // before actually inserting.
      if (generatedId !== null) doc._id = generatedId;
      return (Meteor.isServer ? self._collection.insertAsync : self._collection.insert).call(self._collection, doc);
    };

    // Simulate a mongo `update` operation while validating that the access
    // control rules set by calls to `allow/deny` are satisfied. If all
    // pass, rewrite the mongo operation to use $in to set the list of
    // document ids to change ##ValidatedChange
    CollectionPrototype._validatedUpdateAsync = async function (userId, selector, mutator, options) {
      const self = this;
      check(mutator, Object);
      options = Object.assign(Object.create(null), options);
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) throw new Error("validated update should be of a single ID");

      // We don't support upserts because they don't fit nicely into allow/deny
      // rules.
      if (options.upsert) throw new Meteor.Error(403, "Access denied. Upserts not " + "allowed in a restricted collection.");
      const noReplaceError = "Access denied. In a restricted collection you can only" + " update documents, not replace them. Use a Mongo update operator, such " + "as '$set'.";
      const mutatorKeys = Object.keys(mutator);

      // compute modified fields
      const modifiedFields = {};
      if (mutatorKeys.length === 0) {
        throw new Meteor.Error(403, noReplaceError);
      }
      mutatorKeys.forEach(op => {
        const params = mutator[op];
        if (op.charAt(0) !== '$') {
          throw new Meteor.Error(403, noReplaceError);
        } else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
          throw new Meteor.Error(403, "Access denied. Operator " + op + " not allowed in a restricted collection.");
        } else {
          Object.keys(params).forEach(field => {
            // treat dotted fields as if they are replacing their
            // top-level part
            if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'));

            // record the field we are trying to change
            modifiedFields[field] = true;
          });
        }
      });
      const fields = Object.keys(modifiedFields);
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = await self._collection.findOneAsync(selector, findOptions);
      if (!doc)
        // none satisfied!
        return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.updateAsync.deny.some(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.updateAsync.allow.every(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return !validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      options._forbidReplace = true;

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to include an _id clause before passing to Mongo to
      // avoid races, but since selector is guaranteed to already just be an ID, we
      // don't have to any more.

      return self._collection.updateAsync.call(self._collection, selector, mutator, options);
    };
    CollectionPrototype._validatedUpdate = function (userId, selector, mutator, options) {
      const self = this;
      check(mutator, Object);
      options = Object.assign(Object.create(null), options);
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) throw new Error("validated update should be of a single ID");

      // We don't support upserts because they don't fit nicely into allow/deny
      // rules.
      if (options.upsert) throw new Meteor.Error(403, "Access denied. Upserts not " + "allowed in a restricted collection.");
      const noReplaceError = "Access denied. In a restricted collection you can only" + " update documents, not replace them. Use a Mongo update operator, such " + "as '$set'.";
      const mutatorKeys = Object.keys(mutator);

      // compute modified fields
      const modifiedFields = {};
      if (mutatorKeys.length === 0) {
        throw new Meteor.Error(403, noReplaceError);
      }
      mutatorKeys.forEach(op => {
        const params = mutator[op];
        if (op.charAt(0) !== '$') {
          throw new Meteor.Error(403, noReplaceError);
        } else if (!hasOwn.call(ALLOWED_UPDATE_OPERATIONS, op)) {
          throw new Meteor.Error(403, "Access denied. Operator " + op + " not allowed in a restricted collection.");
        } else {
          Object.keys(params).forEach(field => {
            // treat dotted fields as if they are replacing their
            // top-level part
            if (field.indexOf('.') !== -1) field = field.substring(0, field.indexOf('.'));

            // record the field we are trying to change
            modifiedFields[field] = true;
          });
        }
      });
      const fields = Object.keys(modifiedFields);
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = self._collection.findOne(selector, findOptions);
      if (!doc)
        // none satisfied!
        return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.update.deny.some(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.update.allow.every(validator => {
        const factoriedDoc = transformDoc(validator, doc);
        return !validator(userId, factoriedDoc, fields, mutator);
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      options._forbidReplace = true;

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to include an _id clause before passing to Mongo to
      // avoid races, but since selector is guaranteed to already just be an ID, we
      // don't have to any more.

      return self._collection.update.call(self._collection, selector, mutator, options);
    };

    // Only allow these operations in validated updates. Specifically
    // whitelist operations, rather than blacklist, so new complex
    // operations that are added aren't automatically allowed. A complex
    // operation is one that does more than just modify its target
    // field. For now this contains all update operations except '$rename'.
    // http://docs.mongodb.org/manual/reference/operators/#update
    const ALLOWED_UPDATE_OPERATIONS = {
      $inc: 1,
      $set: 1,
      $unset: 1,
      $addToSet: 1,
      $pop: 1,
      $pullAll: 1,
      $pull: 1,
      $pushAll: 1,
      $push: 1,
      $bit: 1
    };

    // Simulate a mongo `remove` operation while validating access control
    // rules. See #ValidatedChange
    CollectionPrototype._validatedRemoveAsync = async function (userId, selector) {
      const self = this;
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = await self._collection.findOneAsync(selector, findOptions);
      if (!doc) return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.removeAsync.deny.some(validator => {
        return validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.removeAsync.allow.every(validator => {
        return !validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to
      // Mongo to avoid races, but since selector is guaranteed to already just be
      // an ID, we don't have to any more.

      return self._collection.removeAsync.call(self._collection, selector);
    };
    CollectionPrototype._validatedRemove = function (userId, selector) {
      const self = this;
      const findOptions = {
        transform: null
      };
      if (!self._validators.fetchAllFields) {
        findOptions.fields = {};
        self._validators.fetch.forEach(fieldName => {
          findOptions.fields[fieldName] = 1;
        });
      }
      const doc = self._collection.findOne(selector, findOptions);
      if (!doc) return 0;

      // call user validators.
      // Any deny returns true means denied.
      if (self._validators.remove.deny.some(validator => {
        return validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }
      // Any allow returns true means proceed. Throw error if they all fail.
      if (self._validators.remove.allow.every(validator => {
        return !validator(userId, transformDoc(validator, doc));
      })) {
        throw new Meteor.Error(403, "Access denied");
      }

      // Back when we supported arbitrary client-provided selectors, we actually
      // rewrote the selector to {_id: {$in: [ids that we found]}} before passing to
      // Mongo to avoid races, but since selector is guaranteed to already just be
      // an ID, we don't have to any more.

      return self._collection.remove.call(self._collection, selector);
    };
    CollectionPrototype._callMutatorMethodAsync = async function _callMutatorMethodAsync(name, args) {
      let options = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};
      // For two out of three mutator methods, the first argument is a selector
      const firstArgIsSelector = name === "updateAsync" || name === "removeAsync";
      if (firstArgIsSelector && !alreadyInSimulation()) {
        // If we're about to actually send an RPC, we should throw an error if
        // this is a non-ID selector, because the mutation methods only allow
        // single-ID selectors. (If we don't throw here, we'll see flicker.)
        throwIfSelectorIsNotId(args[0], name);
      }
      const mutatorMethodName = this._prefix + name;
      return this._connection.applyAsync(mutatorMethodName, args, _objectSpread({
        returnStubValue: true,
        returnServerResultPromise: true
      }, options));
    };
    CollectionPrototype._callMutatorMethod = function _callMutatorMethod(name, args, callback) {
      if (Meteor.isClient && !callback && !alreadyInSimulation()) {
        // Client can't block, so it can't report errors by exception,
        // only by callback. If they forget the callback, give them a
        // default one that logs the error, so they aren't totally
        // baffled if their writes don't work because their database is
        // down.
        // Don't give a default callback in simulation, because inside stubs we
        // want to return the results from the local collection immediately and
        // not force a callback.
        callback = function (err) {
          if (err) Meteor._debug(name + " failed", err);
        };
      }

      // For two out of three mutator methods, the first argument is a selector
      const firstArgIsSelector = name === "update" || name === "remove";
      if (firstArgIsSelector && !alreadyInSimulation()) {
        // If we're about to actually send an RPC, we should throw an error if
        // this is a non-ID selector, because the mutation methods only allow
        // single-ID selectors. (If we don't throw here, we'll see flicker.)
        throwIfSelectorIsNotId(args[0], name);
      }
      const mutatorMethodName = this._prefix + name;
      return this._connection.apply(mutatorMethodName, args, {
        returnStubValue: true
      }, callback);
    };
    function transformDoc(validator, doc) {
      if (validator.transform) return validator.transform(doc);
      return doc;
    }
    function docToValidate(validator, doc, generatedId) {
      let ret = doc;
      if (validator.transform) {
        ret = EJSON.clone(doc);
        // If you set a server-side transform on your collection, then you don't get
        // to tell the difference between "client specified the ID" and "server
        // generated the ID", because transforms expect to get _id.  If you want to
        // do that check, you can do it with a specific
        // `C.allow({insertAsync: f, transform: null})` validator.
        if (generatedId !== null) {
          ret._id = generatedId;
        }
        ret = validator.transform(ret);
      }
      return ret;
    }
    function addValidator(collection, allowOrDeny, options) {
      // validate keys
      const validKeysRegEx = /^(?:insertAsync|updateAsync|removeAsync|insert|update|remove|fetch|transform)$/;
      Object.keys(options).forEach(key => {
        if (!validKeysRegEx.test(key)) throw new Error(allowOrDeny + ": Invalid key: " + key);
      });
      collection._restricted = true;
      ['insertAsync', 'updateAsync', 'removeAsync', 'insert', 'update', 'remove'].forEach(name => {
        if (hasOwn.call(options, name)) {
          if (!(options[name] instanceof Function)) {
            throw new Error(allowOrDeny + ': Value for `' + name + '` must be a function');
          }

          // If the transform is specified at all (including as 'null') in this
          // call, then take that; otherwise, take the transform from the
          // collection.
          if (options.transform === undefined) {
            options[name].transform = collection._transform; // already wrapped
          } else {
            options[name].transform = LocalCollection.wrapTransform(options.transform);
          }
          collection._validators[name][allowOrDeny].push(options[name]);
        }
      });

      // Only updateAsync the fetch fields if we're passed things that affect
      // fetching. This way allow({}) and allow({insertAsync: f}) don't result in
      // setting fetchAllFields
      if (options.updateAsync || options.removeAsync || options.fetch) {
        if (options.fetch && !(options.fetch instanceof Array)) {
          throw new Error(allowOrDeny + ": Value for `fetch` must be an array");
        }
        collection._updateFetch(options.fetch);
      }
    }
    function throwIfSelectorIsNotId(selector, methodName) {
      if (!LocalCollection._selectorIsIdPerhapsAsObject(selector)) {
        throw new Meteor.Error(403, "Not permitted. Untrusted code may only " + methodName + " documents by ID.");
      }
    }
    ;

    // Determine if we are in a DDP method simulation
    function alreadyInSimulation() {
      var CurrentInvocation = DDP._CurrentMethodInvocation ||
      // For backwards compatibility, as explained in this issue:
      // https://github.com/meteor/meteor/issues/8947
      DDP._CurrentInvocation;
      const enclosing = CurrentInvocation.get();
      return enclosing && enclosing.isSimulation;
    }
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      AllowDeny: AllowDeny
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/allow-deny/allow-deny.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/allow-deny.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvYWxsb3ctZGVueS9hbGxvdy1kZW55LmpzIl0sIm5hbWVzIjpbIl9vYmplY3RTcHJlYWQiLCJtb2R1bGUiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJfX3JlaWZ5V2FpdEZvckRlcHNfXyIsImhhc093biIsIk9iamVjdCIsInByb3RvdHlwZSIsImhhc093blByb3BlcnR5IiwiQWxsb3dEZW55IiwiQ29sbGVjdGlvblByb3RvdHlwZSIsImFsbG93Iiwib3B0aW9ucyIsImFkZFZhbGlkYXRvciIsImRlbnkiLCJfZGVmaW5lTXV0YXRpb25NZXRob2RzIiwic2VsZiIsIl9yZXN0cmljdGVkIiwiX2luc2VjdXJlIiwidW5kZWZpbmVkIiwiX3ZhbGlkYXRvcnMiLCJpbnNlcnQiLCJ1cGRhdGUiLCJyZW1vdmUiLCJpbnNlcnRBc3luYyIsInVwZGF0ZUFzeW5jIiwicmVtb3ZlQXN5bmMiLCJ1cHNlcnRBc3luYyIsImZldGNoIiwiZmV0Y2hBbGxGaWVsZHMiLCJfbmFtZSIsIl9wcmVmaXgiLCJfY29ubmVjdGlvbiIsIk1ldGVvciIsInNlcnZlciIsImlzQ2xpZW50IiwibSIsImZvckVhY2giLCJtZXRob2QiLCJtZXRob2ROYW1lIiwidXNlRXhpc3RpbmciLCJoYW5kbGVyUHJvcE5hbWUiLCJpc0luc2VydCIsIm5hbWUiLCJpbmNsdWRlcyIsImNoZWNrIiwiYXJndW1lbnRzIiwiTWF0Y2giLCJBbnkiLCJhcmdzIiwiQXJyYXkiLCJmcm9tIiwiZ2VuZXJhdGVkSWQiLCJjYWxsIiwiX21ha2VOZXdJRCIsImlzU2ltdWxhdGlvbiIsIl9pZCIsIl9jb2xsZWN0aW9uIiwiYXBwbHkiLCJ0aHJvd0lmU2VsZWN0b3JJc05vdElkIiwibGVuZ3RoIiwiRXJyb3IiLCJ2YWxpZGF0ZWRNZXRob2ROYW1lIiwiY2hhckF0IiwidG9VcHBlckNhc2UiLCJzbGljZSIsInVuc2hpZnQiLCJ1c2VySWQiLCJwdXNoIiwiX2lzSW5zZWN1cmUiLCJlIiwidG9TdHJpbmciLCJtZXRob2RzIiwiX3VwZGF0ZUZldGNoIiwiZmllbGRzIiwidW5pb24iLCJjcmVhdGUiLCJhZGQiLCJuYW1lcyIsImtleXMiLCJQYWNrYWdlIiwiaW5zZWN1cmUiLCJfdmFsaWRhdGVkSW5zZXJ0QXN5bmMiLCJkb2MiLCJzb21lIiwidmFsaWRhdG9yIiwiZG9jVG9WYWxpZGF0ZSIsImV2ZXJ5IiwiX3ZhbGlkYXRlZEluc2VydCIsImlzU2VydmVyIiwiX3ZhbGlkYXRlZFVwZGF0ZUFzeW5jIiwic2VsZWN0b3IiLCJtdXRhdG9yIiwiYXNzaWduIiwiTG9jYWxDb2xsZWN0aW9uIiwiX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdCIsInVwc2VydCIsIm5vUmVwbGFjZUVycm9yIiwibXV0YXRvcktleXMiLCJtb2RpZmllZEZpZWxkcyIsIm9wIiwicGFyYW1zIiwiQUxMT1dFRF9VUERBVEVfT1BFUkFUSU9OUyIsImZpZWxkIiwiaW5kZXhPZiIsInN1YnN0cmluZyIsImZpbmRPcHRpb25zIiwidHJhbnNmb3JtIiwiZmllbGROYW1lIiwiZmluZE9uZUFzeW5jIiwiZmFjdG9yaWVkRG9jIiwidHJhbnNmb3JtRG9jIiwiX2ZvcmJpZFJlcGxhY2UiLCJfdmFsaWRhdGVkVXBkYXRlIiwiZmluZE9uZSIsIiRpbmMiLCIkc2V0IiwiJHVuc2V0IiwiJGFkZFRvU2V0IiwiJHBvcCIsIiRwdWxsQWxsIiwiJHB1bGwiLCIkcHVzaEFsbCIsIiRwdXNoIiwiJGJpdCIsIl92YWxpZGF0ZWRSZW1vdmVBc3luYyIsIl92YWxpZGF0ZWRSZW1vdmUiLCJfY2FsbE11dGF0b3JNZXRob2RBc3luYyIsImZpcnN0QXJnSXNTZWxlY3RvciIsImFscmVhZHlJblNpbXVsYXRpb24iLCJtdXRhdG9yTWV0aG9kTmFtZSIsImFwcGx5QXN5bmMiLCJyZXR1cm5TdHViVmFsdWUiLCJyZXR1cm5TZXJ2ZXJSZXN1bHRQcm9taXNlIiwiX2NhbGxNdXRhdG9yTWV0aG9kIiwiY2FsbGJhY2siLCJlcnIiLCJfZGVidWciLCJyZXQiLCJFSlNPTiIsImNsb25lIiwiY29sbGVjdGlvbiIsImFsbG93T3JEZW55IiwidmFsaWRLZXlzUmVnRXgiLCJrZXkiLCJ0ZXN0IiwiRnVuY3Rpb24iLCJfdHJhbnNmb3JtIiwid3JhcFRyYW5zZm9ybSIsIkN1cnJlbnRJbnZvY2F0aW9uIiwiRERQIiwiX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIiwiX0N1cnJlbnRJbnZvY2F0aW9uIiwiZW5jbG9zaW5nIiwiZ2V0IiwiX19yZWlmeV9hc3luY19yZXN1bHRfXyIsIl9yZWlmeUVycm9yIiwiYXN5bmMiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUlBLGFBQWE7SUFBQ0MsTUFBTSxDQUFDQyxJQUFJLENBQUMsc0NBQXNDLEVBQUM7TUFBQ0MsT0FBT0EsQ0FBQ0MsQ0FBQyxFQUFDO1FBQUNKLGFBQWEsR0FBQ0ksQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlDLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDLE1BQU1BLG9CQUFvQixDQUFDLENBQUMsRUFBRSxDQUFDO0lBQWxLO0lBQ0E7SUFDQTs7SUFFQSxNQUFNQyxNQUFNLEdBQUdDLE1BQU0sQ0FBQ0MsU0FBUyxDQUFDQyxjQUFjOztJQUU5QztJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtJQUNBOztJQUVBQyxTQUFTLEdBQUc7TUFDVkMsbUJBQW1CLEVBQUUsQ0FBQztJQUN4QixDQUFDOztJQUVEO0lBQ0E7SUFDQSxNQUFNQSxtQkFBbUIsR0FBR0QsU0FBUyxDQUFDQyxtQkFBbUI7O0lBRXpEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7SUFDQUEsbUJBQW1CLENBQUNDLEtBQUssR0FB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O1VBQ3RELE1BQU0sSUFBSVcsS0FBSyxDQUFDaUYsV0FBVyxHQUFHLHNDQUFzQyxDQUFDO1FBQ3ZFO1FBQ0FELFVBQVUsQ0FBQ3BFLFlBQVksQ0FBQzdELE9BQU8sQ0FBQ2dCLEtBQUssQ0FBQztNQUN4QztJQUNGO0lBRUEsU0FBUytCLHNCQUFzQkEsQ0FBQ2dDLFFBQVEsRUFBRXBELFVBQVUsRUFBRTtNQUNwRCxJQUFJLENBQUN1RCxlQUFlLENBQUNDLDRCQUE0QixDQUFDSixRQUFRLENBQUMsRUFBRTtRQUMzRCxNQUFNLElBQUkxRCxNQUFNLENBQUM0QixLQUFLLENBQ3BCLEdBQUcsRUFBRSx5Q0FBeUMsR0FBR3RCLFVBQVUsR0FDekQsbUJBQW1CLENBQUM7TUFDMUI7SUFDRjtJQUFDOztJQUVEO0lBQ0EsU0FBUzBGLG1CQUFtQkEsQ0FBQSxFQUFHO01BQzdCLElBQUlvQixpQkFBaUIsR0FDbkJDLEdBQUcsQ0FBQ0Msd0JBQXdCO01BQzVCO01BQ0E7TUFDQUQsR0FBRyxDQUFDRSxrQkFBa0I7TUFFeEIsTUFBTUMsU0FBUyxHQUFHSixpQkFBaUIsQ0FBQ0ssR0FBRyxDQUFDLENBQUM7TUFDekMsT0FBT0QsU0FBUyxJQUFJQSxTQUFTLENBQUNsRyxZQUFZO0lBQzVDO0lBQUNvRyxzQkFBQTtFQUFBLFNBQUFDLFdBQUE7SUFBQSxPQUFBRCxzQkFBQSxDQUFBQyxXQUFBO0VBQUE7RUFBQUQsc0JBQUE7QUFBQTtFQUFBM0ksSUFBQTtFQUFBNkksS0FBQTtBQUFBLEciLCJmaWxlIjoiL3BhY2thZ2VzL2FsbG93LWRlbnkuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvLy9cbi8vLyBSZW1vdGUgbWV0aG9kcyBhbmQgYWNjZXNzIGNvbnRyb2wuXG4vLy9cblxuY29uc3QgaGFzT3duID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcblxuLy8gUmVzdHJpY3QgZGVmYXVsdCBtdXRhdG9ycyBvbiBjb2xsZWN0aW9uLiBhbGxvdygpIGFuZCBkZW55KCkgdGFrZSB0aGVcbi8vIHNhbWUgb3B0aW9uczpcbi8vXG4vLyBvcHRpb25zLmluc2VydEFzeW5jIHtGdW5jdGlvbih1c2VySWQsIGRvYyl9XG4vLyAgIHJldHVybiB0cnVlIHRvIGFsbG93L2RlbnkgYWRkaW5nIHRoaXMgZG9jdW1lbnRcbi8vXG4vLyBvcHRpb25zLnVwZGF0ZUFzeW5jIHtGdW5jdGlvbih1c2VySWQsIGRvY3MsIGZpZWxkcywgbW9kaWZpZXIpfVxuLy8gICByZXR1cm4gdHJ1ZSB0byBhbGxvdy9kZW55IHVwZGF0aW5nIHRoZXNlIGRvY3VtZW50cy5cbi8vICAgYGZpZWxkc2AgaXMgcGFzc2VkIGFzIGFuIGFycmF5IG9mIGZpZWxkcyB0aGF0IGFyZSB0byBiZSBtb2RpZmllZFxuLy9cbi8vIG9wdGlvbnMucmVtb3ZlQXN5bmMge0Z1bmN0aW9uKHVzZXJJZCwgZG9jcyl9XG4vLyAgIHJldHVybiB0cnVlIHRvIGFsbG93L2RlbnkgcmVtb3ZpbmcgdGhlc2UgZG9jdW1lbnRzXG4vL1xuLy8gb3B0aW9ucy5mZXRjaCB7QXJyYXl9XG4vLyAgIEZpZWxkcyB0byBmZXRjaCBmb3IgdGhlc2UgdmFsaWRhdG9ycy4gSWYgYW55IGNhbGwgdG8gYWxsb3cgb3IgZGVueVxuLy8gICBkb2VzIG5vdCBoYXZlIHRoaXMgb3B0aW9uIHRoZW4gYWxsIGZpZWxkcyBhcmUgbG9hZGVkLlxuLy9cbi8vIGFsbG93IGFuZCBkZW55IGNhbiBiZSBjYWxsZWQgbXVsdGlwbGUgdGltZXMuIFRoZSB2YWxpZGF0b3JzIGFyZVxuLy8gZXZhbHVhdGVkIGFzIGZvbGxvd3M6XG4vLyAtIElmIG5laXRoZXIgZGVueSgpIG5vciBhbGxvdygpIGhhcyBiZWVuIGNhbGxlZCBvbiB0aGUgY29sbGVjdGlvbixcbi8vICAgdGhlbiB0aGUgcmVxdWVzdCBpcyBhbGxvd2VkIGlmIGFuZCBvbmx5IGlmIHRoZSBcImluc2VjdXJlXCIgc21hcnRcbi8vICAgcGFja2FnZSBpcyBpbiB1c2UuXG4vLyAtIE90aGVyd2lzZSwgaWYgYW55IGRlbnkoKSBmdW5jdGlvbiByZXR1cm5zIHRydWUsIHRoZSByZXF1ZXN0IGlzIGRlbmllZC5cbi8vIC0gT3RoZXJ3aXNlLCBpZiBhbnkgYWxsb3coKSBmdW5jdGlvbiByZXR1cm5zIHRydWUsIHRoZSByZXF1ZXN0IGlzIGFsbG93ZWQuXG4vLyAtIE90aGVyd2lzZSwgdGhlIHJlcXVlc3QgaXMgZGVuaWVkLlxuLy9cbi8vIE1ldGVvciBtYXkgY2FsbCB5b3VyIGRlbnkoKSBhbmQgYWxsb3coKSBmdW5jdGlvbnMgaW4gYW55IG9yZGVyLCBhbmQgbWF5IG5vdFxuLy8gY2FsbCBhbGwgb2YgdGhlbSBpZiBpdCBpcyBhYmxlIHRvIG1ha2UgYSBkZWNpc2lvbiB3aXRob3V0IGNhbGxpbmcgdGhlbSBhbGxcbi8vIChzbyBkb24ndCBpbmNsdWRlIHNpZGUgZWZmZWN0cykuXG5cbkFsbG93RGVueSA9IHtcbiAgQ29sbGVjdGlvblByb3RvdHlwZToge31cbn07XG5cbi8vIEluIHRoZSBgbW9uZ29gIHBhY2thZ2UsIHdlIHdpbGwgZXh0ZW5kIE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlIHdpdGggdGhlc2Vcbi8vIG1ldGhvZHNcbmNvbnN0IENvbGxlY3Rpb25Qcm90b3R5cGUgPSBBbGxvd0RlbnkuQ29sbGVjdGlvblByb3RvdHlwZTtcblxuLyoqXG4gKiBAc3VtbWFyeSBBbGxvdyB1c2VycyB0byB3cml0ZSBkaXJlY3RseSB0byB0aGlzIGNvbGxlY3Rpb24gZnJvbSBjbGllbnQgY29kZSwgc3ViamVjdCB0byBsaW1pdGF0aW9ucyB5b3UgZGVmaW5lLlxuICogQGxvY3VzIFNlcnZlclxuICogQG1ldGhvZCBhbGxvd1xuICogQG1lbWJlck9mIE1vbmdvLkNvbGxlY3Rpb25cbiAqIEBpbnN0YW5jZVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMuaW5zZXJ0QXN5bmMsdXBkYXRlQXN5bmMscmVtb3ZlQXN5bmMgRnVuY3Rpb25zIHRoYXQgbG9vayBhdCBhIHByb3Bvc2VkIG1vZGlmaWNhdGlvbiB0byB0aGUgZGF0YWJhc2UgYW5kIHJldHVybiB0cnVlIGlmIGl0IHNob3VsZCBiZSBhbGxvd2VkLlxuICogQHBhcmFtIHtTdHJpbmdbXX0gb3B0aW9ucy5mZXRjaCBPcHRpb25hbCBwZXJmb3JtYW5jZSBlbmhhbmNlbWVudC4gTGltaXRzIHRoZSBmaWVsZHMgdGhhdCB3aWxsIGJlIGZldGNoZWQgZnJvbSB0aGUgZGF0YWJhc2UgZm9yIGluc3BlY3Rpb24gYnkgeW91ciBgdXBkYXRlYCBhbmQgYHJlbW92ZWAgZnVuY3Rpb25zLlxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSAgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKS4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gKi9cbkNvbGxlY3Rpb25Qcm90b3R5cGUuYWxsb3cgPSBmdW5jdGlvbihvcHRpb25zKSB7XG4gIGFkZFZhbGlkYXRvcih0aGlzLCAnYWxsb3cnLCBvcHRpb25zKTtcbn07XG5cbi8qKlxuICogQHN1bW1hcnkgT3ZlcnJpZGUgYGFsbG93YCBydWxlcy5cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBtZXRob2QgZGVueVxuICogQG1lbWJlck9mIE1vbmdvLkNvbGxlY3Rpb25cbiAqIEBpbnN0YW5jZVxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMuaW5zZXJ0QXN5bmMsdXBkYXRlQXN5bmMscmVtb3ZlQXN5bmMgRnVuY3Rpb25zIHRoYXQgbG9vayBhdCBhIHByb3Bvc2VkIG1vZGlmaWNhdGlvbiB0byB0aGUgZGF0YWJhc2UgYW5kIHJldHVybiB0cnVlIGlmIGl0IHNob3VsZCBiZSBkZW5pZWQsIGV2ZW4gaWYgYW4gW2FsbG93XSgjYWxsb3cpIHJ1bGUgc2F5cyBvdGhlcndpc2UuXG4gKiBAcGFyYW0ge1N0cmluZ1tdfSBvcHRpb25zLmZldGNoIE9wdGlvbmFsIHBlcmZvcm1hbmNlIGVuaGFuY2VtZW50LiBMaW1pdHMgdGhlIGZpZWxkcyB0aGF0IHdpbGwgYmUgZmV0Y2hlZCBmcm9tIHRoZSBkYXRhYmFzZSBmb3IgaW5zcGVjdGlvbiBieSB5b3VyIGB1cGRhdGVgIGFuZCBgcmVtb3ZlYCBmdW5jdGlvbnMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlICBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpLiAgUGFzcyBgbnVsbGAgdG8gZGlzYWJsZSB0cmFuc2Zvcm1hdGlvbi5cbiAqL1xuQ29sbGVjdGlvblByb3RvdHlwZS5kZW55ID0gZnVuY3Rpb24ob3B0aW9ucykge1xuICBhZGRWYWxpZGF0b3IodGhpcywgJ2RlbnknLCBvcHRpb25zKTtcbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX2RlZmluZU11dGF0aW9uTWV0aG9kcyA9IGZ1bmN0aW9uKG9wdGlvbnMpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gIC8vIHNldCB0byB0cnVlIG9uY2Ugd2UgY2FsbCBhbnkgYWxsb3cgb3IgZGVueSBtZXRob2RzLiBJZiB0cnVlLCB1c2VcbiAgLy8gYWxsb3cvZGVueSBzZW1hbnRpY3MuIElmIGZhbHNlLCB1c2UgaW5zZWN1cmUgbW9kZSBzZW1hbnRpY3MuXG4gIHNlbGYuX3Jlc3RyaWN0ZWQgPSBmYWxzZTtcblxuICAvLyBJbnNlY3VyZSBtb2RlIChkZWZhdWx0IHRvIGFsbG93aW5nIHdyaXRlcykuIERlZmF1bHRzIHRvICd1bmRlZmluZWQnIHdoaWNoXG4gIC8vIG1lYW5zIGluc2VjdXJlIGlmZiB0aGUgaW5zZWN1cmUgcGFja2FnZSBpcyBsb2FkZWQuIFRoaXMgcHJvcGVydHkgY2FuIGJlXG4gIC8vIG92ZXJyaWRlbiBieSB0ZXN0cyBvciBwYWNrYWdlcyB3aXNoaW5nIHRvIGNoYW5nZSBpbnNlY3VyZSBtb2RlIGJlaGF2aW9yIG9mXG4gIC8vIHRoZWlyIGNvbGxlY3Rpb25zLlxuICBzZWxmLl9pbnNlY3VyZSA9IHVuZGVmaW5lZDtcblxuICBzZWxmLl92YWxpZGF0b3JzID0ge1xuICAgIGluc2VydDoge2FsbG93OiBbXSwgZGVueTogW119LFxuICAgIHVwZGF0ZToge2FsbG93OiBbXSwgZGVueTogW119LFxuICAgIHJlbW92ZToge2FsbG93OiBbXSwgZGVueTogW119LFxuICAgIGluc2VydEFzeW5jOiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sXG4gICAgdXBkYXRlQXN5bmM6IHthbGxvdzogW10sIGRlbnk6IFtdfSxcbiAgICByZW1vdmVBc3luYzoge2FsbG93OiBbXSwgZGVueTogW119LFxuICAgIHVwc2VydEFzeW5jOiB7YWxsb3c6IFtdLCBkZW55OiBbXX0sIC8vIGR1bW15IGFycmF5czsgY2FuJ3Qgc2V0IHRoZXNlIVxuICAgIGZldGNoOiBbXSxcbiAgICBmZXRjaEFsbEZpZWxkczogZmFsc2VcbiAgfTtcblxuICBpZiAoIXNlbGYuX25hbWUpXG4gICAgcmV0dXJuOyAvLyBhbm9ueW1vdXMgY29sbGVjdGlvblxuXG4gIC8vIFhYWCBUaGluayBhYm91dCBtZXRob2QgbmFtZXNwYWNpbmcuIE1heWJlIG1ldGhvZHMgc2hvdWxkIGJlXG4gIC8vIFwiTWV0ZW9yOk1vbmdvOmluc2VydEFzeW5jL05BTUVcIj9cbiAgc2VsZi5fcHJlZml4ID0gJy8nICsgc2VsZi5fbmFtZSArICcvJztcblxuICAvLyBNdXRhdGlvbiBNZXRob2RzXG4gIC8vIE1pbmltb25nbyBvbiB0aGUgc2VydmVyIGdldHMgbm8gc3R1YnM7IGluc3RlYWQsIGJ5IGRlZmF1bHRcbiAgLy8gaXQgd2FpdCgpcyB1bnRpbCBpdHMgcmVzdWx0IGlzIHJlYWR5LCB5aWVsZGluZy5cbiAgLy8gVGhpcyBtYXRjaGVzIHRoZSBiZWhhdmlvciBvZiBtYWNyb21vbmdvIG9uIHRoZSBzZXJ2ZXIgYmV0dGVyLlxuICAvLyBYWFggc2VlICNNZXRlb3JTZXJ2ZXJOdWxsXG4gIGlmIChzZWxmLl9jb25uZWN0aW9uICYmIChzZWxmLl9jb25uZWN0aW9uID09PSBNZXRlb3Iuc2VydmVyIHx8IE1ldGVvci5pc0NsaWVudCkpIHtcbiAgICBjb25zdCBtID0ge307XG5cbiAgICBbXG4gICAgICAnaW5zZXJ0QXN5bmMnLFxuICAgICAgJ3VwZGF0ZUFzeW5jJyxcbiAgICAgICdyZW1vdmVBc3luYycsXG4gICAgICAnaW5zZXJ0JyxcbiAgICAgICd1cGRhdGUnLFxuICAgICAgJ3JlbW92ZScsXG4gICAgXS5mb3JFYWNoKG1ldGhvZCA9PiB7XG4gICAgICBjb25zdCBtZXRob2ROYW1lID0gc2VsZi5fcHJlZml4ICsgbWV0aG9kO1xuXG4gICAgICBpZiAob3B0aW9ucy51c2VFeGlzdGluZykge1xuICAgICAgICBjb25zdCBoYW5kbGVyUHJvcE5hbWUgPSBNZXRlb3IuaXNDbGllbnRcbiAgICAgICAgICA/ICdfbWV0aG9kSGFuZGxlcnMnXG4gICAgICAgICAgOiAnbWV0aG9kX2hhbmRsZXJzJztcbiAgICAgICAgLy8gRG8gbm90IHRyeSB0byBjcmVhdGUgYWRkaXRpb25hbCBtZXRob2RzIGlmIHRoaXMgaGFzIGFscmVhZHkgYmVlbiBjYWxsZWQuXG4gICAgICAgIC8vIChPdGhlcndpc2UgdGhlIC5tZXRob2RzKCkgY2FsbCBiZWxvdyB3aWxsIHRocm93IGFuIGVycm9yLilcbiAgICAgICAgaWYgKFxuICAgICAgICAgIHNlbGYuX2Nvbm5lY3Rpb25baGFuZGxlclByb3BOYW1lXSAmJlxuICAgICAgICAgIHR5cGVvZiBzZWxmLl9jb25uZWN0aW9uW2hhbmRsZXJQcm9wTmFtZV1bbWV0aG9kTmFtZV0gPT09ICdmdW5jdGlvbidcbiAgICAgICAgKVxuICAgICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgaXNJbnNlcnQgPSBuYW1lID0+IG5hbWUuaW5jbHVkZXMoJ2luc2VydCcpO1xuXG4gICAgICBtW21ldGhvZE5hbWVdID0gZnVuY3Rpb24gKC8qIC4uLiAqLykge1xuICAgICAgICAvLyBBbGwgdGhlIG1ldGhvZHMgZG8gdGhlaXIgb3duIHZhbGlkYXRpb24sIGluc3RlYWQgb2YgdXNpbmcgY2hlY2soKS5cbiAgICAgICAgY2hlY2soYXJndW1lbnRzLCBbTWF0Y2guQW55XSk7XG4gICAgICAgIGNvbnN0IGFyZ3MgPSBBcnJheS5mcm9tKGFyZ3VtZW50cyk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgLy8gRm9yIGFuIGluc2VydC9pbnNlcnRBc3luYywgaWYgdGhlIGNsaWVudCBkaWRuJ3Qgc3BlY2lmeSBhbiBfaWQsIGdlbmVyYXRlIG9uZVxuICAgICAgICAgIC8vIG5vdzsgYmVjYXVzZSB0aGlzIHVzZXMgRERQLnJhbmRvbVN0cmVhbSwgaXQgd2lsbCBiZSBjb25zaXN0ZW50IHdpdGhcbiAgICAgICAgICAvLyB3aGF0IHRoZSBjbGllbnQgZ2VuZXJhdGVkLiBXZSBnZW5lcmF0ZSBpdCBub3cgcmF0aGVyIHRoYW4gbGF0ZXIgc29cbiAgICAgICAgICAvLyB0aGF0IGlmIChlZykgYW4gYWxsb3cvZGVueSBydWxlIGRvZXMgYW4gaW5zZXJ0L2luc2VydEFzeW5jIHRvIHRoZSBzYW1lXG4gICAgICAgICAgLy8gY29sbGVjdGlvbiAobm90IHRoYXQgaXQgcmVhbGx5IHNob3VsZCksIHRoZSBnZW5lcmF0ZWQgX2lkIHdpbGxcbiAgICAgICAgICAvLyBzdGlsbCBiZSB0aGUgZmlyc3QgdXNlIG9mIHRoZSBzdHJlYW0gYW5kIHdpbGwgYmUgY29uc2lzdGVudC5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIEhvd2V2ZXIsIHdlIGRvbid0IGFjdHVhbGx5IHN0aWNrIHRoZSBfaWQgb250byB0aGUgZG9jdW1lbnQgeWV0LFxuICAgICAgICAgIC8vIGJlY2F1c2Ugd2Ugd2FudCBhbGxvdy9kZW55IHJ1bGVzIHRvIGJlIGFibGUgdG8gZGlmZmVyZW50aWF0ZVxuICAgICAgICAgIC8vIGJldHdlZW4gYXJiaXRyYXJ5IGNsaWVudC1zcGVjaWZpZWQgX2lkIGZpZWxkcyBhbmQgbWVyZWx5XG4gICAgICAgICAgLy8gY2xpZW50LWNvbnRyb2xsZWQtdmlhLXJhbmRvbVNlZWQgZmllbGRzLlxuICAgICAgICAgIGxldCBnZW5lcmF0ZWRJZCA9IG51bGw7XG4gICAgICAgICAgaWYgKGlzSW5zZXJ0KG1ldGhvZCkgJiYgIWhhc093bi5jYWxsKGFyZ3NbMF0sICdfaWQnKSkge1xuICAgICAgICAgICAgZ2VuZXJhdGVkSWQgPSBzZWxmLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBpZiAodGhpcy5pc1NpbXVsYXRpb24pIHtcbiAgICAgICAgICAgIC8vIEluIGEgY2xpZW50IHNpbXVsYXRpb24sIHlvdSBjYW4gZG8gYW55IG11dGF0aW9uIChldmVuIHdpdGggYVxuICAgICAgICAgICAgLy8gY29tcGxleCBzZWxlY3RvcikuXG4gICAgICAgICAgICBpZiAoZ2VuZXJhdGVkSWQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgYXJnc1swXS5faWQgPSBnZW5lcmF0ZWRJZDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uW21ldGhvZF0uYXBwbHkoc2VsZi5fY29sbGVjdGlvbiwgYXJncyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgLy8gVGhpcyBpcyB0aGUgc2VydmVyIHJlY2VpdmluZyBhIG1ldGhvZCBjYWxsIGZyb20gdGhlIGNsaWVudC5cblxuICAgICAgICAgIC8vIFdlIGRvbid0IGFsbG93IGFyYml0cmFyeSBzZWxlY3RvcnMgaW4gbXV0YXRpb25zIGZyb20gdGhlIGNsaWVudDogb25seVxuICAgICAgICAgIC8vIHNpbmdsZS1JRCBzZWxlY3RvcnMuXG4gICAgICAgICAgaWYgKCFpc0luc2VydChtZXRob2QpKSB0aHJvd0lmU2VsZWN0b3JJc05vdElkKGFyZ3NbMF0sIG1ldGhvZCk7XG5cbiAgICAgICAgICBpZiAoc2VsZi5fcmVzdHJpY3RlZCkge1xuICAgICAgICAgICAgLy8gc2hvcnQgY2lyY3VpdCBpZiB0aGVyZSBpcyBubyB3YXkgaXQgd2lsbCBwYXNzLlxuICAgICAgICAgICAgaWYgKHNlbGYuX3ZhbGlkYXRvcnNbbWV0aG9kXS5hbGxvdy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgICAgICAgICA0MDMsXG4gICAgICAgICAgICAgICAgJ0FjY2VzcyBkZW5pZWQuIE5vIGFsbG93IHZhbGlkYXRvcnMgc2V0IG9uIHJlc3RyaWN0ZWQgJyArXG4gICAgICAgICAgICAgICAgICBcImNvbGxlY3Rpb24gZm9yIG1ldGhvZCAnXCIgK1xuICAgICAgICAgICAgICAgICAgbWV0aG9kICtcbiAgICAgICAgICAgICAgICAgIFwiJy5cIlxuICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB2YWxpZGF0ZWRNZXRob2ROYW1lID1cbiAgICAgICAgICAgICAgICAgICdfdmFsaWRhdGVkJyArIG1ldGhvZC5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG1ldGhvZC5zbGljZSgxKTtcbiAgICAgICAgICAgIGFyZ3MudW5zaGlmdCh0aGlzLnVzZXJJZCk7XG4gICAgICAgICAgICBpc0luc2VydChtZXRob2QpICYmIGFyZ3MucHVzaChnZW5lcmF0ZWRJZCk7XG4gICAgICAgICAgICByZXR1cm4gc2VsZlt2YWxpZGF0ZWRNZXRob2ROYW1lXS5hcHBseShzZWxmLCBhcmdzKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKHNlbGYuX2lzSW5zZWN1cmUoKSkge1xuICAgICAgICAgICAgaWYgKGdlbmVyYXRlZElkICE9PSBudWxsKSBhcmdzWzBdLl9pZCA9IGdlbmVyYXRlZElkO1xuICAgICAgICAgICAgLy8gSW4gaW5zZWN1cmUgbW9kZSwgYWxsb3cgYW55IG11dGF0aW9uICh3aXRoIGEgc2ltcGxlIHNlbGVjdG9yKS5cbiAgICAgICAgICAgIC8vIFhYWCBUaGlzIGlzIGtpbmQgb2YgYm9ndXMuICBJbnN0ZWFkIG9mIGJsaW5kbHkgcGFzc2luZyB3aGF0ZXZlclxuICAgICAgICAgICAgLy8gICAgIHdlIGdldCBmcm9tIHRoZSBuZXR3b3JrIHRvIHRoaXMgZnVuY3Rpb24sIHdlIHNob3VsZCBhY3R1YWxseVxuICAgICAgICAgICAgLy8gICAgIGtub3cgdGhlIGNvcnJlY3QgYXJndW1lbnRzIGZvciB0aGUgZnVuY3Rpb24gYW5kIHBhc3MganVzdFxuICAgICAgICAgICAgLy8gICAgIHRoZW0uICBGb3IgZXhhbXBsZSwgaWYgeW91IGhhdmUgYW4gZXh0cmFuZW91cyBleHRyYSBudWxsXG4gICAgICAgICAgICAvLyAgICAgYXJndW1lbnQgYW5kIHRoaXMgaXMgTW9uZ28gb24gdGhlIHNlcnZlciwgdGhlIC53cmFwQXN5bmMnZFxuICAgICAgICAgICAgLy8gICAgIGZ1bmN0aW9ucyBsaWtlIHVwZGF0ZSB3aWxsIGdldCBjb25mdXNlZCBhbmQgcGFzcyB0aGVcbiAgICAgICAgICAgIC8vICAgICBcImZ1dC5yZXNvbHZlcigpXCIgaW4gdGhlIHdyb25nIHNsb3QsIHdoZXJlIF91cGRhdGUgd2lsbCBuZXZlclxuICAgICAgICAgICAgLy8gICAgIGludm9rZSBpdC4gQmFtLCBicm9rZW4gRERQIGNvbm5lY3Rpb24uICBQcm9iYWJseSBzaG91bGQganVzdFxuICAgICAgICAgICAgLy8gICAgIHRha2UgdGhpcyB3aG9sZSBtZXRob2QgYW5kIHdyaXRlIGl0IHRocmVlIHRpbWVzLCBpbnZva2luZ1xuICAgICAgICAgICAgLy8gICAgIGhlbHBlcnMgZm9yIHRoZSBjb21tb24gY29kZS5cbiAgICAgICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uW21ldGhvZF0uYXBwbHkoc2VsZi5fY29sbGVjdGlvbiwgYXJncyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEluIHNlY3VyZSBtb2RlLCBpZiB3ZSBoYXZlbid0IGNhbGxlZCBhbGxvdyBvciBkZW55LCB0aGVuIG5vdGhpbmdcbiAgICAgICAgICAgIC8vIGlzIHBlcm1pdHRlZC5cbiAgICAgICAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCAnQWNjZXNzIGRlbmllZCcpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIGUubmFtZSA9PT0gJ01vbmdvRXJyb3InIHx8XG4gICAgICAgICAgICAvLyBmb3Igb2xkIHZlcnNpb25zIG9mIE1vbmdvREIgKHByb2JhYmx5IG5vdCBuZWNlc3NhcnkgYnV0IGl0J3MgaGVyZSBqdXN0IGluIGNhc2UpXG4gICAgICAgICAgICBlLm5hbWUgPT09ICdCdWxrV3JpdGVFcnJvcicgfHxcbiAgICAgICAgICAgIC8vIGZvciBuZXdlciB2ZXJzaW9ucyBvZiBNb25nb0RCIChodHRwczovL2RvY3MubW9uZ29kYi5jb20vZHJpdmVycy9ub2RlL2N1cnJlbnQvd2hhdHMtbmV3LyNidWxrd3JpdGVlcnJvci0tLW1vbmdvYnVsa3dyaXRlZXJyb3IpXG4gICAgICAgICAgICBlLm5hbWUgPT09ICdNb25nb0J1bGtXcml0ZUVycm9yJyB8fFxuICAgICAgICAgICAgZS5uYW1lID09PSAnTWluaW1vbmdvRXJyb3InXG4gICAgICAgICAgKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwOSwgZS50b1N0cmluZygpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH07XG4gICAgfSk7XG5cbiAgICBzZWxmLl9jb25uZWN0aW9uLm1ldGhvZHMobSk7XG4gIH1cbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3VwZGF0ZUZldGNoID0gZnVuY3Rpb24gKGZpZWxkcykge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICBpZiAoIXNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMpIHtcbiAgICBpZiAoZmllbGRzKSB7XG4gICAgICBjb25zdCB1bmlvbiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICBjb25zdCBhZGQgPSBuYW1lcyA9PiBuYW1lcyAmJiBuYW1lcy5mb3JFYWNoKG5hbWUgPT4gdW5pb25bbmFtZV0gPSAxKTtcbiAgICAgIGFkZChzZWxmLl92YWxpZGF0b3JzLmZldGNoKTtcbiAgICAgIGFkZChmaWVsZHMpO1xuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaCA9IE9iamVjdC5rZXlzKHVuaW9uKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcyA9IHRydWU7XG4gICAgICAvLyBjbGVhciBmZXRjaCBqdXN0IHRvIG1ha2Ugc3VyZSB3ZSBkb24ndCBhY2NpZGVudGFsbHkgcmVhZCBpdFxuICAgICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaCA9IG51bGw7XG4gICAgfVxuICB9XG59O1xuXG5Db2xsZWN0aW9uUHJvdG90eXBlLl9pc0luc2VjdXJlID0gZnVuY3Rpb24gKCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcbiAgaWYgKHNlbGYuX2luc2VjdXJlID09PSB1bmRlZmluZWQpXG4gICAgcmV0dXJuICEhUGFja2FnZS5pbnNlY3VyZTtcbiAgcmV0dXJuIHNlbGYuX2luc2VjdXJlO1xufTtcblxuQ29sbGVjdGlvblByb3RvdHlwZS5fdmFsaWRhdGVkSW5zZXJ0QXN5bmMgPSBmdW5jdGlvbiAodXNlcklkLCBkb2MsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZWRJZCkge1xuICBjb25zdCBzZWxmID0gdGhpcztcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMuaW5zZXJ0QXN5bmMuZGVueS5zb21lKCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cblxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy5pbnNlcnRBc3luYy5hbGxvdy5ldmVyeSgodmFsaWRhdG9yKSA9PiB7XG4gICAgcmV0dXJuICF2YWxpZGF0b3IodXNlcklkLCBkb2NUb1ZhbGlkYXRlKHZhbGlkYXRvciwgZG9jLCBnZW5lcmF0ZWRJZCkpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICAvLyBJZiB3ZSBnZW5lcmF0ZWQgYW4gSUQgYWJvdmUsIGluc2VydEFzeW5jIGl0IG5vdzogYWZ0ZXIgdGhlIHZhbGlkYXRpb24sIGJ1dFxuICAvLyBiZWZvcmUgYWN0dWFsbHkgaW5zZXJ0aW5nLlxuICBpZiAoZ2VuZXJhdGVkSWQgIT09IG51bGwpXG4gICAgZG9jLl9pZCA9IGdlbmVyYXRlZElkO1xuXG4gIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jLmNhbGwoc2VsZi5fY29sbGVjdGlvbiwgZG9jKTtcbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3ZhbGlkYXRlZEluc2VydCA9IGZ1bmN0aW9uICh1c2VySWQsIGRvYyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlZElkKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIC8vIGNhbGwgdXNlciB2YWxpZGF0b3JzLlxuICAvLyBBbnkgZGVueSByZXR1cm5zIHRydWUgbWVhbnMgZGVuaWVkLlxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy5pbnNlcnQuZGVueS5zb21lKCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG4gIC8vIEFueSBhbGxvdyByZXR1cm5zIHRydWUgbWVhbnMgcHJvY2VlZC4gVGhyb3cgZXJyb3IgaWYgdGhleSBhbGwgZmFpbC5cblxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy5pbnNlcnQuYWxsb3cuZXZlcnkoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiAhdmFsaWRhdG9yKHVzZXJJZCwgZG9jVG9WYWxpZGF0ZSh2YWxpZGF0b3IsIGRvYywgZ2VuZXJhdGVkSWQpKTtcbiAgfSkpIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgXCJBY2Nlc3MgZGVuaWVkXCIpO1xuICB9XG5cbiAgLy8gSWYgd2UgZ2VuZXJhdGVkIGFuIElEIGFib3ZlLCBpbnNlcnQgaXQgbm93OiBhZnRlciB0aGUgdmFsaWRhdGlvbiwgYnV0XG4gIC8vIGJlZm9yZSBhY3R1YWxseSBpbnNlcnRpbmcuXG4gIGlmIChnZW5lcmF0ZWRJZCAhPT0gbnVsbClcbiAgICBkb2MuX2lkID0gZ2VuZXJhdGVkSWQ7XG5cbiAgcmV0dXJuIChNZXRlb3IuaXNTZXJ2ZXJcbiAgICA/IHNlbGYuX2NvbGxlY3Rpb24uaW5zZXJ0QXN5bmNcbiAgICA6IHNlbGYuX2NvbGxlY3Rpb24uaW5zZXJ0XG4gICkuY2FsbChzZWxmLl9jb2xsZWN0aW9uLCBkb2MpO1xufTtcblxuLy8gU2ltdWxhdGUgYSBtb25nbyBgdXBkYXRlYCBvcGVyYXRpb24gd2hpbGUgdmFsaWRhdGluZyB0aGF0IHRoZSBhY2Nlc3Ncbi8vIGNvbnRyb2wgcnVsZXMgc2V0IGJ5IGNhbGxzIHRvIGBhbGxvdy9kZW55YCBhcmUgc2F0aXNmaWVkLiBJZiBhbGxcbi8vIHBhc3MsIHJld3JpdGUgdGhlIG1vbmdvIG9wZXJhdGlvbiB0byB1c2UgJGluIHRvIHNldCB0aGUgbGlzdCBvZlxuLy8gZG9jdW1lbnQgaWRzIHRvIGNoYW5nZSAjI1ZhbGlkYXRlZENoYW5nZVxuQ29sbGVjdGlvblByb3RvdHlwZS5fdmFsaWRhdGVkVXBkYXRlQXN5bmMgPSBhc3luYyBmdW5jdGlvbihcbiAgICB1c2VySWQsIHNlbGVjdG9yLCBtdXRhdG9yLCBvcHRpb25zKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGNoZWNrKG11dGF0b3IsIE9iamVjdCk7XG5cbiAgb3B0aW9ucyA9IE9iamVjdC5hc3NpZ24oT2JqZWN0LmNyZWF0ZShudWxsKSwgb3B0aW9ucyk7XG5cbiAgaWYgKCFMb2NhbENvbGxlY3Rpb24uX3NlbGVjdG9ySXNJZFBlcmhhcHNBc09iamVjdChzZWxlY3RvcikpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwidmFsaWRhdGVkIHVwZGF0ZSBzaG91bGQgYmUgb2YgYSBzaW5nbGUgSURcIik7XG5cbiAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCB1cHNlcnRzIGJlY2F1c2UgdGhleSBkb24ndCBmaXQgbmljZWx5IGludG8gYWxsb3cvZGVueVxuICAvLyBydWxlcy5cbiAgaWYgKG9wdGlvbnMudXBzZXJ0KVxuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWQuIFVwc2VydHMgbm90IFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiYWxsb3dlZCBpbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbi5cIik7XG5cbiAgY29uc3Qgbm9SZXBsYWNlRXJyb3IgPSBcIkFjY2VzcyBkZW5pZWQuIEluIGEgcmVzdHJpY3RlZCBjb2xsZWN0aW9uIHlvdSBjYW4gb25seVwiICtcbiAgICAgICAgXCIgdXBkYXRlIGRvY3VtZW50cywgbm90IHJlcGxhY2UgdGhlbS4gVXNlIGEgTW9uZ28gdXBkYXRlIG9wZXJhdG9yLCBzdWNoIFwiICtcbiAgICAgICAgXCJhcyAnJHNldCcuXCI7XG5cbiAgY29uc3QgbXV0YXRvcktleXMgPSBPYmplY3Qua2V5cyhtdXRhdG9yKTtcblxuICAvLyBjb21wdXRlIG1vZGlmaWVkIGZpZWxkc1xuICBjb25zdCBtb2RpZmllZEZpZWxkcyA9IHt9O1xuXG4gIGlmIChtdXRhdG9yS2V5cy5sZW5ndGggPT09IDApIHtcbiAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgbm9SZXBsYWNlRXJyb3IpO1xuICB9XG4gIG11dGF0b3JLZXlzLmZvckVhY2goKG9wKSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0gbXV0YXRvcltvcF07XG4gICAgaWYgKG9wLmNoYXJBdCgwKSAhPT0gJyQnKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKDQwMywgbm9SZXBsYWNlRXJyb3IpO1xuICAgIH0gZWxzZSBpZiAoIWhhc093bi5jYWxsKEFMTE9XRURfVVBEQVRFX09QRVJBVElPTlMsIG9wKSkge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihcbiAgICAgICAgNDAzLCBcIkFjY2VzcyBkZW5pZWQuIE9wZXJhdG9yIFwiICsgb3AgKyBcIiBub3QgYWxsb3dlZCBpbiBhIHJlc3RyaWN0ZWQgY29sbGVjdGlvbi5cIik7XG4gICAgfSBlbHNlIHtcbiAgICAgIE9iamVjdC5rZXlzKHBhcmFtcykuZm9yRWFjaCgoZmllbGQpID0+IHtcbiAgICAgICAgLy8gdHJlYXQgZG90dGVkIGZpZWxkcyBhcyBpZiB0aGV5IGFyZSByZXBsYWNpbmcgdGhlaXJcbiAgICAgICAgLy8gdG9wLWxldmVsIHBhcnRcbiAgICAgICAgaWYgKGZpZWxkLmluZGV4T2YoJy4nKSAhPT0gLTEpXG4gICAgICAgICAgZmllbGQgPSBmaWVsZC5zdWJzdHJpbmcoMCwgZmllbGQuaW5kZXhPZignLicpKTtcblxuICAgICAgICAvLyByZWNvcmQgdGhlIGZpZWxkIHdlIGFyZSB0cnlpbmcgdG8gY2hhbmdlXG4gICAgICAgIG1vZGlmaWVkRmllbGRzW2ZpZWxkXSA9IHRydWU7XG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIGNvbnN0IGZpZWxkcyA9IE9iamVjdC5rZXlzKG1vZGlmaWVkRmllbGRzKTtcblxuICBjb25zdCBmaW5kT3B0aW9ucyA9IHt0cmFuc2Zvcm06IG51bGx9O1xuICBpZiAoIXNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2hBbGxGaWVsZHMpIHtcbiAgICBmaW5kT3B0aW9ucy5maWVsZHMgPSB7fTtcbiAgICBzZWxmLl92YWxpZGF0b3JzLmZldGNoLmZvckVhY2goKGZpZWxkTmFtZSkgPT4ge1xuICAgICAgZmluZE9wdGlvbnMuZmllbGRzW2ZpZWxkTmFtZV0gPSAxO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3QgZG9jID0gYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5maW5kT25lQXN5bmMoc2VsZWN0b3IsIGZpbmRPcHRpb25zKTtcbiAgaWYgKCFkb2MpICAvLyBub25lIHNhdGlzZmllZCFcbiAgICByZXR1cm4gMDtcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMudXBkYXRlQXN5bmMuZGVueS5zb21lKCh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCBmYWN0b3JpZWREb2MgPSB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpO1xuICAgIHJldHVybiB2YWxpZGF0b3IodXNlcklkLFxuICAgICAgICAgICAgICAgICAgICAgZmFjdG9yaWVkRG9jLFxuICAgICAgICAgICAgICAgICAgICAgZmllbGRzLFxuICAgICAgICAgICAgICAgICAgICAgbXV0YXRvcik7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnVwZGF0ZUFzeW5jLmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICBjb25zdCBmYWN0b3JpZWREb2MgPSB0cmFuc2Zvcm1Eb2ModmFsaWRhdG9yLCBkb2MpO1xuICAgIHJldHVybiAhdmFsaWRhdG9yKHVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgICBmYWN0b3JpZWREb2MsXG4gICAgICAgICAgICAgICAgICAgICAgZmllbGRzLFxuICAgICAgICAgICAgICAgICAgICAgIG11dGF0b3IpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICBvcHRpb25zLl9mb3JiaWRSZXBsYWNlID0gdHJ1ZTtcblxuICAvLyBCYWNrIHdoZW4gd2Ugc3VwcG9ydGVkIGFyYml0cmFyeSBjbGllbnQtcHJvdmlkZWQgc2VsZWN0b3JzLCB3ZSBhY3R1YWxseVxuICAvLyByZXdyb3RlIHRoZSBzZWxlY3RvciB0byBpbmNsdWRlIGFuIF9pZCBjbGF1c2UgYmVmb3JlIHBhc3NpbmcgdG8gTW9uZ28gdG9cbiAgLy8gYXZvaWQgcmFjZXMsIGJ1dCBzaW5jZSBzZWxlY3RvciBpcyBndWFyYW50ZWVkIHRvIGFscmVhZHkganVzdCBiZSBhbiBJRCwgd2VcbiAgLy8gZG9uJ3QgaGF2ZSB0byBhbnkgbW9yZS5cblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi51cGRhdGVBc3luYy5jYWxsKFxuICAgIHNlbGYuX2NvbGxlY3Rpb24sIHNlbGVjdG9yLCBtdXRhdG9yLCBvcHRpb25zKTtcbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3ZhbGlkYXRlZFVwZGF0ZSA9IGZ1bmN0aW9uKFxuICAgIHVzZXJJZCwgc2VsZWN0b3IsIG11dGF0b3IsIG9wdGlvbnMpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgY2hlY2sobXV0YXRvciwgT2JqZWN0KTtcblxuICBvcHRpb25zID0gT2JqZWN0LmFzc2lnbihPYmplY3QuY3JlYXRlKG51bGwpLCBvcHRpb25zKTtcblxuICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0KHNlbGVjdG9yKSlcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJ2YWxpZGF0ZWQgdXBkYXRlIHNob3VsZCBiZSBvZiBhIHNpbmdsZSBJRFwiKTtcblxuICAvLyBXZSBkb24ndCBzdXBwb3J0IHVwc2VydHMgYmVjYXVzZSB0aGV5IGRvbid0IGZpdCBuaWNlbHkgaW50byBhbGxvdy9kZW55XG4gIC8vIHJ1bGVzLlxuICBpZiAob3B0aW9ucy51cHNlcnQpXG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZC4gVXBzZXJ0cyBub3QgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJhbGxvd2VkIGluIGEgcmVzdHJpY3RlZCBjb2xsZWN0aW9uLlwiKTtcblxuICBjb25zdCBub1JlcGxhY2VFcnJvciA9IFwiQWNjZXNzIGRlbmllZC4gSW4gYSByZXN0cmljdGVkIGNvbGxlY3Rpb24geW91IGNhbiBvbmx5XCIgK1xuICAgICAgICBcIiB1cGRhdGUgZG9jdW1lbnRzLCBub3QgcmVwbGFjZSB0aGVtLiBVc2UgYSBNb25nbyB1cGRhdGUgb3BlcmF0b3IsIHN1Y2ggXCIgK1xuICAgICAgICBcImFzICckc2V0Jy5cIjtcblxuICBjb25zdCBtdXRhdG9yS2V5cyA9IE9iamVjdC5rZXlzKG11dGF0b3IpO1xuXG4gIC8vIGNvbXB1dGUgbW9kaWZpZWQgZmllbGRzXG4gIGNvbnN0IG1vZGlmaWVkRmllbGRzID0ge307XG5cbiAgaWYgKG11dGF0b3JLZXlzLmxlbmd0aCA9PT0gMCkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBub1JlcGxhY2VFcnJvcik7XG4gIH1cbiAgbXV0YXRvcktleXMuZm9yRWFjaCgob3ApID0+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBtdXRhdG9yW29wXTtcbiAgICBpZiAob3AuY2hhckF0KDApICE9PSAnJCcpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBub1JlcGxhY2VFcnJvcik7XG4gICAgfSBlbHNlIGlmICghaGFzT3duLmNhbGwoQUxMT1dFRF9VUERBVEVfT1BFUkFUSU9OUywgb3ApKSB7XG4gICAgICB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKFxuICAgICAgICA0MDMsIFwiQWNjZXNzIGRlbmllZC4gT3BlcmF0b3IgXCIgKyBvcCArIFwiIG5vdCBhbGxvd2VkIGluIGEgcmVzdHJpY3RlZCBjb2xsZWN0aW9uLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgT2JqZWN0LmtleXMocGFyYW1zKS5mb3JFYWNoKChmaWVsZCkgPT4ge1xuICAgICAgICAvLyB0cmVhdCBkb3R0ZWQgZmllbGRzIGFzIGlmIHRoZXkgYXJlIHJlcGxhY2luZyB0aGVpclxuICAgICAgICAvLyB0b3AtbGV2ZWwgcGFydFxuICAgICAgICBpZiAoZmllbGQuaW5kZXhPZignLicpICE9PSAtMSlcbiAgICAgICAgICBmaWVsZCA9IGZpZWxkLnN1YnN0cmluZygwLCBmaWVsZC5pbmRleE9mKCcuJykpO1xuXG4gICAgICAgIC8vIHJlY29yZCB0aGUgZmllbGQgd2UgYXJlIHRyeWluZyB0byBjaGFuZ2VcbiAgICAgICAgbW9kaWZpZWRGaWVsZHNbZmllbGRdID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgY29uc3QgZmllbGRzID0gT2JqZWN0LmtleXMobW9kaWZpZWRGaWVsZHMpO1xuXG4gIGNvbnN0IGZpbmRPcHRpb25zID0ge3RyYW5zZm9ybTogbnVsbH07XG4gIGlmICghc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcykge1xuICAgIGZpbmRPcHRpb25zLmZpZWxkcyA9IHt9O1xuICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2guZm9yRWFjaCgoZmllbGROYW1lKSA9PiB7XG4gICAgICBmaW5kT3B0aW9ucy5maWVsZHNbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb2MgPSBzZWxmLl9jb2xsZWN0aW9uLmZpbmRPbmUoc2VsZWN0b3IsIGZpbmRPcHRpb25zKTtcbiAgaWYgKCFkb2MpICAvLyBub25lIHNhdGlzZmllZCFcbiAgICByZXR1cm4gMDtcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMudXBkYXRlLmRlbnkuc29tZSgodmFsaWRhdG9yKSA9PiB7XG4gICAgY29uc3QgZmFjdG9yaWVkRG9jID0gdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKTtcbiAgICByZXR1cm4gdmFsaWRhdG9yKHVzZXJJZCxcbiAgICAgICAgICAgICAgICAgICAgIGZhY3RvcmllZERvYyxcbiAgICAgICAgICAgICAgICAgICAgIGZpZWxkcyxcbiAgICAgICAgICAgICAgICAgICAgIG11dGF0b3IpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cbiAgLy8gQW55IGFsbG93IHJldHVybnMgdHJ1ZSBtZWFucyBwcm9jZWVkLiBUaHJvdyBlcnJvciBpZiB0aGV5IGFsbCBmYWlsLlxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy51cGRhdGUuYWxsb3cuZXZlcnkoKHZhbGlkYXRvcikgPT4ge1xuICAgIGNvbnN0IGZhY3RvcmllZERvYyA9IHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYyk7XG4gICAgcmV0dXJuICF2YWxpZGF0b3IodXNlcklkLFxuICAgICAgICAgICAgICAgICAgICAgIGZhY3RvcmllZERvYyxcbiAgICAgICAgICAgICAgICAgICAgICBmaWVsZHMsXG4gICAgICAgICAgICAgICAgICAgICAgbXV0YXRvcik7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuXG4gIG9wdGlvbnMuX2ZvcmJpZFJlcGxhY2UgPSB0cnVlO1xuXG4gIC8vIEJhY2sgd2hlbiB3ZSBzdXBwb3J0ZWQgYXJiaXRyYXJ5IGNsaWVudC1wcm92aWRlZCBzZWxlY3RvcnMsIHdlIGFjdHVhbGx5XG4gIC8vIHJld3JvdGUgdGhlIHNlbGVjdG9yIHRvIGluY2x1ZGUgYW4gX2lkIGNsYXVzZSBiZWZvcmUgcGFzc2luZyB0byBNb25nbyB0b1xuICAvLyBhdm9pZCByYWNlcywgYnV0IHNpbmNlIHNlbGVjdG9yIGlzIGd1YXJhbnRlZWQgdG8gYWxyZWFkeSBqdXN0IGJlIGFuIElELCB3ZVxuICAvLyBkb24ndCBoYXZlIHRvIGFueSBtb3JlLlxuXG4gIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLnVwZGF0ZS5jYWxsKFxuICAgIHNlbGYuX2NvbGxlY3Rpb24sIHNlbGVjdG9yLCBtdXRhdG9yLCBvcHRpb25zKTtcbn07XG5cbi8vIE9ubHkgYWxsb3cgdGhlc2Ugb3BlcmF0aW9ucyBpbiB2YWxpZGF0ZWQgdXBkYXRlcy4gU3BlY2lmaWNhbGx5XG4vLyB3aGl0ZWxpc3Qgb3BlcmF0aW9ucywgcmF0aGVyIHRoYW4gYmxhY2tsaXN0LCBzbyBuZXcgY29tcGxleFxuLy8gb3BlcmF0aW9ucyB0aGF0IGFyZSBhZGRlZCBhcmVuJ3QgYXV0b21hdGljYWxseSBhbGxvd2VkLiBBIGNvbXBsZXhcbi8vIG9wZXJhdGlvbiBpcyBvbmUgdGhhdCBkb2VzIG1vcmUgdGhhbiBqdXN0IG1vZGlmeSBpdHMgdGFyZ2V0XG4vLyBmaWVsZC4gRm9yIG5vdyB0aGlzIGNvbnRhaW5zIGFsbCB1cGRhdGUgb3BlcmF0aW9ucyBleGNlcHQgJyRyZW5hbWUnLlxuLy8gaHR0cDovL2RvY3MubW9uZ29kYi5vcmcvbWFudWFsL3JlZmVyZW5jZS9vcGVyYXRvcnMvI3VwZGF0ZVxuY29uc3QgQUxMT1dFRF9VUERBVEVfT1BFUkFUSU9OUyA9IHtcbiAgJGluYzoxLCAkc2V0OjEsICR1bnNldDoxLCAkYWRkVG9TZXQ6MSwgJHBvcDoxLCAkcHVsbEFsbDoxLCAkcHVsbDoxLFxuICAkcHVzaEFsbDoxLCAkcHVzaDoxLCAkYml0OjFcbn07XG5cbi8vIFNpbXVsYXRlIGEgbW9uZ28gYHJlbW92ZWAgb3BlcmF0aW9uIHdoaWxlIHZhbGlkYXRpbmcgYWNjZXNzIGNvbnRyb2xcbi8vIHJ1bGVzLiBTZWUgI1ZhbGlkYXRlZENoYW5nZVxuQ29sbGVjdGlvblByb3RvdHlwZS5fdmFsaWRhdGVkUmVtb3ZlQXN5bmMgPSBhc3luYyBmdW5jdGlvbih1c2VySWQsIHNlbGVjdG9yKSB7XG4gIGNvbnN0IHNlbGYgPSB0aGlzO1xuXG4gIGNvbnN0IGZpbmRPcHRpb25zID0ge3RyYW5zZm9ybTogbnVsbH07XG4gIGlmICghc2VsZi5fdmFsaWRhdG9ycy5mZXRjaEFsbEZpZWxkcykge1xuICAgIGZpbmRPcHRpb25zLmZpZWxkcyA9IHt9O1xuICAgIHNlbGYuX3ZhbGlkYXRvcnMuZmV0Y2guZm9yRWFjaCgoZmllbGROYW1lKSA9PiB7XG4gICAgICBmaW5kT3B0aW9ucy5maWVsZHNbZmllbGROYW1lXSA9IDE7XG4gICAgfSk7XG4gIH1cblxuICBjb25zdCBkb2MgPSBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmZpbmRPbmVBc3luYyhzZWxlY3RvciwgZmluZE9wdGlvbnMpO1xuICBpZiAoIWRvYylcbiAgICByZXR1cm4gMDtcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMucmVtb3ZlQXN5bmMuZGVueS5zb21lKCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gdmFsaWRhdG9yKHVzZXJJZCwgdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKSk7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuICAvLyBBbnkgYWxsb3cgcmV0dXJucyB0cnVlIG1lYW5zIHByb2NlZWQuIFRocm93IGVycm9yIGlmIHRoZXkgYWxsIGZhaWwuXG4gIGlmIChzZWxmLl92YWxpZGF0b3JzLnJlbW92ZUFzeW5jLmFsbG93LmV2ZXJ5KCh2YWxpZGF0b3IpID0+IHtcbiAgICByZXR1cm4gIXZhbGlkYXRvcih1c2VySWQsIHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYykpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cblxuICAvLyBCYWNrIHdoZW4gd2Ugc3VwcG9ydGVkIGFyYml0cmFyeSBjbGllbnQtcHJvdmlkZWQgc2VsZWN0b3JzLCB3ZSBhY3R1YWxseVxuICAvLyByZXdyb3RlIHRoZSBzZWxlY3RvciB0byB7X2lkOiB7JGluOiBbaWRzIHRoYXQgd2UgZm91bmRdfX0gYmVmb3JlIHBhc3NpbmcgdG9cbiAgLy8gTW9uZ28gdG8gYXZvaWQgcmFjZXMsIGJ1dCBzaW5jZSBzZWxlY3RvciBpcyBndWFyYW50ZWVkIHRvIGFscmVhZHkganVzdCBiZVxuICAvLyBhbiBJRCwgd2UgZG9uJ3QgaGF2ZSB0byBhbnkgbW9yZS5cblxuICByZXR1cm4gc2VsZi5fY29sbGVjdGlvbi5yZW1vdmVBc3luYy5jYWxsKHNlbGYuX2NvbGxlY3Rpb24sIHNlbGVjdG9yKTtcbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX3ZhbGlkYXRlZFJlbW92ZSA9IGZ1bmN0aW9uKHVzZXJJZCwgc2VsZWN0b3IpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgY29uc3QgZmluZE9wdGlvbnMgPSB7dHJhbnNmb3JtOiBudWxsfTtcbiAgaWYgKCFzZWxmLl92YWxpZGF0b3JzLmZldGNoQWxsRmllbGRzKSB7XG4gICAgZmluZE9wdGlvbnMuZmllbGRzID0ge307XG4gICAgc2VsZi5fdmFsaWRhdG9ycy5mZXRjaC5mb3JFYWNoKChmaWVsZE5hbWUpID0+IHtcbiAgICAgIGZpbmRPcHRpb25zLmZpZWxkc1tmaWVsZE5hbWVdID0gMTtcbiAgICB9KTtcbiAgfVxuXG4gIGNvbnN0IGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uZmluZE9uZShzZWxlY3RvciwgZmluZE9wdGlvbnMpO1xuICBpZiAoIWRvYylcbiAgICByZXR1cm4gMDtcblxuICAvLyBjYWxsIHVzZXIgdmFsaWRhdG9ycy5cbiAgLy8gQW55IGRlbnkgcmV0dXJucyB0cnVlIG1lYW5zIGRlbmllZC5cbiAgaWYgKHNlbGYuX3ZhbGlkYXRvcnMucmVtb3ZlLmRlbnkuc29tZSgodmFsaWRhdG9yKSA9PiB7XG4gICAgcmV0dXJuIHZhbGlkYXRvcih1c2VySWQsIHRyYW5zZm9ybURvYyh2YWxpZGF0b3IsIGRvYykpO1xuICB9KSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoNDAzLCBcIkFjY2VzcyBkZW5pZWRcIik7XG4gIH1cbiAgLy8gQW55IGFsbG93IHJldHVybnMgdHJ1ZSBtZWFucyBwcm9jZWVkLiBUaHJvdyBlcnJvciBpZiB0aGV5IGFsbCBmYWlsLlxuICBpZiAoc2VsZi5fdmFsaWRhdG9ycy5yZW1vdmUuYWxsb3cuZXZlcnkoKHZhbGlkYXRvcikgPT4ge1xuICAgIHJldHVybiAhdmFsaWRhdG9yKHVzZXJJZCwgdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKSk7XG4gIH0pKSB7XG4gICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcig0MDMsIFwiQWNjZXNzIGRlbmllZFwiKTtcbiAgfVxuXG4gIC8vIEJhY2sgd2hlbiB3ZSBzdXBwb3J0ZWQgYXJiaXRyYXJ5IGNsaWVudC1wcm92aWRlZCBzZWxlY3RvcnMsIHdlIGFjdHVhbGx5XG4gIC8vIHJld3JvdGUgdGhlIHNlbGVjdG9yIHRvIHtfaWQ6IHskaW46IFtpZHMgdGhhdCB3ZSBmb3VuZF19fSBiZWZvcmUgcGFzc2luZyB0b1xuICAvLyBNb25nbyB0byBhdm9pZCByYWNlcywgYnV0IHNpbmNlIHNlbGVjdG9yIGlzIGd1YXJhbnRlZWQgdG8gYWxyZWFkeSBqdXN0IGJlXG4gIC8vIGFuIElELCB3ZSBkb24ndCBoYXZlIHRvIGFueSBtb3JlLlxuXG4gIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZS5jYWxsKHNlbGYuX2NvbGxlY3Rpb24sIHNlbGVjdG9yKTtcbn07XG5cbkNvbGxlY3Rpb25Qcm90b3R5cGUuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMgPSBhc3luYyBmdW5jdGlvbiBfY2FsbE11dGF0b3JNZXRob2RBc3luYyhuYW1lLCBhcmdzLCBvcHRpb25zID0ge30pIHtcblxuICAvLyBGb3IgdHdvIG91dCBvZiB0aHJlZSBtdXRhdG9yIG1ldGhvZHMsIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBhIHNlbGVjdG9yXG4gIGNvbnN0IGZpcnN0QXJnSXNTZWxlY3RvciA9IG5hbWUgPT09IFwidXBkYXRlQXN5bmNcIiB8fCBuYW1lID09PSBcInJlbW92ZUFzeW5jXCI7XG4gIGlmIChmaXJzdEFyZ0lzU2VsZWN0b3IgJiYgIWFscmVhZHlJblNpbXVsYXRpb24oKSkge1xuICAgIC8vIElmIHdlJ3JlIGFib3V0IHRvIGFjdHVhbGx5IHNlbmQgYW4gUlBDLCB3ZSBzaG91bGQgdGhyb3cgYW4gZXJyb3IgaWZcbiAgICAvLyB0aGlzIGlzIGEgbm9uLUlEIHNlbGVjdG9yLCBiZWNhdXNlIHRoZSBtdXRhdGlvbiBtZXRob2RzIG9ubHkgYWxsb3dcbiAgICAvLyBzaW5nbGUtSUQgc2VsZWN0b3JzLiAoSWYgd2UgZG9uJ3QgdGhyb3cgaGVyZSwgd2UnbGwgc2VlIGZsaWNrZXIuKVxuICAgIHRocm93SWZTZWxlY3RvcklzTm90SWQoYXJnc1swXSwgbmFtZSk7XG4gIH1cblxuICBjb25zdCBtdXRhdG9yTWV0aG9kTmFtZSA9IHRoaXMuX3ByZWZpeCArIG5hbWU7XG4gIHJldHVybiB0aGlzLl9jb25uZWN0aW9uLmFwcGx5QXN5bmMobXV0YXRvck1ldGhvZE5hbWUsIGFyZ3MsIHtcbiAgICByZXR1cm5TdHViVmFsdWU6IHRydWUsXG4gICAgcmV0dXJuU2VydmVyUmVzdWx0UHJvbWlzZTogdHJ1ZSxcbiAgICAuLi5vcHRpb25zLFxuICB9KTtcbn1cblxuQ29sbGVjdGlvblByb3RvdHlwZS5fY2FsbE11dGF0b3JNZXRob2QgPSBmdW5jdGlvbiBfY2FsbE11dGF0b3JNZXRob2QobmFtZSwgYXJncywgY2FsbGJhY2spIHtcbiAgaWYgKE1ldGVvci5pc0NsaWVudCAmJiAhY2FsbGJhY2sgJiYgIWFscmVhZHlJblNpbXVsYXRpb24oKSkge1xuICAgIC8vIENsaWVudCBjYW4ndCBibG9jaywgc28gaXQgY2FuJ3QgcmVwb3J0IGVycm9ycyBieSBleGNlcHRpb24sXG4gICAgLy8gb25seSBieSBjYWxsYmFjay4gSWYgdGhleSBmb3JnZXQgdGhlIGNhbGxiYWNrLCBnaXZlIHRoZW0gYVxuICAgIC8vIGRlZmF1bHQgb25lIHRoYXQgbG9ncyB0aGUgZXJyb3IsIHNvIHRoZXkgYXJlbid0IHRvdGFsbHlcbiAgICAvLyBiYWZmbGVkIGlmIHRoZWlyIHdyaXRlcyBkb24ndCB3b3JrIGJlY2F1c2UgdGhlaXIgZGF0YWJhc2UgaXNcbiAgICAvLyBkb3duLlxuICAgIC8vIERvbid0IGdpdmUgYSBkZWZhdWx0IGNhbGxiYWNrIGluIHNpbXVsYXRpb24sIGJlY2F1c2UgaW5zaWRlIHN0dWJzIHdlXG4gICAgLy8gd2FudCB0byByZXR1cm4gdGhlIHJlc3VsdHMgZnJvbSB0aGUgbG9jYWwgY29sbGVjdGlvbiBpbW1lZGlhdGVseSBhbmRcbiAgICAvLyBub3QgZm9yY2UgYSBjYWxsYmFjay5cbiAgICBjYWxsYmFjayA9IGZ1bmN0aW9uIChlcnIpIHtcbiAgICAgIGlmIChlcnIpXG4gICAgICAgIE1ldGVvci5fZGVidWcobmFtZSArIFwiIGZhaWxlZFwiLCBlcnIpO1xuICAgIH07XG4gIH1cblxuICAvLyBGb3IgdHdvIG91dCBvZiB0aHJlZSBtdXRhdG9yIG1ldGhvZHMsIHRoZSBmaXJzdCBhcmd1bWVudCBpcyBhIHNlbGVjdG9yXG4gIGNvbnN0IGZpcnN0QXJnSXNTZWxlY3RvciA9IG5hbWUgPT09IFwidXBkYXRlXCIgfHwgbmFtZSA9PT0gXCJyZW1vdmVcIjtcbiAgaWYgKGZpcnN0QXJnSXNTZWxlY3RvciAmJiAhYWxyZWFkeUluU2ltdWxhdGlvbigpKSB7XG4gICAgLy8gSWYgd2UncmUgYWJvdXQgdG8gYWN0dWFsbHkgc2VuZCBhbiBSUEMsIHdlIHNob3VsZCB0aHJvdyBhbiBlcnJvciBpZlxuICAgIC8vIHRoaXMgaXMgYSBub24tSUQgc2VsZWN0b3IsIGJlY2F1c2UgdGhlIG11dGF0aW9uIG1ldGhvZHMgb25seSBhbGxvd1xuICAgIC8vIHNpbmdsZS1JRCBzZWxlY3RvcnMuIChJZiB3ZSBkb24ndCB0aHJvdyBoZXJlLCB3ZSdsbCBzZWUgZmxpY2tlci4pXG4gICAgdGhyb3dJZlNlbGVjdG9ySXNOb3RJZChhcmdzWzBdLCBuYW1lKTtcbiAgfVxuXG4gIGNvbnN0IG11dGF0b3JNZXRob2ROYW1lID0gdGhpcy5fcHJlZml4ICsgbmFtZTtcbiAgcmV0dXJuIHRoaXMuX2Nvbm5lY3Rpb24uYXBwbHkoXG4gICAgbXV0YXRvck1ldGhvZE5hbWUsIGFyZ3MsIHsgcmV0dXJuU3R1YlZhbHVlOiB0cnVlIH0sIGNhbGxiYWNrKTtcbn1cblxuZnVuY3Rpb24gdHJhbnNmb3JtRG9jKHZhbGlkYXRvciwgZG9jKSB7XG4gIGlmICh2YWxpZGF0b3IudHJhbnNmb3JtKVxuICAgIHJldHVybiB2YWxpZGF0b3IudHJhbnNmb3JtKGRvYyk7XG4gIHJldHVybiBkb2M7XG59XG5cbmZ1bmN0aW9uIGRvY1RvVmFsaWRhdGUodmFsaWRhdG9yLCBkb2MsIGdlbmVyYXRlZElkKSB7XG4gIGxldCByZXQgPSBkb2M7XG4gIGlmICh2YWxpZGF0b3IudHJhbnNmb3JtKSB7XG4gICAgcmV0ID0gRUpTT04uY2xvbmUoZG9jKTtcbiAgICAvLyBJZiB5b3Ugc2V0IGEgc2VydmVyLXNpZGUgdHJhbnNmb3JtIG9uIHlvdXIgY29sbGVjdGlvbiwgdGhlbiB5b3UgZG9uJ3QgZ2V0XG4gICAgLy8gdG8gdGVsbCB0aGUgZGlmZmVyZW5jZSBiZXR3ZWVuIFwiY2xpZW50IHNwZWNpZmllZCB0aGUgSURcIiBhbmQgXCJzZXJ2ZXJcbiAgICAvLyBnZW5lcmF0ZWQgdGhlIElEXCIsIGJlY2F1c2UgdHJhbnNmb3JtcyBleHBlY3QgdG8gZ2V0IF9pZC4gIElmIHlvdSB3YW50IHRvXG4gICAgLy8gZG8gdGhhdCBjaGVjaywgeW91IGNhbiBkbyBpdCB3aXRoIGEgc3BlY2lmaWNcbiAgICAvLyBgQy5hbGxvdyh7aW5zZXJ0QXN5bmM6IGYsIHRyYW5zZm9ybTogbnVsbH0pYCB2YWxpZGF0b3IuXG4gICAgaWYgKGdlbmVyYXRlZElkICE9PSBudWxsKSB7XG4gICAgICByZXQuX2lkID0gZ2VuZXJhdGVkSWQ7XG4gICAgfVxuICAgIHJldCA9IHZhbGlkYXRvci50cmFuc2Zvcm0ocmV0KTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBhZGRWYWxpZGF0b3IoY29sbGVjdGlvbiwgYWxsb3dPckRlbnksIG9wdGlvbnMpIHtcbiAgLy8gdmFsaWRhdGUga2V5c1xuICBjb25zdCB2YWxpZEtleXNSZWdFeCA9IC9eKD86aW5zZXJ0QXN5bmN8dXBkYXRlQXN5bmN8cmVtb3ZlQXN5bmN8aW5zZXJ0fHVwZGF0ZXxyZW1vdmV8ZmV0Y2h8dHJhbnNmb3JtKSQvO1xuICBPYmplY3Qua2V5cyhvcHRpb25zKS5mb3JFYWNoKChrZXkpID0+IHtcbiAgICBpZiAoIXZhbGlkS2V5c1JlZ0V4LnRlc3Qoa2V5KSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihhbGxvd09yRGVueSArIFwiOiBJbnZhbGlkIGtleTogXCIgKyBrZXkpO1xuICB9KTtcblxuICBjb2xsZWN0aW9uLl9yZXN0cmljdGVkID0gdHJ1ZTtcblxuICBbXG4gICAgJ2luc2VydEFzeW5jJyxcbiAgICAndXBkYXRlQXN5bmMnLFxuICAgICdyZW1vdmVBc3luYycsXG4gICAgJ2luc2VydCcsXG4gICAgJ3VwZGF0ZScsXG4gICAgJ3JlbW92ZScsXG4gIF0uZm9yRWFjaChuYW1lID0+IHtcbiAgICBpZiAoaGFzT3duLmNhbGwob3B0aW9ucywgbmFtZSkpIHtcbiAgICAgIGlmICghKG9wdGlvbnNbbmFtZV0gaW5zdGFuY2VvZiBGdW5jdGlvbikpIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgIGFsbG93T3JEZW55ICsgJzogVmFsdWUgZm9yIGAnICsgbmFtZSArICdgIG11c3QgYmUgYSBmdW5jdGlvbidcbiAgICAgICAgKTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIHRyYW5zZm9ybSBpcyBzcGVjaWZpZWQgYXQgYWxsIChpbmNsdWRpbmcgYXMgJ251bGwnKSBpbiB0aGlzXG4gICAgICAvLyBjYWxsLCB0aGVuIHRha2UgdGhhdDsgb3RoZXJ3aXNlLCB0YWtlIHRoZSB0cmFuc2Zvcm0gZnJvbSB0aGVcbiAgICAgIC8vIGNvbGxlY3Rpb24uXG4gICAgICBpZiAob3B0aW9ucy50cmFuc2Zvcm0gPT09IHVuZGVmaW5lZCkge1xuICAgICAgICBvcHRpb25zW25hbWVdLnRyYW5zZm9ybSA9IGNvbGxlY3Rpb24uX3RyYW5zZm9ybTsgLy8gYWxyZWFkeSB3cmFwcGVkXG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zW25hbWVdLnRyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKFxuICAgICAgICAgIG9wdGlvbnMudHJhbnNmb3JtXG4gICAgICAgICk7XG4gICAgICB9XG4gICAgICBjb2xsZWN0aW9uLl92YWxpZGF0b3JzW25hbWVdW2FsbG93T3JEZW55XS5wdXNoKG9wdGlvbnNbbmFtZV0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLy8gT25seSB1cGRhdGVBc3luYyB0aGUgZmV0Y2ggZmllbGRzIGlmIHdlJ3JlIHBhc3NlZCB0aGluZ3MgdGhhdCBhZmZlY3RcbiAgLy8gZmV0Y2hpbmcuIFRoaXMgd2F5IGFsbG93KHt9KSBhbmQgYWxsb3coe2luc2VydEFzeW5jOiBmfSkgZG9uJ3QgcmVzdWx0IGluXG4gIC8vIHNldHRpbmcgZmV0Y2hBbGxGaWVsZHNcbiAgaWYgKG9wdGlvbnMudXBkYXRlQXN5bmMgfHwgb3B0aW9ucy5yZW1vdmVBc3luYyB8fCBvcHRpb25zLmZldGNoKSB7XG4gICAgaWYgKG9wdGlvbnMuZmV0Y2ggJiYgIShvcHRpb25zLmZldGNoIGluc3RhbmNlb2YgQXJyYXkpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYWxsb3dPckRlbnkgKyBcIjogVmFsdWUgZm9yIGBmZXRjaGAgbXVzdCBiZSBhbiBhcnJheVwiKTtcbiAgICB9XG4gICAgY29sbGVjdGlvbi5fdXBkYXRlRmV0Y2gob3B0aW9ucy5mZXRjaCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gdGhyb3dJZlNlbGVjdG9ySXNOb3RJZChzZWxlY3RvciwgbWV0aG9kTmFtZSkge1xuICBpZiAoIUxvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkUGVyaGFwc0FzT2JqZWN0KHNlbGVjdG9yKSkge1xuICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoXG4gICAgICA0MDMsIFwiTm90IHBlcm1pdHRlZC4gVW50cnVzdGVkIGNvZGUgbWF5IG9ubHkgXCIgKyBtZXRob2ROYW1lICtcbiAgICAgICAgXCIgZG9jdW1lbnRzIGJ5IElELlwiKTtcbiAgfVxufTtcblxuLy8gRGV0ZXJtaW5lIGlmIHdlIGFyZSBpbiBhIEREUCBtZXRob2Qgc2ltdWxhdGlvblxuZnVuY3Rpb24gYWxyZWFkeUluU2ltdWxhdGlvbigpIHtcbiAgdmFyIEN1cnJlbnRJbnZvY2F0aW9uID1cbiAgICBERFAuX0N1cnJlbnRNZXRob2RJbnZvY2F0aW9uIHx8XG4gICAgLy8gRm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LCBhcyBleHBsYWluZWQgaW4gdGhpcyBpc3N1ZTpcbiAgICAvLyBodHRwczovL2dpdGh1Yi5jb20vbWV0ZW9yL21ldGVvci9pc3N1ZXMvODk0N1xuICAgIEREUC5fQ3VycmVudEludm9jYXRpb247XG5cbiAgY29uc3QgZW5jbG9zaW5nID0gQ3VycmVudEludm9jYXRpb24uZ2V0KCk7XG4gIHJldHVybiBlbmNsb3NpbmcgJiYgZW5jbG9zaW5nLmlzU2ltdWxhdGlvbjtcbn1cbiJdfQ==

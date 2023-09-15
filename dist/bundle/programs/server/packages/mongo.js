Package["core-runtime"].queue("mongo", ["meteor", "npm-mongo", "allow-deny", "random", "ejson", "minimongo", "ddp", "tracker", "diff-sequence", "mongo-id", "check", "ecmascript", "logging", "mongo-decimal", "underscore", "binary-heap", "callback-hook", "ddp-client", "ddp-server", "modules", "ecmascript-runtime", "babel-runtime", "promise", "dynamic-import", "ecmascript-runtime-client", "ecmascript-runtime-server"], function () {/* Imports */
var Meteor = Package.meteor.Meteor;
var global = Package.meteor.global;
var meteorEnv = Package.meteor.meteorEnv;
var EmitterPromise = Package.meteor.EmitterPromise;
var NpmModuleMongodb = Package['npm-mongo'].NpmModuleMongodb;
var NpmModuleMongodbVersion = Package['npm-mongo'].NpmModuleMongodbVersion;
var AllowDeny = Package['allow-deny'].AllowDeny;
var Random = Package.random.Random;
var EJSON = Package.ejson.EJSON;
var LocalCollection = Package.minimongo.LocalCollection;
var Minimongo = Package.minimongo.Minimongo;
var DDP = Package['ddp-client'].DDP;
var DDPServer = Package['ddp-server'].DDPServer;
var Tracker = Package.tracker.Tracker;
var Deps = Package.tracker.Deps;
var DiffSequence = Package['diff-sequence'].DiffSequence;
var MongoID = Package['mongo-id'].MongoID;
var check = Package.check.check;
var Match = Package.check.Match;
var ECMAScript = Package.ecmascript.ECMAScript;
var Log = Package.logging.Log;
var Decimal = Package['mongo-decimal'].Decimal;
var _ = Package.underscore._;
var MaxHeap = Package['binary-heap'].MaxHeap;
var MinHeap = Package['binary-heap'].MinHeap;
var MinMaxHeap = Package['binary-heap'].MinMaxHeap;
var Hook = Package['callback-hook'].Hook;
var meteorInstall = Package.modules.meteorInstall;
var Promise = Package.promise.Promise;

/* Package-scope variables */
var MongoInternals, MongoConnection, CursorDescription, Cursor, listenAll, forEachTrigger, OPLOG_COLLECTION, idForOp, OplogHandle, ObserveMultiplexer, options, ObserveHandle, PollingObserveDriver, OplogObserveDriver, Mongo, selector;

var require = meteorInstall({"node_modules":{"meteor":{"mongo":{"mongo_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_driver.js                                                                                      //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let normalizeProjection;
    module1.link("./mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 0);
    let DocFetcher;
    module1.link("./doc_fetcher.js", {
      DocFetcher(v) {
        DocFetcher = v;
      }
    }, 1);
    let ASYNC_CURSOR_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_CURSOR_METHODS(v) {
        ASYNC_CURSOR_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 2);
    let Meteor;
    module1.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 3);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * Provide a synchronous Collection API using fibers, backed by
     * MongoDB.  This is only for use on the server, and mostly identical
     * to the client API.
     *
     * NOTE: the public API methods must be run within a fiber. If you call
     * these outside of a fiber they will explode!
     */

    const path = require("path");
    const util = require("util");

    /** @type {import('mongodb')} */
    var MongoDB = NpmModuleMongodb;
    MongoInternals = {};
    MongoInternals.__packageName = 'mongo';
    MongoInternals.NpmModules = {
      mongodb: {
        version: NpmModuleMongodbVersion,
        module: MongoDB
      }
    };

    // Older version of what is now available via
    // MongoInternals.NpmModules.mongodb.module.  It was never documented, but
    // people do use it.
    // XXX COMPAT WITH 1.0.3.2
    MongoInternals.NpmModule = MongoDB;
    const FILE_ASSET_SUFFIX = 'Asset';
    const ASSETS_FOLDER = 'assets';
    const APP_FOLDER = 'app';

    // This is used to add or remove EJSON from the beginning of everything nested
    // inside an EJSON custom type. It should only be called on pure JSON!
    var replaceNames = function (filter, thing) {
      if (typeof thing === "object" && thing !== null) {
        if (_.isArray(thing)) {
          return _.map(thing, _.bind(replaceNames, null, filter));
        }
        var ret = {};
        _.each(thing, function (value, key) {
          ret[filter(key)] = replaceNames(filter, value);
        });
        return ret;
      }
      return thing;
    };

    // Ensure that EJSON.clone keeps a Timestamp as a Timestamp (instead of just
    // doing a structural clone).
    // XXX how ok is this? what if there are multiple copies of MongoDB loaded?
    MongoDB.Timestamp.prototype.clone = function () {
      // Timestamps should be immutable.
      return this;
    };
    var makeMongoLegal = function (name) {
      return "EJSON" + name;
    };
    var unmakeMongoLegal = function (name) {
      return name.substr(5);
    };
    var replaceMongoAtomWithMeteor = function (document) {
      if (document instanceof MongoDB.Binary) {
        // for backwards compatibility
        if (document.sub_type !== 0) {
          return document;
        }
        var buffer = document.value(true);
        return new Uint8Array(buffer);
      }
      if (document instanceof MongoDB.ObjectID) {
        return new Mongo.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Decimal128) {
        return Decimal(document.toString());
      }
      if (document["EJSON$type"] && document["EJSON$value"] && _.size(document) === 2) {
        return EJSON.fromJSONValue(replaceNames(unmakeMongoLegal, document));
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      return undefined;
    };
    var replaceMeteorAtomWithMongo = function (document) {
      if (EJSON.isBinary(document)) {
        // This does more copies than we'd like, but is necessary because
        // MongoDB.BSON only looks like it takes a Uint8Array (and doesn't actually
        // serialize it correctly).
        return new MongoDB.Binary(Buffer.from(document));
      }
      if (document instanceof MongoDB.Binary) {
        return document;
      }
      if (document instanceof Mongo.ObjectID) {
        return new MongoDB.ObjectID(document.toHexString());
      }
      if (document instanceof MongoDB.Timestamp) {
        // For now, the Meteor representation of a Mongo timestamp type (not a date!
        // this is a weird internal thing used in the oplog!) is the same as the
        // Mongo representation. We need to do this explicitly or else we would do a
        // structural clone and lose the prototype.
        return document;
      }
      if (document instanceof Decimal) {
        return MongoDB.Decimal128.fromString(document.toString());
      }
      if (EJSON._isCustomType(document)) {
        return replaceNames(makeMongoLegal, EJSON.toJSONValue(document));
      }
      // It is not ordinarily possible to stick dollar-sign keys into mongo
      // so we don't bother checking for things that need escaping at this time.
      return undefined;
    };
    var replaceTypes = function (document, atomTransformer) {
      if (typeof document !== 'object' || document === null) return document;
      var replacedTopLevelAtom = atomTransformer(document);
      if (replacedTopLevelAtom !== undefined) return replacedTopLevelAtom;
      var ret = document;
      _.each(document, function (val, key) {
        var valReplaced = replaceTypes(val, atomTransformer);
        if (val !== valReplaced) {
          // Lazy clone. Shallow copy.
          if (ret === document) ret = _.clone(document);
          ret[key] = valReplaced;
        }
      });
      return ret;
    };
    MongoConnection = function (url, options) {
      var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
      var self = this;
      options = options || {};
      self._observeMultiplexers = {};
      self._onFailoverHook = new Hook();
      const userOptions = _objectSpread(_objectSpread({}, Mongo._connectionOptions || {}), ((_Meteor$settings = Meteor.settings) === null || _Meteor$settings === void 0 ? void 0 : (_Meteor$settings$pack = _Meteor$settings.packages) === null || _Meteor$settings$pack === void 0 ? void 0 : (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) === null || _Meteor$settings$pack2 === void 0 ? void 0 : _Meteor$settings$pack2.options) || {});
      var mongoOptions = Object.assign({
        ignoreUndefined: true
      }, userOptions);

      // Internally the oplog connections specify their own maxPoolSize
      // which we don't want to overwrite with any user defined value
      if (_.has(options, 'maxPoolSize')) {
        // If we just set this for "server", replSet will override it. If we just
        // set it for replSet, it will be ignored if we're not using a replSet.
        mongoOptions.maxPoolSize = options.maxPoolSize;
      }

      // Transform options like "tlsCAFileAsset": "filename.pem" into
      // "tlsCAFile": "/<fullpath>/filename.pem"
      Object.entries(mongoOptions || {}).filter(_ref => {
        let [key] = _ref;
        return key && key.endsWith(FILE_ASSET_SUFFIX);
      }).forEach(_ref2 => {
        let [key, value] = _ref2;
        const optionName = key.replace(FILE_ASSET_SUFFIX, '');
        mongoOptions[optionName] = path.join(Assets.getServerDir(), ASSETS_FOLDER, APP_FOLDER, value);
        delete mongoOptions[key];
      });
      self.db = null;
      self._oplogHandle = null;
      self._docFetcher = null;
      self.client = new MongoDB.MongoClient(url, mongoOptions);
      self.db = self.client.db();
      self.client.on('serverDescriptionChanged', Meteor.bindEnvironment(event => {
        // When the connection is no longer against the primary node, execute all
        // failover hooks. This is important for the driver as it has to re-pool the
        // query when it happens.
        if (event.previousDescription.type !== 'RSPrimary' && event.newDescription.type === 'RSPrimary') {
          self._onFailoverHook.each(callback => {
            callback();
            return true;
          });
        }
      }));
      if (options.oplogUrl && !Package['disable-oplog']) {
        self._oplogHandle = new OplogHandle(options.oplogUrl, self.db.databaseName);
        self._docFetcher = new DocFetcher(self);
      }
    };
    MongoConnection.prototype._close = async function () {
      var self = this;
      if (!self.db) throw Error("close called before Connection created?");

      // XXX probably untested
      var oplogHandle = self._oplogHandle;
      self._oplogHandle = null;
      if (oplogHandle) await oplogHandle.stop();

      // Use Future.wrap so that errors get thrown. This happens to
      // work even outside a fiber since the 'close' method is not
      // actually asynchronous.
      await self.client.close();
    };
    MongoConnection.prototype.close = function () {
      return this._close();
    };

    // Returns the Mongo Collection object; may yield.
    MongoConnection.prototype.rawCollection = function (collectionName) {
      var self = this;
      if (!self.db) throw Error("rawCollection called before Connection created?");
      return self.db.collection(collectionName);
    };
    MongoConnection.prototype.createCappedCollectionAsync = async function (collectionName, byteSize, maxDocuments) {
      var self = this;
      if (!self.db) throw Error("createCappedCollectionAsync called before Connection created?");
      await self.db.createCollection(collectionName, {
        capped: true,
        size: byteSize,
        max: maxDocuments
      });
    };

    // This should be called synchronously with a write, to create a
    // transaction on the current write fence, if any. After we can read
    // the write, and after observers have been notified (or at least,
    // after the observer notifiers have added themselves to the write
    // fence), you should call 'committed()' on the object returned.
    MongoConnection.prototype._maybeBeginWrite = function () {
      const fence = DDPServer._getCurrentFence();
      if (fence) {
        return fence.beginWrite();
      } else {
        return {
          committed: function () {}
        };
      }
    };

    // Internal interface: adds a callback which is called when the Mongo primary
    // changes. Returns a stop handle.
    MongoConnection.prototype._onFailover = function (callback) {
      return this._onFailoverHook.register(callback);
    };

    //////////// Public API //////////

    // The write methods block until the database has confirmed the write (it may
    // not be replicated or stable on disk, but one server has confirmed it) if no
    // callback is provided. If a callback is provided, then they call the callback
    // when the write is confirmed. They return nothing on success, and raise an
    // exception on failure.
    //
    // After making a write (with insert, update, remove), observers are
    // notified asynchronously. If you want to receive a callback once all
    // of the observer notifications have landed for your write, do the
    // writes inside a write fence (set DDPServer._CurrentWriteFence to a new
    // _WriteFence, and then set a callback on the write fence.)
    //
    // Since our execution environment is single-threaded, this is
    // well-defined -- a write "has been made" if it's returned, and an
    // observer "has been notified" if its callback has returned.

    var writeCallback = function (write, refresh, callback) {
      return function (err, result) {
        if (!err) {
          // XXX We don't have to run this on error, right?
          try {
            refresh();
          } catch (refreshErr) {
            if (callback) {
              callback(refreshErr);
              return;
            } else {
              throw refreshErr;
            }
          }
        }
        write.committed();
        if (callback) {
          callback(err, result);
        } else if (err) {
          throw err;
        }
      };
    };
    var bindEnvironmentForWrite = function (callback) {
      return Meteor.bindEnvironment(callback, "Mongo write");
    };
    MongoConnection.prototype.insertAsync = async function (collection_name, document) {
      const self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        const e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      if (!(LocalCollection._isPlainObject(document) && !EJSON._isCustomType(document))) {
        throw new Error("Only plain objects may be inserted into MongoDB");
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          collection: collection_name,
          id: document._id
        });
      };
      return self.rawCollection(collection_name).insertOne(replaceTypes(document, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref3 => {
        let {
          insertedId
        } = _ref3;
        await refresh();
        await write.committed();
        return insertedId;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // Cause queries that may be affected by the selector to poll in this write
    // fence.
    MongoConnection.prototype._refresh = async function (collectionName, selector) {
      var refreshKey = {
        collection: collectionName
      };
      // If we know which documents we're removing, don't poll queries that are
      // specific to other documents. (Note that multiple notifications here should
      // not cause multiple polls, since all our listener is doing is enqueueing a
      // poll.)
      var specificIds = LocalCollection._idsMatchedBySelector(selector);
      if (specificIds) {
        for (const id of specificIds) {
          await Meteor.refresh(_.extend({
            id: id
          }, refreshKey));
        }
      } else {
        await Meteor.refresh(refreshKey);
      }
    };
    MongoConnection.prototype.removeAsync = async function (collection_name, selector) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      return self.rawCollection(collection_name).deleteMany(replaceTypes(selector, replaceMeteorAtomWithMongo), {
        safe: true
      }).then(async _ref4 => {
        let {
          deletedCount
        } = _ref4;
        await refresh();
        await write.committed();
        return transformResult({
          result: {
            modifiedCount: deletedCount
          }
        }).numberAffected;
      }).catch(async err => {
        await write.committed();
        throw err;
      });
    };
    MongoConnection.prototype.dropCollectionAsync = async function (collectionName) {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = function () {
        return Meteor.refresh({
          collection: collectionName,
          id: null,
          dropCollection: true
        });
      };
      return self.rawCollection(collectionName).drop().then(async result => {
        await refresh();
        await write.committed();
        return result;
      }).catch(async e => {
        await write.committed();
        throw e;
      });
    };

    // For testing only.  Slightly better than `c.rawDatabase().dropDatabase()`
    // because it lets the test's fence wait for it to be complete.
    MongoConnection.prototype.dropDatabaseAsync = async function () {
      var self = this;
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await Meteor.refresh({
          dropDatabase: true
        });
      };
      try {
        await self.db._dropDatabase();
        await refresh();
        await write.committed();
      } catch (e) {
        await write.committed();
        throw e;
      }
    };
    MongoConnection.prototype.updateAsync = async function (collection_name, selector, mod, options) {
      var self = this;
      if (collection_name === "___meteor_failure_test_collection") {
        var e = new Error("Failure test");
        e._expectedByTest = true;
        throw e;
      }

      // explicit safety check. null and undefined can crash the mongo
      // driver. Although the node driver and minimongo do 'support'
      // non-object modifier in that they don't crash, they are not
      // meaningful operations and do not do anything. Defensively throw an
      // error here.
      if (!mod || typeof mod !== 'object') {
        const error = new Error("Invalid modifier. Modifier must be an object.");
        throw error;
      }
      if (!(LocalCollection._isPlainObject(mod) && !EJSON._isCustomType(mod))) {
        const error = new Error("Only plain objects may be used as replacement" + " documents in MongoDB");
        throw error;
      }
      if (!options) options = {};
      var write = self._maybeBeginWrite();
      var refresh = async function () {
        await self._refresh(collection_name, selector);
      };
      var collection = self.rawCollection(collection_name);
      var mongoOpts = {
        safe: true
      };
      // Add support for filtered positional operator
      if (options.arrayFilters !== undefined) mongoOpts.arrayFilters = options.arrayFilters;
      // explictly enumerate options that minimongo supports
      if (options.upsert) mongoOpts.upsert = true;
      if (options.multi) mongoOpts.multi = true;
      // Lets you get a more more full result from MongoDB. Use with caution:
      // might not work with C.upsert (as opposed to C.update({upsert:true}) or
      // with simulated upsert.
      if (options.fullResult) mongoOpts.fullResult = true;
      var mongoSelector = replaceTypes(selector, replaceMeteorAtomWithMongo);
      var mongoMod = replaceTypes(mod, replaceMeteorAtomWithMongo);
      var isModify = LocalCollection._isModificationMod(mongoMod);
      if (options._forbidReplace && !isModify) {
        var err = new Error("Invalid modifier. Replacements are forbidden.");
        throw err;
      }

      // We've already run replaceTypes/replaceMeteorAtomWithMongo on
      // selector and mod.  We assume it doesn't matter, as far as
      // the behavior of modifiers is concerned, whether `_modify`
      // is run on EJSON or on mongo-converted EJSON.

      // Run this code up front so that it fails fast if someone uses
      // a Mongo update operator we don't support.
      let knownId;
      if (options.upsert) {
        try {
          let newDoc = LocalCollection._createUpsertDocument(selector, mod);
          knownId = newDoc._id;
        } catch (err) {
          throw err;
        }
      }
      if (options.upsert && !isModify && !knownId && options.insertedId && !(options.insertedId instanceof Mongo.ObjectID && options.generatedId)) {
        // In case of an upsert with a replacement, where there is no _id defined
        // in either the query or the replacement doc, mongo will generate an id itself.
        // Therefore we need this special strategy if we want to control the id ourselves.

        // We don't need to do this when:
        // - This is not a replacement, so we can add an _id to $setOnInsert
        // - The id is defined by query or mod we can just add it to the replacement doc
        // - The user did not specify any id preference and the id is a Mongo ObjectId,
        //     then we can just let Mongo generate the id
        return await simulateUpsertWithInsertedId(collection, mongoSelector, mongoMod, options).then(async result => {
          await refresh();
          await write.committed();
          if (result && !options._returnObject) {
            return result.numberAffected;
          } else {
            return result;
          }
        });
      } else {
        if (options.upsert && !knownId && options.insertedId && isModify) {
          if (!mongoMod.hasOwnProperty('$setOnInsert')) {
            mongoMod.$setOnInsert = {};
          }
          knownId = options.insertedId;
          Object.assign(mongoMod.$setOnInsert, replaceTypes({
            _id: options.insertedId
          }, replaceMeteorAtomWithMongo));
        }
        const strings = Object.keys(mongoMod).filter(key => !key.startsWith("$"));
        let updateMethod = strings.length > 0 ? 'replaceOne' : 'updateMany';
        updateMethod = updateMethod === 'updateMany' && !mongoOpts.multi ? 'updateOne' : updateMethod;
        return collection[updateMethod].bind(collection)(mongoSelector, mongoMod, mongoOpts).then(async result => {
          var meteorResult = transformResult({
            result
          });
          if (meteorResult && options._returnObject) {
            // If this was an upsertAsync() call, and we ended up
            // inserting a new doc and we know its id, then
            // return that id as well.
            if (options.upsert && meteorResult.insertedId) {
              if (knownId) {
                meteorResult.insertedId = knownId;
              } else if (meteorResult.insertedId instanceof MongoDB.ObjectID) {
                meteorResult.insertedId = new Mongo.ObjectID(meteorResult.insertedId.toHexString());
              }
            }
            await refresh();
            await write.committed();
            return meteorResult;
          } else {
            await refresh();
            await write.committed();
            return meteorResult.numberAffected;
          }
        }).catch(async err => {
          await write.committed();
          throw err;
        });
      }
    };
    var transformResult = function (driverResult) {
      var meteorResult = {
        numberAffected: 0
      };
      if (driverResult) {
        var mongoResult = driverResult.result;
        // On updates with upsert:true, the inserted values come as a list of
        // upserted values -- even with options.multi, when the upsert does insert,
        // it only inserts one element.
        if (mongoResult.upsertedCount) {
          meteorResult.numberAffected = mongoResult.upsertedCount;
          if (mongoResult.upsertedId) {
            meteorResult.insertedId = mongoResult.upsertedId;
          }
        } else {
          // n was used before Mongo 5.0, in Mongo 5.0 we are not receiving this n
          // field and so we are using modifiedCount instead
          meteorResult.numberAffected = mongoResult.n || mongoResult.matchedCount || mongoResult.modifiedCount;
        }
      }
      return meteorResult;
    };
    var NUM_OPTIMISTIC_TRIES = 3;

    // exposed for testing
    MongoConnection._isCannotChangeIdError = function (err) {
      // Mongo 3.2.* returns error as next Object:
      // {name: String, code: Number, errmsg: String}
      // Older Mongo returns:
      // {name: String, code: Number, err: String}
      var error = err.errmsg || err.err;

      // We don't use the error code here
      // because the error code we observed it producing (16837) appears to be
      // a far more generic error code based on examining the source.
      if (error.indexOf('The _id field cannot be changed') === 0 || error.indexOf("the (immutable) field '_id' was found to have been altered to _id") !== -1) {
        return true;
      }
      return false;
    };
    var simulateUpsertWithInsertedId = async function (collection, selector, mod, options) {
      // STRATEGY: First try doing an upsert with a generated ID.
      // If this throws an error about changing the ID on an existing document
      // then without affecting the database, we know we should probably try
      // an update without the generated ID. If it affected 0 documents,
      // then without affecting the database, we the document that first
      // gave the error is probably removed and we need to try an insert again
      // We go back to step one and repeat.
      // Like all "optimistic write" schemes, we rely on the fact that it's
      // unlikely our writes will continue to be interfered with under normal
      // circumstances (though sufficiently heavy contention with writers
      // disagreeing on the existence of an object will cause writes to fail
      // in theory).

      var insertedId = options.insertedId; // must exist
      var mongoOptsForUpdate = {
        safe: true,
        multi: options.multi
      };
      var mongoOptsForInsert = {
        safe: true,
        upsert: true
      };
      var replacementWithId = Object.assign(replaceTypes({
        _id: insertedId
      }, replaceMeteorAtomWithMongo), mod);
      var tries = NUM_OPTIMISTIC_TRIES;
      var doUpdate = async function () {
        tries--;
        if (!tries) {
          throw new Error("Upsert failed after " + NUM_OPTIMISTIC_TRIES + " tries.");
        } else {
          let method = collection.updateMany;
          if (!Object.keys(mod).some(key => key.startsWith("$"))) {
            method = collection.replaceOne.bind(collection);
          }
          return method(selector, mod, mongoOptsForUpdate).then(result => {
            if (result && (result.modifiedCount || result.upsertedCount)) {
              return {
                numberAffected: result.modifiedCount || result.upsertedCount,
                insertedId: result.upsertedId || undefined
              };
            } else {
              return doConditionalInsert();
            }
          });
        }
      };
      var doConditionalInsert = function () {
        return collection.replaceOne(selector, replacementWithId, mongoOptsForInsert).then(result => ({
          numberAffected: result.upsertedCount,
          insertedId: result.upsertedId
        })).catch(err => {
          if (MongoConnection._isCannotChangeIdError(err)) {
            return doUpdate();
          } else {
            throw err;
          }
        });
      };
      return doUpdate();
    };

    // XXX MongoConnection.upsertAsync() does not return the id of the inserted document
    // unless you set it explicitly in the selector or modifier (as a replacement
    // doc).
    MongoConnection.prototype.upsertAsync = async function (collectionName, selector, mod, options) {
      var self = this;
      return self.updateAsync(collectionName, selector, mod, _.extend({}, options, {
        upsert: true,
        _returnObject: true
      }));
    };
    MongoConnection.prototype.find = function (collectionName, selector, options) {
      var self = this;
      if (arguments.length === 1) selector = {};
      return new Cursor(self, new CursorDescription(collectionName, selector, options));
    };
    MongoConnection.prototype.findOneAsync = async function (collection_name, selector, options) {
      var self = this;
      if (arguments.length === 1) {
        selector = {};
      }
      options = options || {};
      options.limit = 1;
      const results = await self.find(collection_name, selector, options).fetch();
      return results[0];
    };

    // We'll actually design an index API later. For now, we just pass through to
    // Mongo's, but make it synchronous.
    MongoConnection.prototype.createIndexAsync = async function (collectionName, index, options) {
      var self = this;

      // We expect this function to be called at startup, not from within a method,
      // so we don't interact with the write fence.
      var collection = self.rawCollection(collectionName);
      await collection.createIndex(index, options);
    };

    // just to be consistent with the other methods
    MongoConnection.prototype.createIndex = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.countDocuments = function (collectionName) {
      for (var _len = arguments.length, args = new Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.countDocuments(...args);
    };
    MongoConnection.prototype.estimatedDocumentCount = function (collectionName) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      args = args.map(arg => replaceTypes(arg, replaceMeteorAtomWithMongo));
      const collection = this.rawCollection(collectionName);
      return collection.estimatedDocumentCount(...args);
    };
    MongoConnection.prototype.ensureIndexAsync = MongoConnection.prototype.createIndexAsync;
    MongoConnection.prototype.dropIndexAsync = async function (collectionName, index) {
      var self = this;

      // This function is only used by test code, not within a method, so we don't
      // interact with the write fence.
      var collection = self.rawCollection(collectionName);
      var indexName = await collection.dropIndex(index);
    };

    // CURSORS

    // There are several classes which relate to cursors:
    //
    // CursorDescription represents the arguments used to construct a cursor:
    // collectionName, selector, and (find) options.  Because it is used as a key
    // for cursor de-dup, everything in it should either be JSON-stringifiable or
    // not affect observeChanges output (eg, options.transform functions are not
    // stringifiable but do not affect observeChanges).
    //
    // SynchronousCursor is a wrapper around a MongoDB cursor
    // which includes fully-synchronous versions of forEach, etc.
    //
    // Cursor is the cursor object returned from find(), which implements the
    // documented Mongo.Collection cursor API.  It wraps a CursorDescription and a
    // SynchronousCursor (lazily: it doesn't contact Mongo until you call a method
    // like fetch or forEach on it).
    //
    // ObserveHandle is the "observe handle" returned from observeChanges. It has a
    // reference to an ObserveMultiplexer.
    //
    // ObserveMultiplexer allows multiple identical ObserveHandles to be driven by a
    // single observe driver.
    //
    // There are two "observe drivers" which drive ObserveMultiplexers:
    //   - PollingObserveDriver caches the results of a query and reruns it when
    //     necessary.
    //   - OplogObserveDriver follows the Mongo operation log to directly observe
    //     database changes.
    // Both implementations follow the same simple interface: when you create them,
    // they start sending observeChanges callbacks (and a ready() invocation) to
    // their ObserveMultiplexer, and you stop them by calling their stop() method.

    CursorDescription = function (collectionName, selector, options) {
      var self = this;
      self.collectionName = collectionName;
      self.selector = Mongo.Collection._rewriteSelector(selector);
      self.options = options || {};
    };
    Cursor = function (mongo, cursorDescription) {
      var self = this;
      self._mongo = mongo;
      self._cursorDescription = cursorDescription;
      self._synchronousCursor = null;
    };
    function setupSynchronousCursor(cursor, method) {
      // You can only observe a tailable cursor.
      if (cursor._cursorDescription.options.tailable) throw new Error('Cannot call ' + method + ' on a tailable cursor');
      if (!cursor._synchronousCursor) {
        cursor._synchronousCursor = cursor._mongo._createSynchronousCursor(cursor._cursorDescription, {
          // Make sure that the "cursor" argument to forEach/map callbacks is the
          // Cursor, not the SynchronousCursor.
          selfForIteration: cursor,
          useTransform: true
        });
      }
      return cursor._synchronousCursor;
    }
    Cursor.prototype.countAsync = async function () {
      const collection = this._mongo.rawCollection(this._cursorDescription.collectionName);
      return await collection.countDocuments(replaceTypes(this._cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(this._cursorDescription.options, replaceMeteorAtomWithMongo));
    };
    [...ASYNC_CURSOR_METHODS, Symbol.iterator, Symbol.asyncIterator].forEach(methodName => {
      // count is handled specially since we don't want to create a cursor.
      // it is still included in ASYNC_CURSOR_METHODS because we still want an async version of it to exist.
      if (methodName === 'count') {
        return;
      }
      Cursor.prototype[methodName] = function () {
        const cursor = setupSynchronousCursor(this, methodName);
        return cursor[methodName](...arguments);
      };

      // These methods are handled separately.
      if (methodName === Symbol.iterator || methodName === Symbol.asyncIterator) {
        return;
      }
      const methodNameAsync = getAsyncMethodName(methodName);
      Cursor.prototype[methodNameAsync] = function () {
        try {
          return Promise.resolve(this[methodName](...arguments));
        } catch (error) {
          return Promise.reject(error);
        }
      };
    });
    Cursor.prototype.getTransform = function () {
      return this._cursorDescription.options.transform;
    };

    // When you call Meteor.publish() with a function that returns a Cursor, we need
    // to transmute it into the equivalent subscription.  This is the function that
    // does that.

    Cursor.prototype._publishCursor = function (sub) {
      var self = this;
      var collection = self._cursorDescription.collectionName;
      return Mongo.Collection._publishCursor(self, sub, collection);
    };

    // Used to guarantee that publish functions return at most one cursor per
    // collection. Private, because we might later have cursors that include
    // documents from multiple collections somehow.
    Cursor.prototype._getCollectionName = function () {
      var self = this;
      return self._cursorDescription.collectionName;
    };
    Cursor.prototype.observe = function (callbacks) {
      var self = this;
      return LocalCollection._observeFromObserveChanges(self, callbacks);
    };
    Cursor.prototype.observeChanges = function (callbacks) {
      let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      var self = this;
      var methods = ['addedAt', 'added', 'changedAt', 'changed', 'removedAt', 'removed', 'movedTo'];
      var ordered = LocalCollection._observeChangesCallbacksAreOrdered(callbacks);
      let exceptionName = callbacks._fromObserve ? 'observe' : 'observeChanges';
      exceptionName += ' callback';
      methods.forEach(function (method) {
        if (callbacks[method] && typeof callbacks[method] == "function") {
          callbacks[method] = Meteor.bindEnvironment(callbacks[method], method + exceptionName);
        }
      });
      return self._mongo._observeChanges(self._cursorDescription, ordered, callbacks, options.nonMutatingCallbacks);
    };
    MongoConnection.prototype._createSynchronousCursor = function (cursorDescription, options) {
      var self = this;
      options = _.pick(options || {}, 'selfForIteration', 'useTransform');
      var collection = self.rawCollection(cursorDescription.collectionName);
      var cursorOptions = cursorDescription.options;
      var mongoOptions = {
        sort: cursorOptions.sort,
        limit: cursorOptions.limit,
        skip: cursorOptions.skip,
        projection: cursorOptions.fields || cursorOptions.projection,
        readPreference: cursorOptions.readPreference
      };

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        mongoOptions.numberOfRetries = -1;
      }
      var dbCursor = collection.find(replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), mongoOptions);

      // Do we want a tailable cursor (which only works on capped collections)?
      if (cursorOptions.tailable) {
        // We want a tailable cursor...
        dbCursor.addCursorFlag("tailable", true);
        // ... and for the server to wait a bit if any getMore has no data (rather
        // than making us put the relevant sleeps in the client)...
        dbCursor.addCursorFlag("awaitData", true);

        // And if this is on the oplog collection and the cursor specifies a 'ts',
        // then set the undocumented oplog replay flag, which does a special scan to
        // find the first document (instead of creating an index on ts). This is a
        // very hard-coded Mongo flag which only works on the oplog collection and
        // only works with the ts field.
        if (cursorDescription.collectionName === OPLOG_COLLECTION && cursorDescription.selector.ts) {
          dbCursor.addCursorFlag("oplogReplay", true);
        }
      }
      if (typeof cursorOptions.maxTimeMs !== 'undefined') {
        dbCursor = dbCursor.maxTimeMS(cursorOptions.maxTimeMs);
      }
      if (typeof cursorOptions.hint !== 'undefined') {
        dbCursor = dbCursor.hint(cursorOptions.hint);
      }
      return new AsynchronousCursor(dbCursor, cursorDescription, options, collection);
    };

    /**
     * This is just a light wrapper for the cursor. The goal here is to ensure compatibility even if
     * there are breaking changes on the MongoDB driver.
     *
     * @constructor
     */
    class AsynchronousCursor {
      constructor(dbCursor, cursorDescription, options) {
        this._dbCursor = dbCursor;
        this._cursorDescription = cursorDescription;
        this._selfForIteration = options.selfForIteration || this;
        if (options.useTransform && cursorDescription.options.transform) {
          this._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
        } else {
          this._transform = null;
        }
        this._visitedIds = new LocalCollection._IdMap();
      }
      [Symbol.iterator]() {
        return this._cursor[Symbol.iterator]();
      }

      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      async _rawNextObjectPromise() {
        try {
          return this._dbCursor.next();
        } catch (e) {
          console.error(e);
        }
      }

      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      async _nextObjectPromise() {
        while (true) {
          var doc = await this._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!this._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (this._visitedIds.has(doc._id)) continue;
            this._visitedIds.set(doc._id, true);
          }
          if (this._transform) doc = this._transform(doc);
          return doc;
        }
      }

      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout(timeoutMS) {
        if (!timeoutMS) {
          return this._nextObjectPromise();
        }
        const nextObjectPromise = this._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            this.close();
          }
          throw err;
        });
      }
      async forEach(callback, thisArg) {
        // Get back to the beginning.
        this._rewind();
        let idx = 0;
        while (true) {
          const doc = await this._nextObjectPromise();
          if (!doc) return;
          await callback.call(thisArg, doc, idx++, this._selfForIteration);
        }
      }
      async map(callback, thisArg) {
        const results = [];
        await this.forEach(async (doc, index) => {
          results.push(await callback.call(thisArg, doc, index, this._selfForIteration));
        });
        return results;
      }
      _rewind() {
        // known to be synchronous
        this._dbCursor.rewind();
        this._visitedIds = new LocalCollection._IdMap();
      }

      // Mostly usable for tailable cursors.
      close() {
        this._dbCursor.close();
      }
      fetch() {
        return this.map(_.identity);
      }

      /**
       * FIXME: (node:34680) [MONGODB DRIVER] Warning: cursor.count is deprecated and will be
       *  removed in the next major version, please use `collection.estimatedDocumentCount` or
       *  `collection.countDocuments` instead.
       */
      count() {
        return this._dbCursor.count();
      }

      // This method is NOT wrapped in Cursor.
      async getRawObjects(ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          await self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    }
    var SynchronousCursor = function (dbCursor, cursorDescription, options, collection) {
      var self = this;
      options = _.pick(options || {}, 'selfForIteration', 'useTransform');
      self._dbCursor = dbCursor;
      self._cursorDescription = cursorDescription;
      // The "self" argument passed to forEach/map callbacks. If we're wrapped
      // inside a user-visible Cursor, we want to provide the outer cursor!
      self._selfForIteration = options.selfForIteration || self;
      if (options.useTransform && cursorDescription.options.transform) {
        self._transform = LocalCollection.wrapTransform(cursorDescription.options.transform);
      } else {
        self._transform = null;
      }
      self._synchronousCount = Future.wrap(collection.countDocuments.bind(collection, replaceTypes(cursorDescription.selector, replaceMeteorAtomWithMongo), replaceTypes(cursorDescription.options, replaceMeteorAtomWithMongo)));
      self._visitedIds = new LocalCollection._IdMap();
    };
    _.extend(SynchronousCursor.prototype, {
      // Returns a Promise for the next object from the underlying cursor (before
      // the Mongo->Meteor type replacement).
      _rawNextObjectPromise: function () {
        const self = this;
        return new Promise((resolve, reject) => {
          self._dbCursor.next((err, doc) => {
            if (err) {
              reject(err);
            } else {
              resolve(doc);
            }
          });
        });
      },
      // Returns a Promise for the next object from the cursor, skipping those whose
      // IDs we've already seen and replacing Mongo atoms with Meteor atoms.
      _nextObjectPromise: async function () {
        var self = this;
        while (true) {
          var doc = await self._rawNextObjectPromise();
          if (!doc) return null;
          doc = replaceTypes(doc, replaceMongoAtomWithMeteor);
          if (!self._cursorDescription.options.tailable && _.has(doc, '_id')) {
            // Did Mongo give us duplicate documents in the same cursor? If so,
            // ignore this one. (Do this before the transform, since transform might
            // return some unrelated value.) We don't do this for tailable cursors,
            // because we want to maintain O(1) memory usage. And if there isn't _id
            // for some reason (maybe it's the oplog), then we don't do this either.
            // (Be careful to do this for falsey but existing _id, though.)
            if (self._visitedIds.has(doc._id)) continue;
            self._visitedIds.set(doc._id, true);
          }
          if (self._transform) doc = self._transform(doc);
          return doc;
        }
      },
      // Returns a promise which is resolved with the next object (like with
      // _nextObjectPromise) or rejected if the cursor doesn't return within
      // timeoutMS ms.
      _nextObjectPromiseWithTimeout: function (timeoutMS) {
        const self = this;
        if (!timeoutMS) {
          return self._nextObjectPromise();
        }
        const nextObjectPromise = self._nextObjectPromise();
        const timeoutErr = new Error('Client-side timeout waiting for next object');
        const timeoutPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(timeoutErr);
          }, timeoutMS);
        });
        return Promise.race([nextObjectPromise, timeoutPromise]).catch(err => {
          if (err === timeoutErr) {
            self.close();
          }
          throw err;
        });
      },
      _nextObject: function () {
        var self = this;
        return self._nextObjectPromise().await();
      },
      forEach: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);

        // Get back to the beginning.
        self._rewind();

        // We implement the loop ourself instead of using self._dbCursor.each,
        // because "each" will call its callback outside of a fiber which makes it
        // much more complex to make this function synchronous.
        var index = 0;
        while (true) {
          var doc = self._nextObject();
          if (!doc) return;
          wrappedFn.call(thisArg, doc, index++, self._selfForIteration);
        }
      },
      // XXX Allow overlapping callback executions if callback yields.
      map: function (callback, thisArg) {
        var self = this;
        const wrappedFn = Meteor.wrapFn(callback);
        var res = [];
        self.forEach(function (doc, index) {
          res.push(wrappedFn.call(thisArg, doc, index, self._selfForIteration));
        });
        return res;
      },
      _rewind: function () {
        var self = this;

        // known to be synchronous
        self._dbCursor.rewind();
        self._visitedIds = new LocalCollection._IdMap();
      },
      // Mostly usable for tailable cursors.
      close: function () {
        var self = this;
        self._dbCursor.close();
      },
      fetch: function () {
        var self = this;
        return self.map(_.identity);
      },
      count: function () {
        var self = this;
        return self._synchronousCount().wait();
      },
      // This method is NOT wrapped in Cursor.
      getRawObjects: function (ordered) {
        var self = this;
        if (ordered) {
          return self.fetch();
        } else {
          var results = new LocalCollection._IdMap();
          self.forEach(function (doc) {
            results.set(doc._id, doc);
          });
          return results;
        }
      }
    });
    SynchronousCursor.prototype[Symbol.iterator] = function () {
      var self = this;

      // Get back to the beginning.
      self._rewind();
      return {
        next() {
          const doc = self._nextObject();
          return doc ? {
            value: doc
          } : {
            done: true
          };
        }
      };
    };
    SynchronousCursor.prototype[Symbol.asyncIterator] = function () {
      const syncResult = this[Symbol.iterator]();
      return {
        async next() {
          return Promise.resolve(syncResult.next());
        }
      };
    };

    // Tails the cursor described by cursorDescription, most likely on the
    // oplog. Calls docCallback with each document found. Ignores errors and just
    // restarts the tail on error.
    //
    // If timeoutMS is set, then if we don't get a new document every timeoutMS,
    // kill and restart the cursor. This is primarily a workaround for #8598.
    MongoConnection.prototype.tail = function (cursorDescription, docCallback, timeoutMS) {
      var self = this;
      if (!cursorDescription.options.tailable) throw new Error("Can only tail a tailable cursor");
      var cursor = self._createSynchronousCursor(cursorDescription);
      var stopped = false;
      var lastTS;
      Meteor.defer(async function loop() {
        var doc = null;
        while (true) {
          if (stopped) return;
          try {
            doc = await cursor._nextObjectPromiseWithTimeout(timeoutMS);
          } catch (err) {
            // There's no good way to figure out if this was actually an error from
            // Mongo, or just client-side (including our own timeout error). Ah
            // well. But either way, we need to retry the cursor (unless the failure
            // was because the observe got stopped).
            doc = null;
          }
          // Since we awaited a promise above, we need to check again to see if
          // we've been stopped before calling the callback.
          if (stopped) return;
          if (doc) {
            // If a tailable cursor contains a "ts" field, use it to recreate the
            // cursor on error. ("ts" is a standard that Mongo uses internally for
            // the oplog, and there's a special flag that lets you do binary search
            // on it instead of needing to use an index.)
            lastTS = doc.ts;
            docCallback(doc);
          } else {
            var newSelector = _.clone(cursorDescription.selector);
            if (lastTS) {
              newSelector.ts = {
                $gt: lastTS
              };
            }
            cursor = self._createSynchronousCursor(new CursorDescription(cursorDescription.collectionName, newSelector, cursorDescription.options));
            // Mongo failover takes many seconds.  Retry in a bit.  (Without this
            // setTimeout, we peg the CPU at 100% and never notice the actual
            // failover.
            setTimeout(loop, 100);
            break;
          }
        }
      });
      return {
        stop: function () {
          stopped = true;
          cursor.close();
        }
      };
    };
    Object.assign(MongoConnection.prototype, {
      _observeChanges: async function (cursorDescription, ordered, callbacks, nonMutatingCallbacks) {
        var self = this;
        if (cursorDescription.options.tailable) {
          return self._observeChangesTailable(cursorDescription, ordered, callbacks);
        }

        // You may not filter out _id when observing changes, because the id is a core
        // part of the observeChanges API.
        const fieldsOptions = cursorDescription.options.projection || cursorDescription.options.fields;
        if (fieldsOptions && (fieldsOptions._id === 0 || fieldsOptions._id === false)) {
          throw Error("You may not observe a cursor with {fields: {_id: 0}}");
        }
        var observeKey = EJSON.stringify(_.extend({
          ordered: ordered
        }, cursorDescription));
        var multiplexer, observeDriver;
        var firstHandle = false;

        // Find a matching ObserveMultiplexer, or create a new one. This next block is
        // guaranteed to not yield (and it doesn't call anything that can observe a
        // new query), so no other calls to this function can interleave with it.
        if (_.has(self._observeMultiplexers, observeKey)) {
          multiplexer = self._observeMultiplexers[observeKey];
        } else {
          firstHandle = true;
          // Create a new ObserveMultiplexer.
          multiplexer = new ObserveMultiplexer({
            ordered: ordered,
            onStop: function () {
              delete self._observeMultiplexers[observeKey];
              return observeDriver.stop();
            }
          });
        }
        var observeHandle = new ObserveHandle(multiplexer, callbacks, nonMutatingCallbacks);
        if (firstHandle) {
          var matcher, sorter;
          var canUseOplog = _.all([function () {
            // At a bare minimum, using the oplog requires us to have an oplog, to
            // want unordered callbacks, and to not want a callback on the polls
            // that won't happen.
            return self._oplogHandle && !ordered && !callbacks._testOnlyPollCallback;
          }, function () {
            // We need to be able to compile the selector. Fall back to polling for
            // some newfangled $selector that minimongo doesn't support yet.
            try {
              matcher = new Minimongo.Matcher(cursorDescription.selector);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }, function () {
            // ... and the selector itself needs to support oplog.
            return OplogObserveDriver.cursorSupported(cursorDescription, matcher);
          }, function () {
            // And we need to be able to compile the sort, if any.  eg, can't be
            // {$natural: 1}.
            if (!cursorDescription.options.sort) return true;
            try {
              sorter = new Minimongo.Sorter(cursorDescription.options.sort);
              return true;
            } catch (e) {
              // XXX make all compilation errors MinimongoError or something
              //     so that this doesn't ignore unrelated exceptions
              return false;
            }
          }], function (f) {
            return f();
          }); // invoke each function

          var driverClass = canUseOplog ? OplogObserveDriver : PollingObserveDriver;
          observeDriver = new driverClass({
            cursorDescription: cursorDescription,
            mongoHandle: self,
            multiplexer: multiplexer,
            ordered: ordered,
            matcher: matcher,
            // ignored by polling
            sorter: sorter,
            // ignored by polling
            _testOnlyPollCallback: callbacks._testOnlyPollCallback
          });
          if (observeDriver._init) {
            await observeDriver._init();
          }

          // This field is only set for use in tests.
          multiplexer._observeDriver = observeDriver;
        }
        self._observeMultiplexers[observeKey] = multiplexer;
        // Blocks until the initial adds have been sent.
        await multiplexer.addHandleAndSendInitialAdds(observeHandle);
        return observeHandle;
      }
    });

    // Listen for the invalidation messages that will trigger us to poll the
    // database for changes. If this selector specifies specific IDs, specify them
    // here, so that updates to different specific IDs don't cause us to poll.
    // listenCallback is the same kind of (notification, complete) callback passed
    // to InvalidationCrossbar.listen.

    listenAll = function (cursorDescription, listenCallback) {
      var listeners = [];
      forEachTrigger(cursorDescription, function (trigger) {
        listeners.push(DDPServer._InvalidationCrossbar.listen(trigger, listenCallback));
      });
      return {
        stop: function () {
          _.each(listeners, function (listener) {
            listener.stop();
          });
        }
      };
    };
    forEachTrigger = function (cursorDescription, triggerCallback) {
      var key = {
        collection: cursorDescription.collectionName
      };
      var specificIds = LocalCollection._idsMatchedBySelector(cursorDescription.selector);
      if (specificIds) {
        _.each(specificIds, function (id) {
          triggerCallback(_.extend({
            id: id
          }, key));
        });
        triggerCallback(_.extend({
          dropCollection: true,
          id: null
        }, key));
      } else {
        triggerCallback(key);
      }
      // Everyone cares about the database being dropped.
      triggerCallback({
        dropDatabase: true
      });
    };

    // observeChanges for tailable cursors on capped collections.
    //
    // Some differences from normal cursors:
    //   - Will never produce anything other than 'added' or 'addedBefore'. If you
    //     do update a document that has already been produced, this will not notice
    //     it.
    //   - If you disconnect and reconnect from Mongo, it will essentially restart
    //     the query, which will lead to duplicate results. This is pretty bad,
    //     but if you include a field called 'ts' which is inserted as
    //     new MongoInternals.MongoTimestamp(0, 0) (which is initialized to the
    //     current Mongo-style timestamp), we'll be able to find the place to
    //     restart properly. (This field is specifically understood by Mongo with an
    //     optimization which allows it to find the right place to start without
    //     an index on ts. It's how the oplog works.)
    //   - No callbacks are triggered synchronously with the call (there's no
    //     differentiation between "initial data" and "later changes"; everything
    //     that matches the query gets sent asynchronously).
    //   - De-duplication is not implemented.
    //   - Does not yet interact with the write fence. Probably, this should work by
    //     ignoring removes (which don't work on capped collections) and updates
    //     (which don't affect tailable cursors), and just keeping track of the ID
    //     of the inserted object, and closing the write fence once you get to that
    //     ID (or timestamp?).  This doesn't work well if the document doesn't match
    //     the query, though.  On the other hand, the write fence can close
    //     immediately if it does not match the query. So if we trust minimongo
    //     enough to accurately evaluate the query against the write fence, we
    //     should be able to do this...  Of course, minimongo doesn't even support
    //     Mongo Timestamps yet.
    MongoConnection.prototype._observeChangesTailable = function (cursorDescription, ordered, callbacks) {
      var self = this;

      // Tailable cursors only ever call added/addedBefore callbacks, so it's an
      // error if you didn't provide them.
      if (ordered && !callbacks.addedBefore || !ordered && !callbacks.added) {
        throw new Error("Can't observe an " + (ordered ? "ordered" : "unordered") + " tailable cursor without a " + (ordered ? "addedBefore" : "added") + " callback");
      }
      return self.tail(cursorDescription, function (doc) {
        var id = doc._id;
        delete doc._id;
        // The ts is an implementation detail. Hide it.
        delete doc.ts;
        if (ordered) {
          callbacks.addedBefore(id, doc, null);
        } else {
          callbacks.added(id, doc);
        }
      });
    };

    // XXX We probably need to find a better way to expose this. Right now
    // it's only used by tests, but in fact you need it in normal
    // operation to interact with capped collections.
    MongoInternals.MongoTimestamp = MongoDB.Timestamp;
    MongoInternals.Connection = MongoConnection;
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_tailing.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_tailing.js                                                                                     //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let NpmModuleMongodb;
    module.link("meteor/npm-mongo", {
      NpmModuleMongodb(v) {
        NpmModuleMongodb = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const {
      Long
    } = NpmModuleMongodb;
    OPLOG_COLLECTION = 'oplog.rs';
    var TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
    var TAIL_TIMEOUT = +process.env.METEOR_OPLOG_TAIL_TIMEOUT || 30000;
    idForOp = function (op) {
      if (op.op === 'd') return op.o._id;else if (op.op === 'i') return op.o._id;else if (op.op === 'u') return op.o2._id;else if (op.op === 'c') throw Error("Operator 'c' doesn't supply an object with id: " + EJSON.stringify(op));else throw Error("Unknown op: " + EJSON.stringify(op));
    };
    OplogHandle = function (oplogUrl, dbName) {
      var self = this;
      self._oplogUrl = oplogUrl;
      self._dbName = dbName;
      self._oplogLastEntryConnection = null;
      self._oplogTailConnection = null;
      self._stopped = false;
      self._tailHandle = null;
      self._readyPromiseResolver = null;
      self._readyPromise = new Promise(r => self._readyPromiseResolver = r);
      self._crossbar = new DDPServer._Crossbar({
        factPackage: "mongo-livedata",
        factName: "oplog-watchers"
      });
      self._baseOplogSelector = {
        ns: new RegExp("^(?:" + [Meteor._escapeRegExp(self._dbName + "."), Meteor._escapeRegExp("admin.$cmd")].join("|") + ")"),
        $or: [{
          op: {
            $in: ['i', 'u', 'd']
          }
        },
        // drop collection
        {
          op: 'c',
          'o.drop': {
            $exists: true
          }
        }, {
          op: 'c',
          'o.dropDatabase': 1
        }, {
          op: 'c',
          'o.applyOps': {
            $exists: true
          }
        }]
      };

      // Data structures to support waitUntilCaughtUp(). Each oplog entry has a
      // MongoTimestamp object on it (which is not the same as a Date --- it's a
      // combination of time and an incrementing counter; see
      // http://docs.mongodb.org/manual/reference/bson-types/#timestamps).
      //
      // _catchingUpFutures is an array of {ts: MongoTimestamp, future: Future}
      // objects, sorted by ascending timestamp. _lastProcessedTS is the
      // MongoTimestamp of the last oplog entry we've processed.
      //
      // Each time we call waitUntilCaughtUp, we take a peek at the final oplog
      // entry in the db.  If we've already processed it (ie, it is not greater than
      // _lastProcessedTS), waitUntilCaughtUp immediately returns. Otherwise,
      // waitUntilCaughtUp makes a new Future and inserts it along with the final
      // timestamp entry that it read, into _catchingUpFutures. waitUntilCaughtUp
      // then waits on that future, which is resolved once _lastProcessedTS is
      // incremented to be past its timestamp by the worker fiber.
      //
      // XXX use a priority queue or something else that's faster than an array
      self._catchingUpResolvers = [];
      self._lastProcessedTS = null;
      self._onSkippedEntriesHook = new Hook({
        debugPrintExceptions: "onSkippedEntries callback"
      });
      self._entryQueue = new Meteor._DoubleEndedQueue();
      self._workerActive = false;
      const shouldAwait = self._startTailing();
      //TODO[fibers] Why wait?
    };

    Object.assign(OplogHandle.prototype, {
      stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;
        if (self._tailHandle) await self._tailHandle.stop();
        // XXX should close connections too
      },

      _onOplogEntry: async function (trigger, callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onOplogEntry on stopped handle!");

        // Calling onOplogEntry requires us to wait for the tailing to be ready.
        await self._readyPromise;
        var originalCallback = callback;
        callback = Meteor.bindEnvironment(function (notification) {
          originalCallback(notification);
        }, function (err) {
          Meteor._debug("Error in oplog callback", err);
        });
        var listenHandle = self._crossbar.listen(trigger, callback);
        return {
          stop: async function () {
            await listenHandle.stop();
          }
        };
      },
      onOplogEntry: function (trigger, callback) {
        return this._onOplogEntry(trigger, callback);
      },
      // Register a callback to be invoked any time we skip oplog entries (eg,
      // because we are too far behind).
      onSkippedEntries: function (callback) {
        var self = this;
        if (self._stopped) throw new Error("Called onSkippedEntries on stopped handle!");
        return self._onSkippedEntriesHook.register(callback);
      },
      async _waitUntilCaughtUp() {
        var self = this;
        if (self._stopped) throw new Error("Called waitUntilCaughtUp on stopped handle!");

        // Calling waitUntilCaughtUp requries us to wait for the oplog connection to
        // be ready.
        await self._readyPromise;
        var lastEntry;
        while (!self._stopped) {
          // We need to make the selector at least as restrictive as the actual
          // tailing selector (ie, we need to specify the DB name) or else we might
          // find a TS that won't show up in the actual tail stream.
          try {
            lastEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, self._baseOplogSelector, {
              projection: {
                ts: 1
              },
              sort: {
                $natural: -1
              }
            });
            break;
          } catch (e) {
            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while reading last entry", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        if (!lastEntry) {
          // Really, nothing in the oplog? Well, we've processed everything.
          return;
        }
        var ts = lastEntry.ts;
        if (!ts) throw Error("oplog entry without ts: " + EJSON.stringify(lastEntry));
        if (self._lastProcessedTS && ts.lessThanOrEqual(self._lastProcessedTS)) {
          // We've already caught up to here.
          return;
        }

        // Insert the future into our list. Almost always, this will be at the end,
        // but it's conceivable that if we fail over from one primary to another,
        // the oplog entries we see will go backwards.
        var insertAfter = self._catchingUpResolvers.length;
        while (insertAfter - 1 > 0 && self._catchingUpResolvers[insertAfter - 1].ts.greaterThan(ts)) {
          insertAfter--;
        }
        let promiseResolver = null;
        const promiseToAwait = new Promise(r => promiseResolver = r);
        self._catchingUpResolvers.splice(insertAfter, 0, {
          ts: ts,
          resolver: promiseResolver
        });
        await promiseToAwait;
      },
      // Calls `callback` once the oplog has been processed up to a point that is
      // roughly "now": specifically, once we've processed all ops that are
      // currently visible.
      // XXX become convinced that this is actually safe even if oplogConnection
      // is some kind of pool
      waitUntilCaughtUp: function () {
        return this._waitUntilCaughtUp();
      },
      _startTailing: async function () {
        var self = this;
        // First, make sure that we're talking to the local database.
        var mongodbUri = Npm.require('mongodb-uri');
        if (mongodbUri.parse(self._oplogUrl).database !== 'local') {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // We make two separate connections to Mongo. The Node Mongo driver
        // implements a naive round-robin connection pool: each "connection" is a
        // pool of several (5 by default) TCP connections, and each request is
        // rotated through the pools. Tailable cursor queries block on the server
        // until there is some data to return (or until a few seconds have
        // passed). So if the connection pool used for tailing cursors is the same
        // pool used for other queries, the other queries will be delayed by seconds
        // 1/5 of the time.
        //
        // The tail connection will only ever be running a single tail command, so
        // it only needs to make one underlying TCP connection.
        self._oplogTailConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1
        });
        // XXX better docs, but: it's to get monotonic results
        // XXX is it safe to say "if there's an in flight query, just use its
        //     results"? I don't think so but should consider that
        self._oplogLastEntryConnection = new MongoConnection(self._oplogUrl, {
          maxPoolSize: 1
        });

        // Now, make sure that there actually is a repl set here. If not, oplog
        // tailing won't ever find anything!
        // More on the isMasterDoc
        // https://docs.mongodb.com/manual/reference/command/isMaster/
        const isMasterDoc = await new Promise(function (resolve, reject) {
          self._oplogLastEntryConnection.db.admin().command({
            ismaster: 1
          }, function (err, result) {
            if (err) reject(err);else resolve(result);
          });
        });
        if (!(isMasterDoc && isMasterDoc.setName)) {
          throw Error("$MONGO_OPLOG_URL must be set to the 'local' database of " + "a Mongo replica set");
        }

        // Find the last oplog entry.
        var lastOplogEntry = await self._oplogLastEntryConnection.findOneAsync(OPLOG_COLLECTION, {}, {
          sort: {
            $natural: -1
          },
          projection: {
            ts: 1
          }
        });
        var oplogSelector = Object.assign({}, self._baseOplogSelector);
        if (lastOplogEntry) {
          // Start after the last entry that currently exists.
          oplogSelector.ts = {
            $gt: lastOplogEntry.ts
          };
          // If there are any calls to callWhenProcessedLatest before any other
          // oplog entries show up, allow callWhenProcessedLatest to call its
          // callback immediately.
          self._lastProcessedTS = lastOplogEntry.ts;
        }
        var cursorDescription = new CursorDescription(OPLOG_COLLECTION, oplogSelector, {
          tailable: true
        });

        // Start tailing the oplog.
        //
        // We restart the low-level oplog query every 30 seconds if we didn't get a
        // doc. This is a workaround for #8598: the Node Mongo driver has at least
        // one bug that can lead to query callbacks never getting called (even with
        // an error) when leadership failover occur.
        self._tailHandle = self._oplogTailConnection.tail(cursorDescription, function (doc) {
          self._entryQueue.push(doc);
          self._maybeStartWorker();
        }, TAIL_TIMEOUT);
        self._readyPromiseResolver();
      },
      _maybeStartWorker: function () {
        var self = this;
        if (self._workerActive) return;
        self._workerActive = true;
        Meteor.defer(async function () {
          // May be called recursively in case of transactions.
          async function handleDoc(doc) {
            if (doc.ns === "admin.$cmd") {
              if (doc.o.applyOps) {
                // This was a successful transaction, so we need to apply the
                // operations that were involved.
                let nextTimestamp = doc.ts;
                for (const op of doc.o.applyOps) {
                  // See https://github.com/meteor/meteor/issues/10420.
                  if (!op.ts) {
                    op.ts = nextTimestamp;
                    nextTimestamp = nextTimestamp.add(Long.ONE);
                  }
                  await handleDoc(op);
                }
                return;
              }
              throw new Error("Unknown command " + EJSON.stringify(doc));
            }
            const trigger = {
              dropCollection: false,
              dropDatabase: false,
              op: doc
            };
            if (typeof doc.ns === "string" && doc.ns.startsWith(self._dbName + ".")) {
              trigger.collection = doc.ns.slice(self._dbName.length + 1);
            }

            // Is it a special command and the collection name is hidden
            // somewhere in operator?
            if (trigger.collection === "$cmd") {
              if (doc.o.dropDatabase) {
                delete trigger.collection;
                trigger.dropDatabase = true;
              } else if (_.has(doc.o, "drop")) {
                trigger.collection = doc.o.drop;
                trigger.dropCollection = true;
                trigger.id = null;
              } else if ("create" in doc.o && "idIndex" in doc.o) {
                // A collection got implicitly created within a transaction. There's
                // no need to do anything about it.
              } else {
                throw Error("Unknown command " + EJSON.stringify(doc));
              }
            } else {
              // All other ops have an id.
              trigger.id = idForOp(doc);
            }
            await self._crossbar.fire(trigger);
          }
          try {
            while (!self._stopped && !self._entryQueue.isEmpty()) {
              // Are we too far behind? Just tell our observers that they need to
              // repoll, and drop our queue.
              if (self._entryQueue.length > TOO_FAR_BEHIND) {
                var lastEntry = self._entryQueue.pop();
                self._entryQueue.clear();
                self._onSkippedEntriesHook.each(function (callback) {
                  callback();
                  return true;
                });

                // Free any waitUntilCaughtUp() calls that were waiting for us to
                // pass something that we just skipped.
                self._setLastProcessedTS(lastEntry.ts);
                continue;
              }
              const doc = self._entryQueue.shift();

              // Fire trigger(s) for this doc.
              await handleDoc(doc);

              // Now that we've processed this operation, process pending
              // sequencers.
              if (doc.ts) {
                self._setLastProcessedTS(doc.ts);
              } else {
                throw Error("oplog entry without ts: " + EJSON.stringify(doc));
              }
            }
          } finally {
            self._workerActive = false;
          }
        });
      },
      _setLastProcessedTS: function (ts) {
        var self = this;
        self._lastProcessedTS = ts;
        while (!_.isEmpty(self._catchingUpResolvers) && self._catchingUpResolvers[0].ts.lessThanOrEqual(self._lastProcessedTS)) {
          var sequencer = self._catchingUpResolvers.shift();
          sequencer.resolver();
        }
      },
      //Methods used on tests to dinamically change TOO_FAR_BEHIND
      _defineTooFarBehind: function (value) {
        TOO_FAR_BEHIND = value;
      },
      _resetTooFarBehind: function () {
        TOO_FAR_BEHIND = process.env.METEOR_OPLOG_TOO_FAR_BEHIND || 2000;
      }
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"observe_multiplex.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/observe_multiplex.js                                                                                 //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["_id"];
    let nextObserveHandleId = 1;
    ObserveMultiplexer = class {
      constructor() {
        let {
          ordered,
          onStop = () => {}
        } = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
        if (ordered === undefined) throw Error("must specify ordered");
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", 1);
        this._ordered = ordered;
        this._onStop = onStop;
        this._queue = new Meteor._AsynchronousQueue();
        this._handles = {};
        this._resolver = null;
        this._readyPromise = new Promise(r => this._resolver = r).then(() => this._isReady = true);
        this._cache = new LocalCollection._CachingChangeObserver({
          ordered
        });
        // Number of addHandleAndSendInitialAdds tasks scheduled but not yet
        // running. removeHandle uses this to know if it's time to call the onStop
        // callback.
        this._addHandleTasksScheduledButNotPerformed = 0;
        const self = this;
        this.callbackNames().forEach(callbackName => {
          this[callbackName] = function /* ... */
          () {
            self._applyCallback(callbackName, _.toArray(arguments));
          };
        });
      }
      addHandleAndSendInitialAdds(handle) {
        return this._addHandleAndSendInitialAdds(handle);
      }
      async _addHandleAndSendInitialAdds(handle) {
        ++this._addHandleTasksScheduledButNotPerformed;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", 1);
        const self = this;
        await this._queue.runTask(async function () {
          self._handles[handle._id] = handle;
          // Send out whatever adds we have so far (whether the
          // multiplexer is ready).
          await self._sendAdds(handle);
          --self._addHandleTasksScheduledButNotPerformed;
        });
        await this._readyPromise;
      }

      // Remove an observe handle. If it was the last observe handle, call the
      // onStop callback; you cannot add any more observe handles after this.
      //
      // This is not synchronized with polls and handle additions: this means that
      // you can safely call it from within an observe callback, but it also means
      // that we have to be careful when we iterate over _handles.
      async removeHandle(id) {
        // This should not be possible: you can only call removeHandle by having
        // access to the ObserveHandle, which isn't returned to user code until the
        // multiplex is ready.
        if (!this._ready()) throw new Error("Can't remove handles until the multiplex is ready");
        delete this._handles[id];
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-handles", -1);
        if (_.isEmpty(this._handles) && this._addHandleTasksScheduledButNotPerformed === 0) {
          await this._stop();
        }
      }
      async _stop(options) {
        options = options || {};

        // It shouldn't be possible for us to stop when all our handles still
        // haven't been returned from observeChanges!
        if (!this._ready() && !options.fromQueryError) throw Error("surprising _stop: not ready");

        // Call stop callback (which kills the underlying process which sends us
        // callbacks and removes us from the connection's dictionary).
        await this._onStop();
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-multiplexers", -1);

        // Cause future addHandleAndSendInitialAdds calls to throw (but the onStop
        // callback should make our connection forget about us).
        this._handles = null;
      }

      // Allows all addHandleAndSendInitialAdds calls to return, once all preceding
      // adds have been processed. Does not block.
      async ready() {
        const self = this;
        this._queue.queueTask(function () {
          if (self._ready()) throw Error("can't make ObserveMultiplex ready twice!");
          if (!self._resolver) {
            throw new Error("Missing resolver");
          }
          self._resolver();
          self._isReady = true;
        });
      }

      // If trying to execute the query results in an error, call this. This is
      // intended for permanent errors, not transient network errors that could be
      // fixed. It should only be called before ready(), because if you called ready
      // that meant that you managed to run the query once. It will stop this
      // ObserveMultiplex and cause addHandleAndSendInitialAdds calls (and thus
      // observeChanges calls) to throw the error.
      async queryError(err) {
        var self = this;
        await this._queue.runTask(function () {
          if (self._ready()) throw Error("can't claim query has an error after it worked!");
          self._stop({
            fromQueryError: true
          });
          throw err;
        });
      }

      // Calls "cb" once the effects of all "ready", "addHandleAndSendInitialAdds"
      // and observe callbacks which came before this call have been propagated to
      // all handles. "ready" must have already been called on this multiplexer.
      async onFlush(cb) {
        var self = this;
        await this._queue.queueTask(async function () {
          if (!self._ready()) throw Error("only call onFlush on a multiplexer that will be ready");
          await cb();
        });
      }
      callbackNames() {
        if (this._ordered) return ["addedBefore", "changed", "movedBefore", "removed"];else return ["added", "changed", "removed"];
      }
      _ready() {
        return !!this._isReady;
      }
      _applyCallback(callbackName, args) {
        const self = this;
        this._queue.queueTask(async function () {
          // If we stopped in the meantime, do nothing.
          if (!self._handles) return;

          // First, apply the change to the cache.
          await self._cache.applyChange[callbackName].apply(null, args);
          // If we haven't finished the initial adds, then we should only be getting
          // adds.
          if (!self._ready() && callbackName !== 'added' && callbackName !== 'addedBefore') {
            throw new Error("Got " + callbackName + " during initial adds");
          }

          // Now multiplex the callbacks out to all observe handles. It's OK if
          // these calls yield; since we're inside a task, no other use of our queue
          // can continue until these are done. (But we do have to be careful to not
          // use a handle that got removed, because removeHandle does not use the
          // queue; thus, we iterate over an array of keys that we control.)
          for (const handleId of Object.keys(self._handles)) {
            var handle = self._handles && self._handles[handleId];
            if (!handle) return;
            var callback = handle['_' + callbackName];
            // clone arguments so that callbacks can mutate their arguments

            callback && (await callback.apply(null, handle.nonMutatingCallbacks ? args : EJSON.clone(args)));
          }
        });
      }

      // Sends initial adds to a handle. It should only be called from within a task
      // (the task that is processing the addHandleAndSendInitialAdds call). It
      // synchronously invokes the handle's added or addedBefore; there's no need to
      // flush the queue afterwards to ensure that the callbacks get out.
      async _sendAdds(handle) {
        var add = this._ordered ? handle._addedBefore : handle._added;
        if (!add) return;
        // note: docs may be an _IdMap or an OrderedDict
        await this._cache.docs.forEachAsync(async (doc, id) => {
          if (!_.has(this._handles, handle._id)) throw Error("handle got removed before sending initial adds!");
          const _ref = handle.nonMutatingCallbacks ? doc : EJSON.clone(doc),
            {
              _id
            } = _ref,
            fields = _objectWithoutProperties(_ref, _excluded);
          if (this._ordered) await add(id, fields, null); // we're going in order, so add at end
          else await add(id, fields);
        });
      }
    };

    // When the callbacks do not mutate the arguments, we can skip a lot of data clones
    ObserveHandle = class {
      constructor(multiplexer, callbacks) {
        let nonMutatingCallbacks = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        this._multiplexer = multiplexer;
        multiplexer.callbackNames().forEach(name => {
          if (callbacks[name]) {
            this['_' + name] = callbacks[name];
          } else if (name === "addedBefore" && callbacks.added) {
            // Special case: if you specify "added" and "movedBefore", you get an
            // ordered observe where for some reason you don't get ordering data on
            // the adds.  I dunno, we wrote tests for it, there must have been a
            // reason.
            this._addedBefore = async function (id, fields, before) {
              await callbacks.added(id, fields);
            };
          }
        });
        this._stopped = false;
        this._id = nextObserveHandleId++;
        this.nonMutatingCallbacks = nonMutatingCallbacks;
      }
      async stop() {
        if (this._stopped) return;
        this._stopped = true;
        await this._multiplexer.removeHandle(this._id);
      }
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"doc_fetcher.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/doc_fetcher.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  DocFetcher: () => DocFetcher
});
class DocFetcher {
  constructor(mongoConnection) {
    this._mongoConnection = mongoConnection;
    // Map from op -> [callback]
    this._callbacksForOp = new Map();
  }

  // Fetches document "id" from collectionName, returning it or null if not
  // found.
  //
  // If you make multiple calls to fetch() with the same op reference,
  // DocFetcher may assume that they all return the same document. (It does
  // not check to see if collectionName/id match.)
  //
  // You may assume that callback is never called synchronously (and in fact
  // OplogObserveDriver does so).
  async fetch(collectionName, id, op, callback) {
    const self = this;
    check(collectionName, String);
    check(op, Object);

    // If there's already an in-progress fetch for this cache key, yield until
    // it's done and return whatever it returns.
    if (self._callbacksForOp.has(op)) {
      self._callbacksForOp.get(op).push(callback);
      return;
    }
    const callbacks = [callback];
    self._callbacksForOp.set(op, callbacks);
    try {
      var doc = (await self._mongoConnection.findOneAsync(collectionName, {
        _id: id
      })) || null;
      // Return doc to all relevant callbacks. Note that this array can
      // continue to grow during callback excecution.
      while (callbacks.length > 0) {
        // Clone the document so that the various calls to fetch don't return
        // objects that are intertwingled with each other. Clone before
        // popping the future, so that if clone throws, the error gets passed
        // to the next callback.
        callbacks.pop()(null, EJSON.clone(doc));
      }
    } catch (e) {
      while (callbacks.length > 0) {
        callbacks.pop()(e);
      }
    } finally {
      // XXX consider keeping the doc around for a period of time before
      // removing from the cache
      self._callbacksForOp.delete(op);
    }
  }
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"polling_observe_driver.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/polling_observe_driver.js                                                                            //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
var POLLING_THROTTLE_MS = +process.env.METEOR_POLLING_THROTTLE_MS || 50;
var POLLING_INTERVAL_MS = +process.env.METEOR_POLLING_INTERVAL_MS || 10 * 1000;
PollingObserveDriver = function (options) {
  var self = this;
  self._cursorDescription = options.cursorDescription;
  self._mongoHandle = options.mongoHandle;
  self._ordered = options.ordered;
  self._multiplexer = options.multiplexer;
  self._stopCallbacks = [];
  self._stopped = false;
  self._cursor = self._mongoHandle._createSynchronousCursor(self._cursorDescription);

  // previous results snapshot.  on each poll cycle, diffs against
  // results drives the callbacks.
  self._results = null;

  // The number of _pollMongo calls that have been added to self._taskQueue but
  // have not started running. Used to make sure we never schedule more than one
  // _pollMongo (other than possibly the one that is currently running). It's
  // also used by _suspendPolling to pretend there's a poll scheduled. Usually,
  // it's either 0 (for "no polls scheduled other than maybe one currently
  // running") or 1 (for "a poll scheduled that isn't running yet"), but it can
  // also be 2 if incremented by _suspendPolling.
  self._pollsScheduledButNotStarted = 0;
  self._pendingWrites = []; // people to notify when polling completes

  // Make sure to create a separately throttled function for each
  // PollingObserveDriver object.
  self._ensurePollIsScheduled = _.throttle(self._unthrottledEnsurePollIsScheduled, self._cursorDescription.options.pollingThrottleMs || POLLING_THROTTLE_MS /* ms */);

  // XXX figure out if we still need a queue
  self._taskQueue = new Meteor._AsynchronousQueue();
  var listenersHandle = listenAll(self._cursorDescription, function (notification) {
    // When someone does a transaction that might affect us, schedule a poll
    // of the database. If that transaction happens inside of a write fence,
    // block the fence until we've polled and notified observers.
    var fence = DDPServer._getCurrentFence();
    if (fence) self._pendingWrites.push(fence.beginWrite());
    // Ensure a poll is scheduled... but if we already know that one is,
    // don't hit the throttled _ensurePollIsScheduled function (which might
    // lead to us calling it unnecessarily in <pollingThrottleMs> ms).
    if (self._pollsScheduledButNotStarted === 0) self._ensurePollIsScheduled();
  });
  self._stopCallbacks.push(async function () {
    await listenersHandle.stop();
  });

  // every once and a while, poll even if we don't think we're dirty, for
  // eventual consistency with database writes from outside the Meteor
  // universe.
  //
  // For testing, there's an undocumented callback argument to observeChanges
  // which disables time-based polling and gets called at the beginning of each
  // poll.
  if (options._testOnlyPollCallback) {
    self._testOnlyPollCallback = options._testOnlyPollCallback;
  } else {
    var pollingInterval = self._cursorDescription.options.pollingIntervalMs || self._cursorDescription.options._pollingInterval ||
    // COMPAT with 1.2
    POLLING_INTERVAL_MS;
    var intervalHandle = Meteor.setInterval(_.bind(self._ensurePollIsScheduled, self), pollingInterval);
    self._stopCallbacks.push(function () {
      Meteor.clearInterval(intervalHandle);
    });
  }
};
_.extend(PollingObserveDriver.prototype, {
  _init: async function () {
    // Make sure we actually poll soon!
    await this._unthrottledEnsurePollIsScheduled();
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", 1);
  },
  // This is always called through _.throttle (except once at startup).
  _unthrottledEnsurePollIsScheduled: async function () {
    var self = this;
    if (self._pollsScheduledButNotStarted > 0) return;
    ++self._pollsScheduledButNotStarted;
    await self._taskQueue.runTask(async function () {
      await self._pollMongo();
    });
  },
  // test-only interface for controlling polling.
  //
  // _suspendPolling blocks until any currently running and scheduled polls are
  // done, and prevents any further polls from being scheduled. (new
  // ObserveHandles can be added and receive their initial added callbacks,
  // though.)
  //
  // _resumePolling immediately polls, and allows further polls to occur.
  _suspendPolling: function () {
    var self = this;
    // Pretend that there's another poll scheduled (which will prevent
    // _ensurePollIsScheduled from queueing any more polls).
    ++self._pollsScheduledButNotStarted;
    // Now block until all currently running or scheduled polls are done.
    self._taskQueue.runTask(function () {});

    // Confirm that there is only one "poll" (the fake one we're pretending to
    // have) scheduled.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
  },
  _resumePolling: async function () {
    var self = this;
    // We should be in the same state as in the end of _suspendPolling.
    if (self._pollsScheduledButNotStarted !== 1) throw new Error("_pollsScheduledButNotStarted is " + self._pollsScheduledButNotStarted);
    // Run a poll synchronously (which will counteract the
    // ++_pollsScheduledButNotStarted from _suspendPolling).
    await self._taskQueue.runTask(async function () {
      await self._pollMongo();
    });
  },
  async _pollMongo() {
    var self = this;
    --self._pollsScheduledButNotStarted;
    if (self._stopped) return;
    var first = false;
    var newResults;
    var oldResults = self._results;
    if (!oldResults) {
      first = true;
      // XXX maybe use OrderedDict instead?
      oldResults = self._ordered ? [] : new LocalCollection._IdMap();
    }
    self._testOnlyPollCallback && self._testOnlyPollCallback();

    // Save the list of pending writes which this round will commit.
    var writesForCycle = self._pendingWrites;
    self._pendingWrites = [];

    // Get the new query results. (This yields.)
    try {
      newResults = await self._cursor.getRawObjects(self._ordered);
    } catch (e) {
      if (first && typeof e.code === 'number') {
        // This is an error document sent to us by mongod, not a connection
        // error generated by the client. And we've never seen this query work
        // successfully. Probably it's a bad selector or something, so we should
        // NOT retry. Instead, we should halt the observe (which ends up calling
        // `stop` on us).
        await self._multiplexer.queryError(new Error("Exception while polling query " + JSON.stringify(self._cursorDescription) + ": " + e.message));
      }

      // getRawObjects can throw if we're having trouble talking to the
      // database.  That's fine --- we will repoll later anyway. But we should
      // make sure not to lose track of this cycle's writes.
      // (It also can throw if there's just something invalid about this query;
      // unfortunately the ObserveDriver API doesn't provide a good way to
      // "cancel" the observe from the inside in this case.
      Array.prototype.push.apply(self._pendingWrites, writesForCycle);
      Meteor._debug("Exception while polling query " + JSON.stringify(self._cursorDescription), e);
      return;
    }

    // Run diffs.
    if (!self._stopped) {
      LocalCollection._diffQueryChanges(self._ordered, oldResults, newResults, self._multiplexer);
    }

    // Signals the multiplexer to allow all observeChanges calls that share this
    // multiplexer to return. (This happens asynchronously, via the
    // multiplexer's queue.)
    if (first) self._multiplexer.ready();

    // Replace self._results atomically.  (This assignment is what makes `first`
    // stay through on the next cycle, so we've waited until after we've
    // committed to ready-ing the multiplexer.)
    self._results = newResults;

    // Once the ObserveMultiplexer has processed everything we've done in this
    // round, mark all the writes which existed before this call as
    // commmitted. (If new writes have shown up in the meantime, there'll
    // already be another _pollMongo task scheduled.)
    await self._multiplexer.onFlush(async function () {
      for (const w of writesForCycle) {
        await w.committed();
      }
    });
  },
  stop: function () {
    var self = this;
    self._stopped = true;
    const stopCallbacksCaller = async function (c) {
      await c();
    };
    _.each(self._stopCallbacks, stopCallbacksCaller);
    // Release any write fences that are waiting on us.
    _.each(self._pendingWrites, async function (w) {
      await w.committed();
    });
    Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-polling", -1);
  }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_observe_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_observe_driver.js                                                                              //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _asyncIterator;
    module.link("@babel/runtime/helpers/asyncIterator", {
      default(v) {
        _asyncIterator = v;
      }
    }, 0);
    let oplogV2V1Converter;
    module.link("./oplog_v2_converter", {
      oplogV2V1Converter(v) {
        oplogV2V1Converter = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    var PHASE = {
      QUERYING: "QUERYING",
      FETCHING: "FETCHING",
      STEADY: "STEADY"
    };

    // Exception thrown by _needToPollQuery which unrolls the stack up to the
    // enclosing call to finishIfNeedToPollQuery.
    var SwitchedToQuery = function () {};
    var finishIfNeedToPollQuery = function (f) {
      return function () {
        try {
          f.apply(this, arguments);
        } catch (e) {
          if (!(e instanceof SwitchedToQuery)) throw e;
        }
      };
    };
    var currentId = 0;

    // OplogObserveDriver is an alternative to PollingObserveDriver which follows
    // the Mongo operation log instead of just re-polling the query. It obeys the
    // same simple interface: constructing it starts sending observeChanges
    // callbacks (and a ready() invocation) to the ObserveMultiplexer, and you stop
    // it by calling the stop() method.
    OplogObserveDriver = function (options) {
      var self = this;
      self._usesOplog = true; // tests look at this

      self._id = currentId;
      currentId++;
      self._cursorDescription = options.cursorDescription;
      self._mongoHandle = options.mongoHandle;
      self._multiplexer = options.multiplexer;
      if (options.ordered) {
        throw Error("OplogObserveDriver only supports unordered observeChanges");
      }
      var sorter = options.sorter;
      // We don't support $near and other geo-queries so it's OK to initialize the
      // comparator only once in the constructor.
      var comparator = sorter && sorter.getComparator();
      if (options.cursorDescription.options.limit) {
        // There are several properties ordered driver implements:
        // - _limit is a positive number
        // - _comparator is a function-comparator by which the query is ordered
        // - _unpublishedBuffer is non-null Min/Max Heap,
        //                      the empty buffer in STEADY phase implies that the
        //                      everything that matches the queries selector fits
        //                      into published set.
        // - _published - Max Heap (also implements IdMap methods)

        var heapOptions = {
          IdMap: LocalCollection._IdMap
        };
        self._limit = self._cursorDescription.options.limit;
        self._comparator = comparator;
        self._sorter = sorter;
        self._unpublishedBuffer = new MinMaxHeap(comparator, heapOptions);
        // We need something that can find Max value in addition to IdMap interface
        self._published = new MaxHeap(comparator, heapOptions);
      } else {
        self._limit = 0;
        self._comparator = null;
        self._sorter = null;
        self._unpublishedBuffer = null;
        self._published = new LocalCollection._IdMap();
      }

      // Indicates if it is safe to insert a new document at the end of the buffer
      // for this query. i.e. it is known that there are no documents matching the
      // selector those are not in published or buffer.
      self._safeAppendToBuffer = false;
      self._stopped = false;
      self._stopHandles = [];
      Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", 1);
      self._registerPhaseChange(PHASE.QUERYING);
      self._matcher = options.matcher;
      // we are now using projection, not fields in the cursor description even if you pass {fields}
      // in the cursor construction
      var projection = self._cursorDescription.options.fields || self._cursorDescription.options.projection || {};
      self._projectionFn = LocalCollection._compileProjection(projection);
      // Projection function, result of combining important fields for selector and
      // existing fields projection
      self._sharedProjection = self._matcher.combineIntoProjection(projection);
      if (sorter) self._sharedProjection = sorter.combineIntoProjection(self._sharedProjection);
      self._sharedProjectionFn = LocalCollection._compileProjection(self._sharedProjection);
      self._needToFetch = new LocalCollection._IdMap();
      self._currentlyFetching = null;
      self._fetchGeneration = 0;
      self._requeryWhenDoneThisQuery = false;
      self._writesToCommitWhenWeReachSteady = [];

      // If the oplog handle tells us that it skipped some entries (because it got
      // behind, say), re-poll.
      self._stopHandles.push(self._mongoHandle._oplogHandle.onSkippedEntries(finishIfNeedToPollQuery(function () {
        return self._needToPollQuery();
      })));
      forEachTrigger(self._cursorDescription, function (trigger) {
        self._stopHandles.push(self._mongoHandle._oplogHandle.onOplogEntry(trigger, function (notification) {
          finishIfNeedToPollQuery(function () {
            var op = notification.op;
            if (notification.dropCollection || notification.dropDatabase) {
              // Note: this call is not allowed to block on anything (especially
              // on waiting for oplog entries to catch up) because that will block
              // onOplogEntry!
              return self._needToPollQuery();
            } else {
              // All other operators should be handled depending on phase
              if (self._phase === PHASE.QUERYING) {
                return self._handleOplogEntryQuerying(op);
              } else {
                return self._handleOplogEntrySteadyOrFetching(op);
              }
            }
          })();
        }));
      });

      // XXX ordering w.r.t. everything else?
      self._stopHandles.push(listenAll(self._cursorDescription, function () {
        // If we're not in a pre-fire write fence, we don't have to do anything.
        var fence = DDPServer._getCurrentFence();
        if (!fence || fence.fired) return;
        if (fence._oplogObserveDrivers) {
          fence._oplogObserveDrivers[self._id] = self;
          return;
        }
        fence._oplogObserveDrivers = {};
        fence._oplogObserveDrivers[self._id] = self;
        fence.onBeforeFire(async function () {
          var drivers = fence._oplogObserveDrivers;
          delete fence._oplogObserveDrivers;

          // This fence cannot fire until we've caught up to "this point" in the
          // oplog, and all observers made it back to the steady state.
          await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
          for (const driver of Object.values(drivers)) {
            if (driver._stopped) continue;
            var write = await fence.beginWrite();
            if (driver._phase === PHASE.STEADY) {
              // Make sure that all of the callbacks have made it through the
              // multiplexer and been delivered to ObserveHandles before committing
              // writes.
              await driver._multiplexer.onFlush(write.committed);
            } else {
              driver._writesToCommitWhenWeReachSteady.push(write);
            }
          }
        });
      }));

      // When Mongo fails over, we need to repoll the query, in case we processed an
      // oplog entry that got rolled back.
      self._stopHandles.push(self._mongoHandle._onFailover(finishIfNeedToPollQuery(function () {
        return self._needToPollQuery();
      })));
    };
    _.extend(OplogObserveDriver.prototype, {
      _init: function () {
        const self = this;
        // Give _observeChanges a chance to add the new ObserveHandle to our
        // multiplexer, so that the added calls get streamed.
        return self._runInitialQuery();
      },
      _addPublished: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var fields = _.clone(doc);
          delete fields._id;
          self._published.set(id, self._sharedProjectionFn(doc));
          self._multiplexer.added(id, self._projectionFn(fields));

          // After adding this document, the published set might be overflowed
          // (exceeding capacity specified by limit). If so, push the maximum
          // element to the buffer, we might want to save it in memory to reduce the
          // amount of Mongo lookups in the future.
          if (self._limit && self._published.size() > self._limit) {
            // XXX in theory the size of published is no more than limit+1
            if (self._published.size() !== self._limit + 1) {
              throw new Error("After adding to published, " + (self._published.size() - self._limit) + " documents are overflowing the set");
            }
            var overflowingDocId = self._published.maxElementId();
            var overflowingDoc = self._published.get(overflowingDocId);
            if (EJSON.equals(overflowingDocId, id)) {
              throw new Error("The document just added is overflowing the published set");
            }
            self._published.remove(overflowingDocId);
            self._multiplexer.removed(overflowingDocId);
            self._addBuffered(overflowingDocId, overflowingDoc);
          }
        });
      },
      _removePublished: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.remove(id);
          self._multiplexer.removed(id);
          if (!self._limit || self._published.size() === self._limit) return;
          if (self._published.size() > self._limit) throw Error("self._published got too big");

          // OK, we are publishing less than the limit. Maybe we should look in the
          // buffer to find the next element past what we were publishing before.

          if (!self._unpublishedBuffer.empty()) {
            // There's something in the buffer; move the first thing in it to
            // _published.
            var newDocId = self._unpublishedBuffer.minElementId();
            var newDoc = self._unpublishedBuffer.get(newDocId);
            self._removeBuffered(newDocId);
            self._addPublished(newDocId, newDoc);
            return;
          }

          // There's nothing in the buffer.  This could mean one of a few things.

          // (a) We could be in the middle of re-running the query (specifically, we
          // could be in _publishNewResults). In that case, _unpublishedBuffer is
          // empty because we clear it at the beginning of _publishNewResults. In
          // this case, our caller already knows the entire answer to the query and
          // we don't need to do anything fancy here.  Just return.
          if (self._phase === PHASE.QUERYING) return;

          // (b) We're pretty confident that the union of _published and
          // _unpublishedBuffer contain all documents that match selector. Because
          // _unpublishedBuffer is empty, that means we're confident that _published
          // contains all documents that match selector. So we have nothing to do.
          if (self._safeAppendToBuffer) return;

          // (c) Maybe there are other documents out there that should be in our
          // buffer. But in that case, when we emptied _unpublishedBuffer in
          // _removeBuffered, we should have called _needToPollQuery, which will
          // either put something in _unpublishedBuffer or set _safeAppendToBuffer
          // (or both), and it will put us in QUERYING for that whole time. So in
          // fact, we shouldn't be able to get here.

          throw new Error("Buffer inexplicably empty");
        });
      },
      _changePublished: function (id, oldDoc, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._published.set(id, self._sharedProjectionFn(newDoc));
          var projectedNew = self._projectionFn(newDoc);
          var projectedOld = self._projectionFn(oldDoc);
          var changed = DiffSequence.makeChangedFields(projectedNew, projectedOld);
          if (!_.isEmpty(changed)) self._multiplexer.changed(id, changed);
        });
      },
      _addBuffered: function (id, doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.set(id, self._sharedProjectionFn(doc));

          // If something is overflowing the buffer, we just remove it from cache
          if (self._unpublishedBuffer.size() > self._limit) {
            var maxBufferedId = self._unpublishedBuffer.maxElementId();
            self._unpublishedBuffer.remove(maxBufferedId);

            // Since something matching is removed from cache (both published set and
            // buffer), set flag to false
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Is called either to remove the doc completely from matching set or to move
      // it to the published set later.
      _removeBuffered: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._unpublishedBuffer.remove(id);
          // To keep the contract "buffer is never empty in STEADY phase unless the
          // everything matching fits into published" true, we poll everything as
          // soon as we see the buffer becoming empty.
          if (!self._unpublishedBuffer.size() && !self._safeAppendToBuffer) self._needToPollQuery();
        });
      },
      // Called when a document has joined the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _addMatching: function (doc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = doc._id;
          if (self._published.has(id)) throw Error("tried to add something already published " + id);
          if (self._limit && self._unpublishedBuffer.has(id)) throw Error("tried to add something already existed in buffer " + id);
          var limit = self._limit;
          var comparator = self._comparator;
          var maxPublished = limit && self._published.size() > 0 ? self._published.get(self._published.maxElementId()) : null;
          var maxBuffered = limit && self._unpublishedBuffer.size() > 0 ? self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId()) : null;
          // The query is unlimited or didn't publish enough documents yet or the
          // new document would fit into published set pushing the maximum element
          // out, then we need to publish the doc.
          var toPublish = !limit || self._published.size() < limit || comparator(doc, maxPublished) < 0;

          // Otherwise we might need to buffer it (only in case of limited query).
          // Buffering is allowed if the buffer is not filled up yet and all
          // matching docs are either in the published set or in the buffer.
          var canAppendToBuffer = !toPublish && self._safeAppendToBuffer && self._unpublishedBuffer.size() < limit;

          // Or if it is small enough to be safely inserted to the middle or the
          // beginning of the buffer.
          var canInsertIntoBuffer = !toPublish && maxBuffered && comparator(doc, maxBuffered) <= 0;
          var toBuffer = canAppendToBuffer || canInsertIntoBuffer;
          if (toPublish) {
            self._addPublished(id, doc);
          } else if (toBuffer) {
            self._addBuffered(id, doc);
          } else {
            // dropping it and not saving to the cache
            self._safeAppendToBuffer = false;
          }
        });
      },
      // Called when a document leaves the "Matching" results set.
      // Takes responsibility of keeping _unpublishedBuffer in sync with _published
      // and the effect of limit enforced.
      _removeMatching: function (id) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (!self._published.has(id) && !self._limit) throw Error("tried to remove something matching but not cached " + id);
          if (self._published.has(id)) {
            self._removePublished(id);
          } else if (self._unpublishedBuffer.has(id)) {
            self._removeBuffered(id);
          }
        });
      },
      _handleDoc: function (id, newDoc) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var matchesNow = newDoc && self._matcher.documentMatches(newDoc).result;
          var publishedBefore = self._published.has(id);
          var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
          var cachedBefore = publishedBefore || bufferedBefore;
          if (matchesNow && !cachedBefore) {
            self._addMatching(newDoc);
          } else if (cachedBefore && !matchesNow) {
            self._removeMatching(id);
          } else if (cachedBefore && matchesNow) {
            var oldDoc = self._published.get(id);
            var comparator = self._comparator;
            var minBuffered = self._limit && self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.minElementId());
            var maxBuffered;
            if (publishedBefore) {
              // Unlimited case where the document stays in published once it
              // matches or the case when we don't have enough matching docs to
              // publish or the changed but matching doc will stay in published
              // anyways.
              //
              // XXX: We rely on the emptiness of buffer. Be sure to maintain the
              // fact that buffer can't be empty if there are matching documents not
              // published. Notably, we don't want to schedule repoll and continue
              // relying on this property.
              var staysInPublished = !self._limit || self._unpublishedBuffer.size() === 0 || comparator(newDoc, minBuffered) <= 0;
              if (staysInPublished) {
                self._changePublished(id, oldDoc, newDoc);
              } else {
                // after the change doc doesn't stay in the published, remove it
                self._removePublished(id);
                // but it can move into buffered now, check it
                maxBuffered = self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());
                var toBuffer = self._safeAppendToBuffer || maxBuffered && comparator(newDoc, maxBuffered) <= 0;
                if (toBuffer) {
                  self._addBuffered(id, newDoc);
                } else {
                  // Throw away from both published set and buffer
                  self._safeAppendToBuffer = false;
                }
              }
            } else if (bufferedBefore) {
              oldDoc = self._unpublishedBuffer.get(id);
              // remove the old version manually instead of using _removeBuffered so
              // we don't trigger the querying immediately.  if we end this block
              // with the buffer empty, we will need to trigger the query poll
              // manually too.
              self._unpublishedBuffer.remove(id);
              var maxPublished = self._published.get(self._published.maxElementId());
              maxBuffered = self._unpublishedBuffer.size() && self._unpublishedBuffer.get(self._unpublishedBuffer.maxElementId());

              // the buffered doc was updated, it could move to published
              var toPublish = comparator(newDoc, maxPublished) < 0;

              // or stays in buffer even after the change
              var staysInBuffer = !toPublish && self._safeAppendToBuffer || !toPublish && maxBuffered && comparator(newDoc, maxBuffered) <= 0;
              if (toPublish) {
                self._addPublished(id, newDoc);
              } else if (staysInBuffer) {
                // stays in buffer but changes
                self._unpublishedBuffer.set(id, newDoc);
              } else {
                // Throw away from both published set and buffer
                self._safeAppendToBuffer = false;
                // Normally this check would have been done in _removeBuffered but
                // we didn't use it, so we need to do it ourself now.
                if (!self._unpublishedBuffer.size()) {
                  self._needToPollQuery();
                }
              }
            } else {
              throw new Error("cachedBefore implies either of publishedBefore or bufferedBefore is true.");
            }
          }
        });
      },
      _fetchModifiedDocuments: function () {
        var self = this;
        self._registerPhaseChange(PHASE.FETCHING);
        // Defer, because nothing called from the oplog entry handler may yield,
        // but fetch() yields.
        Meteor.defer(finishIfNeedToPollQuery(async function () {
          while (!self._stopped && !self._needToFetch.empty()) {
            if (self._phase === PHASE.QUERYING) {
              // While fetching, we decided to go into QUERYING mode, and then we
              // saw another oplog entry, so _needToFetch is not empty. But we
              // shouldn't fetch these documents until AFTER the query is done.
              break;
            }

            // Being in steady phase here would be surprising.
            if (self._phase !== PHASE.FETCHING) throw new Error("phase in fetchModifiedDocuments: " + self._phase);
            self._currentlyFetching = self._needToFetch;
            var thisGeneration = ++self._fetchGeneration;
            self._needToFetch = new LocalCollection._IdMap();
            var waiting = 0;
            let promiseResolver = null;
            const awaitablePromise = new Promise(r => promiseResolver = r);
            // This loop is safe, because _currentlyFetching will not be updated
            // during this loop (in fact, it is never mutated).
            await self._currentlyFetching.forEachAsync(async function (op, id) {
              waiting++;
              await self._mongoHandle._docFetcher.fetch(self._cursorDescription.collectionName, id, op, finishIfNeedToPollQuery(function (err, doc) {
                if (err) {
                  Meteor._debug('Got exception while fetching documents', err);
                  // If we get an error from the fetcher (eg, trouble
                  // connecting to Mongo), let's just abandon the fetch phase
                  // altogether and fall back to polling. It's not like we're
                  // getting live updates anyway.
                  if (self._phase !== PHASE.QUERYING) {
                    self._needToPollQuery();
                  }
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                  return;
                }
                try {
                  if (!self._stopped && self._phase === PHASE.FETCHING && self._fetchGeneration === thisGeneration) {
                    // We re-check the generation in case we've had an explicit
                    // _pollQuery call (eg, in another fiber) which should
                    // effectively cancel this round of fetches.  (_pollQuery
                    // increments the generation.)

                    self._handleDoc(id, doc);
                  }
                } finally {
                  waiting--;
                  // Because fetch() never calls its callback synchronously,
                  // this is safe (ie, we won't call fut.return() before the
                  // forEach is done).
                  if (waiting === 0) promiseResolver();
                }
              }));
            });
            await awaitablePromise;
            // Exit now if we've had a _pollQuery call (here or in another fiber).
            if (self._phase === PHASE.QUERYING) return;
            self._currentlyFetching = null;
          }
          // We're done fetching, so we can be steady, unless we've had a
          // _pollQuery call (here or in another fiber).
          if (self._phase !== PHASE.QUERYING) await self._beSteady();
        }));
      },
      _beSteady: async function () {
        var self = this;
        self._registerPhaseChange(PHASE.STEADY);
        var writes = self._writesToCommitWhenWeReachSteady || [];
        self._writesToCommitWhenWeReachSteady = [];
        await self._multiplexer.onFlush(async function () {
          try {
            for (const w of writes) {
              await w.committed();
            }
          } catch (e) {
            console.error("_beSteady error", {
              writes
            }, e);
          }
        });
      },
      _handleOplogEntryQuerying: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          self._needToFetch.set(idForOp(op), op);
        });
      },
      _handleOplogEntrySteadyOrFetching: function (op) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var id = idForOp(op);
          // If we're already fetching this one, or about to, we can't optimize;
          // make sure that we fetch it again if necessary.

          if (self._phase === PHASE.FETCHING && (self._currentlyFetching && self._currentlyFetching.has(id) || self._needToFetch.has(id))) {
            self._needToFetch.set(id, op);
            return;
          }
          if (op.op === 'd') {
            if (self._published.has(id) || self._limit && self._unpublishedBuffer.has(id)) self._removeMatching(id);
          } else if (op.op === 'i') {
            if (self._published.has(id)) throw new Error("insert found for already-existing ID in published");
            if (self._unpublishedBuffer && self._unpublishedBuffer.has(id)) throw new Error("insert found for already-existing ID in buffer");

            // XXX what if selector yields?  for now it can't but later it could
            // have $where
            if (self._matcher.documentMatches(op.o).result) self._addMatching(op.o);
          } else if (op.op === 'u') {
            // we are mapping the new oplog format on mongo 5
            // to what we know better, $set
            op.o = oplogV2V1Converter(op.o);
            // Is this a modifier ($set/$unset, which may require us to poll the
            // database to figure out if the whole document matches the selector) or
            // a replacement (in which case we can just directly re-evaluate the
            // selector)?
            // oplog format has changed on mongodb 5, we have to support both now
            // diff is the format in Mongo 5+ (oplog v2)
            var isReplace = !_.has(op.o, '$set') && !_.has(op.o, 'diff') && !_.has(op.o, '$unset');
            // If this modifier modifies something inside an EJSON custom type (ie,
            // anything with EJSON$), then we can't try to use
            // LocalCollection._modify, since that just mutates the EJSON encoding,
            // not the actual object.
            var canDirectlyModifyDoc = !isReplace && modifierCanBeDirectlyApplied(op.o);
            var publishedBefore = self._published.has(id);
            var bufferedBefore = self._limit && self._unpublishedBuffer.has(id);
            if (isReplace) {
              self._handleDoc(id, _.extend({
                _id: id
              }, op.o));
            } else if ((publishedBefore || bufferedBefore) && canDirectlyModifyDoc) {
              // Oh great, we actually know what the document is, so we can apply
              // this directly.
              var newDoc = self._published.has(id) ? self._published.get(id) : self._unpublishedBuffer.get(id);
              newDoc = EJSON.clone(newDoc);
              newDoc._id = id;
              try {
                LocalCollection._modify(newDoc, op.o);
              } catch (e) {
                if (e.name !== "MinimongoError") throw e;
                // We didn't understand the modifier.  Re-fetch.
                self._needToFetch.set(id, op);
                if (self._phase === PHASE.STEADY) {
                  self._fetchModifiedDocuments();
                }
                return;
              }
              self._handleDoc(id, self._sharedProjectionFn(newDoc));
            } else if (!canDirectlyModifyDoc || self._matcher.canBecomeTrueByModifier(op.o) || self._sorter && self._sorter.affectedByModifier(op.o)) {
              self._needToFetch.set(id, op);
              if (self._phase === PHASE.STEADY) self._fetchModifiedDocuments();
            }
          } else {
            throw Error("XXX SURPRISING OPERATION: " + op);
          }
        });
      },
      async _runInitialQueryAsync() {
        var self = this;
        if (self._stopped) throw new Error("oplog stopped surprisingly early");
        await self._runQuery({
          initial: true
        }); // yields

        if (self._stopped) return; // can happen on queryError

        // Allow observeChanges calls to return. (After this, it's possible for
        // stop() to be called.)
        await self._multiplexer.ready();
        await self._doneQuerying(); // yields
      },

      // Yields!
      _runInitialQuery: function () {
        return this._runInitialQueryAsync();
      },
      // In various circumstances, we may just want to stop processing the oplog and
      // re-run the initial query, just as if we were a PollingObserveDriver.
      //
      // This function may not block, because it is called from an oplog entry
      // handler.
      //
      // XXX We should call this when we detect that we've been in FETCHING for "too
      // long".
      //
      // XXX We should call this when we detect Mongo failover (since that might
      // mean that some of the oplog entries we have processed have been rolled
      // back). The Node Mongo driver is in the middle of a bunch of huge
      // refactorings, including the way that it notifies you when primary
      // changes. Will put off implementing this until driver 1.4 is out.
      _pollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // Yay, we get to forget about all the things we thought we had to fetch.
          self._needToFetch = new LocalCollection._IdMap();
          self._currentlyFetching = null;
          ++self._fetchGeneration; // ignore any in-flight fetches
          self._registerPhaseChange(PHASE.QUERYING);

          // Defer so that we don't yield.  We don't need finishIfNeedToPollQuery
          // here because SwitchedToQuery is not thrown in QUERYING mode.
          Meteor.defer(async function () {
            await self._runQuery();
            await self._doneQuerying();
          });
        });
      },
      // Yields!
      async _runQueryAsync(options) {
        var self = this;
        options = options || {};
        var newResults, newBuffer;

        // This while loop is just to retry failures.
        while (true) {
          // If we've been stopped, we don't have to run anything any more.
          if (self._stopped) return;
          newResults = new LocalCollection._IdMap();
          newBuffer = new LocalCollection._IdMap();

          // Query 2x documents as the half excluded from the original query will go
          // into unpublished buffer to reduce additional Mongo lookups in cases
          // when documents are removed from the published set and need a
          // replacement.
          // XXX needs more thought on non-zero skip
          // XXX 2 is a "magic number" meaning there is an extra chunk of docs for
          // buffer if such is needed.
          var cursor = self._cursorForQuery({
            limit: self._limit * 2
          });
          try {
            await cursor.forEach(function (doc, i) {
              // yields
              if (!self._limit || i < self._limit) {
                newResults.set(doc._id, doc);
              } else {
                newBuffer.set(doc._id, doc);
              }
            });
            break;
          } catch (e) {
            if (options.initial && typeof e.code === 'number') {
              // This is an error document sent to us by mongod, not a connection
              // error generated by the client. And we've never seen this query work
              // successfully. Probably it's a bad selector or something, so we
              // should NOT retry. Instead, we should halt the observe (which ends
              // up calling `stop` on us).
              await self._multiplexer.queryError(e);
              return;
            }

            // During failover (eg) if we get an exception we should log and retry
            // instead of crashing.
            Meteor._debug("Got exception while polling query", e);
            await Meteor._sleepForMs(100);
          }
        }
        if (self._stopped) return;
        self._publishNewResults(newResults, newBuffer);
      },
      // Yields!
      _runQuery: function (options) {
        return this._runQueryAsync(options);
      },
      // Transitions to QUERYING and runs another query, or (if already in QUERYING)
      // ensures that we will query again later.
      //
      // This function may not block, because it is called from an oplog entry
      // handler. However, if we were not already in the QUERYING phase, it throws
      // an exception that is caught by the closest surrounding
      // finishIfNeedToPollQuery call; this ensures that we don't continue running
      // close that was designed for another phase inside PHASE.QUERYING.
      //
      // (It's also necessary whenever logic in this file yields to check that other
      // phases haven't put us into QUERYING mode, though; eg,
      // _fetchModifiedDocuments does this.)
      _needToPollQuery: function () {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          if (self._stopped) return;

          // If we're not already in the middle of a query, we can query now
          // (possibly pausing FETCHING).
          if (self._phase !== PHASE.QUERYING) {
            self._pollQuery();
            throw new SwitchedToQuery();
          }

          // We're currently in QUERYING. Set a flag to ensure that we run another
          // query when we're done.
          self._requeryWhenDoneThisQuery = true;
        });
      },
      // Yields!
      _doneQuerying: async function () {
        var self = this;
        if (self._stopped) return;
        await self._mongoHandle._oplogHandle.waitUntilCaughtUp();
        if (self._stopped) return;
        if (self._phase !== PHASE.QUERYING) throw Error("Phase unexpectedly " + self._phase);
        if (self._requeryWhenDoneThisQuery) {
          self._requeryWhenDoneThisQuery = false;
          self._pollQuery();
        } else if (self._needToFetch.empty()) {
          await self._beSteady();
        } else {
          self._fetchModifiedDocuments();
        }
      },
      _cursorForQuery: function (optionsOverwrite) {
        var self = this;
        return Meteor._noYieldsAllowed(function () {
          // The query we run is almost the same as the cursor we are observing,
          // with a few changes. We need to read all the fields that are relevant to
          // the selector, not just the fields we are going to publish (that's the
          // "shared" projection). And we don't want to apply any transform in the
          // cursor, because observeChanges shouldn't use the transform.
          var options = _.clone(self._cursorDescription.options);

          // Allow the caller to modify the options. Useful to specify different
          // skip and limit values.
          _.extend(options, optionsOverwrite);
          options.fields = self._sharedProjection;
          delete options.transform;
          // We are NOT deep cloning fields or selector here, which should be OK.
          var description = new CursorDescription(self._cursorDescription.collectionName, self._cursorDescription.selector, options);
          return new Cursor(self._mongoHandle, description);
        });
      },
      // Replace self._published with newResults (both are IdMaps), invoking observe
      // callbacks on the multiplexer.
      // Replace self._unpublishedBuffer with newBuffer.
      //
      // XXX This is very similar to LocalCollection._diffQueryUnorderedChanges. We
      // should really: (a) Unify IdMap and OrderedDict into Unordered/OrderedDict
      // (b) Rewrite diff.js to use these classes instead of arrays and objects.
      _publishNewResults: function (newResults, newBuffer) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          // If the query is limited and there is a buffer, shut down so it doesn't
          // stay in a way.
          if (self._limit) {
            self._unpublishedBuffer.clear();
          }

          // First remove anything that's gone. Be careful not to modify
          // self._published while iterating over it.
          var idsToRemove = [];
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) idsToRemove.push(id);
          });
          _.each(idsToRemove, function (id) {
            self._removePublished(id);
          });

          // Now do adds and changes.
          // If self has a buffer and limit, the new fetched result will be
          // limited correctly as the query has sort specifier.
          newResults.forEach(function (doc, id) {
            self._handleDoc(id, doc);
          });

          // Sanity-check that everything we tried to put into _published ended up
          // there.
          // XXX if this is slow, remove it later
          if (self._published.size() !== newResults.size()) {
            Meteor._debug('The Mongo server and the Meteor query disagree on how ' + 'many documents match your query. Cursor description: ', self._cursorDescription);
          }
          self._published.forEach(function (doc, id) {
            if (!newResults.has(id)) throw Error("_published has a doc that newResults doesn't; " + id);
          });

          // Finally, replace the buffer
          newBuffer.forEach(function (doc, id) {
            self._addBuffered(id, doc);
          });
          self._safeAppendToBuffer = newBuffer.size() < self._limit;
        });
      },
      // This stop function is invoked from the onStop of the ObserveMultiplexer, so
      // it shouldn't actually be possible to call it until the multiplexer is
      // ready.
      //
      // It's important to check self._stopped after every call in this file that
      // can yield!
      _stop: async function () {
        var self = this;
        if (self._stopped) return;
        self._stopped = true;

        // Note: we *don't* use multiplexer.onFlush here because this stop
        // callback is actually invoked by the multiplexer itself when it has
        // determined that there are no handles left. So nothing is actually going
        // to get flushed (and it's probably not valid to call methods on the
        // dying multiplexer).
        for (const w of self._writesToCommitWhenWeReachSteady) {
          await w.committed();
        }
        self._writesToCommitWhenWeReachSteady = null;

        // Proactively drop references to potentially big things.
        self._published = null;
        self._unpublishedBuffer = null;
        self._needToFetch = null;
        self._currentlyFetching = null;
        self._oplogEntryHandle = null;
        self._listenersHandle = null;
        Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "observe-drivers-oplog", -1);
        var _iteratorAbruptCompletion = false;
        var _didIteratorError = false;
        var _iteratorError;
        try {
          for (var _iterator = _asyncIterator(self._stopHandles), _step; _iteratorAbruptCompletion = !(_step = await _iterator.next()).done; _iteratorAbruptCompletion = false) {
            const handle = _step.value;
            {
              await handle.stop();
            }
          }
        } catch (err) {
          _didIteratorError = true;
          _iteratorError = err;
        } finally {
          try {
            if (_iteratorAbruptCompletion && _iterator.return != null) {
              await _iterator.return();
            }
          } finally {
            if (_didIteratorError) {
              throw _iteratorError;
            }
          }
        }
      },
      stop: async function () {
        const self = this;
        return await self._stop();
      },
      _registerPhaseChange: function (phase) {
        var self = this;
        Meteor._noYieldsAllowed(function () {
          var now = new Date();
          if (self._phase) {
            var timeDiff = now - self._phaseStartTime;
            Package['facts-base'] && Package['facts-base'].Facts.incrementServerFact("mongo-livedata", "time-spent-in-" + self._phase + "-phase", timeDiff);
          }
          self._phase = phase;
          self._phaseStartTime = now;
        });
      }
    });

    // Does our oplog tailing code support this cursor? For now, we are being very
    // conservative and allowing only simple queries with simple options.
    // (This is a "static method".)
    OplogObserveDriver.cursorSupported = function (cursorDescription, matcher) {
      // First, check the options.
      var options = cursorDescription.options;

      // Did the user say no explicitly?
      // underscored version of the option is COMPAT with 1.2
      if (options.disableOplog || options._disableOplog) return false;

      // skip is not supported: to support it we would need to keep track of all
      // "skipped" documents or at least their ids.
      // limit w/o a sort specifier is not supported: current implementation needs a
      // deterministic way to order documents.
      if (options.skip || options.limit && !options.sort) return false;

      // If a fields projection option is given check if it is supported by
      // minimongo (some operators are not supported).
      const fields = options.fields || options.projection;
      if (fields) {
        try {
          LocalCollection._checkSupportedProjection(fields);
        } catch (e) {
          if (e.name === "MinimongoError") {
            return false;
          } else {
            throw e;
          }
        }
      }

      // We don't allow the following selectors:
      //   - $where (not confident that we provide the same JS environment
      //             as Mongo, and can yield!)
      //   - $near (has "interesting" properties in MongoDB, like the possibility
      //            of returning an ID multiple times, though even polling maybe
      //            have a bug there)
      //           XXX: once we support it, we would need to think more on how we
      //           initialize the comparators when we create the driver.
      return !matcher.hasWhere() && !matcher.hasGeoQuery();
    };
    var modifierCanBeDirectlyApplied = function (modifier) {
      return _.all(modifier, function (fields, operation) {
        return _.all(fields, function (value, field) {
          return !/EJSON\$/.test(field);
        });
      });
    };
    MongoInternals.OplogObserveDriver = OplogObserveDriver;
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"oplog_v2_converter.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/oplog_v2_converter.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  oplogV2V1Converter: () => oplogV2V1Converter
});
// Converter of the new MongoDB Oplog format (>=5.0) to the one that Meteor
// handles well, i.e., `$set` and `$unset`. The new format is completely new,
// and looks as follows:
//
//   { $v: 2, diff: Diff }
//
// where `Diff` is a recursive structure:
//
//   {
//     // Nested updates (sometimes also represented with an s-field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     i: { <key>: <value>, ... },
//
//     // Top-level updates.
//     // Example: `{ $set: { foo: { bar: 1 } } }`.
//     u: { <key>: <value>, ... },
//
//     // Unsets.
//     // Example: `{ $unset: { foo: '' } }`.
//     d: { <key>: false, ... },
//
//     // Array operations.
//     // Example: `{ $push: { foo: 'bar' } }`.
//     s<key>: { a: true, u<index>: <value>, ... },
//     ...
//
//     // Nested operations (sometimes also represented in the `i` field).
//     // Example: `{ $set: { 'foo.bar': 1 } }`.
//     s<key>: Diff,
//     ...
//   }
//
// (all fields are optional).

function join(prefix, key) {
  return prefix ? "".concat(prefix, ".").concat(key) : key;
}
const arrayOperatorKeyRegex = /^(a|[su]\d+)$/;
function isArrayOperatorKey(field) {
  return arrayOperatorKeyRegex.test(field);
}
function isArrayOperator(operator) {
  return operator.a === true && Object.keys(operator).every(isArrayOperatorKey);
}
function flattenObjectInto(target, source, prefix) {
  if (Array.isArray(source) || typeof source !== 'object' || source === null) {
    target[prefix] = source;
  } else {
    const entries = Object.entries(source);
    if (entries.length) {
      entries.forEach(_ref => {
        let [key, value] = _ref;
        flattenObjectInto(target, value, join(prefix, key));
      });
    } else {
      target[prefix] = source;
    }
  }
}
const logDebugMessages = !!process.env.OPLOG_CONVERTER_DEBUG;
function convertOplogDiff(oplogEntry, diff, prefix) {
  if (logDebugMessages) {
    console.log("convertOplogDiff(".concat(JSON.stringify(oplogEntry), ", ").concat(JSON.stringify(diff), ", ").concat(JSON.stringify(prefix), ")"));
  }
  Object.entries(diff).forEach(_ref2 => {
    let [diffKey, value] = _ref2;
    if (diffKey === 'd') {
      var _oplogEntry$$unset;
      // Handle `$unset`s.
      (_oplogEntry$$unset = oplogEntry.$unset) !== null && _oplogEntry$$unset !== void 0 ? _oplogEntry$$unset : oplogEntry.$unset = {};
      Object.keys(value).forEach(key => {
        oplogEntry.$unset[join(prefix, key)] = true;
      });
    } else if (diffKey === 'i') {
      var _oplogEntry$$set;
      // Handle (potentially) nested `$set`s.
      (_oplogEntry$$set = oplogEntry.$set) !== null && _oplogEntry$$set !== void 0 ? _oplogEntry$$set : oplogEntry.$set = {};
      flattenObjectInto(oplogEntry.$set, value, prefix);
    } else if (diffKey === 'u') {
      var _oplogEntry$$set2;
      // Handle flat `$set`s.
      (_oplogEntry$$set2 = oplogEntry.$set) !== null && _oplogEntry$$set2 !== void 0 ? _oplogEntry$$set2 : oplogEntry.$set = {};
      Object.entries(value).forEach(_ref3 => {
        let [key, value] = _ref3;
        oplogEntry.$set[join(prefix, key)] = value;
      });
    } else {
      // Handle s-fields.
      const key = diffKey.slice(1);
      if (isArrayOperator(value)) {
        // Array operator.
        Object.entries(value).forEach(_ref4 => {
          let [position, value] = _ref4;
          if (position === 'a') {
            return;
          }
          const positionKey = join(join(prefix, key), position.slice(1));
          if (position[0] === 's') {
            convertOplogDiff(oplogEntry, value, positionKey);
          } else if (value === null) {
            var _oplogEntry$$unset2;
            (_oplogEntry$$unset2 = oplogEntry.$unset) !== null && _oplogEntry$$unset2 !== void 0 ? _oplogEntry$$unset2 : oplogEntry.$unset = {};
            oplogEntry.$unset[positionKey] = true;
          } else {
            var _oplogEntry$$set3;
            (_oplogEntry$$set3 = oplogEntry.$set) !== null && _oplogEntry$$set3 !== void 0 ? _oplogEntry$$set3 : oplogEntry.$set = {};
            oplogEntry.$set[positionKey] = value;
          }
        });
      } else if (key) {
        // Nested object.
        convertOplogDiff(oplogEntry, value, join(prefix, key));
      }
    }
  });
}
function oplogV2V1Converter(oplogEntry) {
  // Pass-through v1 and (probably) invalid entries.
  if (oplogEntry.$v !== 2 || !oplogEntry.diff) {
    return oplogEntry;
  }
  const convertedOplogEntry = {
    $v: 2
  };
  convertOplogDiff(convertedOplogEntry, oplogEntry.diff, '');
  return convertedOplogEntry;
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"local_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/local_collection_driver.js                                                                           //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
module.export({
  LocalCollectionDriver: () => LocalCollectionDriver
});
const LocalCollectionDriver = new class LocalCollectionDriver {
  constructor() {
    this.noConnCollections = Object.create(null);
  }
  open(name, conn) {
    if (!name) {
      return new LocalCollection();
    }
    if (!conn) {
      return ensureCollection(name, this.noConnCollections);
    }
    if (!conn._mongo_livedata_collections) {
      conn._mongo_livedata_collections = Object.create(null);
    }

    // XXX is there a way to keep track of a connection's collections without
    // dangling it off the connection object?
    return ensureCollection(name, conn._mongo_livedata_collections);
  }
}();
function ensureCollection(name, collections) {
  return name in collections ? collections[name] : collections[name] = new LocalCollection(name);
}
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"remote_collection_driver.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/remote_collection_driver.js                                                                          //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName;
    module.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    MongoInternals.RemoteCollectionDriver = function (mongo_url, options) {
      var self = this;
      self.mongo = new MongoConnection(mongo_url, options);
    };
    const REMOTE_COLLECTION_METHODS = ['createCappedCollectionAsync', 'dropIndexAsync', 'ensureIndexAsync', 'createIndexAsync', 'countDocuments', 'dropCollectionAsync', 'estimatedDocumentCount', 'find', 'findOneAsync', 'insertAsync', 'rawCollection', 'removeAsync', 'updateAsync', 'upsertAsync'];
    Object.assign(MongoInternals.RemoteCollectionDriver.prototype, {
      open: function (name) {
        var self = this;
        var ret = {};
        REMOTE_COLLECTION_METHODS.forEach(function (m) {
          ret[m] = _.bind(self.mongo[m], self.mongo, name);
          if (!ASYNC_COLLECTION_METHODS.includes(m)) return;
          const asyncMethodName = getAsyncMethodName(m);
          ret[asyncMethodName] = function () {
            try {
              return Promise.resolve(ret[m](...arguments));
            } catch (error) {
              return Promise.reject(error);
            }
          };
        });
        return ret;
      }
    });

    // Create the singleton RemoteCollectionDriver only on demand, so we
    // only require Mongo configuration if it's actually used (eg, not if
    // you're only trying to receive data from a remote DDP server.)
    MongoInternals.defaultRemoteCollectionDriver = _.once(function () {
      var connectionOptions = {};
      var mongoUrl = process.env.MONGO_URL;
      if (process.env.MONGO_OPLOG_URL) {
        connectionOptions.oplogUrl = process.env.MONGO_OPLOG_URL;
      }
      if (!mongoUrl) throw new Error("MONGO_URL must be set in environment");
      const driver = new MongoInternals.RemoteCollectionDriver(mongoUrl, connectionOptions);

      // As many deployment tools, including Meteor Up, send requests to the app in
      // order to confirm that the deployment finished successfully, it's required
      // to know about a database connection problem before the app starts. Doing so
      // in a `Meteor.startup` is fine, as the `WebApp` handles requests only after
      // all are finished.
      Meteor.startup(async () => {
        await driver.mongo.client.connect();
      });
      return driver;
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"collection.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/collection.js                                                                                        //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let ASYNC_COLLECTION_METHODS, getAsyncMethodName;
    module1.link("meteor/minimongo/constants", {
      ASYNC_COLLECTION_METHODS(v) {
        ASYNC_COLLECTION_METHODS = v;
      },
      getAsyncMethodName(v) {
        getAsyncMethodName = v;
      }
    }, 0);
    let normalizeProjection;
    module1.link("./mongo_utils", {
      normalizeProjection(v) {
        normalizeProjection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    /**
     * @summary Namespace for MongoDB-related items
     * @namespace
     */
    Mongo = {};

    /**
     * @summary Constructor for a Collection
     * @locus Anywhere
     * @instancename collection
     * @class
     * @param {String} name The name of the collection.  If null, creates an unmanaged (unsynchronized) local collection.
     * @param {Object} [options]
     * @param {Object} options.connection The server connection that will manage this collection. Uses the default connection if not specified.  Pass the return value of calling [`DDP.connect`](#ddp_connect) to specify a different server. Pass `null` to specify no connection. Unmanaged (`name` is null) collections cannot specify a connection.
     * @param {String} options.idGeneration The method of generating the `_id` fields of new documents in this collection.  Possible values:
    
     - **`'STRING'`**: random strings
     - **`'MONGO'`**:  random [`Mongo.ObjectID`](#mongo_object_id) values
    
    The default id generation technique is `'STRING'`.
     * @param {Function} options.transform An optional transformation function. Documents will be passed through this function before being returned from `fetch` or `findOneAsync`, and before being passed to callbacks of `observe`, `map`, `forEach`, `allow`, and `deny`. Transforms are *not* applied for the callbacks of `observeChanges` or to cursors returned from publish functions.
     * @param {Boolean} options.defineMutationMethods Set to `false` to skip setting up the mutation methods that enable insert/update/remove from client code. Default `true`.
     */
    Mongo.Collection = function Collection(name, options) {
      if (!name && name !== null) {
        Meteor._debug('Warning: creating anonymous collection. It will not be ' + 'saved or synchronized over the network. (Pass null for ' + 'the collection name to turn off this warning.)');
        name = null;
      }
      if (name !== null && typeof name !== 'string') {
        throw new Error('First argument to new Mongo.Collection must be a string or null');
      }
      if (options && options.methods) {
        // Backwards compatibility hack with original signature (which passed
        // "connection" directly instead of in options. (Connections must have a "methods"
        // method.)
        // XXX remove before 1.0
        options = {
          connection: options
        };
      }
      // Backwards compatibility: "connection" used to be called "manager".
      if (options && options.manager && !options.connection) {
        options.connection = options.manager;
      }
      options = _objectSpread({
        connection: undefined,
        idGeneration: 'STRING',
        transform: null,
        _driver: undefined,
        _preventAutopublish: false
      }, options);
      switch (options.idGeneration) {
        case 'MONGO':
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return new Mongo.ObjectID(src.hexString(24));
          };
          break;
        case 'STRING':
        default:
          this._makeNewID = function () {
            var src = name ? DDP.randomStream('/collection/' + name) : Random.insecure;
            return src.id();
          };
          break;
      }
      this._transform = LocalCollection.wrapTransform(options.transform);
      if (!name || options.connection === null)
        // note: nameless collections never have a connection
        this._connection = null;else if (options.connection) this._connection = options.connection;else if (Meteor.isClient) this._connection = Meteor.connection;else this._connection = Meteor.server;
      if (!options._driver) {
        // XXX This check assumes that webapp is loaded so that Meteor.server !==
        // null. We should fully support the case of "want to use a Mongo-backed
        // collection from Node code without webapp", but we don't yet.
        // #MeteorServerNull
        if (name && this._connection === Meteor.server && typeof MongoInternals !== 'undefined' && MongoInternals.defaultRemoteCollectionDriver) {
          options._driver = MongoInternals.defaultRemoteCollectionDriver();
        } else {
          const {
            LocalCollectionDriver
          } = require('./local_collection_driver.js');
          options._driver = LocalCollectionDriver;
        }
      }
      this._collection = options._driver.open(name, this._connection);
      this._name = name;
      this._driver = options._driver;

      // TODO[fibers]: _maybeSetUpReplication is now async. Let's watch how not waiting for this function to finish
      // will affect everything
      this._settingUpReplicationPromise = this._maybeSetUpReplication(name, options);

      // XXX don't define these until allow or deny is actually used for this
      // collection. Could be hard if the security rules are only defined on the
      // server.
      if (options.defineMutationMethods !== false) {
        try {
          this._defineMutationMethods({
            useExisting: options._suppressSameNameError === true
          });
        } catch (error) {
          // Throw a more understandable error on the server for same collection name
          if (error.message === "A method named '/".concat(name, "/insertAsync' is already defined")) throw new Error("There is already a collection named \"".concat(name, "\""));
          throw error;
        }
      }

      // autopublish
      if (Package.autopublish && !options._preventAutopublish && this._connection && this._connection.publish) {
        this._connection.publish(null, () => this.find(), {
          is_auto: true
        });
      }
    };
    Object.assign(Mongo.Collection.prototype, {
      async _maybeSetUpReplication(name) {
        var _registerStoreResult, _registerStoreResult$;
        const self = this;
        if (!(self._connection && self._connection.registerStoreClient && self._connection.registerStoreServer)) {
          return;
        }
        const wrappedStoreCommon = {
          // Called around method stub invocations to capture the original versions
          // of modified documents.
          saveOriginals() {
            self._collection.saveOriginals();
          },
          retrieveOriginals() {
            return self._collection.retrieveOriginals();
          },
          // To be able to get back to the collection from the store.
          _getCollection() {
            return self;
          }
        };
        const wrappedStoreClient = _objectSpread({
          // Called at the beginning of a batch of updates. batchSize is the number
          // of update calls to expect.
          //
          // XXX This interface is pretty janky. reset probably ought to go back to
          // being its own function, and callers shouldn't have to calculate
          // batchSize. The optimization of not calling pause/remove should be
          // delayed until later: the first call to update() should buffer its
          // message, and then we can either directly apply it at endUpdate time if
          // it was the only update, or do pauseObservers/apply/apply at the next
          // update() if there's another one.
          async beginUpdate(batchSize, reset) {
            // pause observers so users don't see flicker when updating several
            // objects at once (including the post-reconnect reset-and-reapply
            // stage), and so that a re-sorting of a query can take advantage of the
            // full _diffQuery moved calculation instead of applying change one at a
            // time.
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.remove({});
          },
          // Apply an update.
          // XXX better specify this interface (not in terms of a wire message)?
          update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            //When the server's mergebox is disabled for a collection, the client must gracefully handle it when:
            // *We receive an added message for a document that is already there. Instead, it will be changed
            // *We reeive a change message for a document that is not there. Instead, it will be added
            // *We receive a removed messsage for a document that is not there. Instead, noting wil happen.

            //Code is derived from client-side code originally in peerlibrary:control-mergebox
            //https://github.com/peerlibrary/meteor-control-mergebox/blob/master/client.coffee

            //For more information, refer to discussion "Initial support for publication strategies in livedata server":
            //https://github.com/meteor/meteor/pull/11151
            if (Meteor.isClient) {
              if (msg.msg === 'added' && doc) {
                msg.msg = 'changed';
              } else if (msg.msg === 'removed' && !doc) {
                return;
              } else if (msg.msg === 'changed' && !doc) {
                msg.msg = 'added';
                const _ref = msg.fields;
                for (let field in _ref) {
                  const value = _ref[field];
                  if (value === void 0) {
                    delete msg.fields[field];
                  }
                }
              }
            }
            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) self._collection.remove(mongoId);
              } else if (!doc) {
                self._collection.insert(replace);
              } else {
                // XXX check that replace has no $ ops
                self._collection.update(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              self._collection.insert(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              self._collection.remove(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  self._collection.update(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.livedata_connection.js:1287
          endUpdate() {
            self._collection.resumeObserversClient();
          },
          // Used to preserve current versions of documents across a store reset.
          getDoc(id) {
            return self.findOne(id);
          }
        }, wrappedStoreCommon);
        const wrappedStoreServer = _objectSpread({
          async beginUpdate(batchSize, reset) {
            if (batchSize > 1 || reset) self._collection.pauseObservers();
            if (reset) await self._collection.removeAsync({});
          },
          async update(msg) {
            var mongoId = MongoID.idParse(msg.id);
            var doc = self._collection._docs.get(mongoId);

            // Is this a "replace the whole doc" message coming from the quiescence
            // of method writes to an object? (Note that 'undefined' is a valid
            // value meaning "remove it".)
            if (msg.msg === 'replace') {
              var replace = msg.replace;
              if (!replace) {
                if (doc) await self._collection.removeAsync(mongoId);
              } else if (!doc) {
                await self._collection.insertAsync(replace);
              } else {
                // XXX check that replace has no $ ops
                await self._collection.updateAsync(mongoId, replace);
              }
              return;
            } else if (msg.msg === 'added') {
              if (doc) {
                throw new Error('Expected not to find a document already present for an add');
              }
              await self._collection.insertAsync(_objectSpread({
                _id: mongoId
              }, msg.fields));
            } else if (msg.msg === 'removed') {
              if (!doc) throw new Error('Expected to find a document already present for removed');
              await self._collection.removeAsync(mongoId);
            } else if (msg.msg === 'changed') {
              if (!doc) throw new Error('Expected to find a document to change');
              const keys = Object.keys(msg.fields);
              if (keys.length > 0) {
                var modifier = {};
                keys.forEach(key => {
                  const value = msg.fields[key];
                  if (EJSON.equals(doc[key], value)) {
                    return;
                  }
                  if (typeof value === 'undefined') {
                    if (!modifier.$unset) {
                      modifier.$unset = {};
                    }
                    modifier.$unset[key] = 1;
                  } else {
                    if (!modifier.$set) {
                      modifier.$set = {};
                    }
                    modifier.$set[key] = value;
                  }
                });
                if (Object.keys(modifier).length > 0) {
                  await self._collection.updateAsync(mongoId, modifier);
                }
              }
            } else {
              throw new Error("I don't know how to deal with this message");
            }
          },
          // Called at the end of a batch of updates.
          async endUpdate() {
            await self._collection.resumeObserversServer();
          },
          // Used to preserve current versions of documents across a store reset.
          async getDoc(id) {
            return self.findOneAsync(id);
          }
        }, wrappedStoreCommon);

        // OK, we're going to be a slave, replicating some remote
        // database, except possibly with some temporary divergence while
        // we have unacknowledged RPC's.
        let registerStoreResult;
        if (Meteor.isClient) {
          registerStoreResult = self._connection.registerStoreClient(name, wrappedStoreClient);
        } else {
          registerStoreResult = self._connection.registerStoreServer(name, wrappedStoreServer);
        }
        const message = "There is already a collection named \"".concat(name, "\"");
        const logWarn = () => {
          console.warn ? console.warn(message) : console.log(message);
        };
        if (!registerStoreResult) {
          return logWarn();
        }
        return (_registerStoreResult = registerStoreResult) === null || _registerStoreResult === void 0 ? void 0 : (_registerStoreResult$ = _registerStoreResult.then) === null || _registerStoreResult$ === void 0 ? void 0 : _registerStoreResult$.call(_registerStoreResult, ok => {
          if (!ok) {
            logWarn();
          }
        });
      },
      ///
      /// Main collection API
      ///
      /**
       * @summary Gets the number of documents matching the filter. For a fast count of the total documents in a collection see `estimatedDocumentCount`.
       * @locus Anywhere
       * @method countDocuments
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to count
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/CountDocumentsOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      countDocuments() {
        return this._collection.countDocuments(...arguments);
      },
      /**
       * @summary Gets an estimate of the count of documents in a collection using collection metadata. For an exact count of the documents in a collection see `countDocuments`.
       * @locus Anywhere
       * @method estimatedDocumentCount
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://mongodb.github.io/node-mongodb-native/4.11/interfaces/EstimatedDocumentCountOptions.html). Please note that not all of them are available on the client.
       * @returns {Promise<number>}
       */
      estimatedDocumentCount() {
        return this._collection.estimatedDocumentCount(...arguments);
      },
      _getFindSelector(args) {
        if (args.length == 0) return {};else return args[0];
      },
      _getFindOptions(args) {
        const [, options] = args || [];
        const newOptions = normalizeProjection(options);
        var self = this;
        if (args.length < 2) {
          return {
            transform: self._transform
          };
        } else {
          check(newOptions, Match.Optional(Match.ObjectIncluding({
            projection: Match.Optional(Match.OneOf(Object, undefined)),
            sort: Match.Optional(Match.OneOf(Object, Array, Function, undefined)),
            limit: Match.Optional(Match.OneOf(Number, undefined)),
            skip: Match.Optional(Match.OneOf(Number, undefined))
          })));
          return _objectSpread({
            transform: self._transform
          }, newOptions);
        }
      },
      /**
       * @summary Find the documents in a collection that match the selector.
       * @locus Anywhere
       * @method find
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {Number} options.limit Maximum number of results to return
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default `true`; pass `false` to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the  [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {Boolean} options.disableOplog (Server only) Pass true to disable oplog-tailing on this query. This affects the way server processes calls to `observe` on this query. Disabling the oplog can be useful when working with data that updates in large batches.
       * @param {Number} options.pollingIntervalMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the frequency (in milliseconds) of how often to poll this query when observing on the server. Defaults to 10000ms (10 seconds).
       * @param {Number} options.pollingThrottleMs (Server only) When oplog is disabled (through the use of `disableOplog` or when otherwise not available), the minimum time (in milliseconds) to allow between re-polling when observing on the server. Increasing this will save CPU and mongo load at the expense of slower updates to users. Decreasing this is not recommended. Defaults to 50ms.
       * @param {Number} options.maxTimeMs (Server only) If set, instructs MongoDB to set a time limit for this cursor's operations. If the operation reaches the specified time limit (in milliseconds) without the having been completed, an exception will be thrown. Useful to prevent an (accidental or malicious) unoptimized query from causing a full collection scan that would disrupt other database users, at the expense of needing to handle the resulting error.
       * @param {String|Object} options.hint (Server only) Overrides MongoDB's default index selection and query optimization process. Specify an index to force its use, either by its name or index specification. You can also specify `{ $natural : 1 }` to force a forwards collection scan, or `{ $natural : -1 }` for a reverse collection scan. Setting this is only recommended for advanced users.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for this particular cursor. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Mongo.Cursor}
       */
      find() {
        for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
          args[_key] = arguments[_key];
        }
        // Collection.find() (return all docs) behaves differently
        // from Collection.find(undefined) (return 0 docs).  so be
        // careful about the length of arguments.
        return this._collection.find(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOneAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOneAsync() {
        for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
          args[_key2] = arguments[_key2];
        }
        return this._collection.findOneAsync(this._getFindSelector(args), this._getFindOptions(args));
      },
      /**
       * @summary Finds the first document that matches the selector, as ordered by sort and skip options. Returns `undefined` if no matching document is found.
       * @locus Anywhere
       * @method findOne
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} [selector] A query describing the documents to find
       * @param {Object} [options]
       * @param {MongoSortSpecifier} options.sort Sort order (default: natural order)
       * @param {Number} options.skip Number of results to skip at the beginning
       * @param {MongoFieldSpecifier} options.fields Dictionary of fields to return or exclude.
       * @param {Boolean} options.reactive (Client only) Default true; pass false to disable reactivity
       * @param {Function} options.transform Overrides `transform` on the [`Collection`](#collections) for this cursor.  Pass `null` to disable transformation.
       * @param {String} options.readPreference (Server only) Specifies a custom MongoDB [`readPreference`](https://docs.mongodb.com/manual/core/read-preference) for fetching the document. Possible values are `primary`, `primaryPreferred`, `secondary`, `secondaryPreferred` and `nearest`.
       * @returns {Object}
       */
      findOne() {
        for (var _len3 = arguments.length, args = new Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
          args[_key3] = arguments[_key3];
        }
        return this._collection.findOne(this._getFindSelector(args), this._getFindOptions(args));
      }
    });
    Object.assign(Mongo.Collection, {
      async _publishCursor(cursor, sub, collection) {
        var observeHandle = await cursor.observeChanges({
          added: function (id, fields) {
            sub.added(collection, id, fields);
          },
          changed: function (id, fields) {
            sub.changed(collection, id, fields);
          },
          removed: function (id) {
            sub.removed(collection, id);
          }
        },
        // Publications don't mutate the documents
        // This is tested by the `livedata - publish callbacks clone` test
        {
          nonMutatingCallbacks: true
        });

        // We don't call sub.ready() here: it gets called in livedata_server, after
        // possibly calling _publishCursor on multiple returned cursors.

        // register stop callback (expects lambda w/ no args).
        sub.onStop(async function () {
          return await observeHandle.stop();
        });

        // return the observeHandle in case it needs to be stopped early
        return observeHandle;
      },
      // protect against dangerous selectors.  falsey and {_id: falsey} are both
      // likely programmer error, and not what you want, particularly for destructive
      // operations. If a falsey _id is sent in, a new string _id will be
      // generated and returned; if a fallbackId is provided, it will be returned
      // instead.
      _rewriteSelector(selector) {
        let {
          fallbackId
        } = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // shorthand -- scalars match _id
        if (LocalCollection._selectorIsId(selector)) selector = {
          _id: selector
        };
        if (Array.isArray(selector)) {
          // This is consistent with the Mongo console itself; if we don't do this
          // check passing an empty array ends up selecting all items
          throw new Error("Mongo selector can't be an array.");
        }
        if (!selector || '_id' in selector && !selector._id) {
          // can't match anything
          return {
            _id: fallbackId || Random.id()
          };
        }
        return selector;
      }
    });
    Object.assign(Mongo.Collection.prototype, {
      // 'insert' immediately returns the inserted document's new _id.
      // The others return values immediately if you are in a stub, an in-memory
      // unmanaged collection, or a mongo-backed collection and you don't pass a
      // callback. 'update' and 'remove' return the number of affected
      // documents. 'upsert' returns an object with keys 'numberAffected' and, if an
      // insert happened, 'insertedId'.
      //
      // Otherwise, the semantics are exactly like other methods: they take
      // a callback as an optional last argument; if no callback is
      // provided, they block until the operation is complete, and throw an
      // exception if it fails; if a callback is provided, then they don't
      // necessarily block, and they call the callback when they finish with error and
      // result arguments.  (The insert method provides the document ID as its result;
      // update and remove provide the number of affected docs as the result; upsert
      // provides an object with numberAffected and maybe insertedId.)
      //
      // On the client, blocking is impossible, so if a callback
      // isn't provided, they just return immediately and any error
      // information is lost.
      //
      // There's one more tweak. On the client, if you don't provide a
      // callback, then if there is an error, a message will be logged with
      // Meteor._debug.
      //
      // The intent (though this is actually determined by the underlying
      // drivers) is that the operations should be done synchronously, not
      // generating their result until the database has acknowledged
      // them. In the future maybe we should provide a flag to turn this
      // off.

      _insert(doc, callback) {
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        const wrappedCallback = wrapCallback(callback, chooseReturnValueFromCollectionResult);
        if (this._isRemoteCollection()) {
          const result = this._callMutatorMethod('insert', [doc], wrappedCallback);
          return chooseReturnValueFromCollectionResult(result);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          let result;
          if (!!wrappedCallback) {
            this._collection.insert(doc, wrappedCallback);
          } else {
            // If we don't have the callback, we assume the user is using the promise.
            // We can't just pass this._collection.insert to the promisify because it would lose the context.
            result = this._collection.insert(doc);
          }
          return chooseReturnValueFromCollectionResult(result);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Insert a document in the collection.  Returns its unique _id.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the _id as the second.
       */
      insert(doc, callback) {
        return this._insert(doc, callback);
      },
      async _insertAsync(doc) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        // Make sure we were passed a document to insert
        if (!doc) {
          throw new Error('insert requires an argument');
        }

        // Make a shallow clone of the document, preserving its prototype.
        doc = Object.create(Object.getPrototypeOf(doc), Object.getOwnPropertyDescriptors(doc));
        if ('_id' in doc) {
          if (!doc._id || !(typeof doc._id === 'string' || doc._id instanceof Mongo.ObjectID)) {
            throw new Error('Meteor requires document _id fields to be non-empty strings or ObjectIDs');
          }
        } else {
          let generateId = true;

          // Don't generate the id if we're the client and the 'outermost' call
          // This optimization saves us passing both the randomSeed and the id
          // Passing both is redundant.
          if (this._isRemoteCollection()) {
            const enclosing = DDP._CurrentMethodInvocation.get();
            if (!enclosing) {
              generateId = false;
            }
          }
          if (generateId) {
            doc._id = this._makeNewID();
          }
        }

        // On inserts, always return the id that we generated; on all other
        // operations, just return the result from the collection.
        var chooseReturnValueFromCollectionResult = function (result) {
          if (Meteor._isPromise(result)) return result;
          if (doc._id) {
            return doc._id;
          }

          // XXX what is this for??
          // It's some iteraction between the callback to _callMutatorMethod and
          // the return value conversion
          doc._id = result;
          return result;
        };
        if (this._isRemoteCollection()) {
          const result = await this._callMutatorMethodAsync('insertAsync', [doc], options);
          return chooseReturnValueFromCollectionResult(result);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        try {
          const result = await this._collection.insertAsync(doc);
          return chooseReturnValueFromCollectionResult(result);
        } catch (e) {
          throw e;
        }
      },
      /**
       * @summary Insert a document in the collection.  Returns a promise that will return the document's unique _id when solved.
       * @locus Anywhere
       * @method  insert
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} doc The document to insert. May not yet have an _id attribute, in which case Meteor will generate one for you.
       */
      insertAsync(doc, options) {
        return this._insertAsync(doc, options);
      },
      /**
       * @summary Modify one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       */
      async updateAsync(selector, modifier) {
        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, (arguments.length <= 2 ? undefined : arguments[2]) || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethodAsync('updateAsync', args, options);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        //console.log({callback, options, selector, modifier, coll: this._collection});
        return this._collection.updateAsync(selector, modifier, options);
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection. Returns the number of matched documents.
       * @locus Anywhere
       * @method update
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       * @param {Boolean} options.upsert True to insert a document if no matching documents are found.
       * @param {Array} options.arrayFilters Optional. Used in combination with MongoDB [filtered positional operator](https://docs.mongodb.com/manual/reference/operator/update/positional-filtered/) to specify which elements to modify in an array field.
       * @param {Function} [callback] Optional.  If present, called with an error object as the first argument and, if no error, the number of affected documents as the second.
       */
      update(selector, modifier) {
        for (var _len4 = arguments.length, optionsAndCallback = new Array(_len4 > 2 ? _len4 - 2 : 0), _key4 = 2; _key4 < _len4; _key4++) {
          optionsAndCallback[_key4 - 2] = arguments[_key4];
        }
        const callback = popCallbackFromArgs(optionsAndCallback);

        // We've already popped off the callback, so we are left with an array
        // of one or zero items
        const options = _objectSpread({}, optionsAndCallback[0] || null);
        let insertedId;
        if (options && options.upsert) {
          // set `insertedId` if absent.  `insertedId` is a Meteor extension.
          if (options.insertedId) {
            if (!(typeof options.insertedId === 'string' || options.insertedId instanceof Mongo.ObjectID)) throw new Error('insertedId must be string or ObjectID');
            insertedId = options.insertedId;
          } else if (!selector || !selector._id) {
            insertedId = this._makeNewID();
            options.generatedId = true;
            options.insertedId = insertedId;
          }
        }
        selector = Mongo.Collection._rewriteSelector(selector, {
          fallbackId: insertedId
        });
        const wrappedCallback = wrapCallback(callback);
        if (this._isRemoteCollection()) {
          const args = [selector, modifier, options];
          return this._callMutatorMethod('update', args);
        }

        // it's my collection.  descend into the collection object
        // and propagate any exception.
        // If the user provided a callback and the collection implements this
        // operation asynchronously, then queryRet will be undefined, and the
        // result will be returned through the callback instead.
        //console.log({callback, options, selector, modifier, coll: this._collection});
        try {
          // If the user provided a callback and the collection implements this
          // operation asynchronously, then queryRet will be undefined, and the
          // result will be returned through the callback instead.
          return this._collection.updateAsync(selector, modifier, options, wrappedCallback);
        } catch (e) {
          if (callback) {
            callback(e);
            return null;
          }
          throw e;
        }
      },
      /**
       * @summary Asynchronously removes documents from the collection.
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      async removeAsync(selector) {
        let options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethodAsync('removeAsync', [selector], options);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.removeAsync(selector);
      },
      /**
       * @summary Remove documents from the collection
       * @locus Anywhere
       * @method remove
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to remove
       */
      remove(selector) {
        selector = Mongo.Collection._rewriteSelector(selector);
        if (this._isRemoteCollection()) {
          return this._callMutatorMethod('remove', [selector]);
        }

        // it's my collection.  descend into the collection1 object
        // and propagate any exception.
        return this._collection.remove(selector);
      },
      // Determine if this collection is simply a minimongo representation of a real
      // database on another server
      _isRemoteCollection() {
        // XXX see #MeteorServerNull
        return this._connection && this._connection !== Meteor.server;
      },
      /**
       * @summary Asynchronously modifies one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       */
      async upsertAsync(selector, modifier, options) {
        return this.updateAsync(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      /**
       * @summary Modify one or more documents in the collection, or insert one if no matching documents were found. Returns an object with keys `numberAffected` (the number of documents modified)  and `insertedId` (the unique _id of the document that was inserted, if any).
       * @locus Anywhere
       * @method upsert
       * @memberof Mongo.Collection
       * @instance
       * @param {MongoSelector} selector Specifies which documents to modify
       * @param {MongoModifier} modifier Specifies how to modify the documents
       * @param {Object} [options]
       * @param {Boolean} options.multi True to modify all matching documents; false to only modify one of the matching documents (the default).
       */
      upsert(selector, modifier, options) {
        return this.update(selector, modifier, _objectSpread(_objectSpread({}, options), {}, {
          _returnObject: true,
          upsert: true
        }));
      },
      // We'll actually design an index API later. For now, we just pass through to
      // Mongo's, but make it synchronous.
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method ensureIndexAsync
       * @deprecated in 3.0
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async ensureIndexAsync(index, options) {
        var self = this;
        if (!self._collection.ensureIndexAsync || !self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        if (self._collection.createIndexAsync) {
          await self._collection.createIndexAsync(index, options);
        } else {
          let Log;
          module1.link("meteor/logging", {
            Log(v) {
              Log = v;
            }
          }, 2);
          Log.debug("ensureIndexAsync has been deprecated, please use the new 'createIndexAsync' instead".concat(options !== null && options !== void 0 && options.name ? ", index name: ".concat(options.name) : ", index: ".concat(JSON.stringify(index))));
          await self._collection.ensureIndexAsync(index, options);
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndexAsync
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      async createIndexAsync(index, options) {
        var self = this;
        if (!self._collection.createIndexAsync) throw new Error('Can only call createIndexAsync on server collections');
        try {
          await self._collection.createIndexAsync(index, options);
        } catch (e) {
          var _Meteor$settings, _Meteor$settings$pack, _Meteor$settings$pack2;
          if (e.message.includes('An equivalent index already exists with the same name but different options.') && (_Meteor$settings = Meteor.settings) !== null && _Meteor$settings !== void 0 && (_Meteor$settings$pack = _Meteor$settings.packages) !== null && _Meteor$settings$pack !== void 0 && (_Meteor$settings$pack2 = _Meteor$settings$pack.mongo) !== null && _Meteor$settings$pack2 !== void 0 && _Meteor$settings$pack2.reCreateIndexOnOptionMismatch) {
            let Log;
            module1.link("meteor/logging", {
              Log(v) {
                Log = v;
              }
            }, 3);
            Log.info("Re-creating index ".concat(index, " for ").concat(self._name, " due to options mismatch."));
            await self._collection.dropIndexAsync(index);
            await self._collection.createIndexAsync(index, options);
          } else {
            console.error(e);
            throw new Meteor.Error("An error occurred when creating an index for collection \"".concat(self._name, ": ").concat(e.message));
          }
        }
      },
      /**
       * @summary Asynchronously creates the specified index on the collection.
       * @locus server
       * @method createIndex
       * @memberof Mongo.Collection
       * @instance
       * @param {Object} index A document that contains the field and value pairs where the field is the index key and the value describes the type of index for that field. For an ascending index on a field, specify a value of `1`; for descending index, specify a value of `-1`. Use `text` for text indexes.
       * @param {Object} [options] All options are listed in [MongoDB documentation](https://docs.mongodb.com/manual/reference/method/db.collection.createIndex/#options)
       * @param {String} options.name Name of the index
       * @param {Boolean} options.unique Define that the index values must be unique, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-unique/)
       * @param {Boolean} options.sparse Define that the index is sparse, more at [MongoDB documentation](https://docs.mongodb.com/manual/core/index-sparse/)
       */
      createIndex(index, options) {
        return this.createIndexAsync(index, options);
      },
      async dropIndexAsync(index) {
        var self = this;
        if (!self._collection.dropIndexAsync) throw new Error('Can only call dropIndexAsync on server collections');
        await self._collection.dropIndexAsync(index);
      },
      async dropCollectionAsync() {
        var self = this;
        if (!self._collection.dropCollectionAsync) throw new Error('Can only call dropCollectionAsync on server collections');
        await self._collection.dropCollectionAsync();
      },
      async createCappedCollectionAsync(byteSize, maxDocuments) {
        var self = this;
        if (!(await self._collection.createCappedCollectionAsync)) throw new Error('Can only call createCappedCollectionAsync on server collections');
        await self._collection.createCappedCollectionAsync(byteSize, maxDocuments);
      },
      /**
       * @summary Returns the [`Collection`](http://mongodb.github.io/node-mongodb-native/3.0/api/Collection.html) object corresponding to this collection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawCollection() {
        var self = this;
        if (!self._collection.rawCollection) {
          throw new Error('Can only call rawCollection on server collections');
        }
        return self._collection.rawCollection();
      },
      /**
       * @summary Returns the [`Db`](http://mongodb.github.io/node-mongodb-native/3.0/api/Db.html) object corresponding to this collection's database connection from the [npm `mongodb` driver module](https://www.npmjs.com/package/mongodb) which is wrapped by `Mongo.Collection`.
       * @locus Server
       * @memberof Mongo.Collection
       * @instance
       */
      rawDatabase() {
        var self = this;
        if (!(self._driver.mongo && self._driver.mongo.db)) {
          throw new Error('Can only call rawDatabase on server collections');
        }
        return self._driver.mongo.db;
      }
    });

    // Convert the callback to not return a result if there is an error
    function wrapCallback(callback, convertResult) {
      return callback && function (error, result) {
        if (error) {
          callback(error);
        } else if (typeof convertResult === 'function') {
          callback(error, convertResult(result));
        } else {
          callback(error, result);
        }
      };
    }

    /**
     * @summary Create a Mongo-style `ObjectID`.  If you don't specify a `hexString`, the `ObjectID` will generated randomly (not using MongoDB's ID construction rules).
     * @locus Anywhere
     * @class
     * @param {String} [hexString] Optional.  The 24-character hexadecimal contents of the ObjectID to create
     */
    Mongo.ObjectID = MongoID.ObjectID;

    /**
     * @summary To create a cursor, use find. To access the documents in a cursor, use forEach, map, or fetch.
     * @class
     * @instanceName cursor
     */
    Mongo.Cursor = LocalCollection.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.Cursor = Mongo.Cursor;

    /**
     * @deprecated in 0.9.1
     */
    Mongo.Collection.ObjectID = Mongo.ObjectID;

    /**
     * @deprecated in 0.9.1
     */
    Meteor.Collection = Mongo.Collection;

    // Allow deny stuff is now in the allow-deny package
    Object.assign(Mongo.Collection.prototype, AllowDeny.CollectionPrototype);
    function popCallbackFromArgs(args) {
      // Pull off any callback (or perhaps a 'callback' variable that was passed
      // in undefined, like how 'upsert' does it).
      if (args.length && (args[args.length - 1] === undefined || args[args.length - 1] instanceof Function)) {
        return args.pop();
      }
    }

    // XXX: IN Meteor 3.x this code was not working....
    // It throws an error when trying to call a method on the collection.
    // the error normally is:
    // TypeError: this[methodName] is not a function
    // ASYNC_COLLECTION_METHODS.forEach(methodName => {
    //   const methodNameAsync = getAsyncMethodName(methodName);
    //   Mongo.Collection.prototype[methodNameAsync] = function(...args) {
    //     try {
    //       return Promise.resolve(this[methodName](...args));
    //     } catch (error) {
    //       return Promise.reject(error);
    //     }
    //   };
    // });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"connection_options.js":function module(){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/connection_options.js                                                                                //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
                                                                                                                       //
/**
 * @summary Allows for user specified connection options
 * @example http://mongodb.github.io/node-mongodb-native/3.0/reference/connecting/connection-settings/
 * @locus Server
 * @param {Object} options User specified Mongo connection options
 */
Mongo.setConnectionOptions = function setConnectionOptions(options) {
  check(options, Object);
  Mongo._connectionOptions = options;
};
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

},"mongo_utils.js":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                                     //
// packages/mongo/mongo_utils.js                                                                                       //
//                                                                                                                     //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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
    let _objectWithoutProperties;
    module.link("@babel/runtime/helpers/objectWithoutProperties", {
      default(v) {
        _objectWithoutProperties = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const _excluded = ["fields", "projection"];
    module.export({
      normalizeProjection: () => normalizeProjection
    });
    const normalizeProjection = options => {
      // transform fields key in projection
      const _ref = options || {},
        {
          fields,
          projection
        } = _ref,
        otherOptions = _objectWithoutProperties(_ref, _excluded);
      // TODO: enable this comment when deprecating the fields option
      // Log.debug(`fields option has been deprecated, please use the new 'projection' instead`)

      return _objectSpread(_objectSpread({}, otherOptions), projection || fields ? {
        projection: fields || projection
      } : {});
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
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

}}}}},{
  "extensions": [
    ".js",
    ".json"
  ]
});


/* Exports */
return {
  export: function () { return {
      MongoInternals: MongoInternals,
      Mongo: Mongo,
      ObserveMultiplexer: ObserveMultiplexer
    };},
  require: require,
  eagerModulePaths: [
    "/node_modules/meteor/mongo/mongo_driver.js",
    "/node_modules/meteor/mongo/oplog_tailing.js",
    "/node_modules/meteor/mongo/observe_multiplex.js",
    "/node_modules/meteor/mongo/doc_fetcher.js",
    "/node_modules/meteor/mongo/polling_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_observe_driver.js",
    "/node_modules/meteor/mongo/oplog_v2_converter.js",
    "/node_modules/meteor/mongo/local_collection_driver.js",
    "/node_modules/meteor/mongo/remote_collection_driver.js",
    "/node_modules/meteor/mongo/collection.js",
    "/node_modules/meteor/mongo/connection_options.js"
  ]
}});

//# sourceURL=meteor://💻app/packages/mongo.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ190YWlsaW5nLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vYnNlcnZlX211bHRpcGxleC5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vZG9jX2ZldGNoZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL3BvbGxpbmdfb2JzZXJ2ZV9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL29wbG9nX29ic2VydmVfZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9vcGxvZ192Ml9jb252ZXJ0ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2xvY2FsX2NvbGxlY3Rpb25fZHJpdmVyLmpzIiwibWV0ZW9yOi8v8J+Su2FwcC9wYWNrYWdlcy9tb25nby9yZW1vdGVfY29sbGVjdGlvbl9kcml2ZXIuanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2NvbGxlY3Rpb24uanMiLCJtZXRlb3I6Ly/wn5K7YXBwL3BhY2thZ2VzL21vbmdvL2Nvbm5lY3Rpb25fb3B0aW9ucy5qcyIsIm1ldGVvcjovL/CfkrthcHAvcGFja2FnZXMvbW9uZ28vbW9uZ29fdXRpbHMuanMiXSwibmFtZXMiOlsiX29iamVjdFNwcmVhZCIsIm1vZHVsZTEiLCJsaW5rIiwiZGVmYXVsdCIsInYiLCJub3JtYWxpemVQcm9qZWN0aW9uIiwiRG9jRmV0Y2hlciIsIkFTWU5DX0NVUlNPUl9NRVRIT0RTIiwiZ2V0QXN5bmNNZXRob2ROYW1lIiwiTWV0ZW9yIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJwYXRoIiwicmVxdWlyZSIsInV0aWwiLCJNb25nb0RCIiwiTnBtTW9kdWxlTW9uZ29kYiIsIk1vbmdvSW50ZXJuYWxzIiwiX19wYWNrYWdlTmFtZSIsIk5wbU1vZHVsZXMiLCJtb25nb2RiIiwidmVyc2lvbiIsIk5wbU1vZHVsZU1vbmdvZGJWZXJzaW9uIiwibW9kdWxlIiwiTnBtTW9kdWxlIiwiRklMRV9BU1NFVF9TVUZGSVgiLCJBU1NFVFNfRk9MREVSIiwiQVBQX0ZPTERFUiIsInJlcGxhY2VOYW1lcyIsImZpbHRlciIsInRoaW5nIiwiXyIsImlzQXJyYXkiLCJtYXAiLCJiaW5kIiwicmV0IiwiZWFjaCIsInZhbHVlIiwia2V5IiwiVGltZXN0YW1wIiwicHJvdG90eXBlIiwiY2xvbmUiLCJtYWtlTW9uZ29MZWdhbCIsIm5hbWUiLCJ1bm1ha2VNb25nb0xlZ2FsIiwic3Vic3RyIiwicmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IiLCJkb2N1bWVudCIsIkJpbmFyeSIsInN1Yl90eXBlIiwiYnVmZmVyIiwiVWludDhBcnJheSIsIk9iamVjdElEIiwiTW9uZ28iLCJ0b0hleFN0cmluZyIsIkRlY2ltYWwxMjgiLCJEZWNpbWFsIiwidG9TdHJpbmciLCJzaXplIiwiRUpTT04iLCJmcm9tSlNPTlZhbHVlIiwidW5kZWZpbmVkIiwicmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28iLCJpc0JpbmFyeSIsIkJ1ZmZlciIsImZyb20iLCJmcm9tU3RyaW5nIiwiX2lzQ3VzdG9tVHlwZSIsInRvSlNPTlZhbHVlIiwicmVwbGFjZVR5cGVzIiwiYXRvbVRyYW5zZm9ybWVyIiwicmVwbGFjZWRUb3BMZXZlbEF0b20iLCJ2YWwiLCJ2YWxSZXBsYWNlZCIsIk1vbmdvQ29ubmVjdGlvbiIsInVybCIsIm9wdGlvbnMiLCJfTWV0ZW9yJHNldHRpbmdzIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrIiwiX01ldGVvciRzZXR0aW5ncyRwYWNrMiIsInNlbGYiLCJfb2JzZXJ2ZU11bHRpcGxleGVycyIsIl9vbkZhaWxvdmVySG9vayIsIkhvb2siLCJ1c2VyT3B0aW9ucyIsIl9jb25uZWN0aW9uT3B0aW9ucyIsInNldHRpbmdzIiwicGFja2FnZXMiLCJtb25nbyIsIm1vbmdvT3B0aW9ucyIsIk9iamVjdCIsImFzc2lnbiIsImlnbm9yZVVuZGVmaW5lZCIsImhhcyIsIm1heFBvb2xTaXplIiwiZW50cmllcyIsIl9yZWYiLCJlbmRzV2l0aCIsImZvckVhY2giLCJfcmVmMiIsIm9wdGlvbk5hbWUiLCJyZXBsYWNlIiwiam9pbiIsIkFzc2V0cyIsImdldFNlcnZlckRpciIsImRiIiwiX29wbG9nSGFuZGxlIiwiX2RvY0ZldGNoZXIiLCJjbGllbnQiLCJNb25nb0NsaWVudCIsIm9uIiwiYmluZEVudmlyb25tZW50IiwiZXZlbnQiLCJwcmV2aW91c0Rlc2NyaXB0aW9uIiwidHlwZSIsIm5ld0Rlc2NyaXB0aW9uIiwiY2FsbGJhY2siLCJvcGxvZ1VybCIsIlBhY2thZ2UiLCJPcGxvZ0hhbmRsZSIsImRhdGFiYXNlTmFtZSIsIl9jbG9zZSIsIkVycm9yIiwib3Bsb2dIYW5kbGUiLCJzdG9wIiwiY2xvc2UiLCJyYXdDb2xsZWN0aW9uIiwiY29sbGVjdGlvbk5hbWUiLCJjb2xsZWN0aW9uIiwiY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jIiwiYnl0ZVNpemUiLCJtYXhEb2N1bWVudHMiLCJjcmVhdGVDb2xsZWN0aW9uIiwiY2FwcGVkIiwibWF4IiwiX21heWJlQmVnaW5Xcml0ZSIsImZlbmNlIiwiRERQU2VydmVyIiwiX2dldEN1cnJlbnRGZW5jZSIsImJlZ2luV3JpdGUiLCJjb21taXR0ZWQiLCJfb25GYWlsb3ZlciIsInJlZ2lzdGVyIiwid3JpdGVDYWxsYmFjayIsIndyaXRlIiwicmVmcmVzaCIsImVyciIsInJlc3VsdCIsInJlZnJlc2hFcnIiLCJiaW5kRW52aXJvbm1lbnRGb3JXcml0ZSIsImluc2VydEFzeW5jIiwiY29sbGVjdGlvbl9uYW1lIiwiZSIsIl9leHBlY3RlZEJ5VGVzdCIsIkxvY2FsQ29sbGVjdGlvbiIsIl9pc1BsYWluT2JqZWN0IiwiaWQiLCJfaWQiLCJpbnNlcnRPbmUiLCJzYWZlIiwidGhlbiIsIl9yZWYzIiwiaW5zZXJ0ZWRJZCIsImNhdGNoIiwiX3JlZnJlc2giLCJzZWxlY3RvciIsInJlZnJlc2hLZXkiLCJzcGVjaWZpY0lkcyIsIl9pZHNNYXRjaGVkQnlTZWxlY3RvciIsImV4dGVuZCIsInJlbW92ZUFzeW5jIiwiZGVsZXRlTWFueSIsIl9yZWY0IiwiZGVsZXRlZENvdW50IiwidHJhbnNmb3JtUmVzdWx0IiwibW9kaWZpZWRDb3VudCIsIm51bWJlckFmZmVjdGVkIiwiZHJvcENvbGxlY3Rpb25Bc3luYyIsImRyb3BDb2xsZWN0aW9uIiwiZHJvcCIsImRyb3BEYXRhYmFzZUFzeW5jIiwiZHJvcERhdGFiYXNlIiwiX2Ryb3BEYXRhYmFzZSIsInVwZGF0ZUFzeW5jIiwibW9kIiwiZXJyb3IiLCJtb25nb09wdHMiLCJhcnJheUZpbHRlcnMiLCJ1cHNlcnQiLCJtdWx0aSIsImZ1bGxSZXN1bHQiLCJtb25nb1NlbGVjdG9yIiwibW9uZ29Nb2QiLCJpc01vZGlmeSIsIl9pc01vZGlmaWNhdGlvbk1vZCIsIl9mb3JiaWRSZXBsYWNlIiwia25vd25JZCIsIm5ld0RvYyIsIl9jcmVhdGVVcHNlcnREb2N1bWVudCIsImdlbmVyYXRlZElkIiwic2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZCIsIl9yZXR1cm5PYmplY3QiLCJoYXNPd25Qcm9wZXJ0eSIsIiRzZXRPbkluc2VydCIsInN0cmluZ3MiLCJrZXlzIiwic3RhcnRzV2l0aCIsInVwZGF0ZU1ldGhvZCIsImxlbmd0aCIsIm1ldGVvclJlc3VsdCIsImRyaXZlclJlc3VsdCIsIm1vbmdvUmVzdWx0IiwidXBzZXJ0ZWRDb3VudCIsInVwc2VydGVkSWQiLCJuIiwibWF0Y2hlZENvdW50IiwiTlVNX09QVElNSVNUSUNfVFJJRVMiLCJfaXNDYW5ub3RDaGFuZ2VJZEVycm9yIiwiZXJybXNnIiwiaW5kZXhPZiIsIm1vbmdvT3B0c0ZvclVwZGF0ZSIsIm1vbmdvT3B0c0Zvckluc2VydCIsInJlcGxhY2VtZW50V2l0aElkIiwidHJpZXMiLCJkb1VwZGF0ZSIsIm1ldGhvZCIsInVwZGF0ZU1hbnkiLCJzb21lIiwicmVwbGFjZU9uZSIsImRvQ29uZGl0aW9uYWxJbnNlcnQiLCJ1cHNlcnRBc3luYyIsImZpbmQiLCJhcmd1bWVudHMiLCJDdXJzb3IiLCJDdXJzb3JEZXNjcmlwdGlvbiIsImZpbmRPbmVBc3luYyIsImxpbWl0IiwicmVzdWx0cyIsImZldGNoIiwiY3JlYXRlSW5kZXhBc3luYyIsImluZGV4IiwiY3JlYXRlSW5kZXgiLCJjb3VudERvY3VtZW50cyIsIl9sZW4iLCJhcmdzIiwiQXJyYXkiLCJfa2V5IiwiYXJnIiwiZXN0aW1hdGVkRG9jdW1lbnRDb3VudCIsIl9sZW4yIiwiX2tleTIiLCJlbnN1cmVJbmRleEFzeW5jIiwiZHJvcEluZGV4QXN5bmMiLCJpbmRleE5hbWUiLCJkcm9wSW5kZXgiLCJDb2xsZWN0aW9uIiwiX3Jld3JpdGVTZWxlY3RvciIsImN1cnNvckRlc2NyaXB0aW9uIiwiX21vbmdvIiwiX2N1cnNvckRlc2NyaXB0aW9uIiwiX3N5bmNocm9ub3VzQ3Vyc29yIiwic2V0dXBTeW5jaHJvbm91c0N1cnNvciIsImN1cnNvciIsInRhaWxhYmxlIiwiX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yIiwic2VsZkZvckl0ZXJhdGlvbiIsInVzZVRyYW5zZm9ybSIsImNvdW50QXN5bmMiLCJTeW1ib2wiLCJpdGVyYXRvciIsImFzeW5jSXRlcmF0b3IiLCJtZXRob2ROYW1lIiwibWV0aG9kTmFtZUFzeW5jIiwiUHJvbWlzZSIsInJlc29sdmUiLCJyZWplY3QiLCJnZXRUcmFuc2Zvcm0iLCJ0cmFuc2Zvcm0iLCJfcHVibGlzaEN1cnNvciIsInN1YiIsIl9nZXRDb2xsZWN0aW9uTmFtZSIsIm9ic2VydmUiLCJjYWxsYmFja3MiLCJfb2JzZXJ2ZUZyb21PYnNlcnZlQ2hhbmdlcyIsIm9ic2VydmVDaGFuZ2VzIiwibWV0aG9kcyIsIm9yZGVyZWQiLCJfb2JzZXJ2ZUNoYW5nZXNDYWxsYmFja3NBcmVPcmRlcmVkIiwiZXhjZXB0aW9uTmFtZSIsIl9mcm9tT2JzZXJ2ZSIsIl9vYnNlcnZlQ2hhbmdlcyIsIm5vbk11dGF0aW5nQ2FsbGJhY2tzIiwicGljayIsImN1cnNvck9wdGlvbnMiLCJzb3J0Iiwic2tpcCIsInByb2plY3Rpb24iLCJmaWVsZHMiLCJyZWFkUHJlZmVyZW5jZSIsIm51bWJlck9mUmV0cmllcyIsImRiQ3Vyc29yIiwiYWRkQ3Vyc29yRmxhZyIsIk9QTE9HX0NPTExFQ1RJT04iLCJ0cyIsIm1heFRpbWVNcyIsIm1heFRpbWVNUyIsImhpbnQiLCJBc3luY2hyb25vdXNDdXJzb3IiLCJjb25zdHJ1Y3RvciIsIl9kYkN1cnNvciIsIl9zZWxmRm9ySXRlcmF0aW9uIiwiX3RyYW5zZm9ybSIsIndyYXBUcmFuc2Zvcm0iLCJfdmlzaXRlZElkcyIsIl9JZE1hcCIsIl9jdXJzb3IiLCJfcmF3TmV4dE9iamVjdFByb21pc2UiLCJuZXh0IiwiY29uc29sZSIsIl9uZXh0T2JqZWN0UHJvbWlzZSIsImRvYyIsInNldCIsIl9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0IiwidGltZW91dE1TIiwibmV4dE9iamVjdFByb21pc2UiLCJ0aW1lb3V0RXJyIiwidGltZW91dFByb21pc2UiLCJzZXRUaW1lb3V0IiwicmFjZSIsInRoaXNBcmciLCJfcmV3aW5kIiwiaWR4IiwiY2FsbCIsInB1c2giLCJyZXdpbmQiLCJpZGVudGl0eSIsImNvdW50IiwiZ2V0UmF3T2JqZWN0cyIsIlN5bmNocm9ub3VzQ3Vyc29yIiwiX3N5bmNocm9ub3VzQ291bnQiLCJGdXR1cmUiLCJ3cmFwIiwidGltZXIiLCJfbmV4dE9iamVjdCIsImF3YWl0Iiwid3JhcHBlZEZuIiwid3JhcEZuIiwicmVzIiwid2FpdCIsImRvbmUiLCJzeW5jUmVzdWx0IiwidGFpbCIsImRvY0NhbGxiYWNrIiwic3RvcHBlZCIsImxhc3RUUyIsImRlZmVyIiwibG9vcCIsIm5ld1NlbGVjdG9yIiwiJGd0IiwiX29ic2VydmVDaGFuZ2VzVGFpbGFibGUiLCJmaWVsZHNPcHRpb25zIiwib2JzZXJ2ZUtleSIsInN0cmluZ2lmeSIsIm11bHRpcGxleGVyIiwib2JzZXJ2ZURyaXZlciIsImZpcnN0SGFuZGxlIiwiT2JzZXJ2ZU11bHRpcGxleGVyIiwib25TdG9wIiwib2JzZXJ2ZUhhbmRsZSIsIk9ic2VydmVIYW5kbGUiLCJtYXRjaGVyIiwic29ydGVyIiwiY2FuVXNlT3Bsb2ciLCJhbGwiLCJfdGVzdE9ubHlQb2xsQ2FsbGJhY2siLCJNaW5pbW9uZ28iLCJNYXRjaGVyIiwiT3Bsb2dPYnNlcnZlRHJpdmVyIiwiY3Vyc29yU3VwcG9ydGVkIiwiU29ydGVyIiwiZiIsImRyaXZlckNsYXNzIiwiUG9sbGluZ09ic2VydmVEcml2ZXIiLCJtb25nb0hhbmRsZSIsIl9pbml0IiwiX29ic2VydmVEcml2ZXIiLCJhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMiLCJsaXN0ZW5BbGwiLCJsaXN0ZW5DYWxsYmFjayIsImxpc3RlbmVycyIsImZvckVhY2hUcmlnZ2VyIiwidHJpZ2dlciIsIl9JbnZhbGlkYXRpb25Dcm9zc2JhciIsImxpc3RlbiIsImxpc3RlbmVyIiwidHJpZ2dlckNhbGxiYWNrIiwiYWRkZWRCZWZvcmUiLCJhZGRlZCIsIk1vbmdvVGltZXN0YW1wIiwiQ29ubmVjdGlvbiIsIl9fcmVpZnlfYXN5bmNfcmVzdWx0X18iLCJfcmVpZnlFcnJvciIsImFzeW5jIiwiTG9uZyIsIlRPT19GQVJfQkVISU5EIiwicHJvY2VzcyIsImVudiIsIk1FVEVPUl9PUExPR19UT09fRkFSX0JFSElORCIsIlRBSUxfVElNRU9VVCIsIk1FVEVPUl9PUExPR19UQUlMX1RJTUVPVVQiLCJpZEZvck9wIiwib3AiLCJvIiwibzIiLCJkYk5hbWUiLCJfb3Bsb2dVcmwiLCJfZGJOYW1lIiwiX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiIsIl9vcGxvZ1RhaWxDb25uZWN0aW9uIiwiX3N0b3BwZWQiLCJfdGFpbEhhbmRsZSIsIl9yZWFkeVByb21pc2VSZXNvbHZlciIsIl9yZWFkeVByb21pc2UiLCJyIiwiX2Nyb3NzYmFyIiwiX0Nyb3NzYmFyIiwiZmFjdFBhY2thZ2UiLCJmYWN0TmFtZSIsIl9iYXNlT3Bsb2dTZWxlY3RvciIsIm5zIiwiUmVnRXhwIiwiX2VzY2FwZVJlZ0V4cCIsIiRvciIsIiRpbiIsIiRleGlzdHMiLCJfY2F0Y2hpbmdVcFJlc29sdmVycyIsIl9sYXN0UHJvY2Vzc2VkVFMiLCJfb25Ta2lwcGVkRW50cmllc0hvb2siLCJkZWJ1Z1ByaW50RXhjZXB0aW9ucyIsIl9lbnRyeVF1ZXVlIiwiX0RvdWJsZUVuZGVkUXVldWUiLCJfd29ya2VyQWN0aXZlIiwic2hvdWxkQXdhaXQiLCJfc3RhcnRUYWlsaW5nIiwiX29uT3Bsb2dFbnRyeSIsIm9yaWdpbmFsQ2FsbGJhY2siLCJub3RpZmljYXRpb24iLCJfZGVidWciLCJsaXN0ZW5IYW5kbGUiLCJvbk9wbG9nRW50cnkiLCJvblNraXBwZWRFbnRyaWVzIiwiX3dhaXRVbnRpbENhdWdodFVwIiwibGFzdEVudHJ5IiwiJG5hdHVyYWwiLCJfc2xlZXBGb3JNcyIsImxlc3NUaGFuT3JFcXVhbCIsImluc2VydEFmdGVyIiwiZ3JlYXRlclRoYW4iLCJwcm9taXNlUmVzb2x2ZXIiLCJwcm9taXNlVG9Bd2FpdCIsInNwbGljZSIsInJlc29sdmVyIiwid2FpdFVudGlsQ2F1Z2h0VXAiLCJtb25nb2RiVXJpIiwiTnBtIiwicGFyc2UiLCJkYXRhYmFzZSIsImlzTWFzdGVyRG9jIiwiYWRtaW4iLCJjb21tYW5kIiwiaXNtYXN0ZXIiLCJzZXROYW1lIiwibGFzdE9wbG9nRW50cnkiLCJvcGxvZ1NlbGVjdG9yIiwiX21heWJlU3RhcnRXb3JrZXIiLCJoYW5kbGVEb2MiLCJhcHBseU9wcyIsIm5leHRUaW1lc3RhbXAiLCJhZGQiLCJPTkUiLCJzbGljZSIsImZpcmUiLCJpc0VtcHR5IiwicG9wIiwiY2xlYXIiLCJfc2V0TGFzdFByb2Nlc3NlZFRTIiwic2hpZnQiLCJzZXF1ZW5jZXIiLCJfZGVmaW5lVG9vRmFyQmVoaW5kIiwiX3Jlc2V0VG9vRmFyQmVoaW5kIiwiX29iamVjdFdpdGhvdXRQcm9wZXJ0aWVzIiwiX2V4Y2x1ZGVkIiwibmV4dE9ic2VydmVIYW5kbGVJZCIsIkZhY3RzIiwiaW5jcmVtZW50U2VydmVyRmFjdCIsIl9vcmRlcmVkIiwiX29uU3RvcCIsIl9xdWV1ZSIsIl9Bc3luY2hyb25vdXNRdWV1ZSIsIl9oYW5kbGVzIiwiX3Jlc29sdmVyIiwiX2lzUmVhZHkiLCJfY2FjaGUiLCJfQ2FjaGluZ0NoYW5nZU9ic2VydmVyIiwiX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkIiwiY2FsbGJhY2tOYW1lcyIsImNhbGxiYWNrTmFtZSIsIl9hcHBseUNhbGxiYWNrIiwidG9BcnJheSIsImhhbmRsZSIsIl9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMiLCJydW5UYXNrIiwiX3NlbmRBZGRzIiwicmVtb3ZlSGFuZGxlIiwiX3JlYWR5IiwiX3N0b3AiLCJmcm9tUXVlcnlFcnJvciIsInJlYWR5IiwicXVldWVUYXNrIiwicXVlcnlFcnJvciIsIm9uRmx1c2giLCJjYiIsImFwcGx5Q2hhbmdlIiwiYXBwbHkiLCJoYW5kbGVJZCIsIl9hZGRlZEJlZm9yZSIsIl9hZGRlZCIsImRvY3MiLCJmb3JFYWNoQXN5bmMiLCJfbXVsdGlwbGV4ZXIiLCJiZWZvcmUiLCJleHBvcnQiLCJtb25nb0Nvbm5lY3Rpb24iLCJfbW9uZ29Db25uZWN0aW9uIiwiX2NhbGxiYWNrc0Zvck9wIiwiTWFwIiwiY2hlY2siLCJTdHJpbmciLCJnZXQiLCJkZWxldGUiLCJQT0xMSU5HX1RIUk9UVExFX01TIiwiTUVURU9SX1BPTExJTkdfVEhST1RUTEVfTVMiLCJQT0xMSU5HX0lOVEVSVkFMX01TIiwiTUVURU9SX1BPTExJTkdfSU5URVJWQUxfTVMiLCJfbW9uZ29IYW5kbGUiLCJfc3RvcENhbGxiYWNrcyIsIl9yZXN1bHRzIiwiX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCIsIl9wZW5kaW5nV3JpdGVzIiwiX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCIsInRocm90dGxlIiwiX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkIiwicG9sbGluZ1Rocm90dGxlTXMiLCJfdGFza1F1ZXVlIiwibGlzdGVuZXJzSGFuZGxlIiwicG9sbGluZ0ludGVydmFsIiwicG9sbGluZ0ludGVydmFsTXMiLCJfcG9sbGluZ0ludGVydmFsIiwiaW50ZXJ2YWxIYW5kbGUiLCJzZXRJbnRlcnZhbCIsImNsZWFySW50ZXJ2YWwiLCJfcG9sbE1vbmdvIiwiX3N1c3BlbmRQb2xsaW5nIiwiX3Jlc3VtZVBvbGxpbmciLCJmaXJzdCIsIm5ld1Jlc3VsdHMiLCJvbGRSZXN1bHRzIiwid3JpdGVzRm9yQ3ljbGUiLCJjb2RlIiwiSlNPTiIsIm1lc3NhZ2UiLCJfZGlmZlF1ZXJ5Q2hhbmdlcyIsInciLCJzdG9wQ2FsbGJhY2tzQ2FsbGVyIiwiYyIsIl9hc3luY0l0ZXJhdG9yIiwib3Bsb2dWMlYxQ29udmVydGVyIiwiUEhBU0UiLCJRVUVSWUlORyIsIkZFVENISU5HIiwiU1RFQURZIiwiU3dpdGNoZWRUb1F1ZXJ5IiwiZmluaXNoSWZOZWVkVG9Qb2xsUXVlcnkiLCJjdXJyZW50SWQiLCJfdXNlc09wbG9nIiwiY29tcGFyYXRvciIsImdldENvbXBhcmF0b3IiLCJoZWFwT3B0aW9ucyIsIklkTWFwIiwiX2xpbWl0IiwiX2NvbXBhcmF0b3IiLCJfc29ydGVyIiwiX3VucHVibGlzaGVkQnVmZmVyIiwiTWluTWF4SGVhcCIsIl9wdWJsaXNoZWQiLCJNYXhIZWFwIiwiX3NhZmVBcHBlbmRUb0J1ZmZlciIsIl9zdG9wSGFuZGxlcyIsIl9yZWdpc3RlclBoYXNlQ2hhbmdlIiwiX21hdGNoZXIiLCJfcHJvamVjdGlvbkZuIiwiX2NvbXBpbGVQcm9qZWN0aW9uIiwiX3NoYXJlZFByb2plY3Rpb24iLCJjb21iaW5lSW50b1Byb2plY3Rpb24iLCJfc2hhcmVkUHJvamVjdGlvbkZuIiwiX25lZWRUb0ZldGNoIiwiX2N1cnJlbnRseUZldGNoaW5nIiwiX2ZldGNoR2VuZXJhdGlvbiIsIl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkiLCJfd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSIsIl9uZWVkVG9Qb2xsUXVlcnkiLCJfcGhhc2UiLCJfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nIiwiX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nIiwiZmlyZWQiLCJfb3Bsb2dPYnNlcnZlRHJpdmVycyIsIm9uQmVmb3JlRmlyZSIsImRyaXZlcnMiLCJkcml2ZXIiLCJ2YWx1ZXMiLCJfcnVuSW5pdGlhbFF1ZXJ5IiwiX2FkZFB1Ymxpc2hlZCIsIl9ub1lpZWxkc0FsbG93ZWQiLCJvdmVyZmxvd2luZ0RvY0lkIiwibWF4RWxlbWVudElkIiwib3ZlcmZsb3dpbmdEb2MiLCJlcXVhbHMiLCJyZW1vdmUiLCJyZW1vdmVkIiwiX2FkZEJ1ZmZlcmVkIiwiX3JlbW92ZVB1Ymxpc2hlZCIsImVtcHR5IiwibmV3RG9jSWQiLCJtaW5FbGVtZW50SWQiLCJfcmVtb3ZlQnVmZmVyZWQiLCJfY2hhbmdlUHVibGlzaGVkIiwib2xkRG9jIiwicHJvamVjdGVkTmV3IiwicHJvamVjdGVkT2xkIiwiY2hhbmdlZCIsIkRpZmZTZXF1ZW5jZSIsIm1ha2VDaGFuZ2VkRmllbGRzIiwibWF4QnVmZmVyZWRJZCIsIl9hZGRNYXRjaGluZyIsIm1heFB1Ymxpc2hlZCIsIm1heEJ1ZmZlcmVkIiwidG9QdWJsaXNoIiwiY2FuQXBwZW5kVG9CdWZmZXIiLCJjYW5JbnNlcnRJbnRvQnVmZmVyIiwidG9CdWZmZXIiLCJfcmVtb3ZlTWF0Y2hpbmciLCJfaGFuZGxlRG9jIiwibWF0Y2hlc05vdyIsImRvY3VtZW50TWF0Y2hlcyIsInB1Ymxpc2hlZEJlZm9yZSIsImJ1ZmZlcmVkQmVmb3JlIiwiY2FjaGVkQmVmb3JlIiwibWluQnVmZmVyZWQiLCJzdGF5c0luUHVibGlzaGVkIiwic3RheXNJbkJ1ZmZlciIsIl9mZXRjaE1vZGlmaWVkRG9jdW1lbnRzIiwidGhpc0dlbmVyYXRpb24iLCJ3YWl0aW5nIiwiYXdhaXRhYmxlUHJvbWlzZSIsIl9iZVN0ZWFkeSIsIndyaXRlcyIsImlzUmVwbGFjZSIsImNhbkRpcmVjdGx5TW9kaWZ5RG9jIiwibW9kaWZpZXJDYW5CZURpcmVjdGx5QXBwbGllZCIsIl9tb2RpZnkiLCJjYW5CZWNvbWVUcnVlQnlNb2RpZmllciIsImFmZmVjdGVkQnlNb2RpZmllciIsIl9ydW5Jbml0aWFsUXVlcnlBc3luYyIsIl9ydW5RdWVyeSIsImluaXRpYWwiLCJfZG9uZVF1ZXJ5aW5nIiwiX3BvbGxRdWVyeSIsIl9ydW5RdWVyeUFzeW5jIiwibmV3QnVmZmVyIiwiX2N1cnNvckZvclF1ZXJ5IiwiaSIsIl9wdWJsaXNoTmV3UmVzdWx0cyIsIm9wdGlvbnNPdmVyd3JpdGUiLCJkZXNjcmlwdGlvbiIsImlkc1RvUmVtb3ZlIiwiX29wbG9nRW50cnlIYW5kbGUiLCJfbGlzdGVuZXJzSGFuZGxlIiwiX2l0ZXJhdG9yQWJydXB0Q29tcGxldGlvbiIsIl9kaWRJdGVyYXRvckVycm9yIiwiX2l0ZXJhdG9yRXJyb3IiLCJfaXRlcmF0b3IiLCJfc3RlcCIsInJldHVybiIsInBoYXNlIiwibm93IiwiRGF0ZSIsInRpbWVEaWZmIiwiX3BoYXNlU3RhcnRUaW1lIiwiZGlzYWJsZU9wbG9nIiwiX2Rpc2FibGVPcGxvZyIsIl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24iLCJoYXNXaGVyZSIsImhhc0dlb1F1ZXJ5IiwibW9kaWZpZXIiLCJvcGVyYXRpb24iLCJmaWVsZCIsInRlc3QiLCJwcmVmaXgiLCJjb25jYXQiLCJhcnJheU9wZXJhdG9yS2V5UmVnZXgiLCJpc0FycmF5T3BlcmF0b3JLZXkiLCJpc0FycmF5T3BlcmF0b3IiLCJvcGVyYXRvciIsImEiLCJldmVyeSIsImZsYXR0ZW5PYmplY3RJbnRvIiwidGFyZ2V0Iiwic291cmNlIiwibG9nRGVidWdNZXNzYWdlcyIsIk9QTE9HX0NPTlZFUlRFUl9ERUJVRyIsImNvbnZlcnRPcGxvZ0RpZmYiLCJvcGxvZ0VudHJ5IiwiZGlmZiIsImxvZyIsImRpZmZLZXkiLCJfb3Bsb2dFbnRyeSQkdW5zZXQiLCIkdW5zZXQiLCJfb3Bsb2dFbnRyeSQkc2V0IiwiJHNldCIsIl9vcGxvZ0VudHJ5JCRzZXQyIiwicG9zaXRpb24iLCJwb3NpdGlvbktleSIsIl9vcGxvZ0VudHJ5JCR1bnNldDIiLCJfb3Bsb2dFbnRyeSQkc2V0MyIsIiR2IiwiY29udmVydGVkT3Bsb2dFbnRyeSIsIkxvY2FsQ29sbGVjdGlvbkRyaXZlciIsIm5vQ29ubkNvbGxlY3Rpb25zIiwiY3JlYXRlIiwib3BlbiIsImNvbm4iLCJlbnN1cmVDb2xsZWN0aW9uIiwiX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zIiwiY29sbGVjdGlvbnMiLCJBU1lOQ19DT0xMRUNUSU9OX01FVEhPRFMiLCJSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwibW9uZ29fdXJsIiwiUkVNT1RFX0NPTExFQ1RJT05fTUVUSE9EUyIsIm0iLCJpbmNsdWRlcyIsImFzeW5jTWV0aG9kTmFtZSIsImRlZmF1bHRSZW1vdGVDb2xsZWN0aW9uRHJpdmVyIiwib25jZSIsImNvbm5lY3Rpb25PcHRpb25zIiwibW9uZ29VcmwiLCJNT05HT19VUkwiLCJNT05HT19PUExPR19VUkwiLCJzdGFydHVwIiwiY29ubmVjdCIsImNvbm5lY3Rpb24iLCJtYW5hZ2VyIiwiaWRHZW5lcmF0aW9uIiwiX2RyaXZlciIsIl9wcmV2ZW50QXV0b3B1Ymxpc2giLCJfbWFrZU5ld0lEIiwic3JjIiwiRERQIiwicmFuZG9tU3RyZWFtIiwiUmFuZG9tIiwiaW5zZWN1cmUiLCJoZXhTdHJpbmciLCJfY29ubmVjdGlvbiIsImlzQ2xpZW50Iiwic2VydmVyIiwiX2NvbGxlY3Rpb24iLCJfbmFtZSIsIl9zZXR0aW5nVXBSZXBsaWNhdGlvblByb21pc2UiLCJfbWF5YmVTZXRVcFJlcGxpY2F0aW9uIiwiZGVmaW5lTXV0YXRpb25NZXRob2RzIiwiX2RlZmluZU11dGF0aW9uTWV0aG9kcyIsInVzZUV4aXN0aW5nIiwiX3N1cHByZXNzU2FtZU5hbWVFcnJvciIsImF1dG9wdWJsaXNoIiwicHVibGlzaCIsImlzX2F1dG8iLCJfcmVnaXN0ZXJTdG9yZVJlc3VsdCIsIl9yZWdpc3RlclN0b3JlUmVzdWx0JCIsInJlZ2lzdGVyU3RvcmVDbGllbnQiLCJyZWdpc3RlclN0b3JlU2VydmVyIiwid3JhcHBlZFN0b3JlQ29tbW9uIiwic2F2ZU9yaWdpbmFscyIsInJldHJpZXZlT3JpZ2luYWxzIiwiX2dldENvbGxlY3Rpb24iLCJ3cmFwcGVkU3RvcmVDbGllbnQiLCJiZWdpblVwZGF0ZSIsImJhdGNoU2l6ZSIsInJlc2V0IiwicGF1c2VPYnNlcnZlcnMiLCJ1cGRhdGUiLCJtc2ciLCJtb25nb0lkIiwiTW9uZ29JRCIsImlkUGFyc2UiLCJfZG9jcyIsImluc2VydCIsImVuZFVwZGF0ZSIsInJlc3VtZU9ic2VydmVyc0NsaWVudCIsImdldERvYyIsImZpbmRPbmUiLCJ3cmFwcGVkU3RvcmVTZXJ2ZXIiLCJyZXN1bWVPYnNlcnZlcnNTZXJ2ZXIiLCJyZWdpc3RlclN0b3JlUmVzdWx0IiwibG9nV2FybiIsIndhcm4iLCJvayIsIl9nZXRGaW5kU2VsZWN0b3IiLCJfZ2V0RmluZE9wdGlvbnMiLCJuZXdPcHRpb25zIiwiTWF0Y2giLCJPcHRpb25hbCIsIk9iamVjdEluY2x1ZGluZyIsIk9uZU9mIiwiRnVuY3Rpb24iLCJOdW1iZXIiLCJfbGVuMyIsIl9rZXkzIiwiZmFsbGJhY2tJZCIsIl9zZWxlY3RvcklzSWQiLCJfaW5zZXJ0IiwiZ2V0UHJvdG90eXBlT2YiLCJnZXRPd25Qcm9wZXJ0eURlc2NyaXB0b3JzIiwiZ2VuZXJhdGVJZCIsIl9pc1JlbW90ZUNvbGxlY3Rpb24iLCJlbmNsb3NpbmciLCJfQ3VycmVudE1ldGhvZEludm9jYXRpb24iLCJjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0IiwiX2lzUHJvbWlzZSIsIndyYXBwZWRDYWxsYmFjayIsIndyYXBDYWxsYmFjayIsIl9jYWxsTXV0YXRvck1ldGhvZCIsIl9pbnNlcnRBc3luYyIsIl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jIiwiX2xlbjQiLCJvcHRpb25zQW5kQ2FsbGJhY2siLCJfa2V5NCIsInBvcENhbGxiYWNrRnJvbUFyZ3MiLCJMb2ciLCJkZWJ1ZyIsInJlQ3JlYXRlSW5kZXhPbk9wdGlvbk1pc21hdGNoIiwiaW5mbyIsInJhd0RhdGFiYXNlIiwiY29udmVydFJlc3VsdCIsIkFsbG93RGVueSIsIkNvbGxlY3Rpb25Qcm90b3R5cGUiLCJzZXRDb25uZWN0aW9uT3B0aW9ucyIsIm90aGVyT3B0aW9ucyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0lBQUEsSUFBSUEsYUFBYTtJQUFDQyxPQUFPLENBQUNDLElBQUksQ0FBQyxzQ0FBc0MsRUFBQztNQUFDQyxPQUFPQSxDQUFDQyxDQUFDLEVBQUM7UUFBQ0osYUFBYSxHQUFDSSxDQUFDO01BQUE7SUFBQyxDQUFDLEVBQUMsQ0FBQyxDQUFDO0lBQXRHLElBQUlDLG1CQUFtQjtJQUFDSixPQUFPLENBQUNDLElBQUksQ0FBQyxlQUFlLEVBQUM7TUFBQ0csbUJBQW1CQSxDQUFDRCxDQUFDLEVBQUM7UUFBQ0MsbUJBQW1CLEdBQUNELENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJRSxVQUFVO0lBQUNMLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLGtCQUFrQixFQUFDO01BQUNJLFVBQVVBLENBQUNGLENBQUMsRUFBQztRQUFDRSxVQUFVLEdBQUNGLENBQUM7TUFBQTtJQUFDLENBQUMsRUFBQyxDQUFDLENBQUM7SUFBQyxJQUFJRyxvQkFBb0IsRUFBQ0Msa0JBQWtCO0lBQUNQLE9BQU8sQ0FBQ0MsSUFBSSxDQUFDLDRCQUE0QixFQUFDO01BQUNLLG9CQUFvQkEsQ0FBQ0gsQ0FBQyxFQUFDO1FBQUNHLG9CQUFvQixHQUFDSCxDQUFDO01BQUEsQ0FBQztNQUFDSSxrQkFBa0JBLENBQUNKLENBQUMsRUFBQztRQUFDSSxrQkFBa0IsR0FBQ0osQ0FBQztNQUFBO0lBQUMsQ0FBQyxFQUFDLENBQUMsQ0FBQztJQUFDLElBQUlLLE1BQU07SUFBQ1IsT0FBTyxDQUFDQyxJQUFJLENBQUMsZUFBZSxFQUFDO01BQUNPLE1BQU1B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LENBQUM0ZixNQUFNLENBQUM7TUFBQzdnQixtQkFBbUIsRUFBQ0EsQ0FBQSxLQUFJQTtJQUFtQixDQUFDLENBQUM7SUFBckQsTUFBTUEsbUJBQW1CLEdBQUdzRSxPQUFPLElBQUk7TUFDNUM7TUFDQSxNQUFBb0IsSUFBQSxHQUFnRHBCLE9BQU8sSUFBSSxDQUFDLENBQUM7UUFBdkQ7VUFBRTZOLE1BQU07VUFBRUQ7UUFBNEIsQ0FBQyxHQUFBeE0sSUFBQTtRQUFkdXZCLFlBQVksR0FBQTdXLHdCQUFBLENBQUExWSxJQUFBLEVBQUEyWSxTQUFBO01BQzNDO01BQ0E7O01BRUEsT0FBQTFlLGFBQUEsQ0FBQUEsYUFBQSxLQUNLczFCLFlBQVksR0FDWC9pQixVQUFVLElBQUlDLE1BQU0sR0FBRztRQUFFRCxVQUFVLEVBQUVDLE1BQU0sSUFBSUQ7TUFBVyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRXhFLENBQUM7SUFBQ3dHLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFoVSxJQUFBO0VBQUFrVSxLQUFBO0FBQUEsRyIsImZpbGUiOiIvcGFja2FnZXMvbW9uZ28uanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBub3JtYWxpemVQcm9qZWN0aW9uIH0gZnJvbSBcIi4vbW9uZ29fdXRpbHNcIjtcblxuLyoqXG4gKiBQcm92aWRlIGEgc3luY2hyb25vdXMgQ29sbGVjdGlvbiBBUEkgdXNpbmcgZmliZXJzLCBiYWNrZWQgYnlcbiAqIE1vbmdvREIuICBUaGlzIGlzIG9ubHkgZm9yIHVzZSBvbiB0aGUgc2VydmVyLCBhbmQgbW9zdGx5IGlkZW50aWNhbFxuICogdG8gdGhlIGNsaWVudCBBUEkuXG4gKlxuICogTk9URTogdGhlIHB1YmxpYyBBUEkgbWV0aG9kcyBtdXN0IGJlIHJ1biB3aXRoaW4gYSBmaWJlci4gSWYgeW91IGNhbGxcbiAqIHRoZXNlIG91dHNpZGUgb2YgYSBmaWJlciB0aGV5IHdpbGwgZXhwbG9kZSFcbiAqL1xuXG5jb25zdCBwYXRoID0gcmVxdWlyZShcInBhdGhcIik7XG5jb25zdCB1dGlsID0gcmVxdWlyZShcInV0aWxcIik7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCdtb25nb2RiJyl9ICovXG52YXIgTW9uZ29EQiA9IE5wbU1vZHVsZU1vbmdvZGI7XG5pbXBvcnQgeyBEb2NGZXRjaGVyIH0gZnJvbSBcIi4vZG9jX2ZldGNoZXIuanNcIjtcbmltcG9ydCB7XG4gIEFTWU5DX0NVUlNPUl9NRVRIT0RTLFxuICBnZXRBc3luY01ldGhvZE5hbWVcbn0gZnJvbSBcIm1ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzXCI7XG5pbXBvcnQgeyBNZXRlb3IgfSBmcm9tIFwibWV0ZW9yL21ldGVvclwiO1xuXG5Nb25nb0ludGVybmFscyA9IHt9O1xuXG5Nb25nb0ludGVybmFscy5fX3BhY2thZ2VOYW1lID0gJ21vbmdvJztcblxuTW9uZ29JbnRlcm5hbHMuTnBtTW9kdWxlcyA9IHtcbiAgbW9uZ29kYjoge1xuICAgIHZlcnNpb246IE5wbU1vZHVsZU1vbmdvZGJWZXJzaW9uLFxuICAgIG1vZHVsZTogTW9uZ29EQlxuICB9XG59O1xuXG4vLyBPbGRlciB2ZXJzaW9uIG9mIHdoYXQgaXMgbm93IGF2YWlsYWJsZSB2aWFcbi8vIE1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZXMubW9uZ29kYi5tb2R1bGUuICBJdCB3YXMgbmV2ZXIgZG9jdW1lbnRlZCwgYnV0XG4vLyBwZW9wbGUgZG8gdXNlIGl0LlxuLy8gWFhYIENPTVBBVCBXSVRIIDEuMC4zLjJcbk1vbmdvSW50ZXJuYWxzLk5wbU1vZHVsZSA9IE1vbmdvREI7XG5cbmNvbnN0IEZJTEVfQVNTRVRfU1VGRklYID0gJ0Fzc2V0JztcbmNvbnN0IEFTU0VUU19GT0xERVIgPSAnYXNzZXRzJztcbmNvbnN0IEFQUF9GT0xERVIgPSAnYXBwJztcblxuLy8gVGhpcyBpcyB1c2VkIHRvIGFkZCBvciByZW1vdmUgRUpTT04gZnJvbSB0aGUgYmVnaW5uaW5nIG9mIGV2ZXJ5dGhpbmcgbmVzdGVkXG4vLyBpbnNpZGUgYW4gRUpTT04gY3VzdG9tIHR5cGUuIEl0IHNob3VsZCBvbmx5IGJlIGNhbGxlZCBvbiBwdXJlIEpTT04hXG52YXIgcmVwbGFjZU5hbWVzID0gZnVuY3Rpb24gKGZpbHRlciwgdGhpbmcpIHtcbiAgaWYgKHR5cGVvZiB0aGluZyA9PT0gXCJvYmplY3RcIiAmJiB0aGluZyAhPT0gbnVsbCkge1xuICAgIGlmIChfLmlzQXJyYXkodGhpbmcpKSB7XG4gICAgICByZXR1cm4gXy5tYXAodGhpbmcsIF8uYmluZChyZXBsYWNlTmFtZXMsIG51bGwsIGZpbHRlcikpO1xuICAgIH1cbiAgICB2YXIgcmV0ID0ge307XG4gICAgXy5lYWNoKHRoaW5nLCBmdW5jdGlvbiAodmFsdWUsIGtleSkge1xuICAgICAgcmV0W2ZpbHRlcihrZXkpXSA9IHJlcGxhY2VOYW1lcyhmaWx0ZXIsIHZhbHVlKTtcbiAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG4gIHJldHVybiB0aGluZztcbn07XG5cbi8vIEVuc3VyZSB0aGF0IEVKU09OLmNsb25lIGtlZXBzIGEgVGltZXN0YW1wIGFzIGEgVGltZXN0YW1wIChpbnN0ZWFkIG9mIGp1c3Rcbi8vIGRvaW5nIGEgc3RydWN0dXJhbCBjbG9uZSkuXG4vLyBYWFggaG93IG9rIGlzIHRoaXM/IHdoYXQgaWYgdGhlcmUgYXJlIG11bHRpcGxlIGNvcGllcyBvZiBNb25nb0RCIGxvYWRlZD9cbk1vbmdvREIuVGltZXN0YW1wLnByb3RvdHlwZS5jbG9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgLy8gVGltZXN0YW1wcyBzaG91bGQgYmUgaW1tdXRhYmxlLlxuICByZXR1cm4gdGhpcztcbn07XG5cbnZhciBtYWtlTW9uZ29MZWdhbCA9IGZ1bmN0aW9uIChuYW1lKSB7IHJldHVybiBcIkVKU09OXCIgKyBuYW1lOyB9O1xudmFyIHVubWFrZU1vbmdvTGVnYWwgPSBmdW5jdGlvbiAobmFtZSkgeyByZXR1cm4gbmFtZS5zdWJzdHIoNSk7IH07XG5cbnZhciByZXBsYWNlTW9uZ29BdG9tV2l0aE1ldGVvciA9IGZ1bmN0aW9uIChkb2N1bWVudCkge1xuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLkJpbmFyeSkge1xuICAgIC8vIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuICAgIGlmIChkb2N1bWVudC5zdWJfdHlwZSAhPT0gMCkge1xuICAgICAgcmV0dXJuIGRvY3VtZW50O1xuICAgIH1cbiAgICB2YXIgYnVmZmVyID0gZG9jdW1lbnQudmFsdWUodHJ1ZSk7XG4gICAgcmV0dXJuIG5ldyBVaW50OEFycmF5KGJ1ZmZlcik7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5PYmplY3RJRCkge1xuICAgIHJldHVybiBuZXcgTW9uZ28uT2JqZWN0SUQoZG9jdW1lbnQudG9IZXhTdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5EZWNpbWFsMTI4KSB7XG4gICAgcmV0dXJuIERlY2ltYWwoZG9jdW1lbnQudG9TdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50W1wiRUpTT04kdHlwZVwiXSAmJiBkb2N1bWVudFtcIkVKU09OJHZhbHVlXCJdICYmIF8uc2l6ZShkb2N1bWVudCkgPT09IDIpIHtcbiAgICByZXR1cm4gRUpTT04uZnJvbUpTT05WYWx1ZShyZXBsYWNlTmFtZXModW5tYWtlTW9uZ29MZWdhbCwgZG9jdW1lbnQpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLlRpbWVzdGFtcCkge1xuICAgIC8vIEZvciBub3csIHRoZSBNZXRlb3IgcmVwcmVzZW50YXRpb24gb2YgYSBNb25nbyB0aW1lc3RhbXAgdHlwZSAobm90IGEgZGF0ZSFcbiAgICAvLyB0aGlzIGlzIGEgd2VpcmQgaW50ZXJuYWwgdGhpbmcgdXNlZCBpbiB0aGUgb3Bsb2chKSBpcyB0aGUgc2FtZSBhcyB0aGVcbiAgICAvLyBNb25nbyByZXByZXNlbnRhdGlvbi4gV2UgbmVlZCB0byBkbyB0aGlzIGV4cGxpY2l0bHkgb3IgZWxzZSB3ZSB3b3VsZCBkbyBhXG4gICAgLy8gc3RydWN0dXJhbCBjbG9uZSBhbmQgbG9zZSB0aGUgcHJvdG90eXBlLlxuICAgIHJldHVybiBkb2N1bWVudDtcbiAgfVxuICByZXR1cm4gdW5kZWZpbmVkO1xufTtcblxudmFyIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvID0gZnVuY3Rpb24gKGRvY3VtZW50KSB7XG4gIGlmIChFSlNPTi5pc0JpbmFyeShkb2N1bWVudCkpIHtcbiAgICAvLyBUaGlzIGRvZXMgbW9yZSBjb3BpZXMgdGhhbiB3ZSdkIGxpa2UsIGJ1dCBpcyBuZWNlc3NhcnkgYmVjYXVzZVxuICAgIC8vIE1vbmdvREIuQlNPTiBvbmx5IGxvb2tzIGxpa2UgaXQgdGFrZXMgYSBVaW50OEFycmF5IChhbmQgZG9lc24ndCBhY3R1YWxseVxuICAgIC8vIHNlcmlhbGl6ZSBpdCBjb3JyZWN0bHkpLlxuICAgIHJldHVybiBuZXcgTW9uZ29EQi5CaW5hcnkoQnVmZmVyLmZyb20oZG9jdW1lbnQpKTtcbiAgfVxuICBpZiAoZG9jdW1lbnQgaW5zdGFuY2VvZiBNb25nb0RCLkJpbmFyeSkge1xuICAgICByZXR1cm4gZG9jdW1lbnQ7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpIHtcbiAgICByZXR1cm4gbmV3IE1vbmdvREIuT2JqZWN0SUQoZG9jdW1lbnQudG9IZXhTdHJpbmcoKSk7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgTW9uZ29EQi5UaW1lc3RhbXApIHtcbiAgICAvLyBGb3Igbm93LCB0aGUgTWV0ZW9yIHJlcHJlc2VudGF0aW9uIG9mIGEgTW9uZ28gdGltZXN0YW1wIHR5cGUgKG5vdCBhIGRhdGUhXG4gICAgLy8gdGhpcyBpcyBhIHdlaXJkIGludGVybmFsIHRoaW5nIHVzZWQgaW4gdGhlIG9wbG9nISkgaXMgdGhlIHNhbWUgYXMgdGhlXG4gICAgLy8gTW9uZ28gcmVwcmVzZW50YXRpb24uIFdlIG5lZWQgdG8gZG8gdGhpcyBleHBsaWNpdGx5IG9yIGVsc2Ugd2Ugd291bGQgZG8gYVxuICAgIC8vIHN0cnVjdHVyYWwgY2xvbmUgYW5kIGxvc2UgdGhlIHByb3RvdHlwZS5cbiAgICByZXR1cm4gZG9jdW1lbnQ7XG4gIH1cbiAgaWYgKGRvY3VtZW50IGluc3RhbmNlb2YgRGVjaW1hbCkge1xuICAgIHJldHVybiBNb25nb0RCLkRlY2ltYWwxMjguZnJvbVN0cmluZyhkb2N1bWVudC50b1N0cmluZygpKTtcbiAgfVxuICBpZiAoRUpTT04uX2lzQ3VzdG9tVHlwZShkb2N1bWVudCkpIHtcbiAgICByZXR1cm4gcmVwbGFjZU5hbWVzKG1ha2VNb25nb0xlZ2FsLCBFSlNPTi50b0pTT05WYWx1ZShkb2N1bWVudCkpO1xuICB9XG4gIC8vIEl0IGlzIG5vdCBvcmRpbmFyaWx5IHBvc3NpYmxlIHRvIHN0aWNrIGRvbGxhci1zaWduIGtleXMgaW50byBtb25nb1xuICAvLyBzbyB3ZSBkb24ndCBib3RoZXIgY2hlY2tpbmcgZm9yIHRoaW5ncyB0aGF0IG5lZWQgZXNjYXBpbmcgYXQgdGhpcyB0aW1lLlxuICByZXR1cm4gdW5kZWZpbmVkO1xufTtcblxudmFyIHJlcGxhY2VUeXBlcyA9IGZ1bmN0aW9uIChkb2N1bWVudCwgYXRvbVRyYW5zZm9ybWVyKSB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgIT09ICdvYmplY3QnIHx8IGRvY3VtZW50ID09PSBudWxsKVxuICAgIHJldHVybiBkb2N1bWVudDtcblxuICB2YXIgcmVwbGFjZWRUb3BMZXZlbEF0b20gPSBhdG9tVHJhbnNmb3JtZXIoZG9jdW1lbnQpO1xuICBpZiAocmVwbGFjZWRUb3BMZXZlbEF0b20gIT09IHVuZGVmaW5lZClcbiAgICByZXR1cm4gcmVwbGFjZWRUb3BMZXZlbEF0b207XG5cbiAgdmFyIHJldCA9IGRvY3VtZW50O1xuICBfLmVhY2goZG9jdW1lbnQsIGZ1bmN0aW9uICh2YWwsIGtleSkge1xuICAgIHZhciB2YWxSZXBsYWNlZCA9IHJlcGxhY2VUeXBlcyh2YWwsIGF0b21UcmFuc2Zvcm1lcik7XG4gICAgaWYgKHZhbCAhPT0gdmFsUmVwbGFjZWQpIHtcbiAgICAgIC8vIExhenkgY2xvbmUuIFNoYWxsb3cgY29weS5cbiAgICAgIGlmIChyZXQgPT09IGRvY3VtZW50KVxuICAgICAgICByZXQgPSBfLmNsb25lKGRvY3VtZW50KTtcbiAgICAgIHJldFtrZXldID0gdmFsUmVwbGFjZWQ7XG4gICAgfVxuICB9KTtcbiAgcmV0dXJuIHJldDtcbn07XG5cblxuTW9uZ29Db25uZWN0aW9uID0gZnVuY3Rpb24gKHVybCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzID0ge307XG4gIHNlbGYuX29uRmFpbG92ZXJIb29rID0gbmV3IEhvb2s7XG5cbiAgY29uc3QgdXNlck9wdGlvbnMgPSB7XG4gICAgLi4uKE1vbmdvLl9jb25uZWN0aW9uT3B0aW9ucyB8fCB7fSksXG4gICAgLi4uKE1ldGVvci5zZXR0aW5ncz8ucGFja2FnZXM/Lm1vbmdvPy5vcHRpb25zIHx8IHt9KVxuICB9O1xuXG4gIHZhciBtb25nb09wdGlvbnMgPSBPYmplY3QuYXNzaWduKHtcbiAgICBpZ25vcmVVbmRlZmluZWQ6IHRydWUsXG4gIH0sIHVzZXJPcHRpb25zKTtcblxuXG5cbiAgLy8gSW50ZXJuYWxseSB0aGUgb3Bsb2cgY29ubmVjdGlvbnMgc3BlY2lmeSB0aGVpciBvd24gbWF4UG9vbFNpemVcbiAgLy8gd2hpY2ggd2UgZG9uJ3Qgd2FudCB0byBvdmVyd3JpdGUgd2l0aCBhbnkgdXNlciBkZWZpbmVkIHZhbHVlXG4gIGlmIChfLmhhcyhvcHRpb25zLCAnbWF4UG9vbFNpemUnKSkge1xuICAgIC8vIElmIHdlIGp1c3Qgc2V0IHRoaXMgZm9yIFwic2VydmVyXCIsIHJlcGxTZXQgd2lsbCBvdmVycmlkZSBpdC4gSWYgd2UganVzdFxuICAgIC8vIHNldCBpdCBmb3IgcmVwbFNldCwgaXQgd2lsbCBiZSBpZ25vcmVkIGlmIHdlJ3JlIG5vdCB1c2luZyBhIHJlcGxTZXQuXG4gICAgbW9uZ29PcHRpb25zLm1heFBvb2xTaXplID0gb3B0aW9ucy5tYXhQb29sU2l6ZTtcbiAgfVxuXG4gIC8vIFRyYW5zZm9ybSBvcHRpb25zIGxpa2UgXCJ0bHNDQUZpbGVBc3NldFwiOiBcImZpbGVuYW1lLnBlbVwiIGludG9cbiAgLy8gXCJ0bHNDQUZpbGVcIjogXCIvPGZ1bGxwYXRoPi9maWxlbmFtZS5wZW1cIlxuICBPYmplY3QuZW50cmllcyhtb25nb09wdGlvbnMgfHwge30pXG4gICAgLmZpbHRlcigoW2tleV0pID0+IGtleSAmJiBrZXkuZW5kc1dpdGgoRklMRV9BU1NFVF9TVUZGSVgpKVxuICAgIC5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgIGNvbnN0IG9wdGlvbk5hbWUgPSBrZXkucmVwbGFjZShGSUxFX0FTU0VUX1NVRkZJWCwgJycpO1xuICAgICAgbW9uZ29PcHRpb25zW29wdGlvbk5hbWVdID0gcGF0aC5qb2luKEFzc2V0cy5nZXRTZXJ2ZXJEaXIoKSxcbiAgICAgICAgQVNTRVRTX0ZPTERFUiwgQVBQX0ZPTERFUiwgdmFsdWUpO1xuICAgICAgZGVsZXRlIG1vbmdvT3B0aW9uc1trZXldO1xuICAgIH0pO1xuXG4gIHNlbGYuZGIgPSBudWxsO1xuICBzZWxmLl9vcGxvZ0hhbmRsZSA9IG51bGw7XG4gIHNlbGYuX2RvY0ZldGNoZXIgPSBudWxsO1xuXG4gIHNlbGYuY2xpZW50ID0gbmV3IE1vbmdvREIuTW9uZ29DbGllbnQodXJsLCBtb25nb09wdGlvbnMpO1xuICBzZWxmLmRiID0gc2VsZi5jbGllbnQuZGIoKTtcblxuICBzZWxmLmNsaWVudC5vbignc2VydmVyRGVzY3JpcHRpb25DaGFuZ2VkJywgTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChldmVudCA9PiB7XG4gICAgLy8gV2hlbiB0aGUgY29ubmVjdGlvbiBpcyBubyBsb25nZXIgYWdhaW5zdCB0aGUgcHJpbWFyeSBub2RlLCBleGVjdXRlIGFsbFxuICAgIC8vIGZhaWxvdmVyIGhvb2tzLiBUaGlzIGlzIGltcG9ydGFudCBmb3IgdGhlIGRyaXZlciBhcyBpdCBoYXMgdG8gcmUtcG9vbCB0aGVcbiAgICAvLyBxdWVyeSB3aGVuIGl0IGhhcHBlbnMuXG4gICAgaWYgKFxuICAgICAgZXZlbnQucHJldmlvdXNEZXNjcmlwdGlvbi50eXBlICE9PSAnUlNQcmltYXJ5JyAmJlxuICAgICAgZXZlbnQubmV3RGVzY3JpcHRpb24udHlwZSA9PT0gJ1JTUHJpbWFyeSdcbiAgICApIHtcbiAgICAgIHNlbGYuX29uRmFpbG92ZXJIb29rLmVhY2goY2FsbGJhY2sgPT4ge1xuICAgICAgICBjYWxsYmFjaygpO1xuICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfSkpO1xuXG4gIGlmIChvcHRpb25zLm9wbG9nVXJsICYmICEgUGFja2FnZVsnZGlzYWJsZS1vcGxvZyddKSB7XG4gICAgc2VsZi5fb3Bsb2dIYW5kbGUgPSBuZXcgT3Bsb2dIYW5kbGUob3B0aW9ucy5vcGxvZ1VybCwgc2VsZi5kYi5kYXRhYmFzZU5hbWUpO1xuICAgIHNlbGYuX2RvY0ZldGNoZXIgPSBuZXcgRG9jRmV0Y2hlcihzZWxmKTtcbiAgfVxuXG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9jbG9zZSA9IGFzeW5jIGZ1bmN0aW9uKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKCEgc2VsZi5kYilcbiAgICB0aHJvdyBFcnJvcihcImNsb3NlIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuICAvLyBYWFggcHJvYmFibHkgdW50ZXN0ZWRcbiAgdmFyIG9wbG9nSGFuZGxlID0gc2VsZi5fb3Bsb2dIYW5kbGU7XG4gIHNlbGYuX29wbG9nSGFuZGxlID0gbnVsbDtcbiAgaWYgKG9wbG9nSGFuZGxlKVxuICAgIGF3YWl0IG9wbG9nSGFuZGxlLnN0b3AoKTtcblxuICAvLyBVc2UgRnV0dXJlLndyYXAgc28gdGhhdCBlcnJvcnMgZ2V0IHRocm93bi4gVGhpcyBoYXBwZW5zIHRvXG4gIC8vIHdvcmsgZXZlbiBvdXRzaWRlIGEgZmliZXIgc2luY2UgdGhlICdjbG9zZScgbWV0aG9kIGlzIG5vdFxuICAvLyBhY3R1YWxseSBhc3luY2hyb25vdXMuXG4gIGF3YWl0IHNlbGYuY2xpZW50LmNsb3NlKCk7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNsb3NlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5fY2xvc2UoKTtcbn07XG5cbi8vIFJldHVybnMgdGhlIE1vbmdvIENvbGxlY3Rpb24gb2JqZWN0OyBtYXkgeWllbGQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnJhd0NvbGxlY3Rpb24gPSBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmICghIHNlbGYuZGIpXG4gICAgdGhyb3cgRXJyb3IoXCJyYXdDb2xsZWN0aW9uIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuICByZXR1cm4gc2VsZi5kYi5jb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKFxuICAgIGNvbGxlY3Rpb25OYW1lLCBieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoISBzZWxmLmRiKVxuICAgIHRocm93IEVycm9yKFwiY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jIGNhbGxlZCBiZWZvcmUgQ29ubmVjdGlvbiBjcmVhdGVkP1wiKTtcblxuXG4gIGF3YWl0IHNlbGYuZGIuY3JlYXRlQ29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSxcbiAgICB7IGNhcHBlZDogdHJ1ZSwgc2l6ZTogYnl0ZVNpemUsIG1heDogbWF4RG9jdW1lbnRzIH0pO1xufTtcblxuLy8gVGhpcyBzaG91bGQgYmUgY2FsbGVkIHN5bmNocm9ub3VzbHkgd2l0aCBhIHdyaXRlLCB0byBjcmVhdGUgYVxuLy8gdHJhbnNhY3Rpb24gb24gdGhlIGN1cnJlbnQgd3JpdGUgZmVuY2UsIGlmIGFueS4gQWZ0ZXIgd2UgY2FuIHJlYWRcbi8vIHRoZSB3cml0ZSwgYW5kIGFmdGVyIG9ic2VydmVycyBoYXZlIGJlZW4gbm90aWZpZWQgKG9yIGF0IGxlYXN0LFxuLy8gYWZ0ZXIgdGhlIG9ic2VydmVyIG5vdGlmaWVycyBoYXZlIGFkZGVkIHRoZW1zZWx2ZXMgdG8gdGhlIHdyaXRlXG4vLyBmZW5jZSksIHlvdSBzaG91bGQgY2FsbCAnY29tbWl0dGVkKCknIG9uIHRoZSBvYmplY3QgcmV0dXJuZWQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9tYXliZUJlZ2luV3JpdGUgPSBmdW5jdGlvbiAoKSB7XG4gIGNvbnN0IGZlbmNlID0gRERQU2VydmVyLl9nZXRDdXJyZW50RmVuY2UoKTtcbiAgaWYgKGZlbmNlKSB7XG4gICAgcmV0dXJuIGZlbmNlLmJlZ2luV3JpdGUoKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4ge2NvbW1pdHRlZDogZnVuY3Rpb24gKCkge319O1xuICB9XG59O1xuXG4vLyBJbnRlcm5hbCBpbnRlcmZhY2U6IGFkZHMgYSBjYWxsYmFjayB3aGljaCBpcyBjYWxsZWQgd2hlbiB0aGUgTW9uZ28gcHJpbWFyeVxuLy8gY2hhbmdlcy4gUmV0dXJucyBhIHN0b3AgaGFuZGxlLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fb25GYWlsb3ZlciA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICByZXR1cm4gdGhpcy5fb25GYWlsb3Zlckhvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xufTtcblxuXG4vLy8vLy8vLy8vLy8gUHVibGljIEFQSSAvLy8vLy8vLy8vXG5cbi8vIFRoZSB3cml0ZSBtZXRob2RzIGJsb2NrIHVudGlsIHRoZSBkYXRhYmFzZSBoYXMgY29uZmlybWVkIHRoZSB3cml0ZSAoaXQgbWF5XG4vLyBub3QgYmUgcmVwbGljYXRlZCBvciBzdGFibGUgb24gZGlzaywgYnV0IG9uZSBzZXJ2ZXIgaGFzIGNvbmZpcm1lZCBpdCkgaWYgbm9cbi8vIGNhbGxiYWNrIGlzIHByb3ZpZGVkLiBJZiBhIGNhbGxiYWNrIGlzIHByb3ZpZGVkLCB0aGVuIHRoZXkgY2FsbCB0aGUgY2FsbGJhY2tcbi8vIHdoZW4gdGhlIHdyaXRlIGlzIGNvbmZpcm1lZC4gVGhleSByZXR1cm4gbm90aGluZyBvbiBzdWNjZXNzLCBhbmQgcmFpc2UgYW5cbi8vIGV4Y2VwdGlvbiBvbiBmYWlsdXJlLlxuLy9cbi8vIEFmdGVyIG1ha2luZyBhIHdyaXRlICh3aXRoIGluc2VydCwgdXBkYXRlLCByZW1vdmUpLCBvYnNlcnZlcnMgYXJlXG4vLyBub3RpZmllZCBhc3luY2hyb25vdXNseS4gSWYgeW91IHdhbnQgdG8gcmVjZWl2ZSBhIGNhbGxiYWNrIG9uY2UgYWxsXG4vLyBvZiB0aGUgb2JzZXJ2ZXIgbm90aWZpY2F0aW9ucyBoYXZlIGxhbmRlZCBmb3IgeW91ciB3cml0ZSwgZG8gdGhlXG4vLyB3cml0ZXMgaW5zaWRlIGEgd3JpdGUgZmVuY2UgKHNldCBERFBTZXJ2ZXIuX0N1cnJlbnRXcml0ZUZlbmNlIHRvIGEgbmV3XG4vLyBfV3JpdGVGZW5jZSwgYW5kIHRoZW4gc2V0IGEgY2FsbGJhY2sgb24gdGhlIHdyaXRlIGZlbmNlLilcbi8vXG4vLyBTaW5jZSBvdXIgZXhlY3V0aW9uIGVudmlyb25tZW50IGlzIHNpbmdsZS10aHJlYWRlZCwgdGhpcyBpc1xuLy8gd2VsbC1kZWZpbmVkIC0tIGEgd3JpdGUgXCJoYXMgYmVlbiBtYWRlXCIgaWYgaXQncyByZXR1cm5lZCwgYW5kIGFuXG4vLyBvYnNlcnZlciBcImhhcyBiZWVuIG5vdGlmaWVkXCIgaWYgaXRzIGNhbGxiYWNrIGhhcyByZXR1cm5lZC5cblxudmFyIHdyaXRlQ2FsbGJhY2sgPSBmdW5jdGlvbiAod3JpdGUsIHJlZnJlc2gsIGNhbGxiYWNrKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICBpZiAoISBlcnIpIHtcbiAgICAgIC8vIFhYWCBXZSBkb24ndCBoYXZlIHRvIHJ1biB0aGlzIG9uIGVycm9yLCByaWdodD9cbiAgICAgIHRyeSB7XG4gICAgICAgIHJlZnJlc2goKTtcbiAgICAgIH0gY2F0Y2ggKHJlZnJlc2hFcnIpIHtcbiAgICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgICAgY2FsbGJhY2socmVmcmVzaEVycik7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IHJlZnJlc2hFcnI7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICBjYWxsYmFjayhlcnIsIHJlc3VsdCk7XG4gICAgfSBlbHNlIGlmIChlcnIpIHtcbiAgICAgIHRocm93IGVycjtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgYmluZEVudmlyb25tZW50Rm9yV3JpdGUgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgcmV0dXJuIE1ldGVvci5iaW5kRW52aXJvbm1lbnQoY2FsbGJhY2ssIFwiTW9uZ28gd3JpdGVcIik7XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmluc2VydEFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgZG9jdW1lbnQpIHtcbiAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIGNvbnN0IGUgPSBuZXcgRXJyb3IoXCJGYWlsdXJlIHRlc3RcIik7XG4gICAgZS5fZXhwZWN0ZWRCeVRlc3QgPSB0cnVlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QoZG9jdW1lbnQpICYmXG4gICAgICAgICFFSlNPTi5faXNDdXN0b21UeXBlKGRvY3VtZW50KSkpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJPbmx5IHBsYWluIG9iamVjdHMgbWF5IGJlIGluc2VydGVkIGludG8gTW9uZ29EQlwiKTtcbiAgfVxuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICBhd2FpdCBNZXRlb3IucmVmcmVzaCh7Y29sbGVjdGlvbjogY29sbGVjdGlvbl9uYW1lLCBpZDogZG9jdW1lbnQuX2lkIH0pO1xuICB9O1xuICByZXR1cm4gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSkuaW5zZXJ0T25lKFxuICAgIHJlcGxhY2VUeXBlcyhkb2N1bWVudCwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIHtcbiAgICAgIHNhZmU6IHRydWUsXG4gICAgfVxuICApLnRoZW4oYXN5bmMgKHtpbnNlcnRlZElkfSkgPT4ge1xuICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICByZXR1cm4gaW5zZXJ0ZWRJZDtcbiAgfSkuY2F0Y2goYXN5bmMgZSA9PiB7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgdGhyb3cgZTtcbiAgfSk7XG59O1xuXG4vLyBDYXVzZSBxdWVyaWVzIHRoYXQgbWF5IGJlIGFmZmVjdGVkIGJ5IHRoZSBzZWxlY3RvciB0byBwb2xsIGluIHRoaXMgd3JpdGVcbi8vIGZlbmNlLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fcmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IpIHtcbiAgdmFyIHJlZnJlc2hLZXkgPSB7Y29sbGVjdGlvbjogY29sbGVjdGlvbk5hbWV9O1xuICAvLyBJZiB3ZSBrbm93IHdoaWNoIGRvY3VtZW50cyB3ZSdyZSByZW1vdmluZywgZG9uJ3QgcG9sbCBxdWVyaWVzIHRoYXQgYXJlXG4gIC8vIHNwZWNpZmljIHRvIG90aGVyIGRvY3VtZW50cy4gKE5vdGUgdGhhdCBtdWx0aXBsZSBub3RpZmljYXRpb25zIGhlcmUgc2hvdWxkXG4gIC8vIG5vdCBjYXVzZSBtdWx0aXBsZSBwb2xscywgc2luY2UgYWxsIG91ciBsaXN0ZW5lciBpcyBkb2luZyBpcyBlbnF1ZXVlaW5nIGFcbiAgLy8gcG9sbC4pXG4gIHZhciBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3Ioc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBmb3IgKGNvbnN0IGlkIG9mIHNwZWNpZmljSWRzKSB7XG4gICAgICBhd2FpdCBNZXRlb3IucmVmcmVzaChfLmV4dGVuZCh7aWQ6IGlkfSwgcmVmcmVzaEtleSkpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBhd2FpdCBNZXRlb3IucmVmcmVzaChyZWZyZXNoS2V5KTtcbiAgfVxufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5yZW1vdmVBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBpZiAoY29sbGVjdGlvbl9uYW1lID09PSBcIl9fX21ldGVvcl9mYWlsdXJlX3Rlc3RfY29sbGVjdGlvblwiKSB7XG4gICAgdmFyIGUgPSBuZXcgRXJyb3IoXCJGYWlsdXJlIHRlc3RcIik7XG4gICAgZS5fZXhwZWN0ZWRCeVRlc3QgPSB0cnVlO1xuICAgIHRocm93IGU7XG4gIH1cblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgc2VsZi5fcmVmcmVzaChjb2xsZWN0aW9uX25hbWUsIHNlbGVjdG9yKTtcbiAgfTtcblxuICByZXR1cm4gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSlcbiAgICAuZGVsZXRlTWFueShyZXBsYWNlVHlwZXMoc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSwge1xuICAgICAgc2FmZTogdHJ1ZSxcbiAgICB9KVxuICAgIC50aGVuKGFzeW5jICh7IGRlbGV0ZWRDb3VudCB9KSA9PiB7XG4gICAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgIHJldHVybiB0cmFuc2Zvcm1SZXN1bHQoeyByZXN1bHQgOiB7bW9kaWZpZWRDb3VudCA6IGRlbGV0ZWRDb3VudH0gfSkubnVtYmVyQWZmZWN0ZWQ7XG4gICAgfSkuY2F0Y2goYXN5bmMgKGVycikgPT4ge1xuICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgdGhyb3cgZXJyO1xuICAgIH0pO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5kcm9wQ29sbGVjdGlvbkFzeW5jID0gYXN5bmMgZnVuY3Rpb24oY29sbGVjdGlvbk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG5cbiAgdmFyIHdyaXRlID0gc2VsZi5fbWF5YmVCZWdpbldyaXRlKCk7XG4gIHZhciByZWZyZXNoID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIE1ldGVvci5yZWZyZXNoKHtcbiAgICAgIGNvbGxlY3Rpb246IGNvbGxlY3Rpb25OYW1lLFxuICAgICAgaWQ6IG51bGwsXG4gICAgICBkcm9wQ29sbGVjdGlvbjogdHJ1ZSxcbiAgICB9KTtcbiAgfTtcblxuICByZXR1cm4gc2VsZlxuICAgIC5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKVxuICAgIC5kcm9wKClcbiAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pXG4gICAgLmNhdGNoKGFzeW5jIGUgPT4ge1xuICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICB0aHJvdyBlO1xuICAgIH0pO1xufTtcblxuLy8gRm9yIHRlc3Rpbmcgb25seS4gIFNsaWdodGx5IGJldHRlciB0aGFuIGBjLnJhd0RhdGFiYXNlKCkuZHJvcERhdGFiYXNlKClgXG4vLyBiZWNhdXNlIGl0IGxldHMgdGhlIHRlc3QncyBmZW5jZSB3YWl0IGZvciBpdCB0byBiZSBjb21wbGV0ZS5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZHJvcERhdGFiYXNlQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICB2YXIgd3JpdGUgPSBzZWxmLl9tYXliZUJlZ2luV3JpdGUoKTtcbiAgdmFyIHJlZnJlc2ggPSBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgYXdhaXQgTWV0ZW9yLnJlZnJlc2goeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG4gIH07XG5cbiAgdHJ5IHtcbiAgICBhd2FpdCBzZWxmLmRiLl9kcm9wRGF0YWJhc2UoKTtcbiAgICBhd2FpdCByZWZyZXNoKCk7XG4gICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICB0aHJvdyBlO1xuICB9XG59O1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnVwZGF0ZUFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgaWYgKGNvbGxlY3Rpb25fbmFtZSA9PT0gXCJfX19tZXRlb3JfZmFpbHVyZV90ZXN0X2NvbGxlY3Rpb25cIikge1xuICAgIHZhciBlID0gbmV3IEVycm9yKFwiRmFpbHVyZSB0ZXN0XCIpO1xuICAgIGUuX2V4cGVjdGVkQnlUZXN0ID0gdHJ1ZTtcbiAgICB0aHJvdyBlO1xuICB9XG5cbiAgLy8gZXhwbGljaXQgc2FmZXR5IGNoZWNrLiBudWxsIGFuZCB1bmRlZmluZWQgY2FuIGNyYXNoIHRoZSBtb25nb1xuICAvLyBkcml2ZXIuIEFsdGhvdWdoIHRoZSBub2RlIGRyaXZlciBhbmQgbWluaW1vbmdvIGRvICdzdXBwb3J0J1xuICAvLyBub24tb2JqZWN0IG1vZGlmaWVyIGluIHRoYXQgdGhleSBkb24ndCBjcmFzaCwgdGhleSBhcmUgbm90XG4gIC8vIG1lYW5pbmdmdWwgb3BlcmF0aW9ucyBhbmQgZG8gbm90IGRvIGFueXRoaW5nLiBEZWZlbnNpdmVseSB0aHJvdyBhblxuICAvLyBlcnJvciBoZXJlLlxuICBpZiAoIW1vZCB8fCB0eXBlb2YgbW9kICE9PSAnb2JqZWN0Jykge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFwiSW52YWxpZCBtb2RpZmllci4gTW9kaWZpZXIgbXVzdCBiZSBhbiBvYmplY3QuXCIpO1xuXG4gICAgdGhyb3cgZXJyb3I7XG4gIH1cblxuICBpZiAoIShMb2NhbENvbGxlY3Rpb24uX2lzUGxhaW5PYmplY3QobW9kKSAmJiAhRUpTT04uX2lzQ3VzdG9tVHlwZShtb2QpKSkge1xuICAgIGNvbnN0IGVycm9yID0gbmV3IEVycm9yKFxuICAgICAgICBcIk9ubHkgcGxhaW4gb2JqZWN0cyBtYXkgYmUgdXNlZCBhcyByZXBsYWNlbWVudFwiICtcbiAgICAgICAgXCIgZG9jdW1lbnRzIGluIE1vbmdvREJcIik7XG5cbiAgICB0aHJvdyBlcnJvcjtcbiAgfVxuXG4gIGlmICghb3B0aW9ucykgb3B0aW9ucyA9IHt9O1xuXG4gIHZhciB3cml0ZSA9IHNlbGYuX21heWJlQmVnaW5Xcml0ZSgpO1xuICB2YXIgcmVmcmVzaCA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICBhd2FpdCBzZWxmLl9yZWZyZXNoKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IpO1xuICB9O1xuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25fbmFtZSk7XG4gIHZhciBtb25nb09wdHMgPSB7c2FmZTogdHJ1ZX07XG4gIC8vIEFkZCBzdXBwb3J0IGZvciBmaWx0ZXJlZCBwb3NpdGlvbmFsIG9wZXJhdG9yXG4gIGlmIChvcHRpb25zLmFycmF5RmlsdGVycyAhPT0gdW5kZWZpbmVkKSBtb25nb09wdHMuYXJyYXlGaWx0ZXJzID0gb3B0aW9ucy5hcnJheUZpbHRlcnM7XG4gIC8vIGV4cGxpY3RseSBlbnVtZXJhdGUgb3B0aW9ucyB0aGF0IG1pbmltb25nbyBzdXBwb3J0c1xuICBpZiAob3B0aW9ucy51cHNlcnQpIG1vbmdvT3B0cy51cHNlcnQgPSB0cnVlO1xuICBpZiAob3B0aW9ucy5tdWx0aSkgbW9uZ29PcHRzLm11bHRpID0gdHJ1ZTtcbiAgLy8gTGV0cyB5b3UgZ2V0IGEgbW9yZSBtb3JlIGZ1bGwgcmVzdWx0IGZyb20gTW9uZ29EQi4gVXNlIHdpdGggY2F1dGlvbjpcbiAgLy8gbWlnaHQgbm90IHdvcmsgd2l0aCBDLnVwc2VydCAoYXMgb3Bwb3NlZCB0byBDLnVwZGF0ZSh7dXBzZXJ0OnRydWV9KSBvclxuICAvLyB3aXRoIHNpbXVsYXRlZCB1cHNlcnQuXG4gIGlmIChvcHRpb25zLmZ1bGxSZXN1bHQpIG1vbmdvT3B0cy5mdWxsUmVzdWx0ID0gdHJ1ZTtcblxuICB2YXIgbW9uZ29TZWxlY3RvciA9IHJlcGxhY2VUeXBlcyhzZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pO1xuICB2YXIgbW9uZ29Nb2QgPSByZXBsYWNlVHlwZXMobW9kLCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbyk7XG5cbiAgdmFyIGlzTW9kaWZ5ID0gTG9jYWxDb2xsZWN0aW9uLl9pc01vZGlmaWNhdGlvbk1vZChtb25nb01vZCk7XG5cbiAgaWYgKG9wdGlvbnMuX2ZvcmJpZFJlcGxhY2UgJiYgIWlzTW9kaWZ5KSB7XG4gICAgdmFyIGVyciA9IG5ldyBFcnJvcihcIkludmFsaWQgbW9kaWZpZXIuIFJlcGxhY2VtZW50cyBhcmUgZm9yYmlkZGVuLlwiKTtcbiAgICB0aHJvdyBlcnI7XG4gIH1cblxuICAvLyBXZSd2ZSBhbHJlYWR5IHJ1biByZXBsYWNlVHlwZXMvcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28gb25cbiAgLy8gc2VsZWN0b3IgYW5kIG1vZC4gIFdlIGFzc3VtZSBpdCBkb2Vzbid0IG1hdHRlciwgYXMgZmFyIGFzXG4gIC8vIHRoZSBiZWhhdmlvciBvZiBtb2RpZmllcnMgaXMgY29uY2VybmVkLCB3aGV0aGVyIGBfbW9kaWZ5YFxuICAvLyBpcyBydW4gb24gRUpTT04gb3Igb24gbW9uZ28tY29udmVydGVkIEVKU09OLlxuXG4gIC8vIFJ1biB0aGlzIGNvZGUgdXAgZnJvbnQgc28gdGhhdCBpdCBmYWlscyBmYXN0IGlmIHNvbWVvbmUgdXNlc1xuICAvLyBhIE1vbmdvIHVwZGF0ZSBvcGVyYXRvciB3ZSBkb24ndCBzdXBwb3J0LlxuICBsZXQga25vd25JZDtcbiAgaWYgKG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgdHJ5IHtcbiAgICAgIGxldCBuZXdEb2MgPSBMb2NhbENvbGxlY3Rpb24uX2NyZWF0ZVVwc2VydERvY3VtZW50KHNlbGVjdG9yLCBtb2QpO1xuICAgICAga25vd25JZCA9IG5ld0RvYy5faWQ7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICB0aHJvdyBlcnI7XG4gICAgfVxuICB9XG4gIGlmIChvcHRpb25zLnVwc2VydCAmJlxuICAgICAgISBpc01vZGlmeSAmJlxuICAgICAgISBrbm93bklkICYmXG4gICAgICBvcHRpb25zLmluc2VydGVkSWQgJiZcbiAgICAgICEgKG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEICYmXG4gICAgICAgICBvcHRpb25zLmdlbmVyYXRlZElkKSkge1xuICAgIC8vIEluIGNhc2Ugb2YgYW4gdXBzZXJ0IHdpdGggYSByZXBsYWNlbWVudCwgd2hlcmUgdGhlcmUgaXMgbm8gX2lkIGRlZmluZWRcbiAgICAvLyBpbiBlaXRoZXIgdGhlIHF1ZXJ5IG9yIHRoZSByZXBsYWNlbWVudCBkb2MsIG1vbmdvIHdpbGwgZ2VuZXJhdGUgYW4gaWQgaXRzZWxmLlxuICAgIC8vIFRoZXJlZm9yZSB3ZSBuZWVkIHRoaXMgc3BlY2lhbCBzdHJhdGVneSBpZiB3ZSB3YW50IHRvIGNvbnRyb2wgdGhlIGlkIG91cnNlbHZlcy5cblxuICAgIC8vIFdlIGRvbid0IG5lZWQgdG8gZG8gdGhpcyB3aGVuOlxuICAgIC8vIC0gVGhpcyBpcyBub3QgYSByZXBsYWNlbWVudCwgc28gd2UgY2FuIGFkZCBhbiBfaWQgdG8gJHNldE9uSW5zZXJ0XG4gICAgLy8gLSBUaGUgaWQgaXMgZGVmaW5lZCBieSBxdWVyeSBvciBtb2Qgd2UgY2FuIGp1c3QgYWRkIGl0IHRvIHRoZSByZXBsYWNlbWVudCBkb2NcbiAgICAvLyAtIFRoZSB1c2VyIGRpZCBub3Qgc3BlY2lmeSBhbnkgaWQgcHJlZmVyZW5jZSBhbmQgdGhlIGlkIGlzIGEgTW9uZ28gT2JqZWN0SWQsXG4gICAgLy8gICAgIHRoZW4gd2UgY2FuIGp1c3QgbGV0IE1vbmdvIGdlbmVyYXRlIHRoZSBpZFxuICAgIHJldHVybiBhd2FpdCBzaW11bGF0ZVVwc2VydFdpdGhJbnNlcnRlZElkKGNvbGxlY3Rpb24sIG1vbmdvU2VsZWN0b3IsIG1vbmdvTW9kLCBvcHRpb25zKVxuICAgICAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgICAgICBhd2FpdCB3cml0ZS5jb21taXR0ZWQoKTtcbiAgICAgICAgICBpZiAocmVzdWx0ICYmICEgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0Lm51bWJlckFmZmVjdGVkO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gIH0gZWxzZSB7XG4gICAgaWYgKG9wdGlvbnMudXBzZXJ0ICYmICFrbm93bklkICYmIG9wdGlvbnMuaW5zZXJ0ZWRJZCAmJiBpc01vZGlmeSkge1xuICAgICAgaWYgKCFtb25nb01vZC5oYXNPd25Qcm9wZXJ0eSgnJHNldE9uSW5zZXJ0JykpIHtcbiAgICAgICAgbW9uZ29Nb2QuJHNldE9uSW5zZXJ0ID0ge307XG4gICAgICB9XG4gICAgICBrbm93bklkID0gb3B0aW9ucy5pbnNlcnRlZElkO1xuICAgICAgT2JqZWN0LmFzc2lnbihtb25nb01vZC4kc2V0T25JbnNlcnQsIHJlcGxhY2VUeXBlcyh7X2lkOiBvcHRpb25zLmluc2VydGVkSWR9LCByZXBsYWNlTWV0ZW9yQXRvbVdpdGhNb25nbykpO1xuICAgIH1cblxuICAgIGNvbnN0IHN0cmluZ3MgPSBPYmplY3Qua2V5cyhtb25nb01vZCkuZmlsdGVyKChrZXkpID0+ICFrZXkuc3RhcnRzV2l0aChcIiRcIikpO1xuICAgIGxldCB1cGRhdGVNZXRob2QgPSBzdHJpbmdzLmxlbmd0aCA+IDAgPyAncmVwbGFjZU9uZScgOiAndXBkYXRlTWFueSc7XG4gICAgdXBkYXRlTWV0aG9kID1cbiAgICAgICAgdXBkYXRlTWV0aG9kID09PSAndXBkYXRlTWFueScgJiYgIW1vbmdvT3B0cy5tdWx0aVxuICAgICAgICAgICAgPyAndXBkYXRlT25lJ1xuICAgICAgICAgICAgOiB1cGRhdGVNZXRob2Q7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb25bdXBkYXRlTWV0aG9kXVxuICAgICAgICAuYmluZChjb2xsZWN0aW9uKShtb25nb1NlbGVjdG9yLCBtb25nb01vZCwgbW9uZ29PcHRzKVxuICAgICAgICAudGhlbihhc3luYyByZXN1bHQgPT4ge1xuICAgICAgICAgIHZhciBtZXRlb3JSZXN1bHQgPSB0cmFuc2Zvcm1SZXN1bHQoe3Jlc3VsdH0pO1xuICAgICAgICAgIGlmIChtZXRlb3JSZXN1bHQgJiYgb3B0aW9ucy5fcmV0dXJuT2JqZWN0KSB7XG4gICAgICAgICAgICAvLyBJZiB0aGlzIHdhcyBhbiB1cHNlcnRBc3luYygpIGNhbGwsIGFuZCB3ZSBlbmRlZCB1cFxuICAgICAgICAgICAgLy8gaW5zZXJ0aW5nIGEgbmV3IGRvYyBhbmQgd2Uga25vdyBpdHMgaWQsIHRoZW5cbiAgICAgICAgICAgIC8vIHJldHVybiB0aGF0IGlkIGFzIHdlbGwuXG4gICAgICAgICAgICBpZiAob3B0aW9ucy51cHNlcnQgJiYgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQpIHtcbiAgICAgICAgICAgICAgaWYgKGtub3duSWQpIHtcbiAgICAgICAgICAgICAgICBtZXRlb3JSZXN1bHQuaW5zZXJ0ZWRJZCA9IGtub3duSWQ7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAobWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgaW5zdGFuY2VvZiBNb25nb0RCLk9iamVjdElEKSB7XG4gICAgICAgICAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBuZXcgTW9uZ28uT2JqZWN0SUQobWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQudG9IZXhTdHJpbmcoKSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGF3YWl0IHJlZnJlc2goKTtcbiAgICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgICAgcmV0dXJuIG1ldGVvclJlc3VsdDtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgYXdhaXQgcmVmcmVzaCgpO1xuICAgICAgICAgICAgYXdhaXQgd3JpdGUuY29tbWl0dGVkKCk7XG4gICAgICAgICAgICByZXR1cm4gbWV0ZW9yUmVzdWx0Lm51bWJlckFmZmVjdGVkO1xuICAgICAgICAgIH1cbiAgICAgICAgfSkuY2F0Y2goYXN5bmMgKGVycikgPT4ge1xuICAgICAgICAgIGF3YWl0IHdyaXRlLmNvbW1pdHRlZCgpO1xuICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgfSk7XG4gIH1cbn07XG5cbnZhciB0cmFuc2Zvcm1SZXN1bHQgPSBmdW5jdGlvbiAoZHJpdmVyUmVzdWx0KSB7XG4gIHZhciBtZXRlb3JSZXN1bHQgPSB7IG51bWJlckFmZmVjdGVkOiAwIH07XG4gIGlmIChkcml2ZXJSZXN1bHQpIHtcbiAgICB2YXIgbW9uZ29SZXN1bHQgPSBkcml2ZXJSZXN1bHQucmVzdWx0O1xuICAgIC8vIE9uIHVwZGF0ZXMgd2l0aCB1cHNlcnQ6dHJ1ZSwgdGhlIGluc2VydGVkIHZhbHVlcyBjb21lIGFzIGEgbGlzdCBvZlxuICAgIC8vIHVwc2VydGVkIHZhbHVlcyAtLSBldmVuIHdpdGggb3B0aW9ucy5tdWx0aSwgd2hlbiB0aGUgdXBzZXJ0IGRvZXMgaW5zZXJ0LFxuICAgIC8vIGl0IG9ubHkgaW5zZXJ0cyBvbmUgZWxlbWVudC5cbiAgICBpZiAobW9uZ29SZXN1bHQudXBzZXJ0ZWRDb3VudCkge1xuICAgICAgbWV0ZW9yUmVzdWx0Lm51bWJlckFmZmVjdGVkID0gbW9uZ29SZXN1bHQudXBzZXJ0ZWRDb3VudDtcblxuICAgICAgaWYgKG1vbmdvUmVzdWx0LnVwc2VydGVkSWQpIHtcbiAgICAgICAgbWV0ZW9yUmVzdWx0Lmluc2VydGVkSWQgPSBtb25nb1Jlc3VsdC51cHNlcnRlZElkO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBuIHdhcyB1c2VkIGJlZm9yZSBNb25nbyA1LjAsIGluIE1vbmdvIDUuMCB3ZSBhcmUgbm90IHJlY2VpdmluZyB0aGlzIG5cbiAgICAgIC8vIGZpZWxkIGFuZCBzbyB3ZSBhcmUgdXNpbmcgbW9kaWZpZWRDb3VudCBpbnN0ZWFkXG4gICAgICBtZXRlb3JSZXN1bHQubnVtYmVyQWZmZWN0ZWQgPSBtb25nb1Jlc3VsdC5uIHx8IG1vbmdvUmVzdWx0Lm1hdGNoZWRDb3VudCB8fCBtb25nb1Jlc3VsdC5tb2RpZmllZENvdW50O1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBtZXRlb3JSZXN1bHQ7XG59O1xuXG5cbnZhciBOVU1fT1BUSU1JU1RJQ19UUklFUyA9IDM7XG5cbi8vIGV4cG9zZWQgZm9yIHRlc3Rpbmdcbk1vbmdvQ29ubmVjdGlvbi5faXNDYW5ub3RDaGFuZ2VJZEVycm9yID0gZnVuY3Rpb24gKGVycikge1xuXG4gIC8vIE1vbmdvIDMuMi4qIHJldHVybnMgZXJyb3IgYXMgbmV4dCBPYmplY3Q6XG4gIC8vIHtuYW1lOiBTdHJpbmcsIGNvZGU6IE51bWJlciwgZXJybXNnOiBTdHJpbmd9XG4gIC8vIE9sZGVyIE1vbmdvIHJldHVybnM6XG4gIC8vIHtuYW1lOiBTdHJpbmcsIGNvZGU6IE51bWJlciwgZXJyOiBTdHJpbmd9XG4gIHZhciBlcnJvciA9IGVyci5lcnJtc2cgfHwgZXJyLmVycjtcblxuICAvLyBXZSBkb24ndCB1c2UgdGhlIGVycm9yIGNvZGUgaGVyZVxuICAvLyBiZWNhdXNlIHRoZSBlcnJvciBjb2RlIHdlIG9ic2VydmVkIGl0IHByb2R1Y2luZyAoMTY4MzcpIGFwcGVhcnMgdG8gYmVcbiAgLy8gYSBmYXIgbW9yZSBnZW5lcmljIGVycm9yIGNvZGUgYmFzZWQgb24gZXhhbWluaW5nIHRoZSBzb3VyY2UuXG4gIGlmIChlcnJvci5pbmRleE9mKCdUaGUgX2lkIGZpZWxkIGNhbm5vdCBiZSBjaGFuZ2VkJykgPT09IDBcbiAgICB8fCBlcnJvci5pbmRleE9mKFwidGhlIChpbW11dGFibGUpIGZpZWxkICdfaWQnIHdhcyBmb3VuZCB0byBoYXZlIGJlZW4gYWx0ZXJlZCB0byBfaWRcIikgIT09IC0xKSB7XG4gICAgcmV0dXJuIHRydWU7XG4gIH1cblxuICByZXR1cm4gZmFsc2U7XG59O1xuXG52YXIgc2ltdWxhdGVVcHNlcnRXaXRoSW5zZXJ0ZWRJZCA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uLCBzZWxlY3RvciwgbW9kLCBvcHRpb25zKSB7XG4gIC8vIFNUUkFURUdZOiBGaXJzdCB0cnkgZG9pbmcgYW4gdXBzZXJ0IHdpdGggYSBnZW5lcmF0ZWQgSUQuXG4gIC8vIElmIHRoaXMgdGhyb3dzIGFuIGVycm9yIGFib3V0IGNoYW5naW5nIHRoZSBJRCBvbiBhbiBleGlzdGluZyBkb2N1bWVudFxuICAvLyB0aGVuIHdpdGhvdXQgYWZmZWN0aW5nIHRoZSBkYXRhYmFzZSwgd2Uga25vdyB3ZSBzaG91bGQgcHJvYmFibHkgdHJ5XG4gIC8vIGFuIHVwZGF0ZSB3aXRob3V0IHRoZSBnZW5lcmF0ZWQgSUQuIElmIGl0IGFmZmVjdGVkIDAgZG9jdW1lbnRzLFxuICAvLyB0aGVuIHdpdGhvdXQgYWZmZWN0aW5nIHRoZSBkYXRhYmFzZSwgd2UgdGhlIGRvY3VtZW50IHRoYXQgZmlyc3RcbiAgLy8gZ2F2ZSB0aGUgZXJyb3IgaXMgcHJvYmFibHkgcmVtb3ZlZCBhbmQgd2UgbmVlZCB0byB0cnkgYW4gaW5zZXJ0IGFnYWluXG4gIC8vIFdlIGdvIGJhY2sgdG8gc3RlcCBvbmUgYW5kIHJlcGVhdC5cbiAgLy8gTGlrZSBhbGwgXCJvcHRpbWlzdGljIHdyaXRlXCIgc2NoZW1lcywgd2UgcmVseSBvbiB0aGUgZmFjdCB0aGF0IGl0J3NcbiAgLy8gdW5saWtlbHkgb3VyIHdyaXRlcyB3aWxsIGNvbnRpbnVlIHRvIGJlIGludGVyZmVyZWQgd2l0aCB1bmRlciBub3JtYWxcbiAgLy8gY2lyY3Vtc3RhbmNlcyAodGhvdWdoIHN1ZmZpY2llbnRseSBoZWF2eSBjb250ZW50aW9uIHdpdGggd3JpdGVyc1xuICAvLyBkaXNhZ3JlZWluZyBvbiB0aGUgZXhpc3RlbmNlIG9mIGFuIG9iamVjdCB3aWxsIGNhdXNlIHdyaXRlcyB0byBmYWlsXG4gIC8vIGluIHRoZW9yeSkuXG5cbiAgdmFyIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7IC8vIG11c3QgZXhpc3RcbiAgdmFyIG1vbmdvT3B0c0ZvclVwZGF0ZSA9IHtcbiAgICBzYWZlOiB0cnVlLFxuICAgIG11bHRpOiBvcHRpb25zLm11bHRpXG4gIH07XG4gIHZhciBtb25nb09wdHNGb3JJbnNlcnQgPSB7XG4gICAgc2FmZTogdHJ1ZSxcbiAgICB1cHNlcnQ6IHRydWVcbiAgfTtcblxuICB2YXIgcmVwbGFjZW1lbnRXaXRoSWQgPSBPYmplY3QuYXNzaWduKFxuICAgIHJlcGxhY2VUeXBlcyh7X2lkOiBpbnNlcnRlZElkfSwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgIG1vZCk7XG5cbiAgdmFyIHRyaWVzID0gTlVNX09QVElNSVNUSUNfVFJJRVM7XG5cbiAgdmFyIGRvVXBkYXRlID0gYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHRyaWVzLS07XG4gICAgaWYgKCEgdHJpZXMpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIlVwc2VydCBmYWlsZWQgYWZ0ZXIgXCIgKyBOVU1fT1BUSU1JU1RJQ19UUklFUyArIFwiIHRyaWVzLlwiKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IG1ldGhvZCA9IGNvbGxlY3Rpb24udXBkYXRlTWFueTtcbiAgICAgIGlmKCFPYmplY3Qua2V5cyhtb2QpLnNvbWUoa2V5ID0+IGtleS5zdGFydHNXaXRoKFwiJFwiKSkpe1xuICAgICAgICBtZXRob2QgPSBjb2xsZWN0aW9uLnJlcGxhY2VPbmUuYmluZChjb2xsZWN0aW9uKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiBtZXRob2QoXG4gICAgICAgIHNlbGVjdG9yLFxuICAgICAgICBtb2QsXG4gICAgICAgIG1vbmdvT3B0c0ZvclVwZGF0ZSkudGhlbihyZXN1bHQgPT4ge1xuICAgICAgICBpZiAocmVzdWx0ICYmIChyZXN1bHQubW9kaWZpZWRDb3VudCB8fCByZXN1bHQudXBzZXJ0ZWRDb3VudCkpIHtcbiAgICAgICAgICByZXR1cm4ge1xuICAgICAgICAgICAgbnVtYmVyQWZmZWN0ZWQ6IHJlc3VsdC5tb2RpZmllZENvdW50IHx8IHJlc3VsdC51cHNlcnRlZENvdW50LFxuICAgICAgICAgICAgaW5zZXJ0ZWRJZDogcmVzdWx0LnVwc2VydGVkSWQgfHwgdW5kZWZpbmVkLFxuICAgICAgICAgIH07XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmV0dXJuIGRvQ29uZGl0aW9uYWxJbnNlcnQoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICB9O1xuXG4gIHZhciBkb0NvbmRpdGlvbmFsSW5zZXJ0ID0gZnVuY3Rpb24oKSB7XG4gICAgcmV0dXJuIGNvbGxlY3Rpb24ucmVwbGFjZU9uZShzZWxlY3RvciwgcmVwbGFjZW1lbnRXaXRoSWQsIG1vbmdvT3B0c0Zvckluc2VydClcbiAgICAgICAgLnRoZW4ocmVzdWx0ID0+ICh7XG4gICAgICAgICAgICBudW1iZXJBZmZlY3RlZDogcmVzdWx0LnVwc2VydGVkQ291bnQsXG4gICAgICAgICAgICBpbnNlcnRlZElkOiByZXN1bHQudXBzZXJ0ZWRJZCxcbiAgICAgICAgICB9KSkuY2F0Y2goZXJyID0+IHtcbiAgICAgICAgaWYgKE1vbmdvQ29ubmVjdGlvbi5faXNDYW5ub3RDaGFuZ2VJZEVycm9yKGVycikpIHtcbiAgICAgICAgICByZXR1cm4gZG9VcGRhdGUoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuXG4gIH07XG4gIHJldHVybiBkb1VwZGF0ZSgpO1xufTtcblxuXG4vLyBYWFggTW9uZ29Db25uZWN0aW9uLnVwc2VydEFzeW5jKCkgZG9lcyBub3QgcmV0dXJuIHRoZSBpZCBvZiB0aGUgaW5zZXJ0ZWQgZG9jdW1lbnRcbi8vIHVubGVzcyB5b3Ugc2V0IGl0IGV4cGxpY2l0bHkgaW4gdGhlIHNlbGVjdG9yIG9yIG1vZGlmaWVyIChhcyBhIHJlcGxhY2VtZW50XG4vLyBkb2MpLlxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS51cHNlcnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG1vZCwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgcmV0dXJuIHNlbGYudXBkYXRlQXN5bmMoY29sbGVjdGlvbk5hbWUsIHNlbGVjdG9yLCBtb2QsXG4gICAgICAgICAgICAgICAgICAgICBfLmV4dGVuZCh7fSwgb3B0aW9ucywge1xuICAgICAgICAgICAgICAgICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICAgICAgICAgICAgICAgICAgIF9yZXR1cm5PYmplY3Q6IHRydWVcbiAgICAgICAgICAgICAgICAgICAgIH0pKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZmluZCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKVxuICAgIHNlbGVjdG9yID0ge307XG5cbiAgcmV0dXJuIG5ldyBDdXJzb3IoXG4gICAgc2VsZiwgbmV3IEN1cnNvckRlc2NyaXB0aW9uKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5maW5kT25lQXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbl9uYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgc2VsZWN0b3IgPSB7fTtcbiAgfVxuXG4gIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICBvcHRpb25zLmxpbWl0ID0gMTtcblxuICBjb25zdCByZXN1bHRzID0gYXdhaXQgc2VsZi5maW5kKGNvbGxlY3Rpb25fbmFtZSwgc2VsZWN0b3IsIG9wdGlvbnMpLmZldGNoKCk7XG5cbiAgcmV0dXJuIHJlc3VsdHNbMF07XG59O1xuXG4vLyBXZSdsbCBhY3R1YWxseSBkZXNpZ24gYW4gaW5kZXggQVBJIGxhdGVyLiBGb3Igbm93LCB3ZSBqdXN0IHBhc3MgdGhyb3VnaCB0b1xuLy8gTW9uZ28ncywgYnV0IG1ha2UgaXQgc3luY2hyb25vdXMuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmNyZWF0ZUluZGV4QXN5bmMgPSBhc3luYyBmdW5jdGlvbiAoY29sbGVjdGlvbk5hbWUsIGluZGV4LFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgLy8gV2UgZXhwZWN0IHRoaXMgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIGF0IHN0YXJ0dXAsIG5vdCBmcm9tIHdpdGhpbiBhIG1ldGhvZCxcbiAgLy8gc28gd2UgZG9uJ3QgaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuXG4gIHZhciBjb2xsZWN0aW9uID0gc2VsZi5yYXdDb2xsZWN0aW9uKGNvbGxlY3Rpb25OYW1lKTtcbiAgYXdhaXQgY29sbGVjdGlvbi5jcmVhdGVJbmRleChpbmRleCwgb3B0aW9ucyk7XG59O1xuXG4vLyBqdXN0IHRvIGJlIGNvbnNpc3RlbnQgd2l0aCB0aGUgb3RoZXIgbWV0aG9kc1xuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleCA9XG4gIE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuY3JlYXRlSW5kZXhBc3luYztcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jb3VudERvY3VtZW50cyA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgLi4uYXJncykge1xuICBhcmdzID0gYXJncy5tYXAoYXJnID0+IHJlcGxhY2VUeXBlcyhhcmcsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSk7XG4gIGNvbnN0IGNvbGxlY3Rpb24gPSB0aGlzLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICByZXR1cm4gY29sbGVjdGlvbi5jb3VudERvY3VtZW50cyguLi5hcmdzKTtcbn07XG5cbk1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUuZXN0aW1hdGVkRG9jdW1lbnRDb3VudCA9IGZ1bmN0aW9uIChjb2xsZWN0aW9uTmFtZSwgLi4uYXJncykge1xuICBhcmdzID0gYXJncy5tYXAoYXJnID0+IHJlcGxhY2VUeXBlcyhhcmcsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSk7XG4gIGNvbnN0IGNvbGxlY3Rpb24gPSB0aGlzLnJhd0NvbGxlY3Rpb24oY29sbGVjdGlvbk5hbWUpO1xuICByZXR1cm4gY29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50KC4uLmFyZ3MpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5lbnN1cmVJbmRleEFzeW5jID0gTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5jcmVhdGVJbmRleEFzeW5jO1xuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLmRyb3BJbmRleEFzeW5jID0gYXN5bmMgZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBpbmRleCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG5cblxuICAvLyBUaGlzIGZ1bmN0aW9uIGlzIG9ubHkgdXNlZCBieSB0ZXN0IGNvZGUsIG5vdCB3aXRoaW4gYSBtZXRob2QsIHNvIHdlIGRvbid0XG4gIC8vIGludGVyYWN0IHdpdGggdGhlIHdyaXRlIGZlbmNlLlxuICB2YXIgY29sbGVjdGlvbiA9IHNlbGYucmF3Q29sbGVjdGlvbihjb2xsZWN0aW9uTmFtZSk7XG4gIHZhciBpbmRleE5hbWUgPSAgYXdhaXQgY29sbGVjdGlvbi5kcm9wSW5kZXgoaW5kZXgpO1xufTtcblxuLy8gQ1VSU09SU1xuXG4vLyBUaGVyZSBhcmUgc2V2ZXJhbCBjbGFzc2VzIHdoaWNoIHJlbGF0ZSB0byBjdXJzb3JzOlxuLy9cbi8vIEN1cnNvckRlc2NyaXB0aW9uIHJlcHJlc2VudHMgdGhlIGFyZ3VtZW50cyB1c2VkIHRvIGNvbnN0cnVjdCBhIGN1cnNvcjpcbi8vIGNvbGxlY3Rpb25OYW1lLCBzZWxlY3RvciwgYW5kIChmaW5kKSBvcHRpb25zLiAgQmVjYXVzZSBpdCBpcyB1c2VkIGFzIGEga2V5XG4vLyBmb3IgY3Vyc29yIGRlLWR1cCwgZXZlcnl0aGluZyBpbiBpdCBzaG91bGQgZWl0aGVyIGJlIEpTT04tc3RyaW5naWZpYWJsZSBvclxuLy8gbm90IGFmZmVjdCBvYnNlcnZlQ2hhbmdlcyBvdXRwdXQgKGVnLCBvcHRpb25zLnRyYW5zZm9ybSBmdW5jdGlvbnMgYXJlIG5vdFxuLy8gc3RyaW5naWZpYWJsZSBidXQgZG8gbm90IGFmZmVjdCBvYnNlcnZlQ2hhbmdlcykuXG4vL1xuLy8gU3luY2hyb25vdXNDdXJzb3IgaXMgYSB3cmFwcGVyIGFyb3VuZCBhIE1vbmdvREIgY3Vyc29yXG4vLyB3aGljaCBpbmNsdWRlcyBmdWxseS1zeW5jaHJvbm91cyB2ZXJzaW9ucyBvZiBmb3JFYWNoLCBldGMuXG4vL1xuLy8gQ3Vyc29yIGlzIHRoZSBjdXJzb3Igb2JqZWN0IHJldHVybmVkIGZyb20gZmluZCgpLCB3aGljaCBpbXBsZW1lbnRzIHRoZVxuLy8gZG9jdW1lbnRlZCBNb25nby5Db2xsZWN0aW9uIGN1cnNvciBBUEkuICBJdCB3cmFwcyBhIEN1cnNvckRlc2NyaXB0aW9uIGFuZCBhXG4vLyBTeW5jaHJvbm91c0N1cnNvciAobGF6aWx5OiBpdCBkb2Vzbid0IGNvbnRhY3QgTW9uZ28gdW50aWwgeW91IGNhbGwgYSBtZXRob2Rcbi8vIGxpa2UgZmV0Y2ggb3IgZm9yRWFjaCBvbiBpdCkuXG4vL1xuLy8gT2JzZXJ2ZUhhbmRsZSBpcyB0aGUgXCJvYnNlcnZlIGhhbmRsZVwiIHJldHVybmVkIGZyb20gb2JzZXJ2ZUNoYW5nZXMuIEl0IGhhcyBhXG4vLyByZWZlcmVuY2UgdG8gYW4gT2JzZXJ2ZU11bHRpcGxleGVyLlxuLy9cbi8vIE9ic2VydmVNdWx0aXBsZXhlciBhbGxvd3MgbXVsdGlwbGUgaWRlbnRpY2FsIE9ic2VydmVIYW5kbGVzIHRvIGJlIGRyaXZlbiBieSBhXG4vLyBzaW5nbGUgb2JzZXJ2ZSBkcml2ZXIuXG4vL1xuLy8gVGhlcmUgYXJlIHR3byBcIm9ic2VydmUgZHJpdmVyc1wiIHdoaWNoIGRyaXZlIE9ic2VydmVNdWx0aXBsZXhlcnM6XG4vLyAgIC0gUG9sbGluZ09ic2VydmVEcml2ZXIgY2FjaGVzIHRoZSByZXN1bHRzIG9mIGEgcXVlcnkgYW5kIHJlcnVucyBpdCB3aGVuXG4vLyAgICAgbmVjZXNzYXJ5LlxuLy8gICAtIE9wbG9nT2JzZXJ2ZURyaXZlciBmb2xsb3dzIHRoZSBNb25nbyBvcGVyYXRpb24gbG9nIHRvIGRpcmVjdGx5IG9ic2VydmVcbi8vICAgICBkYXRhYmFzZSBjaGFuZ2VzLlxuLy8gQm90aCBpbXBsZW1lbnRhdGlvbnMgZm9sbG93IHRoZSBzYW1lIHNpbXBsZSBpbnRlcmZhY2U6IHdoZW4geW91IGNyZWF0ZSB0aGVtLFxuLy8gdGhleSBzdGFydCBzZW5kaW5nIG9ic2VydmVDaGFuZ2VzIGNhbGxiYWNrcyAoYW5kIGEgcmVhZHkoKSBpbnZvY2F0aW9uKSB0b1xuLy8gdGhlaXIgT2JzZXJ2ZU11bHRpcGxleGVyLCBhbmQgeW91IHN0b3AgdGhlbSBieSBjYWxsaW5nIHRoZWlyIHN0b3AoKSBtZXRob2QuXG5cbkN1cnNvckRlc2NyaXB0aW9uID0gZnVuY3Rpb24gKGNvbGxlY3Rpb25OYW1lLCBzZWxlY3Rvciwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuY29sbGVjdGlvbk5hbWUgPSBjb2xsZWN0aW9uTmFtZTtcbiAgc2VsZi5zZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG4gIHNlbGYub3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG59O1xuXG5DdXJzb3IgPSBmdW5jdGlvbiAobW9uZ28sIGN1cnNvckRlc2NyaXB0aW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcblxuICBzZWxmLl9tb25nbyA9IG1vbmdvO1xuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuICBzZWxmLl9zeW5jaHJvbm91c0N1cnNvciA9IG51bGw7XG59O1xuXG5mdW5jdGlvbiBzZXR1cFN5bmNocm9ub3VzQ3Vyc29yKGN1cnNvciwgbWV0aG9kKSB7XG4gIC8vIFlvdSBjYW4gb25seSBvYnNlcnZlIGEgdGFpbGFibGUgY3Vyc29yLlxuICBpZiAoY3Vyc29yLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKVxuICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNhbGwgJyArIG1ldGhvZCArICcgb24gYSB0YWlsYWJsZSBjdXJzb3InKTtcblxuICBpZiAoIWN1cnNvci5fc3luY2hyb25vdXNDdXJzb3IpIHtcbiAgICBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yID0gY3Vyc29yLl9tb25nby5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IoXG4gICAgICBjdXJzb3IuX2N1cnNvckRlc2NyaXB0aW9uLFxuICAgICAge1xuICAgICAgICAvLyBNYWtlIHN1cmUgdGhhdCB0aGUgXCJjdXJzb3JcIiBhcmd1bWVudCB0byBmb3JFYWNoL21hcCBjYWxsYmFja3MgaXMgdGhlXG4gICAgICAgIC8vIEN1cnNvciwgbm90IHRoZSBTeW5jaHJvbm91c0N1cnNvci5cbiAgICAgICAgc2VsZkZvckl0ZXJhdGlvbjogY3Vyc29yLFxuICAgICAgICB1c2VUcmFuc2Zvcm06IHRydWUsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiBjdXJzb3IuX3N5bmNocm9ub3VzQ3Vyc29yO1xufVxuXG5cbkN1cnNvci5wcm90b3R5cGUuY291bnRBc3luYyA9IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgY29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX21vbmdvLnJhd0NvbGxlY3Rpb24odGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUpO1xuICByZXR1cm4gYXdhaXQgY29sbGVjdGlvbi5jb3VudERvY3VtZW50cyhcbiAgICByZXBsYWNlVHlwZXModGhpcy5fY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICByZXBsYWNlVHlwZXModGhpcy5fY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucywgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICApO1xufTtcblxuWy4uLkFTWU5DX0NVUlNPUl9NRVRIT0RTLCBTeW1ib2wuaXRlcmF0b3IsIFN5bWJvbC5hc3luY0l0ZXJhdG9yXS5mb3JFYWNoKG1ldGhvZE5hbWUgPT4ge1xuICAvLyBjb3VudCBpcyBoYW5kbGVkIHNwZWNpYWxseSBzaW5jZSB3ZSBkb24ndCB3YW50IHRvIGNyZWF0ZSBhIGN1cnNvci5cbiAgLy8gaXQgaXMgc3RpbGwgaW5jbHVkZWQgaW4gQVNZTkNfQ1VSU09SX01FVEhPRFMgYmVjYXVzZSB3ZSBzdGlsbCB3YW50IGFuIGFzeW5jIHZlcnNpb24gb2YgaXQgdG8gZXhpc3QuXG4gIGlmIChtZXRob2ROYW1lID09PSAnY291bnQnKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgQ3Vyc29yLnByb3RvdHlwZVttZXRob2ROYW1lXSA9IGZ1bmN0aW9uICguLi5hcmdzKSB7XG4gICAgY29uc3QgY3Vyc29yID0gc2V0dXBTeW5jaHJvbm91c0N1cnNvcih0aGlzLCBtZXRob2ROYW1lKTtcbiAgICByZXR1cm4gY3Vyc29yW21ldGhvZE5hbWVdKC4uLmFyZ3MpO1xuICB9O1xuXG4gIC8vIFRoZXNlIG1ldGhvZHMgYXJlIGhhbmRsZWQgc2VwYXJhdGVseS5cbiAgaWYgKG1ldGhvZE5hbWUgPT09IFN5bWJvbC5pdGVyYXRvciB8fCBtZXRob2ROYW1lID09PSBTeW1ib2wuYXN5bmNJdGVyYXRvcikge1xuICAgIHJldHVybjtcbiAgfVxuXG4gIGNvbnN0IG1ldGhvZE5hbWVBc3luYyA9IGdldEFzeW5jTWV0aG9kTmFtZShtZXRob2ROYW1lKTtcbiAgQ3Vyc29yLnByb3RvdHlwZVttZXRob2ROYW1lQXN5bmNdID0gZnVuY3Rpb24gKC4uLmFyZ3MpIHtcbiAgICB0cnkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzW21ldGhvZE5hbWVdKC4uLmFyZ3MpKTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KGVycm9yKTtcbiAgICB9XG4gIH07XG59KTtcblxuQ3Vyc29yLnByb3RvdHlwZS5nZXRUcmFuc2Zvcm0gPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybTtcbn07XG5cbi8vIFdoZW4geW91IGNhbGwgTWV0ZW9yLnB1Ymxpc2goKSB3aXRoIGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIGEgQ3Vyc29yLCB3ZSBuZWVkXG4vLyB0byB0cmFuc211dGUgaXQgaW50byB0aGUgZXF1aXZhbGVudCBzdWJzY3JpcHRpb24uICBUaGlzIGlzIHRoZSBmdW5jdGlvbiB0aGF0XG4vLyBkb2VzIHRoYXQuXG5cbkN1cnNvci5wcm90b3R5cGUuX3B1Ymxpc2hDdXJzb3IgPSBmdW5jdGlvbiAoc3ViKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbiAgcmV0dXJuIE1vbmdvLkNvbGxlY3Rpb24uX3B1Ymxpc2hDdXJzb3Ioc2VsZiwgc3ViLCBjb2xsZWN0aW9uKTtcbn07XG5cbi8vIFVzZWQgdG8gZ3VhcmFudGVlIHRoYXQgcHVibGlzaCBmdW5jdGlvbnMgcmV0dXJuIGF0IG1vc3Qgb25lIGN1cnNvciBwZXJcbi8vIGNvbGxlY3Rpb24uIFByaXZhdGUsIGJlY2F1c2Ugd2UgbWlnaHQgbGF0ZXIgaGF2ZSBjdXJzb3JzIHRoYXQgaW5jbHVkZVxuLy8gZG9jdW1lbnRzIGZyb20gbXVsdGlwbGUgY29sbGVjdGlvbnMgc29tZWhvdy5cbkN1cnNvci5wcm90b3R5cGUuX2dldENvbGxlY3Rpb25OYW1lID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHJldHVybiBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZTtcbn07XG5cbkN1cnNvci5wcm90b3R5cGUub2JzZXJ2ZSA9IGZ1bmN0aW9uIChjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICByZXR1cm4gTG9jYWxDb2xsZWN0aW9uLl9vYnNlcnZlRnJvbU9ic2VydmVDaGFuZ2VzKHNlbGYsIGNhbGxiYWNrcyk7XG59O1xuXG5DdXJzb3IucHJvdG90eXBlLm9ic2VydmVDaGFuZ2VzID0gZnVuY3Rpb24gKGNhbGxiYWNrcywgb3B0aW9ucyA9IHt9KSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIG1ldGhvZHMgPSBbXG4gICAgJ2FkZGVkQXQnLFxuICAgICdhZGRlZCcsXG4gICAgJ2NoYW5nZWRBdCcsXG4gICAgJ2NoYW5nZWQnLFxuICAgICdyZW1vdmVkQXQnLFxuICAgICdyZW1vdmVkJyxcbiAgICAnbW92ZWRUbydcbiAgXTtcbiAgdmFyIG9yZGVyZWQgPSBMb2NhbENvbGxlY3Rpb24uX29ic2VydmVDaGFuZ2VzQ2FsbGJhY2tzQXJlT3JkZXJlZChjYWxsYmFja3MpO1xuXG4gIGxldCBleGNlcHRpb25OYW1lID0gY2FsbGJhY2tzLl9mcm9tT2JzZXJ2ZSA/ICdvYnNlcnZlJyA6ICdvYnNlcnZlQ2hhbmdlcyc7XG4gIGV4Y2VwdGlvbk5hbWUgKz0gJyBjYWxsYmFjayc7XG4gIG1ldGhvZHMuZm9yRWFjaChmdW5jdGlvbiAobWV0aG9kKSB7XG4gICAgaWYgKGNhbGxiYWNrc1ttZXRob2RdICYmIHR5cGVvZiBjYWxsYmFja3NbbWV0aG9kXSA9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgIGNhbGxiYWNrc1ttZXRob2RdID0gTWV0ZW9yLmJpbmRFbnZpcm9ubWVudChjYWxsYmFja3NbbWV0aG9kXSwgbWV0aG9kICsgZXhjZXB0aW9uTmFtZSk7XG4gICAgfVxuICB9KTtcblxuICByZXR1cm4gc2VsZi5fbW9uZ28uX29ic2VydmVDaGFuZ2VzKFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MsIG9wdGlvbnMubm9uTXV0YXRpbmdDYWxsYmFja3MpO1xufTtcblxuTW9uZ29Db25uZWN0aW9uLnByb3RvdHlwZS5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IgPSBmdW5jdGlvbihcbiAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3B0aW9ucykge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIG9wdGlvbnMgPSBfLnBpY2sob3B0aW9ucyB8fCB7fSwgJ3NlbGZGb3JJdGVyYXRpb24nLCAndXNlVHJhbnNmb3JtJyk7XG5cbiAgdmFyIGNvbGxlY3Rpb24gPSBzZWxmLnJhd0NvbGxlY3Rpb24oY3Vyc29yRGVzY3JpcHRpb24uY29sbGVjdGlvbk5hbWUpO1xuICB2YXIgY3Vyc29yT3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnM7XG4gIHZhciBtb25nb09wdGlvbnMgPSB7XG4gICAgc29ydDogY3Vyc29yT3B0aW9ucy5zb3J0LFxuICAgIGxpbWl0OiBjdXJzb3JPcHRpb25zLmxpbWl0LFxuICAgIHNraXA6IGN1cnNvck9wdGlvbnMuc2tpcCxcbiAgICBwcm9qZWN0aW9uOiBjdXJzb3JPcHRpb25zLmZpZWxkcyB8fCBjdXJzb3JPcHRpb25zLnByb2plY3Rpb24sXG4gICAgcmVhZFByZWZlcmVuY2U6IGN1cnNvck9wdGlvbnMucmVhZFByZWZlcmVuY2UsXG4gIH07XG5cbiAgLy8gRG8gd2Ugd2FudCBhIHRhaWxhYmxlIGN1cnNvciAod2hpY2ggb25seSB3b3JrcyBvbiBjYXBwZWQgY29sbGVjdGlvbnMpP1xuICBpZiAoY3Vyc29yT3B0aW9ucy50YWlsYWJsZSkge1xuICAgIG1vbmdvT3B0aW9ucy5udW1iZXJPZlJldHJpZXMgPSAtMTtcbiAgfVxuXG4gIHZhciBkYkN1cnNvciA9IGNvbGxlY3Rpb24uZmluZChcbiAgICByZXBsYWNlVHlwZXMoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICBtb25nb09wdGlvbnMpO1xuXG4gIC8vIERvIHdlIHdhbnQgYSB0YWlsYWJsZSBjdXJzb3IgKHdoaWNoIG9ubHkgd29ya3Mgb24gY2FwcGVkIGNvbGxlY3Rpb25zKT9cbiAgaWYgKGN1cnNvck9wdGlvbnMudGFpbGFibGUpIHtcbiAgICAvLyBXZSB3YW50IGEgdGFpbGFibGUgY3Vyc29yLi4uXG4gICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcInRhaWxhYmxlXCIsIHRydWUpXG4gICAgLy8gLi4uIGFuZCBmb3IgdGhlIHNlcnZlciB0byB3YWl0IGEgYml0IGlmIGFueSBnZXRNb3JlIGhhcyBubyBkYXRhIChyYXRoZXJcbiAgICAvLyB0aGFuIG1ha2luZyB1cyBwdXQgdGhlIHJlbGV2YW50IHNsZWVwcyBpbiB0aGUgY2xpZW50KS4uLlxuICAgIGRiQ3Vyc29yLmFkZEN1cnNvckZsYWcoXCJhd2FpdERhdGFcIiwgdHJ1ZSlcblxuICAgIC8vIEFuZCBpZiB0aGlzIGlzIG9uIHRoZSBvcGxvZyBjb2xsZWN0aW9uIGFuZCB0aGUgY3Vyc29yIHNwZWNpZmllcyBhICd0cycsXG4gICAgLy8gdGhlbiBzZXQgdGhlIHVuZG9jdW1lbnRlZCBvcGxvZyByZXBsYXkgZmxhZywgd2hpY2ggZG9lcyBhIHNwZWNpYWwgc2NhbiB0b1xuICAgIC8vIGZpbmQgdGhlIGZpcnN0IGRvY3VtZW50IChpbnN0ZWFkIG9mIGNyZWF0aW5nIGFuIGluZGV4IG9uIHRzKS4gVGhpcyBpcyBhXG4gICAgLy8gdmVyeSBoYXJkLWNvZGVkIE1vbmdvIGZsYWcgd2hpY2ggb25seSB3b3JrcyBvbiB0aGUgb3Bsb2cgY29sbGVjdGlvbiBhbmRcbiAgICAvLyBvbmx5IHdvcmtzIHdpdGggdGhlIHRzIGZpZWxkLlxuICAgIGlmIChjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSA9PT0gT1BMT0dfQ09MTEVDVElPTiAmJlxuICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvci50cykge1xuICAgICAgZGJDdXJzb3IuYWRkQ3Vyc29yRmxhZyhcIm9wbG9nUmVwbGF5XCIsIHRydWUpXG4gICAgfVxuICB9XG5cbiAgaWYgKHR5cGVvZiBjdXJzb3JPcHRpb25zLm1heFRpbWVNcyAhPT0gJ3VuZGVmaW5lZCcpIHtcbiAgICBkYkN1cnNvciA9IGRiQ3Vyc29yLm1heFRpbWVNUyhjdXJzb3JPcHRpb25zLm1heFRpbWVNcyk7XG4gIH1cbiAgaWYgKHR5cGVvZiBjdXJzb3JPcHRpb25zLmhpbnQgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgZGJDdXJzb3IgPSBkYkN1cnNvci5oaW50KGN1cnNvck9wdGlvbnMuaGludCk7XG4gIH1cblxuICByZXR1cm4gbmV3IEFzeW5jaHJvbm91c0N1cnNvcihkYkN1cnNvciwgY3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnMsIGNvbGxlY3Rpb24pO1xufTtcblxuLyoqXG4gKiBUaGlzIGlzIGp1c3QgYSBsaWdodCB3cmFwcGVyIGZvciB0aGUgY3Vyc29yLiBUaGUgZ29hbCBoZXJlIGlzIHRvIGVuc3VyZSBjb21wYXRpYmlsaXR5IGV2ZW4gaWZcbiAqIHRoZXJlIGFyZSBicmVha2luZyBjaGFuZ2VzIG9uIHRoZSBNb25nb0RCIGRyaXZlci5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuY2xhc3MgQXN5bmNocm9ub3VzQ3Vyc29yIHtcbiAgY29uc3RydWN0b3IoZGJDdXJzb3IsIGN1cnNvckRlc2NyaXB0aW9uLCBvcHRpb25zKSB7XG4gICAgdGhpcy5fZGJDdXJzb3IgPSBkYkN1cnNvcjtcbiAgICB0aGlzLl9jdXJzb3JEZXNjcmlwdGlvbiA9IGN1cnNvckRlc2NyaXB0aW9uO1xuXG4gICAgdGhpcy5fc2VsZkZvckl0ZXJhdGlvbiA9IG9wdGlvbnMuc2VsZkZvckl0ZXJhdGlvbiB8fCB0aGlzO1xuICAgIGlmIChvcHRpb25zLnVzZVRyYW5zZm9ybSAmJiBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSkge1xuICAgICAgdGhpcy5fdHJhbnNmb3JtID0gTG9jYWxDb2xsZWN0aW9uLndyYXBUcmFuc2Zvcm0oXG4gICAgICAgICAgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl90cmFuc2Zvcm0gPSBudWxsO1xuICAgIH1cblxuICAgIHRoaXMuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgfVxuXG4gIFtTeW1ib2wuaXRlcmF0b3JdKCkge1xuICAgIHJldHVybiB0aGlzLl9jdXJzb3JbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICB9XG5cbiAgLy8gUmV0dXJucyBhIFByb21pc2UgZm9yIHRoZSBuZXh0IG9iamVjdCBmcm9tIHRoZSB1bmRlcmx5aW5nIGN1cnNvciAoYmVmb3JlXG4gIC8vIHRoZSBNb25nby0+TWV0ZW9yIHR5cGUgcmVwbGFjZW1lbnQpLlxuICBhc3luYyBfcmF3TmV4dE9iamVjdFByb21pc2UoKSB7XG4gICAgdHJ5IHtcbiAgICAgIHJldHVybiB0aGlzLl9kYkN1cnNvci5uZXh0KCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICB9XG4gIH1cblxuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIGN1cnNvciwgc2tpcHBpbmcgdGhvc2Ugd2hvc2VcbiAgLy8gSURzIHdlJ3ZlIGFscmVhZHkgc2VlbiBhbmQgcmVwbGFjaW5nIE1vbmdvIGF0b21zIHdpdGggTWV0ZW9yIGF0b21zLlxuICBhc3luYyBfbmV4dE9iamVjdFByb21pc2UgKCkge1xuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICB2YXIgZG9jID0gYXdhaXQgdGhpcy5fcmF3TmV4dE9iamVjdFByb21pc2UoKTtcblxuICAgICAgaWYgKCFkb2MpIHJldHVybiBudWxsO1xuICAgICAgZG9jID0gcmVwbGFjZVR5cGVzKGRvYywgcmVwbGFjZU1vbmdvQXRvbVdpdGhNZXRlb3IpO1xuXG4gICAgICBpZiAoIXRoaXMuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUgJiYgXy5oYXMoZG9jLCAnX2lkJykpIHtcbiAgICAgICAgLy8gRGlkIE1vbmdvIGdpdmUgdXMgZHVwbGljYXRlIGRvY3VtZW50cyBpbiB0aGUgc2FtZSBjdXJzb3I/IElmIHNvLFxuICAgICAgICAvLyBpZ25vcmUgdGhpcyBvbmUuIChEbyB0aGlzIGJlZm9yZSB0aGUgdHJhbnNmb3JtLCBzaW5jZSB0cmFuc2Zvcm0gbWlnaHRcbiAgICAgICAgLy8gcmV0dXJuIHNvbWUgdW5yZWxhdGVkIHZhbHVlLikgV2UgZG9uJ3QgZG8gdGhpcyBmb3IgdGFpbGFibGUgY3Vyc29ycyxcbiAgICAgICAgLy8gYmVjYXVzZSB3ZSB3YW50IHRvIG1haW50YWluIE8oMSkgbWVtb3J5IHVzYWdlLiBBbmQgaWYgdGhlcmUgaXNuJ3QgX2lkXG4gICAgICAgIC8vIGZvciBzb21lIHJlYXNvbiAobWF5YmUgaXQncyB0aGUgb3Bsb2cpLCB0aGVuIHdlIGRvbid0IGRvIHRoaXMgZWl0aGVyLlxuICAgICAgICAvLyAoQmUgY2FyZWZ1bCB0byBkbyB0aGlzIGZvciBmYWxzZXkgYnV0IGV4aXN0aW5nIF9pZCwgdGhvdWdoLilcbiAgICAgICAgaWYgKHRoaXMuX3Zpc2l0ZWRJZHMuaGFzKGRvYy5faWQpKSBjb250aW51ZTtcbiAgICAgICAgdGhpcy5fdmlzaXRlZElkcy5zZXQoZG9jLl9pZCwgdHJ1ZSk7XG4gICAgICB9XG5cbiAgICAgIGlmICh0aGlzLl90cmFuc2Zvcm0pXG4gICAgICAgIGRvYyA9IHRoaXMuX3RyYW5zZm9ybShkb2MpO1xuXG4gICAgICByZXR1cm4gZG9jO1xuICAgIH1cbiAgfVxuXG4gIC8vIFJldHVybnMgYSBwcm9taXNlIHdoaWNoIGlzIHJlc29sdmVkIHdpdGggdGhlIG5leHQgb2JqZWN0IChsaWtlIHdpdGhcbiAgLy8gX25leHRPYmplY3RQcm9taXNlKSBvciByZWplY3RlZCBpZiB0aGUgY3Vyc29yIGRvZXNuJ3QgcmV0dXJuIHdpdGhpblxuICAvLyB0aW1lb3V0TVMgbXMuXG4gIF9uZXh0T2JqZWN0UHJvbWlzZVdpdGhUaW1lb3V0KHRpbWVvdXRNUykge1xuICAgIGlmICghdGltZW91dE1TKSB7XG4gICAgICByZXR1cm4gdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICB9XG4gICAgY29uc3QgbmV4dE9iamVjdFByb21pc2UgPSB0aGlzLl9uZXh0T2JqZWN0UHJvbWlzZSgpO1xuICAgIGNvbnN0IHRpbWVvdXRFcnIgPSBuZXcgRXJyb3IoJ0NsaWVudC1zaWRlIHRpbWVvdXQgd2FpdGluZyBmb3IgbmV4dCBvYmplY3QnKTtcbiAgICBjb25zdCB0aW1lb3V0UHJvbWlzZSA9IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcbiAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QodGltZW91dEVycik7XG4gICAgICB9LCB0aW1lb3V0TVMpO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoW25leHRPYmplY3RQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pXG4gICAgICAgIC5jYXRjaCgoZXJyKSA9PiB7XG4gICAgICAgICAgaWYgKGVyciA9PT0gdGltZW91dEVycikge1xuICAgICAgICAgICAgdGhpcy5jbG9zZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgICB0aHJvdyBlcnI7XG4gICAgICAgIH0pO1xuICB9XG5cbiAgYXN5bmMgZm9yRWFjaChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gICAgdGhpcy5fcmV3aW5kKCk7XG5cbiAgICBsZXQgaWR4ID0gMDtcbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgY29uc3QgZG9jID0gYXdhaXQgdGhpcy5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICAgIGlmICghZG9jKSByZXR1cm47XG4gICAgICBhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaWR4KyssIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIGFzeW5jIG1hcChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIGNvbnN0IHJlc3VsdHMgPSBbXTtcbiAgICBhd2FpdCB0aGlzLmZvckVhY2goYXN5bmMgKGRvYywgaW5kZXgpID0+IHtcbiAgICAgIHJlc3VsdHMucHVzaChhd2FpdCBjYWxsYmFjay5jYWxsKHRoaXNBcmcsIGRvYywgaW5kZXgsIHRoaXMuX3NlbGZGb3JJdGVyYXRpb24pKTtcbiAgICB9KTtcblxuICAgIHJldHVybiByZXN1bHRzO1xuICB9XG5cbiAgX3Jld2luZCgpIHtcbiAgICAvLyBrbm93biB0byBiZSBzeW5jaHJvbm91c1xuICAgIHRoaXMuX2RiQ3Vyc29yLnJld2luZCgpO1xuXG4gICAgdGhpcy5fdmlzaXRlZElkcyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICB9XG5cbiAgLy8gTW9zdGx5IHVzYWJsZSBmb3IgdGFpbGFibGUgY3Vyc29ycy5cbiAgY2xvc2UoKSB7XG4gICAgdGhpcy5fZGJDdXJzb3IuY2xvc2UoKTtcbiAgfVxuXG4gIGZldGNoKCkge1xuICAgIHJldHVybiB0aGlzLm1hcChfLmlkZW50aXR5KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBGSVhNRTogKG5vZGU6MzQ2ODApIFtNT05HT0RCIERSSVZFUl0gV2FybmluZzogY3Vyc29yLmNvdW50IGlzIGRlcHJlY2F0ZWQgYW5kIHdpbGwgYmVcbiAgICogIHJlbW92ZWQgaW4gdGhlIG5leHQgbWFqb3IgdmVyc2lvbiwgcGxlYXNlIHVzZSBgY29sbGVjdGlvbi5lc3RpbWF0ZWREb2N1bWVudENvdW50YCBvclxuICAgKiAgYGNvbGxlY3Rpb24uY291bnREb2N1bWVudHNgIGluc3RlYWQuXG4gICAqL1xuICBjb3VudCgpIHtcbiAgICByZXR1cm4gdGhpcy5fZGJDdXJzb3IuY291bnQoKTtcbiAgfVxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIE5PVCB3cmFwcGVkIGluIEN1cnNvci5cbiAgYXN5bmMgZ2V0UmF3T2JqZWN0cyhvcmRlcmVkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChvcmRlcmVkKSB7XG4gICAgICByZXR1cm4gc2VsZi5mZXRjaCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgcmVzdWx0cyA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgICAgYXdhaXQgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MpIHtcbiAgICAgICAgcmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuIHJlc3VsdHM7XG4gICAgfVxuICB9XG59XG5cbnZhciBTeW5jaHJvbm91c0N1cnNvciA9IGZ1bmN0aW9uIChkYkN1cnNvciwgY3Vyc29yRGVzY3JpcHRpb24sIG9wdGlvbnMsIGNvbGxlY3Rpb24pIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBvcHRpb25zID0gXy5waWNrKG9wdGlvbnMgfHwge30sICdzZWxmRm9ySXRlcmF0aW9uJywgJ3VzZVRyYW5zZm9ybScpO1xuXG4gIHNlbGYuX2RiQ3Vyc29yID0gZGJDdXJzb3I7XG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gY3Vyc29yRGVzY3JpcHRpb247XG4gIC8vIFRoZSBcInNlbGZcIiBhcmd1bWVudCBwYXNzZWQgdG8gZm9yRWFjaC9tYXAgY2FsbGJhY2tzLiBJZiB3ZSdyZSB3cmFwcGVkXG4gIC8vIGluc2lkZSBhIHVzZXItdmlzaWJsZSBDdXJzb3IsIHdlIHdhbnQgdG8gcHJvdmlkZSB0aGUgb3V0ZXIgY3Vyc29yIVxuICBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uID0gb3B0aW9ucy5zZWxmRm9ySXRlcmF0aW9uIHx8IHNlbGY7XG4gIGlmIChvcHRpb25zLnVzZVRyYW5zZm9ybSAmJiBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRyYW5zZm9ybSkge1xuICAgIHNlbGYuX3RyYW5zZm9ybSA9IExvY2FsQ29sbGVjdGlvbi53cmFwVHJhbnNmb3JtKFxuICAgICAgY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy50cmFuc2Zvcm0pO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuX3RyYW5zZm9ybSA9IG51bGw7XG4gIH1cblxuICBzZWxmLl9zeW5jaHJvbm91c0NvdW50ID0gRnV0dXJlLndyYXAoXG4gICAgY29sbGVjdGlvbi5jb3VudERvY3VtZW50cy5iaW5kKFxuICAgICAgY29sbGVjdGlvbixcbiAgICAgIHJlcGxhY2VUeXBlcyhjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvciwgcmVwbGFjZU1ldGVvckF0b21XaXRoTW9uZ28pLFxuICAgICAgcmVwbGFjZVR5cGVzKGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMsIHJlcGxhY2VNZXRlb3JBdG9tV2l0aE1vbmdvKSxcbiAgICApXG4gICk7XG4gIHNlbGYuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbn07XG5cbl8uZXh0ZW5kKFN5bmNocm9ub3VzQ3Vyc29yLnByb3RvdHlwZSwge1xuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIHVuZGVybHlpbmcgY3Vyc29yIChiZWZvcmVcbiAgLy8gdGhlIE1vbmdvLT5NZXRlb3IgdHlwZSByZXBsYWNlbWVudCkuXG4gIF9yYXdOZXh0T2JqZWN0UHJvbWlzZTogZnVuY3Rpb24gKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBzZWxmLl9kYkN1cnNvci5uZXh0KChlcnIsIGRvYykgPT4ge1xuICAgICAgICBpZiAoZXJyKSB7XG4gICAgICAgICAgcmVqZWN0KGVycik7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcmVzb2x2ZShkb2MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBSZXR1cm5zIGEgUHJvbWlzZSBmb3IgdGhlIG5leHQgb2JqZWN0IGZyb20gdGhlIGN1cnNvciwgc2tpcHBpbmcgdGhvc2Ugd2hvc2VcbiAgLy8gSURzIHdlJ3ZlIGFscmVhZHkgc2VlbiBhbmQgcmVwbGFjaW5nIE1vbmdvIGF0b21zIHdpdGggTWV0ZW9yIGF0b21zLlxuICBfbmV4dE9iamVjdFByb21pc2U6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgdmFyIGRvYyA9IGF3YWl0IHNlbGYuX3Jhd05leHRPYmplY3RQcm9taXNlKCk7XG5cbiAgICAgIGlmICghZG9jKSByZXR1cm4gbnVsbDtcbiAgICAgIGRvYyA9IHJlcGxhY2VUeXBlcyhkb2MsIHJlcGxhY2VNb25nb0F0b21XaXRoTWV0ZW9yKTtcblxuICAgICAgaWYgKCFzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlICYmIF8uaGFzKGRvYywgJ19pZCcpKSB7XG4gICAgICAgIC8vIERpZCBNb25nbyBnaXZlIHVzIGR1cGxpY2F0ZSBkb2N1bWVudHMgaW4gdGhlIHNhbWUgY3Vyc29yPyBJZiBzbyxcbiAgICAgICAgLy8gaWdub3JlIHRoaXMgb25lLiAoRG8gdGhpcyBiZWZvcmUgdGhlIHRyYW5zZm9ybSwgc2luY2UgdHJhbnNmb3JtIG1pZ2h0XG4gICAgICAgIC8vIHJldHVybiBzb21lIHVucmVsYXRlZCB2YWx1ZS4pIFdlIGRvbid0IGRvIHRoaXMgZm9yIHRhaWxhYmxlIGN1cnNvcnMsXG4gICAgICAgIC8vIGJlY2F1c2Ugd2Ugd2FudCB0byBtYWludGFpbiBPKDEpIG1lbW9yeSB1c2FnZS4gQW5kIGlmIHRoZXJlIGlzbid0IF9pZFxuICAgICAgICAvLyBmb3Igc29tZSByZWFzb24gKG1heWJlIGl0J3MgdGhlIG9wbG9nKSwgdGhlbiB3ZSBkb24ndCBkbyB0aGlzIGVpdGhlci5cbiAgICAgICAgLy8gKEJlIGNhcmVmdWwgdG8gZG8gdGhpcyBmb3IgZmFsc2V5IGJ1dCBleGlzdGluZyBfaWQsIHRob3VnaC4pXG4gICAgICAgIGlmIChzZWxmLl92aXNpdGVkSWRzLmhhcyhkb2MuX2lkKSkgY29udGludWU7XG4gICAgICAgIHNlbGYuX3Zpc2l0ZWRJZHMuc2V0KGRvYy5faWQsIHRydWUpO1xuICAgICAgfVxuXG4gICAgICBpZiAoc2VsZi5fdHJhbnNmb3JtKVxuICAgICAgICBkb2MgPSBzZWxmLl90cmFuc2Zvcm0oZG9jKTtcblxuICAgICAgcmV0dXJuIGRvYztcbiAgICB9XG4gIH0sXG5cbiAgLy8gUmV0dXJucyBhIHByb21pc2Ugd2hpY2ggaXMgcmVzb2x2ZWQgd2l0aCB0aGUgbmV4dCBvYmplY3QgKGxpa2Ugd2l0aFxuICAvLyBfbmV4dE9iamVjdFByb21pc2UpIG9yIHJlamVjdGVkIGlmIHRoZSBjdXJzb3IgZG9lc24ndCByZXR1cm4gd2l0aGluXG4gIC8vIHRpbWVvdXRNUyBtcy5cbiAgX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQ6IGZ1bmN0aW9uICh0aW1lb3V0TVMpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICBpZiAoIXRpbWVvdXRNUykge1xuICAgICAgcmV0dXJuIHNlbGYuX25leHRPYmplY3RQcm9taXNlKCk7XG4gICAgfVxuICAgIGNvbnN0IG5leHRPYmplY3RQcm9taXNlID0gc2VsZi5fbmV4dE9iamVjdFByb21pc2UoKTtcbiAgICBjb25zdCB0aW1lb3V0RXJyID0gbmV3IEVycm9yKCdDbGllbnQtc2lkZSB0aW1lb3V0IHdhaXRpbmcgZm9yIG5leHQgb2JqZWN0Jyk7XG4gICAgY29uc3QgdGltZW91dFByb21pc2UgPSBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICByZWplY3QodGltZW91dEVycik7XG4gICAgICB9LCB0aW1lb3V0TVMpO1xuICAgIH0pO1xuICAgIHJldHVybiBQcm9taXNlLnJhY2UoW25leHRPYmplY3RQcm9taXNlLCB0aW1lb3V0UHJvbWlzZV0pXG4gICAgICAuY2F0Y2goKGVycikgPT4ge1xuICAgICAgICBpZiAoZXJyID09PSB0aW1lb3V0RXJyKSB7XG4gICAgICAgICAgc2VsZi5jbG9zZSgpO1xuICAgICAgICB9XG4gICAgICAgIHRocm93IGVycjtcbiAgICAgIH0pO1xuICB9LFxuXG4gIF9uZXh0T2JqZWN0OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9uZXh0T2JqZWN0UHJvbWlzZSgpLmF3YWl0KCk7XG4gIH0sXG5cbiAgZm9yRWFjaDogZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzQXJnKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGNvbnN0IHdyYXBwZWRGbiA9IE1ldGVvci53cmFwRm4oY2FsbGJhY2spO1xuXG4gICAgLy8gR2V0IGJhY2sgdG8gdGhlIGJlZ2lubmluZy5cbiAgICBzZWxmLl9yZXdpbmQoKTtcblxuICAgIC8vIFdlIGltcGxlbWVudCB0aGUgbG9vcCBvdXJzZWxmIGluc3RlYWQgb2YgdXNpbmcgc2VsZi5fZGJDdXJzb3IuZWFjaCxcbiAgICAvLyBiZWNhdXNlIFwiZWFjaFwiIHdpbGwgY2FsbCBpdHMgY2FsbGJhY2sgb3V0c2lkZSBvZiBhIGZpYmVyIHdoaWNoIG1ha2VzIGl0XG4gICAgLy8gbXVjaCBtb3JlIGNvbXBsZXggdG8gbWFrZSB0aGlzIGZ1bmN0aW9uIHN5bmNocm9ub3VzLlxuICAgIHZhciBpbmRleCA9IDA7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIHZhciBkb2MgPSBzZWxmLl9uZXh0T2JqZWN0KCk7XG4gICAgICBpZiAoIWRvYykgcmV0dXJuO1xuICAgICAgd3JhcHBlZEZuLmNhbGwodGhpc0FyZywgZG9jLCBpbmRleCsrLCBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uKTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gWFhYIEFsbG93IG92ZXJsYXBwaW5nIGNhbGxiYWNrIGV4ZWN1dGlvbnMgaWYgY2FsbGJhY2sgeWllbGRzLlxuICBtYXA6IGZ1bmN0aW9uIChjYWxsYmFjaywgdGhpc0FyZykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBjb25zdCB3cmFwcGVkRm4gPSBNZXRlb3Iud3JhcEZuKGNhbGxiYWNrKTtcbiAgICB2YXIgcmVzID0gW107XG4gICAgc2VsZi5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGluZGV4KSB7XG4gICAgICByZXMucHVzaCh3cmFwcGVkRm4uY2FsbCh0aGlzQXJnLCBkb2MsIGluZGV4LCBzZWxmLl9zZWxmRm9ySXRlcmF0aW9uKSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHJlcztcbiAgfSxcblxuICBfcmV3aW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgLy8ga25vd24gdG8gYmUgc3luY2hyb25vdXNcbiAgICBzZWxmLl9kYkN1cnNvci5yZXdpbmQoKTtcblxuICAgIHNlbGYuX3Zpc2l0ZWRJZHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgfSxcblxuICAvLyBNb3N0bHkgdXNhYmxlIGZvciB0YWlsYWJsZSBjdXJzb3JzLlxuICBjbG9zZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIHNlbGYuX2RiQ3Vyc29yLmNsb3NlKCk7XG4gIH0sXG5cbiAgZmV0Y2g6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgcmV0dXJuIHNlbGYubWFwKF8uaWRlbnRpdHkpO1xuICB9LFxuXG4gIGNvdW50OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBzZWxmLl9zeW5jaHJvbm91c0NvdW50KCkud2FpdCgpO1xuICB9LFxuXG4gIC8vIFRoaXMgbWV0aG9kIGlzIE5PVCB3cmFwcGVkIGluIEN1cnNvci5cbiAgZ2V0UmF3T2JqZWN0czogZnVuY3Rpb24gKG9yZGVyZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIHJldHVybiBzZWxmLmZldGNoKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciByZXN1bHRzID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICBzZWxmLmZvckVhY2goZnVuY3Rpb24gKGRvYykge1xuICAgICAgICByZXN1bHRzLnNldChkb2MuX2lkLCBkb2MpO1xuICAgICAgfSk7XG4gICAgICByZXR1cm4gcmVzdWx0cztcbiAgICB9XG4gIH1cbn0pO1xuXG5TeW5jaHJvbm91c0N1cnNvci5wcm90b3R5cGVbU3ltYm9sLml0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIEdldCBiYWNrIHRvIHRoZSBiZWdpbm5pbmcuXG4gIHNlbGYuX3Jld2luZCgpO1xuXG4gIHJldHVybiB7XG4gICAgbmV4dCgpIHtcbiAgICAgIGNvbnN0IGRvYyA9IHNlbGYuX25leHRPYmplY3QoKTtcbiAgICAgIHJldHVybiBkb2MgPyB7XG4gICAgICAgIHZhbHVlOiBkb2NcbiAgICAgIH0gOiB7XG4gICAgICAgIGRvbmU6IHRydWVcbiAgICAgIH07XG4gICAgfVxuICB9O1xufTtcblxuU3luY2hyb25vdXNDdXJzb3IucHJvdG90eXBlW1N5bWJvbC5hc3luY0l0ZXJhdG9yXSA9IGZ1bmN0aW9uICgpIHtcbiAgY29uc3Qgc3luY1Jlc3VsdCA9IHRoaXNbU3ltYm9sLml0ZXJhdG9yXSgpO1xuICByZXR1cm4ge1xuICAgIGFzeW5jIG5leHQoKSB7XG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHN5bmNSZXN1bHQubmV4dCgpKTtcbiAgICB9XG4gIH07XG59XG5cbi8vIFRhaWxzIHRoZSBjdXJzb3IgZGVzY3JpYmVkIGJ5IGN1cnNvckRlc2NyaXB0aW9uLCBtb3N0IGxpa2VseSBvbiB0aGVcbi8vIG9wbG9nLiBDYWxscyBkb2NDYWxsYmFjayB3aXRoIGVhY2ggZG9jdW1lbnQgZm91bmQuIElnbm9yZXMgZXJyb3JzIGFuZCBqdXN0XG4vLyByZXN0YXJ0cyB0aGUgdGFpbCBvbiBlcnJvci5cbi8vXG4vLyBJZiB0aW1lb3V0TVMgaXMgc2V0LCB0aGVuIGlmIHdlIGRvbid0IGdldCBhIG5ldyBkb2N1bWVudCBldmVyeSB0aW1lb3V0TVMsXG4vLyBraWxsIGFuZCByZXN0YXJ0IHRoZSBjdXJzb3IuIFRoaXMgaXMgcHJpbWFyaWx5IGEgd29ya2Fyb3VuZCBmb3IgIzg1OTguXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLnRhaWwgPSBmdW5jdGlvbiAoY3Vyc29yRGVzY3JpcHRpb24sIGRvY0NhbGxiYWNrLCB0aW1lb3V0TVMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBpZiAoIWN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMudGFpbGFibGUpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuIG9ubHkgdGFpbCBhIHRhaWxhYmxlIGN1cnNvclwiKTtcblxuICB2YXIgY3Vyc29yID0gc2VsZi5fY3JlYXRlU3luY2hyb25vdXNDdXJzb3IoY3Vyc29yRGVzY3JpcHRpb24pO1xuXG4gIHZhciBzdG9wcGVkID0gZmFsc2U7XG4gIHZhciBsYXN0VFM7XG5cbiAgTWV0ZW9yLmRlZmVyKGFzeW5jIGZ1bmN0aW9uIGxvb3AoKSB7XG4gICAgdmFyIGRvYyA9IG51bGw7XG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChzdG9wcGVkKVxuICAgICAgICByZXR1cm47XG4gICAgICB0cnkge1xuICAgICAgICBkb2MgPSBhd2FpdCBjdXJzb3IuX25leHRPYmplY3RQcm9taXNlV2l0aFRpbWVvdXQodGltZW91dE1TKTtcbiAgICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgICAvLyBUaGVyZSdzIG5vIGdvb2Qgd2F5IHRvIGZpZ3VyZSBvdXQgaWYgdGhpcyB3YXMgYWN0dWFsbHkgYW4gZXJyb3IgZnJvbVxuICAgICAgICAvLyBNb25nbywgb3IganVzdCBjbGllbnQtc2lkZSAoaW5jbHVkaW5nIG91ciBvd24gdGltZW91dCBlcnJvcikuIEFoXG4gICAgICAgIC8vIHdlbGwuIEJ1dCBlaXRoZXIgd2F5LCB3ZSBuZWVkIHRvIHJldHJ5IHRoZSBjdXJzb3IgKHVubGVzcyB0aGUgZmFpbHVyZVxuICAgICAgICAvLyB3YXMgYmVjYXVzZSB0aGUgb2JzZXJ2ZSBnb3Qgc3RvcHBlZCkuXG4gICAgICAgIGRvYyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBTaW5jZSB3ZSBhd2FpdGVkIGEgcHJvbWlzZSBhYm92ZSwgd2UgbmVlZCB0byBjaGVjayBhZ2FpbiB0byBzZWUgaWZcbiAgICAgIC8vIHdlJ3ZlIGJlZW4gc3RvcHBlZCBiZWZvcmUgY2FsbGluZyB0aGUgY2FsbGJhY2suXG4gICAgICBpZiAoc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuICAgICAgaWYgKGRvYykge1xuICAgICAgICAvLyBJZiBhIHRhaWxhYmxlIGN1cnNvciBjb250YWlucyBhIFwidHNcIiBmaWVsZCwgdXNlIGl0IHRvIHJlY3JlYXRlIHRoZVxuICAgICAgICAvLyBjdXJzb3Igb24gZXJyb3IuIChcInRzXCIgaXMgYSBzdGFuZGFyZCB0aGF0IE1vbmdvIHVzZXMgaW50ZXJuYWxseSBmb3JcbiAgICAgICAgLy8gdGhlIG9wbG9nLCBhbmQgdGhlcmUncyBhIHNwZWNpYWwgZmxhZyB0aGF0IGxldHMgeW91IGRvIGJpbmFyeSBzZWFyY2hcbiAgICAgICAgLy8gb24gaXQgaW5zdGVhZCBvZiBuZWVkaW5nIHRvIHVzZSBhbiBpbmRleC4pXG4gICAgICAgIGxhc3RUUyA9IGRvYy50cztcbiAgICAgICAgZG9jQ2FsbGJhY2soZG9jKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhciBuZXdTZWxlY3RvciA9IF8uY2xvbmUoY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICAgICAgICBpZiAobGFzdFRTKSB7XG4gICAgICAgICAgbmV3U2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0VFN9O1xuICAgICAgICB9XG4gICAgICAgIGN1cnNvciA9IHNlbGYuX2NyZWF0ZVN5bmNocm9ub3VzQ3Vyc29yKG5ldyBDdXJzb3JEZXNjcmlwdGlvbihcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZSxcbiAgICAgICAgICBuZXdTZWxlY3RvcixcbiAgICAgICAgICBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKSk7XG4gICAgICAgIC8vIE1vbmdvIGZhaWxvdmVyIHRha2VzIG1hbnkgc2Vjb25kcy4gIFJldHJ5IGluIGEgYml0LiAgKFdpdGhvdXQgdGhpc1xuICAgICAgICAvLyBzZXRUaW1lb3V0LCB3ZSBwZWcgdGhlIENQVSBhdCAxMDAlIGFuZCBuZXZlciBub3RpY2UgdGhlIGFjdHVhbFxuICAgICAgICAvLyBmYWlsb3Zlci5cbiAgICAgICAgc2V0VGltZW91dChsb29wLCAxMDApO1xuICAgICAgICBicmVhaztcbiAgICAgIH1cbiAgICB9XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgc3RvcHBlZCA9IHRydWU7XG4gICAgICBjdXJzb3IuY2xvc2UoKTtcbiAgICB9XG4gIH07XG59O1xuXG5PYmplY3QuYXNzaWduKE1vbmdvQ29ubmVjdGlvbi5wcm90b3R5cGUsIHtcbiAgX29ic2VydmVDaGFuZ2VzOiBhc3luYyBmdW5jdGlvbiAoXG4gICAgICBjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcykge1xuICAgIHZhciBzZWxmID0gdGhpcztcblxuICAgIGlmIChjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnRhaWxhYmxlKSB7XG4gICAgICByZXR1cm4gc2VsZi5fb2JzZXJ2ZUNoYW5nZXNUYWlsYWJsZShjdXJzb3JEZXNjcmlwdGlvbiwgb3JkZXJlZCwgY2FsbGJhY2tzKTtcbiAgICB9XG5cbiAgICAvLyBZb3UgbWF5IG5vdCBmaWx0ZXIgb3V0IF9pZCB3aGVuIG9ic2VydmluZyBjaGFuZ2VzLCBiZWNhdXNlIHRoZSBpZCBpcyBhIGNvcmVcbiAgICAvLyBwYXJ0IG9mIHRoZSBvYnNlcnZlQ2hhbmdlcyBBUEkuXG4gICAgY29uc3QgZmllbGRzT3B0aW9ucyA9IGN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLmZpZWxkcztcbiAgICBpZiAoZmllbGRzT3B0aW9ucyAmJlxuICAgICAgICAoZmllbGRzT3B0aW9ucy5faWQgPT09IDAgfHxcbiAgICAgICAgICAgIGZpZWxkc09wdGlvbnMuX2lkID09PSBmYWxzZSkpIHtcbiAgICAgIHRocm93IEVycm9yKFwiWW91IG1heSBub3Qgb2JzZXJ2ZSBhIGN1cnNvciB3aXRoIHtmaWVsZHM6IHtfaWQ6IDB9fVwiKTtcbiAgICB9XG5cbiAgICB2YXIgb2JzZXJ2ZUtleSA9IEVKU09OLnN0cmluZ2lmeShcbiAgICAgICAgXy5leHRlbmQoe29yZGVyZWQ6IG9yZGVyZWR9LCBjdXJzb3JEZXNjcmlwdGlvbikpO1xuXG4gICAgdmFyIG11bHRpcGxleGVyLCBvYnNlcnZlRHJpdmVyO1xuICAgIHZhciBmaXJzdEhhbmRsZSA9IGZhbHNlO1xuXG4gICAgLy8gRmluZCBhIG1hdGNoaW5nIE9ic2VydmVNdWx0aXBsZXhlciwgb3IgY3JlYXRlIGEgbmV3IG9uZS4gVGhpcyBuZXh0IGJsb2NrIGlzXG4gICAgLy8gZ3VhcmFudGVlZCB0byBub3QgeWllbGQgKGFuZCBpdCBkb2Vzbid0IGNhbGwgYW55dGhpbmcgdGhhdCBjYW4gb2JzZXJ2ZSBhXG4gICAgLy8gbmV3IHF1ZXJ5KSwgc28gbm8gb3RoZXIgY2FsbHMgdG8gdGhpcyBmdW5jdGlvbiBjYW4gaW50ZXJsZWF2ZSB3aXRoIGl0LlxuICAgIGlmIChfLmhhcyhzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzLCBvYnNlcnZlS2V5KSkge1xuICAgICAgbXVsdGlwbGV4ZXIgPSBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldO1xuICAgIH0gZWxzZSB7XG4gICAgICBmaXJzdEhhbmRsZSA9IHRydWU7XG4gICAgICAvLyBDcmVhdGUgYSBuZXcgT2JzZXJ2ZU11bHRpcGxleGVyLlxuICAgICAgbXVsdGlwbGV4ZXIgPSBuZXcgT2JzZXJ2ZU11bHRpcGxleGVyKHtcbiAgICAgICAgb3JkZXJlZDogb3JkZXJlZCxcbiAgICAgICAgb25TdG9wOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgZGVsZXRlIHNlbGYuX29ic2VydmVNdWx0aXBsZXhlcnNbb2JzZXJ2ZUtleV07XG4gICAgICAgICAgcmV0dXJuIG9ic2VydmVEcml2ZXIuc3RvcCgpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgb2JzZXJ2ZUhhbmRsZSA9IG5ldyBPYnNlcnZlSGFuZGxlKG11bHRpcGxleGVyLFxuICAgICAgICBjYWxsYmFja3MsXG4gICAgICAgIG5vbk11dGF0aW5nQ2FsbGJhY2tzLFxuICAgICk7XG5cbiAgICBpZiAoZmlyc3RIYW5kbGUpIHtcbiAgICAgIHZhciBtYXRjaGVyLCBzb3J0ZXI7XG4gICAgICB2YXIgY2FuVXNlT3Bsb2cgPSBfLmFsbChbXG4gICAgICAgIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyBBdCBhIGJhcmUgbWluaW11bSwgdXNpbmcgdGhlIG9wbG9nIHJlcXVpcmVzIHVzIHRvIGhhdmUgYW4gb3Bsb2csIHRvXG4gICAgICAgICAgLy8gd2FudCB1bm9yZGVyZWQgY2FsbGJhY2tzLCBhbmQgdG8gbm90IHdhbnQgYSBjYWxsYmFjayBvbiB0aGUgcG9sbHNcbiAgICAgICAgICAvLyB0aGF0IHdvbid0IGhhcHBlbi5cbiAgICAgICAgICByZXR1cm4gc2VsZi5fb3Bsb2dIYW5kbGUgJiYgIW9yZGVyZWQgJiZcbiAgICAgICAgICAgICAgIWNhbGxiYWNrcy5fdGVzdE9ubHlQb2xsQ2FsbGJhY2s7XG4gICAgICAgIH0sIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAvLyBXZSBuZWVkIHRvIGJlIGFibGUgdG8gY29tcGlsZSB0aGUgc2VsZWN0b3IuIEZhbGwgYmFjayB0byBwb2xsaW5nIGZvclxuICAgICAgICAgIC8vIHNvbWUgbmV3ZmFuZ2xlZCAkc2VsZWN0b3IgdGhhdCBtaW5pbW9uZ28gZG9lc24ndCBzdXBwb3J0IHlldC5cbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgbWF0Y2hlciA9IG5ldyBNaW5pbW9uZ28uTWF0Y2hlcihjdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3Rvcik7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBYWFggbWFrZSBhbGwgY29tcGlsYXRpb24gZXJyb3JzIE1pbmltb25nb0Vycm9yIG9yIHNvbWV0aGluZ1xuICAgICAgICAgICAgLy8gICAgIHNvIHRoYXQgdGhpcyBkb2Vzbid0IGlnbm9yZSB1bnJlbGF0ZWQgZXhjZXB0aW9uc1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIC4uLiBhbmQgdGhlIHNlbGVjdG9yIGl0c2VsZiBuZWVkcyB0byBzdXBwb3J0IG9wbG9nLlxuICAgICAgICAgIHJldHVybiBPcGxvZ09ic2VydmVEcml2ZXIuY3Vyc29yU3VwcG9ydGVkKGN1cnNvckRlc2NyaXB0aW9uLCBtYXRjaGVyKTtcbiAgICAgICAgfSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgIC8vIEFuZCB3ZSBuZWVkIHRvIGJlIGFibGUgdG8gY29tcGlsZSB0aGUgc29ydCwgaWYgYW55LiAgZWcsIGNhbid0IGJlXG4gICAgICAgICAgLy8geyRuYXR1cmFsOiAxfS5cbiAgICAgICAgICBpZiAoIWN1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuc29ydClcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBzb3J0ZXIgPSBuZXcgTWluaW1vbmdvLlNvcnRlcihjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLnNvcnQpO1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgLy8gWFhYIG1ha2UgYWxsIGNvbXBpbGF0aW9uIGVycm9ycyBNaW5pbW9uZ29FcnJvciBvciBzb21ldGhpbmdcbiAgICAgICAgICAgIC8vICAgICBzbyB0aGF0IHRoaXMgZG9lc24ndCBpZ25vcmUgdW5yZWxhdGVkIGV4Y2VwdGlvbnNcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1dLCBmdW5jdGlvbiAoZikgeyByZXR1cm4gZigpOyB9KTsgIC8vIGludm9rZSBlYWNoIGZ1bmN0aW9uXG5cbiAgICAgIHZhciBkcml2ZXJDbGFzcyA9IGNhblVzZU9wbG9nID8gT3Bsb2dPYnNlcnZlRHJpdmVyIDogUG9sbGluZ09ic2VydmVEcml2ZXI7XG4gICAgICBvYnNlcnZlRHJpdmVyID0gbmV3IGRyaXZlckNsYXNzKHtcbiAgICAgICAgY3Vyc29yRGVzY3JpcHRpb246IGN1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgICBtb25nb0hhbmRsZTogc2VsZixcbiAgICAgICAgbXVsdGlwbGV4ZXI6IG11bHRpcGxleGVyLFxuICAgICAgICBvcmRlcmVkOiBvcmRlcmVkLFxuICAgICAgICBtYXRjaGVyOiBtYXRjaGVyLCAgLy8gaWdub3JlZCBieSBwb2xsaW5nXG4gICAgICAgIHNvcnRlcjogc29ydGVyLCAgLy8gaWdub3JlZCBieSBwb2xsaW5nXG4gICAgICAgIF90ZXN0T25seVBvbGxDYWxsYmFjazogY2FsbGJhY2tzLl90ZXN0T25seVBvbGxDYWxsYmFja1xuICAgICAgfSk7XG5cbiAgICAgIGlmIChvYnNlcnZlRHJpdmVyLl9pbml0KSB7XG4gICAgICAgIGF3YWl0IG9ic2VydmVEcml2ZXIuX2luaXQoKTtcbiAgICAgIH1cblxuICAgICAgLy8gVGhpcyBmaWVsZCBpcyBvbmx5IHNldCBmb3IgdXNlIGluIHRlc3RzLlxuICAgICAgbXVsdGlwbGV4ZXIuX29ic2VydmVEcml2ZXIgPSBvYnNlcnZlRHJpdmVyO1xuICAgIH1cbiAgICBzZWxmLl9vYnNlcnZlTXVsdGlwbGV4ZXJzW29ic2VydmVLZXldID0gbXVsdGlwbGV4ZXI7XG4gICAgLy8gQmxvY2tzIHVudGlsIHRoZSBpbml0aWFsIGFkZHMgaGF2ZSBiZWVuIHNlbnQuXG4gICAgYXdhaXQgbXVsdGlwbGV4ZXIuYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKG9ic2VydmVIYW5kbGUpO1xuXG4gICAgcmV0dXJuIG9ic2VydmVIYW5kbGU7XG4gIH0sXG5cbn0pO1xuXG5cbi8vIExpc3RlbiBmb3IgdGhlIGludmFsaWRhdGlvbiBtZXNzYWdlcyB0aGF0IHdpbGwgdHJpZ2dlciB1cyB0byBwb2xsIHRoZVxuLy8gZGF0YWJhc2UgZm9yIGNoYW5nZXMuIElmIHRoaXMgc2VsZWN0b3Igc3BlY2lmaWVzIHNwZWNpZmljIElEcywgc3BlY2lmeSB0aGVtXG4vLyBoZXJlLCBzbyB0aGF0IHVwZGF0ZXMgdG8gZGlmZmVyZW50IHNwZWNpZmljIElEcyBkb24ndCBjYXVzZSB1cyB0byBwb2xsLlxuLy8gbGlzdGVuQ2FsbGJhY2sgaXMgdGhlIHNhbWUga2luZCBvZiAobm90aWZpY2F0aW9uLCBjb21wbGV0ZSkgY2FsbGJhY2sgcGFzc2VkXG4vLyB0byBJbnZhbGlkYXRpb25Dcm9zc2Jhci5saXN0ZW4uXG5cbmxpc3RlbkFsbCA9IGZ1bmN0aW9uIChjdXJzb3JEZXNjcmlwdGlvbiwgbGlzdGVuQ2FsbGJhY2spIHtcbiAgdmFyIGxpc3RlbmVycyA9IFtdO1xuICBmb3JFYWNoVHJpZ2dlcihjdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICBsaXN0ZW5lcnMucHVzaChERFBTZXJ2ZXIuX0ludmFsaWRhdGlvbkNyb3NzYmFyLmxpc3RlbihcbiAgICAgIHRyaWdnZXIsIGxpc3RlbkNhbGxiYWNrKSk7XG4gIH0pO1xuXG4gIHJldHVybiB7XG4gICAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgICAgXy5lYWNoKGxpc3RlbmVycywgZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgICAgIGxpc3RlbmVyLnN0b3AoKTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcbn07XG5cbmZvckVhY2hUcmlnZ2VyID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCB0cmlnZ2VyQ2FsbGJhY2spIHtcbiAgdmFyIGtleSA9IHtjb2xsZWN0aW9uOiBjdXJzb3JEZXNjcmlwdGlvbi5jb2xsZWN0aW9uTmFtZX07XG4gIHZhciBzcGVjaWZpY0lkcyA9IExvY2FsQ29sbGVjdGlvbi5faWRzTWF0Y2hlZEJ5U2VsZWN0b3IoXG4gICAgY3Vyc29yRGVzY3JpcHRpb24uc2VsZWN0b3IpO1xuICBpZiAoc3BlY2lmaWNJZHMpIHtcbiAgICBfLmVhY2goc3BlY2lmaWNJZHMsIGZ1bmN0aW9uIChpZCkge1xuICAgICAgdHJpZ2dlckNhbGxiYWNrKF8uZXh0ZW5kKHtpZDogaWR9LCBrZXkpKTtcbiAgICB9KTtcbiAgICB0cmlnZ2VyQ2FsbGJhY2soXy5leHRlbmQoe2Ryb3BDb2xsZWN0aW9uOiB0cnVlLCBpZDogbnVsbH0sIGtleSkpO1xuICB9IGVsc2Uge1xuICAgIHRyaWdnZXJDYWxsYmFjayhrZXkpO1xuICB9XG4gIC8vIEV2ZXJ5b25lIGNhcmVzIGFib3V0IHRoZSBkYXRhYmFzZSBiZWluZyBkcm9wcGVkLlxuICB0cmlnZ2VyQ2FsbGJhY2soeyBkcm9wRGF0YWJhc2U6IHRydWUgfSk7XG59O1xuXG4vLyBvYnNlcnZlQ2hhbmdlcyBmb3IgdGFpbGFibGUgY3Vyc29ycyBvbiBjYXBwZWQgY29sbGVjdGlvbnMuXG4vL1xuLy8gU29tZSBkaWZmZXJlbmNlcyBmcm9tIG5vcm1hbCBjdXJzb3JzOlxuLy8gICAtIFdpbGwgbmV2ZXIgcHJvZHVjZSBhbnl0aGluZyBvdGhlciB0aGFuICdhZGRlZCcgb3IgJ2FkZGVkQmVmb3JlJy4gSWYgeW91XG4vLyAgICAgZG8gdXBkYXRlIGEgZG9jdW1lbnQgdGhhdCBoYXMgYWxyZWFkeSBiZWVuIHByb2R1Y2VkLCB0aGlzIHdpbGwgbm90IG5vdGljZVxuLy8gICAgIGl0LlxuLy8gICAtIElmIHlvdSBkaXNjb25uZWN0IGFuZCByZWNvbm5lY3QgZnJvbSBNb25nbywgaXQgd2lsbCBlc3NlbnRpYWxseSByZXN0YXJ0XG4vLyAgICAgdGhlIHF1ZXJ5LCB3aGljaCB3aWxsIGxlYWQgdG8gZHVwbGljYXRlIHJlc3VsdHMuIFRoaXMgaXMgcHJldHR5IGJhZCxcbi8vICAgICBidXQgaWYgeW91IGluY2x1ZGUgYSBmaWVsZCBjYWxsZWQgJ3RzJyB3aGljaCBpcyBpbnNlcnRlZCBhc1xuLy8gICAgIG5ldyBNb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCgwLCAwKSAod2hpY2ggaXMgaW5pdGlhbGl6ZWQgdG8gdGhlXG4vLyAgICAgY3VycmVudCBNb25nby1zdHlsZSB0aW1lc3RhbXApLCB3ZSdsbCBiZSBhYmxlIHRvIGZpbmQgdGhlIHBsYWNlIHRvXG4vLyAgICAgcmVzdGFydCBwcm9wZXJseS4gKFRoaXMgZmllbGQgaXMgc3BlY2lmaWNhbGx5IHVuZGVyc3Rvb2QgYnkgTW9uZ28gd2l0aCBhblxuLy8gICAgIG9wdGltaXphdGlvbiB3aGljaCBhbGxvd3MgaXQgdG8gZmluZCB0aGUgcmlnaHQgcGxhY2UgdG8gc3RhcnQgd2l0aG91dFxuLy8gICAgIGFuIGluZGV4IG9uIHRzLiBJdCdzIGhvdyB0aGUgb3Bsb2cgd29ya3MuKVxuLy8gICAtIE5vIGNhbGxiYWNrcyBhcmUgdHJpZ2dlcmVkIHN5bmNocm9ub3VzbHkgd2l0aCB0aGUgY2FsbCAodGhlcmUncyBub1xuLy8gICAgIGRpZmZlcmVudGlhdGlvbiBiZXR3ZWVuIFwiaW5pdGlhbCBkYXRhXCIgYW5kIFwibGF0ZXIgY2hhbmdlc1wiOyBldmVyeXRoaW5nXG4vLyAgICAgdGhhdCBtYXRjaGVzIHRoZSBxdWVyeSBnZXRzIHNlbnQgYXN5bmNocm9ub3VzbHkpLlxuLy8gICAtIERlLWR1cGxpY2F0aW9uIGlzIG5vdCBpbXBsZW1lbnRlZC5cbi8vICAgLSBEb2VzIG5vdCB5ZXQgaW50ZXJhY3Qgd2l0aCB0aGUgd3JpdGUgZmVuY2UuIFByb2JhYmx5LCB0aGlzIHNob3VsZCB3b3JrIGJ5XG4vLyAgICAgaWdub3JpbmcgcmVtb3ZlcyAod2hpY2ggZG9uJ3Qgd29yayBvbiBjYXBwZWQgY29sbGVjdGlvbnMpIGFuZCB1cGRhdGVzXG4vLyAgICAgKHdoaWNoIGRvbid0IGFmZmVjdCB0YWlsYWJsZSBjdXJzb3JzKSwgYW5kIGp1c3Qga2VlcGluZyB0cmFjayBvZiB0aGUgSURcbi8vICAgICBvZiB0aGUgaW5zZXJ0ZWQgb2JqZWN0LCBhbmQgY2xvc2luZyB0aGUgd3JpdGUgZmVuY2Ugb25jZSB5b3UgZ2V0IHRvIHRoYXRcbi8vICAgICBJRCAob3IgdGltZXN0YW1wPykuICBUaGlzIGRvZXNuJ3Qgd29yayB3ZWxsIGlmIHRoZSBkb2N1bWVudCBkb2Vzbid0IG1hdGNoXG4vLyAgICAgdGhlIHF1ZXJ5LCB0aG91Z2guICBPbiB0aGUgb3RoZXIgaGFuZCwgdGhlIHdyaXRlIGZlbmNlIGNhbiBjbG9zZVxuLy8gICAgIGltbWVkaWF0ZWx5IGlmIGl0IGRvZXMgbm90IG1hdGNoIHRoZSBxdWVyeS4gU28gaWYgd2UgdHJ1c3QgbWluaW1vbmdvXG4vLyAgICAgZW5vdWdoIHRvIGFjY3VyYXRlbHkgZXZhbHVhdGUgdGhlIHF1ZXJ5IGFnYWluc3QgdGhlIHdyaXRlIGZlbmNlLCB3ZVxuLy8gICAgIHNob3VsZCBiZSBhYmxlIHRvIGRvIHRoaXMuLi4gIE9mIGNvdXJzZSwgbWluaW1vbmdvIGRvZXNuJ3QgZXZlbiBzdXBwb3J0XG4vLyAgICAgTW9uZ28gVGltZXN0YW1wcyB5ZXQuXG5Nb25nb0Nvbm5lY3Rpb24ucHJvdG90eXBlLl9vYnNlcnZlQ2hhbmdlc1RhaWxhYmxlID0gZnVuY3Rpb24gKFxuICAgIGN1cnNvckRlc2NyaXB0aW9uLCBvcmRlcmVkLCBjYWxsYmFja3MpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIC8vIFRhaWxhYmxlIGN1cnNvcnMgb25seSBldmVyIGNhbGwgYWRkZWQvYWRkZWRCZWZvcmUgY2FsbGJhY2tzLCBzbyBpdCdzIGFuXG4gIC8vIGVycm9yIGlmIHlvdSBkaWRuJ3QgcHJvdmlkZSB0aGVtLlxuICBpZiAoKG9yZGVyZWQgJiYgIWNhbGxiYWNrcy5hZGRlZEJlZm9yZSkgfHxcbiAgICAgICghb3JkZXJlZCAmJiAhY2FsbGJhY2tzLmFkZGVkKSkge1xuICAgIHRocm93IG5ldyBFcnJvcihcIkNhbid0IG9ic2VydmUgYW4gXCIgKyAob3JkZXJlZCA/IFwib3JkZXJlZFwiIDogXCJ1bm9yZGVyZWRcIilcbiAgICAgICAgICAgICAgICAgICAgKyBcIiB0YWlsYWJsZSBjdXJzb3Igd2l0aG91dCBhIFwiXG4gICAgICAgICAgICAgICAgICAgICsgKG9yZGVyZWQgPyBcImFkZGVkQmVmb3JlXCIgOiBcImFkZGVkXCIpICsgXCIgY2FsbGJhY2tcIik7XG4gIH1cblxuICByZXR1cm4gc2VsZi50YWlsKGN1cnNvckRlc2NyaXB0aW9uLCBmdW5jdGlvbiAoZG9jKSB7XG4gICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICBkZWxldGUgZG9jLl9pZDtcbiAgICAvLyBUaGUgdHMgaXMgYW4gaW1wbGVtZW50YXRpb24gZGV0YWlsLiBIaWRlIGl0LlxuICAgIGRlbGV0ZSBkb2MudHM7XG4gICAgaWYgKG9yZGVyZWQpIHtcbiAgICAgIGNhbGxiYWNrcy5hZGRlZEJlZm9yZShpZCwgZG9jLCBudWxsKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY2FsbGJhY2tzLmFkZGVkKGlkLCBkb2MpO1xuICAgIH1cbiAgfSk7XG59O1xuXG4vLyBYWFggV2UgcHJvYmFibHkgbmVlZCB0byBmaW5kIGEgYmV0dGVyIHdheSB0byBleHBvc2UgdGhpcy4gUmlnaHQgbm93XG4vLyBpdCdzIG9ubHkgdXNlZCBieSB0ZXN0cywgYnV0IGluIGZhY3QgeW91IG5lZWQgaXQgaW4gbm9ybWFsXG4vLyBvcGVyYXRpb24gdG8gaW50ZXJhY3Qgd2l0aCBjYXBwZWQgY29sbGVjdGlvbnMuXG5Nb25nb0ludGVybmFscy5Nb25nb1RpbWVzdGFtcCA9IE1vbmdvREIuVGltZXN0YW1wO1xuXG5Nb25nb0ludGVybmFscy5Db25uZWN0aW9uID0gTW9uZ29Db25uZWN0aW9uO1xuIiwiaW1wb3J0IHsgTnBtTW9kdWxlTW9uZ29kYiB9IGZyb20gXCJtZXRlb3IvbnBtLW1vbmdvXCI7XG5jb25zdCB7IExvbmcgfSA9IE5wbU1vZHVsZU1vbmdvZGI7XG5cbk9QTE9HX0NPTExFQ1RJT04gPSAnb3Bsb2cucnMnO1xuXG52YXIgVE9PX0ZBUl9CRUhJTkQgPSBwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMDtcbnZhciBUQUlMX1RJTUVPVVQgPSArcHJvY2Vzcy5lbnYuTUVURU9SX09QTE9HX1RBSUxfVElNRU9VVCB8fCAzMDAwMDtcblxuaWRGb3JPcCA9IGZ1bmN0aW9uIChvcCkge1xuICBpZiAob3Aub3AgPT09ICdkJylcbiAgICByZXR1cm4gb3Auby5faWQ7XG4gIGVsc2UgaWYgKG9wLm9wID09PSAnaScpXG4gICAgcmV0dXJuIG9wLm8uX2lkO1xuICBlbHNlIGlmIChvcC5vcCA9PT0gJ3UnKVxuICAgIHJldHVybiBvcC5vMi5faWQ7XG4gIGVsc2UgaWYgKG9wLm9wID09PSAnYycpXG4gICAgdGhyb3cgRXJyb3IoXCJPcGVyYXRvciAnYycgZG9lc24ndCBzdXBwbHkgYW4gb2JqZWN0IHdpdGggaWQ6IFwiICtcbiAgICAgICAgICAgICAgICBFSlNPTi5zdHJpbmdpZnkob3ApKTtcbiAgZWxzZVxuICAgIHRocm93IEVycm9yKFwiVW5rbm93biBvcDogXCIgKyBFSlNPTi5zdHJpbmdpZnkob3ApKTtcbn07XG5cbk9wbG9nSGFuZGxlID0gZnVuY3Rpb24gKG9wbG9nVXJsLCBkYk5hbWUpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLl9vcGxvZ1VybCA9IG9wbG9nVXJsO1xuICBzZWxmLl9kYk5hbWUgPSBkYk5hbWU7XG5cbiAgc2VsZi5fb3Bsb2dMYXN0RW50cnlDb25uZWN0aW9uID0gbnVsbDtcbiAgc2VsZi5fb3Bsb2dUYWlsQ29ubmVjdGlvbiA9IG51bGw7XG4gIHNlbGYuX3N0b3BwZWQgPSBmYWxzZTtcbiAgc2VsZi5fdGFpbEhhbmRsZSA9IG51bGw7XG4gIHNlbGYuX3JlYWR5UHJvbWlzZVJlc29sdmVyID0gbnVsbDtcbiAgc2VsZi5fcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2UociA9PiBzZWxmLl9yZWFkeVByb21pc2VSZXNvbHZlciA9IHIpO1xuICBzZWxmLl9jcm9zc2JhciA9IG5ldyBERFBTZXJ2ZXIuX0Nyb3NzYmFyKHtcbiAgICBmYWN0UGFja2FnZTogXCJtb25nby1saXZlZGF0YVwiLCBmYWN0TmFtZTogXCJvcGxvZy13YXRjaGVyc1wiXG4gIH0pO1xuICBzZWxmLl9iYXNlT3Bsb2dTZWxlY3RvciA9IHtcbiAgICBuczogbmV3IFJlZ0V4cChcIl4oPzpcIiArIFtcbiAgICAgIE1ldGVvci5fZXNjYXBlUmVnRXhwKHNlbGYuX2RiTmFtZSArIFwiLlwiKSxcbiAgICAgIE1ldGVvci5fZXNjYXBlUmVnRXhwKFwiYWRtaW4uJGNtZFwiKSxcbiAgICBdLmpvaW4oXCJ8XCIpICsgXCIpXCIpLFxuXG4gICAgJG9yOiBbXG4gICAgICB7IG9wOiB7ICRpbjogWydpJywgJ3UnLCAnZCddIH0gfSxcbiAgICAgIC8vIGRyb3AgY29sbGVjdGlvblxuICAgICAgeyBvcDogJ2MnLCAnby5kcm9wJzogeyAkZXhpc3RzOiB0cnVlIH0gfSxcbiAgICAgIHsgb3A6ICdjJywgJ28uZHJvcERhdGFiYXNlJzogMSB9LFxuICAgICAgeyBvcDogJ2MnLCAnby5hcHBseU9wcyc6IHsgJGV4aXN0czogdHJ1ZSB9IH0sXG4gICAgXVxuICB9O1xuXG4gIC8vIERhdGEgc3RydWN0dXJlcyB0byBzdXBwb3J0IHdhaXRVbnRpbENhdWdodFVwKCkuIEVhY2ggb3Bsb2cgZW50cnkgaGFzIGFcbiAgLy8gTW9uZ29UaW1lc3RhbXAgb2JqZWN0IG9uIGl0ICh3aGljaCBpcyBub3QgdGhlIHNhbWUgYXMgYSBEYXRlIC0tLSBpdCdzIGFcbiAgLy8gY29tYmluYXRpb24gb2YgdGltZSBhbmQgYW4gaW5jcmVtZW50aW5nIGNvdW50ZXI7IHNlZVxuICAvLyBodHRwOi8vZG9jcy5tb25nb2RiLm9yZy9tYW51YWwvcmVmZXJlbmNlL2Jzb24tdHlwZXMvI3RpbWVzdGFtcHMpLlxuICAvL1xuICAvLyBfY2F0Y2hpbmdVcEZ1dHVyZXMgaXMgYW4gYXJyYXkgb2Yge3RzOiBNb25nb1RpbWVzdGFtcCwgZnV0dXJlOiBGdXR1cmV9XG4gIC8vIG9iamVjdHMsIHNvcnRlZCBieSBhc2NlbmRpbmcgdGltZXN0YW1wLiBfbGFzdFByb2Nlc3NlZFRTIGlzIHRoZVxuICAvLyBNb25nb1RpbWVzdGFtcCBvZiB0aGUgbGFzdCBvcGxvZyBlbnRyeSB3ZSd2ZSBwcm9jZXNzZWQuXG4gIC8vXG4gIC8vIEVhY2ggdGltZSB3ZSBjYWxsIHdhaXRVbnRpbENhdWdodFVwLCB3ZSB0YWtlIGEgcGVlayBhdCB0aGUgZmluYWwgb3Bsb2dcbiAgLy8gZW50cnkgaW4gdGhlIGRiLiAgSWYgd2UndmUgYWxyZWFkeSBwcm9jZXNzZWQgaXQgKGllLCBpdCBpcyBub3QgZ3JlYXRlciB0aGFuXG4gIC8vIF9sYXN0UHJvY2Vzc2VkVFMpLCB3YWl0VW50aWxDYXVnaHRVcCBpbW1lZGlhdGVseSByZXR1cm5zLiBPdGhlcndpc2UsXG4gIC8vIHdhaXRVbnRpbENhdWdodFVwIG1ha2VzIGEgbmV3IEZ1dHVyZSBhbmQgaW5zZXJ0cyBpdCBhbG9uZyB3aXRoIHRoZSBmaW5hbFxuICAvLyB0aW1lc3RhbXAgZW50cnkgdGhhdCBpdCByZWFkLCBpbnRvIF9jYXRjaGluZ1VwRnV0dXJlcy4gd2FpdFVudGlsQ2F1Z2h0VXBcbiAgLy8gdGhlbiB3YWl0cyBvbiB0aGF0IGZ1dHVyZSwgd2hpY2ggaXMgcmVzb2x2ZWQgb25jZSBfbGFzdFByb2Nlc3NlZFRTIGlzXG4gIC8vIGluY3JlbWVudGVkIHRvIGJlIHBhc3QgaXRzIHRpbWVzdGFtcCBieSB0aGUgd29ya2VyIGZpYmVyLlxuICAvL1xuICAvLyBYWFggdXNlIGEgcHJpb3JpdHkgcXVldWUgb3Igc29tZXRoaW5nIGVsc2UgdGhhdCdzIGZhc3RlciB0aGFuIGFuIGFycmF5XG4gIHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMgPSBbXTtcbiAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbnVsbDtcblxuICBzZWxmLl9vblNraXBwZWRFbnRyaWVzSG9vayA9IG5ldyBIb29rKHtcbiAgICBkZWJ1Z1ByaW50RXhjZXB0aW9uczogXCJvblNraXBwZWRFbnRyaWVzIGNhbGxiYWNrXCJcbiAgfSk7XG5cbiAgc2VsZi5fZW50cnlRdWV1ZSA9IG5ldyBNZXRlb3IuX0RvdWJsZUVuZGVkUXVldWUoKTtcbiAgc2VsZi5fd29ya2VyQWN0aXZlID0gZmFsc2U7XG5cbiAgY29uc3Qgc2hvdWxkQXdhaXQgPSBzZWxmLl9zdGFydFRhaWxpbmcoKTtcbiAgLy9UT0RPW2ZpYmVyc10gV2h5IHdhaXQ/XG59O1xuXG5PYmplY3QuYXNzaWduKE9wbG9nSGFuZGxlLnByb3RvdHlwZSwge1xuICBzdG9wOiBhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuICAgIHNlbGYuX3N0b3BwZWQgPSB0cnVlO1xuICAgIGlmIChzZWxmLl90YWlsSGFuZGxlKVxuICAgICAgYXdhaXQgc2VsZi5fdGFpbEhhbmRsZS5zdG9wKCk7XG4gICAgLy8gWFhYIHNob3VsZCBjbG9zZSBjb25uZWN0aW9ucyB0b29cbiAgfSxcbiAgX29uT3Bsb2dFbnRyeTogYXN5bmMgZnVuY3Rpb24odHJpZ2dlciwgY2FsbGJhY2spIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgb25PcGxvZ0VudHJ5IG9uIHN0b3BwZWQgaGFuZGxlIVwiKTtcblxuICAgIC8vIENhbGxpbmcgb25PcGxvZ0VudHJ5IHJlcXVpcmVzIHVzIHRvIHdhaXQgZm9yIHRoZSB0YWlsaW5nIHRvIGJlIHJlYWR5LlxuICAgIGF3YWl0IHNlbGYuX3JlYWR5UHJvbWlzZTtcblxuICAgIHZhciBvcmlnaW5hbENhbGxiYWNrID0gY2FsbGJhY2s7XG4gICAgY2FsbGJhY2sgPSBNZXRlb3IuYmluZEVudmlyb25tZW50KGZ1bmN0aW9uIChub3RpZmljYXRpb24pIHtcbiAgICAgIG9yaWdpbmFsQ2FsbGJhY2sobm90aWZpY2F0aW9uKTtcbiAgICB9LCBmdW5jdGlvbiAoZXJyKSB7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiRXJyb3IgaW4gb3Bsb2cgY2FsbGJhY2tcIiwgZXJyKTtcbiAgICB9KTtcbiAgICB2YXIgbGlzdGVuSGFuZGxlID0gc2VsZi5fY3Jvc3NiYXIubGlzdGVuKHRyaWdnZXIsIGNhbGxiYWNrKTtcbiAgICByZXR1cm4ge1xuICAgICAgc3RvcDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgICBhd2FpdCBsaXN0ZW5IYW5kbGUuc3RvcCgpO1xuICAgICAgfVxuICAgIH07XG4gIH0sXG4gIG9uT3Bsb2dFbnRyeTogZnVuY3Rpb24gKHRyaWdnZXIsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMuX29uT3Bsb2dFbnRyeSh0cmlnZ2VyLCBjYWxsYmFjayk7XG4gIH0sXG4gIC8vIFJlZ2lzdGVyIGEgY2FsbGJhY2sgdG8gYmUgaW52b2tlZCBhbnkgdGltZSB3ZSBza2lwIG9wbG9nIGVudHJpZXMgKGVnLFxuICAvLyBiZWNhdXNlIHdlIGFyZSB0b28gZmFyIGJlaGluZCkuXG4gIG9uU2tpcHBlZEVudHJpZXM6IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIkNhbGxlZCBvblNraXBwZWRFbnRyaWVzIG9uIHN0b3BwZWQgaGFuZGxlIVwiKTtcbiAgICByZXR1cm4gc2VsZi5fb25Ta2lwcGVkRW50cmllc0hvb2sucmVnaXN0ZXIoY2FsbGJhY2spO1xuICB9LFxuXG4gIGFzeW5jIF93YWl0VW50aWxDYXVnaHRVcCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJDYWxsZWQgd2FpdFVudGlsQ2F1Z2h0VXAgb24gc3RvcHBlZCBoYW5kbGUhXCIpO1xuXG4gICAgLy8gQ2FsbGluZyB3YWl0VW50aWxDYXVnaHRVcCByZXF1cmllcyB1cyB0byB3YWl0IGZvciB0aGUgb3Bsb2cgY29ubmVjdGlvbiB0b1xuICAgIC8vIGJlIHJlYWR5LlxuICAgIGF3YWl0IHNlbGYuX3JlYWR5UHJvbWlzZTtcbiAgICB2YXIgbGFzdEVudHJ5O1xuXG4gICAgd2hpbGUgKCFzZWxmLl9zdG9wcGVkKSB7XG4gICAgICAvLyBXZSBuZWVkIHRvIG1ha2UgdGhlIHNlbGVjdG9yIGF0IGxlYXN0IGFzIHJlc3RyaWN0aXZlIGFzIHRoZSBhY3R1YWxcbiAgICAgIC8vIHRhaWxpbmcgc2VsZWN0b3IgKGllLCB3ZSBuZWVkIHRvIHNwZWNpZnkgdGhlIERCIG5hbWUpIG9yIGVsc2Ugd2UgbWlnaHRcbiAgICAgIC8vIGZpbmQgYSBUUyB0aGF0IHdvbid0IHNob3cgdXAgaW4gdGhlIGFjdHVhbCB0YWlsIHN0cmVhbS5cbiAgICAgIHRyeSB7XG4gICAgICAgIGxhc3RFbnRyeSA9IGF3YWl0IHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbi5maW5kT25lQXN5bmMoXG4gICAgICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgICAgICBzZWxmLl9iYXNlT3Bsb2dTZWxlY3RvcixcbiAgICAgICAgICB7IHByb2plY3Rpb246IHsgdHM6IDEgfSwgc29ydDogeyAkbmF0dXJhbDogLTEgfSB9XG4gICAgICAgICk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAvLyBEdXJpbmcgZmFpbG92ZXIgKGVnKSBpZiB3ZSBnZXQgYW4gZXhjZXB0aW9uIHdlIHNob3VsZCBsb2cgYW5kIHJldHJ5XG4gICAgICAgIC8vIGluc3RlYWQgb2YgY3Jhc2hpbmcuXG4gICAgICAgIE1ldGVvci5fZGVidWcoXCJHb3QgZXhjZXB0aW9uIHdoaWxlIHJlYWRpbmcgbGFzdCBlbnRyeVwiLCBlKTtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoIWxhc3RFbnRyeSkge1xuICAgICAgLy8gUmVhbGx5LCBub3RoaW5nIGluIHRoZSBvcGxvZz8gV2VsbCwgd2UndmUgcHJvY2Vzc2VkIGV2ZXJ5dGhpbmcuXG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdmFyIHRzID0gbGFzdEVudHJ5LnRzO1xuICAgIGlmICghdHMpXG4gICAgICB0aHJvdyBFcnJvcihcIm9wbG9nIGVudHJ5IHdpdGhvdXQgdHM6IFwiICsgRUpTT04uc3RyaW5naWZ5KGxhc3RFbnRyeSkpO1xuXG4gICAgaWYgKHNlbGYuX2xhc3RQcm9jZXNzZWRUUyAmJiB0cy5sZXNzVGhhbk9yRXF1YWwoc2VsZi5fbGFzdFByb2Nlc3NlZFRTKSkge1xuICAgICAgLy8gV2UndmUgYWxyZWFkeSBjYXVnaHQgdXAgdG8gaGVyZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cblxuICAgIC8vIEluc2VydCB0aGUgZnV0dXJlIGludG8gb3VyIGxpc3QuIEFsbW9zdCBhbHdheXMsIHRoaXMgd2lsbCBiZSBhdCB0aGUgZW5kLFxuICAgIC8vIGJ1dCBpdCdzIGNvbmNlaXZhYmxlIHRoYXQgaWYgd2UgZmFpbCBvdmVyIGZyb20gb25lIHByaW1hcnkgdG8gYW5vdGhlcixcbiAgICAvLyB0aGUgb3Bsb2cgZW50cmllcyB3ZSBzZWUgd2lsbCBnbyBiYWNrd2FyZHMuXG4gICAgdmFyIGluc2VydEFmdGVyID0gc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVycy5sZW5ndGg7XG4gICAgd2hpbGUgKGluc2VydEFmdGVyIC0gMSA+IDAgJiYgc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVyc1tpbnNlcnRBZnRlciAtIDFdLnRzLmdyZWF0ZXJUaGFuKHRzKSkge1xuICAgICAgaW5zZXJ0QWZ0ZXItLTtcbiAgICB9XG4gICAgbGV0IHByb21pc2VSZXNvbHZlciA9IG51bGw7XG4gICAgY29uc3QgcHJvbWlzZVRvQXdhaXQgPSBuZXcgUHJvbWlzZShyID0+IHByb21pc2VSZXNvbHZlciA9IHIpO1xuICAgIHNlbGYuX2NhdGNoaW5nVXBSZXNvbHZlcnMuc3BsaWNlKGluc2VydEFmdGVyLCAwLCB7dHM6IHRzLCByZXNvbHZlcjogcHJvbWlzZVJlc29sdmVyfSk7XG4gICAgYXdhaXQgcHJvbWlzZVRvQXdhaXQ7XG4gIH0sXG5cbiAgLy8gQ2FsbHMgYGNhbGxiYWNrYCBvbmNlIHRoZSBvcGxvZyBoYXMgYmVlbiBwcm9jZXNzZWQgdXAgdG8gYSBwb2ludCB0aGF0IGlzXG4gIC8vIHJvdWdobHkgXCJub3dcIjogc3BlY2lmaWNhbGx5LCBvbmNlIHdlJ3ZlIHByb2Nlc3NlZCBhbGwgb3BzIHRoYXQgYXJlXG4gIC8vIGN1cnJlbnRseSB2aXNpYmxlLlxuICAvLyBYWFggYmVjb21lIGNvbnZpbmNlZCB0aGF0IHRoaXMgaXMgYWN0dWFsbHkgc2FmZSBldmVuIGlmIG9wbG9nQ29ubmVjdGlvblxuICAvLyBpcyBzb21lIGtpbmQgb2YgcG9vbFxuICB3YWl0VW50aWxDYXVnaHRVcDogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl93YWl0VW50aWxDYXVnaHRVcCgpO1xuICB9LFxuXG4gIF9zdGFydFRhaWxpbmc6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgLy8gRmlyc3QsIG1ha2Ugc3VyZSB0aGF0IHdlJ3JlIHRhbGtpbmcgdG8gdGhlIGxvY2FsIGRhdGFiYXNlLlxuICAgIHZhciBtb25nb2RiVXJpID0gTnBtLnJlcXVpcmUoJ21vbmdvZGItdXJpJyk7XG4gICAgaWYgKG1vbmdvZGJVcmkucGFyc2Uoc2VsZi5fb3Bsb2dVcmwpLmRhdGFiYXNlICE9PSAnbG9jYWwnKSB7XG4gICAgICB0aHJvdyBFcnJvcihcIiRNT05HT19PUExPR19VUkwgbXVzdCBiZSBzZXQgdG8gdGhlICdsb2NhbCcgZGF0YWJhc2Ugb2YgXCIgK1xuICAgICAgICAgIFwiYSBNb25nbyByZXBsaWNhIHNldFwiKTtcbiAgICB9XG5cbiAgICAvLyBXZSBtYWtlIHR3byBzZXBhcmF0ZSBjb25uZWN0aW9ucyB0byBNb25nby4gVGhlIE5vZGUgTW9uZ28gZHJpdmVyXG4gICAgLy8gaW1wbGVtZW50cyBhIG5haXZlIHJvdW5kLXJvYmluIGNvbm5lY3Rpb24gcG9vbDogZWFjaCBcImNvbm5lY3Rpb25cIiBpcyBhXG4gICAgLy8gcG9vbCBvZiBzZXZlcmFsICg1IGJ5IGRlZmF1bHQpIFRDUCBjb25uZWN0aW9ucywgYW5kIGVhY2ggcmVxdWVzdCBpc1xuICAgIC8vIHJvdGF0ZWQgdGhyb3VnaCB0aGUgcG9vbHMuIFRhaWxhYmxlIGN1cnNvciBxdWVyaWVzIGJsb2NrIG9uIHRoZSBzZXJ2ZXJcbiAgICAvLyB1bnRpbCB0aGVyZSBpcyBzb21lIGRhdGEgdG8gcmV0dXJuIChvciB1bnRpbCBhIGZldyBzZWNvbmRzIGhhdmVcbiAgICAvLyBwYXNzZWQpLiBTbyBpZiB0aGUgY29ubmVjdGlvbiBwb29sIHVzZWQgZm9yIHRhaWxpbmcgY3Vyc29ycyBpcyB0aGUgc2FtZVxuICAgIC8vIHBvb2wgdXNlZCBmb3Igb3RoZXIgcXVlcmllcywgdGhlIG90aGVyIHF1ZXJpZXMgd2lsbCBiZSBkZWxheWVkIGJ5IHNlY29uZHNcbiAgICAvLyAxLzUgb2YgdGhlIHRpbWUuXG4gICAgLy9cbiAgICAvLyBUaGUgdGFpbCBjb25uZWN0aW9uIHdpbGwgb25seSBldmVyIGJlIHJ1bm5pbmcgYSBzaW5nbGUgdGFpbCBjb21tYW5kLCBzb1xuICAgIC8vIGl0IG9ubHkgbmVlZHMgdG8gbWFrZSBvbmUgdW5kZXJseWluZyBUQ1AgY29ubmVjdGlvbi5cbiAgICBzZWxmLl9vcGxvZ1RhaWxDb25uZWN0aW9uID0gbmV3IE1vbmdvQ29ubmVjdGlvbihcbiAgICAgICAgc2VsZi5fb3Bsb2dVcmwsIHttYXhQb29sU2l6ZTogMX0pO1xuICAgIC8vIFhYWCBiZXR0ZXIgZG9jcywgYnV0OiBpdCdzIHRvIGdldCBtb25vdG9uaWMgcmVzdWx0c1xuICAgIC8vIFhYWCBpcyBpdCBzYWZlIHRvIHNheSBcImlmIHRoZXJlJ3MgYW4gaW4gZmxpZ2h0IHF1ZXJ5LCBqdXN0IHVzZSBpdHNcbiAgICAvLyAgICAgcmVzdWx0c1wiPyBJIGRvbid0IHRoaW5rIHNvIGJ1dCBzaG91bGQgY29uc2lkZXIgdGhhdFxuICAgIHNlbGYuX29wbG9nTGFzdEVudHJ5Q29ubmVjdGlvbiA9IG5ldyBNb25nb0Nvbm5lY3Rpb24oXG4gICAgICAgIHNlbGYuX29wbG9nVXJsLCB7bWF4UG9vbFNpemU6IDF9KTtcblxuXG4gICAgLy8gTm93LCBtYWtlIHN1cmUgdGhhdCB0aGVyZSBhY3R1YWxseSBpcyBhIHJlcGwgc2V0IGhlcmUuIElmIG5vdCwgb3Bsb2dcbiAgICAvLyB0YWlsaW5nIHdvbid0IGV2ZXIgZmluZCBhbnl0aGluZyFcbiAgICAvLyBNb3JlIG9uIHRoZSBpc01hc3RlckRvY1xuICAgIC8vIGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL2NvbW1hbmQvaXNNYXN0ZXIvXG4gICAgY29uc3QgaXNNYXN0ZXJEb2MgPSBhd2FpdCBuZXcgUHJvbWlzZShmdW5jdGlvbiAocmVzb2x2ZSwgcmVqZWN0KSB7XG4gICAgICBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZGJcbiAgICAgICAgLmFkbWluKClcbiAgICAgICAgLmNvbW1hbmQoeyBpc21hc3RlcjogMSB9LCBmdW5jdGlvbiAoZXJyLCByZXN1bHQpIHtcbiAgICAgICAgICBpZiAoZXJyKSByZWplY3QoZXJyKTtcbiAgICAgICAgICBlbHNlIHJlc29sdmUocmVzdWx0KTtcbiAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBpZiAoIShpc01hc3RlckRvYyAmJiBpc01hc3RlckRvYy5zZXROYW1lKSkge1xuICAgICAgdGhyb3cgRXJyb3IoXCIkTU9OR09fT1BMT0dfVVJMIG11c3QgYmUgc2V0IHRvIHRoZSAnbG9jYWwnIGRhdGFiYXNlIG9mIFwiICtcbiAgICAgICAgICBcImEgTW9uZ28gcmVwbGljYSBzZXRcIik7XG4gICAgfVxuXG4gICAgLy8gRmluZCB0aGUgbGFzdCBvcGxvZyBlbnRyeS5cbiAgICB2YXIgbGFzdE9wbG9nRW50cnkgPSBhd2FpdCBzZWxmLl9vcGxvZ0xhc3RFbnRyeUNvbm5lY3Rpb24uZmluZE9uZUFzeW5jKFxuICAgICAgT1BMT0dfQ09MTEVDVElPTixcbiAgICAgIHt9LFxuICAgICAgeyBzb3J0OiB7ICRuYXR1cmFsOiAtMSB9LCBwcm9qZWN0aW9uOiB7IHRzOiAxIH0gfVxuICAgICk7XG5cbiAgICB2YXIgb3Bsb2dTZWxlY3RvciA9IE9iamVjdC5hc3NpZ24oe30sIHNlbGYuX2Jhc2VPcGxvZ1NlbGVjdG9yKTtcbiAgICBpZiAobGFzdE9wbG9nRW50cnkpIHtcbiAgICAgIC8vIFN0YXJ0IGFmdGVyIHRoZSBsYXN0IGVudHJ5IHRoYXQgY3VycmVudGx5IGV4aXN0cy5cbiAgICAgIG9wbG9nU2VsZWN0b3IudHMgPSB7JGd0OiBsYXN0T3Bsb2dFbnRyeS50c307XG4gICAgICAvLyBJZiB0aGVyZSBhcmUgYW55IGNhbGxzIHRvIGNhbGxXaGVuUHJvY2Vzc2VkTGF0ZXN0IGJlZm9yZSBhbnkgb3RoZXJcbiAgICAgIC8vIG9wbG9nIGVudHJpZXMgc2hvdyB1cCwgYWxsb3cgY2FsbFdoZW5Qcm9jZXNzZWRMYXRlc3QgdG8gY2FsbCBpdHNcbiAgICAgIC8vIGNhbGxiYWNrIGltbWVkaWF0ZWx5LlxuICAgICAgc2VsZi5fbGFzdFByb2Nlc3NlZFRTID0gbGFzdE9wbG9nRW50cnkudHM7XG4gICAgfVxuXG4gICAgdmFyIGN1cnNvckRlc2NyaXB0aW9uID0gbmV3IEN1cnNvckRlc2NyaXB0aW9uKFxuICAgICAgICBPUExPR19DT0xMRUNUSU9OLCBvcGxvZ1NlbGVjdG9yLCB7dGFpbGFibGU6IHRydWV9KTtcblxuICAgIC8vIFN0YXJ0IHRhaWxpbmcgdGhlIG9wbG9nLlxuICAgIC8vXG4gICAgLy8gV2UgcmVzdGFydCB0aGUgbG93LWxldmVsIG9wbG9nIHF1ZXJ5IGV2ZXJ5IDMwIHNlY29uZHMgaWYgd2UgZGlkbid0IGdldCBhXG4gICAgLy8gZG9jLiBUaGlzIGlzIGEgd29ya2Fyb3VuZCBmb3IgIzg1OTg6IHRoZSBOb2RlIE1vbmdvIGRyaXZlciBoYXMgYXQgbGVhc3RcbiAgICAvLyBvbmUgYnVnIHRoYXQgY2FuIGxlYWQgdG8gcXVlcnkgY2FsbGJhY2tzIG5ldmVyIGdldHRpbmcgY2FsbGVkIChldmVuIHdpdGhcbiAgICAvLyBhbiBlcnJvcikgd2hlbiBsZWFkZXJzaGlwIGZhaWxvdmVyIG9jY3VyLlxuICAgIHNlbGYuX3RhaWxIYW5kbGUgPSBzZWxmLl9vcGxvZ1RhaWxDb25uZWN0aW9uLnRhaWwoXG4gICAgICAgIGN1cnNvckRlc2NyaXB0aW9uLFxuICAgICAgICBmdW5jdGlvbiAoZG9jKSB7XG4gICAgICAgICAgc2VsZi5fZW50cnlRdWV1ZS5wdXNoKGRvYyk7XG4gICAgICAgICAgc2VsZi5fbWF5YmVTdGFydFdvcmtlcigpO1xuICAgICAgICB9LFxuICAgICAgICBUQUlMX1RJTUVPVVRcbiAgICApO1xuXG4gICAgc2VsZi5fcmVhZHlQcm9taXNlUmVzb2x2ZXIoKTtcbiAgfSxcblxuICBfbWF5YmVTdGFydFdvcmtlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fd29ya2VyQWN0aXZlKSByZXR1cm47XG4gICAgc2VsZi5fd29ya2VyQWN0aXZlID0gdHJ1ZTtcblxuICAgIE1ldGVvci5kZWZlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBNYXkgYmUgY2FsbGVkIHJlY3Vyc2l2ZWx5IGluIGNhc2Ugb2YgdHJhbnNhY3Rpb25zLlxuICAgICAgYXN5bmMgZnVuY3Rpb24gaGFuZGxlRG9jKGRvYykge1xuICAgICAgICBpZiAoZG9jLm5zID09PSBcImFkbWluLiRjbWRcIikge1xuICAgICAgICAgIGlmIChkb2Muby5hcHBseU9wcykge1xuICAgICAgICAgICAgLy8gVGhpcyB3YXMgYSBzdWNjZXNzZnVsIHRyYW5zYWN0aW9uLCBzbyB3ZSBuZWVkIHRvIGFwcGx5IHRoZVxuICAgICAgICAgICAgLy8gb3BlcmF0aW9ucyB0aGF0IHdlcmUgaW52b2x2ZWQuXG4gICAgICAgICAgICBsZXQgbmV4dFRpbWVzdGFtcCA9IGRvYy50cztcbiAgICAgICAgICAgIGZvciAoY29uc3Qgb3Agb2YgZG9jLm8uYXBwbHlPcHMpIHtcbiAgICAgICAgICAgICAgLy8gU2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL2lzc3Vlcy8xMDQyMC5cbiAgICAgICAgICAgICAgaWYgKCFvcC50cykge1xuICAgICAgICAgICAgICAgIG9wLnRzID0gbmV4dFRpbWVzdGFtcDtcbiAgICAgICAgICAgICAgICBuZXh0VGltZXN0YW1wID0gbmV4dFRpbWVzdGFtcC5hZGQoTG9uZy5PTkUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGF3YWl0IGhhbmRsZURvYyhvcCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlVua25vd24gY29tbWFuZCBcIiArIEVKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHRyaWdnZXIgPSB7XG4gICAgICAgICAgZHJvcENvbGxlY3Rpb246IGZhbHNlLFxuICAgICAgICAgIGRyb3BEYXRhYmFzZTogZmFsc2UsXG4gICAgICAgICAgb3A6IGRvYyxcbiAgICAgICAgfTtcblxuICAgICAgICBpZiAodHlwZW9mIGRvYy5ucyA9PT0gXCJzdHJpbmdcIiAmJlxuICAgICAgICAgICAgZG9jLm5zLnN0YXJ0c1dpdGgoc2VsZi5fZGJOYW1lICsgXCIuXCIpKSB7XG4gICAgICAgICAgdHJpZ2dlci5jb2xsZWN0aW9uID0gZG9jLm5zLnNsaWNlKHNlbGYuX2RiTmFtZS5sZW5ndGggKyAxKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElzIGl0IGEgc3BlY2lhbCBjb21tYW5kIGFuZCB0aGUgY29sbGVjdGlvbiBuYW1lIGlzIGhpZGRlblxuICAgICAgICAvLyBzb21ld2hlcmUgaW4gb3BlcmF0b3I/XG4gICAgICAgIGlmICh0cmlnZ2VyLmNvbGxlY3Rpb24gPT09IFwiJGNtZFwiKSB7XG4gICAgICAgICAgaWYgKGRvYy5vLmRyb3BEYXRhYmFzZSkge1xuICAgICAgICAgICAgZGVsZXRlIHRyaWdnZXIuY29sbGVjdGlvbjtcbiAgICAgICAgICAgIHRyaWdnZXIuZHJvcERhdGFiYXNlID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYgKF8uaGFzKGRvYy5vLCBcImRyb3BcIikpIHtcbiAgICAgICAgICAgIHRyaWdnZXIuY29sbGVjdGlvbiA9IGRvYy5vLmRyb3A7XG4gICAgICAgICAgICB0cmlnZ2VyLmRyb3BDb2xsZWN0aW9uID0gdHJ1ZTtcbiAgICAgICAgICAgIHRyaWdnZXIuaWQgPSBudWxsO1xuICAgICAgICAgIH0gZWxzZSBpZiAoXCJjcmVhdGVcIiBpbiBkb2MubyAmJiBcImlkSW5kZXhcIiBpbiBkb2Mubykge1xuICAgICAgICAgICAgLy8gQSBjb2xsZWN0aW9uIGdvdCBpbXBsaWNpdGx5IGNyZWF0ZWQgd2l0aGluIGEgdHJhbnNhY3Rpb24uIFRoZXJlJ3NcbiAgICAgICAgICAgIC8vIG5vIG5lZWQgdG8gZG8gYW55dGhpbmcgYWJvdXQgaXQuXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRocm93IEVycm9yKFwiVW5rbm93biBjb21tYW5kIFwiICsgRUpTT04uc3RyaW5naWZ5KGRvYykpO1xuICAgICAgICAgIH1cblxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIC8vIEFsbCBvdGhlciBvcHMgaGF2ZSBhbiBpZC5cbiAgICAgICAgICB0cmlnZ2VyLmlkID0gaWRGb3JPcChkb2MpO1xuICAgICAgICB9XG5cbiAgICAgICAgYXdhaXQgc2VsZi5fY3Jvc3NiYXIuZmlyZSh0cmlnZ2VyKTtcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgd2hpbGUgKCEgc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgISBzZWxmLl9lbnRyeVF1ZXVlLmlzRW1wdHkoKSkge1xuICAgICAgICAgIC8vIEFyZSB3ZSB0b28gZmFyIGJlaGluZD8gSnVzdCB0ZWxsIG91ciBvYnNlcnZlcnMgdGhhdCB0aGV5IG5lZWQgdG9cbiAgICAgICAgICAvLyByZXBvbGwsIGFuZCBkcm9wIG91ciBxdWV1ZS5cbiAgICAgICAgICBpZiAoc2VsZi5fZW50cnlRdWV1ZS5sZW5ndGggPiBUT09fRkFSX0JFSElORCkge1xuICAgICAgICAgICAgdmFyIGxhc3RFbnRyeSA9IHNlbGYuX2VudHJ5UXVldWUucG9wKCk7XG4gICAgICAgICAgICBzZWxmLl9lbnRyeVF1ZXVlLmNsZWFyKCk7XG5cbiAgICAgICAgICAgIHNlbGYuX29uU2tpcHBlZEVudHJpZXNIb29rLmVhY2goZnVuY3Rpb24gKGNhbGxiYWNrKSB7XG4gICAgICAgICAgICAgIGNhbGxiYWNrKCk7XG4gICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgICAgIC8vIEZyZWUgYW55IHdhaXRVbnRpbENhdWdodFVwKCkgY2FsbHMgdGhhdCB3ZXJlIHdhaXRpbmcgZm9yIHVzIHRvXG4gICAgICAgICAgICAvLyBwYXNzIHNvbWV0aGluZyB0aGF0IHdlIGp1c3Qgc2tpcHBlZC5cbiAgICAgICAgICAgIHNlbGYuX3NldExhc3RQcm9jZXNzZWRUUyhsYXN0RW50cnkudHMpO1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgZG9jID0gc2VsZi5fZW50cnlRdWV1ZS5zaGlmdCgpO1xuXG4gICAgICAgICAgLy8gRmlyZSB0cmlnZ2VyKHMpIGZvciB0aGlzIGRvYy5cbiAgICAgICAgICBhd2FpdCBoYW5kbGVEb2MoZG9jKTtcblxuICAgICAgICAgIC8vIE5vdyB0aGF0IHdlJ3ZlIHByb2Nlc3NlZCB0aGlzIG9wZXJhdGlvbiwgcHJvY2VzcyBwZW5kaW5nXG4gICAgICAgICAgLy8gc2VxdWVuY2Vycy5cbiAgICAgICAgICBpZiAoZG9jLnRzKSB7XG4gICAgICAgICAgICBzZWxmLl9zZXRMYXN0UHJvY2Vzc2VkVFMoZG9jLnRzKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgRXJyb3IoXCJvcGxvZyBlbnRyeSB3aXRob3V0IHRzOiBcIiArIEVKU09OLnN0cmluZ2lmeShkb2MpKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZmluYWxseSB7XG4gICAgICAgIHNlbGYuX3dvcmtlckFjdGl2ZSA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIF9zZXRMYXN0UHJvY2Vzc2VkVFM6IGZ1bmN0aW9uICh0cykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9sYXN0UHJvY2Vzc2VkVFMgPSB0cztcbiAgICB3aGlsZSAoIV8uaXNFbXB0eShzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzKSAmJiBzZWxmLl9jYXRjaGluZ1VwUmVzb2x2ZXJzWzBdLnRzLmxlc3NUaGFuT3JFcXVhbChzZWxmLl9sYXN0UHJvY2Vzc2VkVFMpKSB7XG4gICAgICB2YXIgc2VxdWVuY2VyID0gc2VsZi5fY2F0Y2hpbmdVcFJlc29sdmVycy5zaGlmdCgpO1xuICAgICAgc2VxdWVuY2VyLnJlc29sdmVyKCk7XG4gICAgfVxuICB9LFxuXG4gIC8vTWV0aG9kcyB1c2VkIG9uIHRlc3RzIHRvIGRpbmFtaWNhbGx5IGNoYW5nZSBUT09fRkFSX0JFSElORFxuICBfZGVmaW5lVG9vRmFyQmVoaW5kOiBmdW5jdGlvbih2YWx1ZSkge1xuICAgIFRPT19GQVJfQkVISU5EID0gdmFsdWU7XG4gIH0sXG4gIF9yZXNldFRvb0ZhckJlaGluZDogZnVuY3Rpb24oKSB7XG4gICAgVE9PX0ZBUl9CRUhJTkQgPSBwcm9jZXNzLmVudi5NRVRFT1JfT1BMT0dfVE9PX0ZBUl9CRUhJTkQgfHwgMjAwMDtcbiAgfVxufSk7XG4iLCJsZXQgbmV4dE9ic2VydmVIYW5kbGVJZCA9IDE7XG5cbk9ic2VydmVNdWx0aXBsZXhlciA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IoeyBvcmRlcmVkLCBvblN0b3AgPSAoKSA9PiB7fSB9ID0ge30pIHtcbiAgICBpZiAob3JkZXJlZCA9PT0gdW5kZWZpbmVkKSB0aHJvdyBFcnJvcihcIm11c3Qgc3BlY2lmeSBvcmRlcmVkXCIpO1xuXG4gICAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwib2JzZXJ2ZS1tdWx0aXBsZXhlcnNcIiwgMSk7XG5cbiAgICB0aGlzLl9vcmRlcmVkID0gb3JkZXJlZDtcbiAgICB0aGlzLl9vblN0b3AgPSBvblN0b3A7XG4gICAgdGhpcy5fcXVldWUgPSBuZXcgTWV0ZW9yLl9Bc3luY2hyb25vdXNRdWV1ZSgpO1xuICAgIHRoaXMuX2hhbmRsZXMgPSB7fTtcbiAgICB0aGlzLl9yZXNvbHZlciA9IG51bGw7XG4gICAgdGhpcy5fcmVhZHlQcm9taXNlID0gbmV3IFByb21pc2UociA9PiB0aGlzLl9yZXNvbHZlciA9IHIpLnRoZW4oKCkgPT4gdGhpcy5faXNSZWFkeSA9IHRydWUpO1xuICAgIHRoaXMuX2NhY2hlID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fQ2FjaGluZ0NoYW5nZU9ic2VydmVyKHtcbiAgICAgIG9yZGVyZWR9KTtcbiAgICAvLyBOdW1iZXIgb2YgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIHRhc2tzIHNjaGVkdWxlZCBidXQgbm90IHlldFxuICAgIC8vIHJ1bm5pbmcuIHJlbW92ZUhhbmRsZSB1c2VzIHRoaXMgdG8ga25vdyBpZiBpdCdzIHRpbWUgdG8gY2FsbCB0aGUgb25TdG9wXG4gICAgLy8gY2FsbGJhY2suXG4gICAgdGhpcy5fYWRkSGFuZGxlVGFza3NTY2hlZHVsZWRCdXROb3RQZXJmb3JtZWQgPSAwO1xuXG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5jYWxsYmFja05hbWVzKCkuZm9yRWFjaChjYWxsYmFja05hbWUgPT4ge1xuICAgICAgdGhpc1tjYWxsYmFja05hbWVdID0gZnVuY3Rpb24oLyogLi4uICovKSB7XG4gICAgICAgIHNlbGYuX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBfLnRvQXJyYXkoYXJndW1lbnRzKSk7XG4gICAgICB9O1xuICAgIH0pO1xuICB9XG5cbiAgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzKGhhbmRsZSkge1xuICAgIHJldHVybiB0aGlzLl9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKTtcbiAgfVxuXG4gIGFzeW5jIF9hZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMoaGFuZGxlKSB7XG4gICAgKyt0aGlzLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAxKTtcblxuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGF3YWl0IHRoaXMuX3F1ZXVlLnJ1blRhc2soYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5faGFuZGxlc1toYW5kbGUuX2lkXSA9IGhhbmRsZTtcbiAgICAgIC8vIFNlbmQgb3V0IHdoYXRldmVyIGFkZHMgd2UgaGF2ZSBzbyBmYXIgKHdoZXRoZXIgdGhlXG4gICAgICAvLyBtdWx0aXBsZXhlciBpcyByZWFkeSkuXG4gICAgICBhd2FpdCBzZWxmLl9zZW5kQWRkcyhoYW5kbGUpO1xuICAgICAgLS1zZWxmLl9hZGRIYW5kbGVUYXNrc1NjaGVkdWxlZEJ1dE5vdFBlcmZvcm1lZDtcbiAgICB9KTtcbiAgICBhd2FpdCB0aGlzLl9yZWFkeVByb21pc2U7XG4gIH1cblxuICAvLyBSZW1vdmUgYW4gb2JzZXJ2ZSBoYW5kbGUuIElmIGl0IHdhcyB0aGUgbGFzdCBvYnNlcnZlIGhhbmRsZSwgY2FsbCB0aGVcbiAgLy8gb25TdG9wIGNhbGxiYWNrOyB5b3UgY2Fubm90IGFkZCBhbnkgbW9yZSBvYnNlcnZlIGhhbmRsZXMgYWZ0ZXIgdGhpcy5cbiAgLy9cbiAgLy8gVGhpcyBpcyBub3Qgc3luY2hyb25pemVkIHdpdGggcG9sbHMgYW5kIGhhbmRsZSBhZGRpdGlvbnM6IHRoaXMgbWVhbnMgdGhhdFxuICAvLyB5b3UgY2FuIHNhZmVseSBjYWxsIGl0IGZyb20gd2l0aGluIGFuIG9ic2VydmUgY2FsbGJhY2ssIGJ1dCBpdCBhbHNvIG1lYW5zXG4gIC8vIHRoYXQgd2UgaGF2ZSB0byBiZSBjYXJlZnVsIHdoZW4gd2UgaXRlcmF0ZSBvdmVyIF9oYW5kbGVzLlxuICBhc3luYyByZW1vdmVIYW5kbGUoaWQpIHtcbiAgICAvLyBUaGlzIHNob3VsZCBub3QgYmUgcG9zc2libGU6IHlvdSBjYW4gb25seSBjYWxsIHJlbW92ZUhhbmRsZSBieSBoYXZpbmdcbiAgICAvLyBhY2Nlc3MgdG8gdGhlIE9ic2VydmVIYW5kbGUsIHdoaWNoIGlzbid0IHJldHVybmVkIHRvIHVzZXIgY29kZSB1bnRpbCB0aGVcbiAgICAvLyBtdWx0aXBsZXggaXMgcmVhZHkuXG4gICAgaWYgKCF0aGlzLl9yZWFkeSgpKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3QgcmVtb3ZlIGhhbmRsZXMgdW50aWwgdGhlIG11bHRpcGxleCBpcyByZWFkeVwiKTtcblxuICAgIGRlbGV0ZSB0aGlzLl9oYW5kbGVzW2lkXTtcblxuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtaGFuZGxlc1wiLCAtMSk7XG5cbiAgICBpZiAoXy5pc0VtcHR5KHRoaXMuX2hhbmRsZXMpICYmXG4gICAgICAgIHRoaXMuX2FkZEhhbmRsZVRhc2tzU2NoZWR1bGVkQnV0Tm90UGVyZm9ybWVkID09PSAwKSB7XG4gICAgICBhd2FpdCB0aGlzLl9zdG9wKCk7XG4gICAgfVxuICB9XG4gIGFzeW5jIF9zdG9wKG9wdGlvbnMpIHtcbiAgICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAgIC8vIEl0IHNob3VsZG4ndCBiZSBwb3NzaWJsZSBmb3IgdXMgdG8gc3RvcCB3aGVuIGFsbCBvdXIgaGFuZGxlcyBzdGlsbFxuICAgIC8vIGhhdmVuJ3QgYmVlbiByZXR1cm5lZCBmcm9tIG9ic2VydmVDaGFuZ2VzIVxuICAgIGlmICghIHRoaXMuX3JlYWR5KCkgJiYgISBvcHRpb25zLmZyb21RdWVyeUVycm9yKVxuICAgICAgdGhyb3cgRXJyb3IoXCJzdXJwcmlzaW5nIF9zdG9wOiBub3QgcmVhZHlcIik7XG5cbiAgICAvLyBDYWxsIHN0b3AgY2FsbGJhY2sgKHdoaWNoIGtpbGxzIHRoZSB1bmRlcmx5aW5nIHByb2Nlc3Mgd2hpY2ggc2VuZHMgdXNcbiAgICAvLyBjYWxsYmFja3MgYW5kIHJlbW92ZXMgdXMgZnJvbSB0aGUgY29ubmVjdGlvbidzIGRpY3Rpb25hcnkpLlxuICAgIGF3YWl0IHRoaXMuX29uU3RvcCgpO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgXCJtb25nby1saXZlZGF0YVwiLCBcIm9ic2VydmUtbXVsdGlwbGV4ZXJzXCIsIC0xKTtcblxuICAgIC8vIENhdXNlIGZ1dHVyZSBhZGRIYW5kbGVBbmRTZW5kSW5pdGlhbEFkZHMgY2FsbHMgdG8gdGhyb3cgKGJ1dCB0aGUgb25TdG9wXG4gICAgLy8gY2FsbGJhY2sgc2hvdWxkIG1ha2Ugb3VyIGNvbm5lY3Rpb24gZm9yZ2V0IGFib3V0IHVzKS5cbiAgICB0aGlzLl9oYW5kbGVzID0gbnVsbDtcbiAgfVxuXG4gIC8vIEFsbG93cyBhbGwgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIHRvIHJldHVybiwgb25jZSBhbGwgcHJlY2VkaW5nXG4gIC8vIGFkZHMgaGF2ZSBiZWVuIHByb2Nlc3NlZC4gRG9lcyBub3QgYmxvY2suXG4gIGFzeW5jIHJlYWR5KCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIHRoaXMuX3F1ZXVlLnF1ZXVlVGFzayhmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJjYW4ndCBtYWtlIE9ic2VydmVNdWx0aXBsZXggcmVhZHkgdHdpY2UhXCIpO1xuXG4gICAgICBpZiAoIXNlbGYuX3Jlc29sdmVyKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcIk1pc3NpbmcgcmVzb2x2ZXJcIik7XG4gICAgICB9XG5cbiAgICAgIHNlbGYuX3Jlc29sdmVyKCk7XG4gICAgICBzZWxmLl9pc1JlYWR5ID0gdHJ1ZTtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIElmIHRyeWluZyB0byBleGVjdXRlIHRoZSBxdWVyeSByZXN1bHRzIGluIGFuIGVycm9yLCBjYWxsIHRoaXMuIFRoaXMgaXNcbiAgLy8gaW50ZW5kZWQgZm9yIHBlcm1hbmVudCBlcnJvcnMsIG5vdCB0cmFuc2llbnQgbmV0d29yayBlcnJvcnMgdGhhdCBjb3VsZCBiZVxuICAvLyBmaXhlZC4gSXQgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIGJlZm9yZSByZWFkeSgpLCBiZWNhdXNlIGlmIHlvdSBjYWxsZWQgcmVhZHlcbiAgLy8gdGhhdCBtZWFudCB0aGF0IHlvdSBtYW5hZ2VkIHRvIHJ1biB0aGUgcXVlcnkgb25jZS4gSXQgd2lsbCBzdG9wIHRoaXNcbiAgLy8gT2JzZXJ2ZU11bHRpcGxleCBhbmQgY2F1c2UgYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzIGNhbGxzIChhbmQgdGh1c1xuICAvLyBvYnNlcnZlQ2hhbmdlcyBjYWxscykgdG8gdGhyb3cgdGhlIGVycm9yLlxuICBhc3luYyBxdWVyeUVycm9yKGVycikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBhd2FpdCB0aGlzLl9xdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl9yZWFkeSgpKVxuICAgICAgICB0aHJvdyBFcnJvcihcImNhbid0IGNsYWltIHF1ZXJ5IGhhcyBhbiBlcnJvciBhZnRlciBpdCB3b3JrZWQhXCIpO1xuICAgICAgc2VsZi5fc3RvcCh7ZnJvbVF1ZXJ5RXJyb3I6IHRydWV9KTtcbiAgICAgIHRocm93IGVycjtcbiAgICB9KTtcbiAgfVxuXG4gIC8vIENhbGxzIFwiY2JcIiBvbmNlIHRoZSBlZmZlY3RzIG9mIGFsbCBcInJlYWR5XCIsIFwiYWRkSGFuZGxlQW5kU2VuZEluaXRpYWxBZGRzXCJcbiAgLy8gYW5kIG9ic2VydmUgY2FsbGJhY2tzIHdoaWNoIGNhbWUgYmVmb3JlIHRoaXMgY2FsbCBoYXZlIGJlZW4gcHJvcGFnYXRlZCB0b1xuICAvLyBhbGwgaGFuZGxlcy4gXCJyZWFkeVwiIG11c3QgaGF2ZSBhbHJlYWR5IGJlZW4gY2FsbGVkIG9uIHRoaXMgbXVsdGlwbGV4ZXIuXG4gIGFzeW5jIG9uRmx1c2goY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgYXdhaXQgdGhpcy5fcXVldWUucXVldWVUYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmICghc2VsZi5fcmVhZHkoKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJvbmx5IGNhbGwgb25GbHVzaCBvbiBhIG11bHRpcGxleGVyIHRoYXQgd2lsbCBiZSByZWFkeVwiKTtcbiAgICAgIGF3YWl0IGNiKCk7XG4gICAgfSk7XG4gIH1cbiAgY2FsbGJhY2tOYW1lcygpIHtcbiAgICBpZiAodGhpcy5fb3JkZXJlZClcbiAgICAgIHJldHVybiBbXCJhZGRlZEJlZm9yZVwiLCBcImNoYW5nZWRcIiwgXCJtb3ZlZEJlZm9yZVwiLCBcInJlbW92ZWRcIl07XG4gICAgZWxzZVxuICAgICAgcmV0dXJuIFtcImFkZGVkXCIsIFwiY2hhbmdlZFwiLCBcInJlbW92ZWRcIl07XG4gIH1cbiAgX3JlYWR5KCkge1xuICAgIHJldHVybiAhIXRoaXMuX2lzUmVhZHk7XG4gIH1cbiAgX2FwcGx5Q2FsbGJhY2soY2FsbGJhY2tOYW1lLCBhcmdzKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5fcXVldWUucXVldWVUYXNrKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIElmIHdlIHN0b3BwZWQgaW4gdGhlIG1lYW50aW1lLCBkbyBub3RoaW5nLlxuICAgICAgaWYgKCFzZWxmLl9oYW5kbGVzKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIC8vIEZpcnN0LCBhcHBseSB0aGUgY2hhbmdlIHRvIHRoZSBjYWNoZS5cbiAgICAgIGF3YWl0IHNlbGYuX2NhY2hlLmFwcGx5Q2hhbmdlW2NhbGxiYWNrTmFtZV0uYXBwbHkobnVsbCwgYXJncyk7XG4gICAgICAvLyBJZiB3ZSBoYXZlbid0IGZpbmlzaGVkIHRoZSBpbml0aWFsIGFkZHMsIHRoZW4gd2Ugc2hvdWxkIG9ubHkgYmUgZ2V0dGluZ1xuICAgICAgLy8gYWRkcy5cbiAgICAgIGlmICghc2VsZi5fcmVhZHkoKSAmJlxuICAgICAgICAgIChjYWxsYmFja05hbWUgIT09ICdhZGRlZCcgJiYgY2FsbGJhY2tOYW1lICE9PSAnYWRkZWRCZWZvcmUnKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJHb3QgXCIgKyBjYWxsYmFja05hbWUgKyBcIiBkdXJpbmcgaW5pdGlhbCBhZGRzXCIpO1xuICAgICAgfVxuXG4gICAgICAvLyBOb3cgbXVsdGlwbGV4IHRoZSBjYWxsYmFja3Mgb3V0IHRvIGFsbCBvYnNlcnZlIGhhbmRsZXMuIEl0J3MgT0sgaWZcbiAgICAgIC8vIHRoZXNlIGNhbGxzIHlpZWxkOyBzaW5jZSB3ZSdyZSBpbnNpZGUgYSB0YXNrLCBubyBvdGhlciB1c2Ugb2Ygb3VyIHF1ZXVlXG4gICAgICAvLyBjYW4gY29udGludWUgdW50aWwgdGhlc2UgYXJlIGRvbmUuIChCdXQgd2UgZG8gaGF2ZSB0byBiZSBjYXJlZnVsIHRvIG5vdFxuICAgICAgLy8gdXNlIGEgaGFuZGxlIHRoYXQgZ290IHJlbW92ZWQsIGJlY2F1c2UgcmVtb3ZlSGFuZGxlIGRvZXMgbm90IHVzZSB0aGVcbiAgICAgIC8vIHF1ZXVlOyB0aHVzLCB3ZSBpdGVyYXRlIG92ZXIgYW4gYXJyYXkgb2Yga2V5cyB0aGF0IHdlIGNvbnRyb2wuKVxuICAgICAgZm9yIChjb25zdCBoYW5kbGVJZCBvZiBPYmplY3Qua2V5cyhzZWxmLl9oYW5kbGVzKSkge1xuICAgICAgICB2YXIgaGFuZGxlID0gc2VsZi5faGFuZGxlcyAmJiBzZWxmLl9oYW5kbGVzW2hhbmRsZUlkXTtcbiAgICAgICAgaWYgKCFoYW5kbGUpIHJldHVybjtcbiAgICAgICAgdmFyIGNhbGxiYWNrID0gaGFuZGxlWydfJyArIGNhbGxiYWNrTmFtZV07XG4gICAgICAgIC8vIGNsb25lIGFyZ3VtZW50cyBzbyB0aGF0IGNhbGxiYWNrcyBjYW4gbXV0YXRlIHRoZWlyIGFyZ3VtZW50c1xuXG4gICAgICAgIGNhbGxiYWNrICYmXG4gICAgICAgICAgKGF3YWl0IGNhbGxiYWNrLmFwcGx5KFxuICAgICAgICAgICAgbnVsbCxcbiAgICAgICAgICAgIGhhbmRsZS5ub25NdXRhdGluZ0NhbGxiYWNrcyA/IGFyZ3MgOiBFSlNPTi5jbG9uZShhcmdzKVxuICAgICAgICAgICkpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gU2VuZHMgaW5pdGlhbCBhZGRzIHRvIGEgaGFuZGxlLiBJdCBzaG91bGQgb25seSBiZSBjYWxsZWQgZnJvbSB3aXRoaW4gYSB0YXNrXG4gIC8vICh0aGUgdGFzayB0aGF0IGlzIHByb2Nlc3NpbmcgdGhlIGFkZEhhbmRsZUFuZFNlbmRJbml0aWFsQWRkcyBjYWxsKS4gSXRcbiAgLy8gc3luY2hyb25vdXNseSBpbnZva2VzIHRoZSBoYW5kbGUncyBhZGRlZCBvciBhZGRlZEJlZm9yZTsgdGhlcmUncyBubyBuZWVkIHRvXG4gIC8vIGZsdXNoIHRoZSBxdWV1ZSBhZnRlcndhcmRzIHRvIGVuc3VyZSB0aGF0IHRoZSBjYWxsYmFja3MgZ2V0IG91dC5cbiAgYXN5bmMgX3NlbmRBZGRzKGhhbmRsZSkge1xuICAgIHZhciBhZGQgPSB0aGlzLl9vcmRlcmVkID8gaGFuZGxlLl9hZGRlZEJlZm9yZSA6IGhhbmRsZS5fYWRkZWQ7XG4gICAgaWYgKCFhZGQpXG4gICAgICByZXR1cm47XG4gICAgLy8gbm90ZTogZG9jcyBtYXkgYmUgYW4gX0lkTWFwIG9yIGFuIE9yZGVyZWREaWN0XG4gICAgYXdhaXQgdGhpcy5fY2FjaGUuZG9jcy5mb3JFYWNoQXN5bmMoYXN5bmMgKGRvYywgaWQpID0+IHtcbiAgICAgIGlmICghXy5oYXModGhpcy5faGFuZGxlcywgaGFuZGxlLl9pZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwiaGFuZGxlIGdvdCByZW1vdmVkIGJlZm9yZSBzZW5kaW5nIGluaXRpYWwgYWRkcyFcIik7XG4gICAgICBjb25zdCB7IF9pZCwgLi4uZmllbGRzIH0gPSBoYW5kbGUubm9uTXV0YXRpbmdDYWxsYmFja3MgPyBkb2NcbiAgICAgICAgICA6IEVKU09OLmNsb25lKGRvYyk7XG4gICAgICBpZiAodGhpcy5fb3JkZXJlZClcbiAgICAgICAgYXdhaXQgYWRkKGlkLCBmaWVsZHMsIG51bGwpOyAvLyB3ZSdyZSBnb2luZyBpbiBvcmRlciwgc28gYWRkIGF0IGVuZFxuICAgICAgZWxzZVxuICAgICAgICBhd2FpdCBhZGQoaWQsIGZpZWxkcyk7XG4gICAgfSk7XG4gIH1cbn07XG5cbi8vIFdoZW4gdGhlIGNhbGxiYWNrcyBkbyBub3QgbXV0YXRlIHRoZSBhcmd1bWVudHMsIHdlIGNhbiBza2lwIGEgbG90IG9mIGRhdGEgY2xvbmVzXG5PYnNlcnZlSGFuZGxlID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtdWx0aXBsZXhlciwgY2FsbGJhY2tzLCBub25NdXRhdGluZ0NhbGxiYWNrcyA9IGZhbHNlKSB7XG4gICAgdGhpcy5fbXVsdGlwbGV4ZXIgPSBtdWx0aXBsZXhlcjtcbiAgICBtdWx0aXBsZXhlci5jYWxsYmFja05hbWVzKCkuZm9yRWFjaCgobmFtZSkgPT4ge1xuICAgICAgaWYgKGNhbGxiYWNrc1tuYW1lXSkge1xuICAgICAgICB0aGlzWydfJyArIG5hbWVdID0gY2FsbGJhY2tzW25hbWVdO1xuICAgICAgfSBlbHNlIGlmIChuYW1lID09PSBcImFkZGVkQmVmb3JlXCIgJiYgY2FsbGJhY2tzLmFkZGVkKSB7XG4gICAgICAgIC8vIFNwZWNpYWwgY2FzZTogaWYgeW91IHNwZWNpZnkgXCJhZGRlZFwiIGFuZCBcIm1vdmVkQmVmb3JlXCIsIHlvdSBnZXQgYW5cbiAgICAgICAgLy8gb3JkZXJlZCBvYnNlcnZlIHdoZXJlIGZvciBzb21lIHJlYXNvbiB5b3UgZG9uJ3QgZ2V0IG9yZGVyaW5nIGRhdGEgb25cbiAgICAgICAgLy8gdGhlIGFkZHMuICBJIGR1bm5vLCB3ZSB3cm90ZSB0ZXN0cyBmb3IgaXQsIHRoZXJlIG11c3QgaGF2ZSBiZWVuIGFcbiAgICAgICAgLy8gcmVhc29uLlxuICAgICAgICB0aGlzLl9hZGRlZEJlZm9yZSA9IGFzeW5jIGZ1bmN0aW9uIChpZCwgZmllbGRzLCBiZWZvcmUpIHtcbiAgICAgICAgICBhd2FpdCBjYWxsYmFja3MuYWRkZWQoaWQsIGZpZWxkcyk7XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfSk7XG4gICAgdGhpcy5fc3RvcHBlZCA9IGZhbHNlO1xuICAgIHRoaXMuX2lkID0gbmV4dE9ic2VydmVIYW5kbGVJZCsrO1xuICAgIHRoaXMubm9uTXV0YXRpbmdDYWxsYmFja3MgPSBub25NdXRhdGluZ0NhbGxiYWNrcztcbiAgfVxuXG4gIGFzeW5jIHN0b3AoKSB7XG4gICAgaWYgKHRoaXMuX3N0b3BwZWQpIHJldHVybjtcbiAgICB0aGlzLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBhd2FpdCB0aGlzLl9tdWx0aXBsZXhlci5yZW1vdmVIYW5kbGUodGhpcy5faWQpO1xuICB9XG59O1xuIiwiZXhwb3J0IGNsYXNzIERvY0ZldGNoZXIge1xuICBjb25zdHJ1Y3Rvcihtb25nb0Nvbm5lY3Rpb24pIHtcbiAgICB0aGlzLl9tb25nb0Nvbm5lY3Rpb24gPSBtb25nb0Nvbm5lY3Rpb247XG4gICAgLy8gTWFwIGZyb20gb3AgLT4gW2NhbGxiYWNrXVxuICAgIHRoaXMuX2NhbGxiYWNrc0Zvck9wID0gbmV3IE1hcCgpO1xuICB9XG5cbiAgLy8gRmV0Y2hlcyBkb2N1bWVudCBcImlkXCIgZnJvbSBjb2xsZWN0aW9uTmFtZSwgcmV0dXJuaW5nIGl0IG9yIG51bGwgaWYgbm90XG4gIC8vIGZvdW5kLlxuICAvL1xuICAvLyBJZiB5b3UgbWFrZSBtdWx0aXBsZSBjYWxscyB0byBmZXRjaCgpIHdpdGggdGhlIHNhbWUgb3AgcmVmZXJlbmNlLFxuICAvLyBEb2NGZXRjaGVyIG1heSBhc3N1bWUgdGhhdCB0aGV5IGFsbCByZXR1cm4gdGhlIHNhbWUgZG9jdW1lbnQuIChJdCBkb2VzXG4gIC8vIG5vdCBjaGVjayB0byBzZWUgaWYgY29sbGVjdGlvbk5hbWUvaWQgbWF0Y2guKVxuICAvL1xuICAvLyBZb3UgbWF5IGFzc3VtZSB0aGF0IGNhbGxiYWNrIGlzIG5ldmVyIGNhbGxlZCBzeW5jaHJvbm91c2x5IChhbmQgaW4gZmFjdFxuICAvLyBPcGxvZ09ic2VydmVEcml2ZXIgZG9lcyBzbykuXG4gIGFzeW5jIGZldGNoKGNvbGxlY3Rpb25OYW1lLCBpZCwgb3AsIGNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc2VsZiA9IHRoaXM7XG5cbiAgICBcbiAgICBjaGVjayhjb2xsZWN0aW9uTmFtZSwgU3RyaW5nKTtcbiAgICBjaGVjayhvcCwgT2JqZWN0KTtcblxuXG4gICAgLy8gSWYgdGhlcmUncyBhbHJlYWR5IGFuIGluLXByb2dyZXNzIGZldGNoIGZvciB0aGlzIGNhY2hlIGtleSwgeWllbGQgdW50aWxcbiAgICAvLyBpdCdzIGRvbmUgYW5kIHJldHVybiB3aGF0ZXZlciBpdCByZXR1cm5zLlxuICAgIGlmIChzZWxmLl9jYWxsYmFja3NGb3JPcC5oYXMob3ApKSB7XG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5nZXQob3ApLnB1c2goY2FsbGJhY2spO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGNhbGxiYWNrcyA9IFtjYWxsYmFja107XG4gICAgc2VsZi5fY2FsbGJhY2tzRm9yT3Auc2V0KG9wLCBjYWxsYmFja3MpO1xuXG4gICAgdHJ5IHtcbiAgICAgIHZhciBkb2MgPVxuICAgICAgICAoYXdhaXQgc2VsZi5fbW9uZ29Db25uZWN0aW9uLmZpbmRPbmVBc3luYyhjb2xsZWN0aW9uTmFtZSwge1xuICAgICAgICAgIF9pZDogaWQsXG4gICAgICAgIH0pKSB8fCBudWxsO1xuICAgICAgLy8gUmV0dXJuIGRvYyB0byBhbGwgcmVsZXZhbnQgY2FsbGJhY2tzLiBOb3RlIHRoYXQgdGhpcyBhcnJheSBjYW5cbiAgICAgIC8vIGNvbnRpbnVlIHRvIGdyb3cgZHVyaW5nIGNhbGxiYWNrIGV4Y2VjdXRpb24uXG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgLy8gQ2xvbmUgdGhlIGRvY3VtZW50IHNvIHRoYXQgdGhlIHZhcmlvdXMgY2FsbHMgdG8gZmV0Y2ggZG9uJ3QgcmV0dXJuXG4gICAgICAgIC8vIG9iamVjdHMgdGhhdCBhcmUgaW50ZXJ0d2luZ2xlZCB3aXRoIGVhY2ggb3RoZXIuIENsb25lIGJlZm9yZVxuICAgICAgICAvLyBwb3BwaW5nIHRoZSBmdXR1cmUsIHNvIHRoYXQgaWYgY2xvbmUgdGhyb3dzLCB0aGUgZXJyb3IgZ2V0cyBwYXNzZWRcbiAgICAgICAgLy8gdG8gdGhlIG5leHQgY2FsbGJhY2suXG4gICAgICAgIGNhbGxiYWNrcy5wb3AoKShudWxsLCBFSlNPTi5jbG9uZShkb2MpKTtcbiAgICAgIH1cbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICB3aGlsZSAoY2FsbGJhY2tzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgY2FsbGJhY2tzLnBvcCgpKGUpO1xuICAgICAgfVxuICAgIH0gZmluYWxseSB7XG4gICAgICAvLyBYWFggY29uc2lkZXIga2VlcGluZyB0aGUgZG9jIGFyb3VuZCBmb3IgYSBwZXJpb2Qgb2YgdGltZSBiZWZvcmVcbiAgICAgIC8vIHJlbW92aW5nIGZyb20gdGhlIGNhY2hlXG4gICAgICBzZWxmLl9jYWxsYmFja3NGb3JPcC5kZWxldGUob3ApO1xuICAgIH1cbiAgfVxufVxuIiwidmFyIFBPTExJTkdfVEhST1RUTEVfTVMgPSArcHJvY2Vzcy5lbnYuTUVURU9SX1BPTExJTkdfVEhST1RUTEVfTVMgfHwgNTA7XG52YXIgUE9MTElOR19JTlRFUlZBTF9NUyA9ICtwcm9jZXNzLmVudi5NRVRFT1JfUE9MTElOR19JTlRFUlZBTF9NUyB8fCAxMCAqIDEwMDA7XG5cblBvbGxpbmdPYnNlcnZlRHJpdmVyID0gZnVuY3Rpb24gKG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uID0gb3B0aW9ucy5jdXJzb3JEZXNjcmlwdGlvbjtcbiAgc2VsZi5fbW9uZ29IYW5kbGUgPSBvcHRpb25zLm1vbmdvSGFuZGxlO1xuICBzZWxmLl9vcmRlcmVkID0gb3B0aW9ucy5vcmRlcmVkO1xuICBzZWxmLl9tdWx0aXBsZXhlciA9IG9wdGlvbnMubXVsdGlwbGV4ZXI7XG4gIHNlbGYuX3N0b3BDYWxsYmFja3MgPSBbXTtcbiAgc2VsZi5fc3RvcHBlZCA9IGZhbHNlO1xuXG4gIHNlbGYuX2N1cnNvciA9IHNlbGYuX21vbmdvSGFuZGxlLl9jcmVhdGVTeW5jaHJvbm91c0N1cnNvcihcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbik7XG5cbiAgLy8gcHJldmlvdXMgcmVzdWx0cyBzbmFwc2hvdC4gIG9uIGVhY2ggcG9sbCBjeWNsZSwgZGlmZnMgYWdhaW5zdFxuICAvLyByZXN1bHRzIGRyaXZlcyB0aGUgY2FsbGJhY2tzLlxuICBzZWxmLl9yZXN1bHRzID0gbnVsbDtcblxuICAvLyBUaGUgbnVtYmVyIG9mIF9wb2xsTW9uZ28gY2FsbHMgdGhhdCBoYXZlIGJlZW4gYWRkZWQgdG8gc2VsZi5fdGFza1F1ZXVlIGJ1dFxuICAvLyBoYXZlIG5vdCBzdGFydGVkIHJ1bm5pbmcuIFVzZWQgdG8gbWFrZSBzdXJlIHdlIG5ldmVyIHNjaGVkdWxlIG1vcmUgdGhhbiBvbmVcbiAgLy8gX3BvbGxNb25nbyAob3RoZXIgdGhhbiBwb3NzaWJseSB0aGUgb25lIHRoYXQgaXMgY3VycmVudGx5IHJ1bm5pbmcpLiBJdCdzXG4gIC8vIGFsc28gdXNlZCBieSBfc3VzcGVuZFBvbGxpbmcgdG8gcHJldGVuZCB0aGVyZSdzIGEgcG9sbCBzY2hlZHVsZWQuIFVzdWFsbHksXG4gIC8vIGl0J3MgZWl0aGVyIDAgKGZvciBcIm5vIHBvbGxzIHNjaGVkdWxlZCBvdGhlciB0aGFuIG1heWJlIG9uZSBjdXJyZW50bHlcbiAgLy8gcnVubmluZ1wiKSBvciAxIChmb3IgXCJhIHBvbGwgc2NoZWR1bGVkIHRoYXQgaXNuJ3QgcnVubmluZyB5ZXRcIiksIGJ1dCBpdCBjYW5cbiAgLy8gYWxzbyBiZSAyIGlmIGluY3JlbWVudGVkIGJ5IF9zdXNwZW5kUG9sbGluZy5cbiAgc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID0gMDtcbiAgc2VsZi5fcGVuZGluZ1dyaXRlcyA9IFtdOyAvLyBwZW9wbGUgdG8gbm90aWZ5IHdoZW4gcG9sbGluZyBjb21wbGV0ZXNcblxuICAvLyBNYWtlIHN1cmUgdG8gY3JlYXRlIGEgc2VwYXJhdGVseSB0aHJvdHRsZWQgZnVuY3Rpb24gZm9yIGVhY2hcbiAgLy8gUG9sbGluZ09ic2VydmVEcml2ZXIgb2JqZWN0LlxuICBzZWxmLl9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgPSBfLnRocm90dGxlKFxuICAgIHNlbGYuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkLFxuICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucG9sbGluZ1Rocm90dGxlTXMgfHwgUE9MTElOR19USFJPVFRMRV9NUyAvKiBtcyAqLyk7XG5cbiAgLy8gWFhYIGZpZ3VyZSBvdXQgaWYgd2Ugc3RpbGwgbmVlZCBhIHF1ZXVlXG4gIHNlbGYuX3Rhc2tRdWV1ZSA9IG5ldyBNZXRlb3IuX0FzeW5jaHJvbm91c1F1ZXVlKCk7XG5cbiAgdmFyIGxpc3RlbmVyc0hhbmRsZSA9IGxpc3RlbkFsbChcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKG5vdGlmaWNhdGlvbikge1xuICAgICAgLy8gV2hlbiBzb21lb25lIGRvZXMgYSB0cmFuc2FjdGlvbiB0aGF0IG1pZ2h0IGFmZmVjdCB1cywgc2NoZWR1bGUgYSBwb2xsXG4gICAgICAvLyBvZiB0aGUgZGF0YWJhc2UuIElmIHRoYXQgdHJhbnNhY3Rpb24gaGFwcGVucyBpbnNpZGUgb2YgYSB3cml0ZSBmZW5jZSxcbiAgICAgIC8vIGJsb2NrIHRoZSBmZW5jZSB1bnRpbCB3ZSd2ZSBwb2xsZWQgYW5kIG5vdGlmaWVkIG9ic2VydmVycy5cbiAgICAgIHZhciBmZW5jZSA9IEREUFNlcnZlci5fZ2V0Q3VycmVudEZlbmNlKCk7XG4gICAgICBpZiAoZmVuY2UpXG4gICAgICAgIHNlbGYuX3BlbmRpbmdXcml0ZXMucHVzaChmZW5jZS5iZWdpbldyaXRlKCkpO1xuICAgICAgLy8gRW5zdXJlIGEgcG9sbCBpcyBzY2hlZHVsZWQuLi4gYnV0IGlmIHdlIGFscmVhZHkga25vdyB0aGF0IG9uZSBpcyxcbiAgICAgIC8vIGRvbid0IGhpdCB0aGUgdGhyb3R0bGVkIF9lbnN1cmVQb2xsSXNTY2hlZHVsZWQgZnVuY3Rpb24gKHdoaWNoIG1pZ2h0XG4gICAgICAvLyBsZWFkIHRvIHVzIGNhbGxpbmcgaXQgdW5uZWNlc3NhcmlseSBpbiA8cG9sbGluZ1Rocm90dGxlTXM+IG1zKS5cbiAgICAgIGlmIChzZWxmLl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgPT09IDApXG4gICAgICAgIHNlbGYuX2Vuc3VyZVBvbGxJc1NjaGVkdWxlZCgpO1xuICAgIH1cbiAgKTtcbiAgc2VsZi5fc3RvcENhbGxiYWNrcy5wdXNoKGFzeW5jIGZ1bmN0aW9uICgpIHsgYXdhaXQgbGlzdGVuZXJzSGFuZGxlLnN0b3AoKTsgfSk7XG5cbiAgLy8gZXZlcnkgb25jZSBhbmQgYSB3aGlsZSwgcG9sbCBldmVuIGlmIHdlIGRvbid0IHRoaW5rIHdlJ3JlIGRpcnR5LCBmb3JcbiAgLy8gZXZlbnR1YWwgY29uc2lzdGVuY3kgd2l0aCBkYXRhYmFzZSB3cml0ZXMgZnJvbSBvdXRzaWRlIHRoZSBNZXRlb3JcbiAgLy8gdW5pdmVyc2UuXG4gIC8vXG4gIC8vIEZvciB0ZXN0aW5nLCB0aGVyZSdzIGFuIHVuZG9jdW1lbnRlZCBjYWxsYmFjayBhcmd1bWVudCB0byBvYnNlcnZlQ2hhbmdlc1xuICAvLyB3aGljaCBkaXNhYmxlcyB0aW1lLWJhc2VkIHBvbGxpbmcgYW5kIGdldHMgY2FsbGVkIGF0IHRoZSBiZWdpbm5pbmcgb2YgZWFjaFxuICAvLyBwb2xsLlxuICBpZiAob3B0aW9ucy5fdGVzdE9ubHlQb2xsQ2FsbGJhY2spIHtcbiAgICBzZWxmLl90ZXN0T25seVBvbGxDYWxsYmFjayA9IG9wdGlvbnMuX3Rlc3RPbmx5UG9sbENhbGxiYWNrO1xuICB9IGVsc2Uge1xuICAgIHZhciBwb2xsaW5nSW50ZXJ2YWwgPVxuICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucG9sbGluZ0ludGVydmFsTXMgfHxcbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zLl9wb2xsaW5nSW50ZXJ2YWwgfHwgLy8gQ09NUEFUIHdpdGggMS4yXG4gICAgICAgICAgUE9MTElOR19JTlRFUlZBTF9NUztcbiAgICB2YXIgaW50ZXJ2YWxIYW5kbGUgPSBNZXRlb3Iuc2V0SW50ZXJ2YWwoXG4gICAgICBfLmJpbmQoc2VsZi5fZW5zdXJlUG9sbElzU2NoZWR1bGVkLCBzZWxmKSwgcG9sbGluZ0ludGVydmFsKTtcbiAgICBzZWxmLl9zdG9wQ2FsbGJhY2tzLnB1c2goZnVuY3Rpb24gKCkge1xuICAgICAgTWV0ZW9yLmNsZWFySW50ZXJ2YWwoaW50ZXJ2YWxIYW5kbGUpO1xuICAgIH0pO1xuICB9XG59O1xuXG5fLmV4dGVuZChQb2xsaW5nT2JzZXJ2ZURyaXZlci5wcm90b3R5cGUsIHtcbiAgX2luaXQ6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAvLyBNYWtlIHN1cmUgd2UgYWN0dWFsbHkgcG9sbCBzb29uIVxuICAgIGF3YWl0IHRoaXMuX3VudGhyb3R0bGVkRW5zdXJlUG9sbElzU2NoZWR1bGVkKCk7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAxKTtcbiAgfSxcbiAgLy8gVGhpcyBpcyBhbHdheXMgY2FsbGVkIHRocm91Z2ggXy50aHJvdHRsZSAoZXhjZXB0IG9uY2UgYXQgc3RhcnR1cCkuXG4gIF91bnRocm90dGxlZEVuc3VyZVBvbGxJc1NjaGVkdWxlZDogYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkID4gMClcbiAgICAgIHJldHVybjtcbiAgICArK3NlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcbiAgICBhd2FpdCBzZWxmLl90YXNrUXVldWUucnVuVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBhd2FpdCBzZWxmLl9wb2xsTW9uZ28oKTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyB0ZXN0LW9ubHkgaW50ZXJmYWNlIGZvciBjb250cm9sbGluZyBwb2xsaW5nLlxuICAvL1xuICAvLyBfc3VzcGVuZFBvbGxpbmcgYmxvY2tzIHVudGlsIGFueSBjdXJyZW50bHkgcnVubmluZyBhbmQgc2NoZWR1bGVkIHBvbGxzIGFyZVxuICAvLyBkb25lLCBhbmQgcHJldmVudHMgYW55IGZ1cnRoZXIgcG9sbHMgZnJvbSBiZWluZyBzY2hlZHVsZWQuIChuZXdcbiAgLy8gT2JzZXJ2ZUhhbmRsZXMgY2FuIGJlIGFkZGVkIGFuZCByZWNlaXZlIHRoZWlyIGluaXRpYWwgYWRkZWQgY2FsbGJhY2tzLFxuICAvLyB0aG91Z2guKVxuICAvL1xuICAvLyBfcmVzdW1lUG9sbGluZyBpbW1lZGlhdGVseSBwb2xscywgYW5kIGFsbG93cyBmdXJ0aGVyIHBvbGxzIHRvIG9jY3VyLlxuICBfc3VzcGVuZFBvbGxpbmc6IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBQcmV0ZW5kIHRoYXQgdGhlcmUncyBhbm90aGVyIHBvbGwgc2NoZWR1bGVkICh3aGljaCB3aWxsIHByZXZlbnRcbiAgICAvLyBfZW5zdXJlUG9sbElzU2NoZWR1bGVkIGZyb20gcXVldWVpbmcgYW55IG1vcmUgcG9sbHMpLlxuICAgICsrc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkO1xuICAgIC8vIE5vdyBibG9jayB1bnRpbCBhbGwgY3VycmVudGx5IHJ1bm5pbmcgb3Igc2NoZWR1bGVkIHBvbGxzIGFyZSBkb25lLlxuICAgIHNlbGYuX3Rhc2tRdWV1ZS5ydW5UYXNrKGZ1bmN0aW9uKCkge30pO1xuXG4gICAgLy8gQ29uZmlybSB0aGF0IHRoZXJlIGlzIG9ubHkgb25lIFwicG9sbFwiICh0aGUgZmFrZSBvbmUgd2UncmUgcHJldGVuZGluZyB0b1xuICAgIC8vIGhhdmUpIHNjaGVkdWxlZC5cbiAgICBpZiAoc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkICE9PSAxKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCBpcyBcIiArXG4gICAgICAgICAgICAgICAgICAgICAgc2VsZi5fcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkKTtcbiAgfSxcbiAgX3Jlc3VtZVBvbGxpbmc6IGFzeW5jIGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBXZSBzaG91bGQgYmUgaW4gdGhlIHNhbWUgc3RhdGUgYXMgaW4gdGhlIGVuZCBvZiBfc3VzcGVuZFBvbGxpbmcuXG4gICAgaWYgKHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCAhPT0gMSlcbiAgICAgIHRocm93IG5ldyBFcnJvcihcIl9wb2xsc1NjaGVkdWxlZEJ1dE5vdFN0YXJ0ZWQgaXMgXCIgK1xuICAgICAgICAgICAgICAgICAgICAgIHNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZCk7XG4gICAgLy8gUnVuIGEgcG9sbCBzeW5jaHJvbm91c2x5ICh3aGljaCB3aWxsIGNvdW50ZXJhY3QgdGhlXG4gICAgLy8gKytfcG9sbHNTY2hlZHVsZWRCdXROb3RTdGFydGVkIGZyb20gX3N1c3BlbmRQb2xsaW5nKS5cbiAgICBhd2FpdCBzZWxmLl90YXNrUXVldWUucnVuVGFzayhhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICBhd2FpdCBzZWxmLl9wb2xsTW9uZ28oKTtcbiAgICB9KTtcbiAgfSxcblxuICBhc3luYyBfcG9sbE1vbmdvKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAtLXNlbGYuX3BvbGxzU2NoZWR1bGVkQnV0Tm90U3RhcnRlZDtcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIGZpcnN0ID0gZmFsc2U7XG4gICAgdmFyIG5ld1Jlc3VsdHM7XG4gICAgdmFyIG9sZFJlc3VsdHMgPSBzZWxmLl9yZXN1bHRzO1xuICAgIGlmICghb2xkUmVzdWx0cykge1xuICAgICAgZmlyc3QgPSB0cnVlO1xuICAgICAgLy8gWFhYIG1heWJlIHVzZSBPcmRlcmVkRGljdCBpbnN0ZWFkP1xuICAgICAgb2xkUmVzdWx0cyA9IHNlbGYuX29yZGVyZWQgPyBbXSA6IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuICAgIH1cblxuICAgIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrICYmIHNlbGYuX3Rlc3RPbmx5UG9sbENhbGxiYWNrKCk7XG5cbiAgICAvLyBTYXZlIHRoZSBsaXN0IG9mIHBlbmRpbmcgd3JpdGVzIHdoaWNoIHRoaXMgcm91bmQgd2lsbCBjb21taXQuXG4gICAgdmFyIHdyaXRlc0ZvckN5Y2xlID0gc2VsZi5fcGVuZGluZ1dyaXRlcztcbiAgICBzZWxmLl9wZW5kaW5nV3JpdGVzID0gW107XG5cbiAgICAvLyBHZXQgdGhlIG5ldyBxdWVyeSByZXN1bHRzLiAoVGhpcyB5aWVsZHMuKVxuICAgIHRyeSB7XG4gICAgICBuZXdSZXN1bHRzID0gYXdhaXQgc2VsZi5fY3Vyc29yLmdldFJhd09iamVjdHMoc2VsZi5fb3JkZXJlZCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGZpcnN0ICYmIHR5cGVvZihlLmNvZGUpID09PSAnbnVtYmVyJykge1xuICAgICAgICAvLyBUaGlzIGlzIGFuIGVycm9yIGRvY3VtZW50IHNlbnQgdG8gdXMgYnkgbW9uZ29kLCBub3QgYSBjb25uZWN0aW9uXG4gICAgICAgIC8vIGVycm9yIGdlbmVyYXRlZCBieSB0aGUgY2xpZW50LiBBbmQgd2UndmUgbmV2ZXIgc2VlbiB0aGlzIHF1ZXJ5IHdvcmtcbiAgICAgICAgLy8gc3VjY2Vzc2Z1bGx5LiBQcm9iYWJseSBpdCdzIGEgYmFkIHNlbGVjdG9yIG9yIHNvbWV0aGluZywgc28gd2Ugc2hvdWxkXG4gICAgICAgIC8vIE5PVCByZXRyeS4gSW5zdGVhZCwgd2Ugc2hvdWxkIGhhbHQgdGhlIG9ic2VydmUgKHdoaWNoIGVuZHMgdXAgY2FsbGluZ1xuICAgICAgICAvLyBgc3RvcGAgb24gdXMpLlxuICAgICAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5xdWVyeUVycm9yKFxuICAgICAgICAgICAgbmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIFwiRXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnkgXCIgK1xuICAgICAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSArIFwiOiBcIiArIGUubWVzc2FnZSkpO1xuICAgICAgfVxuXG4gICAgICAvLyBnZXRSYXdPYmplY3RzIGNhbiB0aHJvdyBpZiB3ZSdyZSBoYXZpbmcgdHJvdWJsZSB0YWxraW5nIHRvIHRoZVxuICAgICAgLy8gZGF0YWJhc2UuICBUaGF0J3MgZmluZSAtLS0gd2Ugd2lsbCByZXBvbGwgbGF0ZXIgYW55d2F5LiBCdXQgd2Ugc2hvdWxkXG4gICAgICAvLyBtYWtlIHN1cmUgbm90IHRvIGxvc2UgdHJhY2sgb2YgdGhpcyBjeWNsZSdzIHdyaXRlcy5cbiAgICAgIC8vIChJdCBhbHNvIGNhbiB0aHJvdyBpZiB0aGVyZSdzIGp1c3Qgc29tZXRoaW5nIGludmFsaWQgYWJvdXQgdGhpcyBxdWVyeTtcbiAgICAgIC8vIHVuZm9ydHVuYXRlbHkgdGhlIE9ic2VydmVEcml2ZXIgQVBJIGRvZXNuJ3QgcHJvdmlkZSBhIGdvb2Qgd2F5IHRvXG4gICAgICAvLyBcImNhbmNlbFwiIHRoZSBvYnNlcnZlIGZyb20gdGhlIGluc2lkZSBpbiB0aGlzIGNhc2UuXG4gICAgICBBcnJheS5wcm90b3R5cGUucHVzaC5hcHBseShzZWxmLl9wZW5kaW5nV3JpdGVzLCB3cml0ZXNGb3JDeWNsZSk7XG4gICAgICBNZXRlb3IuX2RlYnVnKFwiRXhjZXB0aW9uIHdoaWxlIHBvbGxpbmcgcXVlcnkgXCIgK1xuICAgICAgICAgIEpTT04uc3RyaW5naWZ5KHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uKSwgZSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gUnVuIGRpZmZzLlxuICAgIGlmICghc2VsZi5fc3RvcHBlZCkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9kaWZmUXVlcnlDaGFuZ2VzKFxuICAgICAgICAgIHNlbGYuX29yZGVyZWQsIG9sZFJlc3VsdHMsIG5ld1Jlc3VsdHMsIHNlbGYuX211bHRpcGxleGVyKTtcbiAgICB9XG5cbiAgICAvLyBTaWduYWxzIHRoZSBtdWx0aXBsZXhlciB0byBhbGxvdyBhbGwgb2JzZXJ2ZUNoYW5nZXMgY2FsbHMgdGhhdCBzaGFyZSB0aGlzXG4gICAgLy8gbXVsdGlwbGV4ZXIgdG8gcmV0dXJuLiAoVGhpcyBoYXBwZW5zIGFzeW5jaHJvbm91c2x5LCB2aWEgdGhlXG4gICAgLy8gbXVsdGlwbGV4ZXIncyBxdWV1ZS4pXG4gICAgaWYgKGZpcnN0KVxuICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVhZHkoKTtcblxuICAgIC8vIFJlcGxhY2Ugc2VsZi5fcmVzdWx0cyBhdG9taWNhbGx5LiAgKFRoaXMgYXNzaWdubWVudCBpcyB3aGF0IG1ha2VzIGBmaXJzdGBcbiAgICAvLyBzdGF5IHRocm91Z2ggb24gdGhlIG5leHQgY3ljbGUsIHNvIHdlJ3ZlIHdhaXRlZCB1bnRpbCBhZnRlciB3ZSd2ZVxuICAgIC8vIGNvbW1pdHRlZCB0byByZWFkeS1pbmcgdGhlIG11bHRpcGxleGVyLilcbiAgICBzZWxmLl9yZXN1bHRzID0gbmV3UmVzdWx0cztcblxuICAgIC8vIE9uY2UgdGhlIE9ic2VydmVNdWx0aXBsZXhlciBoYXMgcHJvY2Vzc2VkIGV2ZXJ5dGhpbmcgd2UndmUgZG9uZSBpbiB0aGlzXG4gICAgLy8gcm91bmQsIG1hcmsgYWxsIHRoZSB3cml0ZXMgd2hpY2ggZXhpc3RlZCBiZWZvcmUgdGhpcyBjYWxsIGFzXG4gICAgLy8gY29tbW1pdHRlZC4gKElmIG5ldyB3cml0ZXMgaGF2ZSBzaG93biB1cCBpbiB0aGUgbWVhbnRpbWUsIHRoZXJlJ2xsXG4gICAgLy8gYWxyZWFkeSBiZSBhbm90aGVyIF9wb2xsTW9uZ28gdGFzayBzY2hlZHVsZWQuKVxuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLm9uRmx1c2goYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgICAgZm9yIChjb25zdCB3IG9mIHdyaXRlc0ZvckN5Y2xlKSB7XG4gICAgICAgIGF3YWl0IHcuY29tbWl0dGVkKCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG5cbiAgc3RvcDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBzZWxmLl9zdG9wcGVkID0gdHJ1ZTtcbiAgICBjb25zdCBzdG9wQ2FsbGJhY2tzQ2FsbGVyID0gYXN5bmMgZnVuY3Rpb24oYykge1xuICAgICAgYXdhaXQgYygpO1xuICAgIH07XG5cbiAgICBfLmVhY2goc2VsZi5fc3RvcENhbGxiYWNrcywgc3RvcENhbGxiYWNrc0NhbGxlcik7XG4gICAgLy8gUmVsZWFzZSBhbnkgd3JpdGUgZmVuY2VzIHRoYXQgYXJlIHdhaXRpbmcgb24gdXMuXG4gICAgXy5lYWNoKHNlbGYuX3BlbmRpbmdXcml0ZXMsIGFzeW5jIGZ1bmN0aW9uICh3KSB7XG4gICAgICBhd2FpdCB3LmNvbW1pdHRlZCgpO1xuICAgIH0pO1xuICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtcG9sbGluZ1wiLCAtMSk7XG4gIH1cbn0pO1xuIiwiaW1wb3J0IHsgb3Bsb2dWMlYxQ29udmVydGVyIH0gZnJvbSBcIi4vb3Bsb2dfdjJfY29udmVydGVyXCI7XG5cbnZhciBQSEFTRSA9IHtcbiAgUVVFUllJTkc6IFwiUVVFUllJTkdcIixcbiAgRkVUQ0hJTkc6IFwiRkVUQ0hJTkdcIixcbiAgU1RFQURZOiBcIlNURUFEWVwiXG59O1xuXG4vLyBFeGNlcHRpb24gdGhyb3duIGJ5IF9uZWVkVG9Qb2xsUXVlcnkgd2hpY2ggdW5yb2xscyB0aGUgc3RhY2sgdXAgdG8gdGhlXG4vLyBlbmNsb3NpbmcgY2FsbCB0byBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeS5cbnZhciBTd2l0Y2hlZFRvUXVlcnkgPSBmdW5jdGlvbiAoKSB7fTtcbnZhciBmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeSA9IGZ1bmN0aW9uIChmKSB7XG4gIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgdHJ5IHtcbiAgICAgIGYuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoIShlIGluc3RhbmNlb2YgU3dpdGNoZWRUb1F1ZXJ5KSlcbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH07XG59O1xuXG52YXIgY3VycmVudElkID0gMDtcblxuLy8gT3Bsb2dPYnNlcnZlRHJpdmVyIGlzIGFuIGFsdGVybmF0aXZlIHRvIFBvbGxpbmdPYnNlcnZlRHJpdmVyIHdoaWNoIGZvbGxvd3Ncbi8vIHRoZSBNb25nbyBvcGVyYXRpb24gbG9nIGluc3RlYWQgb2YganVzdCByZS1wb2xsaW5nIHRoZSBxdWVyeS4gSXQgb2JleXMgdGhlXG4vLyBzYW1lIHNpbXBsZSBpbnRlcmZhY2U6IGNvbnN0cnVjdGluZyBpdCBzdGFydHMgc2VuZGluZyBvYnNlcnZlQ2hhbmdlc1xuLy8gY2FsbGJhY2tzIChhbmQgYSByZWFkeSgpIGludm9jYXRpb24pIHRvIHRoZSBPYnNlcnZlTXVsdGlwbGV4ZXIsIGFuZCB5b3Ugc3RvcFxuLy8gaXQgYnkgY2FsbGluZyB0aGUgc3RvcCgpIG1ldGhvZC5cbk9wbG9nT2JzZXJ2ZURyaXZlciA9IGZ1bmN0aW9uIChvcHRpb25zKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgc2VsZi5fdXNlc09wbG9nID0gdHJ1ZTsgIC8vIHRlc3RzIGxvb2sgYXQgdGhpc1xuXG4gIHNlbGYuX2lkID0gY3VycmVudElkO1xuICBjdXJyZW50SWQrKztcblxuICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiA9IG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb247XG4gIHNlbGYuX21vbmdvSGFuZGxlID0gb3B0aW9ucy5tb25nb0hhbmRsZTtcbiAgc2VsZi5fbXVsdGlwbGV4ZXIgPSBvcHRpb25zLm11bHRpcGxleGVyO1xuXG4gIGlmIChvcHRpb25zLm9yZGVyZWQpIHtcbiAgICB0aHJvdyBFcnJvcihcIk9wbG9nT2JzZXJ2ZURyaXZlciBvbmx5IHN1cHBvcnRzIHVub3JkZXJlZCBvYnNlcnZlQ2hhbmdlc1wiKTtcbiAgfVxuXG4gIHZhciBzb3J0ZXIgPSBvcHRpb25zLnNvcnRlcjtcbiAgLy8gV2UgZG9uJ3Qgc3VwcG9ydCAkbmVhciBhbmQgb3RoZXIgZ2VvLXF1ZXJpZXMgc28gaXQncyBPSyB0byBpbml0aWFsaXplIHRoZVxuICAvLyBjb21wYXJhdG9yIG9ubHkgb25jZSBpbiB0aGUgY29uc3RydWN0b3IuXG4gIHZhciBjb21wYXJhdG9yID0gc29ydGVyICYmIHNvcnRlci5nZXRDb21wYXJhdG9yKCk7XG5cbiAgaWYgKG9wdGlvbnMuY3Vyc29yRGVzY3JpcHRpb24ub3B0aW9ucy5saW1pdCkge1xuICAgIC8vIFRoZXJlIGFyZSBzZXZlcmFsIHByb3BlcnRpZXMgb3JkZXJlZCBkcml2ZXIgaW1wbGVtZW50czpcbiAgICAvLyAtIF9saW1pdCBpcyBhIHBvc2l0aXZlIG51bWJlclxuICAgIC8vIC0gX2NvbXBhcmF0b3IgaXMgYSBmdW5jdGlvbi1jb21wYXJhdG9yIGJ5IHdoaWNoIHRoZSBxdWVyeSBpcyBvcmRlcmVkXG4gICAgLy8gLSBfdW5wdWJsaXNoZWRCdWZmZXIgaXMgbm9uLW51bGwgTWluL01heCBIZWFwLFxuICAgIC8vICAgICAgICAgICAgICAgICAgICAgIHRoZSBlbXB0eSBidWZmZXIgaW4gU1RFQURZIHBoYXNlIGltcGxpZXMgdGhhdCB0aGVcbiAgICAvLyAgICAgICAgICAgICAgICAgICAgICBldmVyeXRoaW5nIHRoYXQgbWF0Y2hlcyB0aGUgcXVlcmllcyBzZWxlY3RvciBmaXRzXG4gICAgLy8gICAgICAgICAgICAgICAgICAgICAgaW50byBwdWJsaXNoZWQgc2V0LlxuICAgIC8vIC0gX3B1Ymxpc2hlZCAtIE1heCBIZWFwIChhbHNvIGltcGxlbWVudHMgSWRNYXAgbWV0aG9kcylcblxuICAgIHZhciBoZWFwT3B0aW9ucyA9IHsgSWRNYXA6IExvY2FsQ29sbGVjdGlvbi5fSWRNYXAgfTtcbiAgICBzZWxmLl9saW1pdCA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMubGltaXQ7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IGNvbXBhcmF0b3I7XG4gICAgc2VsZi5fc29ydGVyID0gc29ydGVyO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbmV3IE1pbk1heEhlYXAoY29tcGFyYXRvciwgaGVhcE9wdGlvbnMpO1xuICAgIC8vIFdlIG5lZWQgc29tZXRoaW5nIHRoYXQgY2FuIGZpbmQgTWF4IHZhbHVlIGluIGFkZGl0aW9uIHRvIElkTWFwIGludGVyZmFjZVxuICAgIHNlbGYuX3B1Ymxpc2hlZCA9IG5ldyBNYXhIZWFwKGNvbXBhcmF0b3IsIGhlYXBPcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICBzZWxmLl9saW1pdCA9IDA7XG4gICAgc2VsZi5fY29tcGFyYXRvciA9IG51bGw7XG4gICAgc2VsZi5fc29ydGVyID0gbnVsbDtcbiAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciA9IG51bGw7XG4gICAgc2VsZi5fcHVibGlzaGVkID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIH1cblxuICAvLyBJbmRpY2F0ZXMgaWYgaXQgaXMgc2FmZSB0byBpbnNlcnQgYSBuZXcgZG9jdW1lbnQgYXQgdGhlIGVuZCBvZiB0aGUgYnVmZmVyXG4gIC8vIGZvciB0aGlzIHF1ZXJ5LiBpLmUuIGl0IGlzIGtub3duIHRoYXQgdGhlcmUgYXJlIG5vIGRvY3VtZW50cyBtYXRjaGluZyB0aGVcbiAgLy8gc2VsZWN0b3IgdGhvc2UgYXJlIG5vdCBpbiBwdWJsaXNoZWQgb3IgYnVmZmVyLlxuICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcblxuICBzZWxmLl9zdG9wcGVkID0gZmFsc2U7XG4gIHNlbGYuX3N0b3BIYW5kbGVzID0gW107XG5cbiAgUGFja2FnZVsnZmFjdHMtYmFzZSddICYmIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXS5GYWN0cy5pbmNyZW1lbnRTZXJ2ZXJGYWN0KFxuICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtb3Bsb2dcIiwgMSk7XG5cbiAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5RVUVSWUlORyk7XG5cbiAgc2VsZi5fbWF0Y2hlciA9IG9wdGlvbnMubWF0Y2hlcjtcbiAgLy8gd2UgYXJlIG5vdyB1c2luZyBwcm9qZWN0aW9uLCBub3QgZmllbGRzIGluIHRoZSBjdXJzb3IgZGVzY3JpcHRpb24gZXZlbiBpZiB5b3UgcGFzcyB7ZmllbGRzfVxuICAvLyBpbiB0aGUgY3Vyc29yIGNvbnN0cnVjdGlvblxuICB2YXIgcHJvamVjdGlvbiA9IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMuZmllbGRzIHx8IHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLm9wdGlvbnMucHJvamVjdGlvbiB8fCB7fTtcbiAgc2VsZi5fcHJvamVjdGlvbkZuID0gTG9jYWxDb2xsZWN0aW9uLl9jb21waWxlUHJvamVjdGlvbihwcm9qZWN0aW9uKTtcbiAgLy8gUHJvamVjdGlvbiBmdW5jdGlvbiwgcmVzdWx0IG9mIGNvbWJpbmluZyBpbXBvcnRhbnQgZmllbGRzIGZvciBzZWxlY3RvciBhbmRcbiAgLy8gZXhpc3RpbmcgZmllbGRzIHByb2plY3Rpb25cbiAgc2VsZi5fc2hhcmVkUHJvamVjdGlvbiA9IHNlbGYuX21hdGNoZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHByb2plY3Rpb24pO1xuICBpZiAoc29ydGVyKVxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24gPSBzb3J0ZXIuY29tYmluZUludG9Qcm9qZWN0aW9uKHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuICBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4gPSBMb2NhbENvbGxlY3Rpb24uX2NvbXBpbGVQcm9qZWN0aW9uKFxuICAgIHNlbGYuX3NoYXJlZFByb2plY3Rpb24pO1xuXG4gIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgc2VsZi5fZmV0Y2hHZW5lcmF0aW9uID0gMDtcblxuICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IFtdO1xuXG4gIC8vIElmIHRoZSBvcGxvZyBoYW5kbGUgdGVsbHMgdXMgdGhhdCBpdCBza2lwcGVkIHNvbWUgZW50cmllcyAoYmVjYXVzZSBpdCBnb3RcbiAgLy8gYmVoaW5kLCBzYXkpLCByZS1wb2xsLlxuICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vblNraXBwZWRFbnRyaWVzKFxuICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgIHJldHVybiBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICB9KVxuICApKTtcblxuICBmb3JFYWNoVHJpZ2dlcihzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKHRyaWdnZXIpIHtcbiAgICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS5vbk9wbG9nRW50cnkoXG4gICAgICB0cmlnZ2VyLCBmdW5jdGlvbiAobm90aWZpY2F0aW9uKSB7XG4gICAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICB2YXIgb3AgPSBub3RpZmljYXRpb24ub3A7XG4gICAgICAgICAgaWYgKG5vdGlmaWNhdGlvbi5kcm9wQ29sbGVjdGlvbiB8fCBub3RpZmljYXRpb24uZHJvcERhdGFiYXNlKSB7XG4gICAgICAgICAgICAvLyBOb3RlOiB0aGlzIGNhbGwgaXMgbm90IGFsbG93ZWQgdG8gYmxvY2sgb24gYW55dGhpbmcgKGVzcGVjaWFsbHlcbiAgICAgICAgICAgIC8vIG9uIHdhaXRpbmcgZm9yIG9wbG9nIGVudHJpZXMgdG8gY2F0Y2ggdXApIGJlY2F1c2UgdGhhdCB3aWxsIGJsb2NrXG4gICAgICAgICAgICAvLyBvbk9wbG9nRW50cnkhXG4gICAgICAgICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIEFsbCBvdGhlciBvcGVyYXRvcnMgc2hvdWxkIGJlIGhhbmRsZWQgZGVwZW5kaW5nIG9uIHBoYXNlXG4gICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAgIHJldHVybiBzZWxmLl9oYW5kbGVPcGxvZ0VudHJ5UXVlcnlpbmcob3ApO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmV0dXJuIHNlbGYuX2hhbmRsZU9wbG9nRW50cnlTdGVhZHlPckZldGNoaW5nKG9wKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICB9XG4gICAgKSk7XG4gIH0pO1xuXG4gIC8vIFhYWCBvcmRlcmluZyB3LnIudC4gZXZlcnl0aGluZyBlbHNlP1xuICBzZWxmLl9zdG9wSGFuZGxlcy5wdXNoKGxpc3RlbkFsbChcbiAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbiwgZnVuY3Rpb24gKCkge1xuICAgICAgLy8gSWYgd2UncmUgbm90IGluIGEgcHJlLWZpcmUgd3JpdGUgZmVuY2UsIHdlIGRvbid0IGhhdmUgdG8gZG8gYW55dGhpbmcuXG4gICAgICB2YXIgZmVuY2UgPSBERFBTZXJ2ZXIuX2dldEN1cnJlbnRGZW5jZSgpO1xuICAgICAgaWYgKCFmZW5jZSB8fCBmZW5jZS5maXJlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICBpZiAoZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnMpIHtcbiAgICAgICAgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnNbc2VsZi5faWRdID0gc2VsZjtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycyA9IHt9O1xuICAgICAgZmVuY2UuX29wbG9nT2JzZXJ2ZURyaXZlcnNbc2VsZi5faWRdID0gc2VsZjtcblxuICAgICAgZmVuY2Uub25CZWZvcmVGaXJlKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIGRyaXZlcnMgPSBmZW5jZS5fb3Bsb2dPYnNlcnZlRHJpdmVycztcbiAgICAgICAgZGVsZXRlIGZlbmNlLl9vcGxvZ09ic2VydmVEcml2ZXJzO1xuXG4gICAgICAgIC8vIFRoaXMgZmVuY2UgY2Fubm90IGZpcmUgdW50aWwgd2UndmUgY2F1Z2h0IHVwIHRvIFwidGhpcyBwb2ludFwiIGluIHRoZVxuICAgICAgICAvLyBvcGxvZywgYW5kIGFsbCBvYnNlcnZlcnMgbWFkZSBpdCBiYWNrIHRvIHRoZSBzdGVhZHkgc3RhdGUuXG4gICAgICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS53YWl0VW50aWxDYXVnaHRVcCgpO1xuXG4gICAgICAgIGZvciAoY29uc3QgZHJpdmVyIG9mIE9iamVjdC52YWx1ZXMoZHJpdmVycykpIHtcbiAgICAgICAgICBpZiAoZHJpdmVyLl9zdG9wcGVkKVxuICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICB2YXIgd3JpdGUgPSBhd2FpdCBmZW5jZS5iZWdpbldyaXRlKCk7XG4gICAgICAgICAgaWYgKGRyaXZlci5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSkge1xuICAgICAgICAgICAgLy8gTWFrZSBzdXJlIHRoYXQgYWxsIG9mIHRoZSBjYWxsYmFja3MgaGF2ZSBtYWRlIGl0IHRocm91Z2ggdGhlXG4gICAgICAgICAgICAvLyBtdWx0aXBsZXhlciBhbmQgYmVlbiBkZWxpdmVyZWQgdG8gT2JzZXJ2ZUhhbmRsZXMgYmVmb3JlIGNvbW1pdHRpbmdcbiAgICAgICAgICAgIC8vIHdyaXRlcy5cbiAgICAgICAgICAgIGF3YWl0IGRyaXZlci5fbXVsdGlwbGV4ZXIub25GbHVzaCh3cml0ZS5jb21taXR0ZWQpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBkcml2ZXIuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkucHVzaCh3cml0ZSk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gICkpO1xuXG4gIC8vIFdoZW4gTW9uZ28gZmFpbHMgb3Zlciwgd2UgbmVlZCB0byByZXBvbGwgdGhlIHF1ZXJ5LCBpbiBjYXNlIHdlIHByb2Nlc3NlZCBhblxuICAvLyBvcGxvZyBlbnRyeSB0aGF0IGdvdCByb2xsZWQgYmFjay5cbiAgc2VsZi5fc3RvcEhhbmRsZXMucHVzaChzZWxmLl9tb25nb0hhbmRsZS5fb25GYWlsb3ZlcihmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShcbiAgICBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgfSkpKTtcbn07XG5cbl8uZXh0ZW5kKE9wbG9nT2JzZXJ2ZURyaXZlci5wcm90b3R5cGUsIHtcbiAgX2luaXQ6IGZ1bmN0aW9uKCkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIC8vIEdpdmUgX29ic2VydmVDaGFuZ2VzIGEgY2hhbmNlIHRvIGFkZCB0aGUgbmV3IE9ic2VydmVIYW5kbGUgdG8gb3VyXG4gICAgLy8gbXVsdGlwbGV4ZXIsIHNvIHRoYXQgdGhlIGFkZGVkIGNhbGxzIGdldCBzdHJlYW1lZC5cbiAgICByZXR1cm4gc2VsZi5fcnVuSW5pdGlhbFF1ZXJ5KCk7XG4gIH0sXG4gIF9hZGRQdWJsaXNoZWQ6IGZ1bmN0aW9uIChpZCwgZG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBmaWVsZHMgPSBfLmNsb25lKGRvYyk7XG4gICAgICBkZWxldGUgZmllbGRzLl9pZDtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25Gbihkb2MpKTtcbiAgICAgIHNlbGYuX211bHRpcGxleGVyLmFkZGVkKGlkLCBzZWxmLl9wcm9qZWN0aW9uRm4oZmllbGRzKSk7XG5cbiAgICAgIC8vIEFmdGVyIGFkZGluZyB0aGlzIGRvY3VtZW50LCB0aGUgcHVibGlzaGVkIHNldCBtaWdodCBiZSBvdmVyZmxvd2VkXG4gICAgICAvLyAoZXhjZWVkaW5nIGNhcGFjaXR5IHNwZWNpZmllZCBieSBsaW1pdCkuIElmIHNvLCBwdXNoIHRoZSBtYXhpbXVtXG4gICAgICAvLyBlbGVtZW50IHRvIHRoZSBidWZmZXIsIHdlIG1pZ2h0IHdhbnQgdG8gc2F2ZSBpdCBpbiBtZW1vcnkgdG8gcmVkdWNlIHRoZVxuICAgICAgLy8gYW1vdW50IG9mIE1vbmdvIGxvb2t1cHMgaW4gdGhlIGZ1dHVyZS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCAmJiBzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpIHtcbiAgICAgICAgLy8gWFhYIGluIHRoZW9yeSB0aGUgc2l6ZSBvZiBwdWJsaXNoZWQgaXMgbm8gbW9yZSB0aGFuIGxpbWl0KzFcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgIT09IHNlbGYuX2xpbWl0ICsgMSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIkFmdGVyIGFkZGluZyB0byBwdWJsaXNoZWQsIFwiICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgKHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgLSBzZWxmLl9saW1pdCkgK1xuICAgICAgICAgICAgICAgICAgICAgICAgICBcIiBkb2N1bWVudHMgYXJlIG92ZXJmbG93aW5nIHRoZSBzZXRcIik7XG4gICAgICAgIH1cblxuICAgICAgICB2YXIgb3ZlcmZsb3dpbmdEb2NJZCA9IHNlbGYuX3B1Ymxpc2hlZC5tYXhFbGVtZW50SWQoKTtcbiAgICAgICAgdmFyIG92ZXJmbG93aW5nRG9jID0gc2VsZi5fcHVibGlzaGVkLmdldChvdmVyZmxvd2luZ0RvY0lkKTtcblxuICAgICAgICBpZiAoRUpTT04uZXF1YWxzKG92ZXJmbG93aW5nRG9jSWQsIGlkKSkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcIlRoZSBkb2N1bWVudCBqdXN0IGFkZGVkIGlzIG92ZXJmbG93aW5nIHRoZSBwdWJsaXNoZWQgc2V0XCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIucmVtb3ZlZChvdmVyZmxvd2luZ0RvY0lkKTtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQob3ZlcmZsb3dpbmdEb2NJZCwgb3ZlcmZsb3dpbmdEb2MpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfcmVtb3ZlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fcHVibGlzaGVkLnJlbW92ZShpZCk7XG4gICAgICBzZWxmLl9tdWx0aXBsZXhlci5yZW1vdmVkKGlkKTtcbiAgICAgIGlmICghIHNlbGYuX2xpbWl0IHx8IHNlbGYuX3B1Ymxpc2hlZC5zaXplKCkgPT09IHNlbGYuX2xpbWl0KVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuc2l6ZSgpID4gc2VsZi5fbGltaXQpXG4gICAgICAgIHRocm93IEVycm9yKFwic2VsZi5fcHVibGlzaGVkIGdvdCB0b28gYmlnXCIpO1xuXG4gICAgICAvLyBPSywgd2UgYXJlIHB1Ymxpc2hpbmcgbGVzcyB0aGFuIHRoZSBsaW1pdC4gTWF5YmUgd2Ugc2hvdWxkIGxvb2sgaW4gdGhlXG4gICAgICAvLyBidWZmZXIgdG8gZmluZCB0aGUgbmV4dCBlbGVtZW50IHBhc3Qgd2hhdCB3ZSB3ZXJlIHB1Ymxpc2hpbmcgYmVmb3JlLlxuXG4gICAgICBpZiAoIXNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmVtcHR5KCkpIHtcbiAgICAgICAgLy8gVGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlcjsgbW92ZSB0aGUgZmlyc3QgdGhpbmcgaW4gaXQgdG9cbiAgICAgICAgLy8gX3B1Ymxpc2hlZC5cbiAgICAgICAgdmFyIG5ld0RvY0lkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWluRWxlbWVudElkKCk7XG4gICAgICAgIHZhciBuZXdEb2MgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQobmV3RG9jSWQpO1xuICAgICAgICBzZWxmLl9yZW1vdmVCdWZmZXJlZChuZXdEb2NJZCk7XG4gICAgICAgIHNlbGYuX2FkZFB1Ymxpc2hlZChuZXdEb2NJZCwgbmV3RG9jKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICAvLyBUaGVyZSdzIG5vdGhpbmcgaW4gdGhlIGJ1ZmZlci4gIFRoaXMgY291bGQgbWVhbiBvbmUgb2YgYSBmZXcgdGhpbmdzLlxuXG4gICAgICAvLyAoYSkgV2UgY291bGQgYmUgaW4gdGhlIG1pZGRsZSBvZiByZS1ydW5uaW5nIHRoZSBxdWVyeSAoc3BlY2lmaWNhbGx5LCB3ZVxuICAgICAgLy8gY291bGQgYmUgaW4gX3B1Ymxpc2hOZXdSZXN1bHRzKS4gSW4gdGhhdCBjYXNlLCBfdW5wdWJsaXNoZWRCdWZmZXIgaXNcbiAgICAgIC8vIGVtcHR5IGJlY2F1c2Ugd2UgY2xlYXIgaXQgYXQgdGhlIGJlZ2lubmluZyBvZiBfcHVibGlzaE5ld1Jlc3VsdHMuIEluXG4gICAgICAvLyB0aGlzIGNhc2UsIG91ciBjYWxsZXIgYWxyZWFkeSBrbm93cyB0aGUgZW50aXJlIGFuc3dlciB0byB0aGUgcXVlcnkgYW5kXG4gICAgICAvLyB3ZSBkb24ndCBuZWVkIHRvIGRvIGFueXRoaW5nIGZhbmN5IGhlcmUuICBKdXN0IHJldHVybi5cbiAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gKGIpIFdlJ3JlIHByZXR0eSBjb25maWRlbnQgdGhhdCB0aGUgdW5pb24gb2YgX3B1Ymxpc2hlZCBhbmRcbiAgICAgIC8vIF91bnB1Ymxpc2hlZEJ1ZmZlciBjb250YWluIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gQmVjYXVzZVxuICAgICAgLy8gX3VucHVibGlzaGVkQnVmZmVyIGlzIGVtcHR5LCB0aGF0IG1lYW5zIHdlJ3JlIGNvbmZpZGVudCB0aGF0IF9wdWJsaXNoZWRcbiAgICAgIC8vIGNvbnRhaW5zIGFsbCBkb2N1bWVudHMgdGhhdCBtYXRjaCBzZWxlY3Rvci4gU28gd2UgaGF2ZSBub3RoaW5nIHRvIGRvLlxuICAgICAgaWYgKHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcilcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyAoYykgTWF5YmUgdGhlcmUgYXJlIG90aGVyIGRvY3VtZW50cyBvdXQgdGhlcmUgdGhhdCBzaG91bGQgYmUgaW4gb3VyXG4gICAgICAvLyBidWZmZXIuIEJ1dCBpbiB0aGF0IGNhc2UsIHdoZW4gd2UgZW1wdGllZCBfdW5wdWJsaXNoZWRCdWZmZXIgaW5cbiAgICAgIC8vIF9yZW1vdmVCdWZmZXJlZCwgd2Ugc2hvdWxkIGhhdmUgY2FsbGVkIF9uZWVkVG9Qb2xsUXVlcnksIHdoaWNoIHdpbGxcbiAgICAgIC8vIGVpdGhlciBwdXQgc29tZXRoaW5nIGluIF91bnB1Ymxpc2hlZEJ1ZmZlciBvciBzZXQgX3NhZmVBcHBlbmRUb0J1ZmZlclxuICAgICAgLy8gKG9yIGJvdGgpLCBhbmQgaXQgd2lsbCBwdXQgdXMgaW4gUVVFUllJTkcgZm9yIHRoYXQgd2hvbGUgdGltZS4gU28gaW5cbiAgICAgIC8vIGZhY3QsIHdlIHNob3VsZG4ndCBiZSBhYmxlIHRvIGdldCBoZXJlLlxuXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJCdWZmZXIgaW5leHBsaWNhYmx5IGVtcHR5XCIpO1xuICAgIH0pO1xuICB9LFxuICBfY2hhbmdlUHVibGlzaGVkOiBmdW5jdGlvbiAoaWQsIG9sZERvYywgbmV3RG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5zZXQoaWQsIHNlbGYuX3NoYXJlZFByb2plY3Rpb25GbihuZXdEb2MpKTtcbiAgICAgIHZhciBwcm9qZWN0ZWROZXcgPSBzZWxmLl9wcm9qZWN0aW9uRm4obmV3RG9jKTtcbiAgICAgIHZhciBwcm9qZWN0ZWRPbGQgPSBzZWxmLl9wcm9qZWN0aW9uRm4ob2xkRG9jKTtcbiAgICAgIHZhciBjaGFuZ2VkID0gRGlmZlNlcXVlbmNlLm1ha2VDaGFuZ2VkRmllbGRzKFxuICAgICAgICBwcm9qZWN0ZWROZXcsIHByb2plY3RlZE9sZCk7XG4gICAgICBpZiAoIV8uaXNFbXB0eShjaGFuZ2VkKSlcbiAgICAgICAgc2VsZi5fbXVsdGlwbGV4ZXIuY2hhbmdlZChpZCwgY2hhbmdlZCk7XG4gICAgfSk7XG4gIH0sXG4gIF9hZGRCdWZmZXJlZDogZnVuY3Rpb24gKGlkLCBkb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2V0KGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4oZG9jKSk7XG5cbiAgICAgIC8vIElmIHNvbWV0aGluZyBpcyBvdmVyZmxvd2luZyB0aGUgYnVmZmVyLCB3ZSBqdXN0IHJlbW92ZSBpdCBmcm9tIGNhY2hlXG4gICAgICBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpID4gc2VsZi5fbGltaXQpIHtcbiAgICAgICAgdmFyIG1heEJ1ZmZlcmVkSWQgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKTtcblxuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUobWF4QnVmZmVyZWRJZCk7XG5cbiAgICAgICAgLy8gU2luY2Ugc29tZXRoaW5nIG1hdGNoaW5nIGlzIHJlbW92ZWQgZnJvbSBjYWNoZSAoYm90aCBwdWJsaXNoZWQgc2V0IGFuZFxuICAgICAgICAvLyBidWZmZXIpLCBzZXQgZmxhZyB0byBmYWxzZVxuICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgLy8gSXMgY2FsbGVkIGVpdGhlciB0byByZW1vdmUgdGhlIGRvYyBjb21wbGV0ZWx5IGZyb20gbWF0Y2hpbmcgc2V0IG9yIHRvIG1vdmVcbiAgLy8gaXQgdG8gdGhlIHB1Ymxpc2hlZCBzZXQgbGF0ZXIuXG4gIF9yZW1vdmVCdWZmZXJlZDogZnVuY3Rpb24gKGlkKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLnJlbW92ZShpZCk7XG4gICAgICAvLyBUbyBrZWVwIHRoZSBjb250cmFjdCBcImJ1ZmZlciBpcyBuZXZlciBlbXB0eSBpbiBTVEVBRFkgcGhhc2UgdW5sZXNzIHRoZVxuICAgICAgLy8gZXZlcnl0aGluZyBtYXRjaGluZyBmaXRzIGludG8gcHVibGlzaGVkXCIgdHJ1ZSwgd2UgcG9sbCBldmVyeXRoaW5nIGFzXG4gICAgICAvLyBzb29uIGFzIHdlIHNlZSB0aGUgYnVmZmVyIGJlY29taW5nIGVtcHR5LlxuICAgICAgaWYgKCEgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmICEgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyKVxuICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICB9KTtcbiAgfSxcbiAgLy8gQ2FsbGVkIHdoZW4gYSBkb2N1bWVudCBoYXMgam9pbmVkIHRoZSBcIk1hdGNoaW5nXCIgcmVzdWx0cyBzZXQuXG4gIC8vIFRha2VzIHJlc3BvbnNpYmlsaXR5IG9mIGtlZXBpbmcgX3VucHVibGlzaGVkQnVmZmVyIGluIHN5bmMgd2l0aCBfcHVibGlzaGVkXG4gIC8vIGFuZCB0aGUgZWZmZWN0IG9mIGxpbWl0IGVuZm9yY2VkLlxuICBfYWRkTWF0Y2hpbmc6IGZ1bmN0aW9uIChkb2MpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIGlkID0gZG9jLl9pZDtcbiAgICAgIGlmIChzZWxmLl9wdWJsaXNoZWQuaGFzKGlkKSlcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJ0cmllZCB0byBhZGQgc29tZXRoaW5nIGFscmVhZHkgcHVibGlzaGVkIFwiICsgaWQpO1xuICAgICAgaWYgKHNlbGYuX2xpbWl0ICYmIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmhhcyhpZCkpXG4gICAgICAgIHRocm93IEVycm9yKFwidHJpZWQgdG8gYWRkIHNvbWV0aGluZyBhbHJlYWR5IGV4aXN0ZWQgaW4gYnVmZmVyIFwiICsgaWQpO1xuXG4gICAgICB2YXIgbGltaXQgPSBzZWxmLl9saW1pdDtcbiAgICAgIHZhciBjb21wYXJhdG9yID0gc2VsZi5fY29tcGFyYXRvcjtcbiAgICAgIHZhciBtYXhQdWJsaXNoZWQgPSAobGltaXQgJiYgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA+IDApID9cbiAgICAgICAgc2VsZi5fcHVibGlzaGVkLmdldChzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCkpIDogbnVsbDtcbiAgICAgIHZhciBtYXhCdWZmZXJlZCA9IChsaW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPiAwKVxuICAgICAgICA/IHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLmdldChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKSlcbiAgICAgICAgOiBudWxsO1xuICAgICAgLy8gVGhlIHF1ZXJ5IGlzIHVubGltaXRlZCBvciBkaWRuJ3QgcHVibGlzaCBlbm91Z2ggZG9jdW1lbnRzIHlldCBvciB0aGVcbiAgICAgIC8vIG5ldyBkb2N1bWVudCB3b3VsZCBmaXQgaW50byBwdWJsaXNoZWQgc2V0IHB1c2hpbmcgdGhlIG1heGltdW0gZWxlbWVudFxuICAgICAgLy8gb3V0LCB0aGVuIHdlIG5lZWQgdG8gcHVibGlzaCB0aGUgZG9jLlxuICAgICAgdmFyIHRvUHVibGlzaCA9ICEgbGltaXQgfHwgc2VsZi5fcHVibGlzaGVkLnNpemUoKSA8IGxpbWl0IHx8XG4gICAgICAgIGNvbXBhcmF0b3IoZG9jLCBtYXhQdWJsaXNoZWQpIDwgMDtcblxuICAgICAgLy8gT3RoZXJ3aXNlIHdlIG1pZ2h0IG5lZWQgdG8gYnVmZmVyIGl0IChvbmx5IGluIGNhc2Ugb2YgbGltaXRlZCBxdWVyeSkuXG4gICAgICAvLyBCdWZmZXJpbmcgaXMgYWxsb3dlZCBpZiB0aGUgYnVmZmVyIGlzIG5vdCBmaWxsZWQgdXAgeWV0IGFuZCBhbGxcbiAgICAgIC8vIG1hdGNoaW5nIGRvY3MgYXJlIGVpdGhlciBpbiB0aGUgcHVibGlzaGVkIHNldCBvciBpbiB0aGUgYnVmZmVyLlxuICAgICAgdmFyIGNhbkFwcGVuZFRvQnVmZmVyID0gIXRvUHVibGlzaCAmJiBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgJiZcbiAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpIDwgbGltaXQ7XG5cbiAgICAgIC8vIE9yIGlmIGl0IGlzIHNtYWxsIGVub3VnaCB0byBiZSBzYWZlbHkgaW5zZXJ0ZWQgdG8gdGhlIG1pZGRsZSBvciB0aGVcbiAgICAgIC8vIGJlZ2lubmluZyBvZiB0aGUgYnVmZmVyLlxuICAgICAgdmFyIGNhbkluc2VydEludG9CdWZmZXIgPSAhdG9QdWJsaXNoICYmIG1heEJ1ZmZlcmVkICYmXG4gICAgICAgIGNvbXBhcmF0b3IoZG9jLCBtYXhCdWZmZXJlZCkgPD0gMDtcblxuICAgICAgdmFyIHRvQnVmZmVyID0gY2FuQXBwZW5kVG9CdWZmZXIgfHwgY2FuSW5zZXJ0SW50b0J1ZmZlcjtcblxuICAgICAgaWYgKHRvUHVibGlzaCkge1xuICAgICAgICBzZWxmLl9hZGRQdWJsaXNoZWQoaWQsIGRvYyk7XG4gICAgICB9IGVsc2UgaWYgKHRvQnVmZmVyKSB7XG4gICAgICAgIHNlbGYuX2FkZEJ1ZmZlcmVkKGlkLCBkb2MpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gZHJvcHBpbmcgaXQgYW5kIG5vdCBzYXZpbmcgdG8gdGhlIGNhY2hlXG4gICAgICAgIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciA9IGZhbHNlO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICAvLyBDYWxsZWQgd2hlbiBhIGRvY3VtZW50IGxlYXZlcyB0aGUgXCJNYXRjaGluZ1wiIHJlc3VsdHMgc2V0LlxuICAvLyBUYWtlcyByZXNwb25zaWJpbGl0eSBvZiBrZWVwaW5nIF91bnB1Ymxpc2hlZEJ1ZmZlciBpbiBzeW5jIHdpdGggX3B1Ymxpc2hlZFxuICAvLyBhbmQgdGhlIGVmZmVjdCBvZiBsaW1pdCBlbmZvcmNlZC5cbiAgX3JlbW92ZU1hdGNoaW5nOiBmdW5jdGlvbiAoaWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKCEgc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkgJiYgISBzZWxmLl9saW1pdClcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJ0cmllZCB0byByZW1vdmUgc29tZXRoaW5nIG1hdGNoaW5nIGJ1dCBub3QgY2FjaGVkIFwiICsgaWQpO1xuXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgIH0gZWxzZSBpZiAoc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuaGFzKGlkKSkge1xuICAgICAgICBzZWxmLl9yZW1vdmVCdWZmZXJlZChpZCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVEb2M6IGZ1bmN0aW9uIChpZCwgbmV3RG9jKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBtYXRjaGVzTm93ID0gbmV3RG9jICYmIHNlbGYuX21hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKG5ld0RvYykucmVzdWx0O1xuXG4gICAgICB2YXIgcHVibGlzaGVkQmVmb3JlID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZCk7XG4gICAgICB2YXIgYnVmZmVyZWRCZWZvcmUgPSBzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpO1xuICAgICAgdmFyIGNhY2hlZEJlZm9yZSA9IHB1Ymxpc2hlZEJlZm9yZSB8fCBidWZmZXJlZEJlZm9yZTtcblxuICAgICAgaWYgKG1hdGNoZXNOb3cgJiYgIWNhY2hlZEJlZm9yZSkge1xuICAgICAgICBzZWxmLl9hZGRNYXRjaGluZyhuZXdEb2MpO1xuICAgICAgfSBlbHNlIGlmIChjYWNoZWRCZWZvcmUgJiYgIW1hdGNoZXNOb3cpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlTWF0Y2hpbmcoaWQpO1xuICAgICAgfSBlbHNlIGlmIChjYWNoZWRCZWZvcmUgJiYgbWF0Y2hlc05vdykge1xuICAgICAgICB2YXIgb2xkRG9jID0gc2VsZi5fcHVibGlzaGVkLmdldChpZCk7XG4gICAgICAgIHZhciBjb21wYXJhdG9yID0gc2VsZi5fY29tcGFyYXRvcjtcbiAgICAgICAgdmFyIG1pbkJ1ZmZlcmVkID0gc2VsZi5fbGltaXQgJiYgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmXG4gICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KHNlbGYuX3VucHVibGlzaGVkQnVmZmVyLm1pbkVsZW1lbnRJZCgpKTtcbiAgICAgICAgdmFyIG1heEJ1ZmZlcmVkO1xuXG4gICAgICAgIGlmIChwdWJsaXNoZWRCZWZvcmUpIHtcbiAgICAgICAgICAvLyBVbmxpbWl0ZWQgY2FzZSB3aGVyZSB0aGUgZG9jdW1lbnQgc3RheXMgaW4gcHVibGlzaGVkIG9uY2UgaXRcbiAgICAgICAgICAvLyBtYXRjaGVzIG9yIHRoZSBjYXNlIHdoZW4gd2UgZG9uJ3QgaGF2ZSBlbm91Z2ggbWF0Y2hpbmcgZG9jcyB0b1xuICAgICAgICAgIC8vIHB1Ymxpc2ggb3IgdGhlIGNoYW5nZWQgYnV0IG1hdGNoaW5nIGRvYyB3aWxsIHN0YXkgaW4gcHVibGlzaGVkXG4gICAgICAgICAgLy8gYW55d2F5cy5cbiAgICAgICAgICAvL1xuICAgICAgICAgIC8vIFhYWDogV2UgcmVseSBvbiB0aGUgZW1wdGluZXNzIG9mIGJ1ZmZlci4gQmUgc3VyZSB0byBtYWludGFpbiB0aGVcbiAgICAgICAgICAvLyBmYWN0IHRoYXQgYnVmZmVyIGNhbid0IGJlIGVtcHR5IGlmIHRoZXJlIGFyZSBtYXRjaGluZyBkb2N1bWVudHMgbm90XG4gICAgICAgICAgLy8gcHVibGlzaGVkLiBOb3RhYmx5LCB3ZSBkb24ndCB3YW50IHRvIHNjaGVkdWxlIHJlcG9sbCBhbmQgY29udGludWVcbiAgICAgICAgICAvLyByZWx5aW5nIG9uIHRoaXMgcHJvcGVydHkuXG4gICAgICAgICAgdmFyIHN0YXlzSW5QdWJsaXNoZWQgPSAhIHNlbGYuX2xpbWl0IHx8XG4gICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkgPT09IDAgfHxcbiAgICAgICAgICAgIGNvbXBhcmF0b3IobmV3RG9jLCBtaW5CdWZmZXJlZCkgPD0gMDtcblxuICAgICAgICAgIGlmIChzdGF5c0luUHVibGlzaGVkKSB7XG4gICAgICAgICAgICBzZWxmLl9jaGFuZ2VQdWJsaXNoZWQoaWQsIG9sZERvYywgbmV3RG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gYWZ0ZXIgdGhlIGNoYW5nZSBkb2MgZG9lc24ndCBzdGF5IGluIHRoZSBwdWJsaXNoZWQsIHJlbW92ZSBpdFxuICAgICAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgICAgICAgIC8vIGJ1dCBpdCBjYW4gbW92ZSBpbnRvIGJ1ZmZlcmVkIG5vdywgY2hlY2sgaXRcbiAgICAgICAgICAgIG1heEJ1ZmZlcmVkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KFxuICAgICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5tYXhFbGVtZW50SWQoKSk7XG5cbiAgICAgICAgICAgIHZhciB0b0J1ZmZlciA9IHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlciB8fFxuICAgICAgICAgICAgICAgICAgKG1heEJ1ZmZlcmVkICYmIGNvbXBhcmF0b3IobmV3RG9jLCBtYXhCdWZmZXJlZCkgPD0gMCk7XG5cbiAgICAgICAgICAgIGlmICh0b0J1ZmZlcikge1xuICAgICAgICAgICAgICBzZWxmLl9hZGRCdWZmZXJlZChpZCwgbmV3RG9jKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIFRocm93IGF3YXkgZnJvbSBib3RoIHB1Ymxpc2hlZCBzZXQgYW5kIGJ1ZmZlclxuICAgICAgICAgICAgICBzZWxmLl9zYWZlQXBwZW5kVG9CdWZmZXIgPSBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSBpZiAoYnVmZmVyZWRCZWZvcmUpIHtcbiAgICAgICAgICBvbGREb2MgPSBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoaWQpO1xuICAgICAgICAgIC8vIHJlbW92ZSB0aGUgb2xkIHZlcnNpb24gbWFudWFsbHkgaW5zdGVhZCBvZiB1c2luZyBfcmVtb3ZlQnVmZmVyZWQgc29cbiAgICAgICAgICAvLyB3ZSBkb24ndCB0cmlnZ2VyIHRoZSBxdWVyeWluZyBpbW1lZGlhdGVseS4gIGlmIHdlIGVuZCB0aGlzIGJsb2NrXG4gICAgICAgICAgLy8gd2l0aCB0aGUgYnVmZmVyIGVtcHR5LCB3ZSB3aWxsIG5lZWQgdG8gdHJpZ2dlciB0aGUgcXVlcnkgcG9sbFxuICAgICAgICAgIC8vIG1hbnVhbGx5IHRvby5cbiAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5yZW1vdmUoaWQpO1xuXG4gICAgICAgICAgdmFyIG1heFB1Ymxpc2hlZCA9IHNlbGYuX3B1Ymxpc2hlZC5nZXQoXG4gICAgICAgICAgICBzZWxmLl9wdWJsaXNoZWQubWF4RWxlbWVudElkKCkpO1xuICAgICAgICAgIG1heEJ1ZmZlcmVkID0gc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuc2l6ZSgpICYmXG4gICAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIuZ2V0KFxuICAgICAgICAgICAgICAgICAgc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIubWF4RWxlbWVudElkKCkpO1xuXG4gICAgICAgICAgLy8gdGhlIGJ1ZmZlcmVkIGRvYyB3YXMgdXBkYXRlZCwgaXQgY291bGQgbW92ZSB0byBwdWJsaXNoZWRcbiAgICAgICAgICB2YXIgdG9QdWJsaXNoID0gY29tcGFyYXRvcihuZXdEb2MsIG1heFB1Ymxpc2hlZCkgPCAwO1xuXG4gICAgICAgICAgLy8gb3Igc3RheXMgaW4gYnVmZmVyIGV2ZW4gYWZ0ZXIgdGhlIGNoYW5nZVxuICAgICAgICAgIHZhciBzdGF5c0luQnVmZmVyID0gKCEgdG9QdWJsaXNoICYmIHNlbGYuX3NhZmVBcHBlbmRUb0J1ZmZlcikgfHxcbiAgICAgICAgICAgICAgICAoIXRvUHVibGlzaCAmJiBtYXhCdWZmZXJlZCAmJlxuICAgICAgICAgICAgICAgICBjb21wYXJhdG9yKG5ld0RvYywgbWF4QnVmZmVyZWQpIDw9IDApO1xuXG4gICAgICAgICAgaWYgKHRvUHVibGlzaCkge1xuICAgICAgICAgICAgc2VsZi5fYWRkUHVibGlzaGVkKGlkLCBuZXdEb2MpO1xuICAgICAgICAgIH0gZWxzZSBpZiAoc3RheXNJbkJ1ZmZlcikge1xuICAgICAgICAgICAgLy8gc3RheXMgaW4gYnVmZmVyIGJ1dCBjaGFuZ2VzXG4gICAgICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zZXQoaWQsIG5ld0RvYyk7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vIFRocm93IGF3YXkgZnJvbSBib3RoIHB1Ymxpc2hlZCBzZXQgYW5kIGJ1ZmZlclxuICAgICAgICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gZmFsc2U7XG4gICAgICAgICAgICAvLyBOb3JtYWxseSB0aGlzIGNoZWNrIHdvdWxkIGhhdmUgYmVlbiBkb25lIGluIF9yZW1vdmVCdWZmZXJlZCBidXRcbiAgICAgICAgICAgIC8vIHdlIGRpZG4ndCB1c2UgaXQsIHNvIHdlIG5lZWQgdG8gZG8gaXQgb3Vyc2VsZiBub3cuXG4gICAgICAgICAgICBpZiAoISBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5zaXplKCkpIHtcbiAgICAgICAgICAgICAgc2VsZi5fbmVlZFRvUG9sbFF1ZXJ5KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImNhY2hlZEJlZm9yZSBpbXBsaWVzIGVpdGhlciBvZiBwdWJsaXNoZWRCZWZvcmUgb3IgYnVmZmVyZWRCZWZvcmUgaXMgdHJ1ZS5cIik7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcbiAgfSxcbiAgX2ZldGNoTW9kaWZpZWREb2N1bWVudHM6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5GRVRDSElORyk7XG4gICAgLy8gRGVmZXIsIGJlY2F1c2Ugbm90aGluZyBjYWxsZWQgZnJvbSB0aGUgb3Bsb2cgZW50cnkgaGFuZGxlciBtYXkgeWllbGQsXG4gICAgLy8gYnV0IGZldGNoKCkgeWllbGRzLlxuICAgIE1ldGVvci5kZWZlcihmaW5pc2hJZk5lZWRUb1BvbGxRdWVyeShhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICB3aGlsZSAoIXNlbGYuX3N0b3BwZWQgJiYgIXNlbGYuX25lZWRUb0ZldGNoLmVtcHR5KCkpIHtcbiAgICAgICAgaWYgKHNlbGYuX3BoYXNlID09PSBQSEFTRS5RVUVSWUlORykge1xuICAgICAgICAgIC8vIFdoaWxlIGZldGNoaW5nLCB3ZSBkZWNpZGVkIHRvIGdvIGludG8gUVVFUllJTkcgbW9kZSwgYW5kIHRoZW4gd2VcbiAgICAgICAgICAvLyBzYXcgYW5vdGhlciBvcGxvZyBlbnRyeSwgc28gX25lZWRUb0ZldGNoIGlzIG5vdCBlbXB0eS4gQnV0IHdlXG4gICAgICAgICAgLy8gc2hvdWxkbid0IGZldGNoIHRoZXNlIGRvY3VtZW50cyB1bnRpbCBBRlRFUiB0aGUgcXVlcnkgaXMgZG9uZS5cbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEJlaW5nIGluIHN0ZWFkeSBwaGFzZSBoZXJlIHdvdWxkIGJlIHN1cnByaXNpbmcuXG4gICAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuRkVUQ0hJTkcpXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwicGhhc2UgaW4gZmV0Y2hNb2RpZmllZERvY3VtZW50czogXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICAgICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBzZWxmLl9uZWVkVG9GZXRjaDtcbiAgICAgICAgdmFyIHRoaXNHZW5lcmF0aW9uID0gKytzZWxmLl9mZXRjaEdlbmVyYXRpb247XG4gICAgICAgIHNlbGYuX25lZWRUb0ZldGNoID0gbmV3IExvY2FsQ29sbGVjdGlvbi5fSWRNYXA7XG4gICAgICAgIHZhciB3YWl0aW5nID0gMDtcblxuICAgICAgICBsZXQgcHJvbWlzZVJlc29sdmVyID0gbnVsbDtcbiAgICAgICAgY29uc3QgYXdhaXRhYmxlUHJvbWlzZSA9IG5ldyBQcm9taXNlKHIgPT4gcHJvbWlzZVJlc29sdmVyID0gcik7XG4gICAgICAgIC8vIFRoaXMgbG9vcCBpcyBzYWZlLCBiZWNhdXNlIF9jdXJyZW50bHlGZXRjaGluZyB3aWxsIG5vdCBiZSB1cGRhdGVkXG4gICAgICAgIC8vIGR1cmluZyB0aGlzIGxvb3AgKGluIGZhY3QsIGl0IGlzIG5ldmVyIG11dGF0ZWQpLlxuICAgICAgICBhd2FpdCBzZWxmLl9jdXJyZW50bHlGZXRjaGluZy5mb3JFYWNoQXN5bmMoYXN5bmMgZnVuY3Rpb24gKG9wLCBpZCkge1xuICAgICAgICAgIHdhaXRpbmcrKztcbiAgICAgICAgICBhd2FpdCBzZWxmLl9tb25nb0hhbmRsZS5fZG9jRmV0Y2hlci5mZXRjaChcbiAgICAgICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICAgICAgaWQsXG4gICAgICAgICAgICBvcCxcbiAgICAgICAgICAgIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5KGZ1bmN0aW9uKGVyciwgZG9jKSB7XG4gICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICBNZXRlb3IuX2RlYnVnKCdHb3QgZXhjZXB0aW9uIHdoaWxlIGZldGNoaW5nIGRvY3VtZW50cycsIGVycik7XG4gICAgICAgICAgICAgICAgLy8gSWYgd2UgZ2V0IGFuIGVycm9yIGZyb20gdGhlIGZldGNoZXIgKGVnLCB0cm91YmxlXG4gICAgICAgICAgICAgICAgLy8gY29ubmVjdGluZyB0byBNb25nbyksIGxldCdzIGp1c3QgYWJhbmRvbiB0aGUgZmV0Y2ggcGhhc2VcbiAgICAgICAgICAgICAgICAvLyBhbHRvZ2V0aGVyIGFuZCBmYWxsIGJhY2sgdG8gcG9sbGluZy4gSXQncyBub3QgbGlrZSB3ZSdyZVxuICAgICAgICAgICAgICAgIC8vIGdldHRpbmcgbGl2ZSB1cGRhdGVzIGFueXdheS5cbiAgICAgICAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKSB7XG4gICAgICAgICAgICAgICAgICBzZWxmLl9uZWVkVG9Qb2xsUXVlcnkoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgd2FpdGluZy0tO1xuICAgICAgICAgICAgICAgIC8vIEJlY2F1c2UgZmV0Y2goKSBuZXZlciBjYWxscyBpdHMgY2FsbGJhY2sgc3luY2hyb25vdXNseSxcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIHNhZmUgKGllLCB3ZSB3b24ndCBjYWxsIGZ1dC5yZXR1cm4oKSBiZWZvcmUgdGhlXG4gICAgICAgICAgICAgICAgLy8gZm9yRWFjaCBpcyBkb25lKS5cbiAgICAgICAgICAgICAgICBpZiAod2FpdGluZyA9PT0gMCkgcHJvbWlzZVJlc29sdmVyKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgICAhc2VsZi5fc3RvcHBlZCAmJlxuICAgICAgICAgICAgICAgICAgc2VsZi5fcGhhc2UgPT09IFBIQVNFLkZFVENISU5HICYmXG4gICAgICAgICAgICAgICAgICBzZWxmLl9mZXRjaEdlbmVyYXRpb24gPT09IHRoaXNHZW5lcmF0aW9uXG4gICAgICAgICAgICAgICAgKSB7XG4gICAgICAgICAgICAgICAgICAvLyBXZSByZS1jaGVjayB0aGUgZ2VuZXJhdGlvbiBpbiBjYXNlIHdlJ3ZlIGhhZCBhbiBleHBsaWNpdFxuICAgICAgICAgICAgICAgICAgLy8gX3BvbGxRdWVyeSBjYWxsIChlZywgaW4gYW5vdGhlciBmaWJlcikgd2hpY2ggc2hvdWxkXG4gICAgICAgICAgICAgICAgICAvLyBlZmZlY3RpdmVseSBjYW5jZWwgdGhpcyByb3VuZCBvZiBmZXRjaGVzLiAgKF9wb2xsUXVlcnlcbiAgICAgICAgICAgICAgICAgIC8vIGluY3JlbWVudHMgdGhlIGdlbmVyYXRpb24uKVxuXG4gICAgICAgICAgICAgICAgICBzZWxmLl9oYW5kbGVEb2MoaWQsIGRvYyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9IGZpbmFsbHkge1xuICAgICAgICAgICAgICAgIHdhaXRpbmctLTtcbiAgICAgICAgICAgICAgICAvLyBCZWNhdXNlIGZldGNoKCkgbmV2ZXIgY2FsbHMgaXRzIGNhbGxiYWNrIHN5bmNocm9ub3VzbHksXG4gICAgICAgICAgICAgICAgLy8gdGhpcyBpcyBzYWZlIChpZSwgd2Ugd29uJ3QgY2FsbCBmdXQucmV0dXJuKCkgYmVmb3JlIHRoZVxuICAgICAgICAgICAgICAgIC8vIGZvckVhY2ggaXMgZG9uZSkuXG4gICAgICAgICAgICAgICAgaWYgKHdhaXRpbmcgPT09IDApIHByb21pc2VSZXNvbHZlcigpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICk7XG4gICAgICAgIH0pO1xuICAgICAgICBhd2FpdCBhd2FpdGFibGVQcm9taXNlO1xuICAgICAgICAvLyBFeGl0IG5vdyBpZiB3ZSd2ZSBoYWQgYSBfcG9sbFF1ZXJ5IGNhbGwgKGhlcmUgb3IgaW4gYW5vdGhlciBmaWJlcikuXG4gICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICBzZWxmLl9jdXJyZW50bHlGZXRjaGluZyA9IG51bGw7XG4gICAgICB9XG4gICAgICAvLyBXZSdyZSBkb25lIGZldGNoaW5nLCBzbyB3ZSBjYW4gYmUgc3RlYWR5LCB1bmxlc3Mgd2UndmUgaGFkIGFcbiAgICAgIC8vIF9wb2xsUXVlcnkgY2FsbCAoaGVyZSBvciBpbiBhbm90aGVyIGZpYmVyKS5cbiAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpXG4gICAgICAgIGF3YWl0IHNlbGYuX2JlU3RlYWR5KCk7XG4gICAgfSkpO1xuICB9LFxuICBfYmVTdGVhZHk6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5TVEVBRFkpO1xuICAgIHZhciB3cml0ZXMgPSBzZWxmLl93cml0ZXNUb0NvbW1pdFdoZW5XZVJlYWNoU3RlYWR5IHx8IFtdO1xuICAgIHNlbGYuX3dyaXRlc1RvQ29tbWl0V2hlbldlUmVhY2hTdGVhZHkgPSBbXTtcbiAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5vbkZsdXNoKGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGZvciAoY29uc3QgdyBvZiB3cml0ZXMpIHtcbiAgICAgICAgICBhd2FpdCB3LmNvbW1pdHRlZCgpO1xuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJfYmVTdGVhZHkgZXJyb3JcIiwge3dyaXRlc30sIGUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuICBfaGFuZGxlT3Bsb2dFbnRyeVF1ZXJ5aW5nOiBmdW5jdGlvbiAob3ApIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2guc2V0KGlkRm9yT3Aob3ApLCBvcCk7XG4gICAgfSk7XG4gIH0sXG4gIF9oYW5kbGVPcGxvZ0VudHJ5U3RlYWR5T3JGZXRjaGluZzogZnVuY3Rpb24gKG9wKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcbiAgICAgIHZhciBpZCA9IGlkRm9yT3Aob3ApO1xuICAgICAgLy8gSWYgd2UncmUgYWxyZWFkeSBmZXRjaGluZyB0aGlzIG9uZSwgb3IgYWJvdXQgdG8sIHdlIGNhbid0IG9wdGltaXplO1xuICAgICAgLy8gbWFrZSBzdXJlIHRoYXQgd2UgZmV0Y2ggaXQgYWdhaW4gaWYgbmVjZXNzYXJ5LlxuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLkZFVENISU5HICYmXG4gICAgICAgICAgKChzZWxmLl9jdXJyZW50bHlGZXRjaGluZyAmJiBzZWxmLl9jdXJyZW50bHlGZXRjaGluZy5oYXMoaWQpKSB8fFxuICAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5oYXMoaWQpKSkge1xuICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuXG4gICAgICBpZiAob3Aub3AgPT09ICdkJykge1xuICAgICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLmhhcyhpZCkgfHxcbiAgICAgICAgICAgIChzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKSlcbiAgICAgICAgICBzZWxmLl9yZW1vdmVNYXRjaGluZyhpZCk7XG4gICAgICB9IGVsc2UgaWYgKG9wLm9wID09PSAnaScpIHtcbiAgICAgICAgaWYgKHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImluc2VydCBmb3VuZCBmb3IgYWxyZWFkeS1leGlzdGluZyBJRCBpbiBwdWJsaXNoZWRcIik7XG4gICAgICAgIGlmIChzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlciAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcImluc2VydCBmb3VuZCBmb3IgYWxyZWFkeS1leGlzdGluZyBJRCBpbiBidWZmZXJcIik7XG5cbiAgICAgICAgLy8gWFhYIHdoYXQgaWYgc2VsZWN0b3IgeWllbGRzPyAgZm9yIG5vdyBpdCBjYW4ndCBidXQgbGF0ZXIgaXQgY291bGRcbiAgICAgICAgLy8gaGF2ZSAkd2hlcmVcbiAgICAgICAgaWYgKHNlbGYuX21hdGNoZXIuZG9jdW1lbnRNYXRjaGVzKG9wLm8pLnJlc3VsdClcbiAgICAgICAgICBzZWxmLl9hZGRNYXRjaGluZyhvcC5vKTtcbiAgICAgIH0gZWxzZSBpZiAob3Aub3AgPT09ICd1Jykge1xuICAgICAgICAvLyB3ZSBhcmUgbWFwcGluZyB0aGUgbmV3IG9wbG9nIGZvcm1hdCBvbiBtb25nbyA1XG4gICAgICAgIC8vIHRvIHdoYXQgd2Uga25vdyBiZXR0ZXIsICRzZXRcbiAgICAgICAgb3AubyA9IG9wbG9nVjJWMUNvbnZlcnRlcihvcC5vKVxuICAgICAgICAvLyBJcyB0aGlzIGEgbW9kaWZpZXIgKCRzZXQvJHVuc2V0LCB3aGljaCBtYXkgcmVxdWlyZSB1cyB0byBwb2xsIHRoZVxuICAgICAgICAvLyBkYXRhYmFzZSB0byBmaWd1cmUgb3V0IGlmIHRoZSB3aG9sZSBkb2N1bWVudCBtYXRjaGVzIHRoZSBzZWxlY3Rvcikgb3JcbiAgICAgICAgLy8gYSByZXBsYWNlbWVudCAoaW4gd2hpY2ggY2FzZSB3ZSBjYW4ganVzdCBkaXJlY3RseSByZS1ldmFsdWF0ZSB0aGVcbiAgICAgICAgLy8gc2VsZWN0b3IpP1xuICAgICAgICAvLyBvcGxvZyBmb3JtYXQgaGFzIGNoYW5nZWQgb24gbW9uZ29kYiA1LCB3ZSBoYXZlIHRvIHN1cHBvcnQgYm90aCBub3dcbiAgICAgICAgLy8gZGlmZiBpcyB0aGUgZm9ybWF0IGluIE1vbmdvIDUrIChvcGxvZyB2MilcbiAgICAgICAgdmFyIGlzUmVwbGFjZSA9ICFfLmhhcyhvcC5vLCAnJHNldCcpICYmICFfLmhhcyhvcC5vLCAnZGlmZicpICYmICFfLmhhcyhvcC5vLCAnJHVuc2V0Jyk7XG4gICAgICAgIC8vIElmIHRoaXMgbW9kaWZpZXIgbW9kaWZpZXMgc29tZXRoaW5nIGluc2lkZSBhbiBFSlNPTiBjdXN0b20gdHlwZSAoaWUsXG4gICAgICAgIC8vIGFueXRoaW5nIHdpdGggRUpTT04kKSwgdGhlbiB3ZSBjYW4ndCB0cnkgdG8gdXNlXG4gICAgICAgIC8vIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5LCBzaW5jZSB0aGF0IGp1c3QgbXV0YXRlcyB0aGUgRUpTT04gZW5jb2RpbmcsXG4gICAgICAgIC8vIG5vdCB0aGUgYWN0dWFsIG9iamVjdC5cbiAgICAgICAgdmFyIGNhbkRpcmVjdGx5TW9kaWZ5RG9jID1cbiAgICAgICAgICAhaXNSZXBsYWNlICYmIG1vZGlmaWVyQ2FuQmVEaXJlY3RseUFwcGxpZWQob3Aubyk7XG5cbiAgICAgICAgdmFyIHB1Ymxpc2hlZEJlZm9yZSA9IHNlbGYuX3B1Ymxpc2hlZC5oYXMoaWQpO1xuICAgICAgICB2YXIgYnVmZmVyZWRCZWZvcmUgPSBzZWxmLl9saW1pdCAmJiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5oYXMoaWQpO1xuXG4gICAgICAgIGlmIChpc1JlcGxhY2UpIHtcbiAgICAgICAgICBzZWxmLl9oYW5kbGVEb2MoaWQsIF8uZXh0ZW5kKHtfaWQ6IGlkfSwgb3AubykpO1xuICAgICAgICB9IGVsc2UgaWYgKChwdWJsaXNoZWRCZWZvcmUgfHwgYnVmZmVyZWRCZWZvcmUpICYmXG4gICAgICAgICAgICAgICAgICAgY2FuRGlyZWN0bHlNb2RpZnlEb2MpIHtcbiAgICAgICAgICAvLyBPaCBncmVhdCwgd2UgYWN0dWFsbHkga25vdyB3aGF0IHRoZSBkb2N1bWVudCBpcywgc28gd2UgY2FuIGFwcGx5XG4gICAgICAgICAgLy8gdGhpcyBkaXJlY3RseS5cbiAgICAgICAgICB2YXIgbmV3RG9jID0gc2VsZi5fcHVibGlzaGVkLmhhcyhpZClcbiAgICAgICAgICAgID8gc2VsZi5fcHVibGlzaGVkLmdldChpZCkgOiBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5nZXQoaWQpO1xuICAgICAgICAgIG5ld0RvYyA9IEVKU09OLmNsb25lKG5ld0RvYyk7XG5cbiAgICAgICAgICBuZXdEb2MuX2lkID0gaWQ7XG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIExvY2FsQ29sbGVjdGlvbi5fbW9kaWZ5KG5ld0RvYywgb3Aubyk7XG4gICAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgaWYgKGUubmFtZSAhPT0gXCJNaW5pbW9uZ29FcnJvclwiKVxuICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgLy8gV2UgZGlkbid0IHVuZGVyc3RhbmQgdGhlIG1vZGlmaWVyLiAgUmUtZmV0Y2guXG4gICAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICAgIGlmIChzZWxmLl9waGFzZSA9PT0gUEhBU0UuU1RFQURZKSB7XG4gICAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2VsZi5faGFuZGxlRG9jKGlkLCBzZWxmLl9zaGFyZWRQcm9qZWN0aW9uRm4obmV3RG9jKSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIWNhbkRpcmVjdGx5TW9kaWZ5RG9jIHx8XG4gICAgICAgICAgICAgICAgICAgc2VsZi5fbWF0Y2hlci5jYW5CZWNvbWVUcnVlQnlNb2RpZmllcihvcC5vKSB8fFxuICAgICAgICAgICAgICAgICAgIChzZWxmLl9zb3J0ZXIgJiYgc2VsZi5fc29ydGVyLmFmZmVjdGVkQnlNb2RpZmllcihvcC5vKSkpIHtcbiAgICAgICAgICBzZWxmLl9uZWVkVG9GZXRjaC5zZXQoaWQsIG9wKTtcbiAgICAgICAgICBpZiAoc2VsZi5fcGhhc2UgPT09IFBIQVNFLlNURUFEWSlcbiAgICAgICAgICAgIHNlbGYuX2ZldGNoTW9kaWZpZWREb2N1bWVudHMoKTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoXCJYWFggU1VSUFJJU0lORyBPUEVSQVRJT046IFwiICsgb3ApO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jIF9ydW5Jbml0aWFsUXVlcnlBc3luYygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJvcGxvZyBzdG9wcGVkIHN1cnByaXNpbmdseSBlYXJseVwiKTtcblxuICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KHtpbml0aWFsOiB0cnVlfSk7ICAvLyB5aWVsZHNcblxuICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgcmV0dXJuOyAgLy8gY2FuIGhhcHBlbiBvbiBxdWVyeUVycm9yXG5cbiAgICAvLyBBbGxvdyBvYnNlcnZlQ2hhbmdlcyBjYWxscyB0byByZXR1cm4uIChBZnRlciB0aGlzLCBpdCdzIHBvc3NpYmxlIGZvclxuICAgIC8vIHN0b3AoKSB0byBiZSBjYWxsZWQuKVxuICAgIGF3YWl0IHNlbGYuX211bHRpcGxleGVyLnJlYWR5KCk7XG5cbiAgICBhd2FpdCBzZWxmLl9kb25lUXVlcnlpbmcoKTsgIC8vIHlpZWxkc1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1bkluaXRpYWxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLl9ydW5Jbml0aWFsUXVlcnlBc3luYygpO1xuICB9LFxuXG4gIC8vIEluIHZhcmlvdXMgY2lyY3Vtc3RhbmNlcywgd2UgbWF5IGp1c3Qgd2FudCB0byBzdG9wIHByb2Nlc3NpbmcgdGhlIG9wbG9nIGFuZFxuICAvLyByZS1ydW4gdGhlIGluaXRpYWwgcXVlcnksIGp1c3QgYXMgaWYgd2Ugd2VyZSBhIFBvbGxpbmdPYnNlcnZlRHJpdmVyLlxuICAvL1xuICAvLyBUaGlzIGZ1bmN0aW9uIG1heSBub3QgYmxvY2ssIGJlY2F1c2UgaXQgaXMgY2FsbGVkIGZyb20gYW4gb3Bsb2cgZW50cnlcbiAgLy8gaGFuZGxlci5cbiAgLy9cbiAgLy8gWFhYIFdlIHNob3VsZCBjYWxsIHRoaXMgd2hlbiB3ZSBkZXRlY3QgdGhhdCB3ZSd2ZSBiZWVuIGluIEZFVENISU5HIGZvciBcInRvb1xuICAvLyBsb25nXCIuXG4gIC8vXG4gIC8vIFhYWCBXZSBzaG91bGQgY2FsbCB0aGlzIHdoZW4gd2UgZGV0ZWN0IE1vbmdvIGZhaWxvdmVyIChzaW5jZSB0aGF0IG1pZ2h0XG4gIC8vIG1lYW4gdGhhdCBzb21lIG9mIHRoZSBvcGxvZyBlbnRyaWVzIHdlIGhhdmUgcHJvY2Vzc2VkIGhhdmUgYmVlbiByb2xsZWRcbiAgLy8gYmFjaykuIFRoZSBOb2RlIE1vbmdvIGRyaXZlciBpcyBpbiB0aGUgbWlkZGxlIG9mIGEgYnVuY2ggb2YgaHVnZVxuICAvLyByZWZhY3RvcmluZ3MsIGluY2x1ZGluZyB0aGUgd2F5IHRoYXQgaXQgbm90aWZpZXMgeW91IHdoZW4gcHJpbWFyeVxuICAvLyBjaGFuZ2VzLiBXaWxsIHB1dCBvZmYgaW1wbGVtZW50aW5nIHRoaXMgdW50aWwgZHJpdmVyIDEuNCBpcyBvdXQuXG4gIF9wb2xsUXVlcnk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICAgIHJldHVybjtcblxuICAgICAgLy8gWWF5LCB3ZSBnZXQgdG8gZm9yZ2V0IGFib3V0IGFsbCB0aGUgdGhpbmdzIHdlIHRob3VnaHQgd2UgaGFkIHRvIGZldGNoLlxuICAgICAgc2VsZi5fbmVlZFRvRmV0Y2ggPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIHNlbGYuX2N1cnJlbnRseUZldGNoaW5nID0gbnVsbDtcbiAgICAgICsrc2VsZi5fZmV0Y2hHZW5lcmF0aW9uOyAgLy8gaWdub3JlIGFueSBpbi1mbGlnaHQgZmV0Y2hlc1xuICAgICAgc2VsZi5fcmVnaXN0ZXJQaGFzZUNoYW5nZShQSEFTRS5RVUVSWUlORyk7XG5cbiAgICAgIC8vIERlZmVyIHNvIHRoYXQgd2UgZG9uJ3QgeWllbGQuICBXZSBkb24ndCBuZWVkIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5XG4gICAgICAvLyBoZXJlIGJlY2F1c2UgU3dpdGNoZWRUb1F1ZXJ5IGlzIG5vdCB0aHJvd24gaW4gUVVFUllJTkcgbW9kZS5cbiAgICAgIE1ldGVvci5kZWZlcihhc3luYyBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX3J1blF1ZXJ5KCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2RvbmVRdWVyeWluZygpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0sXG5cbiAgLy8gWWllbGRzIVxuICBhc3luYyBfcnVuUXVlcnlBc3luYyhvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuICAgIHZhciBuZXdSZXN1bHRzLCBuZXdCdWZmZXI7XG5cbiAgICAvLyBUaGlzIHdoaWxlIGxvb3AgaXMganVzdCB0byByZXRyeSBmYWlsdXJlcy5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgLy8gSWYgd2UndmUgYmVlbiBzdG9wcGVkLCB3ZSBkb24ndCBoYXZlIHRvIHJ1biBhbnl0aGluZyBhbnkgbW9yZS5cbiAgICAgIGlmIChzZWxmLl9zdG9wcGVkKVxuICAgICAgICByZXR1cm47XG5cbiAgICAgIG5ld1Jlc3VsdHMgPSBuZXcgTG9jYWxDb2xsZWN0aW9uLl9JZE1hcDtcbiAgICAgIG5ld0J1ZmZlciA9IG5ldyBMb2NhbENvbGxlY3Rpb24uX0lkTWFwO1xuXG4gICAgICAvLyBRdWVyeSAyeCBkb2N1bWVudHMgYXMgdGhlIGhhbGYgZXhjbHVkZWQgZnJvbSB0aGUgb3JpZ2luYWwgcXVlcnkgd2lsbCBnb1xuICAgICAgLy8gaW50byB1bnB1Ymxpc2hlZCBidWZmZXIgdG8gcmVkdWNlIGFkZGl0aW9uYWwgTW9uZ28gbG9va3VwcyBpbiBjYXNlc1xuICAgICAgLy8gd2hlbiBkb2N1bWVudHMgYXJlIHJlbW92ZWQgZnJvbSB0aGUgcHVibGlzaGVkIHNldCBhbmQgbmVlZCBhXG4gICAgICAvLyByZXBsYWNlbWVudC5cbiAgICAgIC8vIFhYWCBuZWVkcyBtb3JlIHRob3VnaHQgb24gbm9uLXplcm8gc2tpcFxuICAgICAgLy8gWFhYIDIgaXMgYSBcIm1hZ2ljIG51bWJlclwiIG1lYW5pbmcgdGhlcmUgaXMgYW4gZXh0cmEgY2h1bmsgb2YgZG9jcyBmb3JcbiAgICAgIC8vIGJ1ZmZlciBpZiBzdWNoIGlzIG5lZWRlZC5cbiAgICAgIHZhciBjdXJzb3IgPSBzZWxmLl9jdXJzb3JGb3JRdWVyeSh7IGxpbWl0OiBzZWxmLl9saW1pdCAqIDIgfSk7XG4gICAgICB0cnkge1xuICAgICAgICBhd2FpdCBjdXJzb3IuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpKSB7ICAvLyB5aWVsZHNcbiAgICAgICAgICBpZiAoIXNlbGYuX2xpbWl0IHx8IGkgPCBzZWxmLl9saW1pdCkge1xuICAgICAgICAgICAgbmV3UmVzdWx0cy5zZXQoZG9jLl9pZCwgZG9jKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbmV3QnVmZmVyLnNldChkb2MuX2lkLCBkb2MpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAob3B0aW9ucy5pbml0aWFsICYmIHR5cGVvZihlLmNvZGUpID09PSAnbnVtYmVyJykge1xuICAgICAgICAgIC8vIFRoaXMgaXMgYW4gZXJyb3IgZG9jdW1lbnQgc2VudCB0byB1cyBieSBtb25nb2QsIG5vdCBhIGNvbm5lY3Rpb25cbiAgICAgICAgICAvLyBlcnJvciBnZW5lcmF0ZWQgYnkgdGhlIGNsaWVudC4gQW5kIHdlJ3ZlIG5ldmVyIHNlZW4gdGhpcyBxdWVyeSB3b3JrXG4gICAgICAgICAgLy8gc3VjY2Vzc2Z1bGx5LiBQcm9iYWJseSBpdCdzIGEgYmFkIHNlbGVjdG9yIG9yIHNvbWV0aGluZywgc28gd2VcbiAgICAgICAgICAvLyBzaG91bGQgTk9UIHJldHJ5LiBJbnN0ZWFkLCB3ZSBzaG91bGQgaGFsdCB0aGUgb2JzZXJ2ZSAod2hpY2ggZW5kc1xuICAgICAgICAgIC8vIHVwIGNhbGxpbmcgYHN0b3BgIG9uIHVzKS5cbiAgICAgICAgICBhd2FpdCBzZWxmLl9tdWx0aXBsZXhlci5xdWVyeUVycm9yKGUpO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIER1cmluZyBmYWlsb3ZlciAoZWcpIGlmIHdlIGdldCBhbiBleGNlcHRpb24gd2Ugc2hvdWxkIGxvZyBhbmQgcmV0cnlcbiAgICAgICAgLy8gaW5zdGVhZCBvZiBjcmFzaGluZy5cbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZyhcIkdvdCBleGNlcHRpb24gd2hpbGUgcG9sbGluZyBxdWVyeVwiLCBlKTtcbiAgICAgICAgYXdhaXQgTWV0ZW9yLl9zbGVlcEZvck1zKDEwMCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBzZWxmLl9wdWJsaXNoTmV3UmVzdWx0cyhuZXdSZXN1bHRzLCBuZXdCdWZmZXIpO1xuICB9LFxuXG4gIC8vIFlpZWxkcyFcbiAgX3J1blF1ZXJ5OiBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIHJldHVybiB0aGlzLl9ydW5RdWVyeUFzeW5jKG9wdGlvbnMpO1xuICB9LFxuXG4gIC8vIFRyYW5zaXRpb25zIHRvIFFVRVJZSU5HIGFuZCBydW5zIGFub3RoZXIgcXVlcnksIG9yIChpZiBhbHJlYWR5IGluIFFVRVJZSU5HKVxuICAvLyBlbnN1cmVzIHRoYXQgd2Ugd2lsbCBxdWVyeSBhZ2FpbiBsYXRlci5cbiAgLy9cbiAgLy8gVGhpcyBmdW5jdGlvbiBtYXkgbm90IGJsb2NrLCBiZWNhdXNlIGl0IGlzIGNhbGxlZCBmcm9tIGFuIG9wbG9nIGVudHJ5XG4gIC8vIGhhbmRsZXIuIEhvd2V2ZXIsIGlmIHdlIHdlcmUgbm90IGFscmVhZHkgaW4gdGhlIFFVRVJZSU5HIHBoYXNlLCBpdCB0aHJvd3NcbiAgLy8gYW4gZXhjZXB0aW9uIHRoYXQgaXMgY2F1Z2h0IGJ5IHRoZSBjbG9zZXN0IHN1cnJvdW5kaW5nXG4gIC8vIGZpbmlzaElmTmVlZFRvUG9sbFF1ZXJ5IGNhbGw7IHRoaXMgZW5zdXJlcyB0aGF0IHdlIGRvbid0IGNvbnRpbnVlIHJ1bm5pbmdcbiAgLy8gY2xvc2UgdGhhdCB3YXMgZGVzaWduZWQgZm9yIGFub3RoZXIgcGhhc2UgaW5zaWRlIFBIQVNFLlFVRVJZSU5HLlxuICAvL1xuICAvLyAoSXQncyBhbHNvIG5lY2Vzc2FyeSB3aGVuZXZlciBsb2dpYyBpbiB0aGlzIGZpbGUgeWllbGRzIHRvIGNoZWNrIHRoYXQgb3RoZXJcbiAgLy8gcGhhc2VzIGhhdmVuJ3QgcHV0IHVzIGludG8gUVVFUllJTkcgbW9kZSwgdGhvdWdoOyBlZyxcbiAgLy8gX2ZldGNoTW9kaWZpZWREb2N1bWVudHMgZG9lcyB0aGlzLilcbiAgX25lZWRUb1BvbGxRdWVyeTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgICAgcmV0dXJuO1xuXG4gICAgICAvLyBJZiB3ZSdyZSBub3QgYWxyZWFkeSBpbiB0aGUgbWlkZGxlIG9mIGEgcXVlcnksIHdlIGNhbiBxdWVyeSBub3dcbiAgICAgIC8vIChwb3NzaWJseSBwYXVzaW5nIEZFVENISU5HKS5cbiAgICAgIGlmIChzZWxmLl9waGFzZSAhPT0gUEhBU0UuUVVFUllJTkcpIHtcbiAgICAgICAgc2VsZi5fcG9sbFF1ZXJ5KCk7XG4gICAgICAgIHRocm93IG5ldyBTd2l0Y2hlZFRvUXVlcnk7XG4gICAgICB9XG5cbiAgICAgIC8vIFdlJ3JlIGN1cnJlbnRseSBpbiBRVUVSWUlORy4gU2V0IGEgZmxhZyB0byBlbnN1cmUgdGhhdCB3ZSBydW4gYW5vdGhlclxuICAgICAgLy8gcXVlcnkgd2hlbiB3ZSdyZSBkb25lLlxuICAgICAgc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5ID0gdHJ1ZTtcbiAgICB9KTtcbiAgfSxcblxuICAvLyBZaWVsZHMhXG4gIF9kb25lUXVlcnlpbmc6IGFzeW5jIGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICBpZiAoc2VsZi5fc3RvcHBlZClcbiAgICAgIHJldHVybjtcblxuICAgIGF3YWl0IHNlbGYuX21vbmdvSGFuZGxlLl9vcGxvZ0hhbmRsZS53YWl0VW50aWxDYXVnaHRVcCgpO1xuXG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG5cbiAgICBpZiAoc2VsZi5fcGhhc2UgIT09IFBIQVNFLlFVRVJZSU5HKVxuICAgICAgdGhyb3cgRXJyb3IoXCJQaGFzZSB1bmV4cGVjdGVkbHkgXCIgKyBzZWxmLl9waGFzZSk7XG5cbiAgICBpZiAoc2VsZi5fcmVxdWVyeVdoZW5Eb25lVGhpc1F1ZXJ5KSB7XG4gICAgICBzZWxmLl9yZXF1ZXJ5V2hlbkRvbmVUaGlzUXVlcnkgPSBmYWxzZTtcbiAgICAgIHNlbGYuX3BvbGxRdWVyeSgpO1xuICAgIH0gZWxzZSBpZiAoc2VsZi5fbmVlZFRvRmV0Y2guZW1wdHkoKSkge1xuICAgICAgYXdhaXQgc2VsZi5fYmVTdGVhZHkoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgc2VsZi5fZmV0Y2hNb2RpZmllZERvY3VtZW50cygpO1xuICAgIH1cbiAgfSxcblxuICBfY3Vyc29yRm9yUXVlcnk6IGZ1bmN0aW9uIChvcHRpb25zT3ZlcndyaXRlKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHJldHVybiBNZXRlb3IuX25vWWllbGRzQWxsb3dlZChmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBUaGUgcXVlcnkgd2UgcnVuIGlzIGFsbW9zdCB0aGUgc2FtZSBhcyB0aGUgY3Vyc29yIHdlIGFyZSBvYnNlcnZpbmcsXG4gICAgICAvLyB3aXRoIGEgZmV3IGNoYW5nZXMuIFdlIG5lZWQgdG8gcmVhZCBhbGwgdGhlIGZpZWxkcyB0aGF0IGFyZSByZWxldmFudCB0b1xuICAgICAgLy8gdGhlIHNlbGVjdG9yLCBub3QganVzdCB0aGUgZmllbGRzIHdlIGFyZSBnb2luZyB0byBwdWJsaXNoICh0aGF0J3MgdGhlXG4gICAgICAvLyBcInNoYXJlZFwiIHByb2plY3Rpb24pLiBBbmQgd2UgZG9uJ3Qgd2FudCB0byBhcHBseSBhbnkgdHJhbnNmb3JtIGluIHRoZVxuICAgICAgLy8gY3Vyc29yLCBiZWNhdXNlIG9ic2VydmVDaGFuZ2VzIHNob3VsZG4ndCB1c2UgdGhlIHRyYW5zZm9ybS5cbiAgICAgIHZhciBvcHRpb25zID0gXy5jbG9uZShzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zKTtcblxuICAgICAgLy8gQWxsb3cgdGhlIGNhbGxlciB0byBtb2RpZnkgdGhlIG9wdGlvbnMuIFVzZWZ1bCB0byBzcGVjaWZ5IGRpZmZlcmVudFxuICAgICAgLy8gc2tpcCBhbmQgbGltaXQgdmFsdWVzLlxuICAgICAgXy5leHRlbmQob3B0aW9ucywgb3B0aW9uc092ZXJ3cml0ZSk7XG5cbiAgICAgIG9wdGlvbnMuZmllbGRzID0gc2VsZi5fc2hhcmVkUHJvamVjdGlvbjtcbiAgICAgIGRlbGV0ZSBvcHRpb25zLnRyYW5zZm9ybTtcbiAgICAgIC8vIFdlIGFyZSBOT1QgZGVlcCBjbG9uaW5nIGZpZWxkcyBvciBzZWxlY3RvciBoZXJlLCB3aGljaCBzaG91bGQgYmUgT0suXG4gICAgICB2YXIgZGVzY3JpcHRpb24gPSBuZXcgQ3Vyc29yRGVzY3JpcHRpb24oXG4gICAgICAgIHNlbGYuX2N1cnNvckRlc2NyaXB0aW9uLmNvbGxlY3Rpb25OYW1lLFxuICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbi5zZWxlY3RvcixcbiAgICAgICAgb3B0aW9ucyk7XG4gICAgICByZXR1cm4gbmV3IEN1cnNvcihzZWxmLl9tb25nb0hhbmRsZSwgZGVzY3JpcHRpb24pO1xuICAgIH0pO1xuICB9LFxuXG5cbiAgLy8gUmVwbGFjZSBzZWxmLl9wdWJsaXNoZWQgd2l0aCBuZXdSZXN1bHRzIChib3RoIGFyZSBJZE1hcHMpLCBpbnZva2luZyBvYnNlcnZlXG4gIC8vIGNhbGxiYWNrcyBvbiB0aGUgbXVsdGlwbGV4ZXIuXG4gIC8vIFJlcGxhY2Ugc2VsZi5fdW5wdWJsaXNoZWRCdWZmZXIgd2l0aCBuZXdCdWZmZXIuXG4gIC8vXG4gIC8vIFhYWCBUaGlzIGlzIHZlcnkgc2ltaWxhciB0byBMb2NhbENvbGxlY3Rpb24uX2RpZmZRdWVyeVVub3JkZXJlZENoYW5nZXMuIFdlXG4gIC8vIHNob3VsZCByZWFsbHk6IChhKSBVbmlmeSBJZE1hcCBhbmQgT3JkZXJlZERpY3QgaW50byBVbm9yZGVyZWQvT3JkZXJlZERpY3RcbiAgLy8gKGIpIFJld3JpdGUgZGlmZi5qcyB0byB1c2UgdGhlc2UgY2xhc3NlcyBpbnN0ZWFkIG9mIGFycmF5cyBhbmQgb2JqZWN0cy5cbiAgX3B1Ymxpc2hOZXdSZXN1bHRzOiBmdW5jdGlvbiAobmV3UmVzdWx0cywgbmV3QnVmZmVyKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIE1ldGVvci5fbm9ZaWVsZHNBbGxvd2VkKGZ1bmN0aW9uICgpIHtcblxuICAgICAgLy8gSWYgdGhlIHF1ZXJ5IGlzIGxpbWl0ZWQgYW5kIHRoZXJlIGlzIGEgYnVmZmVyLCBzaHV0IGRvd24gc28gaXQgZG9lc24ndFxuICAgICAgLy8gc3RheSBpbiBhIHdheS5cbiAgICAgIGlmIChzZWxmLl9saW1pdCkge1xuICAgICAgICBzZWxmLl91bnB1Ymxpc2hlZEJ1ZmZlci5jbGVhcigpO1xuICAgICAgfVxuXG4gICAgICAvLyBGaXJzdCByZW1vdmUgYW55dGhpbmcgdGhhdCdzIGdvbmUuIEJlIGNhcmVmdWwgbm90IHRvIG1vZGlmeVxuICAgICAgLy8gc2VsZi5fcHVibGlzaGVkIHdoaWxlIGl0ZXJhdGluZyBvdmVyIGl0LlxuICAgICAgdmFyIGlkc1RvUmVtb3ZlID0gW107XG4gICAgICBzZWxmLl9wdWJsaXNoZWQuZm9yRWFjaChmdW5jdGlvbiAoZG9jLCBpZCkge1xuICAgICAgICBpZiAoIW5ld1Jlc3VsdHMuaGFzKGlkKSlcbiAgICAgICAgICBpZHNUb1JlbW92ZS5wdXNoKGlkKTtcbiAgICAgIH0pO1xuICAgICAgXy5lYWNoKGlkc1RvUmVtb3ZlLCBmdW5jdGlvbiAoaWQpIHtcbiAgICAgICAgc2VsZi5fcmVtb3ZlUHVibGlzaGVkKGlkKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBOb3cgZG8gYWRkcyBhbmQgY2hhbmdlcy5cbiAgICAgIC8vIElmIHNlbGYgaGFzIGEgYnVmZmVyIGFuZCBsaW1pdCwgdGhlIG5ldyBmZXRjaGVkIHJlc3VsdCB3aWxsIGJlXG4gICAgICAvLyBsaW1pdGVkIGNvcnJlY3RseSBhcyB0aGUgcXVlcnkgaGFzIHNvcnQgc3BlY2lmaWVyLlxuICAgICAgbmV3UmVzdWx0cy5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIHNlbGYuX2hhbmRsZURvYyhpZCwgZG9jKTtcbiAgICAgIH0pO1xuXG4gICAgICAvLyBTYW5pdHktY2hlY2sgdGhhdCBldmVyeXRoaW5nIHdlIHRyaWVkIHRvIHB1dCBpbnRvIF9wdWJsaXNoZWQgZW5kZWQgdXBcbiAgICAgIC8vIHRoZXJlLlxuICAgICAgLy8gWFhYIGlmIHRoaXMgaXMgc2xvdywgcmVtb3ZlIGl0IGxhdGVyXG4gICAgICBpZiAoc2VsZi5fcHVibGlzaGVkLnNpemUoKSAhPT0gbmV3UmVzdWx0cy5zaXplKCkpIHtcbiAgICAgICAgTWV0ZW9yLl9kZWJ1ZygnVGhlIE1vbmdvIHNlcnZlciBhbmQgdGhlIE1ldGVvciBxdWVyeSBkaXNhZ3JlZSBvbiBob3cgJyArXG4gICAgICAgICAgJ21hbnkgZG9jdW1lbnRzIG1hdGNoIHlvdXIgcXVlcnkuIEN1cnNvciBkZXNjcmlwdGlvbjogJyxcbiAgICAgICAgICBzZWxmLl9jdXJzb3JEZXNjcmlwdGlvbik7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNlbGYuX3B1Ymxpc2hlZC5mb3JFYWNoKGZ1bmN0aW9uIChkb2MsIGlkKSB7XG4gICAgICAgIGlmICghbmV3UmVzdWx0cy5oYXMoaWQpKVxuICAgICAgICAgIHRocm93IEVycm9yKFwiX3B1Ymxpc2hlZCBoYXMgYSBkb2MgdGhhdCBuZXdSZXN1bHRzIGRvZXNuJ3Q7IFwiICsgaWQpO1xuICAgICAgfSk7XG5cbiAgICAgIC8vIEZpbmFsbHksIHJlcGxhY2UgdGhlIGJ1ZmZlclxuICAgICAgbmV3QnVmZmVyLmZvckVhY2goZnVuY3Rpb24gKGRvYywgaWQpIHtcbiAgICAgICAgc2VsZi5fYWRkQnVmZmVyZWQoaWQsIGRvYyk7XG4gICAgICB9KTtcblxuICAgICAgc2VsZi5fc2FmZUFwcGVuZFRvQnVmZmVyID0gbmV3QnVmZmVyLnNpemUoKSA8IHNlbGYuX2xpbWl0O1xuICAgIH0pO1xuICB9LFxuXG4gIC8vIFRoaXMgc3RvcCBmdW5jdGlvbiBpcyBpbnZva2VkIGZyb20gdGhlIG9uU3RvcCBvZiB0aGUgT2JzZXJ2ZU11bHRpcGxleGVyLCBzb1xuICAvLyBpdCBzaG91bGRuJ3QgYWN0dWFsbHkgYmUgcG9zc2libGUgdG8gY2FsbCBpdCB1bnRpbCB0aGUgbXVsdGlwbGV4ZXIgaXNcbiAgLy8gcmVhZHkuXG4gIC8vXG4gIC8vIEl0J3MgaW1wb3J0YW50IHRvIGNoZWNrIHNlbGYuX3N0b3BwZWQgYWZ0ZXIgZXZlcnkgY2FsbCBpbiB0aGlzIGZpbGUgdGhhdFxuICAvLyBjYW4geWllbGQhXG4gIF9zdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKHNlbGYuX3N0b3BwZWQpXG4gICAgICByZXR1cm47XG4gICAgc2VsZi5fc3RvcHBlZCA9IHRydWU7XG5cbiAgICAvLyBOb3RlOiB3ZSAqZG9uJ3QqIHVzZSBtdWx0aXBsZXhlci5vbkZsdXNoIGhlcmUgYmVjYXVzZSB0aGlzIHN0b3BcbiAgICAvLyBjYWxsYmFjayBpcyBhY3R1YWxseSBpbnZva2VkIGJ5IHRoZSBtdWx0aXBsZXhlciBpdHNlbGYgd2hlbiBpdCBoYXNcbiAgICAvLyBkZXRlcm1pbmVkIHRoYXQgdGhlcmUgYXJlIG5vIGhhbmRsZXMgbGVmdC4gU28gbm90aGluZyBpcyBhY3R1YWxseSBnb2luZ1xuICAgIC8vIHRvIGdldCBmbHVzaGVkIChhbmQgaXQncyBwcm9iYWJseSBub3QgdmFsaWQgdG8gY2FsbCBtZXRob2RzIG9uIHRoZVxuICAgIC8vIGR5aW5nIG11bHRpcGxleGVyKS5cbiAgICBmb3IgKGNvbnN0IHcgb2Ygc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSkge1xuICAgICAgYXdhaXQgdy5jb21taXR0ZWQoKTtcbiAgICB9XG4gICAgc2VsZi5fd3JpdGVzVG9Db21taXRXaGVuV2VSZWFjaFN0ZWFkeSA9IG51bGw7XG5cbiAgICAvLyBQcm9hY3RpdmVseSBkcm9wIHJlZmVyZW5jZXMgdG8gcG90ZW50aWFsbHkgYmlnIHRoaW5ncy5cbiAgICBzZWxmLl9wdWJsaXNoZWQgPSBudWxsO1xuICAgIHNlbGYuX3VucHVibGlzaGVkQnVmZmVyID0gbnVsbDtcbiAgICBzZWxmLl9uZWVkVG9GZXRjaCA9IG51bGw7XG4gICAgc2VsZi5fY3VycmVudGx5RmV0Y2hpbmcgPSBudWxsO1xuICAgIHNlbGYuX29wbG9nRW50cnlIYW5kbGUgPSBudWxsO1xuICAgIHNlbGYuX2xpc3RlbmVyc0hhbmRsZSA9IG51bGw7XG5cbiAgICBQYWNrYWdlWydmYWN0cy1iYXNlJ10gJiYgUGFja2FnZVsnZmFjdHMtYmFzZSddLkZhY3RzLmluY3JlbWVudFNlcnZlckZhY3QoXG4gICAgICAgIFwibW9uZ28tbGl2ZWRhdGFcIiwgXCJvYnNlcnZlLWRyaXZlcnMtb3Bsb2dcIiwgLTEpO1xuXG4gICAgZm9yIGF3YWl0IChjb25zdCBoYW5kbGUgb2Ygc2VsZi5fc3RvcEhhbmRsZXMpIHtcbiAgICAgIGF3YWl0IGhhbmRsZS5zdG9wKCk7XG4gICAgfVxuICB9LFxuICBzdG9wOiBhc3luYyBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gYXdhaXQgc2VsZi5fc3RvcCgpO1xuICB9LFxuXG4gIF9yZWdpc3RlclBoYXNlQ2hhbmdlOiBmdW5jdGlvbiAocGhhc2UpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgTWV0ZW9yLl9ub1lpZWxkc0FsbG93ZWQoZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG5vdyA9IG5ldyBEYXRlO1xuXG4gICAgICBpZiAoc2VsZi5fcGhhc2UpIHtcbiAgICAgICAgdmFyIHRpbWVEaWZmID0gbm93IC0gc2VsZi5fcGhhc2VTdGFydFRpbWU7XG4gICAgICAgIFBhY2thZ2VbJ2ZhY3RzLWJhc2UnXSAmJiBQYWNrYWdlWydmYWN0cy1iYXNlJ10uRmFjdHMuaW5jcmVtZW50U2VydmVyRmFjdChcbiAgICAgICAgICBcIm1vbmdvLWxpdmVkYXRhXCIsIFwidGltZS1zcGVudC1pbi1cIiArIHNlbGYuX3BoYXNlICsgXCItcGhhc2VcIiwgdGltZURpZmYpO1xuICAgICAgfVxuXG4gICAgICBzZWxmLl9waGFzZSA9IHBoYXNlO1xuICAgICAgc2VsZi5fcGhhc2VTdGFydFRpbWUgPSBub3c7XG4gICAgfSk7XG4gIH1cbn0pO1xuXG4vLyBEb2VzIG91ciBvcGxvZyB0YWlsaW5nIGNvZGUgc3VwcG9ydCB0aGlzIGN1cnNvcj8gRm9yIG5vdywgd2UgYXJlIGJlaW5nIHZlcnlcbi8vIGNvbnNlcnZhdGl2ZSBhbmQgYWxsb3dpbmcgb25seSBzaW1wbGUgcXVlcmllcyB3aXRoIHNpbXBsZSBvcHRpb25zLlxuLy8gKFRoaXMgaXMgYSBcInN0YXRpYyBtZXRob2RcIi4pXG5PcGxvZ09ic2VydmVEcml2ZXIuY3Vyc29yU3VwcG9ydGVkID0gZnVuY3Rpb24gKGN1cnNvckRlc2NyaXB0aW9uLCBtYXRjaGVyKSB7XG4gIC8vIEZpcnN0LCBjaGVjayB0aGUgb3B0aW9ucy5cbiAgdmFyIG9wdGlvbnMgPSBjdXJzb3JEZXNjcmlwdGlvbi5vcHRpb25zO1xuXG4gIC8vIERpZCB0aGUgdXNlciBzYXkgbm8gZXhwbGljaXRseT9cbiAgLy8gdW5kZXJzY29yZWQgdmVyc2lvbiBvZiB0aGUgb3B0aW9uIGlzIENPTVBBVCB3aXRoIDEuMlxuICBpZiAob3B0aW9ucy5kaXNhYmxlT3Bsb2cgfHwgb3B0aW9ucy5fZGlzYWJsZU9wbG9nKVxuICAgIHJldHVybiBmYWxzZTtcblxuICAvLyBza2lwIGlzIG5vdCBzdXBwb3J0ZWQ6IHRvIHN1cHBvcnQgaXQgd2Ugd291bGQgbmVlZCB0byBrZWVwIHRyYWNrIG9mIGFsbFxuICAvLyBcInNraXBwZWRcIiBkb2N1bWVudHMgb3IgYXQgbGVhc3QgdGhlaXIgaWRzLlxuICAvLyBsaW1pdCB3L28gYSBzb3J0IHNwZWNpZmllciBpcyBub3Qgc3VwcG9ydGVkOiBjdXJyZW50IGltcGxlbWVudGF0aW9uIG5lZWRzIGFcbiAgLy8gZGV0ZXJtaW5pc3RpYyB3YXkgdG8gb3JkZXIgZG9jdW1lbnRzLlxuICBpZiAob3B0aW9ucy5za2lwIHx8IChvcHRpb25zLmxpbWl0ICYmICFvcHRpb25zLnNvcnQpKSByZXR1cm4gZmFsc2U7XG5cbiAgLy8gSWYgYSBmaWVsZHMgcHJvamVjdGlvbiBvcHRpb24gaXMgZ2l2ZW4gY2hlY2sgaWYgaXQgaXMgc3VwcG9ydGVkIGJ5XG4gIC8vIG1pbmltb25nbyAoc29tZSBvcGVyYXRvcnMgYXJlIG5vdCBzdXBwb3J0ZWQpLlxuICBjb25zdCBmaWVsZHMgPSBvcHRpb25zLmZpZWxkcyB8fCBvcHRpb25zLnByb2plY3Rpb247XG4gIGlmIChmaWVsZHMpIHtcbiAgICB0cnkge1xuICAgICAgTG9jYWxDb2xsZWN0aW9uLl9jaGVja1N1cHBvcnRlZFByb2plY3Rpb24oZmllbGRzKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoZS5uYW1lID09PSBcIk1pbmltb25nb0Vycm9yXCIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgZTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvLyBXZSBkb24ndCBhbGxvdyB0aGUgZm9sbG93aW5nIHNlbGVjdG9yczpcbiAgLy8gICAtICR3aGVyZSAobm90IGNvbmZpZGVudCB0aGF0IHdlIHByb3ZpZGUgdGhlIHNhbWUgSlMgZW52aXJvbm1lbnRcbiAgLy8gICAgICAgICAgICAgYXMgTW9uZ28sIGFuZCBjYW4geWllbGQhKVxuICAvLyAgIC0gJG5lYXIgKGhhcyBcImludGVyZXN0aW5nXCIgcHJvcGVydGllcyBpbiBNb25nb0RCLCBsaWtlIHRoZSBwb3NzaWJpbGl0eVxuICAvLyAgICAgICAgICAgIG9mIHJldHVybmluZyBhbiBJRCBtdWx0aXBsZSB0aW1lcywgdGhvdWdoIGV2ZW4gcG9sbGluZyBtYXliZVxuICAvLyAgICAgICAgICAgIGhhdmUgYSBidWcgdGhlcmUpXG4gIC8vICAgICAgICAgICBYWFg6IG9uY2Ugd2Ugc3VwcG9ydCBpdCwgd2Ugd291bGQgbmVlZCB0byB0aGluayBtb3JlIG9uIGhvdyB3ZVxuICAvLyAgICAgICAgICAgaW5pdGlhbGl6ZSB0aGUgY29tcGFyYXRvcnMgd2hlbiB3ZSBjcmVhdGUgdGhlIGRyaXZlci5cbiAgcmV0dXJuICFtYXRjaGVyLmhhc1doZXJlKCkgJiYgIW1hdGNoZXIuaGFzR2VvUXVlcnkoKTtcbn07XG5cbnZhciBtb2RpZmllckNhbkJlRGlyZWN0bHlBcHBsaWVkID0gZnVuY3Rpb24gKG1vZGlmaWVyKSB7XG4gIHJldHVybiBfLmFsbChtb2RpZmllciwgZnVuY3Rpb24gKGZpZWxkcywgb3BlcmF0aW9uKSB7XG4gICAgcmV0dXJuIF8uYWxsKGZpZWxkcywgZnVuY3Rpb24gKHZhbHVlLCBmaWVsZCkge1xuICAgICAgcmV0dXJuICEvRUpTT05cXCQvLnRlc3QoZmllbGQpO1xuICAgIH0pO1xuICB9KTtcbn07XG5cbk1vbmdvSW50ZXJuYWxzLk9wbG9nT2JzZXJ2ZURyaXZlciA9IE9wbG9nT2JzZXJ2ZURyaXZlcjtcbiIsIi8vIENvbnZlcnRlciBvZiB0aGUgbmV3IE1vbmdvREIgT3Bsb2cgZm9ybWF0ICg+PTUuMCkgdG8gdGhlIG9uZSB0aGF0IE1ldGVvclxuLy8gaGFuZGxlcyB3ZWxsLCBpLmUuLCBgJHNldGAgYW5kIGAkdW5zZXRgLiBUaGUgbmV3IGZvcm1hdCBpcyBjb21wbGV0ZWx5IG5ldyxcbi8vIGFuZCBsb29rcyBhcyBmb2xsb3dzOlxuLy9cbi8vICAgeyAkdjogMiwgZGlmZjogRGlmZiB9XG4vL1xuLy8gd2hlcmUgYERpZmZgIGlzIGEgcmVjdXJzaXZlIHN0cnVjdHVyZTpcbi8vXG4vLyAgIHtcbi8vICAgICAvLyBOZXN0ZWQgdXBkYXRlcyAoc29tZXRpbWVzIGFsc28gcmVwcmVzZW50ZWQgd2l0aCBhbiBzLWZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIGk6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBUb3AtbGV2ZWwgdXBkYXRlcy5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7IGZvbzogeyBiYXI6IDEgfSB9IH1gLlxuLy8gICAgIHU6IHsgPGtleT46IDx2YWx1ZT4sIC4uLiB9LFxuLy9cbi8vICAgICAvLyBVbnNldHMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHVuc2V0OiB7IGZvbzogJycgfSB9YC5cbi8vICAgICBkOiB7IDxrZXk+OiBmYWxzZSwgLi4uIH0sXG4vL1xuLy8gICAgIC8vIEFycmF5IG9wZXJhdGlvbnMuXG4vLyAgICAgLy8gRXhhbXBsZTogYHsgJHB1c2g6IHsgZm9vOiAnYmFyJyB9IH1gLlxuLy8gICAgIHM8a2V5PjogeyBhOiB0cnVlLCB1PGluZGV4PjogPHZhbHVlPiwgLi4uIH0sXG4vLyAgICAgLi4uXG4vL1xuLy8gICAgIC8vIE5lc3RlZCBvcGVyYXRpb25zIChzb21ldGltZXMgYWxzbyByZXByZXNlbnRlZCBpbiB0aGUgYGlgIGZpZWxkKS5cbi8vICAgICAvLyBFeGFtcGxlOiBgeyAkc2V0OiB7ICdmb28uYmFyJzogMSB9IH1gLlxuLy8gICAgIHM8a2V5PjogRGlmZixcbi8vICAgICAuLi5cbi8vICAgfVxuLy9cbi8vIChhbGwgZmllbGRzIGFyZSBvcHRpb25hbCkuXG5cbmZ1bmN0aW9uIGpvaW4ocHJlZml4LCBrZXkpIHtcbiAgcmV0dXJuIHByZWZpeCA/IGAke3ByZWZpeH0uJHtrZXl9YCA6IGtleTtcbn1cblxuY29uc3QgYXJyYXlPcGVyYXRvcktleVJlZ2V4ID0gL14oYXxbc3VdXFxkKykkLztcblxuZnVuY3Rpb24gaXNBcnJheU9wZXJhdG9yS2V5KGZpZWxkKSB7XG4gIHJldHVybiBhcnJheU9wZXJhdG9yS2V5UmVnZXgudGVzdChmaWVsZCk7XG59XG5cbmZ1bmN0aW9uIGlzQXJyYXlPcGVyYXRvcihvcGVyYXRvcikge1xuICByZXR1cm4gb3BlcmF0b3IuYSA9PT0gdHJ1ZSAmJiBPYmplY3Qua2V5cyhvcGVyYXRvcikuZXZlcnkoaXNBcnJheU9wZXJhdG9yS2V5KTtcbn1cblxuZnVuY3Rpb24gZmxhdHRlbk9iamVjdEludG8odGFyZ2V0LCBzb3VyY2UsIHByZWZpeCkge1xuICBpZiAoQXJyYXkuaXNBcnJheShzb3VyY2UpIHx8IHR5cGVvZiBzb3VyY2UgIT09ICdvYmplY3QnIHx8IHNvdXJjZSA9PT0gbnVsbCkge1xuICAgIHRhcmdldFtwcmVmaXhdID0gc291cmNlO1xuICB9IGVsc2Uge1xuICAgIGNvbnN0IGVudHJpZXMgPSBPYmplY3QuZW50cmllcyhzb3VyY2UpO1xuICAgIGlmIChlbnRyaWVzLmxlbmd0aCkge1xuICAgICAgZW50cmllcy5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcbiAgICAgICAgZmxhdHRlbk9iamVjdEludG8odGFyZ2V0LCB2YWx1ZSwgam9pbihwcmVmaXgsIGtleSkpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRhcmdldFtwcmVmaXhdID0gc291cmNlO1xuICAgIH1cbiAgfVxufVxuXG5jb25zdCBsb2dEZWJ1Z01lc3NhZ2VzID0gISFwcm9jZXNzLmVudi5PUExPR19DT05WRVJURVJfREVCVUc7XG5cbmZ1bmN0aW9uIGNvbnZlcnRPcGxvZ0RpZmYob3Bsb2dFbnRyeSwgZGlmZiwgcHJlZml4KSB7XG4gIGlmIChsb2dEZWJ1Z01lc3NhZ2VzKSB7XG4gICAgY29uc29sZS5sb2coYGNvbnZlcnRPcGxvZ0RpZmYoJHtKU09OLnN0cmluZ2lmeShvcGxvZ0VudHJ5KX0sICR7SlNPTi5zdHJpbmdpZnkoZGlmZil9LCAke0pTT04uc3RyaW5naWZ5KHByZWZpeCl9KWApO1xuICB9XG5cbiAgT2JqZWN0LmVudHJpZXMoZGlmZikuZm9yRWFjaCgoW2RpZmZLZXksIHZhbHVlXSkgPT4ge1xuICAgIGlmIChkaWZmS2V5ID09PSAnZCcpIHtcbiAgICAgIC8vIEhhbmRsZSBgJHVuc2V0YHMuXG4gICAgICBvcGxvZ0VudHJ5LiR1bnNldCA/Pz0ge307XG4gICAgICBPYmplY3Qua2V5cyh2YWx1ZSkuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICBvcGxvZ0VudHJ5LiR1bnNldFtqb2luKHByZWZpeCwga2V5KV0gPSB0cnVlO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIGlmIChkaWZmS2V5ID09PSAnaScpIHtcbiAgICAgIC8vIEhhbmRsZSAocG90ZW50aWFsbHkpIG5lc3RlZCBgJHNldGBzLlxuICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgIGZsYXR0ZW5PYmplY3RJbnRvKG9wbG9nRW50cnkuJHNldCwgdmFsdWUsIHByZWZpeCk7XG4gICAgfSBlbHNlIGlmIChkaWZmS2V5ID09PSAndScpIHtcbiAgICAgIC8vIEhhbmRsZSBmbGF0IGAkc2V0YHMuXG4gICAgICBvcGxvZ0VudHJ5LiRzZXQgPz89IHt9O1xuICAgICAgT2JqZWN0LmVudHJpZXModmFsdWUpLmZvckVhY2goKFtrZXksIHZhbHVlXSkgPT4ge1xuICAgICAgICBvcGxvZ0VudHJ5LiRzZXRbam9pbihwcmVmaXgsIGtleSldID0gdmFsdWU7XG4gICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSGFuZGxlIHMtZmllbGRzLlxuICAgICAgY29uc3Qga2V5ID0gZGlmZktleS5zbGljZSgxKTtcbiAgICAgIGlmIChpc0FycmF5T3BlcmF0b3IodmFsdWUpKSB7XG4gICAgICAgIC8vIEFycmF5IG9wZXJhdG9yLlxuICAgICAgICBPYmplY3QuZW50cmllcyh2YWx1ZSkuZm9yRWFjaCgoW3Bvc2l0aW9uLCB2YWx1ZV0pID0+IHtcbiAgICAgICAgICBpZiAocG9zaXRpb24gPT09ICdhJykge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHBvc2l0aW9uS2V5ID0gam9pbihqb2luKHByZWZpeCwga2V5KSwgcG9zaXRpb24uc2xpY2UoMSkpO1xuICAgICAgICAgIGlmIChwb3NpdGlvblswXSA9PT0gJ3MnKSB7XG4gICAgICAgICAgICBjb252ZXJ0T3Bsb2dEaWZmKG9wbG9nRW50cnksIHZhbHVlLCBwb3NpdGlvbktleSk7XG4gICAgICAgICAgfSBlbHNlIGlmICh2YWx1ZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXQgPz89IHt9O1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kdW5zZXRbcG9zaXRpb25LZXldID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgb3Bsb2dFbnRyeS4kc2V0ID8/PSB7fTtcbiAgICAgICAgICAgIG9wbG9nRW50cnkuJHNldFtwb3NpdGlvbktleV0gPSB2YWx1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIGlmIChrZXkpIHtcbiAgICAgICAgLy8gTmVzdGVkIG9iamVjdC5cbiAgICAgICAgY29udmVydE9wbG9nRGlmZihvcGxvZ0VudHJ5LCB2YWx1ZSwgam9pbihwcmVmaXgsIGtleSkpO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvcGxvZ1YyVjFDb252ZXJ0ZXIob3Bsb2dFbnRyeSkge1xuICAvLyBQYXNzLXRocm91Z2ggdjEgYW5kIChwcm9iYWJseSkgaW52YWxpZCBlbnRyaWVzLlxuICBpZiAob3Bsb2dFbnRyeS4kdiAhPT0gMiB8fCAhb3Bsb2dFbnRyeS5kaWZmKSB7XG4gICAgcmV0dXJuIG9wbG9nRW50cnk7XG4gIH1cblxuICBjb25zdCBjb252ZXJ0ZWRPcGxvZ0VudHJ5ID0geyAkdjogMiB9O1xuICBjb252ZXJ0T3Bsb2dEaWZmKGNvbnZlcnRlZE9wbG9nRW50cnksIG9wbG9nRW50cnkuZGlmZiwgJycpO1xuICByZXR1cm4gY29udmVydGVkT3Bsb2dFbnRyeTtcbn1cbiIsIi8vIHNpbmdsZXRvblxuZXhwb3J0IGNvbnN0IExvY2FsQ29sbGVjdGlvbkRyaXZlciA9IG5ldyAoY2xhc3MgTG9jYWxDb2xsZWN0aW9uRHJpdmVyIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5ub0Nvbm5Db2xsZWN0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIH1cblxuICBvcGVuKG5hbWUsIGNvbm4pIHtcbiAgICBpZiAoISBuYW1lKSB7XG4gICAgICByZXR1cm4gbmV3IExvY2FsQ29sbGVjdGlvbjtcbiAgICB9XG5cbiAgICBpZiAoISBjb25uKSB7XG4gICAgICByZXR1cm4gZW5zdXJlQ29sbGVjdGlvbihuYW1lLCB0aGlzLm5vQ29ubkNvbGxlY3Rpb25zKTtcbiAgICB9XG5cbiAgICBpZiAoISBjb25uLl9tb25nb19saXZlZGF0YV9jb2xsZWN0aW9ucykge1xuICAgICAgY29ubi5fbW9uZ29fbGl2ZWRhdGFfY29sbGVjdGlvbnMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICAgIH1cblxuICAgIC8vIFhYWCBpcyB0aGVyZSBhIHdheSB0byBrZWVwIHRyYWNrIG9mIGEgY29ubmVjdGlvbidzIGNvbGxlY3Rpb25zIHdpdGhvdXRcbiAgICAvLyBkYW5nbGluZyBpdCBvZmYgdGhlIGNvbm5lY3Rpb24gb2JqZWN0P1xuICAgIHJldHVybiBlbnN1cmVDb2xsZWN0aW9uKG5hbWUsIGNvbm4uX21vbmdvX2xpdmVkYXRhX2NvbGxlY3Rpb25zKTtcbiAgfVxufSk7XG5cbmZ1bmN0aW9uIGVuc3VyZUNvbGxlY3Rpb24obmFtZSwgY29sbGVjdGlvbnMpIHtcbiAgcmV0dXJuIChuYW1lIGluIGNvbGxlY3Rpb25zKVxuICAgID8gY29sbGVjdGlvbnNbbmFtZV1cbiAgICA6IGNvbGxlY3Rpb25zW25hbWVdID0gbmV3IExvY2FsQ29sbGVjdGlvbihuYW1lKTtcbn1cbiIsImltcG9ydCB7XG4gIEFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUyxcbiAgZ2V0QXN5bmNNZXRob2ROYW1lXG59IGZyb20gXCJtZXRlb3IvbWluaW1vbmdvL2NvbnN0YW50c1wiO1xuXG5Nb25nb0ludGVybmFscy5SZW1vdGVDb2xsZWN0aW9uRHJpdmVyID0gZnVuY3Rpb24gKFxuICBtb25nb191cmwsIG9wdGlvbnMpIHtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzZWxmLm1vbmdvID0gbmV3IE1vbmdvQ29ubmVjdGlvbihtb25nb191cmwsIG9wdGlvbnMpO1xufTtcblxuY29uc3QgUkVNT1RFX0NPTExFQ1RJT05fTUVUSE9EUyA9IFtcbiAgJ2NyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYycsXG4gICdkcm9wSW5kZXhBc3luYycsXG4gICdlbnN1cmVJbmRleEFzeW5jJyxcbiAgJ2NyZWF0ZUluZGV4QXN5bmMnLFxuICAnY291bnREb2N1bWVudHMnLFxuICAnZHJvcENvbGxlY3Rpb25Bc3luYycsXG4gICdlc3RpbWF0ZWREb2N1bWVudENvdW50JyxcbiAgJ2ZpbmQnLFxuICAnZmluZE9uZUFzeW5jJyxcbiAgJ2luc2VydEFzeW5jJyxcbiAgJ3Jhd0NvbGxlY3Rpb24nLFxuICAncmVtb3ZlQXN5bmMnLFxuICAndXBkYXRlQXN5bmMnLFxuICAndXBzZXJ0QXN5bmMnLFxuXTtcblxuT2JqZWN0LmFzc2lnbihNb25nb0ludGVybmFscy5SZW1vdGVDb2xsZWN0aW9uRHJpdmVyLnByb3RvdHlwZSwge1xuICBvcGVuOiBmdW5jdGlvbiAobmFtZSkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmV0ID0ge307XG4gICAgUkVNT1RFX0NPTExFQ1RJT05fTUVUSE9EUy5mb3JFYWNoKFxuICAgICAgZnVuY3Rpb24gKG0pIHtcbiAgICAgICAgcmV0W21dID0gXy5iaW5kKHNlbGYubW9uZ29bbV0sIHNlbGYubW9uZ28sIG5hbWUpO1xuXG4gICAgICAgIGlmICghQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTLmluY2x1ZGVzKG0pKSByZXR1cm47XG4gICAgICAgIGNvbnN0IGFzeW5jTWV0aG9kTmFtZSA9IGdldEFzeW5jTWV0aG9kTmFtZShtKTtcbiAgICAgICAgcmV0W2FzeW5jTWV0aG9kTmFtZV0gPSBmdW5jdGlvbiAoLi4uYXJncykge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJldFttXSguLi5hcmdzKSk7XG4gICAgICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9KTtcbiAgICByZXR1cm4gcmV0O1xuICB9XG59KTtcblxuLy8gQ3JlYXRlIHRoZSBzaW5nbGV0b24gUmVtb3RlQ29sbGVjdGlvbkRyaXZlciBvbmx5IG9uIGRlbWFuZCwgc28gd2Vcbi8vIG9ubHkgcmVxdWlyZSBNb25nbyBjb25maWd1cmF0aW9uIGlmIGl0J3MgYWN0dWFsbHkgdXNlZCAoZWcsIG5vdCBpZlxuLy8geW91J3JlIG9ubHkgdHJ5aW5nIHRvIHJlY2VpdmUgZGF0YSBmcm9tIGEgcmVtb3RlIEREUCBzZXJ2ZXIuKVxuTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIgPSBfLm9uY2UoZnVuY3Rpb24gKCkge1xuICB2YXIgY29ubmVjdGlvbk9wdGlvbnMgPSB7fTtcblxuICB2YXIgbW9uZ29VcmwgPSBwcm9jZXNzLmVudi5NT05HT19VUkw7XG5cbiAgaWYgKHByb2Nlc3MuZW52Lk1PTkdPX09QTE9HX1VSTCkge1xuICAgIGNvbm5lY3Rpb25PcHRpb25zLm9wbG9nVXJsID0gcHJvY2Vzcy5lbnYuTU9OR09fT1BMT0dfVVJMO1xuICB9XG5cbiAgaWYgKCEgbW9uZ29VcmwpXG4gICAgdGhyb3cgbmV3IEVycm9yKFwiTU9OR09fVVJMIG11c3QgYmUgc2V0IGluIGVudmlyb25tZW50XCIpO1xuXG4gIGNvbnN0IGRyaXZlciA9IG5ldyBNb25nb0ludGVybmFscy5SZW1vdGVDb2xsZWN0aW9uRHJpdmVyKG1vbmdvVXJsLCBjb25uZWN0aW9uT3B0aW9ucyk7XG5cbiAgLy8gQXMgbWFueSBkZXBsb3ltZW50IHRvb2xzLCBpbmNsdWRpbmcgTWV0ZW9yIFVwLCBzZW5kIHJlcXVlc3RzIHRvIHRoZSBhcHAgaW5cbiAgLy8gb3JkZXIgdG8gY29uZmlybSB0aGF0IHRoZSBkZXBsb3ltZW50IGZpbmlzaGVkIHN1Y2Nlc3NmdWxseSwgaXQncyByZXF1aXJlZFxuICAvLyB0byBrbm93IGFib3V0IGEgZGF0YWJhc2UgY29ubmVjdGlvbiBwcm9ibGVtIGJlZm9yZSB0aGUgYXBwIHN0YXJ0cy4gRG9pbmcgc29cbiAgLy8gaW4gYSBgTWV0ZW9yLnN0YXJ0dXBgIGlzIGZpbmUsIGFzIHRoZSBgV2ViQXBwYCBoYW5kbGVzIHJlcXVlc3RzIG9ubHkgYWZ0ZXJcbiAgLy8gYWxsIGFyZSBmaW5pc2hlZC5cbiAgTWV0ZW9yLnN0YXJ0dXAoYXN5bmMgKCkgPT4ge1xuICAgIGF3YWl0IGRyaXZlci5tb25nby5jbGllbnQuY29ubmVjdCgpO1xuICB9KTtcblxuICByZXR1cm4gZHJpdmVyO1xufSk7XG4iLCIvLyBvcHRpb25zLmNvbm5lY3Rpb24sIGlmIGdpdmVuLCBpcyBhIExpdmVkYXRhQ2xpZW50IG9yIExpdmVkYXRhU2VydmVyXG4vLyBYWFggcHJlc2VudGx5IHRoZXJlIGlzIG5vIHdheSB0byBkZXN0cm95L2NsZWFuIHVwIGEgQ29sbGVjdGlvblxuaW1wb3J0IHtcbiAgQVNZTkNfQ09MTEVDVElPTl9NRVRIT0RTLFxuICBnZXRBc3luY01ldGhvZE5hbWVcbn0gZnJvbSBcIm1ldGVvci9taW5pbW9uZ28vY29uc3RhbnRzXCI7XG5cbmltcG9ydCB7IG5vcm1hbGl6ZVByb2plY3Rpb24gfSBmcm9tIFwiLi9tb25nb191dGlsc1wiO1xuXG4vKipcbiAqIEBzdW1tYXJ5IE5hbWVzcGFjZSBmb3IgTW9uZ29EQi1yZWxhdGVkIGl0ZW1zXG4gKiBAbmFtZXNwYWNlXG4gKi9cbk1vbmdvID0ge307XG5cbi8qKlxuICogQHN1bW1hcnkgQ29uc3RydWN0b3IgZm9yIGEgQ29sbGVjdGlvblxuICogQGxvY3VzIEFueXdoZXJlXG4gKiBAaW5zdGFuY2VuYW1lIGNvbGxlY3Rpb25cbiAqIEBjbGFzc1xuICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgVGhlIG5hbWUgb2YgdGhlIGNvbGxlY3Rpb24uICBJZiBudWxsLCBjcmVhdGVzIGFuIHVubWFuYWdlZCAodW5zeW5jaHJvbml6ZWQpIGxvY2FsIGNvbGxlY3Rpb24uXG4gKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9ucy5jb25uZWN0aW9uIFRoZSBzZXJ2ZXIgY29ubmVjdGlvbiB0aGF0IHdpbGwgbWFuYWdlIHRoaXMgY29sbGVjdGlvbi4gVXNlcyB0aGUgZGVmYXVsdCBjb25uZWN0aW9uIGlmIG5vdCBzcGVjaWZpZWQuICBQYXNzIHRoZSByZXR1cm4gdmFsdWUgb2YgY2FsbGluZyBbYEREUC5jb25uZWN0YF0oI2RkcF9jb25uZWN0KSB0byBzcGVjaWZ5IGEgZGlmZmVyZW50IHNlcnZlci4gUGFzcyBgbnVsbGAgdG8gc3BlY2lmeSBubyBjb25uZWN0aW9uLiBVbm1hbmFnZWQgKGBuYW1lYCBpcyBudWxsKSBjb2xsZWN0aW9ucyBjYW5ub3Qgc3BlY2lmeSBhIGNvbm5lY3Rpb24uXG4gKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5pZEdlbmVyYXRpb24gVGhlIG1ldGhvZCBvZiBnZW5lcmF0aW5nIHRoZSBgX2lkYCBmaWVsZHMgb2YgbmV3IGRvY3VtZW50cyBpbiB0aGlzIGNvbGxlY3Rpb24uICBQb3NzaWJsZSB2YWx1ZXM6XG5cbiAtICoqYCdTVFJJTkcnYCoqOiByYW5kb20gc3RyaW5nc1xuIC0gKipgJ01PTkdPJ2AqKjogIHJhbmRvbSBbYE1vbmdvLk9iamVjdElEYF0oI21vbmdvX29iamVjdF9pZCkgdmFsdWVzXG5cblRoZSBkZWZhdWx0IGlkIGdlbmVyYXRpb24gdGVjaG5pcXVlIGlzIGAnU1RSSU5HJ2AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBBbiBvcHRpb25hbCB0cmFuc2Zvcm1hdGlvbiBmdW5jdGlvbi4gRG9jdW1lbnRzIHdpbGwgYmUgcGFzc2VkIHRocm91Z2ggdGhpcyBmdW5jdGlvbiBiZWZvcmUgYmVpbmcgcmV0dXJuZWQgZnJvbSBgZmV0Y2hgIG9yIGBmaW5kT25lQXN5bmNgLCBhbmQgYmVmb3JlIGJlaW5nIHBhc3NlZCB0byBjYWxsYmFja3Mgb2YgYG9ic2VydmVgLCBgbWFwYCwgYGZvckVhY2hgLCBgYWxsb3dgLCBhbmQgYGRlbnlgLiBUcmFuc2Zvcm1zIGFyZSAqbm90KiBhcHBsaWVkIGZvciB0aGUgY2FsbGJhY2tzIG9mIGBvYnNlcnZlQ2hhbmdlc2Agb3IgdG8gY3Vyc29ycyByZXR1cm5lZCBmcm9tIHB1Ymxpc2ggZnVuY3Rpb25zLlxuICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLmRlZmluZU11dGF0aW9uTWV0aG9kcyBTZXQgdG8gYGZhbHNlYCB0byBza2lwIHNldHRpbmcgdXAgdGhlIG11dGF0aW9uIG1ldGhvZHMgdGhhdCBlbmFibGUgaW5zZXJ0L3VwZGF0ZS9yZW1vdmUgZnJvbSBjbGllbnQgY29kZS4gRGVmYXVsdCBgdHJ1ZWAuXG4gKi9cbk1vbmdvLkNvbGxlY3Rpb24gPSBmdW5jdGlvbiBDb2xsZWN0aW9uKG5hbWUsIG9wdGlvbnMpIHtcbiAgaWYgKCFuYW1lICYmIG5hbWUgIT09IG51bGwpIHtcbiAgICBNZXRlb3IuX2RlYnVnKFxuICAgICAgJ1dhcm5pbmc6IGNyZWF0aW5nIGFub255bW91cyBjb2xsZWN0aW9uLiBJdCB3aWxsIG5vdCBiZSAnICtcbiAgICAgICAgJ3NhdmVkIG9yIHN5bmNocm9uaXplZCBvdmVyIHRoZSBuZXR3b3JrLiAoUGFzcyBudWxsIGZvciAnICtcbiAgICAgICAgJ3RoZSBjb2xsZWN0aW9uIG5hbWUgdG8gdHVybiBvZmYgdGhpcyB3YXJuaW5nLiknXG4gICAgKTtcbiAgICBuYW1lID0gbnVsbDtcbiAgfVxuXG4gIGlmIChuYW1lICE9PSBudWxsICYmIHR5cGVvZiBuYW1lICE9PSAnc3RyaW5nJykge1xuICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICdGaXJzdCBhcmd1bWVudCB0byBuZXcgTW9uZ28uQ29sbGVjdGlvbiBtdXN0IGJlIGEgc3RyaW5nIG9yIG51bGwnXG4gICAgKTtcbiAgfVxuXG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMubWV0aG9kcykge1xuICAgIC8vIEJhY2t3YXJkcyBjb21wYXRpYmlsaXR5IGhhY2sgd2l0aCBvcmlnaW5hbCBzaWduYXR1cmUgKHdoaWNoIHBhc3NlZFxuICAgIC8vIFwiY29ubmVjdGlvblwiIGRpcmVjdGx5IGluc3RlYWQgb2YgaW4gb3B0aW9ucy4gKENvbm5lY3Rpb25zIG11c3QgaGF2ZSBhIFwibWV0aG9kc1wiXG4gICAgLy8gbWV0aG9kLilcbiAgICAvLyBYWFggcmVtb3ZlIGJlZm9yZSAxLjBcbiAgICBvcHRpb25zID0geyBjb25uZWN0aW9uOiBvcHRpb25zIH07XG4gIH1cbiAgLy8gQmFja3dhcmRzIGNvbXBhdGliaWxpdHk6IFwiY29ubmVjdGlvblwiIHVzZWQgdG8gYmUgY2FsbGVkIFwibWFuYWdlclwiLlxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLm1hbmFnZXIgJiYgIW9wdGlvbnMuY29ubmVjdGlvbikge1xuICAgIG9wdGlvbnMuY29ubmVjdGlvbiA9IG9wdGlvbnMubWFuYWdlcjtcbiAgfVxuXG4gIG9wdGlvbnMgPSB7XG4gICAgY29ubmVjdGlvbjogdW5kZWZpbmVkLFxuICAgIGlkR2VuZXJhdGlvbjogJ1NUUklORycsXG4gICAgdHJhbnNmb3JtOiBudWxsLFxuICAgIF9kcml2ZXI6IHVuZGVmaW5lZCxcbiAgICBfcHJldmVudEF1dG9wdWJsaXNoOiBmYWxzZSxcbiAgICAuLi5vcHRpb25zLFxuICB9O1xuXG4gIHN3aXRjaCAob3B0aW9ucy5pZEdlbmVyYXRpb24pIHtcbiAgICBjYXNlICdNT05HTyc6XG4gICAgICB0aGlzLl9tYWtlTmV3SUQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNyYyA9IG5hbWVcbiAgICAgICAgICA/IEREUC5yYW5kb21TdHJlYW0oJy9jb2xsZWN0aW9uLycgKyBuYW1lKVxuICAgICAgICAgIDogUmFuZG9tLmluc2VjdXJlO1xuICAgICAgICByZXR1cm4gbmV3IE1vbmdvLk9iamVjdElEKHNyYy5oZXhTdHJpbmcoMjQpKTtcbiAgICAgIH07XG4gICAgICBicmVhaztcbiAgICBjYXNlICdTVFJJTkcnOlxuICAgIGRlZmF1bHQ6XG4gICAgICB0aGlzLl9tYWtlTmV3SUQgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNyYyA9IG5hbWVcbiAgICAgICAgICA/IEREUC5yYW5kb21TdHJlYW0oJy9jb2xsZWN0aW9uLycgKyBuYW1lKVxuICAgICAgICAgIDogUmFuZG9tLmluc2VjdXJlO1xuICAgICAgICByZXR1cm4gc3JjLmlkKCk7XG4gICAgICB9O1xuICAgICAgYnJlYWs7XG4gIH1cblxuICB0aGlzLl90cmFuc2Zvcm0gPSBMb2NhbENvbGxlY3Rpb24ud3JhcFRyYW5zZm9ybShvcHRpb25zLnRyYW5zZm9ybSk7XG5cbiAgaWYgKCFuYW1lIHx8IG9wdGlvbnMuY29ubmVjdGlvbiA9PT0gbnVsbClcbiAgICAvLyBub3RlOiBuYW1lbGVzcyBjb2xsZWN0aW9ucyBuZXZlciBoYXZlIGEgY29ubmVjdGlvblxuICAgIHRoaXMuX2Nvbm5lY3Rpb24gPSBudWxsO1xuICBlbHNlIGlmIChvcHRpb25zLmNvbm5lY3Rpb24pIHRoaXMuX2Nvbm5lY3Rpb24gPSBvcHRpb25zLmNvbm5lY3Rpb247XG4gIGVsc2UgaWYgKE1ldGVvci5pc0NsaWVudCkgdGhpcy5fY29ubmVjdGlvbiA9IE1ldGVvci5jb25uZWN0aW9uO1xuICBlbHNlIHRoaXMuX2Nvbm5lY3Rpb24gPSBNZXRlb3Iuc2VydmVyO1xuXG4gIGlmICghb3B0aW9ucy5fZHJpdmVyKSB7XG4gICAgLy8gWFhYIFRoaXMgY2hlY2sgYXNzdW1lcyB0aGF0IHdlYmFwcCBpcyBsb2FkZWQgc28gdGhhdCBNZXRlb3Iuc2VydmVyICE9PVxuICAgIC8vIG51bGwuIFdlIHNob3VsZCBmdWxseSBzdXBwb3J0IHRoZSBjYXNlIG9mIFwid2FudCB0byB1c2UgYSBNb25nby1iYWNrZWRcbiAgICAvLyBjb2xsZWN0aW9uIGZyb20gTm9kZSBjb2RlIHdpdGhvdXQgd2ViYXBwXCIsIGJ1dCB3ZSBkb24ndCB5ZXQuXG4gICAgLy8gI01ldGVvclNlcnZlck51bGxcbiAgICBpZiAoXG4gICAgICBuYW1lICYmXG4gICAgICB0aGlzLl9jb25uZWN0aW9uID09PSBNZXRlb3Iuc2VydmVyICYmXG4gICAgICB0eXBlb2YgTW9uZ29JbnRlcm5hbHMgIT09ICd1bmRlZmluZWQnICYmXG4gICAgICBNb25nb0ludGVybmFscy5kZWZhdWx0UmVtb3RlQ29sbGVjdGlvbkRyaXZlclxuICAgICkge1xuICAgICAgb3B0aW9ucy5fZHJpdmVyID0gTW9uZ29JbnRlcm5hbHMuZGVmYXVsdFJlbW90ZUNvbGxlY3Rpb25Ecml2ZXIoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgeyBMb2NhbENvbGxlY3Rpb25Ecml2ZXIgfSA9IHJlcXVpcmUoJy4vbG9jYWxfY29sbGVjdGlvbl9kcml2ZXIuanMnKTtcbiAgICAgIG9wdGlvbnMuX2RyaXZlciA9IExvY2FsQ29sbGVjdGlvbkRyaXZlcjtcbiAgICB9XG4gIH1cblxuICB0aGlzLl9jb2xsZWN0aW9uID0gb3B0aW9ucy5fZHJpdmVyLm9wZW4obmFtZSwgdGhpcy5fY29ubmVjdGlvbik7XG4gIHRoaXMuX25hbWUgPSBuYW1lO1xuICB0aGlzLl9kcml2ZXIgPSBvcHRpb25zLl9kcml2ZXI7XG5cbiAgLy8gVE9ET1tmaWJlcnNdOiBfbWF5YmVTZXRVcFJlcGxpY2F0aW9uIGlzIG5vdyBhc3luYy4gTGV0J3Mgd2F0Y2ggaG93IG5vdCB3YWl0aW5nIGZvciB0aGlzIGZ1bmN0aW9uIHRvIGZpbmlzaFxuICAgIC8vIHdpbGwgYWZmZWN0IGV2ZXJ5dGhpbmdcbiAgdGhpcy5fc2V0dGluZ1VwUmVwbGljYXRpb25Qcm9taXNlID0gdGhpcy5fbWF5YmVTZXRVcFJlcGxpY2F0aW9uKG5hbWUsIG9wdGlvbnMpO1xuXG4gIC8vIFhYWCBkb24ndCBkZWZpbmUgdGhlc2UgdW50aWwgYWxsb3cgb3IgZGVueSBpcyBhY3R1YWxseSB1c2VkIGZvciB0aGlzXG4gIC8vIGNvbGxlY3Rpb24uIENvdWxkIGJlIGhhcmQgaWYgdGhlIHNlY3VyaXR5IHJ1bGVzIGFyZSBvbmx5IGRlZmluZWQgb24gdGhlXG4gIC8vIHNlcnZlci5cbiAgaWYgKG9wdGlvbnMuZGVmaW5lTXV0YXRpb25NZXRob2RzICE9PSBmYWxzZSkge1xuICAgIHRyeSB7XG4gICAgICB0aGlzLl9kZWZpbmVNdXRhdGlvbk1ldGhvZHMoe1xuICAgICAgICB1c2VFeGlzdGluZzogb3B0aW9ucy5fc3VwcHJlc3NTYW1lTmFtZUVycm9yID09PSB0cnVlLFxuICAgICAgfSk7XG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIC8vIFRocm93IGEgbW9yZSB1bmRlcnN0YW5kYWJsZSBlcnJvciBvbiB0aGUgc2VydmVyIGZvciBzYW1lIGNvbGxlY3Rpb24gbmFtZVxuICAgICAgaWYgKFxuICAgICAgICBlcnJvci5tZXNzYWdlID09PSBgQSBtZXRob2QgbmFtZWQgJy8ke25hbWV9L2luc2VydEFzeW5jJyBpcyBhbHJlYWR5IGRlZmluZWRgXG4gICAgICApXG4gICAgICAgIHRocm93IG5ldyBFcnJvcihgVGhlcmUgaXMgYWxyZWFkeSBhIGNvbGxlY3Rpb24gbmFtZWQgXCIke25hbWV9XCJgKTtcbiAgICAgIHRocm93IGVycm9yO1xuICAgIH1cbiAgfVxuXG4gIC8vIGF1dG9wdWJsaXNoXG4gIGlmIChcbiAgICBQYWNrYWdlLmF1dG9wdWJsaXNoICYmXG4gICAgIW9wdGlvbnMuX3ByZXZlbnRBdXRvcHVibGlzaCAmJlxuICAgIHRoaXMuX2Nvbm5lY3Rpb24gJiZcbiAgICB0aGlzLl9jb25uZWN0aW9uLnB1Ymxpc2hcbiAgKSB7XG4gICAgdGhpcy5fY29ubmVjdGlvbi5wdWJsaXNoKG51bGwsICgpID0+IHRoaXMuZmluZCgpLCB7XG4gICAgICBpc19hdXRvOiB0cnVlLFxuICAgIH0pO1xuICB9XG59O1xuXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCB7XG4gIGFzeW5jIF9tYXliZVNldFVwUmVwbGljYXRpb24obmFtZSkge1xuICAgIGNvbnN0IHNlbGYgPSB0aGlzO1xuICAgIGlmIChcbiAgICAgICEoXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24gJiZcbiAgICAgICAgc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50ICYmXG4gICAgICAgIHNlbGYuX2Nvbm5lY3Rpb24ucmVnaXN0ZXJTdG9yZVNlcnZlclxuICAgICAgKVxuICAgICkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuXG4gICAgY29uc3Qgd3JhcHBlZFN0b3JlQ29tbW9uID0ge1xuICAgICAgLy8gQ2FsbGVkIGFyb3VuZCBtZXRob2Qgc3R1YiBpbnZvY2F0aW9ucyB0byBjYXB0dXJlIHRoZSBvcmlnaW5hbCB2ZXJzaW9uc1xuICAgICAgLy8gb2YgbW9kaWZpZWQgZG9jdW1lbnRzLlxuICAgICAgc2F2ZU9yaWdpbmFscygpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5zYXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgcmV0cmlldmVPcmlnaW5hbHMoKSB7XG4gICAgICAgIHJldHVybiBzZWxmLl9jb2xsZWN0aW9uLnJldHJpZXZlT3JpZ2luYWxzKCk7XG4gICAgICB9LFxuICAgICAgLy8gVG8gYmUgYWJsZSB0byBnZXQgYmFjayB0byB0aGUgY29sbGVjdGlvbiBmcm9tIHRoZSBzdG9yZS5cbiAgICAgIF9nZXRDb2xsZWN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc2VsZjtcbiAgICAgIH0sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVDbGllbnQgPSB7XG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGJlZ2lubmluZyBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuIGJhdGNoU2l6ZSBpcyB0aGUgbnVtYmVyXG4gICAgICAvLyBvZiB1cGRhdGUgY2FsbHMgdG8gZXhwZWN0LlxuICAgICAgLy9cbiAgICAgIC8vIFhYWCBUaGlzIGludGVyZmFjZSBpcyBwcmV0dHkgamFua3kuIHJlc2V0IHByb2JhYmx5IG91Z2h0IHRvIGdvIGJhY2sgdG9cbiAgICAgIC8vIGJlaW5nIGl0cyBvd24gZnVuY3Rpb24sIGFuZCBjYWxsZXJzIHNob3VsZG4ndCBoYXZlIHRvIGNhbGN1bGF0ZVxuICAgICAgLy8gYmF0Y2hTaXplLiBUaGUgb3B0aW1pemF0aW9uIG9mIG5vdCBjYWxsaW5nIHBhdXNlL3JlbW92ZSBzaG91bGQgYmVcbiAgICAgIC8vIGRlbGF5ZWQgdW50aWwgbGF0ZXI6IHRoZSBmaXJzdCBjYWxsIHRvIHVwZGF0ZSgpIHNob3VsZCBidWZmZXIgaXRzXG4gICAgICAvLyBtZXNzYWdlLCBhbmQgdGhlbiB3ZSBjYW4gZWl0aGVyIGRpcmVjdGx5IGFwcGx5IGl0IGF0IGVuZFVwZGF0ZSB0aW1lIGlmXG4gICAgICAvLyBpdCB3YXMgdGhlIG9ubHkgdXBkYXRlLCBvciBkbyBwYXVzZU9ic2VydmVycy9hcHBseS9hcHBseSBhdCB0aGUgbmV4dFxuICAgICAgLy8gdXBkYXRlKCkgaWYgdGhlcmUncyBhbm90aGVyIG9uZS5cbiAgICAgIGFzeW5jIGJlZ2luVXBkYXRlKGJhdGNoU2l6ZSwgcmVzZXQpIHtcbiAgICAgICAgLy8gcGF1c2Ugb2JzZXJ2ZXJzIHNvIHVzZXJzIGRvbid0IHNlZSBmbGlja2VyIHdoZW4gdXBkYXRpbmcgc2V2ZXJhbFxuICAgICAgICAvLyBvYmplY3RzIGF0IG9uY2UgKGluY2x1ZGluZyB0aGUgcG9zdC1yZWNvbm5lY3QgcmVzZXQtYW5kLXJlYXBwbHlcbiAgICAgICAgLy8gc3RhZ2UpLCBhbmQgc28gdGhhdCBhIHJlLXNvcnRpbmcgb2YgYSBxdWVyeSBjYW4gdGFrZSBhZHZhbnRhZ2Ugb2YgdGhlXG4gICAgICAgIC8vIGZ1bGwgX2RpZmZRdWVyeSBtb3ZlZCBjYWxjdWxhdGlvbiBpbnN0ZWFkIG9mIGFwcGx5aW5nIGNoYW5nZSBvbmUgYXQgYVxuICAgICAgICAvLyB0aW1lLlxuICAgICAgICBpZiAoYmF0Y2hTaXplID4gMSB8fCByZXNldCkgc2VsZi5fY29sbGVjdGlvbi5wYXVzZU9ic2VydmVycygpO1xuXG4gICAgICAgIGlmIChyZXNldCkgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUoe30pO1xuICAgICAgfSxcblxuICAgICAgLy8gQXBwbHkgYW4gdXBkYXRlLlxuICAgICAgLy8gWFhYIGJldHRlciBzcGVjaWZ5IHRoaXMgaW50ZXJmYWNlIChub3QgaW4gdGVybXMgb2YgYSB3aXJlIG1lc3NhZ2UpP1xuICAgICAgdXBkYXRlKG1zZykge1xuICAgICAgICB2YXIgbW9uZ29JZCA9IE1vbmdvSUQuaWRQYXJzZShtc2cuaWQpO1xuICAgICAgICB2YXIgZG9jID0gc2VsZi5fY29sbGVjdGlvbi5fZG9jcy5nZXQobW9uZ29JZCk7XG5cbiAgICAgICAgLy9XaGVuIHRoZSBzZXJ2ZXIncyBtZXJnZWJveCBpcyBkaXNhYmxlZCBmb3IgYSBjb2xsZWN0aW9uLCB0aGUgY2xpZW50IG11c3QgZ3JhY2VmdWxseSBoYW5kbGUgaXQgd2hlbjpcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYW4gYWRkZWQgbWVzc2FnZSBmb3IgYSBkb2N1bWVudCB0aGF0IGlzIGFscmVhZHkgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgY2hhbmdlZFxuICAgICAgICAvLyAqV2UgcmVlaXZlIGEgY2hhbmdlIG1lc3NhZ2UgZm9yIGEgZG9jdW1lbnQgdGhhdCBpcyBub3QgdGhlcmUuIEluc3RlYWQsIGl0IHdpbGwgYmUgYWRkZWRcbiAgICAgICAgLy8gKldlIHJlY2VpdmUgYSByZW1vdmVkIG1lc3NzYWdlIGZvciBhIGRvY3VtZW50IHRoYXQgaXMgbm90IHRoZXJlLiBJbnN0ZWFkLCBub3Rpbmcgd2lsIGhhcHBlbi5cblxuICAgICAgICAvL0NvZGUgaXMgZGVyaXZlZCBmcm9tIGNsaWVudC1zaWRlIGNvZGUgb3JpZ2luYWxseSBpbiBwZWVybGlicmFyeTpjb250cm9sLW1lcmdlYm94XG4gICAgICAgIC8vaHR0cHM6Ly9naXRodWIuY29tL3BlZXJsaWJyYXJ5L21ldGVvci1jb250cm9sLW1lcmdlYm94L2Jsb2IvbWFzdGVyL2NsaWVudC5jb2ZmZWVcblxuICAgICAgICAvL0ZvciBtb3JlIGluZm9ybWF0aW9uLCByZWZlciB0byBkaXNjdXNzaW9uIFwiSW5pdGlhbCBzdXBwb3J0IGZvciBwdWJsaWNhdGlvbiBzdHJhdGVnaWVzIGluIGxpdmVkYXRhIHNlcnZlclwiOlxuICAgICAgICAvL2h0dHBzOi8vZ2l0aHViLmNvbS9tZXRlb3IvbWV0ZW9yL3B1bGwvMTExNTFcbiAgICAgICAgaWYgKE1ldGVvci5pc0NsaWVudCkge1xuICAgICAgICAgIGlmIChtc2cubXNnID09PSAnYWRkZWQnICYmIGRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdjaGFuZ2VkJztcbiAgICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdyZW1vdmVkJyAmJiAhZG9jKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAnY2hhbmdlZCcgJiYgIWRvYykge1xuICAgICAgICAgICAgbXNnLm1zZyA9ICdhZGRlZCc7XG4gICAgICAgICAgICBjb25zdCBfcmVmID0gbXNnLmZpZWxkcztcbiAgICAgICAgICAgIGZvciAobGV0IGZpZWxkIGluIF9yZWYpIHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBfcmVmW2ZpZWxkXTtcbiAgICAgICAgICAgICAgaWYgKHZhbHVlID09PSB2b2lkIDApIHtcbiAgICAgICAgICAgICAgICBkZWxldGUgbXNnLmZpZWxkc1tmaWVsZF07XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy8gSXMgdGhpcyBhIFwicmVwbGFjZSB0aGUgd2hvbGUgZG9jXCIgbWVzc2FnZSBjb21pbmcgZnJvbSB0aGUgcXVpZXNjZW5jZVxuICAgICAgICAvLyBvZiBtZXRob2Qgd3JpdGVzIHRvIGFuIG9iamVjdD8gKE5vdGUgdGhhdCAndW5kZWZpbmVkJyBpcyBhIHZhbGlkXG4gICAgICAgIC8vIHZhbHVlIG1lYW5pbmcgXCJyZW1vdmUgaXRcIi4pXG4gICAgICAgIGlmIChtc2cubXNnID09PSAncmVwbGFjZScpIHtcbiAgICAgICAgICB2YXIgcmVwbGFjZSA9IG1zZy5yZXBsYWNlO1xuICAgICAgICAgIGlmICghcmVwbGFjZSkge1xuICAgICAgICAgICAgaWYgKGRvYykgc2VsZi5fY29sbGVjdGlvbi5yZW1vdmUobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydChyZXBsYWNlKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy8gWFhYIGNoZWNrIHRoYXQgcmVwbGFjZSBoYXMgbm8gJCBvcHNcbiAgICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24udXBkYXRlKG1vbmdvSWQsIHJlcGxhY2UpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2FkZGVkJykge1xuICAgICAgICAgIGlmIChkb2MpIHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIG5vdCB0byBmaW5kIGEgZG9jdW1lbnQgYWxyZWFkeSBwcmVzZW50IGZvciBhbiBhZGQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzZWxmLl9jb2xsZWN0aW9uLmluc2VydCh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlKG1vbmdvSWQpO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdjaGFuZ2VkJykge1xuICAgICAgICAgIGlmICghZG9jKSB0aHJvdyBuZXcgRXJyb3IoJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCB0byBjaGFuZ2UnKTtcbiAgICAgICAgICBjb25zdCBrZXlzID0gT2JqZWN0LmtleXMobXNnLmZpZWxkcyk7XG4gICAgICAgICAgaWYgKGtleXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgdmFyIG1vZGlmaWVyID0ge307XG4gICAgICAgICAgICBrZXlzLmZvckVhY2goa2V5ID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgdmFsdWUgPSBtc2cuZmllbGRzW2tleV07XG4gICAgICAgICAgICAgIGlmIChFSlNPTi5lcXVhbHMoZG9jW2tleV0sIHZhbHVlKSkge1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZiAodHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJykge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHVuc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXQgPSB7fTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgbW9kaWZpZXIuJHVuc2V0W2tleV0gPSAxO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGlmICghbW9kaWZpZXIuJHNldCkge1xuICAgICAgICAgICAgICAgICAgbW9kaWZpZXIuJHNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0W2tleV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMobW9kaWZpZXIpLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgc2VsZi5fY29sbGVjdGlvbi51cGRhdGUobW9uZ29JZCwgbW9kaWZpZXIpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJIGRvbid0IGtub3cgaG93IHRvIGRlYWwgd2l0aCB0aGlzIG1lc3NhZ2VcIik7XG4gICAgICAgIH1cbiAgICAgIH0sXG5cbiAgICAgIC8vIENhbGxlZCBhdCB0aGUgZW5kIG9mIGEgYmF0Y2ggb2YgdXBkYXRlcy5saXZlZGF0YV9jb25uZWN0aW9uLmpzOjEyODdcbiAgICAgIGVuZFVwZGF0ZSgpIHtcbiAgICAgICAgc2VsZi5fY29sbGVjdGlvbi5yZXN1bWVPYnNlcnZlcnNDbGllbnQoKTtcbiAgICAgIH0sXG5cbiAgICAgIC8vIFVzZWQgdG8gcHJlc2VydmUgY3VycmVudCB2ZXJzaW9ucyBvZiBkb2N1bWVudHMgYWNyb3NzIGEgc3RvcmUgcmVzZXQuXG4gICAgICBnZXREb2MoaWQpIHtcbiAgICAgICAgcmV0dXJuIHNlbGYuZmluZE9uZShpZCk7XG4gICAgICB9LFxuXG4gICAgICAuLi53cmFwcGVkU3RvcmVDb21tb24sXG4gICAgfTtcbiAgICBjb25zdCB3cmFwcGVkU3RvcmVTZXJ2ZXIgPSB7XG4gICAgICBhc3luYyBiZWdpblVwZGF0ZShiYXRjaFNpemUsIHJlc2V0KSB7XG4gICAgICAgIGlmIChiYXRjaFNpemUgPiAxIHx8IHJlc2V0KSBzZWxmLl9jb2xsZWN0aW9uLnBhdXNlT2JzZXJ2ZXJzKCk7XG5cbiAgICAgICAgaWYgKHJlc2V0KSBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHt9KTtcbiAgICAgIH0sXG5cbiAgICAgIGFzeW5jIHVwZGF0ZShtc2cpIHtcbiAgICAgICAgdmFyIG1vbmdvSWQgPSBNb25nb0lELmlkUGFyc2UobXNnLmlkKTtcbiAgICAgICAgdmFyIGRvYyA9IHNlbGYuX2NvbGxlY3Rpb24uX2RvY3MuZ2V0KG1vbmdvSWQpO1xuXG4gICAgICAgIC8vIElzIHRoaXMgYSBcInJlcGxhY2UgdGhlIHdob2xlIGRvY1wiIG1lc3NhZ2UgY29taW5nIGZyb20gdGhlIHF1aWVzY2VuY2VcbiAgICAgICAgLy8gb2YgbWV0aG9kIHdyaXRlcyB0byBhbiBvYmplY3Q/IChOb3RlIHRoYXQgJ3VuZGVmaW5lZCcgaXMgYSB2YWxpZFxuICAgICAgICAvLyB2YWx1ZSBtZWFuaW5nIFwicmVtb3ZlIGl0XCIuKVxuICAgICAgICBpZiAobXNnLm1zZyA9PT0gJ3JlcGxhY2UnKSB7XG4gICAgICAgICAgdmFyIHJlcGxhY2UgPSBtc2cucmVwbGFjZTtcbiAgICAgICAgICBpZiAoIXJlcGxhY2UpIHtcbiAgICAgICAgICAgIGlmIChkb2MpIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgICAgfSBlbHNlIGlmICghZG9jKSB7XG4gICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jKHJlcGxhY2UpO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvLyBYWFggY2hlY2sgdGhhdCByZXBsYWNlIGhhcyBubyAkIG9wc1xuICAgICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhtb25nb0lkLCByZXBsYWNlKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2UgaWYgKG1zZy5tc2cgPT09ICdhZGRlZCcpIHtcbiAgICAgICAgICBpZiAoZG9jKSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICdFeHBlY3RlZCBub3QgdG8gZmluZCBhIGRvY3VtZW50IGFscmVhZHkgcHJlc2VudCBmb3IgYW4gYWRkJ1xuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5pbnNlcnRBc3luYyh7IF9pZDogbW9uZ29JZCwgLi4ubXNnLmZpZWxkcyB9KTtcbiAgICAgICAgfSBlbHNlIGlmIChtc2cubXNnID09PSAncmVtb3ZlZCcpIHtcbiAgICAgICAgICBpZiAoIWRvYylcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAgICAgJ0V4cGVjdGVkIHRvIGZpbmQgYSBkb2N1bWVudCBhbHJlYWR5IHByZXNlbnQgZm9yIHJlbW92ZWQnXG4gICAgICAgICAgICApO1xuICAgICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW9uZ29JZCk7XG4gICAgICAgIH0gZWxzZSBpZiAobXNnLm1zZyA9PT0gJ2NoYW5nZWQnKSB7XG4gICAgICAgICAgaWYgKCFkb2MpIHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgdG8gZmluZCBhIGRvY3VtZW50IHRvIGNoYW5nZScpO1xuICAgICAgICAgIGNvbnN0IGtleXMgPSBPYmplY3Qua2V5cyhtc2cuZmllbGRzKTtcbiAgICAgICAgICBpZiAoa2V5cy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICB2YXIgbW9kaWZpZXIgPSB7fTtcbiAgICAgICAgICAgIGtleXMuZm9yRWFjaChrZXkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCB2YWx1ZSA9IG1zZy5maWVsZHNba2V5XTtcbiAgICAgICAgICAgICAgaWYgKEVKU09OLmVxdWFscyhkb2Nba2V5XSwgdmFsdWUpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kdW5zZXQpIHtcbiAgICAgICAgICAgICAgICAgIG1vZGlmaWVyLiR1bnNldCA9IHt9O1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBtb2RpZmllci4kdW5zZXRba2V5XSA9IDE7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaWYgKCFtb2RpZmllci4kc2V0KSB7XG4gICAgICAgICAgICAgICAgICBtb2RpZmllci4kc2V0ID0ge307XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIG1vZGlmaWVyLiRzZXRba2V5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhtb2RpZmllcikubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLnVwZGF0ZUFzeW5jKG1vbmdvSWQsIG1vZGlmaWVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiSSBkb24ndCBrbm93IGhvdyB0byBkZWFsIHdpdGggdGhpcyBtZXNzYWdlXCIpO1xuICAgICAgICB9XG4gICAgICB9LFxuXG4gICAgICAvLyBDYWxsZWQgYXQgdGhlIGVuZCBvZiBhIGJhdGNoIG9mIHVwZGF0ZXMuXG4gICAgICBhc3luYyBlbmRVcGRhdGUoKSB7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24ucmVzdW1lT2JzZXJ2ZXJzU2VydmVyKCk7XG4gICAgICB9LFxuXG4gICAgICAvLyBVc2VkIHRvIHByZXNlcnZlIGN1cnJlbnQgdmVyc2lvbnMgb2YgZG9jdW1lbnRzIGFjcm9zcyBhIHN0b3JlIHJlc2V0LlxuICAgICAgYXN5bmMgZ2V0RG9jKGlkKSB7XG4gICAgICAgIHJldHVybiBzZWxmLmZpbmRPbmVBc3luYyhpZCk7XG4gICAgICB9LFxuICAgICAgLi4ud3JhcHBlZFN0b3JlQ29tbW9uLFxuICAgIH07XG5cblxuICAgIC8vIE9LLCB3ZSdyZSBnb2luZyB0byBiZSBhIHNsYXZlLCByZXBsaWNhdGluZyBzb21lIHJlbW90ZVxuICAgIC8vIGRhdGFiYXNlLCBleGNlcHQgcG9zc2libHkgd2l0aCBzb21lIHRlbXBvcmFyeSBkaXZlcmdlbmNlIHdoaWxlXG4gICAgLy8gd2UgaGF2ZSB1bmFja25vd2xlZGdlZCBSUEMncy5cbiAgICBsZXQgcmVnaXN0ZXJTdG9yZVJlc3VsdDtcbiAgICBpZiAoTWV0ZW9yLmlzQ2xpZW50KSB7XG4gICAgICByZWdpc3RlclN0b3JlUmVzdWx0ID0gc2VsZi5fY29ubmVjdGlvbi5yZWdpc3RlclN0b3JlQ2xpZW50KFxuICAgICAgICBuYW1lLFxuICAgICAgICB3cmFwcGVkU3RvcmVDbGllbnRcbiAgICAgICk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlZ2lzdGVyU3RvcmVSZXN1bHQgPSBzZWxmLl9jb25uZWN0aW9uLnJlZ2lzdGVyU3RvcmVTZXJ2ZXIoXG4gICAgICAgIG5hbWUsXG4gICAgICAgIHdyYXBwZWRTdG9yZVNlcnZlclxuICAgICAgKTtcbiAgICB9XG5cbiAgICBjb25zdCBtZXNzYWdlID0gYFRoZXJlIGlzIGFscmVhZHkgYSBjb2xsZWN0aW9uIG5hbWVkIFwiJHtuYW1lfVwiYDtcbiAgICBjb25zdCBsb2dXYXJuID0gKCkgPT4ge1xuICAgICAgY29uc29sZS53YXJuID8gY29uc29sZS53YXJuKG1lc3NhZ2UpIDogY29uc29sZS5sb2cobWVzc2FnZSk7XG4gICAgfTtcblxuICAgIGlmICghcmVnaXN0ZXJTdG9yZVJlc3VsdCkge1xuICAgICAgcmV0dXJuIGxvZ1dhcm4oKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVnaXN0ZXJTdG9yZVJlc3VsdD8udGhlbj8uKG9rID0+IHtcbiAgICAgIGlmICghb2spIHtcbiAgICAgICAgbG9nV2FybigpO1xuICAgICAgfVxuICAgIH0pO1xuICB9LFxuXG4gIC8vL1xuICAvLy8gTWFpbiBjb2xsZWN0aW9uIEFQSVxuICAvLy9cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEdldHMgdGhlIG51bWJlciBvZiBkb2N1bWVudHMgbWF0Y2hpbmcgdGhlIGZpbHRlci4gRm9yIGEgZmFzdCBjb3VudCBvZiB0aGUgdG90YWwgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiBzZWUgYGVzdGltYXRlZERvY3VtZW50Q291bnRgLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCBjb3VudERvY3VtZW50c1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGNvdW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvNC4xMS9pbnRlcmZhY2VzL0NvdW50RG9jdW1lbnRzT3B0aW9ucy5odG1sKS4gUGxlYXNlIG5vdGUgdGhhdCBub3QgYWxsIG9mIHRoZW0gYXJlIGF2YWlsYWJsZSBvbiB0aGUgY2xpZW50LlxuICAgKiBAcmV0dXJucyB7UHJvbWlzZTxudW1iZXI+fVxuICAgKi9cbiAgY291bnREb2N1bWVudHMoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmNvdW50RG9jdW1lbnRzKC4uLmFyZ3MpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBHZXRzIGFuIGVzdGltYXRlIG9mIHRoZSBjb3VudCBvZiBkb2N1bWVudHMgaW4gYSBjb2xsZWN0aW9uIHVzaW5nIGNvbGxlY3Rpb24gbWV0YWRhdGEuIEZvciBhbiBleGFjdCBjb3VudCBvZiB0aGUgZG9jdW1lbnRzIGluIGEgY29sbGVjdGlvbiBzZWUgYGNvdW50RG9jdW1lbnRzYC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgZXN0aW1hdGVkRG9jdW1lbnRDb3VudFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXSBBbGwgb3B0aW9ucyBhcmUgbGlzdGVkIGluIFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS80LjExL2ludGVyZmFjZXMvRXN0aW1hdGVkRG9jdW1lbnRDb3VudE9wdGlvbnMuaHRtbCkuIFBsZWFzZSBub3RlIHRoYXQgbm90IGFsbCBvZiB0aGVtIGFyZSBhdmFpbGFibGUgb24gdGhlIGNsaWVudC5cbiAgICogQHJldHVybnMge1Byb21pc2U8bnVtYmVyPn1cbiAgICovXG4gIGVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmVzdGltYXRlZERvY3VtZW50Q291bnQoLi4uYXJncyk7XG4gIH0sXG5cbiAgX2dldEZpbmRTZWxlY3RvcihhcmdzKSB7XG4gICAgaWYgKGFyZ3MubGVuZ3RoID09IDApIHJldHVybiB7fTtcbiAgICBlbHNlIHJldHVybiBhcmdzWzBdO1xuICB9LFxuXG4gIF9nZXRGaW5kT3B0aW9ucyhhcmdzKSB7XG4gICAgY29uc3QgWywgb3B0aW9uc10gPSBhcmdzIHx8IFtdO1xuICAgIGNvbnN0IG5ld09wdGlvbnMgPSBub3JtYWxpemVQcm9qZWN0aW9uKG9wdGlvbnMpO1xuXG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmIChhcmdzLmxlbmd0aCA8IDIpIHtcbiAgICAgIHJldHVybiB7IHRyYW5zZm9ybTogc2VsZi5fdHJhbnNmb3JtIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGNoZWNrKFxuICAgICAgICBuZXdPcHRpb25zLFxuICAgICAgICBNYXRjaC5PcHRpb25hbChcbiAgICAgICAgICBNYXRjaC5PYmplY3RJbmNsdWRpbmcoe1xuICAgICAgICAgICAgcHJvamVjdGlvbjogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoT2JqZWN0LCB1bmRlZmluZWQpKSxcbiAgICAgICAgICAgIHNvcnQ6IE1hdGNoLk9wdGlvbmFsKFxuICAgICAgICAgICAgICBNYXRjaC5PbmVPZihPYmplY3QsIEFycmF5LCBGdW5jdGlvbiwgdW5kZWZpbmVkKVxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIGxpbWl0OiBNYXRjaC5PcHRpb25hbChNYXRjaC5PbmVPZihOdW1iZXIsIHVuZGVmaW5lZCkpLFxuICAgICAgICAgICAgc2tpcDogTWF0Y2guT3B0aW9uYWwoTWF0Y2guT25lT2YoTnVtYmVyLCB1bmRlZmluZWQpKSxcbiAgICAgICAgICB9KVxuICAgICAgICApXG4gICAgICApO1xuXG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHRyYW5zZm9ybTogc2VsZi5fdHJhbnNmb3JtLFxuICAgICAgICAuLi5uZXdPcHRpb25zLFxuICAgICAgfTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEZpbmQgdGhlIGRvY3VtZW50cyBpbiBhIGNvbGxlY3Rpb24gdGhhdCBtYXRjaCB0aGUgc2VsZWN0b3IuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5saW1pdCBNYXhpbXVtIG51bWJlciBvZiByZXN1bHRzIHRvIHJldHVyblxuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IGB0cnVlYDsgcGFzcyBgZmFsc2VgIHRvIGRpc2FibGUgcmVhY3Rpdml0eVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcHRpb25zLnRyYW5zZm9ybSBPdmVycmlkZXMgYHRyYW5zZm9ybWAgb24gdGhlICBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5kaXNhYmxlT3Bsb2cgKFNlcnZlciBvbmx5KSBQYXNzIHRydWUgdG8gZGlzYWJsZSBvcGxvZy10YWlsaW5nIG9uIHRoaXMgcXVlcnkuIFRoaXMgYWZmZWN0cyB0aGUgd2F5IHNlcnZlciBwcm9jZXNzZXMgY2FsbHMgdG8gYG9ic2VydmVgIG9uIHRoaXMgcXVlcnkuIERpc2FibGluZyB0aGUgb3Bsb2cgY2FuIGJlIHVzZWZ1bCB3aGVuIHdvcmtpbmcgd2l0aCBkYXRhIHRoYXQgdXBkYXRlcyBpbiBsYXJnZSBiYXRjaGVzLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nSW50ZXJ2YWxNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIGZyZXF1ZW5jeSAoaW4gbWlsbGlzZWNvbmRzKSBvZiBob3cgb2Z0ZW4gdG8gcG9sbCB0aGlzIHF1ZXJ5IHdoZW4gb2JzZXJ2aW5nIG9uIHRoZSBzZXJ2ZXIuIERlZmF1bHRzIHRvIDEwMDAwbXMgKDEwIHNlY29uZHMpLlxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5wb2xsaW5nVGhyb3R0bGVNcyAoU2VydmVyIG9ubHkpIFdoZW4gb3Bsb2cgaXMgZGlzYWJsZWQgKHRocm91Z2ggdGhlIHVzZSBvZiBgZGlzYWJsZU9wbG9nYCBvciB3aGVuIG90aGVyd2lzZSBub3QgYXZhaWxhYmxlKSwgdGhlIG1pbmltdW0gdGltZSAoaW4gbWlsbGlzZWNvbmRzKSB0byBhbGxvdyBiZXR3ZWVuIHJlLXBvbGxpbmcgd2hlbiBvYnNlcnZpbmcgb24gdGhlIHNlcnZlci4gSW5jcmVhc2luZyB0aGlzIHdpbGwgc2F2ZSBDUFUgYW5kIG1vbmdvIGxvYWQgYXQgdGhlIGV4cGVuc2Ugb2Ygc2xvd2VyIHVwZGF0ZXMgdG8gdXNlcnMuIERlY3JlYXNpbmcgdGhpcyBpcyBub3QgcmVjb21tZW5kZWQuIERlZmF1bHRzIHRvIDUwbXMuXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLm1heFRpbWVNcyAoU2VydmVyIG9ubHkpIElmIHNldCwgaW5zdHJ1Y3RzIE1vbmdvREIgdG8gc2V0IGEgdGltZSBsaW1pdCBmb3IgdGhpcyBjdXJzb3IncyBvcGVyYXRpb25zLiBJZiB0aGUgb3BlcmF0aW9uIHJlYWNoZXMgdGhlIHNwZWNpZmllZCB0aW1lIGxpbWl0IChpbiBtaWxsaXNlY29uZHMpIHdpdGhvdXQgdGhlIGhhdmluZyBiZWVuIGNvbXBsZXRlZCwgYW4gZXhjZXB0aW9uIHdpbGwgYmUgdGhyb3duLiBVc2VmdWwgdG8gcHJldmVudCBhbiAoYWNjaWRlbnRhbCBvciBtYWxpY2lvdXMpIHVub3B0aW1pemVkIHF1ZXJ5IGZyb20gY2F1c2luZyBhIGZ1bGwgY29sbGVjdGlvbiBzY2FuIHRoYXQgd291bGQgZGlzcnVwdCBvdGhlciBkYXRhYmFzZSB1c2VycywgYXQgdGhlIGV4cGVuc2Ugb2YgbmVlZGluZyB0byBoYW5kbGUgdGhlIHJlc3VsdGluZyBlcnJvci5cbiAgICogQHBhcmFtIHtTdHJpbmd8T2JqZWN0fSBvcHRpb25zLmhpbnQgKFNlcnZlciBvbmx5KSBPdmVycmlkZXMgTW9uZ29EQidzIGRlZmF1bHQgaW5kZXggc2VsZWN0aW9uIGFuZCBxdWVyeSBvcHRpbWl6YXRpb24gcHJvY2Vzcy4gU3BlY2lmeSBhbiBpbmRleCB0byBmb3JjZSBpdHMgdXNlLCBlaXRoZXIgYnkgaXRzIG5hbWUgb3IgaW5kZXggc3BlY2lmaWNhdGlvbi4gWW91IGNhbiBhbHNvIHNwZWNpZnkgYHsgJG5hdHVyYWwgOiAxIH1gIHRvIGZvcmNlIGEgZm9yd2FyZHMgY29sbGVjdGlvbiBzY2FuLCBvciBgeyAkbmF0dXJhbCA6IC0xIH1gIGZvciBhIHJldmVyc2UgY29sbGVjdGlvbiBzY2FuLiBTZXR0aW5nIHRoaXMgaXMgb25seSByZWNvbW1lbmRlZCBmb3IgYWR2YW5jZWQgdXNlcnMuXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciB0aGlzIHBhcnRpY3VsYXIgY3Vyc29yLiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge01vbmdvLkN1cnNvcn1cbiAgICovXG4gIGZpbmQoLi4uYXJncykge1xuICAgIC8vIENvbGxlY3Rpb24uZmluZCgpIChyZXR1cm4gYWxsIGRvY3MpIGJlaGF2ZXMgZGlmZmVyZW50bHlcbiAgICAvLyBmcm9tIENvbGxlY3Rpb24uZmluZCh1bmRlZmluZWQpIChyZXR1cm4gMCBkb2NzKS4gIHNvIGJlXG4gICAgLy8gY2FyZWZ1bCBhYm91dCB0aGUgbGVuZ3RoIG9mIGFyZ3VtZW50cy5cbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5maW5kKFxuICAgICAgdGhpcy5fZ2V0RmluZFNlbGVjdG9yKGFyZ3MpLFxuICAgICAgdGhpcy5fZ2V0RmluZE9wdGlvbnMoYXJncylcbiAgICApO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVBc3luY1xuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBbc2VsZWN0b3JdIEEgcXVlcnkgZGVzY3JpYmluZyB0aGUgZG9jdW1lbnRzIHRvIGZpbmRcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge01vbmdvU29ydFNwZWNpZmllcn0gb3B0aW9ucy5zb3J0IFNvcnQgb3JkZXIgKGRlZmF1bHQ6IG5hdHVyYWwgb3JkZXIpXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvcHRpb25zLnNraXAgTnVtYmVyIG9mIHJlc3VsdHMgdG8gc2tpcCBhdCB0aGUgYmVnaW5uaW5nXG4gICAqIEBwYXJhbSB7TW9uZ29GaWVsZFNwZWNpZmllcn0gb3B0aW9ucy5maWVsZHMgRGljdGlvbmFyeSBvZiBmaWVsZHMgdG8gcmV0dXJuIG9yIGV4Y2x1ZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5yZWFjdGl2ZSAoQ2xpZW50IG9ubHkpIERlZmF1bHQgdHJ1ZTsgcGFzcyBmYWxzZSB0byBkaXNhYmxlIHJlYWN0aXZpdHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3B0aW9ucy50cmFuc2Zvcm0gT3ZlcnJpZGVzIGB0cmFuc2Zvcm1gIG9uIHRoZSBbYENvbGxlY3Rpb25gXSgjY29sbGVjdGlvbnMpIGZvciB0aGlzIGN1cnNvci4gIFBhc3MgYG51bGxgIHRvIGRpc2FibGUgdHJhbnNmb3JtYXRpb24uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLnJlYWRQcmVmZXJlbmNlIChTZXJ2ZXIgb25seSkgU3BlY2lmaWVzIGEgY3VzdG9tIE1vbmdvREIgW2ByZWFkUHJlZmVyZW5jZWBdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9yZWFkLXByZWZlcmVuY2UpIGZvciBmZXRjaGluZyB0aGUgZG9jdW1lbnQuIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHByaW1hcnlgLCBgcHJpbWFyeVByZWZlcnJlZGAsIGBzZWNvbmRhcnlgLCBgc2Vjb25kYXJ5UHJlZmVycmVkYCBhbmQgYG5lYXJlc3RgLlxuICAgKiBAcmV0dXJucyB7T2JqZWN0fVxuICAgKi9cbiAgZmluZE9uZUFzeW5jKC4uLmFyZ3MpIHtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi5maW5kT25lQXN5bmMoXG4gICAgICB0aGlzLl9nZXRGaW5kU2VsZWN0b3IoYXJncyksXG4gICAgICB0aGlzLl9nZXRGaW5kT3B0aW9ucyhhcmdzKVxuICAgICk7XG4gIH0sXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBGaW5kcyB0aGUgZmlyc3QgZG9jdW1lbnQgdGhhdCBtYXRjaGVzIHRoZSBzZWxlY3RvciwgYXMgb3JkZXJlZCBieSBzb3J0IGFuZCBza2lwIG9wdGlvbnMuIFJldHVybnMgYHVuZGVmaW5lZGAgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnQgaXMgZm91bmQuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIGZpbmRPbmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gW3NlbGVjdG9yXSBBIHF1ZXJ5IGRlc2NyaWJpbmcgdGhlIGRvY3VtZW50cyB0byBmaW5kXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtNb25nb1NvcnRTcGVjaWZpZXJ9IG9wdGlvbnMuc29ydCBTb3J0IG9yZGVyIChkZWZhdWx0OiBuYXR1cmFsIG9yZGVyKVxuICAgKiBAcGFyYW0ge051bWJlcn0gb3B0aW9ucy5za2lwIE51bWJlciBvZiByZXN1bHRzIHRvIHNraXAgYXQgdGhlIGJlZ2lubmluZ1xuICAgKiBAcGFyYW0ge01vbmdvRmllbGRTcGVjaWZpZXJ9IG9wdGlvbnMuZmllbGRzIERpY3Rpb25hcnkgb2YgZmllbGRzIHRvIHJldHVybiBvciBleGNsdWRlLlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMucmVhY3RpdmUgKENsaWVudCBvbmx5KSBEZWZhdWx0IHRydWU7IHBhc3MgZmFsc2UgdG8gZGlzYWJsZSByZWFjdGl2aXR5XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wdGlvbnMudHJhbnNmb3JtIE92ZXJyaWRlcyBgdHJhbnNmb3JtYCBvbiB0aGUgW2BDb2xsZWN0aW9uYF0oI2NvbGxlY3Rpb25zKSBmb3IgdGhpcyBjdXJzb3IuICBQYXNzIGBudWxsYCB0byBkaXNhYmxlIHRyYW5zZm9ybWF0aW9uLlxuICAgKiBAcGFyYW0ge1N0cmluZ30gb3B0aW9ucy5yZWFkUHJlZmVyZW5jZSAoU2VydmVyIG9ubHkpIFNwZWNpZmllcyBhIGN1c3RvbSBNb25nb0RCIFtgcmVhZFByZWZlcmVuY2VgXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvcmVhZC1wcmVmZXJlbmNlKSBmb3IgZmV0Y2hpbmcgdGhlIGRvY3VtZW50LiBQb3NzaWJsZSB2YWx1ZXMgYXJlIGBwcmltYXJ5YCwgYHByaW1hcnlQcmVmZXJyZWRgLCBgc2Vjb25kYXJ5YCwgYHNlY29uZGFyeVByZWZlcnJlZGAgYW5kIGBuZWFyZXN0YC5cbiAgICogQHJldHVybnMge09iamVjdH1cbiAgICovXG4gIGZpbmRPbmUoLi4uYXJncykge1xuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLmZpbmRPbmUoXG4gICAgICB0aGlzLl9nZXRGaW5kU2VsZWN0b3IoYXJncyksXG4gICAgICB0aGlzLl9nZXRGaW5kT3B0aW9ucyhhcmdzKVxuICAgICk7XG4gIH0sXG59KTtcblxuT2JqZWN0LmFzc2lnbihNb25nby5Db2xsZWN0aW9uLCB7XG4gIGFzeW5jIF9wdWJsaXNoQ3Vyc29yKGN1cnNvciwgc3ViLCBjb2xsZWN0aW9uKSB7XG4gICAgdmFyIG9ic2VydmVIYW5kbGUgPSBhd2FpdCBjdXJzb3Iub2JzZXJ2ZUNoYW5nZXMoXG4gICAgICAgIHtcbiAgICAgICAgICBhZGRlZDogZnVuY3Rpb24oaWQsIGZpZWxkcykge1xuICAgICAgICAgICAgc3ViLmFkZGVkKGNvbGxlY3Rpb24sIGlkLCBmaWVsZHMpO1xuICAgICAgICAgIH0sXG4gICAgICAgICAgY2hhbmdlZDogZnVuY3Rpb24oaWQsIGZpZWxkcykge1xuICAgICAgICAgICAgc3ViLmNoYW5nZWQoY29sbGVjdGlvbiwgaWQsIGZpZWxkcyk7XG4gICAgICAgICAgfSxcbiAgICAgICAgICByZW1vdmVkOiBmdW5jdGlvbihpZCkge1xuICAgICAgICAgICAgc3ViLnJlbW92ZWQoY29sbGVjdGlvbiwgaWQpO1xuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFB1YmxpY2F0aW9ucyBkb24ndCBtdXRhdGUgdGhlIGRvY3VtZW50c1xuICAgICAgICAvLyBUaGlzIGlzIHRlc3RlZCBieSB0aGUgYGxpdmVkYXRhIC0gcHVibGlzaCBjYWxsYmFja3MgY2xvbmVgIHRlc3RcbiAgICAgICAgeyBub25NdXRhdGluZ0NhbGxiYWNrczogdHJ1ZSB9XG4gICAgKTtcblxuICAgIC8vIFdlIGRvbid0IGNhbGwgc3ViLnJlYWR5KCkgaGVyZTogaXQgZ2V0cyBjYWxsZWQgaW4gbGl2ZWRhdGFfc2VydmVyLCBhZnRlclxuICAgIC8vIHBvc3NpYmx5IGNhbGxpbmcgX3B1Ymxpc2hDdXJzb3Igb24gbXVsdGlwbGUgcmV0dXJuZWQgY3Vyc29ycy5cblxuICAgIC8vIHJlZ2lzdGVyIHN0b3AgY2FsbGJhY2sgKGV4cGVjdHMgbGFtYmRhIHcvIG5vIGFyZ3MpLlxuICAgIHN1Yi5vblN0b3AoYXN5bmMgZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gYXdhaXQgb2JzZXJ2ZUhhbmRsZS5zdG9wKCk7XG4gICAgfSk7XG5cbiAgICAvLyByZXR1cm4gdGhlIG9ic2VydmVIYW5kbGUgaW4gY2FzZSBpdCBuZWVkcyB0byBiZSBzdG9wcGVkIGVhcmx5XG4gICAgcmV0dXJuIG9ic2VydmVIYW5kbGU7XG4gIH0sXG5cbiAgLy8gcHJvdGVjdCBhZ2FpbnN0IGRhbmdlcm91cyBzZWxlY3RvcnMuICBmYWxzZXkgYW5kIHtfaWQ6IGZhbHNleX0gYXJlIGJvdGhcbiAgLy8gbGlrZWx5IHByb2dyYW1tZXIgZXJyb3IsIGFuZCBub3Qgd2hhdCB5b3Ugd2FudCwgcGFydGljdWxhcmx5IGZvciBkZXN0cnVjdGl2ZVxuICAvLyBvcGVyYXRpb25zLiBJZiBhIGZhbHNleSBfaWQgaXMgc2VudCBpbiwgYSBuZXcgc3RyaW5nIF9pZCB3aWxsIGJlXG4gIC8vIGdlbmVyYXRlZCBhbmQgcmV0dXJuZWQ7IGlmIGEgZmFsbGJhY2tJZCBpcyBwcm92aWRlZCwgaXQgd2lsbCBiZSByZXR1cm5lZFxuICAvLyBpbnN0ZWFkLlxuICBfcmV3cml0ZVNlbGVjdG9yKHNlbGVjdG9yLCB7IGZhbGxiYWNrSWQgfSA9IHt9KSB7XG4gICAgLy8gc2hvcnRoYW5kIC0tIHNjYWxhcnMgbWF0Y2ggX2lkXG4gICAgaWYgKExvY2FsQ29sbGVjdGlvbi5fc2VsZWN0b3JJc0lkKHNlbGVjdG9yKSkgc2VsZWN0b3IgPSB7IF9pZDogc2VsZWN0b3IgfTtcblxuICAgIGlmIChBcnJheS5pc0FycmF5KHNlbGVjdG9yKSkge1xuICAgICAgLy8gVGhpcyBpcyBjb25zaXN0ZW50IHdpdGggdGhlIE1vbmdvIGNvbnNvbGUgaXRzZWxmOyBpZiB3ZSBkb24ndCBkbyB0aGlzXG4gICAgICAvLyBjaGVjayBwYXNzaW5nIGFuIGVtcHR5IGFycmF5IGVuZHMgdXAgc2VsZWN0aW5nIGFsbCBpdGVtc1xuICAgICAgdGhyb3cgbmV3IEVycm9yKFwiTW9uZ28gc2VsZWN0b3IgY2FuJ3QgYmUgYW4gYXJyYXkuXCIpO1xuICAgIH1cblxuICAgIGlmICghc2VsZWN0b3IgfHwgKCdfaWQnIGluIHNlbGVjdG9yICYmICFzZWxlY3Rvci5faWQpKSB7XG4gICAgICAvLyBjYW4ndCBtYXRjaCBhbnl0aGluZ1xuICAgICAgcmV0dXJuIHsgX2lkOiBmYWxsYmFja0lkIHx8IFJhbmRvbS5pZCgpIH07XG4gICAgfVxuXG4gICAgcmV0dXJuIHNlbGVjdG9yO1xuICB9LFxufSk7XG5cbk9iamVjdC5hc3NpZ24oTW9uZ28uQ29sbGVjdGlvbi5wcm90b3R5cGUsIHtcbiAgLy8gJ2luc2VydCcgaW1tZWRpYXRlbHkgcmV0dXJucyB0aGUgaW5zZXJ0ZWQgZG9jdW1lbnQncyBuZXcgX2lkLlxuICAvLyBUaGUgb3RoZXJzIHJldHVybiB2YWx1ZXMgaW1tZWRpYXRlbHkgaWYgeW91IGFyZSBpbiBhIHN0dWIsIGFuIGluLW1lbW9yeVxuICAvLyB1bm1hbmFnZWQgY29sbGVjdGlvbiwgb3IgYSBtb25nby1iYWNrZWQgY29sbGVjdGlvbiBhbmQgeW91IGRvbid0IHBhc3MgYVxuICAvLyBjYWxsYmFjay4gJ3VwZGF0ZScgYW5kICdyZW1vdmUnIHJldHVybiB0aGUgbnVtYmVyIG9mIGFmZmVjdGVkXG4gIC8vIGRvY3VtZW50cy4gJ3Vwc2VydCcgcmV0dXJucyBhbiBvYmplY3Qgd2l0aCBrZXlzICdudW1iZXJBZmZlY3RlZCcgYW5kLCBpZiBhblxuICAvLyBpbnNlcnQgaGFwcGVuZWQsICdpbnNlcnRlZElkJy5cbiAgLy9cbiAgLy8gT3RoZXJ3aXNlLCB0aGUgc2VtYW50aWNzIGFyZSBleGFjdGx5IGxpa2Ugb3RoZXIgbWV0aG9kczogdGhleSB0YWtlXG4gIC8vIGEgY2FsbGJhY2sgYXMgYW4gb3B0aW9uYWwgbGFzdCBhcmd1bWVudDsgaWYgbm8gY2FsbGJhY2sgaXNcbiAgLy8gcHJvdmlkZWQsIHRoZXkgYmxvY2sgdW50aWwgdGhlIG9wZXJhdGlvbiBpcyBjb21wbGV0ZSwgYW5kIHRocm93IGFuXG4gIC8vIGV4Y2VwdGlvbiBpZiBpdCBmYWlsczsgaWYgYSBjYWxsYmFjayBpcyBwcm92aWRlZCwgdGhlbiB0aGV5IGRvbid0XG4gIC8vIG5lY2Vzc2FyaWx5IGJsb2NrLCBhbmQgdGhleSBjYWxsIHRoZSBjYWxsYmFjayB3aGVuIHRoZXkgZmluaXNoIHdpdGggZXJyb3IgYW5kXG4gIC8vIHJlc3VsdCBhcmd1bWVudHMuICAoVGhlIGluc2VydCBtZXRob2QgcHJvdmlkZXMgdGhlIGRvY3VtZW50IElEIGFzIGl0cyByZXN1bHQ7XG4gIC8vIHVwZGF0ZSBhbmQgcmVtb3ZlIHByb3ZpZGUgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2NzIGFzIHRoZSByZXN1bHQ7IHVwc2VydFxuICAvLyBwcm92aWRlcyBhbiBvYmplY3Qgd2l0aCBudW1iZXJBZmZlY3RlZCBhbmQgbWF5YmUgaW5zZXJ0ZWRJZC4pXG4gIC8vXG4gIC8vIE9uIHRoZSBjbGllbnQsIGJsb2NraW5nIGlzIGltcG9zc2libGUsIHNvIGlmIGEgY2FsbGJhY2tcbiAgLy8gaXNuJ3QgcHJvdmlkZWQsIHRoZXkganVzdCByZXR1cm4gaW1tZWRpYXRlbHkgYW5kIGFueSBlcnJvclxuICAvLyBpbmZvcm1hdGlvbiBpcyBsb3N0LlxuICAvL1xuICAvLyBUaGVyZSdzIG9uZSBtb3JlIHR3ZWFrLiBPbiB0aGUgY2xpZW50LCBpZiB5b3UgZG9uJ3QgcHJvdmlkZSBhXG4gIC8vIGNhbGxiYWNrLCB0aGVuIGlmIHRoZXJlIGlzIGFuIGVycm9yLCBhIG1lc3NhZ2Ugd2lsbCBiZSBsb2dnZWQgd2l0aFxuICAvLyBNZXRlb3IuX2RlYnVnLlxuICAvL1xuICAvLyBUaGUgaW50ZW50ICh0aG91Z2ggdGhpcyBpcyBhY3R1YWxseSBkZXRlcm1pbmVkIGJ5IHRoZSB1bmRlcmx5aW5nXG4gIC8vIGRyaXZlcnMpIGlzIHRoYXQgdGhlIG9wZXJhdGlvbnMgc2hvdWxkIGJlIGRvbmUgc3luY2hyb25vdXNseSwgbm90XG4gIC8vIGdlbmVyYXRpbmcgdGhlaXIgcmVzdWx0IHVudGlsIHRoZSBkYXRhYmFzZSBoYXMgYWNrbm93bGVkZ2VkXG4gIC8vIHRoZW0uIEluIHRoZSBmdXR1cmUgbWF5YmUgd2Ugc2hvdWxkIHByb3ZpZGUgYSBmbGFnIHRvIHR1cm4gdGhpc1xuICAvLyBvZmYuXG5cbiAgX2luc2VydChkb2MsIGNhbGxiYWNrKSB7XG4gICAgLy8gTWFrZSBzdXJlIHdlIHdlcmUgcGFzc2VkIGEgZG9jdW1lbnQgdG8gaW5zZXJ0XG4gICAgaWYgKCFkb2MpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignaW5zZXJ0IHJlcXVpcmVzIGFuIGFyZ3VtZW50Jyk7XG4gICAgfVxuXG5cbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjbG9uZSBvZiB0aGUgZG9jdW1lbnQsIHByZXNlcnZpbmcgaXRzIHByb3RvdHlwZS5cbiAgICBkb2MgPSBPYmplY3QuY3JlYXRlKFxuICAgICAgT2JqZWN0LmdldFByb3RvdHlwZU9mKGRvYyksXG4gICAgICBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9ycyhkb2MpXG4gICAgKTtcblxuICAgIGlmICgnX2lkJyBpbiBkb2MpIHtcbiAgICAgIGlmIChcbiAgICAgICAgIWRvYy5faWQgfHxcbiAgICAgICAgISh0eXBlb2YgZG9jLl9pZCA9PT0gJ3N0cmluZycgfHwgZG9jLl9pZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEKVxuICAgICAgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgICAnTWV0ZW9yIHJlcXVpcmVzIGRvY3VtZW50IF9pZCBmaWVsZHMgdG8gYmUgbm9uLWVtcHR5IHN0cmluZ3Mgb3IgT2JqZWN0SURzJ1xuICAgICAgICApO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBsZXQgZ2VuZXJhdGVJZCA9IHRydWU7XG5cbiAgICAgIC8vIERvbid0IGdlbmVyYXRlIHRoZSBpZCBpZiB3ZSdyZSB0aGUgY2xpZW50IGFuZCB0aGUgJ291dGVybW9zdCcgY2FsbFxuICAgICAgLy8gVGhpcyBvcHRpbWl6YXRpb24gc2F2ZXMgdXMgcGFzc2luZyBib3RoIHRoZSByYW5kb21TZWVkIGFuZCB0aGUgaWRcbiAgICAgIC8vIFBhc3NpbmcgYm90aCBpcyByZWR1bmRhbnQuXG4gICAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgICAgY29uc3QgZW5jbG9zaW5nID0gRERQLl9DdXJyZW50TWV0aG9kSW52b2NhdGlvbi5nZXQoKTtcbiAgICAgICAgaWYgKCFlbmNsb3NpbmcpIHtcbiAgICAgICAgICBnZW5lcmF0ZUlkID0gZmFsc2U7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKGdlbmVyYXRlSWQpIHtcbiAgICAgICAgZG9jLl9pZCA9IHRoaXMuX21ha2VOZXdJRCgpO1xuICAgICAgfVxuICAgIH1cblxuXG4gICAgLy8gT24gaW5zZXJ0cywgYWx3YXlzIHJldHVybiB0aGUgaWQgdGhhdCB3ZSBnZW5lcmF0ZWQ7IG9uIGFsbCBvdGhlclxuICAgIC8vIG9wZXJhdGlvbnMsIGp1c3QgcmV0dXJuIHRoZSByZXN1bHQgZnJvbSB0aGUgY29sbGVjdGlvbi5cbiAgICB2YXIgY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdCA9IGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgaWYgKE1ldGVvci5faXNQcm9taXNlKHJlc3VsdCkpIHJldHVybiByZXN1bHQ7XG5cbiAgICAgIGlmIChkb2MuX2lkKSB7XG4gICAgICAgIHJldHVybiBkb2MuX2lkO1xuICAgICAgfVxuXG4gICAgICAvLyBYWFggd2hhdCBpcyB0aGlzIGZvcj8/XG4gICAgICAvLyBJdCdzIHNvbWUgaXRlcmFjdGlvbiBiZXR3ZWVuIHRoZSBjYWxsYmFjayB0byBfY2FsbE11dGF0b3JNZXRob2QgYW5kXG4gICAgICAvLyB0aGUgcmV0dXJuIHZhbHVlIGNvbnZlcnNpb25cbiAgICAgIGRvYy5faWQgPSByZXN1bHQ7XG5cbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfTtcblxuICAgIGNvbnN0IHdyYXBwZWRDYWxsYmFjayA9IHdyYXBDYWxsYmFjayhcbiAgICAgIGNhbGxiYWNrLFxuICAgICAgY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdFxuICAgICk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kKCdpbnNlcnQnLCBbZG9jXSwgd3JhcHBlZENhbGxiYWNrKTtcbiAgICAgIHJldHVybiBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0KHJlc3VsdCk7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICB0cnkge1xuICAgICAgLy8gSWYgdGhlIHVzZXIgcHJvdmlkZWQgYSBjYWxsYmFjayBhbmQgdGhlIGNvbGxlY3Rpb24gaW1wbGVtZW50cyB0aGlzXG4gICAgICAvLyBvcGVyYXRpb24gYXN5bmNocm9ub3VzbHksIHRoZW4gcXVlcnlSZXQgd2lsbCBiZSB1bmRlZmluZWQsIGFuZCB0aGVcbiAgICAgIC8vIHJlc3VsdCB3aWxsIGJlIHJldHVybmVkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICBsZXQgcmVzdWx0O1xuICAgICAgaWYgKCEhd3JhcHBlZENhbGxiYWNrKSB7XG4gICAgICAgIHRoaXMuX2NvbGxlY3Rpb24uaW5zZXJ0KGRvYywgd3JhcHBlZENhbGxiYWNrKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIElmIHdlIGRvbid0IGhhdmUgdGhlIGNhbGxiYWNrLCB3ZSBhc3N1bWUgdGhlIHVzZXIgaXMgdXNpbmcgdGhlIHByb21pc2UuXG4gICAgICAgIC8vIFdlIGNhbid0IGp1c3QgcGFzcyB0aGlzLl9jb2xsZWN0aW9uLmluc2VydCB0byB0aGUgcHJvbWlzaWZ5IGJlY2F1c2UgaXQgd291bGQgbG9zZSB0aGUgY29udGV4dC5cbiAgICAgICAgcmVzdWx0ID0gdGhpcy5fY29sbGVjdGlvbi5pbnNlcnQoZG9jKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQocmVzdWx0KTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgICAgY2FsbGJhY2soZSk7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgICAgdGhyb3cgZTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEluc2VydCBhIGRvY3VtZW50IGluIHRoZSBjb2xsZWN0aW9uLiAgUmV0dXJucyBpdHMgdW5pcXVlIF9pZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGluc2VydFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGRvYyBUaGUgZG9jdW1lbnQgdG8gaW5zZXJ0LiBNYXkgbm90IHlldCBoYXZlIGFuIF9pZCBhdHRyaWJ1dGUsIGluIHdoaWNoIGNhc2UgTWV0ZW9yIHdpbGwgZ2VuZXJhdGUgb25lIGZvciB5b3UuXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja10gT3B0aW9uYWwuICBJZiBwcmVzZW50LCBjYWxsZWQgd2l0aCBhbiBlcnJvciBvYmplY3QgYXMgdGhlIGZpcnN0IGFyZ3VtZW50IGFuZCwgaWYgbm8gZXJyb3IsIHRoZSBfaWQgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIGluc2VydChkb2MsIGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIHRoaXMuX2luc2VydChkb2MsIGNhbGxiYWNrKTtcbiAgfSxcblxuICBhc3luYyBfaW5zZXJ0QXN5bmMoZG9jLCBvcHRpb25zID0ge30pIHtcbiAgICAvLyBNYWtlIHN1cmUgd2Ugd2VyZSBwYXNzZWQgYSBkb2N1bWVudCB0byBpbnNlcnRcbiAgICBpZiAoIWRvYykge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnQgcmVxdWlyZXMgYW4gYXJndW1lbnQnKTtcbiAgICB9XG5cbiAgICAvLyBNYWtlIGEgc2hhbGxvdyBjbG9uZSBvZiB0aGUgZG9jdW1lbnQsIHByZXNlcnZpbmcgaXRzIHByb3RvdHlwZS5cbiAgICBkb2MgPSBPYmplY3QuY3JlYXRlKFxuICAgICAgICBPYmplY3QuZ2V0UHJvdG90eXBlT2YoZG9jKSxcbiAgICAgICAgT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcnMoZG9jKVxuICAgICk7XG5cbiAgICBpZiAoJ19pZCcgaW4gZG9jKSB7XG4gICAgICBpZiAoXG4gICAgICAgICAgIWRvYy5faWQgfHxcbiAgICAgICAgICAhKHR5cGVvZiBkb2MuX2lkID09PSAnc3RyaW5nJyB8fCBkb2MuX2lkIGluc3RhbmNlb2YgTW9uZ28uT2JqZWN0SUQpXG4gICAgICApIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAgICAgJ01ldGVvciByZXF1aXJlcyBkb2N1bWVudCBfaWQgZmllbGRzIHRvIGJlIG5vbi1lbXB0eSBzdHJpbmdzIG9yIE9iamVjdElEcydcbiAgICAgICAgKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgbGV0IGdlbmVyYXRlSWQgPSB0cnVlO1xuXG4gICAgICAvLyBEb24ndCBnZW5lcmF0ZSB0aGUgaWQgaWYgd2UncmUgdGhlIGNsaWVudCBhbmQgdGhlICdvdXRlcm1vc3QnIGNhbGxcbiAgICAgIC8vIFRoaXMgb3B0aW1pemF0aW9uIHNhdmVzIHVzIHBhc3NpbmcgYm90aCB0aGUgcmFuZG9tU2VlZCBhbmQgdGhlIGlkXG4gICAgICAvLyBQYXNzaW5nIGJvdGggaXMgcmVkdW5kYW50LlxuICAgICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICAgIGNvbnN0IGVuY2xvc2luZyA9IEREUC5fQ3VycmVudE1ldGhvZEludm9jYXRpb24uZ2V0KCk7XG4gICAgICAgIGlmICghZW5jbG9zaW5nKSB7XG4gICAgICAgICAgZ2VuZXJhdGVJZCA9IGZhbHNlO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIGlmIChnZW5lcmF0ZUlkKSB7XG4gICAgICAgIGRvYy5faWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBPbiBpbnNlcnRzLCBhbHdheXMgcmV0dXJuIHRoZSBpZCB0aGF0IHdlIGdlbmVyYXRlZDsgb24gYWxsIG90aGVyXG4gICAgLy8gb3BlcmF0aW9ucywganVzdCByZXR1cm4gdGhlIHJlc3VsdCBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgIHZhciBjaG9vc2VSZXR1cm5WYWx1ZUZyb21Db2xsZWN0aW9uUmVzdWx0ID0gZnVuY3Rpb24ocmVzdWx0KSB7XG4gICAgICBpZiAoTWV0ZW9yLl9pc1Byb21pc2UocmVzdWx0KSkgcmV0dXJuIHJlc3VsdDtcblxuICAgICAgaWYgKGRvYy5faWQpIHtcbiAgICAgICAgcmV0dXJuIGRvYy5faWQ7XG4gICAgICB9XG5cbiAgICAgIC8vIFhYWCB3aGF0IGlzIHRoaXMgZm9yPz9cbiAgICAgIC8vIEl0J3Mgc29tZSBpdGVyYWN0aW9uIGJldHdlZW4gdGhlIGNhbGxiYWNrIHRvIF9jYWxsTXV0YXRvck1ldGhvZCBhbmRcbiAgICAgIC8vIHRoZSByZXR1cm4gdmFsdWUgY29udmVyc2lvblxuICAgICAgZG9jLl9pZCA9IHJlc3VsdDtcblxuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9O1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCdpbnNlcnRBc3luYycsIFtkb2NdLCBvcHRpb25zKTtcblxuICAgICAgcmV0dXJuIGNob29zZVJldHVyblZhbHVlRnJvbUNvbGxlY3Rpb25SZXN1bHQocmVzdWx0KTtcbiAgICB9XG5cbiAgICAvLyBpdCdzIG15IGNvbGxlY3Rpb24uICBkZXNjZW5kIGludG8gdGhlIGNvbGxlY3Rpb24gb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9jb2xsZWN0aW9uLmluc2VydEFzeW5jKGRvYyk7XG4gICAgICByZXR1cm4gY2hvb3NlUmV0dXJuVmFsdWVGcm9tQ29sbGVjdGlvblJlc3VsdChyZXN1bHQpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBJbnNlcnQgYSBkb2N1bWVudCBpbiB0aGUgY29sbGVjdGlvbi4gIFJldHVybnMgYSBwcm9taXNlIHRoYXQgd2lsbCByZXR1cm4gdGhlIGRvY3VtZW50J3MgdW5pcXVlIF9pZCB3aGVuIHNvbHZlZC5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgIGluc2VydFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGRvYyBUaGUgZG9jdW1lbnQgdG8gaW5zZXJ0LiBNYXkgbm90IHlldCBoYXZlIGFuIF9pZCBhdHRyaWJ1dGUsIGluIHdoaWNoIGNhc2UgTWV0ZW9yIHdpbGwgZ2VuZXJhdGUgb25lIGZvciB5b3UuXG4gICAqL1xuICBpbnNlcnRBc3luYyhkb2MsIG9wdGlvbnMpIHtcbiAgICByZXR1cm4gdGhpcy5faW5zZXJ0QXN5bmMoZG9jLCBvcHRpb25zKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgTW9kaWZ5IG9uZSBvciBtb3JlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbi4gUmV0dXJucyB0aGUgbnVtYmVyIG9mIG1hdGNoZWQgZG9jdW1lbnRzLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCB1cGRhdGVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy51cHNlcnQgVHJ1ZSB0byBpbnNlcnQgYSBkb2N1bWVudCBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgYXJlIGZvdW5kLlxuICAgKiBAcGFyYW0ge0FycmF5fSBvcHRpb25zLmFycmF5RmlsdGVycyBPcHRpb25hbC4gVXNlZCBpbiBjb21iaW5hdGlvbiB3aXRoIE1vbmdvREIgW2ZpbHRlcmVkIHBvc2l0aW9uYWwgb3BlcmF0b3JdKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvcmVmZXJlbmNlL29wZXJhdG9yL3VwZGF0ZS9wb3NpdGlvbmFsLWZpbHRlcmVkLykgdG8gc3BlY2lmeSB3aGljaCBlbGVtZW50cyB0byBtb2RpZnkgaW4gYW4gYXJyYXkgZmllbGQuXG4gICAqL1xuICBhc3luYyB1cGRhdGVBc3luYyhzZWxlY3RvciwgbW9kaWZpZXIsIC4uLm9wdGlvbnNBbmRDYWxsYmFjaykge1xuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBwb3BwZWQgb2ZmIHRoZSBjYWxsYmFjaywgc28gd2UgYXJlIGxlZnQgd2l0aCBhbiBhcnJheVxuICAgIC8vIG9mIG9uZSBvciB6ZXJvIGl0ZW1zXG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgLi4uKG9wdGlvbnNBbmRDYWxsYmFja1swXSB8fCBudWxsKSB9O1xuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICAvLyBzZXQgYGluc2VydGVkSWRgIGlmIGFic2VudC4gIGBpbnNlcnRlZElkYCBpcyBhIE1ldGVvciBleHRlbnNpb24uXG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRlZElkKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnRlZElkIG11c3QgYmUgc3RyaW5nIG9yIE9iamVjdElEJyk7XG4gICAgICAgIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICB9IGVsc2UgaWYgKCFzZWxlY3RvciB8fCAhc2VsZWN0b3IuX2lkKSB7XG4gICAgICAgIGluc2VydGVkSWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCA9IHRydWU7XG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHtcbiAgICAgIGZhbGxiYWNrSWQ6IGluc2VydGVkSWQsXG4gICAgfSk7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIGNvbnN0IGFyZ3MgPSBbc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zXTtcblxuICAgICAgcmV0dXJuIHRoaXMuX2NhbGxNdXRhdG9yTWV0aG9kQXN5bmMoJ3VwZGF0ZUFzeW5jJywgYXJncywgb3B0aW9ucyk7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICAgIC8vIElmIHRoZSB1c2VyIHByb3ZpZGVkIGEgY2FsbGJhY2sgYW5kIHRoZSBjb2xsZWN0aW9uIGltcGxlbWVudHMgdGhpc1xuICAgICAgLy8gb3BlcmF0aW9uIGFzeW5jaHJvbm91c2x5LCB0aGVuIHF1ZXJ5UmV0IHdpbGwgYmUgdW5kZWZpbmVkLCBhbmQgdGhlXG4gICAgICAvLyByZXN1bHQgd2lsbCBiZSByZXR1cm5lZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBpbnN0ZWFkLlxuICAgIC8vY29uc29sZS5sb2coe2NhbGxiYWNrLCBvcHRpb25zLCBzZWxlY3RvciwgbW9kaWZpZXIsIGNvbGw6IHRoaXMuX2NvbGxlY3Rpb259KTtcbiAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhcbiAgICAgIHNlbGVjdG9yLFxuICAgICAgbW9kaWZpZXIsXG4gICAgICBvcHRpb25zXG4gICAgKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgQXN5bmNocm9ub3VzbHkgbW9kaWZpZXMgb25lIG9yIG1vcmUgZG9jdW1lbnRzIGluIHRoZSBjb2xsZWN0aW9uLiBSZXR1cm5zIHRoZSBudW1iZXIgb2YgbWF0Y2hlZCBkb2N1bWVudHMuXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHVwZGF0ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIG1vZGlmeVxuICAgKiBAcGFyYW0ge01vbmdvTW9kaWZpZXJ9IG1vZGlmaWVyIFNwZWNpZmllcyBob3cgdG8gbW9kaWZ5IHRoZSBkb2N1bWVudHNcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMubXVsdGkgVHJ1ZSB0byBtb2RpZnkgYWxsIG1hdGNoaW5nIGRvY3VtZW50czsgZmFsc2UgdG8gb25seSBtb2RpZnkgb25lIG9mIHRoZSBtYXRjaGluZyBkb2N1bWVudHMgKHRoZSBkZWZhdWx0KS5cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVwc2VydCBUcnVlIHRvIGluc2VydCBhIGRvY3VtZW50IGlmIG5vIG1hdGNoaW5nIGRvY3VtZW50cyBhcmUgZm91bmQuXG4gICAqIEBwYXJhbSB7QXJyYXl9IG9wdGlvbnMuYXJyYXlGaWx0ZXJzIE9wdGlvbmFsLiBVc2VkIGluIGNvbWJpbmF0aW9uIHdpdGggTW9uZ29EQiBbZmlsdGVyZWQgcG9zaXRpb25hbCBvcGVyYXRvcl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2Uvb3BlcmF0b3IvdXBkYXRlL3Bvc2l0aW9uYWwtZmlsdGVyZWQvKSB0byBzcGVjaWZ5IHdoaWNoIGVsZW1lbnRzIHRvIG1vZGlmeSBpbiBhbiBhcnJheSBmaWVsZC5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NhbGxiYWNrXSBPcHRpb25hbC4gIElmIHByZXNlbnQsIGNhbGxlZCB3aXRoIGFuIGVycm9yIG9iamVjdCBhcyB0aGUgZmlyc3QgYXJndW1lbnQgYW5kLCBpZiBubyBlcnJvciwgdGhlIG51bWJlciBvZiBhZmZlY3RlZCBkb2N1bWVudHMgYXMgdGhlIHNlY29uZC5cbiAgICovXG4gIHVwZGF0ZShzZWxlY3RvciwgbW9kaWZpZXIsIC4uLm9wdGlvbnNBbmRDYWxsYmFjaykge1xuICAgIGNvbnN0IGNhbGxiYWNrID0gcG9wQ2FsbGJhY2tGcm9tQXJncyhvcHRpb25zQW5kQ2FsbGJhY2spO1xuXG4gICAgLy8gV2UndmUgYWxyZWFkeSBwb3BwZWQgb2ZmIHRoZSBjYWxsYmFjaywgc28gd2UgYXJlIGxlZnQgd2l0aCBhbiBhcnJheVxuICAgIC8vIG9mIG9uZSBvciB6ZXJvIGl0ZW1zXG4gICAgY29uc3Qgb3B0aW9ucyA9IHsgLi4uKG9wdGlvbnNBbmRDYWxsYmFja1swXSB8fCBudWxsKSB9O1xuICAgIGxldCBpbnNlcnRlZElkO1xuICAgIGlmIChvcHRpb25zICYmIG9wdGlvbnMudXBzZXJ0KSB7XG4gICAgICAvLyBzZXQgYGluc2VydGVkSWRgIGlmIGFic2VudC4gIGBpbnNlcnRlZElkYCBpcyBhIE1ldGVvciBleHRlbnNpb24uXG4gICAgICBpZiAob3B0aW9ucy5pbnNlcnRlZElkKSB7XG4gICAgICAgIGlmIChcbiAgICAgICAgICAhKFxuICAgICAgICAgICAgdHlwZW9mIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCBpbnN0YW5jZW9mIE1vbmdvLk9iamVjdElEXG4gICAgICAgICAgKVxuICAgICAgICApXG4gICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdpbnNlcnRlZElkIG11c3QgYmUgc3RyaW5nIG9yIE9iamVjdElEJyk7XG4gICAgICAgIGluc2VydGVkSWQgPSBvcHRpb25zLmluc2VydGVkSWQ7XG4gICAgICB9IGVsc2UgaWYgKCFzZWxlY3RvciB8fCAhc2VsZWN0b3IuX2lkKSB7XG4gICAgICAgIGluc2VydGVkSWQgPSB0aGlzLl9tYWtlTmV3SUQoKTtcbiAgICAgICAgb3B0aW9ucy5nZW5lcmF0ZWRJZCA9IHRydWU7XG4gICAgICAgIG9wdGlvbnMuaW5zZXJ0ZWRJZCA9IGluc2VydGVkSWQ7XG4gICAgICB9XG4gICAgfVxuXG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IsIHtcbiAgICAgIGZhbGxiYWNrSWQ6IGluc2VydGVkSWQsXG4gICAgfSk7XG5cbiAgICBjb25zdCB3cmFwcGVkQ2FsbGJhY2sgPSB3cmFwQ2FsbGJhY2soY2FsbGJhY2spO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICBjb25zdCBhcmdzID0gW3NlbGVjdG9yLCBtb2RpZmllciwgb3B0aW9uc107XG5cbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZCgndXBkYXRlJywgYXJncyk7XG4gICAgfVxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uIG9iamVjdFxuICAgIC8vIGFuZCBwcm9wYWdhdGUgYW55IGV4Y2VwdGlvbi5cbiAgICAvLyBJZiB0aGUgdXNlciBwcm92aWRlZCBhIGNhbGxiYWNrIGFuZCB0aGUgY29sbGVjdGlvbiBpbXBsZW1lbnRzIHRoaXNcbiAgICAvLyBvcGVyYXRpb24gYXN5bmNocm9ub3VzbHksIHRoZW4gcXVlcnlSZXQgd2lsbCBiZSB1bmRlZmluZWQsIGFuZCB0aGVcbiAgICAvLyByZXN1bHQgd2lsbCBiZSByZXR1cm5lZCB0aHJvdWdoIHRoZSBjYWxsYmFjayBpbnN0ZWFkLlxuICAgIC8vY29uc29sZS5sb2coe2NhbGxiYWNrLCBvcHRpb25zLCBzZWxlY3RvciwgbW9kaWZpZXIsIGNvbGw6IHRoaXMuX2NvbGxlY3Rpb259KTtcbiAgICB0cnkge1xuICAgICAgLy8gSWYgdGhlIHVzZXIgcHJvdmlkZWQgYSBjYWxsYmFjayBhbmQgdGhlIGNvbGxlY3Rpb24gaW1wbGVtZW50cyB0aGlzXG4gICAgICAvLyBvcGVyYXRpb24gYXN5bmNocm9ub3VzbHksIHRoZW4gcXVlcnlSZXQgd2lsbCBiZSB1bmRlZmluZWQsIGFuZCB0aGVcbiAgICAgIC8vIHJlc3VsdCB3aWxsIGJlIHJldHVybmVkIHRocm91Z2ggdGhlIGNhbGxiYWNrIGluc3RlYWQuXG4gICAgICByZXR1cm4gdGhpcy5fY29sbGVjdGlvbi51cGRhdGVBc3luYyhcbiAgICAgICAgc2VsZWN0b3IsXG4gICAgICAgIG1vZGlmaWVyLFxuICAgICAgICBvcHRpb25zLFxuICAgICAgICB3cmFwcGVkQ2FsbGJhY2tcbiAgICAgICk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgaWYgKGNhbGxiYWNrKSB7XG4gICAgICAgIGNhbGxiYWNrKGUpO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICAgIHRocm93IGU7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSByZW1vdmVzIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCByZW1vdmVcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byByZW1vdmVcbiAgICovXG4gIGFzeW5jIHJlbW92ZUFzeW5jKHNlbGVjdG9yLCBvcHRpb25zID0ge30pIHtcbiAgICBzZWxlY3RvciA9IE1vbmdvLkNvbGxlY3Rpb24uX3Jld3JpdGVTZWxlY3RvcihzZWxlY3Rvcik7XG5cbiAgICBpZiAodGhpcy5faXNSZW1vdGVDb2xsZWN0aW9uKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLl9jYWxsTXV0YXRvck1ldGhvZEFzeW5jKCdyZW1vdmVBc3luYycsIFtzZWxlY3Rvcl0sIG9wdGlvbnMpO1xuICAgIH1cblxuICAgIC8vIGl0J3MgbXkgY29sbGVjdGlvbi4gIGRlc2NlbmQgaW50byB0aGUgY29sbGVjdGlvbjEgb2JqZWN0XG4gICAgLy8gYW5kIHByb3BhZ2F0ZSBhbnkgZXhjZXB0aW9uLlxuICAgIHJldHVybiB0aGlzLl9jb2xsZWN0aW9uLnJlbW92ZUFzeW5jKHNlbGVjdG9yKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmVtb3ZlIGRvY3VtZW50cyBmcm9tIHRoZSBjb2xsZWN0aW9uXG4gICAqIEBsb2N1cyBBbnl3aGVyZVxuICAgKiBAbWV0aG9kIHJlbW92ZVxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtNb25nb1NlbGVjdG9yfSBzZWxlY3RvciBTcGVjaWZpZXMgd2hpY2ggZG9jdW1lbnRzIHRvIHJlbW92ZVxuICAgKi9cbiAgcmVtb3ZlKHNlbGVjdG9yKSB7XG4gICAgc2VsZWN0b3IgPSBNb25nby5Db2xsZWN0aW9uLl9yZXdyaXRlU2VsZWN0b3Ioc2VsZWN0b3IpO1xuXG4gICAgaWYgKHRoaXMuX2lzUmVtb3RlQ29sbGVjdGlvbigpKSB7XG4gICAgICByZXR1cm4gdGhpcy5fY2FsbE11dGF0b3JNZXRob2QoJ3JlbW92ZScsIFtzZWxlY3Rvcl0pO1xuICAgIH1cblxuXG4gICAgLy8gaXQncyBteSBjb2xsZWN0aW9uLiAgZGVzY2VuZCBpbnRvIHRoZSBjb2xsZWN0aW9uMSBvYmplY3RcbiAgICAvLyBhbmQgcHJvcGFnYXRlIGFueSBleGNlcHRpb24uXG4gICAgcmV0dXJuIHRoaXMuX2NvbGxlY3Rpb24ucmVtb3ZlKHNlbGVjdG9yKTtcbiAgfSxcblxuXG4gIC8vIERldGVybWluZSBpZiB0aGlzIGNvbGxlY3Rpb24gaXMgc2ltcGx5IGEgbWluaW1vbmdvIHJlcHJlc2VudGF0aW9uIG9mIGEgcmVhbFxuICAvLyBkYXRhYmFzZSBvbiBhbm90aGVyIHNlcnZlclxuICBfaXNSZW1vdGVDb2xsZWN0aW9uKCkge1xuICAgIC8vIFhYWCBzZWUgI01ldGVvclNlcnZlck51bGxcbiAgICByZXR1cm4gdGhpcy5fY29ubmVjdGlvbiAmJiB0aGlzLl9jb25uZWN0aW9uICE9PSBNZXRlb3Iuc2VydmVyO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBtb2RpZmllcyBvbmUgb3IgbW9yZSBkb2N1bWVudHMgaW4gdGhlIGNvbGxlY3Rpb24sIG9yIGluc2VydCBvbmUgaWYgbm8gbWF0Y2hpbmcgZG9jdW1lbnRzIHdlcmUgZm91bmQuIFJldHVybnMgYW4gb2JqZWN0IHdpdGgga2V5cyBgbnVtYmVyQWZmZWN0ZWRgICh0aGUgbnVtYmVyIG9mIGRvY3VtZW50cyBtb2RpZmllZCkgIGFuZCBgaW5zZXJ0ZWRJZGAgKHRoZSB1bmlxdWUgX2lkIG9mIHRoZSBkb2N1bWVudCB0aGF0IHdhcyBpbnNlcnRlZCwgaWYgYW55KS5cbiAgICogQGxvY3VzIEFueXdoZXJlXG4gICAqIEBtZXRob2QgdXBzZXJ0XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge01vbmdvU2VsZWN0b3J9IHNlbGVjdG9yIFNwZWNpZmllcyB3aGljaCBkb2N1bWVudHMgdG8gbW9kaWZ5XG4gICAqIEBwYXJhbSB7TW9uZ29Nb2RpZmllcn0gbW9kaWZpZXIgU3BlY2lmaWVzIGhvdyB0byBtb2RpZnkgdGhlIGRvY3VtZW50c1xuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5tdWx0aSBUcnVlIHRvIG1vZGlmeSBhbGwgbWF0Y2hpbmcgZG9jdW1lbnRzOyBmYWxzZSB0byBvbmx5IG1vZGlmeSBvbmUgb2YgdGhlIG1hdGNoaW5nIGRvY3VtZW50cyAodGhlIGRlZmF1bHQpLlxuICAgKi9cbiAgYXN5bmMgdXBzZXJ0QXN5bmMoc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlQXN5bmMoXG4gICAgICBzZWxlY3RvcixcbiAgICAgIG1vZGlmaWVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBfcmV0dXJuT2JqZWN0OiB0cnVlLFxuICAgICAgICB1cHNlcnQ6IHRydWUsXG4gICAgICB9KTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgTW9kaWZ5IG9uZSBvciBtb3JlIGRvY3VtZW50cyBpbiB0aGUgY29sbGVjdGlvbiwgb3IgaW5zZXJ0IG9uZSBpZiBubyBtYXRjaGluZyBkb2N1bWVudHMgd2VyZSBmb3VuZC4gUmV0dXJucyBhbiBvYmplY3Qgd2l0aCBrZXlzIGBudW1iZXJBZmZlY3RlZGAgKHRoZSBudW1iZXIgb2YgZG9jdW1lbnRzIG1vZGlmaWVkKSAgYW5kIGBpbnNlcnRlZElkYCAodGhlIHVuaXF1ZSBfaWQgb2YgdGhlIGRvY3VtZW50IHRoYXQgd2FzIGluc2VydGVkLCBpZiBhbnkpLlxuICAgKiBAbG9jdXMgQW55d2hlcmVcbiAgICogQG1ldGhvZCB1cHNlcnRcbiAgICogQG1lbWJlcm9mIE1vbmdvLkNvbGxlY3Rpb25cbiAgICogQGluc3RhbmNlXG4gICAqIEBwYXJhbSB7TW9uZ29TZWxlY3Rvcn0gc2VsZWN0b3IgU3BlY2lmaWVzIHdoaWNoIGRvY3VtZW50cyB0byBtb2RpZnlcbiAgICogQHBhcmFtIHtNb25nb01vZGlmaWVyfSBtb2RpZmllciBTcGVjaWZpZXMgaG93IHRvIG1vZGlmeSB0aGUgZG9jdW1lbnRzXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLm11bHRpIFRydWUgdG8gbW9kaWZ5IGFsbCBtYXRjaGluZyBkb2N1bWVudHM7IGZhbHNlIHRvIG9ubHkgbW9kaWZ5IG9uZSBvZiB0aGUgbWF0Y2hpbmcgZG9jdW1lbnRzICh0aGUgZGVmYXVsdCkuXG4gICAqL1xuICB1cHNlcnQoc2VsZWN0b3IsIG1vZGlmaWVyLCBvcHRpb25zKSB7XG4gICAgcmV0dXJuIHRoaXMudXBkYXRlKFxuICAgICAgc2VsZWN0b3IsXG4gICAgICBtb2RpZmllcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgX3JldHVybk9iamVjdDogdHJ1ZSxcbiAgICAgICAgdXBzZXJ0OiB0cnVlLFxuICAgICAgfSk7XG4gIH0sXG5cbiAgLy8gV2UnbGwgYWN0dWFsbHkgZGVzaWduIGFuIGluZGV4IEFQSSBsYXRlci4gRm9yIG5vdywgd2UganVzdCBwYXNzIHRocm91Z2ggdG9cbiAgLy8gTW9uZ28ncywgYnV0IG1ha2UgaXQgc3luY2hyb25vdXMuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBjcmVhdGVzIHRoZSBzcGVjaWZpZWQgaW5kZXggb24gdGhlIGNvbGxlY3Rpb24uXG4gICAqIEBsb2N1cyBzZXJ2ZXJcbiAgICogQG1ldGhvZCBlbnN1cmVJbmRleEFzeW5jXG4gICAqIEBkZXByZWNhdGVkIGluIDMuMFxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICogQHBhcmFtIHtPYmplY3R9IGluZGV4IEEgZG9jdW1lbnQgdGhhdCBjb250YWlucyB0aGUgZmllbGQgYW5kIHZhbHVlIHBhaXJzIHdoZXJlIHRoZSBmaWVsZCBpcyB0aGUgaW5kZXgga2V5IGFuZCB0aGUgdmFsdWUgZGVzY3JpYmVzIHRoZSB0eXBlIG9mIGluZGV4IGZvciB0aGF0IGZpZWxkLiBGb3IgYW4gYXNjZW5kaW5nIGluZGV4IG9uIGEgZmllbGQsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgMWA7IGZvciBkZXNjZW5kaW5nIGluZGV4LCBzcGVjaWZ5IGEgdmFsdWUgb2YgYC0xYC4gVXNlIGB0ZXh0YCBmb3IgdGV4dCBpbmRleGVzLlxuICAgKiBAcGFyYW0ge09iamVjdH0gW29wdGlvbnNdIEFsbCBvcHRpb25zIGFyZSBsaXN0ZWQgaW4gW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9yZWZlcmVuY2UvbWV0aG9kL2RiLmNvbGxlY3Rpb24uY3JlYXRlSW5kZXgvI29wdGlvbnMpXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvcHRpb25zLm5hbWUgTmFtZSBvZiB0aGUgaW5kZXhcbiAgICogQHBhcmFtIHtCb29sZWFufSBvcHRpb25zLnVuaXF1ZSBEZWZpbmUgdGhhdCB0aGUgaW5kZXggdmFsdWVzIG11c3QgYmUgdW5pcXVlLCBtb3JlIGF0IFtNb25nb0RCIGRvY3VtZW50YXRpb25dKGh0dHBzOi8vZG9jcy5tb25nb2RiLmNvbS9tYW51YWwvY29yZS9pbmRleC11bmlxdWUvKVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMuc3BhcnNlIERlZmluZSB0aGF0IHRoZSBpbmRleCBpcyBzcGFyc2UsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXNwYXJzZS8pXG4gICAqL1xuICBhc3luYyBlbnN1cmVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5lbnN1cmVJbmRleEFzeW5jIHx8ICFzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgY3JlYXRlSW5kZXhBc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICBpZiAoc2VsZi5fY29sbGVjdGlvbi5jcmVhdGVJbmRleEFzeW5jKSB7XG4gICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSB7XG4gICAgICBpbXBvcnQgeyBMb2cgfSBmcm9tICdtZXRlb3IvbG9nZ2luZyc7XG5cbiAgICAgIExvZy5kZWJ1ZyhgZW5zdXJlSW5kZXhBc3luYyBoYXMgYmVlbiBkZXByZWNhdGVkLCBwbGVhc2UgdXNlIHRoZSBuZXcgJ2NyZWF0ZUluZGV4QXN5bmMnIGluc3RlYWQkeyBvcHRpb25zPy5uYW1lID8gYCwgaW5kZXggbmFtZTogJHsgb3B0aW9ucy5uYW1lIH1gIDogYCwgaW5kZXg6ICR7IEpTT04uc3RyaW5naWZ5KGluZGV4KSB9YCB9YClcbiAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZW5zdXJlSW5kZXhBc3luYyhpbmRleCwgb3B0aW9ucyk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBBc3luY2hyb25vdXNseSBjcmVhdGVzIHRoZSBzcGVjaWZpZWQgaW5kZXggb24gdGhlIGNvbGxlY3Rpb24uXG4gICAqIEBsb2N1cyBzZXJ2ZXJcbiAgICogQG1ldGhvZCBjcmVhdGVJbmRleEFzeW5jXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5kZXggQSBkb2N1bWVudCB0aGF0IGNvbnRhaW5zIHRoZSBmaWVsZCBhbmQgdmFsdWUgcGFpcnMgd2hlcmUgdGhlIGZpZWxkIGlzIHRoZSBpbmRleCBrZXkgYW5kIHRoZSB2YWx1ZSBkZXNjcmliZXMgdGhlIHR5cGUgb2YgaW5kZXggZm9yIHRoYXQgZmllbGQuIEZvciBhbiBhc2NlbmRpbmcgaW5kZXggb24gYSBmaWVsZCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAxYDsgZm9yIGRlc2NlbmRpbmcgaW5kZXgsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgLTFgLiBVc2UgYHRleHRgIGZvciB0ZXh0IGluZGV4ZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9tZXRob2QvZGIuY29sbGVjdGlvbi5jcmVhdGVJbmRleC8jb3B0aW9ucylcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMubmFtZSBOYW1lIG9mIHRoZSBpbmRleFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudW5pcXVlIERlZmluZSB0aGF0IHRoZSBpbmRleCB2YWx1ZXMgbXVzdCBiZSB1bmlxdWUsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXVuaXF1ZS8pXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5zcGFyc2UgRGVmaW5lIHRoYXQgdGhlIGluZGV4IGlzIHNwYXJzZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtc3BhcnNlLylcbiAgICovXG4gIGFzeW5jIGNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgY3JlYXRlSW5kZXhBc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIGlmIChlLm1lc3NhZ2UuaW5jbHVkZXMoJ0FuIGVxdWl2YWxlbnQgaW5kZXggYWxyZWFkeSBleGlzdHMgd2l0aCB0aGUgc2FtZSBuYW1lIGJ1dCBkaWZmZXJlbnQgb3B0aW9ucy4nKSAmJiBNZXRlb3Iuc2V0dGluZ3M/LnBhY2thZ2VzPy5tb25nbz8ucmVDcmVhdGVJbmRleE9uT3B0aW9uTWlzbWF0Y2gpIHtcbiAgICAgICAgaW1wb3J0IHsgTG9nIH0gZnJvbSAnbWV0ZW9yL2xvZ2dpbmcnO1xuXG4gICAgICAgIExvZy5pbmZvKGBSZS1jcmVhdGluZyBpbmRleCAkeyBpbmRleCB9IGZvciAkeyBzZWxmLl9uYW1lIH0gZHVlIHRvIG9wdGlvbnMgbWlzbWF0Y2guYCk7XG4gICAgICAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZHJvcEluZGV4QXN5bmMoaW5kZXgpO1xuICAgICAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUluZGV4QXN5bmMoaW5kZXgsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihlKTtcbiAgICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcihgQW4gZXJyb3Igb2NjdXJyZWQgd2hlbiBjcmVhdGluZyBhbiBpbmRleCBmb3IgY29sbGVjdGlvbiBcIiR7IHNlbGYuX25hbWUgfTogJHsgZS5tZXNzYWdlIH1gKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBzdW1tYXJ5IEFzeW5jaHJvbm91c2x5IGNyZWF0ZXMgdGhlIHNwZWNpZmllZCBpbmRleCBvbiB0aGUgY29sbGVjdGlvbi5cbiAgICogQGxvY3VzIHNlcnZlclxuICAgKiBAbWV0aG9kIGNyZWF0ZUluZGV4XG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKiBAcGFyYW0ge09iamVjdH0gaW5kZXggQSBkb2N1bWVudCB0aGF0IGNvbnRhaW5zIHRoZSBmaWVsZCBhbmQgdmFsdWUgcGFpcnMgd2hlcmUgdGhlIGZpZWxkIGlzIHRoZSBpbmRleCBrZXkgYW5kIHRoZSB2YWx1ZSBkZXNjcmliZXMgdGhlIHR5cGUgb2YgaW5kZXggZm9yIHRoYXQgZmllbGQuIEZvciBhbiBhc2NlbmRpbmcgaW5kZXggb24gYSBmaWVsZCwgc3BlY2lmeSBhIHZhbHVlIG9mIGAxYDsgZm9yIGRlc2NlbmRpbmcgaW5kZXgsIHNwZWNpZnkgYSB2YWx1ZSBvZiBgLTFgLiBVc2UgYHRleHRgIGZvciB0ZXh0IGluZGV4ZXMuXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc10gQWxsIG9wdGlvbnMgYXJlIGxpc3RlZCBpbiBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL3JlZmVyZW5jZS9tZXRob2QvZGIuY29sbGVjdGlvbi5jcmVhdGVJbmRleC8jb3B0aW9ucylcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9wdGlvbnMubmFtZSBOYW1lIG9mIHRoZSBpbmRleFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IG9wdGlvbnMudW5pcXVlIERlZmluZSB0aGF0IHRoZSBpbmRleCB2YWx1ZXMgbXVzdCBiZSB1bmlxdWUsIG1vcmUgYXQgW01vbmdvREIgZG9jdW1lbnRhdGlvbl0oaHR0cHM6Ly9kb2NzLm1vbmdvZGIuY29tL21hbnVhbC9jb3JlL2luZGV4LXVuaXF1ZS8pXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gb3B0aW9ucy5zcGFyc2UgRGVmaW5lIHRoYXQgdGhlIGluZGV4IGlzIHNwYXJzZSwgbW9yZSBhdCBbTW9uZ29EQiBkb2N1bWVudGF0aW9uXShodHRwczovL2RvY3MubW9uZ29kYi5jb20vbWFudWFsL2NvcmUvaW5kZXgtc3BhcnNlLylcbiAgICovXG4gIGNyZWF0ZUluZGV4KGluZGV4LCBvcHRpb25zKXtcbiAgICByZXR1cm4gdGhpcy5jcmVhdGVJbmRleEFzeW5jKGluZGV4LCBvcHRpb25zKTtcbiAgfSxcblxuICBhc3luYyBkcm9wSW5kZXhBc3luYyhpbmRleCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICBpZiAoIXNlbGYuX2NvbGxlY3Rpb24uZHJvcEluZGV4QXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgZHJvcEluZGV4QXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgYXdhaXQgc2VsZi5fY29sbGVjdGlvbi5kcm9wSW5kZXhBc3luYyhpbmRleCk7XG4gIH0sXG5cbiAgYXN5bmMgZHJvcENvbGxlY3Rpb25Bc3luYygpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgaWYgKCFzZWxmLl9jb2xsZWN0aW9uLmRyb3BDb2xsZWN0aW9uQXN5bmMpXG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgZHJvcENvbGxlY3Rpb25Bc3luYyBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uZHJvcENvbGxlY3Rpb25Bc3luYygpO1xuICB9LFxuXG4gIGFzeW5jIGNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyhieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghIGF3YWl0IHNlbGYuX2NvbGxlY3Rpb24uY3JlYXRlQ2FwcGVkQ29sbGVjdGlvbkFzeW5jKVxuICAgICAgdGhyb3cgbmV3IEVycm9yKFxuICAgICAgICAnQ2FuIG9ubHkgY2FsbCBjcmVhdGVDYXBwZWRDb2xsZWN0aW9uQXN5bmMgb24gc2VydmVyIGNvbGxlY3Rpb25zJ1xuICAgICAgKTtcbiAgICBhd2FpdCBzZWxmLl9jb2xsZWN0aW9uLmNyZWF0ZUNhcHBlZENvbGxlY3Rpb25Bc3luYyhieXRlU2l6ZSwgbWF4RG9jdW1lbnRzKTtcbiAgfSxcblxuICAvKipcbiAgICogQHN1bW1hcnkgUmV0dXJucyB0aGUgW2BDb2xsZWN0aW9uYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9Db2xsZWN0aW9uLmh0bWwpIG9iamVjdCBjb3JyZXNwb25kaW5nIHRvIHRoaXMgY29sbGVjdGlvbiBmcm9tIHRoZSBbbnBtIGBtb25nb2RiYCBkcml2ZXIgbW9kdWxlXShodHRwczovL3d3dy5ucG1qcy5jb20vcGFja2FnZS9tb25nb2RiKSB3aGljaCBpcyB3cmFwcGVkIGJ5IGBNb25nby5Db2xsZWN0aW9uYC5cbiAgICogQGxvY3VzIFNlcnZlclxuICAgKiBAbWVtYmVyb2YgTW9uZ28uQ29sbGVjdGlvblxuICAgKiBAaW5zdGFuY2VcbiAgICovXG4gIHJhd0NvbGxlY3Rpb24oKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghc2VsZi5fY29sbGVjdGlvbi5yYXdDb2xsZWN0aW9uKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3Q29sbGVjdGlvbiBvbiBzZXJ2ZXIgY29sbGVjdGlvbnMnKTtcbiAgICB9XG4gICAgcmV0dXJuIHNlbGYuX2NvbGxlY3Rpb24ucmF3Q29sbGVjdGlvbigpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAc3VtbWFyeSBSZXR1cm5zIHRoZSBbYERiYF0oaHR0cDovL21vbmdvZGIuZ2l0aHViLmlvL25vZGUtbW9uZ29kYi1uYXRpdmUvMy4wL2FwaS9EYi5odG1sKSBvYmplY3QgY29ycmVzcG9uZGluZyB0byB0aGlzIGNvbGxlY3Rpb24ncyBkYXRhYmFzZSBjb25uZWN0aW9uIGZyb20gdGhlIFtucG0gYG1vbmdvZGJgIGRyaXZlciBtb2R1bGVdKGh0dHBzOi8vd3d3Lm5wbWpzLmNvbS9wYWNrYWdlL21vbmdvZGIpIHdoaWNoIGlzIHdyYXBwZWQgYnkgYE1vbmdvLkNvbGxlY3Rpb25gLlxuICAgKiBAbG9jdXMgU2VydmVyXG4gICAqIEBtZW1iZXJvZiBNb25nby5Db2xsZWN0aW9uXG4gICAqIEBpbnN0YW5jZVxuICAgKi9cbiAgcmF3RGF0YWJhc2UoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGlmICghKHNlbGYuX2RyaXZlci5tb25nbyAmJiBzZWxmLl9kcml2ZXIubW9uZ28uZGIpKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoJ0NhbiBvbmx5IGNhbGwgcmF3RGF0YWJhc2Ugb24gc2VydmVyIGNvbGxlY3Rpb25zJyk7XG4gICAgfVxuICAgIHJldHVybiBzZWxmLl9kcml2ZXIubW9uZ28uZGI7XG4gIH0sXG59KTtcblxuLy8gQ29udmVydCB0aGUgY2FsbGJhY2sgdG8gbm90IHJldHVybiBhIHJlc3VsdCBpZiB0aGVyZSBpcyBhbiBlcnJvclxuZnVuY3Rpb24gd3JhcENhbGxiYWNrKGNhbGxiYWNrLCBjb252ZXJ0UmVzdWx0KSB7XG4gIHJldHVybiAoXG4gICAgY2FsbGJhY2sgJiZcbiAgICBmdW5jdGlvbihlcnJvciwgcmVzdWx0KSB7XG4gICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgY2FsbGJhY2soZXJyb3IpO1xuICAgICAgfSBlbHNlIGlmICh0eXBlb2YgY29udmVydFJlc3VsdCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBjYWxsYmFjayhlcnJvciwgY29udmVydFJlc3VsdChyZXN1bHQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGNhbGxiYWNrKGVycm9yLCByZXN1bHQpO1xuICAgICAgfVxuICAgIH1cbiAgKTtcbn1cblxuLyoqXG4gKiBAc3VtbWFyeSBDcmVhdGUgYSBNb25nby1zdHlsZSBgT2JqZWN0SURgLiAgSWYgeW91IGRvbid0IHNwZWNpZnkgYSBgaGV4U3RyaW5nYCwgdGhlIGBPYmplY3RJRGAgd2lsbCBnZW5lcmF0ZWQgcmFuZG9tbHkgKG5vdCB1c2luZyBNb25nb0RCJ3MgSUQgY29uc3RydWN0aW9uIHJ1bGVzKS5cbiAqIEBsb2N1cyBBbnl3aGVyZVxuICogQGNsYXNzXG4gKiBAcGFyYW0ge1N0cmluZ30gW2hleFN0cmluZ10gT3B0aW9uYWwuICBUaGUgMjQtY2hhcmFjdGVyIGhleGFkZWNpbWFsIGNvbnRlbnRzIG9mIHRoZSBPYmplY3RJRCB0byBjcmVhdGVcbiAqL1xuTW9uZ28uT2JqZWN0SUQgPSBNb25nb0lELk9iamVjdElEO1xuXG4vKipcbiAqIEBzdW1tYXJ5IFRvIGNyZWF0ZSBhIGN1cnNvciwgdXNlIGZpbmQuIFRvIGFjY2VzcyB0aGUgZG9jdW1lbnRzIGluIGEgY3Vyc29yLCB1c2UgZm9yRWFjaCwgbWFwLCBvciBmZXRjaC5cbiAqIEBjbGFzc1xuICogQGluc3RhbmNlTmFtZSBjdXJzb3JcbiAqL1xuTW9uZ28uQ3Vyc29yID0gTG9jYWxDb2xsZWN0aW9uLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLkN1cnNvciA9IE1vbmdvLkN1cnNvcjtcblxuLyoqXG4gKiBAZGVwcmVjYXRlZCBpbiAwLjkuMVxuICovXG5Nb25nby5Db2xsZWN0aW9uLk9iamVjdElEID0gTW9uZ28uT2JqZWN0SUQ7XG5cbi8qKlxuICogQGRlcHJlY2F0ZWQgaW4gMC45LjFcbiAqL1xuTWV0ZW9yLkNvbGxlY3Rpb24gPSBNb25nby5Db2xsZWN0aW9uO1xuXG4vLyBBbGxvdyBkZW55IHN0dWZmIGlzIG5vdyBpbiB0aGUgYWxsb3ctZGVueSBwYWNrYWdlXG5PYmplY3QuYXNzaWduKE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlLCBBbGxvd0RlbnkuQ29sbGVjdGlvblByb3RvdHlwZSk7XG5cbmZ1bmN0aW9uIHBvcENhbGxiYWNrRnJvbUFyZ3MoYXJncykge1xuICAvLyBQdWxsIG9mZiBhbnkgY2FsbGJhY2sgKG9yIHBlcmhhcHMgYSAnY2FsbGJhY2snIHZhcmlhYmxlIHRoYXQgd2FzIHBhc3NlZFxuICAvLyBpbiB1bmRlZmluZWQsIGxpa2UgaG93ICd1cHNlcnQnIGRvZXMgaXQpLlxuICBpZiAoXG4gICAgYXJncy5sZW5ndGggJiZcbiAgICAoYXJnc1thcmdzLmxlbmd0aCAtIDFdID09PSB1bmRlZmluZWQgfHxcbiAgICAgIGFyZ3NbYXJncy5sZW5ndGggLSAxXSBpbnN0YW5jZW9mIEZ1bmN0aW9uKVxuICApIHtcbiAgICByZXR1cm4gYXJncy5wb3AoKTtcbiAgfVxufVxuXG5cbi8vIFhYWDogSU4gTWV0ZW9yIDMueCB0aGlzIGNvZGUgd2FzIG5vdCB3b3JraW5nLi4uLlxuLy8gSXQgdGhyb3dzIGFuIGVycm9yIHdoZW4gdHJ5aW5nIHRvIGNhbGwgYSBtZXRob2Qgb24gdGhlIGNvbGxlY3Rpb24uXG4vLyB0aGUgZXJyb3Igbm9ybWFsbHkgaXM6XG4vLyBUeXBlRXJyb3I6IHRoaXNbbWV0aG9kTmFtZV0gaXMgbm90IGEgZnVuY3Rpb25cbi8vIEFTWU5DX0NPTExFQ1RJT05fTUVUSE9EUy5mb3JFYWNoKG1ldGhvZE5hbWUgPT4ge1xuLy8gICBjb25zdCBtZXRob2ROYW1lQXN5bmMgPSBnZXRBc3luY01ldGhvZE5hbWUobWV0aG9kTmFtZSk7XG4vLyAgIE1vbmdvLkNvbGxlY3Rpb24ucHJvdG90eXBlW21ldGhvZE5hbWVBc3luY10gPSBmdW5jdGlvbiguLi5hcmdzKSB7XG4vLyAgICAgdHJ5IHtcbi8vICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpc1ttZXRob2ROYW1lXSguLi5hcmdzKSk7XG4vLyAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbi8vICAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChlcnJvcik7XG4vLyAgICAgfVxuLy8gICB9O1xuLy8gfSk7XG4iLCIvKipcbiAqIEBzdW1tYXJ5IEFsbG93cyBmb3IgdXNlciBzcGVjaWZpZWQgY29ubmVjdGlvbiBvcHRpb25zXG4gKiBAZXhhbXBsZSBodHRwOi8vbW9uZ29kYi5naXRodWIuaW8vbm9kZS1tb25nb2RiLW5hdGl2ZS8zLjAvcmVmZXJlbmNlL2Nvbm5lY3RpbmcvY29ubmVjdGlvbi1zZXR0aW5ncy9cbiAqIEBsb2N1cyBTZXJ2ZXJcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIFVzZXIgc3BlY2lmaWVkIE1vbmdvIGNvbm5lY3Rpb24gb3B0aW9uc1xuICovXG5Nb25nby5zZXRDb25uZWN0aW9uT3B0aW9ucyA9IGZ1bmN0aW9uIHNldENvbm5lY3Rpb25PcHRpb25zIChvcHRpb25zKSB7XG4gIGNoZWNrKG9wdGlvbnMsIE9iamVjdCk7XG4gIE1vbmdvLl9jb25uZWN0aW9uT3B0aW9ucyA9IG9wdGlvbnM7XG59OyIsImV4cG9ydCBjb25zdCBub3JtYWxpemVQcm9qZWN0aW9uID0gb3B0aW9ucyA9PiB7XG4gIC8vIHRyYW5zZm9ybSBmaWVsZHMga2V5IGluIHByb2plY3Rpb25cbiAgY29uc3QgeyBmaWVsZHMsIHByb2plY3Rpb24sIC4uLm90aGVyT3B0aW9ucyB9ID0gb3B0aW9ucyB8fCB7fTtcbiAgLy8gVE9ETzogZW5hYmxlIHRoaXMgY29tbWVudCB3aGVuIGRlcHJlY2F0aW5nIHRoZSBmaWVsZHMgb3B0aW9uXG4gIC8vIExvZy5kZWJ1ZyhgZmllbGRzIG9wdGlvbiBoYXMgYmVlbiBkZXByZWNhdGVkLCBwbGVhc2UgdXNlIHRoZSBuZXcgJ3Byb2plY3Rpb24nIGluc3RlYWRgKVxuXG4gIHJldHVybiB7XG4gICAgLi4ub3RoZXJPcHRpb25zLFxuICAgIC4uLihwcm9qZWN0aW9uIHx8IGZpZWxkcyA/IHsgcHJvamVjdGlvbjogZmllbGRzIHx8IHByb2plY3Rpb24gfSA6IHt9KSxcbiAgfTtcbn07XG4iXX0=

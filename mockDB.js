var uuid = require('node-uuid');

module.exports = function() {
    var self = this;
    var collections = [];

    self.addCollection = function(collectionName, find, group, insert, save, documents) {
        var collection = null;

        for (var i in collections) {
            if (collections[i].name == collectionName) {
                collection = collections[i];
                break;
            }
        }

        if (!collection) {
            collection = new MockCollection(collectionName, documents);
            collections.push(collection);
        }

        if (find) {
            collection.findCallback = find;
        }

        if (group) {
            collection.groupCallback = group;
        }

        if (insert) {
            collection.insertCallback = insert;
        }

        if (save) {
            collection.saveCallback = save;
        }

        return collection;
    };

    self.collection = function(collectionName, callback) {
        var collection = null;

        for (var i in collections) {
            if (collections[i].name == collectionName) {
                collection = collections[i];
                break;
            }
        }

        callback(null, collection);
    };

    self.open = function(callback) {
        callback(null);
    };
};

var MockCollection = function(collectionName, documents) {
    var self = this;

    self.name = collectionName;

    self.findCallback = null;
    self.findCalled = 0;                // Indicates how many times the "find" operation is called

    self.groupCallback = null;
    self.groupCalled = 0;               // Indicates how many times the "group" operation is called

    self.insertCallback = null;
    self.insertCalled = 0;              // Indicates how many times the "insert" operation is called

    self.saveCallback = null;
    self.saveCalled = 0;                // Indicates how many times the "save" operation is called

    if (!documents || !(documents instanceof Array)) {
        documents = [];
    }

    var getPath = function(parent, path) {
        var pathSplit = path.split('.');
        var current = parent;

        if (!current) {
            return;
        }

        for (var i in pathSplit) {
            current = current[pathSplit[i]];

            if (!current) {
                return;
            }
        }

        return current;
    }

    var queryCompartment = function(parent, key, value) {
        switch (key) {
            case '$and':
            case '$or':
                for (var i in value) {
                    var valueResult = queryCompartment(parent, i, value[i]);

                    if (key == '$and' && !valueResult) {
                        return false;
                    } else if (key == '$or' && valueResult) {
                        return true;
                    }
                }

                if (key == '$and') {
                    return true;
                } else {
                    return false;
                }
            case '$ne':
                var parentString = parent != undefined && parent != null ? parent.toString() : parent;
                var valueString = value != undefined && value != null ? value.toString() : value;
                return parentString != valueString;
            case '$elemMatch':
                if (parent instanceof Array) {
                    for (var i in parent) {
                        var match = true;

                        for (var x in value) {
                            var valueResult = queryCompartment(parent[i], x, value[x]);

                            if (!valueResult) {
                                match = false;
                            }
                        }

                        if (match) {
                            return true;
                        }
                    }
                } else {
                    return false;
                }
            default:
                var next = getPath(parent, key);

                if (typeof value == 'object') {
                    for (var i in value) {
                        var valueResult = queryCompartment(next, i, value[i]);

                        if (!valueResult) {
                            return false;
                        }
                    }
                } else {
                    return next == value;
                }

                return true;
        }
    };

    var findDocuments = function(query) {
        var retDocuments = [];

        for (var i in documents) {
            var queryResults = queryCompartment(documents[i], '$and', query);

            if (queryResults) {
                retDocuments.push(documents[i]);
            }
        }

        return retDocuments;
    };

    var groupDocuments = function(docs, keys) {
        var groups = {};

        if (keys.length != 1) {
            throw 'Grouping by more then one key is not supported!';
        }

        for (var i in docs) {
            var docKey = getPath(docs[i], keys[0]);

            if (!groups[docKey]) {
                groups[docKey] = [];
            }

            groups[docKey].push(docs[i]);
        }

        return groups;
    };

    var reduceGroup = function(groups, initialObj, reduce) {
        var ret = [];

        for (var i in groups) {
            var currentInitial = initialObj ? JSON.parse(JSON.stringify(initialObj)) : {};

            for (var x in groups[i]) {
                reduce(groups[i][x], currentInitial);
            }

            ret.push(currentInitial);
        }

        return ret;
    };

    self.find = function(query, options, callback) {
        // Re-set arguments to handle optional args
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        query = args.shift();
        callback = args.pop();
        if (args.length > 0) options = args.shift(); else options = null;

        var results = findDocuments(query);

        if (self.findCallback) {
            var result = self.findCallback(arguments);
            if (result) {
                results = result;
            }
        }

        self.findCalled++;

        // return
        callback(null, results);
    };

    self.group = function(keys, condition, initial, reduce, finalize, command, options, callback) {
        // Re-set arguments to handle optional args
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        keys = args.shift();
        condition = args.shift();
        initial = args.shift();
        reduce = args.shift();
        finalize = args.shift();
        callback = args.pop();
        if (args.length > 0) command = args.shift(); else command = null;
        if (args.length > 0) options = args.shift(); else options = null;

        var results = findDocuments(condition);
        results = groupDocuments(results, keys);

        if (reduce) {
            results = reduceGroup(results, initial, reduce);
        }

        if (self.groupCallback) {
            var result = self.groupCallback(arguments);
            if (result) {
                results = result;
            }
        }

        self.groupCalled++;

        // return
        callback(null, results);
    };

    self.insert = function(document, options, callback) {
        // Re-set arguments to handle optional args
        var args = [];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        document = args.shift();
        callback = args.pop();
        if (args.length > 0) options = args.shift(); else options = null;

        var clone = JSON.parse(JSON.stringify(document));
        var results = [JSON.parse(JSON.stringify(clone))];

        if (self.insertCallback) {
            var result = self.insertCallback(arguments);
            if (result) {
                results = [result];
            }
        }

        clone._id = uuid.v4();
        documents.push(clone);

        self.insertCalled++;

        // return
        callback(null, results);
    };

    self.save = function(document, callback) {
        self.saveCalled++;
        var clone = JSON.parse(JSON.stringify(document));

        if (document._id) {
            for (var i in documents) {
                if (documents[i]._id = clone._id) {
                    documents.splice(i, 1, clone);
                    callback(null, [clone]);
                    return;
                }
            }
        } else {
            document._id = uuid.v4();
            documents.push(clone);
            callback(null, [JSON.parse(JSON.stringify(clone))]);
            return;
        }
    };
};
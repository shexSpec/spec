var Validator = (function () {
// Self-calibrating time-waster
function createBurner (iter) {
  var Second = 1;

  for (var i = 0; i < iter; ++i) {
    burn(100);
  }
  return burn;

  function burn (msec) {
    var start = Date.now();
    for (var outer = 0; outer < Second * msec/1000; ++outer)
      for (var inner = 0; inner < 10000000; ++inner)
        ;
    var end = Date.now();
    Second = Second * msec / (end - start);
    // console.log(Second);
  }
}
var Burn = createBurner(5);

return {
  // Would be constructed with a schema but deps are expressed in the table.
  create: function (fixedMap) {

    var index = _indexShapeMap(fixedMap);
    var deps = fixedMap.reduce((ret, ent) => {
      ret[indexKey(ent.node, ent.shape)] = getAllDependencies(ent);
      return ret;
    }, {});

    return { validate: validate };

    function getAllDependencies (ent) {
      if (ent.depNode === null)
        return [];
      var depKey = indexKey(ent.depNode, ent.depShape);
      var ret = [depKey];
      var refd = index[depKey];
      if (refd)
        ret = ret.concat(getAllDependencies(refd));
      return ret;
    }

    function validate (query, premise) {
      return query.reduce((ret, ent) => {
        var passes = ent.node.substr(1) === ent.shape.substr(1);
        var verdict = passes ? "pass" : "fail";
        var key = indexKey(ent.node, ent.shape);
        deps[key].forEach(depKey => {
          var fallback = depKey.match(/^(.*?)@(.*?)$/);
          var dep = depKey in index ? index[depKey] : {
            node: fallback[1].trim(),
            shape: fallback[2].trim()
          };
          ret = ret.concat({node: dep.node, shape: dep.shape, status: "pass"})
        });
        Burn(250);
        return ret.concat({node: ent.node, shape: ent.shape, status: verdict});
      }, []);
    }
  }
};
})();

function indexKey (node, shape) {
  return node+'@'+shape;
}

function _indexShapeMap (fixedMap) {
  return fixedMap.reduce((ret, ent) => {
    ret[indexKey(ent.node, ent.shape)] = ent;
    return ret;
  }, {});
}

function createResults () {
  var _shapeMap = [];
  var known = {};
  return {
    // Get results ShapeMap.
    getShapeMap: function () { return _shapeMap; },

    // Add entries to results ShapeMap.
    merge: function (toAdd) {
      toAdd.forEach(ent => {
        var key = indexKey(ent.node, ent.shape);
        if (!(key in known)) {
          _shapeMap.push(ent);
          known[key] = ent;
        }
      });
    },

    report: function () {
      log("<span class=\"results\">" + _shapeMap.map(elt => {
        return JSON.stringify(elt);
      }).join("<br />\n") + "</span>");
    }
  };
}

var abort = false, running = false;
var fixedMap = null, validator = null;
onmessage = function (msg) {debugger;
  switch (msg.data.request) {
  case "create":
    fixedMap = msg.data.fixedMap;
    validator = Validator.create(msg.data.fixedMap);
    postMessage({ response: "ack" });
    break;

  case "validate":
    var currentEntry = 0;
    var results = createResults();

    running = true;
    setTimeout(validateSingleEntry, 0);

    function validateSingleEntry () {
      if (abort) {
        // Emergency Stop button was pressed.
        log(`aborted at entry ${currentEntry}`);
        abort = running = false;
        postMessage({ response: "aborted" });

      } else if (currentEntry === fixedMap.length) {
        // Done -- show results and restore interface.
        running = false;
        postMessage({ response: "done", results: results.getShapeMap() });

      } else {
        // Skip entries that were already processed.
        function alreadyDone (row) { return false;
          var key = indexKey(fixedMap[row].node, fixedMap[row].shape);
          return updateCells[key].attr("class") !== "work";
        }
        while (alreadyDone(currentEntry))
          ++currentEntry;

        var queryMap = [fixedMap[currentEntry++]]; // ShapeMap with single entry.
        var newResults = validator.validate(queryMap, results.getShapeMap());

        // Merge into results.
        results.merge(newResults);

        // Notify caller.
        postMessage({ response: "update", results: newResults });

        // Call this function again after yielding.
        setTimeout(validateSingleEntry, 0);
      }
    }
    break;

  case "abort": // kills validator
    validator = null;
    postMessage({ response: "aborted" });
    break;

  default:
    throw "unknown request: " + JSON.stringify(msg.data);
  }
}


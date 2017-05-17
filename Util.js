
Util = (function () {
  return {
    indexKey: indexKey,
    indexShapeMap: indexShapeMap,
    createResults: createResults
  };

  function indexKey (node, shape) {
    return node+'@'+shape;
  }

  function indexShapeMap (fixedMap) {
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
})();

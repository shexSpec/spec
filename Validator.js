Validator = (function () {
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

    var fixedMapIndex = Util.indexShapeMap(fixedMap);
    var fixedMapDeps = fixedMap.reduce((ret, ent) => {
      ret[Util.indexKey(ent.node, ent.shape)] = getAllDependencies(ent);
      return ret;
    }, {});

    return { validate: validate };

    function getAllDependencies (ent) {
      if (ent.depNode === null)
        return [];
      var depKey = Util.indexKey(ent.depNode, ent.depShape);
      var ret = [depKey];
      var refd = fixedMapIndex[depKey];
      if (refd)
        ret = ret.concat(getAllDependencies(refd));
      return ret;
    }

    function validate (query, premise) {
      return query.reduce((ret, ent) => {
        var passes = ent.node.substr(1) === ent.shape.substr(1);
        var verdict = passes ? "pass" : "fail";
        var key = Util.indexKey(ent.node, ent.shape);
        var deps = fixedMapDeps[key].map(depKey => {
          var fallback = depKey.match(/^(.*?)@(.*?)$/);
          var dep = depKey in fixedMapIndex ? fixedMapIndex[depKey] : {
            node: fallback[1].trim(),
            shape: fallback[2].trim()
          };
          return {node: dep.node, shape: dep.shape, status: "pass"};
        });
        var thisPair = {node: ent.node, shape: ent.shape, status: verdict};
        if (ret.has(thisPair))
          return ret.merge(deps);
        Burn(200); // Chew up some CPU time.
        return ret.merge(deps.concat([thisPair]));
      }, Util.createResults()).getShapeMap();
    }
  }
};
})();

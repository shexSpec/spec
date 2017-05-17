(function () {
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

window.Validator = {
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

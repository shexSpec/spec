
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

function indexKey (node, shape) {
  return node+'@'+shape;
}

var Validator = {
  // Would be constructed with a schema but deps are expressed in the table.
  create: function (fixedMap) {
    var index = fixedMap.reduce((ret, ent) => {
      ret[indexKey(ent.node, ent.shape)] = ent;
      return ret;
    }, {});

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

// Log to #results.
function log () {
  var args = [].slice.call(arguments);
  var toAdd = args.map(elt => {
    return elt.toString.apply(elt);
  }).join(" ")+"<br />\n";
  $("#messages").append(toAdd);
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

$(document).ready(function () {
  $("td").
    not("td:nth-child(5)").
    attr("contenteditable", "true").
    attr("spellcheck", "false");

  var runner = function () {
    log("<span class=\"error\">select a runner</span>");
  }
  $("#go").on("click", evt => { wrap(() => { runner(evt); }); });

  [
    {func: toy, name: "toy"},
    {func: progress, name: "progress"},
  ].forEach(elt => {
    var button = $(`<button>${elt.name}</button>`);
    var h2 = $("<h2\>").append(button);
    var body = elt.func.toString();
    var start = body.indexOf("{") + 2;
    var end = body.lastIndexOf("}");
    body = body.substr(start, end - start).replace(/^  /mg, "");
    var textarea = $(`<textarea>${body}</textarea>`);
    var panel = $("<div class=\"panel\"/>").append(h2).append(textarea);
    $("#panels").append(panel);
    button.on("click", scriptEvt => {
      var evalMe = "(function () {\n"+textarea.val()+"\n})(scriptEvt)"
      log(`setting runner to <span class="lookit">${elt.name}</span>`);
      return wrap(() => { runner = eval(evalMe); });
    });
  });

  function wrap (wrapMe) {
    try {
      wrapMe();
    } catch (e) {
      log(`<span class="error">${e.stack.substr(0, e.stack.indexOf("\n"))}</span>`);
    }
    return false;
  }
});

    // setTimeout(() => {
    //   var results = fixedMap.reduce((ret, ent) => {
    //     var newResults = validate([ent], results);
    //     newResults.forEach(newRes => {
    //       index[indexKey(newRes.node, newRes.shape)].update.
    //         text(newRes.status).attr("class", newRes.status);
    //       console.log(`${newRes.node}@${newRes.shape} ${newRes.status}`);
    //     });
    //   }, []);
    //   console.log(results);
    // }, 0);

function toy () {
  log("init");
  return function (evt) {
    log("runner");
  };
}

function progress () {
  var abort = false, running = false;
  return function (evt) {
    if (running) {
      // Emergency Stop button was pressed.
      abort = true;
      return false;
    }

    // Create a fixed (no triple patterns),
    // augmented (extra properties) ShapeMap from HTML table.
    var fixedMap = $("tr").slice(2).map((idx, elt) => {
      function nth (n) {
        var ret = $(elt).find("td").slice(n, n+1).text().trim();
        return ret === "" ? null : ret;
      }
      return {
        node: nth(0),
        shape: nth(1),
        depNode: nth(2),
        depShape: nth(3),
        update: $(elt).find("td").slice(4,5)
      };
    }).get(); // .get() to unwrap jQuery.map results

    // Index the ShapeMap by node/shape pair.
    var index = fixedMap.reduce((ret, ent) => {
      ent.update.text("…").attr("class", "work");
      ret[indexKey(ent.node, ent.shape)] = ent;
      return ret;
    }, {});

    // Simulate creating a validator with a schema.
    var validator = Validator.create(fixedMap);

    var currentEntry = 0;
    var results = createResults();

    running = true;
    $("#go").addClass("stoppable").text("stop");
    setTimeout(validateSingleEntry, 0);
    return false;

    function validateSingleEntry () {
      if (abort) {
        // Emergency Stop button was pressed.
        log(`aborted at entry ${currentEntry}`);
        abort = running = false;
        $("#go").removeClass("stoppable").text("go");

      } else if (currentEntry === fixedMap.length) {
        // Done -- show results and restore interface.
        results.report();
        running = false;
        $("#go").removeClass("stoppable").text("go");

      } else {
        // Skip entries that were already processed.
        function alreadyDone (row) {
          return index[indexKey(fixedMap[row].node, fixedMap[row].shape)].
            update.attr("class") !== "work";
        }
        while (alreadyDone(currentEntry))
          ++currentEntry;

        var queryMap = [fixedMap[currentEntry++]]; // ShapeMap with single entry.
        var newResults = validator.validate(queryMap, results.getShapeMap());

        // Render newResults.
        newResults.forEach(newRes => {
          var key = indexKey(newRes.node, newRes.shape);
          if (key in index) {
            index[key].update.text(newRes.status).attr("class", newRes.status);
          } else {
            log(`<span class="lookit">extra result:</span> ${newRes.node}@${newRes.shape} ${newRes.status}`);
          }
        });

        // Merge into results.
        results.merge(newResults);

        // Call this function again after yielding.
        setTimeout(validateSingleEntry, 0);
      }
    }
  }
}

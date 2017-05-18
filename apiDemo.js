// Interface object that knows about the HTML layout.
var Iface = (function () {
  return {
    parseShapeMap: parseShapeMap,
    indexResultCells: indexResultCells
  };
  function tdValues (sel) {
    var ret = []; // jquery.map removes nulls
    sel.each((idx, td) => {
      var text = $(td).text().trim();
      ret.push(text === "" ? null : text);
    });
    return ret;
  }

  // Create a fixed (no triple patterns),
  // augmented (extra properties) ShapeMap from HTML table.
  function parseShapeMap (from) {
    return $(from).slice(2).map((idx, elt) => {
      var vals = tdValues($(elt).find("td"));
      return {
        node: vals[0],
        shape: vals[1],
        depNode: vals[2],
        depShape: vals[3]
      };
    }).get(); // .get() to unwrap jQuery.map results
  }

  function indexResultCells (from) {
    var ret = {};
    $(from).slice(2).each((idx, elt) => { // jquery has no reduce
      var vals = tdValues($(elt).find("td"));
      ret[Util.indexKey(vals[0], vals[1])] = $(elt).find("td").slice(4,5);
    });
    return ret;
  }
})();

// Log to #results.
function log () {
  var args = [].slice.call(arguments);
  var toAdd = args.map(elt => {
    return elt.toString.apply(elt);
  }).join(" ")+"<br />\n";
  $("#messages").append(toAdd);
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
    {func: worker, name: "worker"},
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
    //       index[Util.indexKey(newRes.node, newRes.shape)].update.
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

    var fixedMap = Iface.parseShapeMap("tr");
    var updateCells = Iface.indexResultCells("tr");

    // Index the ShapeMap by node/shape pair.
    var index = Util.indexShapeMap(fixedMap);
    for (var k in updateCells)
      updateCells[k].text("…").attr("class", "work");

    // Simulate creating a validator with a schema.
    var validator = Validator.create(fixedMap);

    var currentEntry = 0;
    var results = Util.createResults();

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
          var key = Util.indexKey(fixedMap[row].node, fixedMap[row].shape);
          return updateCells[key].attr("class") !== "work";
        }
        while (alreadyDone(currentEntry))
          ++currentEntry;

        var queryMap = [fixedMap[currentEntry++]]; // ShapeMap with single entry.
        var newResults = validator.validate(queryMap, results.getShapeMap());

        // Render newResults.
        newResults.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            updateCells[key].text(newRes.status).attr("class", newRes.status);
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

function worker1 () {
  if (!window.Worker) throw Error("no worker");
  return function (evt) {
    var fixedMap = Iface.parseShapeMap("tr");
    var ShExWorker = new Worker("apiDemoWorker.js");
    ShExWorker.onmessage = function (msgEvent) {
      console.log('Message received from worker');
      console.dir(msgEvent.data);
      log(msgEvent.data);
    };

    ShExWorker.postMessage(fixedMap);
    console.log('Message posted to worker');
  }
}

function worker () {
  // WebWorker with callbacks for progressive validation.
  var abort = false, running = false;
  var ShExWorker = new Worker("apiDemoWorker.js");
  return function (evt) {
    if (running) {
      // Emergency Stop button was pressed.
      if (ShExWorker.onmessage !== null) {
        ShExWorker.onmessage = expectAborted;
        log("aborting web worker");
        function expectAborted (msg) {
          if (["update", "done"].indexOf(msg.data.response) !== -1)
            return;
          if (msg.data.response !== "aborted")
            throw "expected aborted: " + JSON.stringify(msg.data);
          log("aborted at entry " + msg.data.stoppedAt);
          ShExWorker.onmessage = abort = running = false;
          $("#go").removeClass("stoppable").text("go");
        }
      }
      ShExWorker.postMessage({ request: "abort" });
      abort = true;
      return false;
    }

    var fixedMap = Iface.parseShapeMap("tr");
    var updateCells = Iface.indexResultCells("tr");

    // Index the ShapeMap by node/shape pair.
    var index = Util.indexShapeMap(fixedMap);
    for (var k in updateCells)
      updateCells[k].text("…").attr("class", "work");

    ShExWorker.onmessage = expectAck;
    ShExWorker.postMessage({ request: "create", fixedMap: fixedMap});

    var currentEntry = 0;
    var results = Util.createResults();

    running = true;
    $("#go").addClass("stoppable").text("stop");

    function expectAck (msg) {
      if (msg.data.response !== "ack")
        throw "expected ack: " + JSON.stringify(msg.data);
      ShExWorker.onmessage = parseUpdatesAndResults;
      ShExWorker.postMessage({request: "validate", queryMap: fixedMap});
    }

    function parseUpdatesAndResults (msg) {
      switch (msg.data.response) {
      case "update":
        msg.data.results.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            updateCells[key].text(newRes.status).attr("class", newRes.status);
          } else if (!results.has(newRes)) {
            log(`<span class="lookit">extra result:</span> ${newRes.node}@${newRes.shape} ${newRes.status}`);
          }
        });

        // Merge into results.
        results.merge(msg.data.results);
        break;

      case "done":
        console.dir(msg.data.results);
        results.report();
        ShExWorker.onmessage = running = false;
        $("#go").removeClass("stoppable").text("go");
        break;

      default:
        log("<span class=\"error\">unknown response: " + JSON.stringify(msg.data) + "</span>");
      }
    }

    return false;
  }
}


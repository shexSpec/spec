var RENDER_TIME = true;

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

function markResult (element, status, start) {
  element.text(
    RENDER_TIME ?
      Math.round((Date.now() - start)/100)/10 :
      status
  ).attr("class", status)
}

$(document).ready(function () {
  $("td").
    not("td:nth-child(5)").
    attr("contenteditable", "true").
    attr("spellcheck", "false");

  var runner = function () {
    log("<span class=\"error\">select a runner</span>");
  }
  $("#go").on("click", evt => {
    wrap(() => { runner(evt); });
  }).prop("disabled", true);

  [
//    {func: toy, name: "⛔ toy"},
    {func: simpleSingle, name: "⛔ Simple Single"},
    {func: progressiveSingle, name: "⛗ Progressive Single"},
    {func: simpleWorker, name: "⛔ Simple Worker"},
    {func: killerWorker, name: "⛕ Killer Worker"},
    {func: interactiveWorker, name: "⛗ Interactive Worker"},
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
      log(`setting runner to <span class="lookit now-playing">${elt.name}</span>`);
      return wrap(() => {
        $("h2 button, textarea").removeClass("now-playing");
        button.addClass("now-playing");
        textarea.addClass("now-playing");
        $("#go").prop("disabled", false);
        runner = eval(evalMe);
      });
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

function toy () {
  log("init");
  return function (evt) {
    log("runner");
  };
}

function simpleSingle () {
  // Single Thread
  //   
  //   

  return function (evt) {

    var fixedMap = Iface.parseShapeMap("tr");
    var updateCells = Iface.indexResultCells("tr");

    // Index the ShapeMap by node/shape pair.
    var index = Util.indexShapeMap(fixedMap);

    // Simulate creating a validator with a schema.
    var validator = Validator.create(fixedMap);
    var results = Util.createResults();

    var start = Date.now();
    var newResults = validator.validate(fixedMap, []);

    // Render newResults.
    newResults.forEach(newRes => {
      var key = Util.indexKey(newRes.node, newRes.shape);
      if (key in index) {
        markResult(updateCells[key], newRes.status, start);
      } else {
        log(`<span class="lookit">extra result:</span> ${newRes.node}@${newRes.shape} ${newRes.status}`);
      }
    });

    // Merge into results.
    results.merge(newResults);
    results.report();

    return false;
  }
}

function progressiveSingle () {
  // Single Thread
  //   progressive rendering
  //   stop button

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
    var start = Date.now();
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
        while (results.has(fixedMap[currentEntry]))
          ++currentEntry;

        var queryMap = [fixedMap[currentEntry++]]; // ShapeMap with single entry.
        var newResults = validator.validate(queryMap, results.getShapeMap());

        // Render newResults.
        newResults.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            markResult(updateCells[key], newRes.status, start);
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

function interactiveWorker () {
  // Interactive WebWorker
  //   progressive rendering
  //   stop button

  var abort = false, running = false;
  var ShExWorker = new Worker("apiDemoInteractiveWorker.js");
  return function (evt) {
    if (running) {
      // Emergency Stop button was pressed.
      if (ShExWorker.onmessage !== null) {
        ShExWorker.onmessage = expectAborted;
        log("aborting web worker...");
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

    ShExWorker.onmessage = expectCreated;
    ShExWorker.postMessage({ request: "create", fixedMap: fixedMap});

    var currentEntry = 0;
    var results = Util.createResults();

    running = true;
    $("#go").addClass("stoppable").text("stop");
    var start = Date.now();

    function expectCreated (msg) {
      if (msg.data.response !== "created")
        throw "expected created: " + JSON.stringify(msg.data);
      ShExWorker.onmessage = parseUpdatesAndResults;
      ShExWorker.postMessage({request: "validate", queryMap: fixedMap});
    }

    function parseUpdatesAndResults (msg) {
      switch (msg.data.response) {
      case "update":
        msg.data.results.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            markResult(updateCells[key], newRes.status, start);
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

function killerWorker () {
  // Killer WebWorker
  // 
  //   stop button

  var abort = false, running = false;
  var ShExWorker = new Worker("apiDemoWorker.js");
  return function (evt) {
    if (running) {
      // Emergency Stop button was pressed.
      if (ShExWorker.onmessage !== null) {
        ShExWorker.terminate();
        ShExWorker = new Worker("apiDemoWorker.js");
        log("terminated web worker");
        ShExWorker.onmessage = abort = running = false;
        $("#go").removeClass("stoppable").text("go");
      }
      return false;
    }

    var fixedMap = Iface.parseShapeMap("tr");
    var updateCells = Iface.indexResultCells("tr");

    // Index the ShapeMap by node/shape pair.
    var index = Util.indexShapeMap(fixedMap);
    for (var k in updateCells)
      updateCells[k].text("…").attr("class", "work");

    ShExWorker.onmessage = expectCreated;
    ShExWorker.postMessage({ request: "create", fixedMap: fixedMap});

    var results = Util.createResults();

    running = true;
    $("#go").addClass("stoppable").text("stop");
    var start = Date.now();

    function expectCreated (msg) {
      if (msg.data.response !== "created")
        throw "expected created: " + JSON.stringify(msg.data);
      ShExWorker.onmessage = parseUpdatesAndResults;
      ShExWorker.postMessage({request: "validate", queryMap: fixedMap});
    }

    function parseUpdatesAndResults (msg) {
      switch (msg.data.response) {
      case "done":
        console.dir(msg.data.results);
        msg.data.results.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            markResult(updateCells[key], newRes.status, start);
          } else if (!results.has(newRes)) {
            log(`<span class="lookit">extra result:</span> ${newRes.node}@${newRes.shape} ${newRes.status}`);
          }
        });

        // Merge into results.
        results.merge(msg.data.results);
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

function simpleWorker () {
  // Simple WebWorker
  // 
  // 

  var ShExWorker = new Worker("apiDemoWorker.js");
  return function (evt) {

    var fixedMap = Iface.parseShapeMap("tr");
    var updateCells = Iface.indexResultCells("tr");

    // Index the ShapeMap by node/shape pair.
    var index = Util.indexShapeMap(fixedMap);
    for (var k in updateCells)
      updateCells[k].text("…").attr("class", "work");

    ShExWorker.onmessage = expectCreated;
    ShExWorker.postMessage({ request: "create", fixedMap: fixedMap});

    var results = Util.createResults();

    $("#go").prop( "disabled", true );
    var start = Date.now();

    function expectCreated (msg) {
      if (msg.data.response !== "created")
        throw "expected created: " + JSON.stringify(msg.data);
      ShExWorker.onmessage = parseUpdatesAndResults;
      ShExWorker.postMessage({request: "validate", queryMap: fixedMap});
    }

    function parseUpdatesAndResults (msg) {
      switch (msg.data.response) {
      case "done":
        console.dir(msg.data.results);
        msg.data.results.forEach(newRes => {
          var key = Util.indexKey(newRes.node, newRes.shape);
          if (key in index) {
            markResult(updateCells[key], newRes.status, start);
          } else if (!results.has(newRes)) {
            log(`<span class="lookit">extra result:</span> ${newRes.node}@${newRes.shape} ${newRes.status}`);
          }
        });

        // Merge into results.
        results.merge(msg.data.results);
        results.report();
        $("#go").prop( "disabled", false );
        break;

      default:
        log("<span class=\"error\">unknown response: " + JSON.stringify(msg.data) + "</span>");
      }
    }

    return false;
  }
}


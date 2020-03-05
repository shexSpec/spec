importScripts('Util.js');
importScripts('Validator.js');

var fixedMap = null, validator = null;
onmessage = function (msg) {

  switch (msg.data.request) {
  case "create":
    fixedMap = msg.data.fixedMap;
    validator = Validator.create(msg.data.fixedMap);
    postMessage({ response: "created" });
    break;

  case "validate":
    var currentEntry = 0, options = msg.data.options || {};
    var results = Util.createResults();

    for (var currentEntry = 0; currentEntry < fixedMap.length; ) {
      var queryMap = [fixedMap[currentEntry++]]; // ShapeMap with single entry.
      var newResults = validator.validate(queryMap, results.getShapeMap());

      // Merge into results.
      results.merge(newResults);

      // Notify caller.
      postMessage({ response: "update", results: newResults });

      // Skip entries that were already processed.
      while (currentEntry < fixedMap.length &&
             results.has(fixedMap[currentEntry]))
        ++currentEntry;
    }
    // Done -- show results and restore interface.
    if (options.includeDoneResults)
      postMessage({ response: "done", results: results.getShapeMap() });
    else
      postMessage({ response: "done" });
    break;

  default:
    throw "unknown request: " + JSON.stringify(msg.data);
  }
}


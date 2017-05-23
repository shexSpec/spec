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

    setTimeout(validateSingleEntry, 0);

    function validateSingleEntry () {
      if (currentEntry === fixedMap.length) {
        // Done -- show results and restore interface.
        if (options.includeDoneResults)
          postMessage({ response: "done", results: results.getShapeMap() });
        else
          postMessage({ response: "done" });

      } else {
        // Skip entries that were already processed.
        while (results.has(fixedMap[currentEntry]))
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

  default:
    throw "unknown request: " + JSON.stringify(msg.data);
  }
}


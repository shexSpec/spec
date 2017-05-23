importScripts('Util.js');
importScripts('Validator.js');

var abort = false, running = false;
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

    running = true;
    setTimeout(validateSingleEntry, 0);

    function validateSingleEntry () {
      if (abort) {
        // Emergency Stop button was pressed.
        console.log(`aborted at entry ${currentEntry}`);
        abort = running = false;
        postMessage({ response: "aborted", stoppedAt: currentEntry });

      } else if (currentEntry === fixedMap.length) {
        // Done -- show results and restore interface.
        running = false;
        if (options.includeDoneResults)
          postMessage({ response: "done", results: results.getShapeMap() });
        else
          postMessage({ response: "done" });

      } else {
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

        // Call this function again after yielding.
        setTimeout(validateSingleEntry, 0);
      }
    }
    break;

  case "abort": // kills validator
    validator = null;
    abort = true;
    // postMessage({ response: "aborted" });
    break;

  default:
    throw "unknown request: " + JSON.stringify(msg.data);
  }
}


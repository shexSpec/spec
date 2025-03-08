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
    var results = validator.validate(fixedMap, []);
    postMessage({ response: "done", results: results });
    break;

  default:
    throw "unknown request: " + JSON.stringify(msg.data);
  }
}


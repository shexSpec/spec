function prepareHighlight (highlightables, onClass, offClass, slide) {
  if (slide === undefined)
    slide = $("body .with-highlight").last();
  $.each( highlightables, function( index, value ){
    var elts = slide.find( "."+value );
    elts
    .mouseenter(function() {
        elts.removeClass(offClass).addClass(onClass);
    })
    .mouseleave(function() {
        elts.removeClass(onClass).addClass(offClass);
    })
    .addClass(offClass);
  })
}

function prepRep (elts, cls) {
  elts.each(function (idx, container) {
    container = $(container);
    var button = $("<button></button>");
    container.append(button);
    button.on("click", function (evt) {
      var next = button.text() === "json" ? "shexc" : "json";
      chooseRep(container, next);
    });
    container.attr("tabindex", "0").keydown(function (evt) {
      if (evt.ctrlKey || evt.shiftKey)
        return true;
      return toggle(container, evt.keyCode);
    })
    if (true) {
      var widths = {}, heights = {};
      ["json", "shexc"].forEach(c => {
        chooseRep(container, c);
        var pre = container.find("pre."+c);
        var bbox = pre.get(0).getBoundingClientRect();

        // var span = $("<span> \n</span>");
        // pre.append(span);
        // var w = span.width();
        // var h = span.height();
        // span.remove();

        widths[c] = Math.round(bbox.width);
        heights[c] = Math.round(bbox.height);
      });
      if (widths.json !== widths.shexc ||
          heights.json !== heights.shexc) {
        console.dir([container.get(0),
                     widths.json-widths.shexc,
                     heights.json-heights.shexc]);
        button.attr("title", ""+(widths.json-widths.shexc)+
                    ", "+(heights.json-heights.shexc));
        container.css("border", "thick solid red");
      }
    }
    if (!container.hasClass("incomplete")) {
      try {
        let shexjStr = container.find("pre.json").text()
        let shexj = JSON.parse(shexjStr)
        let shexcStr =
            "PREFIX ex: <http://schema.example/#>\n" +
            "PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>\n" +
            "PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>\n" +
            "PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>\n" +
            "PREFIX foaf: <http://xmlns.com/foaf/0.1/>\n" +
            "PREFIX Test: <http://shex.io/extensions/Test/>\n" +
            container.find("pre.shexc").text()
        let shexc = shexParser.construct("http://schema.example/schema1").parse(shexcStr)
        delete shexc.prefixes
        delete shexc.base
        if (!deepEquals(shexj, shexc)) {
          console.dir([container.get(), shexj,  shexc]);
          container.css("border", "thick solid red");
        }
      } catch (e) {
        console.dir([container, e]);
      }
    }
    chooseRep(container, cls);
  });
  return 
}
function chooseRep (container, cls) {
  var button = container.find("> button");
  button.text(cls);
  container.find("> pre").each(function (idx, child) {
    child = $(child);
    var shown = child.hasClass(cls);
    child.addClass(shown ? "repchosen" : "rephidden");
    child.removeClass(shown ? "rephidden" : "repchosen");
  });
  container.find("> button").text(cls);
}


function unComment (doc, content) {
  // perform transformations to make it render and prettier
  content = content.replace(/<!--/, '');
  content = content.replace(/-->/, '');
  return content ;
}

// Crappy, single-purpose ShExC highlighter.
function highlightShExC (doc, content) {
  return content
    .replace(/# ([^\n]*)$/gm, s => s.replace(/</g, "@@@"))
    .replace(/<([^>]*)>/g, "<span class='relativeIRI'>&lt;$1&gt;</span>")
    .replace(/@@@/g, "<")
    .replace(/# ([^\n]*)$/gm, s => "<span class='comment'>"+s+"</span>")
    .replace(/(\b(?:CLOSED|BNODE|IRI|OR|PREFIX|BASE|LITERAL)\b|start=)/g,
             "<span class='keyword'>$1</span>")
    .replace(/\[(.*?)\]/g, "<span class='valueSet'>[$1]</span>")
}

function toggleGrammar () {
  const labels = [
    "Display grammar only", "Display semantic actions"
  ];
  var state = labels.indexOf($("#toggleGrammar").text());
  var sel = $(".grammarTable tr").not($("tr[style='vertical-align: baseline']"));
  if (state === 0) {
    state = 1;
    sel.hide();
  } else {
    state = 0;
    sel.show();
  }
  $("#toggleGrammar").text(labels[state]);
  return false;
}

$(document).ready(function () {
  prepRep($(".repchoice"), "json");
  $("#toggleGrammar").on("click", toggleGrammar);
  $("body").keydown(function (evt) {
    if (evt.ctrlKey || !evt.shiftKey)
      return true;
    return toggle($("body .repchoice"), evt.keyCode);
  });
});

function toggle (from, key) {
    var toHide, toShow;
    switch (key) {
    case "J".charCodeAt(0):
      toHide = "shexc";
      toShow = "json";
      break;
    case "C".charCodeAt(0):
      toHide = "json";
      toShow = "shexc";
      break;
    // case "T".charCodeAt(0):
    //   toHide = "repchosen";
    //   toShow = "rephidden";
    //   break;
    default:
      return true;
    }
    from.find("."+toHide).removeClass("repchosen").addClass("rephidden");
    from.find("."+toShow).removeClass("rephidden").addClass("repchosen");  
    from.find("> button").text(toShow);
    return false;
}

// from https://stackoverflow.com/questions/1068834/object-comparison-in-javascript#answer-2408334
function deepEquals (l, r) {
  for (i in l) {
    if(typeof r[i] === 'undefined') {
      return false;
    }
    else if(typeof r[i] === 'object') {
      if(!deepEquals(r[i], l[i])) {
        return false;
      }
    }
    else if(r[i] != l[i]) {
      return false;
    }
  }
  for(i in r) {
    if(typeof l[i] === 'undefined') {
      return false;
    }
    else if(typeof l[i] === 'object') {
      if(!deepEquals(l[i], r[i])) {
        return false;
      }
    }
    else if(l[i] != r[i]) {
      return false;
    }
  }
  return true;
}

/*
let a = {foo:'bar', bar: {blub:'bla'}}
let b = {foo:'bar', bar: {blub:'blob'}}
console.log(false, deepEquals(a, b))
console.log(true, deepEquals(a, JSON.parse(JSON.stringify(a))))
console.log(true, deepEquals(b, JSON.parse(JSON.stringify(b))))
let c = {a:[]}
let d = {a:[]}
console.log(true, deepEquals(c, d))
*/


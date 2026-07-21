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

async function prepRep (elts, cls) {
  const { default: shexParser } = await import("./dist/shexParser.es.js");
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

    // Parse and verify that representations emit identical schemas.
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
        if (shexcStr.match(/approvedBy/))
          debugger
        let shexc = shexParser.construct("http://schema.example/base").parse(shexcStr)
        delete shexc.prefixes
        delete shexc.base
        if (!deepEquals(shexj, shexc)) {
          console.dir([container.get(), shexj,  shexc]);
          container.addClass("rep-choice-semantics-mismatch");
        }
      } catch (e) {
        console.dir([container.get(), e]);
        container.addClass("rep-choice-parse-error");
      }
    }

    // Verify rendered sizes line up.
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
        container.addClass("rep-choice-size-mismatch");
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

// pulls "..." strings out of content so later regexes can't be confused by
// slashes, angle brackets or keywords that happen to appear inside them.
function stashStrings (content) {
  var strings = [];
  content = content.replace(/"(?:[^"\\]|\\.)*"/g, function (s) {
    strings.push(s);
    return "@@STR" + (strings.length - 1) + "@@";
  });
  return { content: content, restore: function (out) {
    return out.replace(/@@STR(\d+)@@/g,
                        (m, i) => "<span class='string'>"+strings[+i]+"</span>");
  } };
}

// Crappy, single-purpose ShExC highlighter.
function highlightShExC (doc, content) {
  var stashed = stashStrings(content);
  var out = stashed.content
    .replace(/# ([^\n]*)$/gm, s => s.replace(/</g, "@@@"))
    .replace(/<([^>]*)>/g, "<span class='relativeIRI'>&lt;$1&gt;</span>")
    .replace(/@@@/g, "<")
    .replace(/# ([^\n]*)$/gm, s => "<span class='comment'>"+s+"</span>")
    .replace(/\/(?:\\.|[^\/\n])+\//g, s => "<span class='pattern'>"+s+"</span>")
    .replace(/(\b(?:CLOSED|BNODE|IRI|OR|PREFIX|BASE|LITERAL|a)\b|start=)/g,
             "<span class='keyword'>$1</span>")
    .replace(/\[(.*?)\]/g, "<span class='valueSet'>[$1]</span>")
  return stashed.restore(out);
}

// Crappy, single-purpose Turtle highlighter.
function highlightTurtle (doc, content) {
  var stashed = stashStrings(content);
  var out = stashed.content
    .replace(/# ([^\n]*)$/gm, s => s.replace(/</g, "@@@"))
    .replace(/<([^>]*)>/g, "<span class='relativeIRI'>&lt;$1&gt;</span>")
    .replace(/@@@/g, "<")
    .replace(/# ([^\n]*)$/gm, s => "<span class='comment'>"+s+"</span>")
    .replace(/(^|\s)(a|PREFIX|BASE)(?=\s)/gm, "$1<span class='keyword'>$2</span>")
  return stashed.restore(out);
}

// Expands terse "@label@" markers (e.g. "@te1@") into the full pin span
// prose needs, so writing a reference doesn't require hand-typing
// <span class="lineno ...">. Convention (matching this document's labels):
// "S<n>", "te<n>" and "tc<n>" are schema labels; a bare "t<n>" is a data
// (triple) label. Must run before initPinHighlights so the expanded spans
// exist by the time it links same-labelled elements together. Never
// touches .line-labels or code <pre> listings - those are hand-authored.
function expandPinRefs () {
  $("p, li, td, th, dd, dt").each(function () {
    var el = $(this);
    if (el.closest("pre, .line-labels").length) return;
    var html = el.html();
    if (html.indexOf("@") === -1) return;
    el.html(html.replace(/@([A-Za-z]+[0-9]+)@/g, function (m, label) {
      var kind = /^t[0-9]/.test(label) ? "data" : "schema";
      return "<span class='lineno " + kind + " pin " + label + "'>" + label + "</span>";
    }));
  });
}

// Wires up hover on each .line-labels gutter so that mousing over a line
// label (e.g. "tc1") highlights that gutter chip, the matching .pin span
// in the adjacent code listing, and any prose mentions of the same label
// - all of them share a class named after the label, and prepareHighlight()
// (above) already knows how to link any set of same-classed elements
// together. Scoped to the enclosing <section> (not just the .example div)
// since prose references live outside the code/data example blocks.
function initPinHighlights () {
  $(".line-labels").each(function () {
    var gutter = $(this);
    var scope = gutter.closest("section");
    var labels = gutter.find(".lineno")
      .map(function () { return $(this).text().trim(); })
      .get()
      .filter(function (label) { return label.length > 0; });
    if (labels.length)
      prepareHighlight(labels, "pin-active", "pin-inactive", scope);
  });
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

async function doStuff () {
  await prepRep($(".repchoice"), "json");
  $("#toggleGrammar").on("click", toggleGrammar);
  $("body").keydown(function (evt) {
    if (evt.ctrlKey || !evt.shiftKey)
      return true;
    return toggle($("body .repchoice"), evt.keyCode);
  });
  setTimeout(
    () => {
      document.querySelector('#toc-toggle').click();
    },
    1000
  );
  for (elt of [...document.querySelectorAll('.MUST')]) {
    elt.innerText = "SHALL";
  }
};

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


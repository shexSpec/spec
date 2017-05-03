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


function unComment(doc, content) {
  // perform transformations to make it render and prettier
  content = content.replace(/<!--/, '');
  content = content.replace(/-->/, '');
  return content ;
}

function updateExample(doc, content) {
  var utils = require("core/utils");
// perform transformations to make it render and prettier
  return utils.xmlEscape(content);
}

function toggleGrammar() {
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


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

function chooseRep (elts, cls) {
  elts.each(function (idx, container) {
    container = $(container);
    container.find("> *").each(function (idx, child) {
      child = $(child);
      var shown = child.hasClass(cls);
      child.addClass(shown ? "repchosen" : "rephidden");
      child.removeClass(shown ? "rephidden" : "repchosen");
      if (shown)
        child.on("click", function (evt) {
          chooseRep(container, cls === "json" ? "shexc" : "json");
        });
    });
  });
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

$(document).ready(function () {
  chooseRep($(".repchoice"), "json");
  $("body").keydown(function (evt) {
    var toHide, toShow;
    switch (evt.keyCode) {
    case "J".charCodeAt(0):
      toHide = $(".repchoice .shexc");
      toShow = $(".repchoice .json");
      break;
    case "C".charCodeAt(0):
      toHide = $(".repchoice .json");
      toShow = $(".repchoice .shexc");
      break;
    case "T".charCodeAt(0):
      toHide = $(".repchosen");
      toShow = $(".rephidden");
      break;
    default:
      return true;
    }
    toHide.removeClass("repchosen").addClass("rephidden");
    toShow.removeClass("rephidden").addClass("repchosen");
    return false;
  });
});


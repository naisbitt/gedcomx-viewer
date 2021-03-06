// General-purpose utility functions
function isEmpty(a) {
  return !a || a.length === 0;
}

function encode(s) {
  if (!s) {
    s="";
  }
  return $('<div/>').text(s).html();
}

/**
 * Find the 'agent' object in the given GedcomX document that has the given ID (with or without the "#").
 * @param doc - GedcomX document to look in.
 * @param ref - Local ID of an agent (with or without the "#").
 * @returns Agent object, or null if not found.
 */
function getAgent(doc, ref) {
  if (ref && ref.startsWith("#")) {
    var id = ref.substr(1);
    if (doc.agents) {
      for (var i = 0; i < doc.agents.length; i++) {
        var agent = doc.agents[i];
        if (agent.id === id) {
          return agent;
        }
      }
    }
  }
  return null;
}

/**
 * Find the SourceDescription object for the given 
 * @param doc - GedcomX document (e.g., for a persona or record)
 * @param sourceIdOrUrl - The local ID (with or without "#") or full "about" URL for the SourceDescription being sought.
 * @returns {*}
 */
function getSourceDescription(doc, sourceIdOrUrl) {
  var source = null;

  if (doc && sourceIdOrUrl) {
    if (sourceIdOrUrl.charAt(0) === '#') {
      sourceIdOrUrl = sourceIdOrUrl.substring(1);
    }

    if (doc.sourceDescriptions) {
      for (var i = 0; i < doc.sourceDescriptions.length; i++) {
        var srcDesc = doc.sourceDescriptions[i];
        if (srcDesc.about === sourceIdOrUrl || srcDesc.id === sourceIdOrUrl) {
          source = srcDesc;
          break;
        }
      }
    }
  }
  return source;
}

// Find the source description of the 'source' for the record, i.e., for the 'document' that contains the original text.
function getDocumentSourceDescription(doc) {
  var recordSourceDescription = getSourceDescription(doc, doc.description);

  var documentSourceDescription;
  if (recordSourceDescription && recordSourceDescription.sources && recordSourceDescription.sources.length > 0) {
    documentSourceDescription = getSourceDescription(doc, recordSourceDescription.sources[0].description);
  }
  return documentSourceDescription;
}

// Find the source "document" within the given GedcomX document, and return it (or null if not found).
function getSourceDocument(doc, documentSourceDescription) {
  if (!documentSourceDescription) {
    documentSourceDescription = getDocumentSourceDescription(doc);
  }
  var document;
  if (documentSourceDescription && documentSourceDescription.about) {
    var sourceDocumentId = documentSourceDescription.about.substr(1);
    if (doc.documents) {
      for (var i = 0; i < doc.documents.length; i++) {
        var candidate = doc.documents[i];
        if (sourceDocumentId === candidate.id) {
          document = candidate;
          break;
        }
      }
    }
  }
  return document;
}

/**
 * Create an object with {x, y, width, height}, either from those four values, or four a comma-seprated string containing those four values.
 * @param x1OrRectangle - Either an x coordinate, or a string with "x,y,width,height" all in them.
 * @param y1 - y-coordinate of upper-left corner (if not using rectangle string)
 * @param x2 - x-coordinate of lower-right corner (if not using rectangle string)
 * @param y2 - y-coordinate of lower-right corner (if not using rectangle string)
 * @constructor
 */
function Rectangle(x1OrRectangle, y1, x2, y2) {
  if (!y1) {
    // Parse a string of the form "x1,y1,x2,y2".
    var parts = x1OrRectangle.split(",");
    this.x1 = parts[0];
    this.y1 = parts[1];
    this.x2 = parts[2];
    this.y2 = parts[3];
  }
  else {
    this.x1 = x1OrRectangle;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }
}

/**
 * Find the image Ark(s) that are the source of the given indexed GedcomX document, along with corresponding rectangles within each.
 *   Uses the 'description' element at the root to get the id of the Source Description for the Record.
 *   Then uses the 'sources' list of that record (recursively, following the source change until it finds DigitalArtifact sources).
 *   For each DigitalArtifact source, adds an object to the return array that includes:
 *     image: image Ark.
 *     rectangles: array of rectangle objects, each with {x1,y1,x2,y2}, hopefully in fractional (0..1) coordinates.
 * @param doc - GedcomX document.
 * @returns {*}
 */
function getImageArks(doc) {
  function isImage(sd) {
    return sd && sd.resourceType && sd.resourceType === "http://gedcomx.org/DigitalArtifact" || sd.resourceType === "http://gedcomx.org/Image";
  }

  function findImageArksAndRectangles(sd, imageArks) {
    if (sd && imageArks.length === 0) {
      if (!isEmpty(sd.sources)) {
        for (var s = 0; s < sd.sources.length; s++) {
          var source = sd.sources[s];
          var rectangles = [];
          if (source.qualifiers) {
            for (var q = 0; q < source.qualifiers.length; q++) {
              var qualifier = source.qualifiers[q];
              if (qualifier.name === "http://gedcomx.org/RectangleRegion") {
                rectangles.push(new Rectangle(source.qualifiers[q].value));
              }
            }
          }
          var nextSd = getSourceDescription(doc, source.description);
          if (isImage(nextSd)) {
            var arkAndRectangles = {image: nextSd.about};
            if (!isEmpty(rectangles)) {
              arkAndRectangles.rectangles = rectangles;
            }
            imageArks.push(arkAndRectangles);
          }
          else {
            findImageArksAndRectangles(nextSd, imageArks);
          }
        }
      }
    }
  }

  // Array of objects, one for each source image found. Each object has {ark: <URL>, coordinates: array of objects with {x1,y1,x2,y2})
  var imageArks = [];
  // Get the "main" SourceDescription for this GedcomX document (i.e., for this Record).
  var mainSd = getSourceDescription(doc, doc.description);

  findImageArksAndRectangles(mainSd, imageArks);

  return imageArks;
}

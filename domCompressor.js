const { JSDOM } = require("jsdom");
const pako = require("pako");

/**
 * Recursively compress a DOM node into a minimal JSON structure.
 * Uses short keys:
 *  - "t": tag name
 *  - "a": attributes object
 *  - "c": children array
 * For text nodes, returns trimmed text if non-empty.
 *
 * @param {Node} node - The DOM node to compress.
 * @returns {Object|string|null} The compressed representation or null if empty.
 */
function compressNode(node) {
  if (node.nodeType === node.ELEMENT_NODE) {
    const obj = { t: node.tagName.toLowerCase() };
    if (node.attributes && node.attributes.length > 0) {
      obj.a = {};
      for (let attr of node.attributes) {
        obj.a[attr.name] = attr.value;
      }
    }
    const children = [];
    node.childNodes.forEach(child => {
      const compressedChild = compressNode(child);
      if (compressedChild !== null) {
        children.push(compressedChild);
      }
    });
    if (children.length > 0) {
      obj.c = children;
    }
    return obj;
  } else if (node.nodeType === node.TEXT_NODE) {
    const text = node.nodeValue.trim();
    return text ? text : null;
  }
  // Ignore other node types (e.g., comments)
  return null;
}

/**
 * Compresses the HTML DOM by creating a minimal JSON representation and
 * then compressing that string using pako (zlib compression).
 *
 * @param {string} html - The HTML string representing the DOM.
 * @returns {Uint8Array} The compressed DOM as a byte array.
 */
function compressDOM(html) {
  // Parse the HTML string using jsdom
  const dom = new JSDOM(html);
  // Use <body> if available; otherwise, fallback to documentElement
  const root = dom.window.document.body || dom.window.document.documentElement;
  const compressedStructure = compressNode(root);
  const jsonString = JSON.stringify(compressedStructure);
  // Compress the JSON string using pako.deflate
  const compressedBytes = pako.deflate(jsonString);
  return compressedBytes;
}

module.exports = { compressDOM };
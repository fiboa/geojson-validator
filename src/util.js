const fs = require('fs/promises');
const path = require('path');
const axios = require('axios');
const YAML = require('yaml');

const cache = {};

// Check if something is an object
function isObject(obj) {
  return (typeof obj === 'object' && obj === Object(obj) && !Array.isArray(obj));
}

// Check whether a URI is an HTTP(S) URL
function isHttp(uri) {
  return uri.startsWith("http://") || uri.startsWith("https://");
}

// Expands folders to files
async function getFiles(files, extensions) {
  const allFiles = [];
  const addFile = async (file) => {
    if (extensions.includes(path.extname(file))) {
      allFiles.push(file);
    }
  };
  // Check for folders and expand the contents to a list of files
  for (const file of files) {
    if (isHttp(file)) {
      allFiles.push(file);
      continue;
    }
    const stat = await fs.lstat(file);
    if (stat.isDirectory()) {
      const folderFiles = await fs.readdir(file);
      for (const folderFile of folderFiles) {
        addFile(path.join(file, folderFile));
      }
    }
    else {
      addFile(file);
    }
  }
  return allFiles;
}

// Load schemas and data from filesystem or URL
async function loadFile(uri) {
  if (cache[uri]) {
    return cache[uri];
  }

  let parser;
  if (uri.endsWith(".yml") || uri.endsWith(".yaml")) {
    parser = YAML.parse;
  }
  else if (uri.endsWith(".json") || uri.endsWith(".geojson")) {
    parser = JSON.parse;
  }
  else {
    // Pass through
    parser = data => data;
  }
  let result;
  if (isHttp(uri)) {
    let response = await axios.get(uri);
    if (typeof response.data === 'string') {
      result = parser(response.data);
    }
    else {
      result = response.data;
    }
  }
  else {
    result = parser(await fs.readFile(uri, "utf8"));
  }
  cache[uri] = result;
  return result;
}

async function loadDatatypes(version) {
  const dtSchemaUrl = `https://fiboa.github.io/specification/v${version}/geojson/datatypes.json`;
  const response = await loadFile(dtSchemaUrl);
  return await response.$defs;
}

async function loadSchema(schemaUrl, version = null) {
  if (typeof schemaUrl !== 'string') {
    schemaUrl = `https://fiboa.github.io/specification/v${version}/schema.yaml`
  }
  return await loadFile(schemaUrl);
}

async function getCollection(data, collectionPath = null, basepath = null) {
  // If the user provided a collection, enforce using it
  if (collectionPath !== null) {
    return await loadFile(collectionPath);
  }

  // Look if the data contains a fiboa property
  if (isObject(data.fiboa)) {
    return data.fiboa;
  }

  // Look for a collection link in the data and load the collection from there
  const links = Array.isArray(data["links"]) ? data["linkg"] : [];
  for (const link of links) {
    const mediaType = link["type"];
    if (link["rel"] === "collection" && (!mediaType || mediaType === "application/json")) {
      let href = link["href"];
      if (basepath !== null) {
        href = new URL(href, basepath).toString();
      }
      return await loadFile(href);
    }
  }

  // No collection found
  return null;
}

module.exports = { getCollection, getFiles, isObject, isHttp, loadDatatypes, loadFile, loadSchema };